import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { StudentAuth } from './components/StudentAuth';
import { LessonList } from './components/LessonList';
import { WebPlayer } from './components/WebPlayer';
import { TeacherLMS } from './components/TeacherLMS';
import { StudentInfo, ClassInfo, Lesson } from './types';

export function App() {
  const [currentView, setCurrentView] = useState<'auth' | 'list' | 'player' | 'teacher'>('auth');
  const [currentStudent, setCurrentStudent] = useState<StudentInfo | null>(null);
  const [currentClass, setCurrentClass] = useState<ClassInfo | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Check URL query parameters (e.g. ?lesson=lesson_001 or ?mode=teacher)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const lessonId = params.get('lesson');

    if (mode === 'teacher') {
      setCurrentView('teacher');
      return;
    }

    if (lessonId && supabase) {
      supabase.from('lessons').select('*').eq('id', lessonId).single()
        .then(({ data }) => {
          if (data) {
            setSelectedLesson(data as Lesson);
            // If student logged in, directly jump to player
            const savedStudent = localStorage.getItem('vt_student');
            const savedClass = localStorage.getItem('vt_class');
            if (savedStudent && savedClass) {
              setCurrentStudent(JSON.parse(savedStudent));
              setCurrentClass(JSON.parse(savedClass));
              setCurrentView('player');
            }
          }
        });
    }
  }, []);

  const handleLoginSuccess = (student: StudentInfo, classInfo: ClassInfo) => {
    setCurrentStudent(student);
    setCurrentClass(classInfo);
    localStorage.setItem('vt_student', JSON.stringify(student));
    localStorage.setItem('vt_class', JSON.stringify(classInfo));

    if (selectedLesson) {
      setCurrentView('player');
    } else {
      setCurrentView('list');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vt_student');
    localStorage.removeItem('vt_class');
    setCurrentStudent(null);
    setCurrentClass(null);
    setSelectedLesson(null);
    setCurrentView('auth');
  };

  const handleSelectLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setCurrentView('player');
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {currentView === 'auth' && (
        <StudentAuth
          onLoginSuccess={handleLoginSuccess}
          onOpenTeacherMode={() => setCurrentView('teacher')}
        />
      )}

      {currentView === 'list' && currentStudent && currentClass && (
        <LessonList
          student={currentStudent}
          classInfo={currentClass}
          onSelectLesson={handleSelectLesson}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'player' && selectedLesson && currentStudent && (
        <WebPlayer
          lesson={selectedLesson}
          student={currentStudent}
          onBack={() => setCurrentView('list')}
        />
      )}

      {currentView === 'teacher' && (
        <TeacherLMS
          onBackToStudentMode={() => setCurrentView('auth')}
        />
      )}
    </div>
  );
}

export default App;
