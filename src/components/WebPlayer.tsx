import React, { useState, useEffect, useRef } from 'react';
import { Lesson, Segment, StudentInfo, StudyMode, DetailedWordInfo } from '../types';
import { StorageService } from '../services/storageService';

// Mode Components (SRP / OCP / LSP)
import { VideoMode } from './modes/VideoMode';
import { IBInquiryMode } from './modes/IBInquiryMode';
import { DictationMode } from './modes/DictationMode';
import { ClozeMode } from './modes/ClozeMode';
import { ShadowingMode } from './modes/ShadowingMode';
import { SlideMode } from './modes/SlideMode';
import { VocabMode } from './modes/VocabMode';
import { IdiomMode } from './modes/IdiomMode';

// Modals
import { ApiKeyModal } from './modals/ApiKeyModal';
import { DictionaryModal } from './modals/DictionaryModal';
import { ResultModal } from './modals/ResultModal';

interface WebPlayerProps {
  lesson: Lesson;
  student: StudentInfo;
  onBack: () => void;
}

export const WebPlayer: React.FC<WebPlayerProps> = ({ lesson, student, onBack }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 1. Core State
  const [currentMode, setCurrentMode] = useState<StudyMode>('video');
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(lesson.duration_sec || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isLoopingSegment, setIsLoopingSegment] = useState<boolean>(false);

  // 2. Segments
  const segments: Segment[] = lesson.segments || [];
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(0);

  // 3. Mode-specific States
  const [userInputs, setUserInputs] = useState<Record<number, string>>({});
  const [segmentScores, setSegmentScores] = useState<Record<number, number>>({});
  const [clozeInputs, setClozeInputs] = useState<Record<number, string>>({});
  const [clozeScores, setClozeScores] = useState<Record<number, number>>({});
  const [speechScores, setSpeechScores] = useState<Record<number, number>>({});
  const [ibAnswers, setIbAnswers] = useState<Record<number, string>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});

  // 4. Modal States
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [selectedWordDetail, setSelectedWordDetail] = useState<DetailedWordInfo | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [geminiApiKey, setGeminiApiKey] = useState<string>(StorageService.getStoredApiKey());

  // Media Time Update Sync
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
    mediaEl.currentTime = segments[idx].start;
    mediaEl.play();
    setIsPlaying(true);
  };

  const handleRateChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) audioRef.current.playbackRate = rate;
    if (videoRef.current) videoRef.current.playbackRate = rate;
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
    const combinedIBRecords: Record<string, any> = { ...ibAnswers };
    Object.entries(followUpAnswers).forEach(([k, v]) => {
      combinedIBRecords[`followup_${k}`] = v;
    });

    await StorageService.submitLearningRecord(
      student,
      lesson,
      averageAccuracy,
      Math.round(currentTime),
      wrongWords,
      combinedIBRecords
    );

    setIsSubmitting(false);
    setShowResultModal(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Background Audio Source */}
      <audio ref={audioRef} src={lesson.audio_url} preload="auto" />

      {/* Header Bar */}
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

      {/* Main Study Body (Strategy Pattern Rendering) */}
      <main className="max-w-4xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col justify-center space-y-6">
        {currentMode === 'video' && (
          <VideoMode
            lesson={lesson}
            segments={segments}
            activeSegmentIndex={activeSegmentIndex}
            onJumpToSegment={jumpToSegment}
            videoRef={videoRef}
            setIsPlaying={setIsPlaying}
          />
        )}

        {currentMode === 'ib_inquiry' && (
          <IBInquiryMode
            lessonTitle={lesson.title}
            ibQuestions={lesson.ib_questions || []}
            ibAnswers={ibAnswers}
            setIbAnswers={setIbAnswers}
            followUpAnswers={followUpAnswers}
            setFollowUpAnswers={setFollowUpAnswers}
            onOpenApiKeyModal={() => setShowApiKeyModal(true)}
            geminiApiKey={geminiApiKey}
          />
        )}

        {currentMode === 'dictation' && (
          <DictationMode
            lesson={lesson}
            segments={segments}
            activeSegmentIndex={activeSegmentIndex}
            onJumpToSegment={jumpToSegment}
            userInputs={userInputs}
            setUserInputs={setUserInputs}
            segmentScores={segmentScores}
            setSegmentScores={setSegmentScores}
          />
        )}

        {currentMode === 'cloze' && (
          <ClozeMode
            lesson={lesson}
            segments={segments}
            activeSegmentIndex={activeSegmentIndex}
            onJumpToSegment={jumpToSegment}
            clozeInputs={clozeInputs}
            setClozeInputs={setClozeInputs}
            clozeScores={clozeScores}
            setClozeScores={setClozeScores}
          />
        )}

        {currentMode === 'shadowing' && (
          <ShadowingMode
            lesson={lesson}
            segments={segments}
            activeSegmentIndex={activeSegmentIndex}
            onJumpToSegment={jumpToSegment}
            speechScores={speechScores}
            setSpeechScores={setSpeechScores}
          />
        )}

        {currentMode === 'slides' && (
          <SlideMode slides={lesson.slides} />
        )}

        {currentMode === 'vocab' && (
          <VocabMode
            keyVocabulary={lesson.key_vocabulary}
            onSelectWordDetail={setSelectedWordDetail}
          />
        )}

        {currentMode === 'idioms' && (
          <IdiomMode idioms={lesson.idioms} />
        )}

        {/* Quick Sentence Switcher for Dictation / Cloze / Shadowing */}
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

      {/* Modals */}
      {selectedWordDetail && (
        <DictionaryModal
          wordDetail={selectedWordDetail}
          onClose={() => setSelectedWordDetail(null)}
        />
      )}

      {showApiKeyModal && (
        <ApiKeyModal
          onClose={() => setShowApiKeyModal(false)}
          onKeySaved={setGeminiApiKey}
        />
      )}

      {showResultModal && (
        <ResultModal onBack={onBack} />
      )}
    </div>
  );
};
