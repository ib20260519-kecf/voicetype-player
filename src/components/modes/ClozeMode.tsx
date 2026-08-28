import React from 'react';
import { BaseStudyModeProps } from '../../types';
import { SpeechService } from '../../services/speechService';

interface ClozeModeProps extends BaseStudyModeProps {
  clozeInputs: Record<number, string>;
  setClozeInputs: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  clozeScores: Record<number, number>;
  setClozeScores: React.Dispatch<React.SetStateAction<Record<number, number>>>;
}

export const ClozeMode: React.FC<ClozeModeProps> = ({
  segments,
  activeSegmentIndex,
  clozeInputs,
  setClozeInputs,
  clozeScores,
  setClozeScores
}) => {
  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };
  const currentScore = clozeScores[activeSegmentIndex] || 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
        <span className="px-3 py-1 bg-slate-800 rounded-full text-blue-400">
          🧩 빈칸 채우기 ({activeSegmentIndex + 1}/{segments.length})
        </span>
        <span className="text-sm font-black text-blue-400">
          정확도: {currentScore}%
        </span>
      </div>

      <div className="bg-slate-950/80 border border-slate-800 p-6 rounded-2xl text-center space-y-3">
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">힌트 문장 (빈칸을 채우세요)</p>
        <p className="text-lg sm:text-2xl font-mono font-black text-indigo-300 leading-relaxed">
          {SpeechService.getClozeSentence(activeSegment.text)}
        </p>
      </div>

      <input
        type="text"
        placeholder="전체 문장을 완성하여 입력하세요..."
        value={clozeInputs[activeSegmentIndex] || ''}
        onChange={e => {
          const val = e.target.value;
          setClozeInputs(prev => ({ ...prev, [activeSegmentIndex]: val }));
          const sc = SpeechService.calculateAccuracy(activeSegment.text, val);
          setClozeScores(prev => ({ ...prev, [activeSegmentIndex]: sc }));
        }}
        className="w-full bg-slate-950 border-2 border-slate-700 focus:border-blue-500 rounded-2xl px-5 py-4 text-base text-white font-semibold outline-none"
      />
    </div>
  );
};
