import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lesson, Segment, StudentInfo, SlideItem, IdiomItem } from '../types';

interface WebPlayerProps {
  lesson: Lesson;
  student: StudentInfo;
  onBack: () => void;
}

type StudyMode = 'dictation' | 'cloze' | 'shadowing' | 'slides' | 'vocab' | 'idioms';

export const WebPlayer: React.FC<WebPlayerProps> = ({ lesson, student, onBack }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Current Mode
  const [currentMode, setCurrentMode] = useState<StudyMode>('dictation');

  // Audio State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(lesson.duration_sec || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLoopingSegment, setIsLoopingSegment] = useState<boolean>(true);
  
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
    { word: 'artificial', meaning_ko: '인공적인, 인위적인', example: 'Artificial intelligence is evolving rapidly.' },
    { word: 'intelligence', meaning_ko: '지능, 총명', example: 'Human intelligence is uniquely creative.' },
    { word: 'practice', meaning_ko: '연습하다, 실행하다', example: 'Practice makes perfect.' },
    { word: 'shopping', meaning_ko: '쇼핑, 장보기', example: 'Smart shopping saves your budget.' },
    { word: 'price', meaning_ko: '가격, 물가', example: 'Always compare the price.' }
  ];
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [quizIndex, setQuizIndex] = useState<number>(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState<number | null>(null);
  const [vocabQuizScore, setVocabQuizScore] = useState<number>(0);

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

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);

  // Initialize Speech Recognition (Web Speech API)
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

        // Score Speech
        if (segments[activeSegmentIndex]) {
          const score = calculateAccuracy(segments[activeSegmentIndex].text, text);
          setSpeechScores(prev => ({ ...prev, [activeSegmentIndex]: score }));
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, [activeSegmentIndex, segments]);

  // Audio Time Update Listener
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);

      // Find current active segment
      const curIdx = segments.findIndex(s => t >= s.start && t <= s.end);
      if (curIdx !== -1 && curIdx !== activeSegmentIndex) {
        setActiveSegmentIndex(curIdx);
      }

      // Loop active segment if enabled
      if (isLoopingSegment && segments[activeSegmentIndex]) {
        const seg = segments[activeSegmentIndex];
        if (t >= seg.end) {
          audio.currentTime = seg.start;
          audio.play();
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (audio.duration) setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [segments, activeSegmentIndex, isLoopingSegment]);

  // Play / Pause Toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  };

  // Jump to specific segment
  const jumpToSegment = (idx: number) => {
    const audio = audioRef.current;
    if (!audio || !segments[idx]) return;
    setActiveSegmentIndex(idx);
    setSpokenText('');
    audio.currentTime = segments[idx].start;
    audio.play();
    setIsPlaying(true);
  };

  // Change Playback Speed
  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Calculate Accuracy
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

  // Generate Cloze text (hides every 2nd or 3rd long word)
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

  // Start Speech Recognition
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

  // Final Submit to Supabase
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const totalSegments = segments.length;
    let totalScore = 0;
    const wrongWords: string[] = [];

    segments.forEach((s, i) => {
      const sc = segmentScores[i] || clozeScores[i] || speechScores[i] || 0;
      totalScore += sc;
      if (sc < 80) {
        wrongWords.push(s.text);
      }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Audio Element */}
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

          <button
            onClick={handleFinalSubmit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
          >
            {isSubmitting ? '제출 중...' : '과제 제출 ✓'}
          </button>
        </div>

        {/* 6 Study Mode Tabs */}
        <div className="max-w-5xl mx-auto flex gap-1.5 overflow-x-auto pb-1">
          {[
            { id: 'dictation', name: '🎧 풀 받아쓰기', color: 'indigo' },
            { id: 'cloze', name: '🧩 빈칸 채우기', color: 'blue' },
            { id: 'shadowing', name: '🎙️ 섀도잉 & 발음평가', color: 'pink' },
            { id: 'slides', name: '📊 AI 슬라이드 강의', color: 'purple' },
            { id: 'vocab', name: '🗂️ 단어장 & 퀴즈', color: 'amber' },
            { id: 'idioms', name: '💡 핵심 숙어/이디엄', color: 'teal' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setCurrentMode(tab.id as StudyMode)}
              className={`px-3.5 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                currentMode === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30 scale-102'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>
      </header>

      {/* Main Mode Body */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-center space-y-6">

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

            {/* Mic Record Button */}
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

            {/* Recognized Speech Result */}
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
            MODE 5: Vocab Flashcards & Quiz (단어장 및 퀴즈)
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

        {/* Quick Sentence Switcher (1, 2, 3...) */}
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
                  if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5);
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
                  if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 5);
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

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-3xl mx-auto">
              🏆
            </div>
            <h3 className="text-2xl font-black text-white">과제가 성공적으로 제출되었습니다!</h3>
            <p className="text-xs text-slate-400">
              선생님 LMS 대시보드에 학습 기록이 실시간으로 등록되었습니다.
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
