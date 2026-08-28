import React from 'react';
import { IdiomItem } from '../../types';

interface IdiomModeProps {
  idioms?: IdiomItem[];
}

export const IdiomMode: React.FC<IdiomModeProps> = ({ idioms = [] }) => {
  const idiomList = idioms.length > 0 ? idioms : [
    {
      expression: 'save money',
      meaning_ko: '돈을 절약하다',
      example_from_text: 'Smart shopping saves money.',
      example_ko: '현명한 쇼핑은 돈을 아껴줍니다.',
      type: 'idiom'
    }
  ];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h3 className="text-base font-black text-white flex items-center gap-1.5">
          <span>💡</span> 원문에 사용된 핵심 이디엄 & 구동사
        </h3>
      </div>

      <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
        {idiomList.map((item, idx) => (
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
  );
};
