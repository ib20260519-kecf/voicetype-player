import { supabase } from '../lib/supabase';
import { StudentInfo, Lesson, LearningRecord } from '../types';

export class StorageService {
  public static async submitLearningRecord(
    student: StudentInfo,
    lesson: Lesson,
    accuracyScore: number,
    timeSpentSec: number,
    wrongWords: string[],
    ibAnswers: Record<string, any>
  ): Promise<boolean> {
    try {
      if (supabase) {
        await supabase.from('learning_records').upsert({
          student_id: student.id,
          class_id: student.class_id,
          lesson_id: lesson.id,
          accuracy_score: accuracyScore,
          completed: true,
          time_spent_sec: timeSpentSec,
          wrong_words: wrongWords,
          ib_answers: ibAnswers,
          completed_at: new Date().toISOString()
        }, { onConflict: 'student_id,lesson_id' });
      }
      return true;
    } catch (e) {
      console.error('[StorageService] Error submitting learning record:', e);
      return false;
    }
  }

  public static getStoredApiKey(): string {
    return localStorage.getItem('vt_gemini_api_key') || '';
  }

  public static setStoredApiKey(key: string): void {
    localStorage.setItem('vt_gemini_api_key', key.trim());
  }
}
