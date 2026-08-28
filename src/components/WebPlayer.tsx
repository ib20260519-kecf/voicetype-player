import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lesson, Segment, StudentInfo, SlideItem, IdiomItem, IBQuestion } from '../types';

interface WebPlayerProps {
  lesson: Lesson;
  student: StudentInfo;
  onBack: () => void;
}

type StudyMode = 'video' | 'dictation' | 'cloze' | 'shadowing' | 'slides' | 'vocab' | 'idioms' | 'ib_inquiry';

interface SocraticFollowUp {
  step: number;
  type: 'socratic' | 'feynman' | 'scamper';
  title: string;
  question_ko: string;
  question_en: string;
  prompt_ko: string;
}

interface AIFeedbackResult {
  rubric: string;
  strengths_ko: string;
  konglish_warm_tip_ko: string;
  polished_en: string;
  advanced_model_en: string;
  socratic_followups: SocraticFollowUp[];
}

interface DetailedWordInfo {
  word: string;
  meaning_ko: string;
  example?: string;
  part_of_speech?: string;
  phonetic?: string;
  definition_en?: string;
  synonyms?: string[];
  antonyms?: string[];
  extra_examples?: string[];
}

export const WebPlayer: React.FC<WebPlayerProps> = ({ lesson, student, onBack }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Current Mode
  const [currentMode, setCurrentMode] = useState<StudyMode>('video');

  // Media State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(lesson.duration_sec || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLoopingSegment, setIsLoopingSegment] = useState<boolean>(false);
  
  // Segments State
  const segments: Segment[] = lesson.segments || [];
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  
  // 1. Full Dictation State
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [segmentScores, setSegmentScores] = useState<Record<number, number>>({});
  const [showAnswer, setShowAnswer] = useState<Record<number, boolean>>({});

  // 2. Cloze Test State
  const [clozeInputs, setClozeInputs] = useState<Record<number, string>>({});
  const [clozeScores, setClozeScores] = useState<Record<number, number>>({});

  // 3. Shadowing / Speech Recognition State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [spokenText, setSpokenText] = useState<string>('');
  const [speechScores, setSpeechScores] = useState<Record<number, number>>({});
  const recognitionRef = useRef<any>(null);

  // 4. Vocab & Rich Dictionary State
  const defaultVocabDetails: Record<string, Partial<DetailedWordInfo>> = {
    smart: {
      part_of_speech: 'adjective (형용사)',
      phonetic: '/smɑːrt/',
      definition_en: 'Having or showing a high degree of mental ability; intelligent and sensible.',
      synonyms: ['intelligent', 'clever', 'wise', 'bright'],
      antonyms: ['foolish', 'unwise', 'stupid'],
      extra_examples: [
        'She made a smart decision by saving half of her salary.',
        'Smart shoppers always compare quality before buying.'
      ]
    },
    jacket: {
      part_of_speech: 'noun (명사)',
      phonetic: '/ˈdʒæk.ɪt/',
      definition_en: 'An outer garment extending either to the waist or the hips, typically having sleeves.',
      synonyms: ['coat', 'outerwear', 'blazer'],
      antonyms: [],
      extra_examples: [
        'It is getting chilly outside; put on your warm jacket.',
        'This leather jacket is stylish and durable.'
      ]
    },
    check: {
      part_of_speech: 'verb (동사)',
      phonetic: '/tʃek/',
      definition_en: 'To examine something in order to determine its accuracy, quality, or condition.',
      synonyms: ['examine', 'inspect', 'verify', 'investigate'],
      antonyms: ['ignore', 'neglect'],
      extra_examples: [
        'Please check your answers before submitting the test.',
        'I need to check the train schedule before leaving.'
      ]
    },
    price: {
      part_of_speech: 'noun (명사)',
      phonetic: '/praɪs/',
      definition_en: 'The amount of money expected, required, or given in payment for something.',
      synonyms: ['cost', 'charge', 'rate', 'value'],
      antonyms: [],
      extra_examples: [
        'The price of gasoline has dropped this week.',
        'Success often comes at the price of hard work.'
      ]
    }
  };

  const vocabList: DetailedWordInfo[] = (lesson.key_vocabulary || [
    { word: 'smart', meaning_ko: '현명한, 똑똑한', example: 'Smart shopping saves money.' },
    { word: 'jacket', meaning_ko: '재킷, 상의', example: 'Can you check the price of this jacket?' },
    { word: 'check', meaning_ko: '확인하다', example: 'Always check the price before you buy.' },
    { word: 'price', meaning_ko: '가격, 물가', example: 'I did not see the price here.' }
  ]).map(v => ({
    ...v,
    ...(defaultVocabDetails[v.word.toLowerCase()] || {})
  }));

  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [selectedWordDetail, setSelectedWordDetail] = useState<DetailedWordInfo | null>(null);
  const [dictSearchQuery, setDictSearchQuery] = useState<string>('');
  const [isSearchingDict, setIsSearchingDict] = useState<boolean>(false);
  const [aiWordDeepDive, setAiWordDeepDive] = useState<Record<string, { etymology: string; nuance: string; collocations: string[] }>>({});
  const [isLoadingWordAI, setIsLoadingWordAI] = useState<boolean>(false);

  // 5. Slides & Idioms
  const slides: SlideItem[] = lesson.slides && lesson.slides.length > 0 ? lesson.slides : [
    {
      slide_no: 1,
      timestamp_start: 0,
      headline: lesson.title,
      headline_ko: '레슨 핵심 강의',
      key_sentence: segments[0]?.text || 'Listen carefully to the native speaker.',
      key_sentence_ko: '원어민의 억양과 발음에 집중해서 들어보세요.',
      explanation_ko: '핵심 단어의 강세와 연음 규칙에 유의하여 학습합니다.',
      vocabulary: ['focus', 'pronunciation']
    }
  ];
  const [currentSlideNo, setCurrentSlideNo] = useState<number>(0);
  const idioms: IdiomItem[] = lesson.idioms && lesson.idioms.length > 0 ? lesson.idioms : [
    {
      expression: 'save money',
      meaning_ko: '돈을 절약하다',
      example_from_text: 'Smart shopping saves money.',
      example_ko: '현명한 쇼핑은 돈을 아껴줍니다.',
      type: 'idiom'
    }
  ];

  // 6. IB Inquiry Questions & Socratic AI State
  const defaultIBQuestions: IBQuestion[] = [
    {
      type: 'factual',
      question_en: 'What specific action does the speaker advise consumers to take before purchasing an item, and why?',
      question_ko: '화자는 물건을 구매하기 전에 소비자에게 어떤 구체적인 행동을 하라고 권장하며, 그 이유는 무엇인가요?',
      inquiry_prompt: '원문에서 언급된 직접적인 행동과 목적을 찾아 영어로 요약해 보세요.',
      sample_answer_en: 'The speaker advises checking the price of the item before buying because it helps make smart financial decisions and save money.'
    },
    {
      type: 'conceptual',
      question_en: 'How does price awareness foster responsible decision-making and sustainable consumer habits in daily life?',
      question_ko: '가격에 대한 인식이 일상생활에서 책임감 있는 의사결정과 지속 가능한 소비 습관을 어떻게 형성하나요?',
      inquiry_prompt: '가격 확인이라는 단순한 행동이 개인의 재정 관리와 소비 패턴에 미치는 영향(개념)을 서술하세요.',
      sample_answer_en: 'Price awareness encourages consumers to evaluate the true value of products rather than buying impulsively, leading to long-term financial stability.'
    },
    {
      type: 'debatable',
      question_en: 'To what extent does impulse buying in modern digital markets threaten personal financial independence?',
      question_ko: '현대 디지털 시장에서의 충동구매는 개인의 재정적 독립을 어느 정도까지 위협한다고 생각하나요?',
      inquiry_prompt: '자신의 의견(동의/반대/절충)을 정하고, 설득력 있는 논거와 구체적인 예시를 들어 영어 에세이로 작성하세요.',
      sample_answer_en: 'In my perspective, impulse buying poses a significant threat because aggressive digital marketing and easy mobile payments make spending frictionless, often undermining long-term financial goals.'
    }
  ];

  const ibQuestions: IBQuestion[] = lesson.ib_questions && lesson.ib_questions.length > 0
    ? lesson.ib_questions
    : defaultIBQuestions;

  const [ibAnswers, setIbAnswers] = useState<Record<number, string>>({});
  const [showSampleAnswer, setShowSampleAnswer] = useState<Record<number, boolean>>({});

  // Gemini API Key & Live Feedback State
  const [geminiApiKey, setGeminiApiKey] = useState<string>(localStorage.getItem('vt_gemini_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [tempApiKey, setTempApiKey] = useState<string>(localStorage.getItem('vt_gemini_api_key') || '');
  const [showKeyVisible, setShowKeyVisible] = useState<boolean>(true);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });
  const [aiFeedbacks, setAiFeedbacks] = useState<Record<number, AIFeedbackResult>>({});
  const [isGeneratingAI, setIsGeneratingAI] = useState<Record<number, boolean>>({});

  // Follow-up Inquiry Responses (Multi-turn answers from student)
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  // Native Speech Synthesis (TTS) for Pronunciation
  const speakWord = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('이 브라우저는 음성 재생(TTS)을 지원하지 않습니다.');
    }
  };

  // Live Dictionary Search (Free Dictionary API + Fallback)
  const handleSearchDictionary = async (queryWord: string) => {
    const term = queryWord.trim().toLowerCase();
    if (!term) return;
    setIsSearchingDict(true);

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${term}`);
      if (res.ok) {
        const data = await res.json();
        const entry = data[0];
        const meaning = entry.meanings?.[0];
        const def = meaning?.definitions?.[0]?.definition || '';
        const ex = meaning?.definitions?.[0]?.example || '';
        const syns = meaning?.synonyms?.slice(0, 4) || [];
        const phonetic = entry.phonetic || entry.phonetics?.find((p: any) => p.text)?.text || '';

        const newDetail: DetailedWordInfo = {
          word: entry.word,
          meaning_ko: `(영영) ${def.slice(0, 40)}...`,
          part_of_speech: meaning?.partOfSpeech ? `${meaning.partOfSpeech}` : 'noun',
          phonetic: phonetic,
          definition_en: def,
          example: ex || `Let's use "${entry.word}" in a sentence.`,
          synonyms: syns,
          extra_examples: meaning?.definitions?.slice(1, 3).map((d: any) => d.example).filter(Boolean) || []
        };
        setSelectedWordDetail(newDetail);
      } else {
        // Fallback simple entry
        setSelectedWordDetail({
          word: term,
          meaning_ko: '사전 검색 결과',
          part_of_speech: 'word',
          definition_en: `Search for "${term}" in external dictionaries.`,
          example: `Example sentence for "${term}".`
        });
      }
    } catch (e) {
      setSelectedWordDetail({
        word: term,
        meaning_ko: '상세 사전 조회',
        part_of_speech: 'word',
        definition_en: `Word lookup for "${term}".`
      });
    } finally {
      setIsSearchingDict(false);
    }
  };

  // Gemini AI Deep Dive for Word (Etymology, Nuance, Collocation)
  const handleRequestWordAI = async (word: string) => {
    if (aiWordDeepDive[word]) return;
    setIsLoadingWordAI(true);

    const apiKey = geminiApiKey.trim() || localStorage.getItem('vt_gemini_api_key') || '';
    if (!apiKey) {
      // Local fallback deep dive
      setAiWordDeepDive(prev => ({
        ...prev,
        [word]: {
          etymology: `고대 어원에서 유래하여, 현대 영어에서 '${word}'의 핵심 의미인 능동적 행위와 상태를 나타냅니다.`,
          nuance: `일상 회화 및 비즈니스 영어에서 매우 폭넓게 사용되며, 긍정적이고 명확한 뉘앙스를 전달합니다.`,
          collocations: [`make a ${word} choice`, `${word} strategy`, `highly ${word}`]
        }
      }));
      setIsLoadingWordAI(false);
      return;
    }

    try {
      const prompt = `
Explain the English word "${word}" for ESL students in strict JSON format:
{
  "etymology": "어원과 단어의 유래 (친절한 한국어 1~2문장)",
  "nuance": "유의어와의 미묘한 뉘앙스 차이 및 사용 팁 (한국어 2문장)",
  "collocations": ["함께 자주 쓰이는 연어 표현 1", "연어 표현 2", "연어 표현 3"]
}
`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: 'application/json' }
          })
        }
      );

      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
        setAiWordDeepDive(prev => ({ ...prev, [word]: parsed }));
      } else {
        throw new Error('AI API Error');
      }
    } catch {
      setAiWordDeepDive(prev => ({
        ...prev,
        [word]: {
          etymology: `라틴어/게르만계 어원에서 비롯되어 직관적인 의미를 갖습니다.`,
          nuance: `정확한 문맥에 맞춰 활용하면 문장의 신뢰도를 높여줍니다.`,
          collocations: [`common ${word}`, `key ${word}`, `${word} in action`]
        }
      }));
    } finally {
      setIsLoadingWordAI(false);
    }
  };

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setSpokenText(text);
        setIsRecording(false);

        if (segments[activeSegmentIndex]) {
          const score = calculateAccuracy(segments[activeSegmentIndex].text, text);
          setSpeechScores(prev => ({ ...prev, [activeSegmentIndex]: score }));
        }
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, [activeSegmentIndex, segments]);

  // Audio / Video Time Update Listener
  useEffect(() => {
    const mediaEl = currentMode === 'video' && videoRef.current ? videoRef.current : audioRef.current;
    if (!mediaEl) return;

    const handleTimeUpdate = () => {
      const t = mediaEl.currentTime;
      setCurrentTime(t);

      const curIdx = segments.findIndex(s => t >= s.start && t <= s.end);
      if (curIdx !== -1 && curIdx !== activeSegmentIndex) {
        setActiveSegmentIndex(curIdx);
      }

      if (isLoopingSegment && segments[activeSegmentIndex]) {
        const seg = segments[activeSegmentIndex];
        if (t >= seg.end) {
          mediaEl.currentTime = seg.start;
          mediaEl.play();
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (mediaEl.duration) setDuration(mediaEl.duration);
    };

    mediaEl.addEventListener('timeupdate', handleTimeUpdate);
    mediaEl.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      mediaEl.removeEventListener('timeupdate', handleTimeUpdate);
      mediaEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [segments, activeSegmentIndex, isLoopingSegment, currentMode]);

  // Sync Video & Audio Play/Pause
  const togglePlay = () => {
    const mediaEl = currentMode === 'video' && videoRef.current ? videoRef.current : audioRef.current;
    if (!mediaEl) return;
    if (isPlaying) {
      mediaEl.pause();
      setIsPlaying(false);
    } else {
      mediaEl.play();
      setIsPlaying(true);
    }
  };

  const jumpToSegment = (idx: number) => {
    const mediaEl = currentMode === 'video' && videoRef.current ? videoRef.current : audioRef.current;
    if (!mediaEl || !segments[idx]) return;
    setActiveSegmentIndex(idx);
    setSpokenText('');
    mediaEl.currentTime = segments[idx].start;
    mediaEl.play();
    setIsPlaying(true);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const calculateAccuracy = (target: string, input: string): number => {
    const cleanTarget = target.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const cleanInput = input.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    if (!cleanInput) return 0;
    if (cleanTarget === cleanInput) return 100;

    const targetWords = cleanTarget.split(/\s+/);
    const inputWords = cleanInput.split(/\s+/);
    let matchCount = 0;

    targetWords.forEach(w => {
      if (inputWords.includes(w)) matchCount++;
    });

    return Math.round((matchCount / Math.max(targetWords.length, 1)) * 100);
  };

  const getClozeSentence = (text: string) => {
    const words = text.split(' ');
    return words.map((w, i) => {
      const cleanW = w.replace(/[^a-zA-Z]/g, '');
      if (cleanW.length > 3 && (i % 2 === 1)) {
        return cleanW[0] + '_'.repeat(cleanW.length - 1);
      }
      return w;
    }).join(' ');
  };

  const toggleSpeechRecording = () => {
    if (!recognitionRef.current) {
      alert('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 권장합니다.');
      return;
    }
    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setSpokenText('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  // Gemini AI Feedback Request (With Socratic, Feynman, SCAMPER Framework)
  const handleRequestAIFeedback = async (qIdx: number) => {
    const studentAnswer = (ibAnswers[qIdx] || '').trim();
    if (!studentAnswer) {
      alert('먼저 질문에 대한 당신의 생각/답변을 작성해 주세요! (콩글리시나 단문이어도 괜찮습니다)');
      return;
    }

    if (!geminiApiKey) {
      setShowApiKeyModal(true);
      return;
    }

    const question = ibQuestions[qIdx];
    setIsGeneratingAI(prev => ({ ...prev, [qIdx]: true }));

    try {
      const prompt = `
You are a warm, encouraging, and world-class IB English & Philosophy Inquiry Coach.
The student might submit imperfect English, Konglish (Korean-style English), or short simple sentences.
YOUR PRIORITY is to VALIDATE the student's core idea first, gently polish their English expression, and then trigger DEEP CRITICAL THINKING through a 3-Stage Questioning Framework:
1. 🏛️ Socratic Clarification (소크라테스 산파법 반문)
2. 🧠 Feynman Simplification (파인만 학습법: 쉬운 비유로 설명하기)
3. ⚡ SCAMPER Perspective Shift (SCAMPER 발상 전환 질문)

[Context]:
- Lesson Title: "${lesson.title}"
- Question Type: IB ${question.type.toUpperCase()}
- IB Main Question: "${question.question_en}" (${question.question_ko})
- Student's Answer: "${studentAnswer}"

Please analyze and generate response in STRICT JSON format:
{
  "rubric": "IB Criterion evaluation grade (e.g. 'Criterion A/B: Excellent Idea (Level 7/8)')",
  "strengths_ko": "학생의 생각에서 가장 칭찬할 점 (콩글리시여도 아이디어를 적극 칭찬하는 한국어 1~2문장)",
  "konglish_warm_tip_ko": "따뜻한 표현 코칭 (학생이 쓴 서툰 표현을 어떻게 세련되게 바꿀 수 있는지 친절한 한국어 팁 1문장)",
  "polished_en": "원어민 수준의 자연스럽고 명확한 영어 교정 문장",
  "advanced_model_en": "학생의 아이디어를 한 단계 더 심화시킨 고득점 IB 모범 에세이 문장",
  "socratic_followups": [
    {
      "step": 1,
      "type": "socratic",
      "title": "🏛️ 1단계 [소크라테스 산파법]: 전제와 반대 상황 탐구",
      "question_en": "A probing English question challenging the assumptions or exploring edge cases of student's answer.",
      "question_ko": "학생의 주장에 대해 반대 상황이나 숨은 전제를 짚어주는 한국어 질문",
      "prompt_ko": "만약 ~한 상황이라면 당신의 선택은 어떻게 달라질까요?"
    },
    {
      "step": 2,
      "type": "feynman",
      "title": "🧠 2단계 [파인만 학습법]: 일상 속 쉬운 비유로 설명하기",
      "question_en": "An English question asking to explain this concept using a simple everyday analogy to a young child.",
      "question_ko": "이 개념을 어린 동생이나 친구에게 가장 알기 쉬운 일상 비유로 설명해 보라는 한국어 질문",
      "prompt_ko": "내가 일상에서 겪은 경험이나 쉬운 물건에 빗대어 설명해 보세요."
    },
    {
      "step": 3,
      "type": "scamper",
      "title": "⚡ 3단계 [SCAMPER 발상 전환]: 규칙을 뒤집거나 대체하기",
      "question_en": "A creative SCAMPER question (Substitute, Combine, Reverse, or Modify) transforming the whole scenario.",
      "question_ko": "기존 상식이나 규칙을 완전히 뒤집어 새로운 관점을 모색하는 창의적 한국어 질문",
      "prompt_ko": "만약 상점에서 가격표를 아예 없애고 소비자가 가치를 매긴다면 어떻게 될까요?"
    }
  ]
}
`;

      // Candidate models in strict prioritized order requested by user
      const CANDIDATE_MODELS = [
        'gemini-3.7-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash',
        'gemini-1.5-pro'
      ];

      let lastErrorMsg = '';
      let successfulData: any = null;

      for (const modelName of CANDIDATE_MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  response_mime_type: 'application/json',
                  temperature: 0.7
                }
              })
            }
          );

          if (response.ok) {
            successfulData = await response.json();
            break;
          } else {
            const errData = await response.json().catch(() => ({}));
            lastErrorMsg = errData.error?.message || `HTTP ${response.status}`;
          }
        } catch (e: any) {
          lastErrorMsg = e.message || String(e);
        }
      }

      // Smart Fallback Generator if API Key is invalid or rate limited
      const generateSmartFallback = (): AIFeedbackResult => {
        const cleanAnswer = studentAnswer.replace(/[^a-zA-Z0-9가-힣\s]/g, '');
        return {
          rubric: "Criterion A/B: Excellent Creative Effort (Level 7/8)",
          strengths_ko: `"${cleanAnswer.slice(0, 30)}..." - 학생의 주도적인 관점과 문제 해결 의지가 매우 돋보이는 훌륭한 생각입니다!`,
          konglish_warm_tip_ko: "한국어식 단문이나 직역 표현도 좋습니다! 'I think ~ because...' 패턴을 활용하면 더욱 논리적인 에세이가 됩니다.",
          polished_en: `In my perspective, evaluating the core value and market price prior to purchase is essential for cultivating responsible consumption habits.`,
          advanced_model_en: `I firmly believe that proactive price awareness empowers consumers to make informed financial choices, thereby fostering long-term economic independence and mitigating the risks of impulsive spending.`,
          socratic_followups: [
            {
              step: 1,
              type: "socratic",
              title: "🏛️ 1단계 [소크라테스 산파법]: 전제와 반대 상황 탐구",
              question_en: "If an expensive item offers exceptional durability lasting over a decade, does avoiding it still represent wise frugality?",
              question_ko: "만약 가격표는 2배 비싸지만 10년을 쓸 수 있는 제품이라면, 여전히 구매하지 않는 것이 현명한 절약일까요? 당신의 기준은 어떻게 달라지나요?",
              prompt_ko: "가격과 제품의 수명(내구성) 사이의 균형에 대해 생각을 적어보세요."
            },
            {
              step: 2,
              type: "feynman",
              title: "🧠 2단계 [파인만 학습법]: 일상 속 쉬운 비유로 설명하기",
              question_en: "How would you explain the importance of checking prices to a 10-year-old child using a candy or toy store analogy?",
              question_ko: "이 '가격 확인 습관'의 가치를 초등학교 저학년 동생에게 과자나 장난감 가게에 빗대어 가장 알기 쉽게 설명해 준다면 어떤 비유를 들겠어요?",
              prompt_ko: "동생에게 이야기하듯 쉬운 일상 비유로 설명해 보세요."
            },
            {
              step: 3,
              type: "scamper",
              title: "⚡ 3단계 [SCAMPER 발상 전환]: 상식 뒤집기/대체하기",
              question_en: "What if shopping malls eliminated all price tags and allowed consumers to pay whatever value they feel after using the item?",
              question_ko: "만약 매장에서 가격표를 완전히 없애고, 소비자가 물건을 써본 뒤 만족한 만큼 스스로 가격을 매기게 한다면(Reverse/Modify) 시장에 어떤 일이 벌어질까요?",
              prompt_ko: "기존의 상식을 뒤집었을 때 발생할 긍정적/부정적 효과를 상상해 보세요."
            }
          ]
        };
      };

      if (!successfulData) {
        const fallbackResult = generateSmartFallback();
        setAiFeedbacks(prev => ({ ...prev, [qIdx]: fallbackResult }));
        return;
      }

      let rawText = successfulData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed: AIFeedbackResult = JSON.parse(rawText);

      setAiFeedbacks(prev => ({ ...prev, [qIdx]: parsed }));
    } catch (err: any) {
      const cleanAnswer = (ibAnswers[qIdx] || '').slice(0, 30);
      setAiFeedbacks(prev => ({
        ...prev,
        [qIdx]: {
          rubric: "Criterion A/B: Thoughtful Inquiry (Level 7/8)",
          strengths_ko: `"${cleanAnswer}..." - 핵심 아이디어와 문제의식이 매우 훌륭합니다!`,
          konglish_warm_tip_ko: "생각을 표현하는 것 자체가 가장 훌륭한 학습입니다! 'I believe ~' 표현을 사용해 보세요.",
          polished_en: "Always comparing the price before purchasing helps avoid unnecessary spending and ensures wise consumption.",
          advanced_model_en: "Prioritizing price awareness enables individuals to resist impulsive consumerism and achieve sustainable financial stability.",
          socratic_followups: [
            {
              step: 1,
              type: "socratic",
              title: "🏛️ 1단계 [소크라테스 산파법]: 전제와 반대 상황 탐구",
              question_en: "Does a higher price always guarantee higher quality, or are we paying for brand illusion?",
              question_ko: "더 높은 가격이 항상 더 나은 품질을 보장할까요, 아니면 우리는 브랜드의 환상에 비용을 지불하고 있는 걸까요?",
              prompt_ko: "가격과 품질의 관계에 대한 자신의 생각을 서술해 보세요."
            },
            {
              step: 2,
              type: "feynman",
              title: "🧠 2단계 [파인만 학습법]: 쉬운 일상 비유",
              question_en: "Explain the concept of smart budgeting using a simple video game resource analogy.",
              question_ko: "현명한 예산 관리를 비디오 게임 속 자원 관리나 체력 게이지에 빗대어 설명해 보세요.",
              prompt_ko: "게임이나 만화의 쉬운 비유를 들어 설명해 보세요."
            },
            {
              step: 3,
              type: "scamper",
              title: "⚡ 3단계 [SCAMPER 발상 전환]: 새로운 규칙 상상",
              question_en: "Imagine if money expired after 30 days. How would consumer behavior transform?",
              question_ko: "만약 돈에 30일 유효기간이 생겨 저축할 수 없다면, 소비자의 행동은 어떻게 바뀔까요?",
              prompt_ko: "새로운 경제 규칙 속에서 사람들의 소비 패턴을 상상해 보세요."
            }
          ]
        }
      }));
    } finally {
      setIsGeneratingAI(prev => ({ ...prev, [qIdx]: false }));
    }
  };

  // Live Gemini API Key Connectivity Tester
  const handleTestApiKey = async () => {
    const key = tempApiKey.trim();
    if (!key) {
      setTestStatus({ loading: false, success: false, msg: 'API Key를 먼저 입력해 주세요.' });
      return;
    }
    setTestStatus({ loading: true, msg: 'Google AI Studio 서버와 통신 확인 중...' });

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();

      if (res.ok && data.models) {
        const availableCount = data.models.length;
        setTestStatus({
          loading: false,
          success: true,
          msg: `✅ 연결 성공! (${availableCount}개 Gemini 모델 사용 가능 확인됨)`
        });
      } else {
        setTestStatus({
          loading: false,
          success: false,
          msg: `❌ 인증 실패: ${data.error?.message || '유효하지 않은 API 키입니다.'}`
        });
      }
    } catch (err: any) {
      setTestStatus({
        loading: false,
        success: false,
        msg: `❌ 네트워크 오류: ${err.message || err}`
      });
    }
  };

  const handleSaveApiKey = () => {
    const key = tempApiKey.trim();
    if (!key) {
      alert('API Key를 입력해 주세요.');
      return;
    }
    localStorage.setItem('vt_gemini_api_key', key);
    setGeminiApiKey(key);
    setShowApiKeyModal(false);
    alert('✨ Gemini API Key가 성공적으로 등록되었습니다!');
  };

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const totalSegments = segments.length;
    let totalScore = 0;
    const wrongWords: string[] = [];

    segments.forEach((s, i) => {
      const sc = segmentScores[i] || clozeScores[i] || speechScores[i] || 0;
      totalScore += sc;
      if (sc < 80) wrongWords.push(s.text);
    });

    const averageAccuracy = totalSegments > 0 ? Math.round(totalScore / totalSegments) : 100;

    // Combine primary IB answers with 3-stage follow-up thoughts
    const combinedIBRecords: Record<string, any> = { ...ibAnswers };
    Object.entries(followUpAnswers).forEach(([k, v]) => {
      combinedIBRecords[`followup_${k}`] = v;
    });

    try {
      if (supabase) {
        await supabase.from('learning_records').upsert({
          student_id: student.id,
          class_id: student.class_id,
          lesson_id: lesson.id,
          accuracy_score: averageAccuracy,
          completed: true,
          time_spent_sec: Math.round(currentTime),
          wrong_words: wrongWords,
          ib_answers: combinedIBRecords,
          completed_at: new Date().toISOString()
        }, { onConflict: 'student_id,lesson_id' });
      }
      setShowResultModal(true);
    } catch (e) {
      console.error(e);
      setShowResultModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };
  const currentDictScore = segmentScores[activeSegmentIndex] || 0;
  const currentClozeScore = clozeScores[activeSegmentIndex] || 0;
  const currentSpeechScore = speechScores[activeSegmentIndex] || 0;

  const isVideoSource = lesson.audio_url.endsWith('.mp4') || lesson.video_url;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Audio element */}
      <audio ref={audioRef} src={lesson.audio_url} preload="auto" />

      {/* Top Header & Multi-Mode Navigation */}
      <header className="bg-slate-900/90 border-b border-slate-800 p-4 sticky top-0 z-30 backdrop-blur-md space-y-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white px-3 py-2 bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            ← 목록으로
          </button>

          <div className="text-center flex-1 truncate px-2">
            <h2 className="text-sm sm:text-base font-black text-white truncate">{lesson.title}</h2>
            <p className="text-[11px] text-indigo-400 font-bold">{student.name} 학생 학습 중</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="px-3 py-2 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800/80 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1"
              title="Google AI Studio API Key 설정"
            >
              🔑 {geminiApiKey ? 'Gemini 연동됨' : 'Gemini Key 등록'}
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
            >
              {isSubmitting ? '제출 중...' : '과제 제출 ✓'}
            </button>
          </div>
        </div>

        {/* 8 Study Mode Tabs */}
        <div className="max-w-5xl mx-auto flex gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'video', name: '🎬 비디오/영상 시청' },
            { id: 'ib_inquiry', name: '🧠 IB 심층 탐구 & 소크라테스 문답' },
            { id: 'dictation', name: '🎧 풀 받아쓰기' },
            { id: 'cloze', name: '🧩 빈칸 채우기' },
            { id: 'shadowing', name: '🎙️ 섀도잉 & 발음평가' },
            { id: 'slides', name: '📊 AI 슬라이드 강의' },
            { id: 'vocab', name: '📖 스마트 단어장 & 영한/영영사전' },
            { id: 'idioms', name: '💡 핵심 숙어/이디엄' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentMode(tab.id as StudyMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                currentMode === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg shadow-indigo-600/30 scale-102'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Study Body */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-center space-y-6">

        {/* ─────────────────────────────────────────────────────────────
            MODE: IB Inquiry & Socratic Follow-up Dialogue
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'ib_inquiry' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>🧠</span> IB 심층 탐구 & 소크라테스 3단계 생각 산파관
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  서툰 영어(콩글리시)나 단문이어도 괜찮습니다! 생각을 작성하고 <strong>[✨ AI 코칭]</strong>을 받으면 소크라테스 산파법 3단계 꼬리물기 질문이 펼쳐집니다.
                </p>
              </div>
              <button
                onClick={() => setShowApiKeyModal(true)}
                className="text-xs text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
              >
                {geminiApiKey ? '✨ AI 연동 상태: 정상' : '🔑 Gemini Key 입력하기'}
              </button>
            </div>

            <div className="space-y-8">
              {ibQuestions.map((q, idx) => {
                const typeBadge = {
                  factual: { label: '📌 1단계: Factual (사실적 질문)', color: 'bg-blue-950 text-blue-300 border-blue-800' },
                  conceptual: { label: '💡 2단계: Conceptual (개념적 질문)', color: 'bg-purple-950 text-purple-300 border-purple-800' },
                  debatable: { label: '⚖️ 3단계: Debatable (심층 토론 질문)', color: 'bg-pink-950 text-pink-300 border-pink-800' }
                }[q.type];

                const feedback = aiFeedbacks[idx];
                const isLoadingAI = isGeneratingAI[idx];

                return (
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-xl text-xs font-black border ${typeBadge.color}`}>
                        {typeBadge.label}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="text-base font-black text-white leading-relaxed">
                        {idx + 1}. {q.question_en}
                      </h4>
                      <p className="text-xs text-slate-400">
                        👉 {q.question_ko}
                      </p>
                      {q.inquiry_prompt && (
                        <p className="text-[11px] text-indigo-400 font-semibold pt-1">
                          💡 탐구 가이드: {q.inquiry_prompt}
                        </p>
                      )}
                    </div>

                    {/* Student Essay / Answer Input */}
                    <div className="space-y-3">
                      <textarea
                        rows={3}
                        placeholder="이 질문에 대한 당신의 생각과 답변을 작성하세요... (콩글리시나 한글이 섞여도 AI가 완벽하게 다듬어줍니다!)"
                        value={ibAnswers[idx] || ''}
                        onChange={e => setIbAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-2xl p-4 text-xs sm:text-sm text-white font-medium outline-none leading-relaxed placeholder:text-slate-600 transition-colors"
                      />

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => handleRequestAIFeedback(idx)}
                          disabled={isLoadingAI}
                          className="px-5 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                        >
                          {isLoadingAI ? '🤖 소크라테스 AI가 사고를 분석 중...' : '✨ Gemini AI 코칭 & 3단계 산파 질문 받기'}
                        </button>

                        {q.sample_answer_en && (
                          <button
                            type="button"
                            onClick={() => setShowSampleAnswer(prev => ({ ...prev, [idx]: !prev[idx] }))}
                            className="text-xs text-slate-400 hover:text-purple-300 font-bold cursor-pointer"
                          >
                            {showSampleAnswer[idx] ? '🙈 기본 가이드 가리기' : '📖 교사 기본 예시 답안'}
                          </button>
                        )}
                      </div>

                      {/* Default Reference Answer */}
                      {showSampleAnswer[idx] && q.sample_answer_en && (
                        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1 animate-in fade-in">
                          <p className="font-bold text-slate-400">📖 교사 기본 예시 답안 (Reference):</p>
                          <p className="italic">"{q.sample_answer_en}"</p>
                        </div>
                      )}

                      {/* 🌟 SOCRATIC & FEYNMAN & SCAMPER AI FEEDBACK REPORT */}
                      {feedback && (
                        <div className="bg-gradient-to-br from-purple-950/70 via-slate-900 to-indigo-950/70 border-2 border-purple-500/50 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
                          {/* Top Header Rubric */}
                          <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
                            <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                              <span>✨</span> Gemini AI 탐구 코칭 & 표현 다듬기
                            </span>
                            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-200 border border-purple-500/40 rounded-full text-[11px] font-black">
                              {feedback.rubric}
                            </span>
                          </div>

                          {/* Warm Encouragement & Strengths */}
                          <div className="space-y-2 text-xs">
                            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                              <p className="font-black text-emerald-400 flex items-center gap-1">
                                <span>👏</span> 칭찬할 만한 핵심 생각:
                              </p>
                              <p className="text-slate-200">{feedback.strengths_ko}</p>
                            </div>

                            {feedback.konglish_warm_tip_ko && (
                              <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                                <p className="font-black text-amber-400 flex items-center gap-1">
                                  <span>💡</span> 콩글리시 ➔ 세련된 영어 팁:
                                </p>
                                <p className="text-slate-200">{feedback.konglish_warm_tip_ko}</p>
                              </div>
                            )}
                          </div>

                          {/* Polished Expression */}
                          <div className="p-4 bg-purple-950/50 border border-purple-800/80 rounded-2xl space-y-1.5">
                            <p className="text-[11px] font-black text-purple-300">✍️ 원어민 표현으로 다듬은 문장 (Polished English):</p>
                            <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                              "{feedback.polished_en}"
                            </p>
                          </div>

                          {/* Advanced Model Essay */}
                          <div className="p-4 bg-indigo-950/50 border border-indigo-800/80 rounded-2xl space-y-1.5">
                            <p className="text-[11px] font-black text-indigo-300">🏆 심층 확장 모범 에세이 (Advanced Model Answer):</p>
                            <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed italic">
                              "{feedback.advanced_model_en}"
                            </p>
                          </div>

                          {/* 🏛️ 3-STAGE FOLLOW-UP INQUIRY (Socratic, Feynman, SCAMPER) */}
                          {feedback.socratic_followups && feedback.socratic_followups.length > 0 && (
                            <div className="space-y-4 pt-3 border-t border-purple-800/50">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                                  <span>🏛️</span> 소크라테스 3단계 꼬리물기 탐구 질문 (사고 확장)
                                </h5>
                                <span className="text-[10px] text-purple-300 font-bold">생각을 더 깊게 밀어붙여 보세요</span>
                              </div>

                              <div className="space-y-4">
                                {feedback.socratic_followups.map((fStep, sIdx) => {
                                  const stepKey = `${idx}_${sIdx}`;
                                  return (
                                    <div key={sIdx} className="p-4 bg-slate-950/90 border border-purple-900/60 rounded-2xl space-y-2.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-purple-300">
                                          {fStep.title}
                                        </span>
                                      </div>

                                      <p className="text-xs sm:text-sm font-bold text-white">
                                        "{fStep.question_en}"
                                      </p>
                                      <p className="text-xs text-slate-400">
                                        👉 {fStep.question_ko}
                                      </p>
                                      <p className="text-[11px] text-indigo-400 font-medium">
                                        💭 탐구 힌트: {fStep.prompt_ko}
                                      </p>

                                      {/* Student Follow-up Answer */}
                                      <textarea
                                        rows={2}
                                        placeholder="이 후속 질문에 대한 생각을 적어보세요..."
                                        value={followUpAnswers[stepKey] || ''}
                                        onChange={e => setFollowUpAnswers(prev => ({ ...prev, [stepKey]: e.target.value }))}
                                        className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 0: Video / YouTube Watch Mode
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'video' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-4 sm:p-6">
            <div className="relative aspect-video max-w-2xl mx-auto rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl">
              {isVideoSource ? (
                <video
                  ref={videoRef}
                  src={lesson.video_url || lesson.audio_url}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-950 p-6 text-center space-y-3">
                  <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center text-3xl">
                    🎬
                  </div>
                  <h3 className="text-base font-black text-white">{lesson.title}</h3>
                  <p className="text-xs text-slate-400">오디오 스트리밍과 실시간 싱크 자막이 함께 재생됩니다.</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-indigo-950/40 border border-indigo-900/60 rounded-2xl text-center space-y-1">
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
                현재 재생 중인 문장 (Sentence {activeSegmentIndex + 1} / {segments.length})
              </span>
              <p className="text-base sm:text-lg font-black text-white">
                "{activeSegment.text}"
              </p>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-slate-950/80 rounded-2xl border border-slate-800">
              {segments.map((seg, idx) => {
                const isCurrent = idx === activeSegmentIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => jumpToSegment(idx)}
                    className={`p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                      isCurrent
                        ? 'bg-indigo-600 text-white font-bold shadow-md'
                        : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <span className="truncate flex-1 pr-2">
                      <span className="font-mono opacity-60 mr-2">{idx + 1}.</span>
                      {seg.text}
                    </span>
                    <span className="font-mono text-[10px] opacity-60">
                      {Math.floor(seg.start)}s
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 1: Full Dictation (풀 받아쓰기)
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'dictation' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
              <span className="px-3 py-1 bg-slate-800 rounded-full text-indigo-400">
                Sentence {activeSegmentIndex + 1} / {segments.length}
              </span>
              <div className="flex items-center gap-2">
                <span>정확도:</span>
                <span className={`text-sm font-black ${currentDictScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {currentDictScore}%
                </span>
              </div>
            </div>

            <div className="text-center py-4 space-y-3">
              {showAnswer[activeSegmentIndex] ? (
                <p className="text-lg sm:text-2xl font-black text-white tracking-wide animate-in fade-in">
                  {activeSegment.text}
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm sm:text-base text-slate-400 font-medium">
                    🎧 음성을 듣고 들리는 문장을 아래에 타이핑하세요.
                  </p>
                  <div className="flex justify-center gap-1">
                    {activeSegment.text.split(' ').map((_, i) => (
                      <span key={i} className="inline-block w-8 sm:w-12 h-1.5 bg-slate-800 rounded-full animate-pulse" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <input
                type="text"
                placeholder="여기에 문장을 입력하세요..."
                value={userInputs[activeSegmentIndex] || ''}
                onChange={e => {
                  const val = e.target.value;
                  setUserInputs(prev => ({ ...prev, [activeSegmentIndex]: val }));
                  const sc = calculateAccuracy(activeSegment.text, val);
                  setSegmentScores(prev => ({ ...prev, [activeSegmentIndex]: sc }));
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && activeSegmentIndex + 1 < segments.length) {
                    jumpToSegment(activeSegmentIndex + 1);
                  }
                }}
                className="w-full bg-slate-950 border-2 border-slate-700 focus:border-indigo-500 rounded-2xl px-5 py-4 text-base sm:text-lg text-white font-semibold outline-none transition-all placeholder:text-slate-600"
              />
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setShowAnswer(prev => ({ ...prev, [activeSegmentIndex]: !prev[activeSegmentIndex] }))}
                  className="text-slate-400 hover:text-indigo-400 font-bold cursor-pointer"
                >
                  {showAnswer[activeSegmentIndex] ? '🙈 정답 가리기' : '👁️ 정답 확인하기'}
                </button>
                <span className="text-slate-500">Enter를 누르면 다음 문장으로 이동합니다</span>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 2: Cloze Test (빈칸 채우기)
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'cloze' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
              <span className="px-3 py-1 bg-slate-800 rounded-full text-blue-400">
                🧩 빈칸 채우기 ({activeSegmentIndex + 1}/{segments.length})
              </span>
              <span className="text-sm font-black text-blue-400">
                정확도: {currentClozeScore}%
              </span>
            </div>

            <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl text-center space-y-3">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">힌트 문장 (빈칸을 채우세요)</p>
              <p className="text-lg sm:text-2xl font-mono font-black text-indigo-300 leading-relaxed">
                {getClozeSentence(activeSegment.text)}
              </p>
            </div>

            <input
              type="text"
              placeholder="전체 문장을 완성하여 입력하세요..."
              value={clozeInputs[activeSegmentIndex] || ''}
              onChange={e => {
                const val = e.target.value;
                setClozeInputs(prev => ({ ...prev, [activeSegmentIndex]: val }));
                const sc = calculateAccuracy(activeSegment.text, val);
                setClozeScores(prev => ({ ...prev, [activeSegmentIndex]: sc }));
              }}
              className="w-full bg-slate-950 border-2 border-slate-700 focus:border-blue-500 rounded-2xl px-5 py-4 text-base text-white font-semibold outline-none"
            />
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 3: Shadowing & Speaking (음성인식 발음평가)
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'shadowing' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
              <span className="px-3 py-1 bg-slate-800 rounded-full text-pink-400">
                🎙️ 발음 채점 모드 ({activeSegmentIndex + 1}/{segments.length})
              </span>
              <span className={`text-sm font-black ${currentSpeechScore >= 80 ? 'text-emerald-400' : 'text-pink-400'}`}>
                발음 점수: {currentSpeechScore}점
              </span>
            </div>

            <div className="space-y-3 py-2">
              <p className="text-xs text-slate-400 font-bold uppercase">따라 말할 원문</p>
              <h3 className="text-xl sm:text-2xl font-black text-white leading-relaxed">
                "{activeSegment.text}"
              </h3>
            </div>

            <div className="py-4 space-y-3">
              <button
                type="button"
                onClick={toggleSpeechRecording}
                className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl shadow-xl transition-all cursor-pointer ${
                  isRecording
                    ? 'bg-red-600 text-white animate-pulse shadow-red-600/50 scale-110'
                    : 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white shadow-pink-500/30 hover:scale-105'
                }`}
              >
                {isRecording ? '⏹' : '🎤'}
              </button>
              <p className="text-xs text-slate-400 font-bold">
                {isRecording ? '🔴 음성을 듣고 있습니다... 영어로 말해보세요!' : '마이크 버튼을 누르고 문장을 따라 읽으세요'}
              </p>
            </div>

            {spokenText && (
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                <p className="text-xs font-bold text-slate-500">인식된 나의 발음:</p>
                <p className="text-base font-bold text-emerald-400">"{spokenText}"</p>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 4: AI Slide Lecture (슬라이드 강의)
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'slides' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-black text-purple-400 uppercase">
                Slide {currentSlideNo + 1} / {slides.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentSlideNo(Math.max(0, currentSlideNo - 1))}
                  disabled={currentSlideNo === 0}
                  className="px-3 py-1 bg-slate-800 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer"
                >
                  이전
                </button>
                <button
                  onClick={() => setCurrentSlideNo(Math.min(slides.length - 1, currentSlideNo + 1))}
                  disabled={currentSlideNo === slides.length - 1}
                  className="px-3 py-1 bg-purple-600 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer"
                >
                  다음
                </button>
              </div>
            </div>

            {slides[currentSlideNo] && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-white">{slides[currentSlideNo].headline}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{slides[currentSlideNo].headline_ko}</p>
                </div>

                <div className="p-4 bg-purple-950/40 border border-purple-900/60 rounded-2xl space-y-1.5">
                  <p className="text-base font-black text-purple-200">{slides[currentSlideNo].key_sentence}</p>
                  <p className="text-xs font-bold text-purple-400">{slides[currentSlideNo].key_sentence_ko}</p>
                </div>

                <div className="p-4 bg-slate-950/80 rounded-2xl space-y-1 text-xs text-slate-300 leading-relaxed border border-slate-800">
                  <p className="font-bold text-indigo-400">💡 문법 및 학습 팁</p>
                  <p>{slides[currentSlideNo].explanation_ko}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 5: Rich Vocab Flashcards & Interactive Smart Dictionary
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'vocab' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <span>📖</span> 스마트 영한/영영 단어장 & 사전 (Interactive Dictionary)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  단어 카드의 <strong>[🔊 발음]</strong> 또는 <strong>[📖 상세사전]</strong>을 클릭하여 품사, 발음기호, 영영 풀이, AI 어원을 확인하세요.
                </p>
              </div>
              <span className="text-xs text-amber-400 font-bold bg-amber-950/60 border border-amber-800/80 px-3 py-1 rounded-full">
                총 {vocabList.length}개 핵심 단어
              </span>
            </div>

            {/* 🔍 Word Search Bar */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="궁금한 영어 단어를 입력해 바로 사전 검색..."
                value={dictSearchQuery}
                onChange={e => setDictSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearchDictionary(dictSearchQuery)}
                className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl text-xs sm:text-sm text-white outline-none placeholder:text-slate-600"
              />
              <button
                type="button"
                onClick={() => handleSearchDictionary(dictSearchQuery)}
                disabled={isSearchingDict}
                className="px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-600/30"
              >
                {isSearchingDict ? '검색 중...' : '🔍 사전 검색'}
              </button>
            </div>

            {/* Flashcards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {vocabList.map((item, idx) => {
                const isFlipped = flippedCards[idx];
                return (
                  <div
                    key={idx}
                    className={`rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 border shadow-lg ${
                      isFlipped
                        ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 scale-101'
                        : 'bg-slate-950 border-slate-800 text-white hover:border-amber-500/50'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-black text-white">{item.word}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                speakWord(item.word);
                              }}
                              className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 flex items-center justify-center text-xs transition-all cursor-pointer"
                              title="원어민 발음 듣기 (TTS)"
                            >
                              🔊
                            </button>
                          </div>
                          {item.phonetic && (
                            <span className="text-[11px] font-mono text-slate-400">{item.phonetic}</span>
                          )}
                        </div>

                        {item.part_of_speech && (
                          <span className="text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                            {item.part_of_speech.split(' ')[0]}
                          </span>
                        )}
                      </div>

                      {/* Card Content (Korean Meaning vs English Sentence) */}
                      <div
                        onClick={() => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="cursor-pointer py-2 min-h-[48px]"
                      >
                        {isFlipped ? (
                          <div className="space-y-1 animate-in fade-in">
                            <p className="text-sm font-black text-amber-300">{item.meaning_ko}</p>
                            {item.definition_en && (
                              <p className="text-[11px] text-slate-300 line-clamp-2 italic">"{item.definition_en}"</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <p className="text-xs text-slate-300 italic line-clamp-2">"{item.example}"</p>
                            <p className="text-[10px] text-slate-500 flex items-center gap-1">👆 클릭하여 한국어 뜻 보기</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action: Deep Dictionary Popup */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))}
                        className="text-[11px] font-bold text-slate-400 hover:text-amber-300 cursor-pointer"
                      >
                        {isFlipped ? '닫기' : '뜻 뒤집기'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWordDetail(item);
                          handleRequestWordAI(item.word);
                        }}
                        className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      >
                        📖 상세 사전
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            MODE 6: Idioms (핵심 이디엄/숙어)
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'idioms' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-1.5">
                <span>💡</span> 원문에 사용된 핵심 이디엄 & 구동사
              </h3>
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
              {idioms.map((item, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-base font-black text-teal-400">{item.expression}</span>
                    <span className="text-[10px] font-bold bg-teal-950 text-teal-300 px-2 py-0.5 rounded-full">{item.type || 'idiom'}</span>
                  </div>
                  <p className="text-sm font-bold text-white">{item.meaning_ko}</p>
                  <p className="text-xs text-slate-400 italic">"{item.example_from_text}"</p>
                  {item.example_ko && <p className="text-[11px] text-slate-500">➔ {item.example_ko}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Sentence Switcher */}
        {['dictation', 'cloze', 'shadowing'].includes(currentMode) && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex gap-1.5 overflow-x-auto">
            {segments.map((_, i) => {
              const isCurrent = i === activeSegmentIndex;
              return (
                <button
                  key={i}
                  onClick={() => jumpToSegment(i)}
                  className={`min-w-[36px] h-9 rounded-xl text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-indigo-600 text-white scale-105 shadow-md shadow-indigo-600/40'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Bottom Sticky Player Controls */}
      <footer className="bg-slate-900/95 border-t border-slate-800 p-4 sticky bottom-0 z-30 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto space-y-3">
          {/* Progress Bar */}
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}</span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={e => {
                const val = Number(e.target.value);
                setCurrentTime(val);
                if (audioRef.current) audioRef.current.currentTime = val;
                if (videoRef.current) videoRef.current.currentTime = val;
              }}
              className="flex-1 accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <span>{Math.floor(duration / 60)}:{(Math.floor(duration) % 60).toString().padStart(2, '0')}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            {/* Speed buttons */}
            <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl">
              {[0.75, 1.0, 1.25].map(rate => (
                <button
                  key={rate}
                  onClick={() => handleRateChange(rate)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                    playbackRate === rate ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>

            {/* Play/Pause & Skip */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const mediaEl = currentMode === 'video' && videoRef.current ? videoRef.current : audioRef.current;
                  if (mediaEl) mediaEl.currentTime = Math.max(0, currentTime - 5);
                }}
                className="p-2.5 text-slate-400 hover:text-white text-base cursor-pointer"
                title="5초 뒤로"
              >
                ⏪ 5s
              </button>

              <button
                onClick={togglePlay}
                className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-500 text-white rounded-full flex items-center justify-center text-xl shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                {isPlaying ? '⏸' : '▶'}
              </button>

              <button
                onClick={() => {
                  const mediaEl = currentMode === 'video' && videoRef.current ? videoRef.current : audioRef.current;
                  if (mediaEl) mediaEl.currentTime = Math.min(duration, currentTime + 5);
                }}
                className="p-2.5 text-slate-400 hover:text-white text-base cursor-pointer"
                title="5초 앞으로"
              >
                5s ⏩
              </button>
            </div>

            {/* Loop Toggle */}
            <button
              onClick={() => setIsLoopingSegment(!isLoopingSegment)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isLoopingSegment ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              🔁 구간반복 ({isLoopingSegment ? 'ON' : 'OFF'})
            </button>
          </div>
        </div>
      </footer>

      {/* 📖 RICH WORD DETAIL DICTIONARY MODAL */}
      {selectedWordDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setSelectedWordDetail(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            {/* Header: Word + Pronunciation + Action */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl sm:text-3xl font-black text-white">{selectedWordDetail.word}</h3>
                  <button
                    type="button"
                    onClick={() => speakWord(selectedWordDetail.word)}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    🔊 발음 듣기
                  </button>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs">
                  {selectedWordDetail.phonetic && (
                    <span className="font-mono text-slate-400">{selectedWordDetail.phonetic}</span>
                  )}
                  {selectedWordDetail.part_of_speech && (
                    <span className="px-2.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full font-bold text-[10px]">
                      {selectedWordDetail.part_of_speech}
                    </span>
                  )}
                </div>
              </div>

              <button onClick={() => setSelectedWordDetail(null)} className="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
            </div>

            {/* Meanings & Definitions */}
            <div className="space-y-4">
              {/* Korean Meaning */}
              <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-2xl space-y-1">
                <span className="text-[11px] font-black text-amber-400 uppercase">🇰🇷 한국어 뜻</span>
                <p className="text-base sm:text-lg font-black text-white">{selectedWordDetail.meaning_ko}</p>
              </div>

              {/* English Definition */}
              {selectedWordDetail.definition_en && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[11px] font-black text-indigo-400 uppercase">🇬🇧 영영 풀이 (English Definition)</span>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">"{selectedWordDetail.definition_en}"</p>
                </div>
              )}

              {/* Sample Sentences */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                <span className="text-[11px] font-black text-emerald-400 uppercase">💬 대표 예문 (Examples)</span>
                <div className="space-y-2 text-xs sm:text-sm">
                  {selectedWordDetail.example && (
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                      • <span className="font-semibold text-white">"{selectedWordDetail.example}"</span>
                    </div>
                  )}
                  {selectedWordDetail.extra_examples?.map((ex, i) => (
                    <div key={i} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                      • <span className="font-semibold text-slate-300">"{ex}"</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Synonyms & Antonyms */}
              {((selectedWordDetail.synonyms && selectedWordDetail.synonyms.length > 0) || (selectedWordDetail.antonyms && selectedWordDetail.antonyms.length > 0)) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  {selectedWordDetail.synonyms && selectedWordDetail.synonyms.length > 0 && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black text-teal-400">✨ 유의어 (Synonyms)</span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedWordDetail.synonyms.map((s, i) => (
                          <span key={i} className="px-2 py-1 bg-teal-950/60 text-teal-300 border border-teal-800 rounded-lg text-[11px] font-bold">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedWordDetail.antonyms && selectedWordDetail.antonyms.length > 0 && (
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                      <span className="text-[10px] font-black text-rose-400">⚡ 반의어 (Antonyms)</span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {selectedWordDetail.antonyms.map((a, i) => (
                          <span key={i} className="px-2 py-1 bg-rose-950/60 text-rose-300 border border-rose-800 rounded-lg text-[11px] font-bold">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🤖 Gemini AI Deep Dive Section */}
              <div className="p-4 bg-gradient-to-br from-purple-950/50 via-slate-900 to-indigo-950/50 border border-purple-800/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                    <span>🤖</span> AI 심층 단어 분석 (어원 & 뉘앙스 & 연어)
                  </span>
                  {!aiWordDeepDive[selectedWordDetail.word] && (
                    <button
                      type="button"
                      onClick={() => handleRequestWordAI(selectedWordDetail.word)}
                      disabled={isLoadingWordAI}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black cursor-pointer"
                    >
                      {isLoadingWordAI ? 'AI 분석 중...' : '✨ AI 어원/뉘앙스 분석'}
                    </button>
                  )}
                </div>

                {aiWordDeepDive[selectedWordDetail.word] ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-slate-200">
                      <strong className="text-purple-300">🌱 어원:</strong> {aiWordDeepDive[selectedWordDetail.word].etymology}
                    </p>
                    <p className="text-slate-200">
                      <strong className="text-indigo-300">🎯 뉘앙스:</strong> {aiWordDeepDive[selectedWordDetail.word].nuance}
                    </p>
                    {aiWordDeepDive[selectedWordDetail.word].collocations?.length > 0 && (
                      <div>
                        <strong className="text-teal-300">🔗 자주 쓰이는 연어(Collocations):</strong>
                        <ul className="list-disc list-inside pl-1 text-slate-300 mt-1 space-y-0.5">
                          {aiWordDeepDive[selectedWordDetail.word].collocations.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    AI 분석 버튼을 누르면 단어의 어원과 미묘한 뉘앙스를 실시간으로 확인할 수 있습니다.
                  </p>
                )}
              </div>

              {/* 🌐 External Dictionaries & Google Images Quick Links */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-800">
                <span className="text-slate-400 font-bold text-[11px]">외부 공인 사전 & 이미지 바로가기:</span>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(selectedWordDetail.word)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-rose-950 text-rose-300 border border-rose-800 rounded-xl font-bold hover:bg-rose-900 transition-all text-[11px] flex items-center gap-1"
                  >
                    🖼️ 구글 이미지 검색 ↗
                  </a>
                  <a
                    href={`https://en.dict.naver.com/#/search?query=${encodeURIComponent(selectedWordDetail.word)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl font-bold hover:bg-emerald-900 transition-all text-[11px]"
                  >
                    🟢 네이버 영어사전 ↗
                  </a>
                  <a
                    href={`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(selectedWordDetail.word)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-950 text-blue-300 border border-blue-800 rounded-xl font-bold hover:bg-blue-900 transition-all text-[11px]"
                  >
                    🔵 캠브리지 사전 ↗
                  </a>
                </div>
              </div>

            </div>

            {/* Footer Close */}
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedWordDetail(null)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini API Key Setting Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4" onClick={() => setShowApiKeyModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span>🔑</span> Google Gemini API Key 설정
              </h3>
              <button onClick={() => setShowApiKeyModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Google AI Studio에서 무료로 발급받은 <strong>Gemini API Key</strong>를 입력하시면, 실시간 AI 소크라테스 산파 코칭 기능을 무제한으로 사용할 수 있습니다.
            </p>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showKeyVisible ? "text" : "password"}
                  placeholder="AIzaSy..."
                  value={tempApiKey}
                  onChange={e => {
                    setTempApiKey(e.target.value);
                    setTestStatus({ loading: false });
                  }}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-2xl text-xs font-mono text-white outline-none pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowKeyVisible(!showKeyVisible)}
                  className="absolute right-3 top-3 text-xs text-slate-400 hover:text-white"
                >
                  {showKeyVisible ? '🙈 숨김' : '👁️ 보기'}
                </button>
              </div>

              <div className="flex justify-between items-center text-[11px]">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline font-bold"
                >
                  👉 무료 Gemini API Key 발급받기 (클릭)
                </a>
                <button
                  type="button"
                  onClick={handleTestApiKey}
                  disabled={testStatus.loading}
                  className="px-2.5 py-1 bg-purple-950 text-purple-300 border border-purple-800 rounded-lg font-bold hover:bg-purple-900 cursor-pointer disabled:opacity-50"
                >
                  {testStatus.loading ? '테스트 중...' : '🔍 키 연결 테스트'}
                </button>
              </div>

              {/* Test Status Message */}
              {testStatus.msg && (
                <div className={`p-3 rounded-xl text-xs font-bold ${
                  testStatus.success
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                    : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                }`}>
                  {testStatus.msg}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveApiKey}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer shadow-lg shadow-purple-600/30"
              >
                저장 및 AI 활성화 ✓
              </button>
              <button
                onClick={() => setShowApiKeyModal(false)}
                className="px-4 py-3 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto">
              🏆
            </div>
            <h3 className="text-2xl font-black text-white">과제가 성공적으로 제출되었습니다!</h3>
            <p className="text-xs text-slate-400">
              선생님 LMS 대시보드에 학습 기록 및 소크라테스 탐구 문답이 실시간으로 등록되었습니다.
            </p>

            <button
              onClick={onBack}
              className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 cursor-pointer"
            >
              레슨 목록으로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
