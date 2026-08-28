import React, { useState } from 'react';
import { IBQuestion, AIFeedbackResult } from '../../types';
import { GeminiService } from '../../services/geminiService';

interface IBInquiryModeProps {
  lessonTitle: string;
  ibQuestions: IBQuestion[];
  ibAnswers: Record<number, string>;
  setIbAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  followUpAnswers: Record<string, string>;
  setFollowUpAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onOpenApiKeyModal: () => void;
  geminiApiKey: string;
}

export const IBInquiryMode: React.FC<IBInquiryModeProps> = ({
  lessonTitle,
  ibQuestions,
  ibAnswers,
  setIbAnswers,
  followUpAnswers,
  setFollowUpAnswers,
  onOpenApiKeyModal,
  geminiApiKey
}) => {
  const [aiFeedbacks, setAiFeedbacks] = useState<Record<number, AIFeedbackResult>>({});
  const [isGeneratingAI, setIsGeneratingAI] = useState<Record<number, boolean>>({});
  const [showSampleAnswer, setShowSampleAnswer] = useState<Record<number, boolean>>({});

  const handleRequestAIFeedback = async (qIdx: number) => {
    const studentAnswer = (ibAnswers[qIdx] || '').trim();
    if (!studentAnswer) {
      alert('먼저 질문에 대한 당신의 생각/답변을 작성해 주세요! (콩글리시나 단문이어도 괜찮습니다)');
      return;
    }

    const question = ibQuestions[qIdx];
    setIsGeneratingAI(prev => ({ ...prev, [qIdx]: true }));

    try {
      const feedback = await GeminiService.generateSocraticFeedback(lessonTitle, question, studentAnswer);
      setAiFeedbacks(prev => ({ ...prev, [qIdx]: feedback }));
    } catch {
      alert('AI 코칭 생성 중 문제가 발생했습니다.');
    } finally {
      setIsGeneratingAI(prev => ({ ...prev, [qIdx]: false }));
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <span>🧠</span> IB 심층 탐구 & 소크라테스 3단계 생각 산파관
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            서툰 영어(콩글리시)나 단문이어도 괜찮습니다! 생각을 작성하고 <strong>[✨ AI 코칭]</strong>을 받으면 소크라테스 산파법 3단계 꼬리물기 질문이 펼쳐집니다.
          </p>
        </div>
        <button
          onClick={onOpenApiKeyModal}
          className="text-xs text-purple-400 hover:text-purple-300 font-bold underline cursor-pointer"
        >
          {geminiApiKey ? '✨ AI 연동 상태: 정상' : '🔑 Gemini Key 입력하기'}
        </button>
      </div>

      <div className="space-y-8">
        {ibQuestions.map((q, idx) => {
          const typeBadge = {
            factual: { label: '📌 1단계: Factual (사실적 질문)', color: 'bg-blue-950 text-blue-300 border-blue-800' },
            conceptual: { label: '💡 2단계: Conceptual (개념적 질문)', color: 'bg-purple-950 text-purple-300 border-purple-800' },
            debatable: { label: '⚖️ 3단계: Debatable (심층 토론 질문)', color: 'bg-pink-950 text-pink-300 border-pink-800' }
          }[q.type];

          const feedback = aiFeedbacks[idx];
          const isLoadingAI = isGeneratingAI[idx];

          return (
            <div key={idx} className="bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1 rounded-xl text-xs font-black border ${typeBadge.color}`}>
                  {typeBadge.label}
                </span>
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-black text-white leading-relaxed">
                  {idx + 1}. {q.question_en}
                </h4>
                <p className="text-xs text-slate-400">
                  👉 {q.question_ko}
                </p>
                {q.inquiry_prompt && (
                  <p className="text-[11px] text-indigo-400 font-semibold pt-1">
                    💡 탐구 가이드: {q.inquiry_prompt}
                  </p>
                )}
              </div>

              {/* Student Essay / Answer Input */}
              <div className="space-y-3">
                <textarea
                  rows={3}
                  placeholder="이 질문에 대한 당신의 생각과 답변을 작성하세요... (콩글리시나 한글이 섞여도 AI가 완벽하게 다듬어줍니다!)"
                  value={ibAnswers[idx] || ''}
                  onChange={e => setIbAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-2xl p-4 text-xs sm:text-sm text-white font-medium outline-none leading-relaxed placeholder:text-slate-600 transition-colors"
                />

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleRequestAIFeedback(idx)}
                    disabled={isLoadingAI}
                    className="px-5 py-3 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {isLoadingAI ? '🤖 소크라테스 AI가 사고를 분석 중...' : '✨ Gemini AI 코칭 & 3단계 산파 질문 받기'}
                  </button>

                  {q.sample_answer_en && (
                    <button
                      type="button"
                      onClick={() => setShowSampleAnswer(prev => ({ ...prev, [idx]: !prev[idx] }))}
                      className="text-xs text-slate-400 hover:text-purple-300 font-bold cursor-pointer"
                    >
                      {showSampleAnswer[idx] ? '🙈 기본 가이드 가리기' : '📖 교사 기본 예시 답안'}
                    </button>
                  )}
                </div>

                {/* Default Reference Answer */}
                {showSampleAnswer[idx] && q.sample_answer_en && (
                  <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-300 space-y-1 animate-in fade-in">
                    <p className="font-bold text-slate-400">📖 교사 기본 예시 답안 (Reference):</p>
                    <p className="italic">"{q.sample_answer_en}"</p>
                  </div>
                )}

                {/* 🌟 SOCRATIC & FEYNMAN & SCAMPER AI FEEDBACK REPORT */}
                {feedback && (
                  <div className="bg-gradient-to-br from-purple-950/70 via-slate-900 to-indigo-950/70 border-2 border-purple-500/50 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
                    {/* Top Header Rubric */}
                    <div className="flex items-center justify-between border-b border-purple-800/60 pb-3">
                      <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                        <span>✨</span> Gemini AI 탐구 코칭 & 표현 다듬기
                      </span>
                      <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-200 border border-purple-500/40 rounded-full text-[11px] font-black">
                        {feedback.rubric}
                      </span>
                    </div>

                    {/* Warm Encouragement & Strengths */}
                    <div className="space-y-2 text-xs">
                      <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                        <p className="font-black text-emerald-400 flex items-center gap-1">
                          <span>👏</span> 칭찬할 만한 핵심 생각:
                        </p>
                        <p className="text-slate-200">{feedback.strengths_ko}</p>
                      </div>

                      {feedback.konglish_warm_tip_ko && (
                        <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                          <p className="font-black text-amber-400 flex items-center gap-1">
                            <span>💡</span> 콩글리시 ➔ 세련된 영어 팁:
                          </p>
                          <p className="text-slate-200">{feedback.konglish_warm_tip_ko}</p>
                        </div>
                      )}
                    </div>

                    {/* Polished Expression */}
                    <div className="p-4 bg-purple-950/50 border border-purple-800/80 rounded-2xl space-y-1.5">
                      <p className="text-[11px] font-black text-purple-300">✍️ 원어민 표현으로 다듬은 문장 (Polished English):</p>
                      <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                        "{feedback.polished_en}"
                      </p>
                    </div>

                    {/* Advanced Model Essay */}
                    <div className="p-4 bg-indigo-950/50 border border-indigo-800/80 rounded-2xl space-y-1.5">
                      <p className="text-[11px] font-black text-indigo-300">🏆 심층 확장 모범 에세이 (Advanced Model Answer):</p>
                      <p className="text-xs sm:text-sm font-medium text-slate-200 leading-relaxed italic">
                        "{feedback.advanced_model_en}"
                      </p>
                    </div>

                    {/* 🏛️ 3-STAGE FOLLOW-UP INQUIRY (Socratic, Feynman, SCAMPER) */}
                    {feedback.socratic_followups && feedback.socratic_followups.length > 0 && (
                      <div className="space-y-4 pt-3 border-t border-purple-800/50">
                        <div className="flex items-center justify-between">
                          <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                            <span>🏛️</span> 소크라테스 3단계 꼬리물기 탐구 질문 (사고 확장)
                          </h5>
                          <span className="text-[10px] text-purple-300 font-bold">생각을 더 깊게 밀어붙여 보세요</span>
                        </div>

                        <div className="space-y-4">
                          {feedback.socratic_followups.map((fStep, sIdx) => {
                            const stepKey = `${idx}_${sIdx}`;
                            return (
                              <div key={sIdx} className="p-4 bg-slate-950/90 border border-purple-900/60 rounded-2xl space-y-2.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-purple-300">
                                    {fStep.title}
                                  </span>
                                </div>

                                <p className="text-xs sm:text-sm font-bold text-white">
                                  "{fStep.question_en}"
                                </p>
                                <p className="text-xs text-slate-400">
                                  👉 {fStep.question_ko}
                                </p>
                                <p className="text-[11px] text-indigo-400 font-medium">
                                  💭 탐구 힌트: {fStep.prompt_ko}
                                </p>

                                {/* Student Follow-up Answer */}
                                <textarea
                                  rows={2}
                                  placeholder="이 후속 질문에 대한 생각을 적어보세요..."
                                  value={followUpAnswers[stepKey] || ''}
                                  onChange={e => setFollowUpAnswers(prev => ({ ...prev, [stepKey]: e.target.value }))}
                                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 rounded-xl p-3 text-xs text-white outline-none"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
