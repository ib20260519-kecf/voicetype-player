import React, { useState, useEffect } from 'react';
import { IBQuestion, AIFeedbackResult } from '../../types';
import { GeminiService } from '../../services/geminiService';

interface IBInquiryModeProps {
  lessonTitle: string;
  lessonOverview?: {
    summary_ko?: string;
    core_message_ko?: string;
    key_takeaways?: string[];
  };
  scriptText?: string;
  ibQuestions: IBQuestion[];
  ibAnswers: Record<number, string>;
  setIbAnswers: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  followUpAnswers: Record<string, string>;
  setFollowUpAnswers: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onOpenApiKeyModal: () => void;
  geminiApiKey: string;
}

interface ChatMessage {
  sender: 'user' | 'assistant';
  text: string;
  polished_en?: string;
  followup_ko?: string;
  followup_en?: string;
  time: string;
}

export const IBInquiryMode: React.FC<IBInquiryModeProps> = ({
  lessonTitle,
  lessonOverview,
  scriptText = '',
  ibQuestions,
  ibAnswers,
  setIbAnswers,
  followUpAnswers,
  setFollowUpAnswers,
  onOpenApiKeyModal,
  geminiApiKey
}) => {
  // Overview state
  const [overview, setOverview] = useState<{
    summary_ko?: string;
    core_message_ko?: string;
    key_takeaways?: string[];
    discussion_points?: string[];
  } | null>(lessonOverview?.summary_ko ? lessonOverview : null);
  const [isLoadingOverview, setIsLoadingOverview] = useState<boolean>(false);

  // Active Questions State (fallbacks or loaded)
  const [activeQuestions, setActiveQuestions] = useState<IBQuestion[]>(ibQuestions || []);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState<boolean>(false);

  // Feedback states
  const [aiFeedbacks, setAiFeedbacks] = useState<Record<number, AIFeedbackResult>>({});
  const [isGeneratingAI, setIsGeneratingAI] = useState<Record<number, boolean>>({});
  const [showSampleAnswer, setShowSampleAnswer] = useState<Record<number, boolean>>({});

  // 💬 Socratic Tiki-Taka Interactive Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userChatInput, setUserChatInput] = useState<string>('');
  const [isSendingChat, setIsSendingChat] = useState<boolean>(false);

  // Auto-generate overview & questions if not present on mount
  useEffect(() => {
    if (!overview && scriptText) {
      handleGenerateOverview();
    }
    if (activeQuestions.length === 0 && scriptText) {
      handleGenerateQuestions();
    }
  }, [scriptText]);

  const handleGenerateOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const res = await GeminiService.generateLessonOverview(lessonTitle, scriptText);
      setOverview(res);
    } catch {}
    setIsLoadingOverview(false);
  };

  const handleGenerateQuestions = async () => {
    setIsLoadingQuestions(true);
    try {
      const res = await GeminiService.generateIBQuestions(lessonTitle, scriptText);
      setActiveQuestions(res);
    } catch {}
    setIsLoadingQuestions(false);
  };

  const handleRequestAIFeedback = async (qIdx: number) => {
    const studentAnswer = (ibAnswers[qIdx] || '').trim();
    if (!studentAnswer) {
      alert('먼저 질문에 대한 당신의 생각/답변을 작성해 주세요! (콩글리시나 단문이어도 좋습니다)');
      return;
    }

    const question = activeQuestions[qIdx];
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

  // 💬 Send message in Socratic Tiki-Taka Chat Room
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = userChatInput.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setUserChatInput('');
    setIsSendingChat(true);

    try {
      const history = chatMessages.map(m => ({ sender: m.sender, text: m.text }));
      const result = await GeminiService.chatSocraticTikiTaka(lessonTitle, history, text);

      const aiMsg: ChatMessage = {
        sender: 'assistant',
        text: result.reply_ko,
        polished_en: result.polished_en,
        followup_ko: result.followup_question_ko,
        followup_en: result.followup_question_en,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages(prev => [...prev, aiMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        sender: 'assistant',
        text: '네, 아주 흥미로운 생각입니다! 그렇다면 만약 이 상황을 완전히 반대로 뒤집는다면 어떤 일이 일어날까요?',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-xl font-black text-white flex items-center gap-2">
            <span>🧠</span> IB 심층 탐구 & 소크라테스 3단계 산파관
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            영상 전체 맥락을 파악하고, <strong>AI와 실시간 티키타카 문답</strong>을 주고받으며 비판적 사고력을 확장합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenApiKeyModal}
            className="px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900 text-purple-300 border border-purple-800/80 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <span>🔑</span>
            <span>{geminiApiKey ? 'Gemini AI 연동됨' : 'Gemini Key 등록'}</span>
          </button>
        </div>
      </div>

      {/* 🌟 1. 전체 내용 핵심 브리핑 (Lesson Overview & Storyline) */}
      <div className="bg-gradient-to-br from-indigo-950/70 via-slate-900 to-purple-950/70 border border-indigo-500/30 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-black">
              🌟 전체 내용 핵심 브리핑
            </span>
            <span className="text-xs font-bold text-slate-300 truncate max-w-xs sm:max-w-md">
              {lessonTitle}
            </span>
          </div>

          <button
            type="button"
            onClick={handleGenerateOverview}
            disabled={isLoadingOverview}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
          >
            <span>🔄</span>
            <span>{isLoadingOverview ? 'AI 분석 중...' : '브리핑 새로고침'}</span>
          </button>
        </div>

        {overview ? (
          <div className="space-y-3 animate-in fade-in">
            <div className="p-4 bg-slate-950/80 border border-slate-800/80 rounded-2xl space-y-2">
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
                {overview.summary_ko}
              </p>
              {overview.core_message_ko && (
                <div className="pt-2 border-t border-slate-800/60 flex items-start gap-2">
                  <span className="text-xs font-black text-amber-400 flex-shrink-0">🎯 핵심 메시지:</span>
                  <span className="text-xs text-amber-200/90 font-semibold">{overview.core_message_ko}</span>
                </div>
              )}
            </div>

            {overview.key_takeaways && overview.key_takeaways.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {overview.key_takeaways.map((point, idx) => (
                  <div key={idx} className="p-3 bg-slate-900/90 border border-indigo-900/40 rounded-xl text-xs text-slate-300 space-y-1">
                    <span className="font-mono text-[10px] font-black text-indigo-400">Point {idx + 1}</span>
                    <p className="leading-snug">{point}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/50 rounded-2xl border border-dashed border-slate-800 space-y-3">
            <p className="text-xs text-slate-400">영상 대본을 기반으로 전체 맥락과 핵심 요약을 브리핑합니다.</p>
            <button
              type="button"
              onClick={handleGenerateOverview}
              disabled={isLoadingOverview}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all"
            >
              {isLoadingOverview ? '🤖 Gemini AI가 전체 대본 분석 중...' : '⚡ 전체 내용 요약 & 브리핑 생성하기'}
            </button>
          </div>
        )}
      </div>

      {/* 🌟 2. AI 3단계 IB 심층 탐구 질문 (Factual ➔ Conceptual ➔ Debatable) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h4 className="text-base font-black text-white flex items-center gap-2">
            <span>🏛️</span> 3단계 단계별 IB 질문 & 탐구 에세이
          </h4>
          {activeQuestions.length === 0 && (
            <button
              type="button"
              onClick={handleGenerateQuestions}
              disabled={isLoadingQuestions}
              className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              {isLoadingQuestions ? '생성 중...' : '✨ IB 질문 생성하기'}
            </button>
          )}
        </div>

        {activeQuestions.length === 0 ? (
          <div className="p-8 text-center bg-slate-950 border border-dashed border-slate-800 rounded-3xl space-y-3">
            <span className="text-3xl">💡</span>
            <h5 className="text-sm font-bold text-white">등록된 IB 탐구 질문이 없습니다.</h5>
            <p className="text-xs text-slate-400">AI가 영상 대본을 분석하여 3단계(사실 ➔ 개념 ➔ 토론) 탐구 질문을 즉시 구성합니다.</p>
            <button
              type="button"
              onClick={handleGenerateQuestions}
              disabled={isLoadingQuestions}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 cursor-pointer"
            >
              {isLoadingQuestions ? '🤖 3단계 IB 질문 구성 중...' : '✨ AI로 3단계 IB 질문 자동 생성하기'}
            </button>
          </div>
        ) : (
          activeQuestions.map((q, idx) => {
            const typeBadge = {
              factual: { label: '📌 1단계: Factual (사실적 질문)', color: 'bg-blue-950 text-blue-300 border-blue-800' },
              conceptual: { label: '💡 2단계: Conceptual (개념적 질문)', color: 'bg-purple-950 text-purple-300 border-purple-800' },
              debatable: { label: '⚖️ 3단계: Debatable (심층 토론 질문)', color: 'bg-pink-950 text-pink-300 border-pink-800' }
            }[q.type] || { label: '💡 IB 심층 질문', color: 'bg-indigo-950 text-indigo-300 border-indigo-800' };

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

                      {/* 1. 따뜻한 칭찬 & 콩글리시 코칭 */}
                      <div className="space-y-2.5">
                        <div className="p-3.5 bg-emerald-950/50 border border-emerald-800/60 rounded-xl text-xs space-y-1">
                          <span className="font-black text-emerald-400 flex items-center gap-1">
                            <span>🌱</span> 학생의 생각에서 가장 칭찬할 점:
                          </span>
                          <p className="text-emerald-100 font-medium">{feedback.strengths_ko}</p>
                        </div>

                        {feedback.konglish_warm_tip_ko && (
                          <div className="p-3.5 bg-amber-950/50 border border-amber-800/60 rounded-xl text-xs space-y-1">
                            <span className="font-black text-amber-400 flex items-center gap-1">
                              <span>💡</span> 자연스러운 표현 코칭 팁:
                            </span>
                            <p className="text-amber-100 font-medium">{feedback.konglish_warm_tip_ko}</p>
                          </div>
                        )}
                      </div>

                      {/* 2. 교정된 원어민 문장 & 고득점 IB 에세이 모델 */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="p-4 bg-slate-950/90 border border-slate-800 rounded-xl space-y-2">
                          <span className="text-[11px] font-mono font-black text-indigo-400 uppercase tracking-widest block">
                            🎯 Polished English (자연스러운 교정 문장)
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-white leading-relaxed">
                            "{feedback.polished_en}"
                          </p>
                        </div>

                        <div className="p-4 bg-slate-950/90 border border-purple-900/60 rounded-xl space-y-2">
                          <span className="text-[11px] font-mono font-black text-purple-400 uppercase tracking-widest block">
                            🏆 Advanced IB Model (고득점 심화 모델)
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-purple-100 leading-relaxed">
                            "{feedback.advanced_model_en}"
                          </p>
                        </div>
                      </div>

                      {/* 3. 소크라테스 산파법 3단계 꼬리물기 질문 */}
                      {feedback.socratic_followups && feedback.socratic_followups.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-purple-800/60">
                          <h5 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
                            <span>🏛️</span> 소크라테스 3단계 산파법: 생각을 심화시키는 꼬리물기 질문
                          </h5>

                          <div className="space-y-4">
                            {feedback.socratic_followups.map((f, fIdx) => {
                              const fKey = `q_${idx}_step_${f.step}`;
                              return (
                                <div key={fIdx} className="bg-slate-950 border border-purple-900/50 rounded-2xl p-4 space-y-3">
                                  <div className="space-y-1">
                                    <span className="text-xs font-black text-purple-300 block">{f.title}</span>
                                    <p className="text-xs sm:text-sm font-bold text-white">{f.question_en}</p>
                                    <p className="text-xs text-slate-400">{f.question_ko}</p>
                                    <p className="text-[11px] text-purple-300 font-semibold">👉 {f.prompt_ko}</p>
                                  </div>

                                  <textarea
                                    rows={2}
                                    placeholder="이 꼬리물기 질문에 대해 생각을 적어보세요..."
                                    value={followUpAnswers[fKey] || ''}
                                    onChange={e => setFollowUpAnswers(prev => ({ ...prev, [fKey]: e.target.value }))}
                                    className="w-full bg-slate-900 border border-slate-800 focus:border-purple-500 rounded-xl p-3 text-xs text-white outline-none"
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
          })
        )}
      </div>

      {/* 🌟 3. AI 실시간 소크라테스 티키타카 대화방 (Live Multi-turn Socratic Chat Room) */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <div>
              <h4 className="text-sm sm:text-base font-black text-white">AI 소크라테스 실시간 티키타카 대화방</h4>
              <p className="text-[11px] text-slate-400">영상 내용에 대해 무엇이든 질문하거나 의견을 말해보세요. AI 코치가 생각을 주고받으며 이끌어줍니다.</p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-[10px] font-black">
            ● 실시간 대화 가능
          </span>
        </div>

        {/* Chat History Box */}
        <div className="h-64 sm:h-72 overflow-y-auto space-y-3 p-4 bg-slate-900/70 border border-slate-800/80 rounded-2xl custom-scrollbar">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
              <span className="text-3xl">🗣️</span>
              <p className="text-xs font-bold text-slate-400">AI 소크라테스 코치와 실시간 티키타카를 시작해 보세요!</p>
              <p className="text-[11px] text-slate-500 max-w-sm">
                예: "이 영상에서 말한 방식이 왜 기존 문법 공부보다 효과적인가요?", "만약 영어를 처음 배우는 초보자라면 어떻게 적용해야 하나요?"
              </p>
            </div>
          ) : (
            chatMessages.map((msg, mIdx) => (
              <div
                key={mIdx}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm space-y-1.5 shadow-md ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                      : 'bg-slate-800 border border-slate-700 text-slate-100 rounded-bl-none'
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  
                  {msg.polished_en && (
                    <div className="mt-2 pt-2 border-t border-slate-700/60 space-y-1">
                      <span className="text-[10px] font-mono font-bold text-indigo-300 block">✨ 세련된 원어민 영어 표현:</span>
                      <p className="text-xs text-amber-200 font-semibold italic">"{msg.polished_en}"</p>
                    </div>
                  )}

                  {msg.followup_ko && (
                    <div className="mt-1.5 p-2 bg-purple-950/60 border border-purple-800/60 rounded-xl space-y-0.5">
                      <span className="text-[10px] font-black text-purple-300">👉 다음 생각 질문 (티키타카):</span>
                      <p className="text-xs text-purple-100 font-bold">{msg.followup_ko}</p>
                      {msg.followup_en && <p className="text-[11px] text-slate-300 italic">{msg.followup_en}</p>}
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-1">{msg.time}</span>
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSendChatMessage} className="flex gap-2">
          <input
            type="text"
            placeholder="AI 소크라테스 코치에게 나의 생각이나 질문을 입력하세요... (한글/영어 모두 가능)"
            value={userChatInput}
            onChange={e => setUserChatInput(e.target.value)}
            disabled={isSendingChat}
            className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 focus:border-purple-500 rounded-2xl text-xs sm:text-sm text-white outline-none placeholder:text-slate-600 transition-colors"
          />
          <button
            type="submit"
            disabled={isSendingChat || !userChatInput.trim()}
            className="px-5 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 text-white rounded-2xl text-xs font-black shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5"
          >
            {isSendingChat ? '답변 생성 중...' : '전송 🚀'}
          </button>
        </form>
      </div>
    </div>
  );
};
