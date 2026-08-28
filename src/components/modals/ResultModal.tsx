import React from 'react';

interface ResultModalProps {
  onBack: () => void;
}

export const ResultModal: React.FC<ResultModalProps> = ({ onBack }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 w-full max-w-md text-center space-y-5 shadow-2xl animate-in zoom-in-95">
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
  );
};
