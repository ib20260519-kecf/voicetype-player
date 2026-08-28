// 🏛️ Domain Types & ISP Segregated Interfaces

export type StudyMode = 
  | 'video' 
  | 'dictation' 
  | 'cloze' 
  | 'shadowing' 
  | 'slides' 
  | 'vocab' 
  | 'idioms' 
  | 'ib_inquiry';

export interface ClassInfo {
  id: string; // 'class_01'
  name: string; // '1반 (Class 1)'
  teacher_name?: string;
}

export interface StudentInfo {
  id: string;
  class_id: string;
  student_no: number;
  name: string;
  passcode?: string;
}

export interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface SlideItem {
  slide_no: number;
  timestamp_start: number;
  headline: string;
  headline_ko: string;
  key_sentence: string;
  key_sentence_ko: string;
  explanation_ko: string;
  vocabulary: string[];
}

export interface IdiomItem {
  expression: string;
  meaning_ko: string;
  example_from_text: string;
  example_ko: string;
  type?: string;
}

export interface IBQuestion {
  type: 'factual' | 'conceptual' | 'debatable';
  question_en: string;
  question_ko: string;
  inquiry_prompt?: string;
  sample_answer_en?: string;
}

export interface DetailedWordInfo {
  word: string;
  meaning_ko: string;
  example?: string;
  part_of_speech?: string;
  phonetic?: string;
  definition_en?: string;
  synonyms?: string[];
  antonyms?: string[];
  extra_examples?: string[];
}

export interface SocraticFollowUp {
  step: number;
  type: 'socratic' | 'feynman' | 'scamper';
  title: string;
  question_ko: string;
  question_en: string;
  prompt_ko: string;
}

export interface AIFeedbackResult {
  rubric: string;
  strengths_ko: string;
  konglish_warm_tip_ko: string;
  polished_en: string;
  advanced_model_en: string;
  socratic_followups: SocraticFollowUp[];
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  audio_url: string;
  video_url?: string;
  youtube_id?: string;
  duration_sec: number;
  word_count: number;
  level: string;
  category: string;
  tags?: string[];
  segments: Segment[];
  slides?: SlideItem[];
  idioms?: IdiomItem[];
  key_vocabulary?: DetailedWordInfo[];
  ib_questions?: IBQuestion[];
  created_by?: string;
}

export interface ClassAssignment {
  id: string;
  class_id: string;
  lesson_id: string;
  assigned_at: string;
  due_date?: string;
  is_active: boolean;
  lesson?: Lesson;
}

export interface LearningRecord {
  id?: string;
  student_id: string;
  class_id: string;
  lesson_id: string;
  accuracy_score: number;
  completed: boolean;
  time_spent_sec: number;
  wrong_words: string[];
  ib_answers?: Record<string, any>;
  completed_at?: string;
  updated_at?: string;
}

// 🏛️ Base Study Mode Contract (LSP Principle)
export interface BaseStudyModeProps {
  lesson: Lesson;
  segments: Segment[];
  activeSegmentIndex: number;
  onJumpToSegment: (index: number) => void;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
}
