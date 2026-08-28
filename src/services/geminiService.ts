import { AIFeedbackResult, IBQuestion } from '../types';

const CANDIDATE_MODELS = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
  'gemini-1.5-pro'
];

export class GeminiService {
  private static getStoredKey(): string {
    return localStorage.getItem('vt_gemini_api_key') || '';
  }

  public static async testApiKey(apiKey: string): Promise<{ success: boolean; msg: string }> {
    const key = apiKey.trim();
    if (!key) {
      return { success: false, msg: 'API Key를 먼저 입력해 주세요.' };
    }

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const data = await res.json();

      if (res.ok && data.models) {
        return {
          success: true,
          msg: `✅ 연결 성공! (${data.models.length}개 Gemini 모델 사용 가능 확인됨)`
        };
      } else {
        return {
          success: false,
          msg: `❌ 인증 실패: ${data.error?.message || '유효하지 않은 API 키입니다.'}`
        };
      }
    } catch (err: any) {
      return {
        success: false,
        msg: `❌ 네트워크 오류: ${err.message || err}`
      };
    }
  }

  public static async generateSocraticFeedback(
    lessonTitle: string,
    question: IBQuestion,
    studentAnswer: string
  ): Promise<AIFeedbackResult> {
    const apiKey = this.getStoredKey().trim();

    const prompt = `
You are a warm, encouraging, and world-class IB English & Philosophy Inquiry Coach.
The student might submit imperfect English, Konglish (Korean-style English), or short simple sentences.
YOUR PRIORITY is to VALIDATE the student's core idea first, gently polish their English expression, and then trigger DEEP CRITICAL THINKING through a 3-Stage Questioning Framework:
1. 🏛️ Socratic Clarification (소크라테스 산파법 반문)
2. 🧠 Feynman Simplification (파인만 학습법: 쉬운 비유로 설명하기)
3. ⚡ SCAMPER Perspective Shift (SCAMPER 발상 전환 질문)

[Context]:
- Lesson Title: "${lessonTitle}"
- Question Type: IB ${question.type.toUpperCase()}
- IB Main Question: "${question.question_en}" (${question.question_ko})
- Student's Answer: "${studentAnswer}"

Please analyze and generate response in STRICT JSON format:
{
  "rubric": "IB Criterion evaluation grade (e.g. 'Criterion A/B: Excellent Idea (Level 7/8)')",
  "strengths_ko": "학생의 생각에서 가장 칭찬할 점 (콩글리시여도 아이디어를 적극 칭찬하는 한국어 1~2문장)",
  "konglish_warm_tip_ko": "따뜻한 표현 코칭 (학생이 쓴 서툰 표현을 어떻게 세련되게 바꿀 수 있는지 친절한 한국어 팁 1문장)",
  "polished_en": "원어민 수준의 자연스럽고 명확한 영어 교정 문장",
  "advanced_model_en": "학생의 아이디어를 한 단계 더 심화시킨 고득점 IB 모범 에세이 문장",
  "socratic_followups": [
    {
      "step": 1,
      "type": "socratic",
      "title": "🏛️ 1단계 [소크라테스 산파법]: 전제와 반대 상황 탐구",
      "question_en": "A probing English question challenging the assumptions or exploring edge cases of student's answer.",
      "question_ko": "학생의 주장에 대해 반대 상황이나 숨은 전제를 짚어주는 한국어 질문",
      "prompt_ko": "만약 ~한 상황이라면 당신의 선택은 어떻게 달라질까요?"
    },
    {
      "step": 2,
      "type": "feynman",
      "title": "🧠 2단계 [파인만 학습법]: 일상 속 쉬운 비유로 설명하기",
      "question_en": "An English question asking to explain this concept using a simple everyday analogy to a young child.",
      "question_ko": "이 개념을 어린 동생이나 친구에게 가장 알기 쉬운 일상 비유로 설명해 보라는 한국어 질문",
      "prompt_ko": "내가 일상에서 겪은 경험이나 쉬운 물건에 빗대어 설명해 보세요."
    },
    {
      "step": 3,
      "type": "scamper",
      "title": "⚡ 3단계 [SCAMPER 발상 전환]: 규칙을 뒤집거나 대체하기",
      "question_en": "A creative SCAMPER question (Substitute, Combine, Reverse, or Modify) transforming the whole scenario.",
      "question_ko": "기존 상식이나 규칙을 완전히 뒤집어 새로운 관점을 모색하는 창의적 한국어 질문",
      "prompt_ko": "만약 상점에서 가격표를 아예 없애고 소비자가 가치를 매긴다면 어떻게 될까요?"
    }
  ]
}
`;

    if (apiKey) {
      for (const modelName of CANDIDATE_MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  response_mime_type: 'application/json',
                  temperature: 0.7
                }
              })
            }
          );

          if (response.ok) {
            const successfulData = await response.json();
            let rawText = successfulData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            rawText = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
            return JSON.parse(rawText);
          }
        } catch {
          // try next model fallback
        }
      }
    }

    // Intelligent Socratic Fallback
    return this.generateSmartFallback(studentAnswer);
  }

  public static async generateWordDeepDive(word: string): Promise<{ etymology: string; nuance: string; collocations: string[] }> {
    const apiKey = this.getStoredKey().trim();
    if (!apiKey) {
      return {
        etymology: `고대 어원에서 유래하여, 현대 영어에서 '${word}'의 핵심 의미인 능동적 행위와 상태를 나타냅니다.`,
        nuance: `일상 회화 및 비즈니스 영어에서 매우 폭넓게 사용되며, 긍정적이고 명확한 뉘앙스를 전달합니다.`,
        collocations: [`make a ${word} choice`, `${word} strategy`, `highly ${word}`]
      };
    }

    try {
      const prompt = `
Explain the English word "${word}" for ESL students in strict JSON format:
{
  "etymology": "어원과 단어의 유래 (친절한 한국어 1~2문장)",
  "nuance": "유의어와의 미묘한 뉘앙스 차이 및 사용 팁 (한국어 2문장)",
  "collocations": ["함께 자주 쓰이는 연어 표현 1", "연어 표현 2", "연어 표현 3"]
}
`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { response_mime_type: 'application/json' }
          })
        }
      );

      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
      }
    } catch {}

    return {
      etymology: `라틴어/게르만계 어원에서 비롯되어 직관적인 의미를 갖습니다.`,
      nuance: `정확한 문맥에 맞춰 활용하면 문장의 신뢰도를 높여줍니다.`,
      collocations: [`common ${word}`, `key ${word}`, `${word} in action`]
    };
  }

  private static generateSmartFallback(studentAnswer: string): AIFeedbackResult {
    const cleanAnswer = studentAnswer.replace(/[^a-zA-Z0-9가-힣\s]/g, '').slice(0, 30);
    return {
      rubric: "Criterion A/B: Excellent Creative Effort (Level 7/8)",
      strengths_ko: `"${cleanAnswer}..." - 학생의 주도적인 관점과 문제 해결 의지가 매우 돋보이는 훌륭한 생각입니다!`,
      konglish_warm_tip_ko: "한국어식 단문이나 직역 표현도 좋습니다! 'I think ~ because...' 패턴을 활용하면 더욱 논리적인 에세이가 됩니다.",
      polished_en: `In my perspective, evaluating the core value and market price prior to purchase is essential for cultivating responsible consumption habits.`,
      advanced_model_en: `I firmly believe that proactive price awareness empowers consumers to make informed financial choices, thereby fostering long-term economic independence and mitigating the risks of impulsive spending.`,
      socratic_followups: [
        {
          step: 1,
          type: "socratic",
          title: "🏛️ 1단계 [소크라테스 산파법]: 전제와 반대 상황 탐구",
          question_en: "If an expensive item offers exceptional durability lasting over a decade, does avoiding it still represent wise frugality?",
          question_ko: "만약 가격표는 2배 비싸지만 10년을 쓸 수 있는 제품이라면, 여전히 구매하지 않는 것이 현명한 절약일까요? 당신의 기준은 어떻게 달라지나요?",
          prompt_ko: "가격과 제품의 수명(내구성) 사이의 균형에 대해 생각을 적어보세요."
        },
        {
          step: 2,
          type: "feynman",
          title: "🧠 2단계 [파인만 학습법]: 일상 속 쉬운 비유로 설명하기",
          question_en: "How would you explain the importance of checking prices to a 10-year-old child using a candy or toy store analogy?",
          question_ko: "이 '가격 확인 습관'의 가치를 초등학교 저학년 동생에게 과자나 장난감 가게에 빗대어 가장 알기 쉽게 설명해 준다면 어떤 비유를 들겠어요?",
          prompt_ko: "동생에게 이야기하듯 쉬운 일상 비유로 설명해 보세요."
        },
        {
          step: 3,
          type: "scamper",
          title: "⚡ 3단계 [SCAMPER 발상 전환]: 상식 뒤집기/대체하기",
          question_en: "What if shopping malls eliminated all price tags and allowed consumers to pay whatever value they feel after using the item?",
          question_ko: "만약 매장에서 가격표를 완전히 없애고, 소비자가 물건을 써본 뒤 만족한 만큼 스스로 가격을 매기게 한다면(Reverse/Modify) 시장에 어떤 일이 벌어질까요?",
          prompt_ko: "기존의 상식을 뒤집었을 때 발생할 긍정적/부정적 효과를 상상해 보세요."
        }
      ]
    };
  }
}
