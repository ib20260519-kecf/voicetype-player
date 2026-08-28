import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ClassInfo, StudentInfo } from '../types';

interface StudentAuthProps {
  onLoginSuccess: (student: StudentInfo, classInfo: ClassInfo) => void;
  onOpenTeacherMode: () => void;
}

export const StudentAuth: React.FC<StudentAuthProps> = ({ onLoginSuccess, onOpenTeacherMode }) => {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('class_01');
  const [studentNo, setStudentNo] = useState<number>(1);
  const [classStudents, setClassStudents] = useState<Record<number, StudentInfo>>({});
  const [studentName, setStudentName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // 10개 기본 반 목록
  const defaultClasses: ClassInfo[] = Array.from({ length: 10 }, (_, i) => ({
    id: `class_${String(i + 1).padStart(2, '0')}`,
    name: `${i + 1}반 (Class ${i + 1})`,
    teacher_name: 'Teacher'
  }));

  // 1. Fetch Classes on mount
  useEffect(() => {
    if (supabase) {
      supabase.from('classes').select('*').order('id')
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            setClasses(data);
            setSelectedClassId(data[0].id);
          } else {
            setClasses(defaultClasses);
          }
        });
    } else {
      setClasses(defaultClasses);
    }
  }, []);

  // 2. Fetch Students for the selected class
  useEffect(() => {
    if (!supabase || !selectedClassId) return;

    supabase
      .from('students')
      .select('*')
      .eq('class_id', selectedClassId)
      .then(({ data, error }) => {
        if (!error && data) {
          const map: Record<number, StudentInfo> = {};
          data.forEach(s => { map[s.student_no] = s; });
          setClassStudents(map);
          
          // Auto-fill student name if already registered
          if (map[studentNo]) {
            setStudentName(map[studentNo].name);
          }
        }
      });
  }, [selectedClassId]);

  // Update name when studentNo changes
  useEffect(() => {
    if (classStudents[studentNo]) {
      setStudentName(classStudents[studentNo].name);
    } else {
      const currentClass = classes.find(c => c.id === selectedClassId);
      const className = currentClass ? currentClass.name : '학급';
      setStudentName(`${className} ${studentNo}번 학생`);
    }
  }, [studentNo, classStudents]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    const currentClass = classes.find(c => c.id === selectedClassId) || defaultClasses[0];

    try {
      if (supabase) {
        // Find or upsert student in Supabase
        const existing = classStudents[studentNo];
        if (existing) {
          onLoginSuccess(existing, currentClass);
          return;
        }

        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('class_id', selectedClassId)
          .eq('student_no', studentNo)
          .single();

        if (!error && data) {
          onLoginSuccess(data, currentClass);
          return;
        }
      }

      // Offline / fallback student
      const fallbackStudent: StudentInfo = {
        id: `student_${selectedClassId}_${studentNo}`,
        class_id: selectedClassId,
        student_no: Number(studentNo),
        name: studentName.trim() || `${currentClass.name} ${studentNo}번`,
        passcode: '1234'
      };

      onLoginSuccess(fallbackStudent, currentClass);
    } catch (err: any) {
      setErrorMsg(err.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const currentClassObj = classes.find(c => c.id === selectedClassId) || defaultClasses[0];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-indigo-950/50 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-lg shadow-indigo-500/30 text-white">
            🎧
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            VoiceType 학생 학습관
          </h1>
          <p className="text-xs text-slate-400">
            나의 반과 출석번호를 선택하고 과제를 시작하세요.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Class Select (1~10반) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">나의 학급 (반)</label>
            <select
              value={selectedClassId}
              onChange={e => setSelectedClassId(e.target.value)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              {classes.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white font-bold">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Student No (1~30) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">출석번호 선택 (1~30번)</label>
              <span className="text-[11px] text-indigo-400 font-bold">현재 선택: {studentNo}번</span>
            </div>
            <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-950/60 rounded-2xl border border-slate-800">
              {Array.from({ length: 30 }, (_, i) => i + 1).map(num => {
                const registeredName = classStudents[num]?.name;
                return (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setStudentNo(num)}
                    title={registeredName || `${num}번`}
                    className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer truncate px-1 ${
                      studentNo === num
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 scale-105'
                        : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {num}번
                  </button>
                );
              })}
            </div>
          </div>

          {/* Student Welcome Banner / Name Check */}
          <div className="p-3.5 bg-indigo-950/40 border border-indigo-900/60 rounded-2xl space-y-1">
            <p className="text-[11px] font-bold text-indigo-400">👋 학생 확인</p>
            <p className="text-base font-black text-white">
              {studentName || `${currentClassObj.name} ${studentNo}번`}
            </p>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 font-bold bg-red-950/50 p-2.5 rounded-xl border border-red-800">
              {errorMsg}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white rounded-2xl font-black text-base shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? '로그인 중...' : '🚀 학습 시작하기'}
          </button>
        </form>

        {/* Footer: Teacher Mode Switch */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span>선생님이신가요?</span>
          <button
            type="button"
            onClick={onOpenTeacherMode}
            className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
          >
            교사용 LMS 대시보드 →
          </button>
        </div>
      </div>
    </div>
  );
};
