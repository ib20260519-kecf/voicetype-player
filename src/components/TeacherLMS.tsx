import React, { useState, useEffect } from 'react';
import { supabase, initSupabaseClient } from '../lib/supabase';
import { ClassInfo, StudentInfo, Lesson, LearningRecord } from '../types';

interface TeacherLMSProps {
  onBackToStudentMode: () => void;
}

export const TeacherLMS: React.FC<TeacherLMSProps> = ({ onBackToStudentMode }) => {
  const [activeTab, setActiveTab] = useState<'progress' | 'manage_students'>('progress');
  const [activeClassId, setActiveClassId] = useState<string>('class_01');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Edit Class & Student State
  const [editClassName, setEditClassName] = useState<string>('');
  const [editStudentNames, setEditStudentNames] = useState<string[]>(Array(30).fill(''));
  const [batchNamesInput, setBatchNamesInput] = useState<string>('');
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [isSavingRoster, setIsSavingRoster] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

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
  const generateDefaultStudents = (classId: string, currentClassName: string): StudentInfo[] => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: `student_${classId}_${i + 1}`,
      class_id: classId,
      student_no: i + 1,
      name: `${currentClassName} ${i + 1}번 학생`
    }));
  };

  useEffect(() => {
    loadLMSData();
  }, [activeClassId]);

  const loadLMSData = async () => {
    setLoading(true);
    setSaveSuccessMsg('');
    try {
      if (supabase) {
        // 1. Classes
        const { data: cData } = await supabase.from('classes').select('*').order('id');
        const loadedClasses = cData && cData.length > 0 ? cData : defaultClasses;
        setClasses(loadedClasses);

        const currentClassObj = loadedClasses.find(c => c.id === activeClassId) || loadedClasses[0];
        setEditClassName(currentClassObj.name);

        // 2. Students in active class
        const { data: sData } = await supabase
          .from('students')
          .select('*')
          .eq('class_id', activeClassId)
          .order('student_no');
        
        let loadedStudents = sData && sData.length > 0 ? sData : generateDefaultStudents(activeClassId, currentClassObj.name);
        
        // Ensure 30 students exist
        if (loadedStudents.length < 30) {
          const padded = [...loadedStudents];
          for (let i = loadedStudents.length + 1; i <= 30; i++) {
            padded.push({
              id: `student_${activeClassId}_${i}`,
              class_id: activeClassId,
              student_no: i,
              name: `${currentClassObj.name} ${i}번 학생`
            });
          }
          loadedStudents = padded;
        }

        setStudents(loadedStudents);
        setEditStudentNames(loadedStudents.map(s => s.name));

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
        const defObj = defaultClasses.find(c => c.id === activeClassId) || defaultClasses[0];
        setEditClassName(defObj.name);
        const defStudents = generateDefaultStudents(activeClassId, defObj.name);
        setStudents(defStudents);
        setEditStudentNames(defStudents.map(s => s.name));
      }
    } catch (e) {
      console.error(e);
      setClasses(defaultClasses);
    } finally {
      setLoading(false);
    }
  };

  // Save Class Name and 30 Students Roster to Supabase
  const handleSaveRoster = async () => {
    setIsSavingRoster(true);
    setSaveSuccessMsg('');

    try {
      if (supabase) {
        // 1. Update class name
        await supabase
          .from('classes')
          .upsert({
            id: activeClassId,
            name: editClassName.trim() || `${activeClassId}반`,
            teacher_name: 'Teacher'
          });

        // 2. Upsert 30 students
        const studentsToSave = editStudentNames.map((name, idx) => ({
          class_id: activeClassId,
          student_no: idx + 1,
          name: name.trim() || `${editClassName} ${idx + 1}번`,
          passcode: '1234'
        }));

        const { error: studentErr } = await supabase
          .from('students')
          .upsert(studentsToSave, { onConflict: 'class_id,student_no' });

        if (studentErr) {
          throw studentErr;
        }
      }

      setSaveSuccessMsg(`'${editClassName}' 및 30명 학생 명단이 성공적으로 저장되었습니다! ✓`);
      await loadLMSData();
    } catch (err: any) {
      alert('명단 저장 중 오류: ' + (err.message || err));
    } finally {
      setIsSavingRoster(false);
    }
  };

  // Batch paste handler (split by newline, comma, tab)
  const handleApplyBatchNames = () => {
    const rawLines = batchNamesInput
      .split(/[\n,\t]+/)
      .map(s => s.replace(/^[0-9]+[\.\s\-\)]*/, '').trim()) // remove leading numbering like "1. 홍길동"
      .filter(Boolean);

    if (rawLines.length === 0) {
      alert('입력된 이름이 없습니다.');
      return;
    }

    const updated = [...editStudentNames];
    rawLines.slice(0, 30).forEach((name, idx) => {
      updated[idx] = name;
    });

    setEditStudentNames(updated);
    setShowBatchModal(false);
    setBatchNamesInput('');
  };

  // Export Students Grade Report to CSV (Excel compatible)
  const handleExportCSV = () => {
    const headers = ['학급', '출석번호', '학생이름', '제출상태', '받아쓰기점수(%)', '학습시간(초)', '제출일시'];
    const rows = students.map(s => {
      const rec = records.find(r => r.student_id === s.id);
      return [
        `"${editClassName}"`,
        s.student_no,
        `"${s.name}"`,
        rec?.completed ? '제출완료' : '미제출',
        rec?.accuracy_score || 0,
        rec?.time_spent_sec || 0,
        rec?.completed_at ? `"${new Date(rec.completed_at).toLocaleString('ko-KR')}"` : '""'
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${editClassName}_성적표_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveConfig = () => {
    initSupabaseClient(customUrl.trim(), customKey.trim());
    setShowConfigModal(false);
    loadLMSData();
  };

  // Stats
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
              <p className="text-xs text-slate-400">10개 반 진도율 모니터링 & 학생 명단 직접 관리</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            >
              📥 성적표 엑셀(CSV) 다운로드
            </button>
            <button
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all cursor-pointer"
            >
              ⚙️ DB 연동
            </button>
            <button
              onClick={onBackToStudentMode}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              🎧 학생 모드로 전환
            </button>
          </div>
        </div>


        {/* Mode Tabs: 'progress' (진도 현황) vs 'manage_students' (명단 관리) */}
        <div className="flex border-b border-slate-800 bg-slate-900/60 p-1.5 rounded-2xl gap-2">
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'progress'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            📈 10개 반 실시간 진도율 & 성적표
          </button>
          <button
            onClick={() => setActiveTab('manage_students')}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'manage_students'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            👥 반 이름 & 학생 명단 직접 편집하기
          </button>
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

        {/* TAB 1: 실시간 진도율 및 성적표 */}
        {activeTab === 'progress' && (
          <div className="space-y-6">
            {/* Global Stats Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-slate-400 uppercase">현재 학급</p>
                <p className="text-xl font-black text-white mt-1 truncate">{editClassName || activeClassId}</p>
                <p className="text-[10px] text-slate-500">Class ID: {activeClassId}</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-indigo-400 uppercase">등록된 학생 수</p>
                <p className="text-2xl font-black text-indigo-400 mt-1">{students.length}명</p>
                <p className="text-[10px] text-slate-500">1번 ~ 30번</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-emerald-400 uppercase">과제 제출 완료율</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">{completionRate}%</p>
                <p className="text-[10px] text-slate-500">{completedCount}명 완료</p>
              </div>
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
                <p className="text-[11px] font-bold text-purple-400 uppercase">평균 받아쓰기 점수</p>
                <p className="text-2xl font-black text-purple-400 mt-1">{avgScore}점</p>
                <p className="text-[10px] text-slate-500">정확도 기준</p>
              </div>
            </div>

            {/* 30 Students Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>📋</span> [{editClassName}] 30명 학생 상세 진도 현황표
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('manage_students')}
                    className="text-xs text-purple-400 font-bold hover:underline cursor-pointer"
                  >
                    ✏️ 명단 수정하기
                  </button>
                  <button onClick={loadLMSData} className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer">
                    새로고침 🔄
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">번호</th>
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
                          <td className="px-6 py-3.5 font-bold text-white text-sm">
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
        )}

        {/* TAB 2: 반 이름 및 30명 학생 명단 직접 편집기 */}
        {activeTab === 'manage_students' && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            {/* Header of Edit Section */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <span>👥</span> [{activeClassId}] 반 이름 및 30명 학생 명단 설정
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  선생님께서 입력하신 반 이름과 학생 이름이 학생용 로그인 화면 및 성적표에 즉시 반영됩니다.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowBatchModal(true)}
                  className="px-4 py-2.5 bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-black hover:bg-indigo-600/50 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  📋 엑셀 명단 일괄 붙여넣기
                </button>
                <button
                  onClick={handleSaveRoster}
                  disabled={isSavingRoster}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {isSavingRoster ? '저장 중...' : '💾 명단 저장하기'}
                </button>
              </div>
            </div>

            {saveSuccessMsg && (
              <div className="bg-emerald-950/60 border border-emerald-800/80 p-3.5 rounded-2xl text-xs text-emerald-300 font-bold animate-in fade-in">
                {saveSuccessMsg}
              </div>
            )}

            {/* Edit Class Name */}
            <div className="space-y-2 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
              <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                🏷️ 학급(반) 명칭 설정
              </label>
              <input
                type="text"
                placeholder="예: 3학년 1반 (영어회화 심화반), 토익 기초 A반 등"
                value={editClassName}
                onChange={e => setEditClassName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none focus:border-indigo-500"
              />
            </div>

            {/* 30 Students Name Grid Inputs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-400 uppercase tracking-wider">
                  📝 1번 ~ 30번 학생 이름 개별 입력
                </label>
                <span className="text-[11px] text-slate-500">학생 번호별 이름을 직접 수정하세요</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 30 }, (_, i) => (
                  <div key={i} className="flex items-center gap-2 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 focus-within:border-indigo-500 transition-colors">
                    <span className="w-10 text-center text-xs font-mono font-black text-indigo-400 bg-indigo-950/50 py-1 rounded-lg">
                      {i + 1}번
                    </span>
                    <input
                      type="text"
                      placeholder={`학생 이름 입력`}
                      value={editStudentNames[i] || ''}
                      onChange={e => {
                        const updated = [...editStudentNames];
                        updated[i] = e.target.value;
                        setEditStudentNames(updated);
                      }}
                      className="flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-600"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Save Button */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={handleSaveRoster}
                disabled={isSavingRoster}
                className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-600/30 hover:shadow-indigo-600/50 transition-all cursor-pointer"
              >
                {isSavingRoster ? '저장 중...' : '💾 변경된 반 이름 & 학생 명단 전체 저장'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Batch Paste Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4" onClick={() => setShowBatchModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-black text-base text-white">📋 엑셀 명단 일괄 붙여넣기</h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              엑셀이나 한글 문서에서 <strong>학생 이름 목록(최대 30명)</strong>을 복사하여 아래에 붙여넣으세요.<br />
              (줄바꿈, 쉼표, 또는 1. 홍길동 형식이어도 자동으로 1번부터 채워집니다.)
            </p>

            <textarea
              rows={8}
              placeholder="예시:&#10;김철수&#10;이영희&#10;박민수&#10;최지우..."
              value={batchNamesInput}
              onChange={e => setBatchNamesInput(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-xs font-mono text-white outline-none focus:border-indigo-500"
            />

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleApplyBatchNames}
                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                1번~30번에 자동 적용하기 ✓
              </button>
              <button
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-3 bg-slate-800 text-slate-400 rounded-xl text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

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
