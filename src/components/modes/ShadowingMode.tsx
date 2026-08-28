import React, { useState, useEffect, useRef } from 'react';
import { BaseStudyModeProps } from '../../types';
import { SpeechService } from '../../services/speechService';

interface ShadowingModeProps extends BaseStudyModeProps {
  speechScores: Record<number, number>;
  setSpeechScores: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}

export const ShadowingMode: React.FC<ShadowingModeProps> = ({
  segments,
  activeSegmentIndex,
  speechScores,
  setSpeechScores
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [spokenText, setSpokenText] = useState<string>('');
  const recognitionRef = useRef<any>(null);

  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };
  const currentScore = speechScores[activeSegmentIndex] || 0;

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
          const score = SpeechService.calculateAccuracy(segments[activeSegmentIndex].text, text);
          setSpeechScores(prev => ({ ...prev, [activeSegmentIndex]: score }));
        }
      };

      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, [activeSegmentIndex, segments, setSpeechScores]);

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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center">
      <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
        <span className="px-3 py-1 bg-slate-800 rounded-full text-pink-400">
          🎙️ 발음 채점 모드 ({activeSegmentIndex + 1}/{segments.length})
        </span>
        <span className={`text-sm font-black ${currentScore >= 80 ? 'text-emerald-400' : 'text-pink-400'}`}>
          발음 점수: {currentScore}점
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
  );
};
