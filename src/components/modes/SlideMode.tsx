import React, { useState } from 'react';
import { SlideItem } from '../../types';

interface SlideModeProps {
  slides?: SlideItem[];
}

export const SlideMode: React.FC<SlideModeProps> = ({ slides = [] }) => {
  const [currentSlideNo, setCurrentSlideNo] = useState<number>(0);
  const slideList = slides.length > 0 ? slides : [
    {
      slide_no: 1,
      timestamp_start: 0,
      headline: '핵심 슬라이드 강의',
      headline_ko: '레슨 핵심 강의',
      key_sentence: 'Listen carefully to the native speaker.',
      key_sentence_ko: '원어민의 억양과 발음에 집중해서 들어보세요.',
      explanation_ko: '핵심 단어의 강세와 연음 규칙에 유의하여 학습합니다.',
      vocabulary: ['focus', 'pronunciation']
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <span className="text-xs font-black text-purple-400 uppercase">
          Slide {currentSlideNo + 1} / {slideList.length}
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
            onClick={() => setCurrentSlideNo(Math.min(slideList.length - 1, currentSlideNo + 1))}
            disabled={currentSlideNo === slideList.length - 1}
            className="px-3 py-1 bg-purple-600 rounded-lg text-xs font-bold disabled:opacity-30 cursor-pointer"
          >
            다음
          </button>
        </div>
      </div>

      {slideList[currentSlideNo] && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xl font-black text-white">{slideList[currentSlideNo].headline}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{slideList[currentSlideNo].headline_ko}</p>
          </div>

          <div className="p-4 bg-purple-950/40 border border-purple-900/60 rounded-2xl space-y-1.5">
            <p className="text-base font-black text-purple-200">{slideList[currentSlideNo].key_sentence}</p>
            <p className="text-xs font-bold text-purple-400">{slideList[currentSlideNo].key_sentence_ko}</p>
          </div>

          <div className="p-4 bg-slate-950/80 rounded-2xl space-y-1 text-xs text-slate-300 leading-relaxed border border-slate-800">
            <p className="font-bold text-indigo-400">💡 문법 및 학습 팁</p>
            <p>{slideList[currentSlideNo].explanation_ko}</p>
          </div>
        </div>
      )}
    </div>
  );
};
