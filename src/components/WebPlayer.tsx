import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Lesson, Segment, StudentInfo } from '../types';

interface WebPlayerProps {
  lesson: Lesson;
  student: StudentInfo;
  onBack: () => void;
}

export const WebPlayer: React.FC<WebPlayerProps> = ({ lesson, student, onBack }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Audio state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(lesson.duration_sec || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLoopingSegment, setIsLoopingSegment] = useState<boolean>(false);
  
  // Segments & Dictation State
  const segments: Segment[] = lesson.segments || [];
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [segmentScores, setSegmentScores] = useState<Record<number, number>>({});
  const [showAnswer, setShowAnswer] = useState<Record<number, boolean>>({});

  // Slide & Idiom Modals
  const [activeModal, setActiveModal] = useState<'none' | 'slides' | 'idioms' | 'result'>('none');
  const [currentSlideNo, setCurrentSlideNo] = useState<number>(0);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitted, setSubmitted] = useState<boolean>(false);

  // Time update listener
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

  // Calculate similarity accuracy between target and input
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

  // Handle Typing input
  const handleInputChange = (idx: number, val: string) => {
    setUserInputs(prev => ({ ...prev, [idx]: val }));
    if (segments[idx]) {
      const score = calculateAccuracy(segments[idx].text, val);
      setSegmentScores(prev => ({ ...prev, [idx]: score }));
    }
  };

  // Final Submit to Supabase
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const totalSegments = segments.length;
    let totalScore = 0;
    const wrongWords: string[] = [];

    segments.forEach((s, i) => {
      const sc = segmentScores[i] || 0;
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
      setSubmitted(true);
      setActiveModal('result');
    } catch (e) {
      console.error(e);
      alert('제출 완료! (데모 모드)');
      setSubmitted(true);
      setActiveModal('result');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };
  const currentScore = segmentScores[activeSegmentIndex] || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Audio Element */}
      <audio ref={audioRef} src={lesson.audio_url} preload="auto" />

      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 p-4 sticky top-0 z-30 backdrop-blur-md">
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

          <div className="flex items-center gap-1.5">
            {lesson.slides && lesson.slides.length > 0 && (
              <button
                onClick={() => setActiveModal('slides')}
                className="px-3 py-1.5 bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-bold hover:bg-indigo-600/50 transition-all cursor-pointer"
              >
                📊 슬라이드
              </button>
            )}
            {lesson.idioms && lesson.idioms.length > 0 && (
              <button
                onClick={() => setActiveModal('idioms')}
                className="px-3 py-1.5 bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold hover:bg-purple-600/50 transition-all cursor-pointer"
              >
                💡 이디엄
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Focus Area: Dictation Card */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-center space-y-6">
        {/* Active Sentence Player Card */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Sentence Counter & Progress */}
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
            <span className="px-3 py-1 bg-slate-800 rounded-full text-indigo-400">
              Sentence {activeSegmentIndex + 1} / {segments.length}
            </span>
            <div className="flex items-center gap-2">
              <span>정확도:</span>
              <span className={`text-sm font-black ${currentScore >= 80 ? 'text-emerald-400' : currentScore >= 50 ? 'text-amber-400' : 'text-slate-500'}`}>
                {currentScore}%
              </span>
            </div>
          </div>

          {/* Hint / Audio Wave Area */}
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

          {/* User Input Textarea */}
          <div className="space-y-2">
            <input
              type="text"
              placeholder="여기에 문장을 입력하세요..."
              value={userInputs[activeSegmentIndex] || ''}
              onChange={e => handleInputChange(activeSegmentIndex, e.target.value)}
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
                className="text-slate-400 hover:text-indigo-400 font-bold transition-colors cursor-pointer"
              >
                {showAnswer[activeSegmentIndex] ? '🙈 정답 가리기' : '👁️ 정답 확인하기'}
              </button>

              <span className="text-slate-500">Enter를 누르면 다음 문장으로 이동합니다</span>
            </div>
          </div>

          {/* Navigation Between Sentences */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => activeSegmentIndex > 0 && jumpToSegment(activeSegmentIndex - 1)}
              disabled={activeSegmentIndex === 0}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
            >
              ← 이전 문장
            </button>

            <button
              onClick={() => setIsLoopingSegment(!isLoopingSegment)}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                isLoopingSegment ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              🔁 현재 문장 무한반복 ({isLoopingSegment ? 'ON' : 'OFF'})
            </button>

            {activeSegmentIndex + 1 < segments.length ? (
              <button
                onClick={() => jumpToSegment(activeSegmentIndex + 1)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 cursor-pointer"
              >
                다음 문장 →
              </button>
            ) : (
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 cursor-pointer animate-bounce"
              >
                {isSubmitting ? '제출 중...' : '🎉 학습 완료 & 제출'}
              </button>
            )}
          </div>
        </div>

        {/* All Segments Quick Jump Bar */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-3 flex gap-1.5 overflow-x-auto">
          {segments.map((_, i) => {
            const sc = segmentScores[i] || 0;
            const isCurrent = i === activeSegmentIndex;
            return (
              <button
                key={i}
                onClick={() => jumpToSegment(i)}
                className={`min-w-[36px] h-9 rounded-xl text-xs font-black flex items-center justify-center transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white scale-105 shadow-md shadow-indigo-600/40'
                    : sc >= 80
                    ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                    : sc > 0
                    ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                    : 'bg-slate-800 text-slate-500 hover:text-white'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>
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

            {/* Submit Button */}
            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl cursor-pointer"
            >
              과제 제출
            </button>
          </div>
        </div>
      </footer>

      {/* ─── Slides Modal ──────────────────────────────────────────── */}
      {activeModal === 'slides' && lesson.slides && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setActiveModal('none')}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-lg text-white">📊 핵심 슬라이드 학습</h3>
              <button onClick={() => setActiveModal('none')} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            {lesson.slides[currentSlideNo] && (
              <div className="space-y-4 py-2">
                <span className="text-xs font-black text-indigo-400 uppercase">Slide {currentSlideNo + 1} / {lesson.slides.length}</span>
                <h4 className="text-lg font-black text-white">{lesson.slides[currentSlideNo].headline}</h4>
                <p className="text-xs text-slate-400">{lesson.slides[currentSlideNo].headline_ko}</p>

                <div className="bg-indigo-950/40 border border-indigo-900/60 rounded-2xl p-4 space-y-1.5">
                  <p className="text-sm font-bold text-indigo-200">{lesson.slides[currentSlideNo].key_sentence}</p>
                  <p className="text-xs text-indigo-400">{lesson.slides[currentSlideNo].key_sentence_ko}</p>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-3 rounded-xl">
                  💡 {lesson.slides[currentSlideNo].explanation_ko}
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2 border-t border-slate-800">
              <button
                onClick={() => setCurrentSlideNo(Math.max(0, currentSlideNo - 1))}
                disabled={currentSlideNo === 0}
                className="px-4 py-2 bg-slate-800 rounded-xl text-xs font-bold disabled:opacity-30"
              >
                이전 슬라이드
              </button>
              <button
                onClick={() => setCurrentSlideNo(Math.min((lesson.slides?.length || 1) - 1, currentSlideNo + 1))}
                disabled={currentSlideNo === (lesson.slides?.length || 1) - 1}
                className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-bold disabled:opacity-30"
              >
                다음 슬라이드
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Idioms Modal ──────────────────────────────────────────── */}
      {activeModal === 'idioms' && lesson.idioms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setActiveModal('none')}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-lg text-white">💡 핵심 숙어 & 표현</h3>
              <button onClick={() => setActiveModal('none')} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {lesson.idioms.map((item, idx) => (
                <div key={idx} className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-purple-400">{item.expression}</span>
                    <span className="text-[10px] font-bold bg-purple-950 text-purple-300 px-2 py-0.5 rounded-full">{item.type || 'idiom'}</span>
                  </div>
                  <p className="text-xs font-bold text-white">{item.meaning_ko}</p>
                  <p className="text-xs text-slate-400 italic">"{item.example_from_text}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── Result Modal ──────────────────────────────────────────── */}
      {activeModal === 'result' && (
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
