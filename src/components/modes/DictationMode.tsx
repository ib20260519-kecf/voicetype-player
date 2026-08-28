import React, { useState } from 'react';
import { BaseStudyModeProps } from '../../types';
import { SpeechService } from '../../services/speechService';

interface DictationModeProps extends BaseStudyModeProps {
  userInputs: Record<number, string>;
  setUserInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  segmentScores: Record<number, number>;
  setSegmentScores: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}

export const DictationMode: React.FC<DictationModeProps> = ({
  segments,
  activeSegmentIndex,
  onJumpToSegment,
  userInputs,
  setUserInputs,
  segmentScores,
  setSegmentScores
}) => {
  const [showAnswer, setShowAnswer] = useState<Record<number, boolean>>({});
  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };
  const currentScore = segmentScores[activeSegmentIndex] || 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
        <span className="px-3 py-1 bg-slate-800 rounded-full text-indigo-400">
          Sentence {activeSegmentIndex + 1} / {segments.length}
        </span>
        <div className="flex items-center gap-2">
          <span>정확도:</span>
          <span className={`text-sm font-black ${currentScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
            {currentScore}%
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
            const sc = SpeechService.calculateAccuracy(activeSegment.text, val);
            setSegmentScores(prev => ({ ...prev, [activeSegmentIndex]: sc }));
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && activeSegmentIndex + 1 < segments.length) {
              onJumpToSegment(activeSegmentIndex + 1);
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
  );
};
