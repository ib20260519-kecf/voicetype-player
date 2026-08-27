import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { StudentInfo, ClassInfo, Lesson, LearningRecord } from '../types';

interface LessonListProps {
  student: StudentInfo;
  classInfo: ClassInfo;
  onSelectLesson: (lesson: Lesson) => void;
  onLogout: () => void;
}

export const LessonList: React.FC<LessonListProps> = ({
  student,
  classInfo,
  onSelectLesson,
  onLogout
}) => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [records, setRecords] = useState<Record<string, LearningRecord>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Fallback demo lessons if Supabase empty
  const demoLessons: Lesson[] = [
    {
      id: 'lesson_demo_01',
      title: 'VOA Special English - AI in Everyday Life',
      description: '인공지능 기술이 우리의 일상 생활에 미치는 영향에 대한 쉬운 영어 뉴스',
      audio_url: 'https://pub-demo.r2.dev/ai_lesson.mp3',
      duration_sec: 145,
      word_count: 230,
      level: 'B1',
      category: '과학/기술',
      tags: ['AI', 'Tech', 'VOA'],
      segments: [
        { id: 0, start: 0, end: 4.2, text: 'Welcome to VoiceType English learning program.' },
        { id: 1, start: 4.5, end: 9.8, text: 'Artificial intelligence is changing the way we work and live.' },
        { id: 2, start: 10.2, end: 16.0, text: 'Many students find it helpful to practice speaking every day.' }
      ],
      slides: [
        {
          slide_no: 1,
          timestamp_start: 0,
          headline: 'Introduction to AI',
          headline_ko: '인공지능의 도입',
          key_sentence: 'Artificial intelligence is changing the way we work and live.',
          key_sentence_ko: '인공지능은 우리가 일하고 살아가는 방식을 바꾸고 있습니다.',
          explanation_ko: 'the way S+V 구문은 ~하는 방식으로 해석합니다.',
          vocabulary: ['artificial', 'intelligence']
        }
      ]
    }
  ];

  useEffect(() => {
    fetchLessonsAndRecords();
  }, [student.class_id]);

  const fetchLessonsAndRecords = async () => {
    setLoading(true);
    try {
      if (supabase) {
        // 1. Fetch assigned lessons for this class
        const { data: assignData, error: assignErr } = await supabase
          .from('class_assignments')
          .select('*, lessons(*)')
          .eq('class_id', student.class_id)
          .eq('is_active', true);

        if (!assignErr && assignData && assignData.length > 0) {
          const loadedLessons: Lesson[] = assignData
            .map(item => item.lessons)
            .filter(Boolean) as Lesson[];
          setLessons(loadedLessons);
        } else {
          // If no specific class assignment, fallback to all public lessons
          const { data: allLessons } = await supabase.from('lessons').select('*').limit(20);
          if (allLessons && allLessons.length > 0) {
            setLessons(allLessons as Lesson[]);
          } else {
            setLessons(demoLessons);
          }
        }

        // 2. Fetch student's learning records
        const { data: recordData } = await supabase
          .from('learning_records')
          .select('*')
          .eq('student_id', student.id);

        if (recordData) {
          const recMap: Record<string, LearningRecord> = {};
          recordData.forEach(r => { recMap[r.lesson_id] = r; });
          setRecords(recMap);
        }
      } else {
        setLessons(demoLessons);
      }
    } catch (e) {
      console.error(e);
      setLessons(demoLessons);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Navbar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/80 border border-slate-800 backdrop-blur-md rounded-3xl p-5 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-indigo-600/30 border border-indigo-500/50 rounded-2xl flex items-center justify-center text-2xl">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
                  {classInfo.name}
                </span>
                <span className="text-xs text-slate-400 font-bold">{student.student_no}번</span>
              </div>
              <h2 className="text-lg font-black text-white">{student.name} 학생</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={fetchLessonsAndRecords}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all"
              title="새로고침"
            >
              🔄
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2.5 bg-slate-800 hover:bg-red-950/50 hover:text-red-400 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Banner */}
        <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/40 to-slate-900/60 border border-indigo-800/40 rounded-3xl p-6 relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <span className="text-xs font-black text-indigo-400 tracking-widest uppercase">My Assignments</span>
            <h3 className="text-2xl font-black text-white tracking-tight">
              이번 주 배정된 과제 목록
            </h3>
            <p className="text-xs text-slate-300">
              선생님께서 배정하신 과제를 완료하고 받아쓰기 실력을 키워보세요!
            </p>
          </div>
        </div>

        {/* Lesson Cards */}
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="animate-spin text-4xl">⚙️</div>
            <p className="text-xs text-slate-400 font-bold">배정된 레슨을 불러오는 중...</p>
          </div>
        ) : lessons.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <span className="text-4xl">🏖️</span>
            <h4 className="text-lg font-black text-white">현재 배정된 과제가 없습니다.</h4>
            <p className="text-xs text-slate-400">선생님이 새 과제를 배정하시면 여기에 표시됩니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lessons.map(lesson => {
              const record = records[lesson.id];
              const isCompleted = record?.completed;
              const score = record?.accuracy_score || 0;

              return (
                <div
                  key={lesson.id}
                  onClick={() => onSelectLesson(lesson)}
                  className="bg-slate-900/90 border border-slate-800/90 hover:border-indigo-500/50 rounded-3xl p-6 space-y-4 hover:shadow-xl hover:shadow-indigo-950/50 hover:scale-[1.01] transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Tags */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-full text-[10px] font-black uppercase">
                          {lesson.level || 'B1'}
                        </span>
                        <span className="px-2.5 py-0.5 bg-slate-800 text-slate-400 rounded-full text-[10px] font-bold">
                          {lesson.category || '뉴스/시사'}
                        </span>
                      </div>
                      {isCompleted ? (
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-black flex items-center gap-1">
                          ✓ 완료 ({score}점)
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-black">
                          ⏳ 학습 대기
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h4 className="text-base font-black text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
                      {lesson.title}
                    </h4>

                    {/* Description */}
                    {lesson.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {lesson.description}
                      </p>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                    <span>⏱️ {Math.floor((lesson.duration_sec || 0) / 60)}분 {(lesson.duration_sec || 0) % 60}초</span>
                    <span className="text-indigo-400 font-bold group-hover:translate-x-1 transition-transform">
                      학습 시작하기 →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
