import React, { useState, useEffect } from 'react';
import { supabase, initSupabaseClient } from '../lib/supabase';
import { ClassInfo, StudentInfo, Lesson, LearningRecord } from '../types';

interface TeacherLMSProps {
  onBackToStudentMode: () => void;
}

export const TeacherLMS: React.FC<TeacherLMSProps> = ({ onBackToStudentMode }) => {
  const [activeClassId, setActiveClassId] = useState<string>('class_01');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Cloud Config Prompt State
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState(localStorage.getItem('vt_supabase_url') || '');
  const [customKey, setCustomKey] = useState(localStorage.getItem('vt_supabase_key') || '');

  // Default 10 classes
  const defaultClasses: ClassInfo[] = Array.from({ length: 10 }, (_, i) => ({
    id: `class_${String(i + 1).padStart(2, '0')}`,
    name: `${i + 1}반 (Class ${i + 1})`,
    teacher_name: 'Teacher'
  }));

  // Default 30 students per class
  const generateDefaultStudents = (classId: string): StudentInfo[] => {
    const classNum = classId.replace('class_', '');
    return Array.from({ length: 30 }, (_, i) => ({
      id: `student_${classId}_${i + 1}`,
      class_id: classId,
      student_no: i + 1,
      name: `${parseInt(classNum)}반 ${i + 1}번 학생`
    }));
  };

  useEffect(() => {
    loadLMSData();
  }, [activeClassId]);

  const loadLMSData = async () => {
    setLoading(true);
    try {
      if (supabase) {
        // 1. Classes
        const { data: cData } = await supabase.from('classes').select('*').order('id');
        setClasses(cData && cData.length > 0 ? cData : defaultClasses);

        // 2. Students in active class
        const { data: sData } = await supabase
          .from('students')
          .select('*')
          .eq('class_id', activeClassId)
          .order('student_no');
        setStudents(sData && sData.length > 0 ? sData : generateDefaultStudents(activeClassId));

        // 3. Lessons
        const { data: lData } = await supabase.from('lessons').select('*');
        setLessons(lData || []);

        // 4. Learning records for this class
        const { data: rData } = await supabase
          .from('learning_records')
          .select('*')
          .eq('class_id', activeClassId);
        setRecords(rData || []);
      } else {
        setClasses(defaultClasses);
        setStudents(generateDefaultStudents(activeClassId));
      }
    } catch (e) {
      console.error(e);
      setClasses(defaultClasses);
      setStudents(generateDefaultStudents(activeClassId));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    initSupabaseClient(customUrl.trim(), customKey.trim());
    setShowConfigModal(false);
    loadLMSData();
  };

  // Calculate Class Stats
  const completedCount = students.filter(s => records.some(r => r.student_id === s.id && r.completed)).length;
  const completionRate = Math.round((completedCount / Math.max(students.length, 1)) * 100);
  const avgScore = records.length > 0
    ? Math.round(records.reduce((acc, r) => acc + (r.accuracy_score || 0), 0) / records.length)
    : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-900/90 border border-slate-800 rounded-3xl p-6 gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center text-2xl text-white shadow-lg shadow-purple-500/20">
              📊
            </div>
            <div>
              <h1 className="text-xl font-black text-white">VoiceType 교사용 통합 LMS 대시보드</h1>
              <p className="text-xs text-slate-400">10개 반 300명 학생의 실시간 진도율 및 받아쓰기 성적 관리</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer"
            >
              ⚙️ Supabase 연동 설정
            </button>
            <button
              onClick={onBackToStudentMode}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              🎧 학생 모드로 전환
            </button>
          </div>
        </div>

        {/* Global 10 Classes Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-slate-400 uppercase">전체 관리 학급</p>
            <p className="text-2xl font-black text-white mt-1">10개 반</p>
            <p className="text-[10px] text-slate-500">총 학생 정원 300명</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-indigo-400 uppercase">현재 반 학생 수</p>
            <p className="text-2xl font-black text-indigo-400 mt-1">{students.length}명</p>
            <p className="text-[10px] text-slate-500">Class No. 1~30</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-emerald-400 uppercase">현재 반 과제 완료율</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">{completionRate}%</p>
            <p className="text-[10px] text-slate-500">{completedCount}명 완료</p>
          </div>
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
            <p className="text-[11px] font-bold text-purple-400 uppercase">평균 받아쓰기 점수</p>
            <p className="text-2xl font-black text-purple-400 mt-1">{avgScore}점</p>
            <p className="text-[10px] text-slate-500">정확도 기준</p>
          </div>
        </div>

        {/* 10 Class Tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 bg-slate-900/60 p-2 rounded-2xl border border-slate-800">
          {(classes.length > 0 ? classes : defaultClasses).map(c => {
            const isCurrent = c.id === activeClassId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveClassId(c.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-102'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {/* 30 Students Table */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <span>📋</span> {classes.find(c => c.id === activeClassId)?.name || '선택된 반'} 30명 학생 상세 진도 현황
            </h3>
            <button onClick={loadLMSData} className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer">
              새로고침 🔄
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">출석번호</th>
                  <th className="px-6 py-3.5">학생 이름</th>
                  <th className="px-6 py-3.5">과제 제출 상태</th>
                  <th className="px-6 py-3.5">받아쓰기 점수</th>
                  <th className="px-6 py-3.5">학습 시간</th>
                  <th className="px-6 py-3.5">최종 제출일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {students.map(s => {
                  const record = records.find(r => r.student_id === s.id);
                  const isCompleted = record?.completed;

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-3.5 font-mono font-bold text-slate-400">
                        {String(s.student_no).padStart(2, '0')}번
                      </td>
                      <td className="px-6 py-3.5 font-bold text-white">
                        {s.name}
                      </td>
                      <td className="px-6 py-3.5">
                        {isCompleted ? (
                          <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-black text-[11px]">
                            ✓ 제출 완료
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-slate-800 text-slate-500 rounded-full font-bold text-[11px]">
                            미제출
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 font-black text-sm">
                        {isCompleted ? (
                          <span className={record.accuracy_score >= 80 ? 'text-emerald-400' : 'text-amber-400'}>
                            {record.accuracy_score}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-slate-400">
                        {record ? `${Math.floor((record.time_spent_sec || 0) / 60)}분 ${(record.time_spent_sec || 0) % 60}초` : '—'}
                      </td>
                      <td className="px-6 py-3.5 text-slate-500 text-[11px]">
                        {record?.completed_at ? new Date(record.completed_at).toLocaleString('ko-KR') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Supabase Config Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-black text-white">⚙️ Supabase 연동 설정</h3>
            <p className="text-xs text-slate-400">
              Vercel 웹 앱에서 데이터를 조회할 Supabase 프로젝트 정보를 입력하세요.
            </p>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="https://xxxx.supabase.co"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none"
              />
              <input
                type="password"
                placeholder="anon / public Key"
                value={customKey}
                onChange={e => setCustomKey(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-mono text-white outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSaveConfig}
                className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 cursor-pointer"
              >
                저장 및 연결
              </button>
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2.5 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
