import React, { useState } from 'react';
import { DetailedWordInfo } from '../../types';
import { SpeechService } from '../../services/speechService';
import { DictionaryService } from '../../services/dictionaryService';

interface VocabModeProps {
  keyVocabulary?: DetailedWordInfo[];
  onSelectWordDetail: (detail: DetailedWordInfo) => void;
}

export const VocabMode: React.FC<VocabModeProps> = ({
  keyVocabulary,
  onSelectWordDetail
}) => {
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [dictSearchQuery, setDictSearchQuery] = useState<string>('');
  const [isSearchingDict, setIsSearchingDict] = useState<boolean>(false);

  const vocabList: DetailedWordInfo[] = (keyVocabulary || [
    { word: 'smart', meaning_ko: '현명한, 똑똑한', example: 'Smart shopping saves money.' },
    { word: 'jacket', meaning_ko: '재킷, 상의', example: 'Can you check the price of this jacket?' },
    { word: 'check', meaning_ko: '확인하다', example: 'Always check the price before you buy.' },
    { word: 'price', meaning_ko: '가격, 물가', example: 'I did not see the price here.' }
  ]).map(v => ({
    ...v,
    ...(DictionaryService.defaultVocabDetails[v.word.toLowerCase()] || {})
  }));

  const handleSearch = async () => {
    if (!dictSearchQuery.trim()) return;
    setIsSearchingDict(true);
    const detail = await DictionaryService.searchWord(dictSearchQuery);
    onSelectWordDetail(detail);
    setIsSearchingDict(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
            <span>📖</span> 스마트 영한/영영 단어장 & 사전 (Interactive Dictionary)
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            단어 카드의 <strong>[🔊 발음]</strong> 또는 <strong>[📖 상세사전]</strong>을 클릭하여 품사, 발음기호, 영영 풀이, AI 어원을 확인하세요.
          </p>
        </div>
        <span className="text-xs text-amber-400 font-bold bg-amber-950/60 border border-amber-800/80 px-3 py-1 rounded-full">
          총 {vocabList.length}개 핵심 단어
        </span>
      </div>

      {/* 🔍 Word Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="궁금한 영어 단어를 입력해 바로 사전 검색..."
          value={dictSearchQuery}
          onChange={e => setDictSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          className="flex-1 px-4 py-3 bg-slate-950 border border-slate-700 focus:border-amber-500 rounded-2xl text-xs sm:text-sm text-white outline-none placeholder:text-slate-600"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearchingDict}
          className="px-5 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-2xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-600/30"
        >
          {isSearchingDict ? '검색 중...' : '🔍 사전 검색'}
        </button>
      </div>

      {/* Flashcards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {vocabList.map((item, idx) => {
          const isFlipped = flippedCards[idx];
          return (
            <div
              key={idx}
              className={`rounded-3xl p-5 flex flex-col justify-between transition-all duration-300 border shadow-lg ${
                isFlipped
                  ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 scale-101'
                  : 'bg-slate-950 border-slate-800 text-white hover:border-amber-500/50'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white">{item.word}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          SpeechService.speakWord(item.word);
                        }}
                        className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 flex items-center justify-center text-xs transition-all cursor-pointer"
                        title="원어민 발음 듣기 (TTS)"
                      >
                        🔊
                      </button>
                    </div>
                    {item.phonetic && (
                      <span className="text-[11px] font-mono text-slate-400">{item.phonetic}</span>
                    )}
                  </div>

                  {item.part_of_speech && (
                    <span className="text-[10px] font-bold bg-slate-900 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                      {item.part_of_speech.split(' ')[0]}
                    </span>
                  )}
                </div>

                {/* Card Content */}
                <div
                  onClick={() => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  className="cursor-pointer py-2 min-h-[48px]"
                >
                  {isFlipped ? (
                    <div className="space-y-1 animate-in fade-in">
                      <p className="text-sm font-black text-amber-300">{item.meaning_ko}</p>
                      {item.definition_en && (
                        <p className="text-[11px] text-slate-300 line-clamp-2 italic">"{item.definition_en}"</p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-300 italic line-clamp-2">"{item.example}"</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">👆 클릭하여 한국어 뜻 보기</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action: Deep Dictionary Popup */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setFlippedCards(prev => ({ ...prev, [idx]: !prev[idx] }))}
                  className="text-[11px] font-bold text-slate-400 hover:text-amber-300 cursor-pointer"
                >
                  {isFlipped ? '닫기' : '뜻 뒤집기'}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectWordDetail(item)}
                  className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  📖 상세 사전
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
