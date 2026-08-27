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

export interface Lesson {
  id: string; // 'lesson_001'
  title: string;
  description?: string;
  audio_url: string;
  duration_sec: number;
  word_count: number;
  level: string;
  category: string;
  tags?: string[];
  segments: Segment[];
  slides?: SlideItem[];
  idioms?: IdiomItem[];
  key_vocabulary?: { word: string; meaning_ko: string; example: string }[];
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
  completed_at?: string;
  updated_at?: string;
}
