import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lesson, Segment, StudentInfo, SlideItem, IdiomItem, IBQuestion } from '../types';

interface WebPlayerProps {
  lesson: Lesson;
  student: StudentInfo;
  onBack: () => void;
}

type StudyMode = 'video' | 'dictation' | 'cloze' | 'shadowing' | 'slides' | 'vocab' | 'idioms' | 'ib_inquiry';

interface AIFeedbackResult {
  rubric: string;
  strengths_ko: string;
  feedback_ko: string;
  polished_en: string;
  advanced_model_en: string;
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

  // 4. Vocab Flashcard & Quiz State
  const vocabList = lesson.key_vocabulary || [
    { word: 'smart', meaning_ko: '현명한, 똑똑한', example: 'Smart shopping saves money.' },
    { word: 'jacket', meaning_ko: '재킷, 상의', example: 'Can you check the price of this jacket?' },
    { word: 'check', meaning_ko: '확인하다', example: 'Always check the price before you buy.' },
    { word: 'price', meaning_ko: '가격, 물가', example: 'I did not see the price here.' }
  ];
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});

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

  // 6. IB Inquiry Questions & Gemini AI State
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
  const [aiFeedbacks, setAiFeedbacks] = useState<Record<number, AIFeedbackResult>>({});
  const [isGeneratingAI, setIsGeneratingAI] = useState<Record<number, boolean>>({});

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

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

  // Gemini AI Feedback Request
  const handleRequestAIFeedback = async (qIdx: number) => {
    const studentAnswer = (ibAnswers[qIdx] || '').trim();
    if (!studentAnswer) {
      alert('먼저 질문에 대한 당신의 생각/답변을 작성해 주세요!');
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
You are an inspiring, expert IB English & Critical Thinking Inquiry Coach.
Analyze the following student's response to an IB inquiry question based on the learning material.

[Lesson Title]: "${lesson.title}"
[Question Type]: IB ${question.type.toUpperCase()} Question
[English Question]: "${question.question_en}"
[Korean Question]: "${question.question_ko}"
[Student Answer]: "${studentAnswer}"

Please analyze and provide feedback in JSON format ONLY:
{
  "rubric": "IB Criterion evaluation grade (e.g., 'Criterion A: Excellent (Level 7/8)' or 'Criterion B: Good (Level 5/6)')",
  "strengths_ko": "학생의 논리와 생각에서 칭찬할 점 (친절하고 격려하는 한국어 1~2문장)",
  "feedback_ko": "더 깊은 IB 탐구를 위해 보완할 점과 심층 조언 (한국어 2문장)",
  "polished_en": "원어민 수준으로 자연스럽고 명확하게 교정된 세련된 영어 문장",
  "advanced_model_en": "학생의 생각을 한 단계 더 심화시킨 고득점 IB 모범 에세이 답변 (영어 2~3문장)"
}
`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
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

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error?.message || `HTTP ${response.status} 오류`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed: AIFeedbackResult = JSON.parse(rawText);

      setAiFeedbacks(prev => ({ ...prev, [qIdx]: parsed }));
    } catch (err: any) {
      alert('Gemini AI 분석 중 오류: ' + (err.message || err));
      if (err.message?.includes('API_KEY')) {
        setShowApiKeyModal(true);
      }
    } finally {
      setIsGeneratingAI(prev => ({ ...prev, [qIdx]: false }));
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
    alert('✨ Gemini API Key가 안전하게 저장되었습니다!');
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
          ib_answers: ibAnswers,
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
            { id: 'ib_inquiry', name: '🧠 IB 심층 탐구 질문' },
            { id: 'dictation', name: '🎧 풀 받아쓰기' },
            { id: 'cloze', name: '🧩 빈칸 채우기' },
            { id: 'shadowing', name: '🎙️ 섀도잉 & 발음평가' },
            { id: 'slides', name: '📊 AI 슬라이드 강의' },
            { id: 'vocab', name: '🗂️ 단어장 & 퀴즈' },
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
            MODE: IB Inquiry Questions & Live Gemini AI Feedback
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'ib_inquiry' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>🧠</span> IB Inquiry & Gemini AI 첨삭관
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  생각을 영어로 작성하고 <strong>[✨ Gemini AI 첨삭]</strong>을 누르면 실시간 IB 루브릭 평가와 세련된 영어 교정을 즉시 제공합니다.
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
                  <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
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
                        placeholder="이 질문에 대한 당신의 생각과 답변을 영어(또는 한국어)로 서술하세요..."
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
                          className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {isLoadingAI ? '🤖 Gemini AI가 심층 분석 중...' : '✨ Gemini AI 실시간 첨삭 & 피드백 받기'}
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

                      {/* Default Sample Answer Box */}
                      {showSampleAnswer[idx] && q.sample_answer_en && (
                        <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1 animate-in fade-in">
                          <p className="font-bold text-slate-400">📖 교사 기본 예시 답안 (Reference):</p>
                          <p className="italic">"{q.sample_answer_en}"</p>
                        </div>
                      )}

                      {/* 🌟 GEMINI AI LIVE FEEDBACK CARD */}
                      {feedback && (
                        <div className="bg-gradient-to-br from-purple-950/60 via-slate-900 to-indigo-950/60 border-2 border-purple-500/50 rounded-2xl p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
                          <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
                            <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                              <span>✨</span> Gemini AI 실시간 첨삭 리포트
                            </span>
                            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-200 border border-purple-500/40 rounded-full text-[11px] font-black">
                              {feedback.rubric}
                            </span>
                          </div>

                          {/* Strengths & Feedback */}
                          <div className="space-y-2 text-xs">
                            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                              <p className="font-black text-emerald-400">👏 훌륭한 점 (Strengths):</p>
                              <p className="text-slate-200">{feedback.strengths_ko}</p>
                            </div>

                            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                              <p className="font-black text-indigo-400">💡 심층 탐구 조언 (Inquiry Feedback):</p>
                              <p className="text-slate-200">{feedback.feedback_ko}</p>
                            </div>
                          </div>

                          {/* Polished English */}
                          <div className="p-3.5 bg-purple-950/40 border border-purple-800/80 rounded-xl space-y-1">
                            <p className="text-[11px] font-black text-purple-300">✍️ 원어민 표현 교정 (Polished Expression):</p>
                            <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                              "{feedback.polished_en}"
                            </p>
                          </div>

                          {/* Advanced Model Essay */}
                          <div className="p-3.5 bg-indigo-950/40 border border-indigo-800/80 rounded-xl space-y-1">
                            <p className="text-[11px] font-black text-indigo-300">🏆 발전된 심층 모범 서술 (Advanced Model Answer):</p>
                            <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed italic">
                              "{feedback.advanced_model_en}"
                            </p>
                          </div>
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
            MODE 5: Vocab Flashcards & Quiz (단어장)
        ────────────────────────────────────────────────────────────── */}
        {currentMode === 'vocab' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <span>🗂️</span> 필수 어휘 플래시카드 (클릭하면 뜻이 뒤집힙니다)
              </h3>
              <span className="text-xs text-amber-400 font-bold">{vocabList.length}개 단어</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {vocabList.map((item, idx) => {
                const isFlipped = flippedCards[idx];
                return (
                  <div
                    key={idx}
                    onClick={() => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))}
                    className={`h-36 rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-300 border ${
                      isFlipped
                        ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 scale-102'
                        : 'bg-slate-950 border-slate-800 text-white hover:border-indigo-500/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-base font-black">{item.word}</span>
                      <span className="text-[10px] text-slate-500">{isFlipped ? '뜻 닫기' : '뜻 보기'}</span>
                    </div>

                    {isFlipped ? (
                      <p className="text-sm font-bold text-amber-400 animate-in fade-in">{item.meaning_ko}</p>
                    ) : (
                      <p className="text-xs text-slate-400 italic line-clamp-2">"{item.example}"</p>
                    )}
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
              Google AI Studio에서 무료로 발급받은 <strong>Gemini API Key</strong>를 입력하시면, 실시간 AI 첨삭 및 IB 평가 기능을 무제한으로 사용할 수 있습니다.
            </p>

            <div className="space-y-2">
              <input
                type="password"
                placeholder="AIzaSy..."
                value={tempApiKey}
                onChange={e => setTempApiKey(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-2xl text-xs font-mono text-white outline-none"
              />
              <div className="flex justify-between items-center text-[11px]">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:underline font-bold"
                >
                  👉 무료 Gemini API Key 발급받기 (클릭)
                </a>
                <span className="text-slate-500">브라우저 로컬 저장</span>
              </div>
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
              선생님 LMS 대시보드에 학습 기록 및 작성하신 IB 탐구 답변이 실시간으로 등록되었습니다.
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
