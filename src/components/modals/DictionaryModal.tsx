import React, { useState } from 'react';
import { DetailedWordInfo } from '../../types';
import { SpeechService } from '../../services/speechService';
import { GeminiService } from '../../services/geminiService';

interface DictionaryModalProps {
  wordDetail: DetailedWordInfo;
  onClose: () => void;
}

export const DictionaryModal: React.FC<DictionaryModalProps> = ({ wordDetail, onClose }) => {
  const [aiDeepDive, setAiDeepDive] = useState<{ etymology: string; nuance: string; collocations: string[] } | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState<boolean>(false);

  const handleRequestAI = async () => {
    setIsLoadingAI(true);
    const result = await GeminiService.generateWordDeepDive(wordDetail.word);
    setAiDeepDive(result);
    setIsLoadingAI(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header: Word + Pronunciation + Action */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl sm:text-3xl font-black text-white">{wordDetail.word}</h3>
              <button
                type="button"
                onClick={() => SpeechService.speakWord(wordDetail.word)}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
              >
                🔊 발음 듣기
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs">
              {wordDetail.phonetic && (
                <span className="font-mono text-slate-400">{wordDetail.phonetic}</span>
              )}
              {wordDetail.part_of_speech && (
                <span className="px-2.5 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded-full font-bold text-[10px]">
                  {wordDetail.part_of_speech}
                </span>
              )}
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl cursor-pointer">✕</button>
        </div>

        {/* Meanings & Definitions */}
        <div className="space-y-4">
          {/* Korean Meaning */}
          <div className="p-4 bg-amber-950/30 border border-amber-800/50 rounded-2xl space-y-1">
            <span className="text-[11px] font-black text-amber-400 uppercase">🇰🇷 한국어 뜻</span>
            <p className="text-base sm:text-lg font-black text-white">{wordDetail.meaning_ko}</p>
          </div>

          {/* English Definition */}
          {wordDetail.definition_en && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
              <span className="text-[11px] font-black text-indigo-400 uppercase">🇬🇧 영영 풀이 (English Definition)</span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">"{wordDetail.definition_en}"</p>
            </div>
          )}

          {/* Sample Sentences */}
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
            <span className="text-[11px] font-black text-emerald-400 uppercase">💬 대표 예문 (Examples)</span>
            <div className="space-y-2 text-xs sm:text-sm">
              {wordDetail.example && (
                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                  • <span className="font-semibold text-white">"{wordDetail.example}"</span>
                </div>
              )}
              {wordDetail.extra_examples?.map((ex, i) => (
                <div key={i} className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 text-slate-200">
                  • <span className="font-semibold text-slate-300">"{ex}"</span>
                </div>
              ))}
            </div>
          </div>

          {/* Synonyms & Antonyms */}
          {((wordDetail.synonyms && wordDetail.synonyms.length > 0) || (wordDetail.antonyms && wordDetail.antonyms.length > 0)) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {wordDetail.synonyms && wordDetail.synonyms.length > 0 && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-teal-400">✨ 유의어 (Synonyms)</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {wordDetail.synonyms.map((s, i) => (
                      <span key={i} className="px-2 py-1 bg-teal-950/60 text-teal-300 border border-teal-800 rounded-lg text-[11px] font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {wordDetail.antonyms && wordDetail.antonyms.length > 0 && (
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-1">
                  <span className="text-[10px] font-black text-rose-400">⚡ 반의어 (Antonyms)</span>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {wordDetail.antonyms.map((a, i) => (
                      <span key={i} className="px-2 py-1 bg-rose-950/60 text-rose-300 border border-rose-800 rounded-lg text-[11px] font-bold">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 🤖 Gemini AI Deep Dive Section */}
          <div className="p-4 bg-gradient-to-br from-purple-950/50 via-slate-900 to-indigo-950/50 border border-purple-800/60 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                <span>🤖</span> AI 심층 단어 분석 (어원 & 뉘앙스 & 연어)
              </span>
              {!aiDeepDive && (
                <button
                  type="button"
                  onClick={handleRequestAI}
                  disabled={isLoadingAI}
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-black cursor-pointer"
                >
                  {isLoadingAI ? 'AI 분석 중...' : '✨ AI 어원/뉘앙스 분석'}
                </button>
              )}
            </div>

            {aiDeepDive ? (
              <div className="space-y-2 text-xs">
                <p className="text-slate-200">
                  <strong className="text-purple-300">🌱 어원:</strong> {aiDeepDive.etymology}
                </p>
                <p className="text-slate-200">
                  <strong className="text-indigo-300">🎯 뉘앙스:</strong> {aiDeepDive.nuance}
                </p>
                {aiDeepDive.collocations?.length > 0 && (
                  <div>
                    <strong className="text-teal-300">🔗 자주 쓰이는 연어(Collocations):</strong>
                    <ul className="list-disc list-inside pl-1 text-slate-300 mt-1 space-y-0.5">
                      {aiDeepDive.collocations.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">
                AI 분석 버튼을 누르면 단어의 어원과 미묘한 뉘앙스를 실시간으로 확인할 수 있습니다.
              </p>
            )}
          </div>

          {/* 🌐 External Dictionaries & Google Images Quick Links */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-800">
            <span className="text-slate-400 font-bold text-[11px]">외부 공인 사전 & 이미지 바로가기:</span>
            <div className="flex flex-wrap gap-2">
              <a
                href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(wordDetail.word)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-rose-950 text-rose-300 border border-rose-800 rounded-xl font-bold hover:bg-rose-900 transition-all text-[11px] flex items-center gap-1"
              >
                🖼️ 구글 이미지 검색 ↗
              </a>
              <a
                href={`https://en.dict.naver.com/#/search?query=${encodeURIComponent(wordDetail.word)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-xl font-bold hover:bg-emerald-900 transition-all text-[11px]"
              >
                🟢 네이버 영어사전 ↗
              </a>
              <a
                href={`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(wordDetail.word)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-blue-950 text-blue-300 border border-blue-800 rounded-xl font-bold hover:bg-blue-900 transition-all text-[11px]"
              >
                🔵 캠브리지 사전 ↗
              </a>
            </div>
          </div>
        </div>

        {/* Footer Close */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black cursor-pointer"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
