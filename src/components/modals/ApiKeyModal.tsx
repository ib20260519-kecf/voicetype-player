import React, { useState } from 'react';
import { GeminiService } from '../../services/geminiService';
import { StorageService } from '../../services/storageService';

interface ApiKeyModalProps {
  onClose: () => void;
  onKeySaved: (newKey: string) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose, onKeySaved }) => {
  const [tempApiKey, setTempApiKey] = useState<string>(StorageService.getStoredApiKey());
  const [showKeyVisible, setShowKeyVisible] = useState<boolean>(true);
  const [testStatus, setTestStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });

  const handleTestApiKey = async () => {
    setTestStatus({ loading: true, msg: 'Google AI Studio 서버와 통신 확인 중...' });
    const res = await GeminiService.testApiKey(tempApiKey);
    setTestStatus({ loading: false, success: res.success, msg: res.msg });
  };

  const handleSaveApiKey = () => {
    const key = tempApiKey.trim();
    if (!key) {
      alert('API Key를 입력해 주세요.');
      return;
    }
    StorageService.setStoredApiKey(key);
    onKeySaved(key);
    onClose();
    alert('✨ Gemini API Key가 성공적으로 등록되었습니다!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <span>🔑</span> Google Gemini API Key 설정
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Google AI Studio에서 무료로 발급받은 <strong>Gemini API Key</strong>를 입력하시면, 실시간 AI 소크라테스 산파 코칭 기능을 무제한으로 사용할 수 있습니다.
        </p>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={showKeyVisible ? "text" : "password"}
              placeholder="AIzaSy..."
              value={tempApiKey}
              onChange={e => {
                setTempApiKey(e.target.value);
                setTestStatus({ loading: false });
              }}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-700 focus:border-purple-500 rounded-2xl text-xs font-mono text-white outline-none pr-12"
            />
            <button
              type="button"
              onClick={() => setShowKeyVisible(!showKeyVisible)}
              className="absolute right-3 top-3 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              {showKeyVisible ? '🙈 숨김' : '👁️ 보기'}
            </button>
          </div>

          <div className="flex justify-between items-center text-[11px]">
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:underline font-bold"
            >
              👉 무료 Gemini API Key 발급받기 (클릭)
            </a>
            <button
              type="button"
              onClick={handleTestApiKey}
              disabled={testStatus.loading}
              className="px-2.5 py-1 bg-purple-950 text-purple-300 border border-purple-800 rounded-lg font-bold hover:bg-purple-900 cursor-pointer disabled:opacity-50"
            >
              {testStatus.loading ? '테스트 중...' : '🔍 키 연결 테스트'}
            </button>
          </div>

          {testStatus.msg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${
              testStatus.success
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                : 'bg-rose-950/80 text-rose-300 border border-rose-800'
            }`}>
              {testStatus.msg}
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSaveApiKey}
            className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer shadow-lg shadow-purple-600/30"
          >
            저장 및 AI 활성화 ✓
          </button>
          <button
            onClick={onClose}
            className="px-4 py-3 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
