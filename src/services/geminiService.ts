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

  public static async generateLessonOverview(lessonTitle: string, scriptText: string): Promise<{
    summary_ko: string;
    core_message_ko: string;
    key_takeaways: string[];
    discussion_points: string[];
  }> {
    const apiKey = this.getStoredKey().trim();
    if (!apiKey) {
      return {
        summary_ko: `본 레슨 '${lessonTitle}'은 핵심 어휘 및 문장 구조를 통해 자연스러운 대화 맥락을 익히는 교육 콘텐츠입니다.`,
        core_message_ko: `상황에 맞는 능동적인 표현 습득과 문맥적 사고를 통해 자신감 있는 의사소통 능력을 기릅니다.`,
        key_takeaways: [
          `실제 원어민 대화 맥락과 자주 쓰이는 핵심 표현 이해`,
          `청취 및 섀도잉 훈련을 통한 정확한 발음과 억양 체화`,
          `비판적 사고 및 IB 심층 질문을 통한 자기 생각 표현하기`
        ],
        discussion_points: [
          `이 상황에서 내가 주인공이라면 어떻게 대답했을까요?`,
          `한국어식 사고방식과 영어식 표현 순서의 차이점은 무엇인가요?`
        ]
      };
    }

    const prompt = `
Analyze this lesson script and generate a comprehensive overview and discussion takeaways for students in STRICT JSON format:
{
  "summary_ko": "전체 영상/대본의 핵심 줄거리 및 상황 맥락 요약 (친절한 한국어 2~3문장)",
  "core_message_ko": "이 레슨이 전달하는 가장 중요한 핵심 가치 및 원리 (한국어 1~2문장)",
  "key_takeaways": [
    "핵심 학습 포인트 1",
    "핵심 학습 포인트 2",
    "핵심 학습 포인트 3"
  ],
  "discussion_points": [
    "학생들이 깊이 생각해볼 만한 심층 토론 화두 1",
    "심층 토론 화두 2"
  ]
}

Lesson Title: "${lessonTitle}"
Script: ${scriptText.slice(0, 3500)}
`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
      }
    } catch {}

    return {
      summary_ko: `본 영상 '${lessonTitle}'의 전체 대본을 기반으로 핵심 맥락을 파악하고 비판적 사고를 훈련합니다.`,
      core_message_ko: `원어민식 사고 훈련과 상황별 적절한 표현을 습득합니다.`,
      key_takeaways: [
        `문맥 속 핵심 단어와 관용구 체화`,
        `자연스러운 영어 어순 및 이미지 트레이닝`
      ],
      discussion_points: [
        `본문에서 가장 인상 깊었던 표현이나 생각은 무엇인가요?`
      ]
    };
  }

  public static async generateIBQuestions(lessonTitle: string, scriptText: string): Promise<IBQuestion[]> {
    const apiKey = this.getStoredKey().trim();
    if (!apiKey) {
      return [
        {
          type: 'factual',
          question_en: `What was the primary situation and key message conveyed in "${lessonTitle}"?`,
          question_ko: `본 영상에서 제시된 주요 상황과 핵심 메시지는 무엇인가요?`,
          inquiry_prompt: `본문의 구체적 내용과 단어를 바탕으로 답변해 보세요.`
        },
        {
          type: 'conceptual',
          question_en: `How does the speaking approach or principle in this lesson improve our natural communication?`,
          question_ko: `이 레슨에서 다룬 말하기 원리나 표현법이 우리의 자연스러운 의사소통을 어떻게 변화시키나요?`,
          inquiry_prompt: `원리와 개념을 쉬운 예시와 함께 설명해 보세요.`
        },
        {
          type: 'debatable',
          question_en: `If you could redefine or challenge the traditional learning method shown here, what new strategy would you propose?`,
          question_ko: `기존의 전통적인 방식이나 통념을 뒤집는다면, 당신은 어떤 새로운 전략이나 시각을 제안하시겠습니까?`,
          inquiry_prompt: `상식을 뒤집는 창의적인 아이디어를 펼쳐보세요.`
        }
      ];
    }

    const prompt = `
Generate 3 progressive IB Inquiry questions (Factual -> Conceptual -> Debatable) based on the lesson script in STRICT JSON format:
{
  "questions": [
    {
      "type": "factual",
      "question_en": "Factual inquiry question about key details in the lesson",
      "question_ko": "본문 내용 기반 사실 확인 질문 (친절한 한국어)",
      "inquiry_prompt": "답변 팁 (한국어 1문장)",
      "sample_answer_en": "Sample English answer"
    },
    {
      "type": "conceptual",
      "question_en": "Conceptual inquiry question exploring underlying principles or why it works",
      "question_ko": "원리와 핵심 개념을 탐구하는 질문 (한국어)",
      "inquiry_prompt": "답변 팁",
      "sample_answer_en": "Sample English answer"
    },
    {
      "type": "debatable",
      "question_en": "Debatable thought-provoking question challenging assumptions or offering new perspectives",
      "question_ko": "상식을 뒤집거나 다양한 관점을 비교하는 심층 토론 질문 (한국어)",
      "inquiry_prompt": "답변 팁",
      "sample_answer_en": "Sample English answer"
    }
  ]
}

Lesson Title: "${lessonTitle}"
Script: ${scriptText.slice(0, 3500)}
`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json' }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
        if (parsed.questions && parsed.questions.length > 0) return parsed.questions;
      }
    } catch {}

    return [
      {
        type: 'factual',
        question_en: `What was the primary idea in "${lessonTitle}"?`,
        question_ko: `이 레슨의 핵심 주제는 무엇인가요?`,
        inquiry_prompt: `본문의 주요 내용을 요약하여 작성해 보세요.`
      },
      {
        type: 'conceptual',
        question_en: `Why is this expression or concept important in real communication?`,
        question_ko: `왜 이 표현이나 개념이 실제 소통에서 중요할까요?`,
        inquiry_prompt: `상황에 따른 효과와 이유를 설명해 보세요.`
      },
      {
        type: 'debatable',
        question_en: `What would happen if we applied this principle to everyday life in a new way?`,
        question_ko: `이 원리를 일상 생활에 새롭게 적용한다면 어떤 변화가 생길까요?`,
        inquiry_prompt: `새로운 시각과 대안적 아이디어를 제안해 보세요.`
      }
    ];
  }

  public static async chatSocraticTikiTaka(
    lessonTitle: string,
    history: Array<{ sender: 'user' | 'assistant'; text: string }>,
    userMessage: string
  ): Promise<{ reply_ko: string; polished_en: string; followup_question_ko: string; followup_question_en: string }> {
    const apiKey = this.getStoredKey().trim();
    if (!apiKey) {
      return {
        reply_ko: `학생의 의견("${userMessage.slice(0, 30)}...")은 매우 창의적이고 주도적인 훌륭한 관점입니다! 단어 선택과 논리가 아주 훌륭합니다.`,
        polished_en: `I believe expressing our genuine thoughts in real situations creates meaningful connections.`,
        followup_question_ko: `그렇다면, 반대 입장의 사람들은 왜 다르게 생각할까요? 그들의 주된 이유는 무엇일까요?`,
        followup_question_en: `What would be the strongest argument from the opposing perspective?`
      };
    }

    const convFormatted = history.map(h => `${h.sender === 'user' ? 'Student' : 'Socratic AI'}: ${h.text}`).join('\n');
    const prompt = `
You are a warm, world-class Socratic IB Inquiry Coach engaging in a live "Tiki-Taka" back-and-forth dialogue with a student.
The student is discussing the lesson: "${lessonTitle}".
The student may write imperfect English, Korean, or mixed Konglish.

Your job:
1. Warmly validate and praise their specific idea (한국어로 학생의 핵심 생각 적극 칭찬 1~2문장).
2. Refine their idea into a polished, natural English sentence.
3. Keep the conversation rolling (티키타카) by asking ONE thought-provoking follow-up question (Korean & English) that challenges them to go deeper or think about another angle!

Conversation history:
${convFormatted}

Latest Student Input: "${userMessage}"

Respond in STRICT JSON:
{
  "reply_ko": "학생의 생각에 대한 따뜻한 공감 및 칭찬 피드백 (한국어 1~2문장)",
  "polished_en": "학생의 말을 원어민 수준으로 세련되게 다듬은 영어 문장",
  "followup_question_ko": "생각을 확장시키는 다음 티키타카 질문 (한국어 1문장)",
  "followup_question_en": "Refined Socratic follow-up question in English"
}
`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json', temperature: 0.7 }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
      }
    } catch {}

    return {
      reply_ko: `훌륭한 생각입니다! 이 관점은 문제의 본질을 잘 짚어냈습니다.`,
      polished_en: `Analyzing the situation with this mindset gives us deeper clarity.`,
      followup_question_ko: `만약 이것이 예상과 정반대의 결과를 낳는다면 어떻게 대처하시겠습니까?`,
      followup_question_en: `How would you respond if this led to an unexpected opposite outcome?`
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
