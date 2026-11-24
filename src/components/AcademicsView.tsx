import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Award,
  Edit3,
  Download,
  Printer,
  Sparkles,
  Search,
  Filter,
  PlusCircle,
  Trash2,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Users,
  TrendingUp,
  BarChart3,
  X,
  Save,
  Check,
  Lock,
  Calendar,
  SlidersHorizontal,
  Plus,
} from 'lucide-react';
import { StudentGrade, AcademicSubject, ExamTerm, User, ALL_INSTITUTIONAL_CLASSES } from '../types';
import { INITIAL_SUBJECTS, INITIAL_EXAM_TERMS } from '../data/sdbmsInitialData';

interface AcademicsViewProps {
  grades: StudentGrade[];
  users?: User[];
  currentUser: User;
  subjects?: AcademicSubject[];
  examTerms?: ExamTerm[];
  onSaveSubjects?: (subjects: AcademicSubject[]) => Promise<AcademicSubject[]>;
  onSaveExamTerms?: (terms: ExamTerm[]) => Promise<ExamTerm[]>;
  onUpdateGrade: (grade: StudentGrade) => Promise<StudentGrade>;
  onBulkUpdateGrades: (grades: StudentGrade[]) => Promise<StudentGrade[]>;
  onAddGrade?: (gradeData: Omit<StudentGrade, 'id' | 'lastUpdated'>) => Promise<StudentGrade>;
  onDeleteGrade?: (gradeId: string) => Promise<void>;
  onRefreshGrades?: () => Promise<void>;
  onOpenAiDiagnostic?: (studentName: string, grade: StudentGrade) => void;
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({
  grades,
  users = [],
  currentUser,
  subjects = INITIAL_SUBJECTS,
  examTerms = INITIAL_EXAM_TERMS,
  onSaveSubjects,
  onSaveExamTerms,
  onUpdateGrade,
  onBulkUpdateGrades,
  onAddGrade,
  onDeleteGrade,
  onRefreshGrades,
  onOpenAiDiagnostic,
}) => {
  const isTeacherOrAdmin = ['admin', 'teacher'].includes(currentUser.role);
  const isStudent = currentUser.role === 'student';

  const isStudentOwnedGrade = (g: StudentGrade) =>
    g.studentId === currentUser.id ||
    (Boolean(currentUser.rollNo) &&
      Boolean(g.rollNo) &&
      g.rollNo.trim().toLowerCase() === currentUser.rollNo!.trim().toLowerCase()) ||
    (Boolean(currentUser.fullName) &&
      g.studentName.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase());

  // Extract all distinct classes from grades, users, and all 24 institutional classes
  const availableClasses = useMemo(() => {
    const classSet = new Set<string>(ALL_INSTITUTIONAL_CLASSES);
    grades.forEach((g) => {
      if (g.classSec) classSet.add(g.classSec.trim());
    });
    users.forEach((u) => {
      if (u.role === 'student' && u.classSec) {
        classSet.add(u.classSec.trim());
      }
    });
    return Array.from(classSet);
  }, [grades, users]);

  // Determine initial class selection: if teacher has an assigned class, select it; otherwise "Class 10-A"
  const defaultClass = useMemo(() => {
    if (currentUser.role === 'teacher' && currentUser.classSec && availableClasses.includes(currentUser.classSec)) {
      return currentUser.classSec;
    }
    if (currentUser.role === 'student' && currentUser.classSec) {
      return currentUser.classSec;
    }
    return 'Class 10-A';
  }, [currentUser, availableClasses]);

  const buildDefaultScores = (subjectList: AcademicSubject[]): Record<string, number> => {
    const map: Record<string, number> = {};
    subjectList.forEach((s) => {
      map[s.id] = Math.round((s.maxMarks || 100) * 0.8);
    });
    return map;
  };

  const [selectedClass, setSelectedClass] = useState<string>(defaultClass);
  const [selectedTerm, setSelectedTerm] = useState(isStudent ? 'ALL' : (examTerms[0]?.id || 'term-half'));
  const [searchQuery, setSearchQuery] = useState('');
  const [editingGrade, setEditingGrade] = useState<StudentGrade | null>(null);
  const [reportCardStudent, setReportCardStudent] = useState<StudentGrade | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isClassPrintOpen, setIsClassPrintOpen] = useState(false);
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [quickScores, setQuickScores] = useState<Record<string, Record<string, number>>>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  // Subject Manager Modal State (Admin & Teacher only)
  const [isSubjectModalOpen, setIsSubjectModalOpen] = useState(false);
  const [subjectsDraft, setSubjectsDraft] = useState<AcademicSubject[]>(subjects);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectMax, setNewSubjectMax] = useState(100);
  const [newSubjectPass, setNewSubjectPass] = useState(40);
  const [subjectFormError, setSubjectFormError] = useState<string | null>(null);
  const [isSavingSubjects, setIsSavingSubjects] = useState(false);

  // Exam Term Manager Modal State (Admin & Teacher only)
  const [isTermModalOpen, setIsTermModalOpen] = useState(false);
  const [termsDraft, setTermsDraft] = useState<ExamTerm[]>(examTerms);
  const [newTermName, setNewTermName] = useState('');
  const [newTermYear, setNewTermYear] = useState('2026-27');
  const [newTermStatus, setNewTermStatus] = useState<ExamTerm['status']>('active');
  const [termFormError, setTermFormError] = useState<string | null>(null);
  const [isSavingTerms, setIsSavingTerms] = useState(false);

  // Form State for Adding New Marksheet
  interface RecordSubjectEntry {
    id: string;
    name: string;
    maxMarks: number;
    passMarks: number;
    score: number;
  }
  const buildRecordSubjectEntries = (subjectList: AcademicSubject[]): RecordSubjectEntry[] =>
    subjectList.map((s) => ({
      id: s.id,
      name: s.name,
      maxMarks: s.maxMarks || 100,
      passMarks: s.passMarks || Math.round((s.maxMarks || 100) * 0.4),
      score: Math.round((s.maxMarks || 100) * 0.8),
    }));

  const [newStudentId, setNewStudentId] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newRollNo, setNewRollNo] = useState('');
  const [newClassSec, setNewClassSec] = useState(selectedClass === 'ALL' ? 'Class 10-A' : selectedClass);
  const [newExamTermId, setNewExamTermId] = useState(examTerms[0]?.id || 'term-half');
  const [newScores, setNewScores] = useState<Record<string, number>>(() => buildDefaultScores(subjects));
  const [recordSubjectEntries, setRecordSubjectEntries] = useState<RecordSubjectEntry[]>(() =>
    buildRecordSubjectEntries(subjects)
  );
  const [recNewSubName, setRecNewSubName] = useState('');
  const [recNewSubMax, setRecNewSubMax] = useState(100);
  const [recNewSubScore, setRecNewSubScore] = useState(80);
  const [recAlsoSaveToGradebook, setRecAlsoSaveToGradebook] = useState(false);
  const [newRemarks, setNewRemarks] = useState('Satisfactory performance with consistent exam effort.');
  const [formError, setFormError] = useState<string | null>(null);

  // Filtered grades based on role, class, and search
  const displayedGrades = useMemo(() => {
    return grades.filter((g) => {
      // If student, strictly restrict to their own marksheet records only
      if (isStudent) {
        if (!isStudentOwnedGrade(g)) return false;
        if (selectedTerm && selectedTerm !== 'ALL' && g.examTermId && g.examTermId !== selectedTerm) {
          return false;
        }
        return true;
      }

      // Class filter for faculty & admin
      if (selectedClass !== 'ALL' && g.classSec !== selectedClass) {
        return false;
      }

      // Exam term filter
      if (selectedTerm && selectedTerm !== 'ALL' && g.examTermId && g.examTermId !== selectedTerm) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesQuery =
          g.studentName.toLowerCase().includes(query) ||
          g.rollNo.toLowerCase().includes(query) ||
          g.classSec.toLowerCase().includes(query);
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [grades, currentUser, isStudent, selectedClass, selectedTerm, searchQuery]);

  // Helper to resolve subject metadata (name, maxMarks, passMarks) with per-marksheet override support
  const getSubjectMeta = (
    subKey: string,
    gradeObj?: { subjectMeta?: Record<string, { name: string; maxMarks: number; passMarks: number }> } | null
  ): { name: string; maxMarks: number; passMarks: number } => {
    const customOverride = gradeObj?.subjectMeta?.[subKey];
    if (customOverride) {
      return {
        name: customOverride.name,
        maxMarks: customOverride.maxMarks || 100,
        passMarks: customOverride.passMarks || Math.round((customOverride.maxMarks || 100) * 0.4),
      };
    }
    const preset = subjects.find((s) => s.id === subKey);
    if (preset) {
      return {
        name: preset.name,
        maxMarks: preset.maxMarks || 100,
        passMarks: preset.passMarks || 40,
      };
    }
    const legacyMap: Record<string, string> = {
      sub_math: 'Mathematics',
      sub_eng: 'English Literature',
      sub_sci: 'General Science',
      sub_soc: 'Social Studies',
      sub_san: 'Sanskrit & Values',
      sub_yoga: 'Yoga & Wellness',
    };
    const name =
      legacyMap[subKey] ||
      subKey
        .replace(/^sub-custom-/, '')
        .replace(/^sub[-_]/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return { name, maxMarks: 100, passMarks: 40 };
  };

  const getSubjectDisplayName = (subKey: string, gradeObj?: StudentGrade | null): string =>
    getSubjectMeta(subKey, gradeObj).name;

  const getTermDisplayName = (termId?: string): string => {
    if (!termId || termId === 'ALL') return 'All Exam Terms';
    return examTerms.find((t) => t.id === termId)?.name || termId;
  };

  // Student personal summary derived from their active marksheet
  const studentPrimaryGrade = isStudent ? displayedGrades[0] || null : null;
  const studentTopSubject = useMemo(() => {
    if (!studentPrimaryGrade || !studentPrimaryGrade.scores) return null;
    const entries = Object.entries(studentPrimaryGrade.scores).map(([subKey, val]) => {
      const meta = getSubjectMeta(subKey, studentPrimaryGrade);
      const score = Number(val || 0);
      const pct = meta.maxMarks > 0 ? (score / meta.maxMarks) * 100 : 0;
      return { name: meta.name, score, maxMarks: meta.maxMarks, pct };
    });
    if (entries.length === 0) return null;
    const sorted = [...entries].sort((a, b) => b.pct - a.pct);
    return sorted[0];
  }, [studentPrimaryGrade, subjects]);

  // Performance calculations respecting each subject's maxMarks (global or per-marksheet override)
  const calculateDerived = (
    scores: Record<string, number>,
    subjectMetaOverride?: Record<string, { name: string; maxMarks: number; passMarks: number }>
  ) => {
    const entries = Object.entries(scores);
    const total = entries.reduce((a, [, b]) => a + Number(b || 0), 0);
    const max =
      entries.length > 0
        ? entries.reduce(
            (a, [subKey]) => a + getSubjectMeta(subKey, { subjectMeta: subjectMetaOverride }).maxMarks,
            0
          )
        : 100;
    const safeMax = Math.max(max, 1);
    const percentage = Number(((total / safeMax) * 100).toFixed(2));
    const gpa = Number(((percentage / 100) * 10).toFixed(1));

    let grade: 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (percentage >= 90) grade = 'A+';
    else if (percentage >= 80) grade = 'A';
    else if (percentage >= 70) grade = 'B+';
    else if (percentage >= 60) grade = 'B';
    else if (percentage >= 50) grade = 'C';
    else if (percentage >= 40) grade = 'D';

    const status: 'pass' | 'fail' = percentage >= 40 ? 'pass' : 'fail';
    return { total, max: safeMax, percentage, gpa, grade, status };
  };

  // Class analytics for selected class
  const classAnalytics = useMemo(() => {
    if (displayedGrades.length === 0) {
      return {
        avgPercentage: 0,
        passRate: 0,
        passedCount: 0,
        failedCount: 0,
        topper: null,
        subjectAverages: subjects.map((s) => ({ name: s.name, id: s.id, avg: 0 })),
      };
    }

    const totalPct = displayedGrades.reduce((sum, g) => sum + g.percentage, 0);
    const avgPercentage = Number((totalPct / displayedGrades.length).toFixed(1));
    const passed = displayedGrades.filter((g) => g.status === 'pass');
    const passRate = Number(((passed.length / displayedGrades.length) * 100).toFixed(0));

    // Sort to find topper
    const sorted = [...displayedGrades].sort((a, b) => b.totalMarks - a.totalMarks);
    const topper = sorted[0];

    const subjectAverages = subjects.map((sub) => {
      const subTotal = displayedGrades.reduce((sum, g) => sum + (g.scores[sub.id] || 0), 0);
      const avg = Number((subTotal / displayedGrades.length).toFixed(1));
      return { name: sub.name, id: sub.id, avg };
    });

    return {
      avgPercentage,
      passRate,
      passedCount: passed.length,
      failedCount: displayedGrades.length - passed.length,
      topper,
      subjectAverages,
    };
  }, [displayedGrades, subjects]);

  // Handle score change in single edit modal
  const handleScoreChange = (subId: string, val: number) => {
    if (!editingGrade) return;
    const maxAllowed = getSubjectMeta(subId, editingGrade).maxMarks;
    const scoreVal = Math.min(maxAllowed, Math.max(0, val));
    const newScoresObj = { ...editingGrade.scores, [subId]: scoreVal };
    const derived = calculateDerived(newScoresObj, editingGrade.subjectMeta);
    setEditingGrade({
      ...editingGrade,
      scores: newScoresObj,
      totalMarks: derived.total,
      maxPossible: derived.max,
      percentage: derived.percentage,
      gpa: derived.gpa,
      grade: derived.grade,
      status: derived.status,
    });
  };

  // Edit subject name / maximum marks directly on an existing subject in the marksheet editor
  const handleEditingSubjectMetaChange = (
    subKey: string,
    updates: Partial<{ name: string; maxMarks: number; passMarks: number }>
  ) => {
    if (!editingGrade) return;
    const currentMeta = getSubjectMeta(subKey, editingGrade);
    const nextMax =
      updates.maxMarks !== undefined
        ? Math.max(10, Math.min(500, Number(updates.maxMarks) || 100))
        : currentMeta.maxMarks;
    const nextName = updates.name !== undefined ? updates.name : currentMeta.name;
    const nextPass =
      updates.passMarks !== undefined
        ? Math.max(1, Math.min(nextMax, Number(updates.passMarks) || 40))
        : Math.max(1, Math.min(nextMax, Math.round(nextMax * 0.4)));

    const nextSubjectMeta = {
      ...(editingGrade.subjectMeta || {}),
      [subKey]: {
        name: nextName,
        maxMarks: nextMax,
        passMarks: nextPass,
      },
    };

    const currentScore = Number(editingGrade.scores[subKey] || 0);
    const clampedScore = Math.min(nextMax, Math.max(0, currentScore));
    const nextScores = { ...editingGrade.scores, [subKey]: clampedScore };
    const derived = calculateDerived(nextScores, nextSubjectMeta);

    setEditingGrade({
      ...editingGrade,
      scores: nextScores,
      subjectMeta: nextSubjectMeta,
      totalMarks: derived.total,
      maxPossible: derived.max,
      percentage: derived.percentage,
      gpa: derived.gpa,
      grade: derived.grade,
      status: derived.status,
    });
  };

  const [newSubName, setNewSubName] = useState('');
  const [newSubMax, setNewSubMax] = useState(100);
  const [newSubScore, setNewSubScore] = useState(80);
  const [editAlsoSaveToGradebook, setEditAlsoSaveToGradebook] = useState(false);

  const handleAddSubjectToEditingGrade = async () => {
    if (!editingGrade || !newSubName.trim()) return;
    const trimmed = newSubName.trim();
    const maxVal = Math.max(10, Math.min(500, Number(newSubMax) || 100));
    const passVal = Math.max(1, Math.min(maxVal, Math.round(maxVal * 0.4)));
    const clampedScore = Math.min(maxVal, Math.max(0, Number(newSubScore) || 0));

    const existingGlobal = subjects.find(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18);
    let subKey = existingGlobal ? existingGlobal.id : `sub-custom-${slug || 'subject'}`;
    if (subKey in editingGrade.scores) {
      subKey = `${subKey}-${Date.now().toString(36).slice(-3)}`;
    }

    const nextSubjectMeta = {
      ...(editingGrade.subjectMeta || {}),
      [subKey]: {
        name: trimmed,
        maxMarks: maxVal,
        passMarks: passVal,
      },
    };
    const newScoresObj = { ...editingGrade.scores, [subKey]: clampedScore };
    const derived = calculateDerived(newScoresObj, nextSubjectMeta);
    setEditingGrade({
      ...editingGrade,
      scores: newScoresObj,
      subjectMeta: nextSubjectMeta,
      totalMarks: derived.total,
      maxPossible: derived.max,
      percentage: derived.percentage,
      gpa: derived.gpa,
      grade: derived.grade,
      status: derived.status,
    });

    if (editAlsoSaveToGradebook && onSaveSubjects && !existingGlobal) {
      const newGlobalSubject: AcademicSubject = {
        id: subKey,
        name: trimmed,
        code: `${trimmed.slice(0, 4).toUpperCase()}-101`,
        maxMarks: maxVal,
        passMarks: passVal,
      };
      await onSaveSubjects([...subjects, newGlobalSubject]);
      setSyncNotice(`✅ Added "${trimmed}" (Max ${maxVal}) to Gradebook & this marksheet.`);
      setTimeout(() => setSyncNotice(null), 3500);
    }

    setNewSubName('');
    setNewSubMax(100);
    setNewSubScore(80);
  };

  const handleRemoveSubjectFromEditingGrade = (subKey: string) => {
    if (!editingGrade) return;
    const newScoresObj = { ...editingGrade.scores };
    delete newScoresObj[subKey];
    const nextSubjectMeta = editingGrade.subjectMeta ? { ...editingGrade.subjectMeta } : undefined;
    if (nextSubjectMeta) {
      delete nextSubjectMeta[subKey];
    }
    const derived = calculateDerived(newScoresObj, nextSubjectMeta);
    setEditingGrade({
      ...editingGrade,
      scores: newScoresObj,
      subjectMeta: nextSubjectMeta,
      totalMarks: derived.total,
      maxPossible: derived.max,
      percentage: derived.percentage,
      gpa: derived.gpa,
      grade: derived.grade,
      status: derived.status,
    });
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGrade) return;

    const cleanMeta: Record<string, { name: string; maxMarks: number; passMarks: number }> = {};
    if (editingGrade.subjectMeta) {
      Object.entries(editingGrade.subjectMeta).forEach(([k, v]) => {
        if (k in editingGrade.scores && v.name.trim()) {
          cleanMeta[k] = {
            name: v.name.trim(),
            maxMarks: Math.max(10, Math.min(500, v.maxMarks || 100)),
            passMarks: Math.max(1, Math.min(v.maxMarks || 100, v.passMarks || 40)),
          };
        }
      });
    }

    const derived = calculateDerived(editingGrade.scores, cleanMeta);
    const payload: StudentGrade = {
      ...editingGrade,
      subjectMeta: cleanMeta,
      totalMarks: derived.total,
      maxPossible: derived.max,
      percentage: derived.percentage,
      gpa: derived.gpa,
      grade: derived.grade,
      status: derived.status,
      lastUpdated: new Date().toISOString(),
    };
    if (Object.keys(cleanMeta).length === 0 && !editingGrade.subjectMeta) {
      delete payload.subjectMeta;
    }

    await onUpdateGrade(payload);
    setEditingGrade(null);
    setSyncNotice(`✅ Marksheet updated and synchronized to Firestore DB`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  // Handle student selection when adding new grade
  const handleSelectStudentForNewGrade = (studentId: string) => {
    setNewStudentId(studentId);
    const student = users.find((u) => u.id === studentId);
    if (student) {
      setNewStudentName(student.fullName);
      setNewRollNo(student.rollNo || '');
      if (student.classSec) {
        setNewClassSec(student.classSec);
      }
    }
  };

  // Subject & Exam Term Management Handlers (Admin & Teacher Only)
  const handleOpenSubjectManager = () => {
    if (!isTeacherOrAdmin) return;
    setSubjectsDraft(subjects.map((s) => ({ ...s })));
    setNewSubjectName('');
    setNewSubjectCode('');
    setNewSubjectMax(100);
    setNewSubjectPass(40);
    setSubjectFormError(null);
    setIsSubjectModalOpen(true);
  };

  const handleAddSubjectDraft = () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed) {
      setSubjectFormError('Enter a subject name before adding.');
      return;
    }
    if (subjectsDraft.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setSubjectFormError(`Subject "${trimmed}" already exists.`);
      return;
    }
    const maxVal = Math.max(10, Math.min(500, Number(newSubjectMax) || 100));
    const passVal = Math.max(1, Math.min(maxVal, Number(newSubjectPass) || 40));
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 14);
    const newItem: AcademicSubject = {
      id: `sub-${slug || 'custom'}-${Date.now().toString(36).slice(-4)}`,
      name: trimmed,
      code: (newSubjectCode.trim() || `${trimmed.slice(0, 4).toUpperCase()}-101`).toUpperCase(),
      maxMarks: maxVal,
      passMarks: passVal,
    };
    setSubjectsDraft((prev) => [...prev, newItem]);
    setNewSubjectName('');
    setNewSubjectCode('');
    setNewSubjectMax(100);
    setNewSubjectPass(40);
    setSubjectFormError(null);
  };

  const handleSaveSubjectsModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeacherOrAdmin || !onSaveSubjects) return;
    const valid = subjectsDraft.filter((s) => s.name.trim().length > 0);
    if (valid.length === 0) {
      setSubjectFormError('At least one institutional subject is required.');
      return;
    }
    setIsSavingSubjects(true);
    setSubjectFormError(null);
    try {
      const saved = await onSaveSubjects(valid);
      setNewScores(buildDefaultScores(saved));
      setRecordSubjectEntries(buildRecordSubjectEntries(saved));
      setIsSubjectModalOpen(false);
      setSyncNotice(`✅ Saved ${saved.length} institutional subjects and updated Gradebook totals in Cloud Firestore DB.`);
      setTimeout(() => setSyncNotice(null), 3500);
    } catch (err: any) {
      setSubjectFormError(err?.message || 'Failed to save subjects.');
    } finally {
      setIsSavingSubjects(false);
    }
  };

  const handleOpenTermManager = () => {
    if (!isTeacherOrAdmin) return;
    setTermsDraft(examTerms.map((t) => ({ ...t })));
    setNewTermName('');
    setNewTermYear('2026-27');
    setNewTermStatus('active');
    setTermFormError(null);
    setIsTermModalOpen(true);
  };

  const handleAddTermDraft = () => {
    const trimmed = newTermName.trim();
    if (!trimmed) {
      setTermFormError('Enter an exam term name before adding.');
      return;
    }
    if (termsDraft.some((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      setTermFormError(`Exam term "${trimmed}" already exists.`);
      return;
    }
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 14);
    const newItem: ExamTerm = {
      id: `term-${slug || 'exam'}-${Date.now().toString(36).slice(-4)}`,
      name: trimmed,
      academicYear: newTermYear.trim() || '2026-27',
      status: newTermStatus,
    };
    setTermsDraft((prev) => [...prev, newItem]);
    setNewTermName('');
    setTermFormError(null);
  };

  const handleSaveTermsModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isTeacherOrAdmin || !onSaveExamTerms) return;
    const valid = termsDraft.filter((t) => t.name.trim().length > 0);
    if (valid.length === 0) {
      setTermFormError('At least one exam term is required.');
      return;
    }
    setIsSavingTerms(true);
    setTermFormError(null);
    try {
      const saved = await onSaveExamTerms(valid);
      if (selectedTerm !== 'ALL' && !saved.some((t) => t.id === selectedTerm)) {
        setSelectedTerm(saved[0]?.id || 'ALL');
      }
      if (!saved.some((t) => t.id === newExamTermId)) {
        setNewExamTermId(saved[0]?.id || 'term-half');
      }
      setIsTermModalOpen(false);
      setSyncNotice(`✅ Saved ${saved.length} exam terms to Cloud Firestore DB.`);
      setTimeout(() => setSyncNotice(null), 3500);
    } catch (err: any) {
      setTermFormError(err?.message || 'Failed to save exam terms.');
    } finally {
      setIsSavingTerms(false);
    }
  };

  const handleAddSubjectToRecordModal = async () => {
    const trimmed = recNewSubName.trim();
    if (!trimmed) {
      setFormError('Enter a subject name before adding.');
      return;
    }
    const maxVal = Math.max(10, Math.min(500, Number(recNewSubMax) || 100));
    const passVal = Math.max(1, Math.min(maxVal, Math.round(maxVal * 0.4)));
    const clampedScore = Math.min(maxVal, Math.max(0, Number(recNewSubScore) || 0));

    const existingGlobal = subjects.find(
      (s) => s.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 18);
    let subId = existingGlobal ? existingGlobal.id : `sub-custom-${slug || 'subject'}`;
    if (recordSubjectEntries.some((entry) => entry.id === subId)) {
      subId = `${subId}-${Date.now().toString(36).slice(-3)}`;
    }

    setRecordSubjectEntries((prev) => [
      ...prev,
      {
        id: subId,
        name: trimmed,
        maxMarks: maxVal,
        passMarks: passVal,
        score: clampedScore,
      },
    ]);

    if (recAlsoSaveToGradebook && onSaveSubjects && !existingGlobal) {
      const newGlobalSubject: AcademicSubject = {
        id: subId,
        name: trimmed,
        code: `${trimmed.slice(0, 4).toUpperCase()}-101`,
        maxMarks: maxVal,
        passMarks: passVal,
      };
      await onSaveSubjects([...subjects, newGlobalSubject]);
      setSyncNotice(`✅ Added "${trimmed}" (Max ${maxVal}) to Gradebook Subject List.`);
      setTimeout(() => setSyncNotice(null), 3500);
    }

    setRecNewSubName('');
    setRecNewSubMax(100);
    setRecNewSubScore(80);
    setFormError(null);
  };

  // Submit New Marksheet
  const handleCreateNewGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!newStudentName.trim() || !newRollNo.trim()) {
      setFormError('Please provide both Student Name and Roll Number.');
      return;
    }

    if (recordSubjectEntries.length === 0) {
      setFormError('At least one subject is required on the marksheet.');
      return;
    }

    const invalidSubject = recordSubjectEntries.find((s) => !s.name.trim());
    if (invalidSubject) {
      setFormError('Every subject on the marksheet must have a valid name.');
      return;
    }

    const builtScores: Record<string, number> = {};
    const builtMeta: Record<string, { name: string; maxMarks: number; passMarks: number }> = {};

    recordSubjectEntries.forEach((entry) => {
      const maxVal = Math.max(10, Math.min(500, entry.maxMarks || 100));
      const clampedScore = Math.min(maxVal, Math.max(0, Number(entry.score || 0)));
      builtScores[entry.id] = clampedScore;

      const globalMatch = subjects.find((s) => s.id === entry.id);
      if (
        !globalMatch ||
        globalMatch.name.trim() !== entry.name.trim() ||
        globalMatch.maxMarks !== maxVal
      ) {
        builtMeta[entry.id] = {
          name: entry.name.trim(),
          maxMarks: maxVal,
          passMarks: Math.max(1, Math.min(maxVal, entry.passMarks || Math.round(maxVal * 0.4))),
        };
      }
    });

    const activeTermId = newExamTermId || (selectedTerm !== 'ALL' ? selectedTerm : examTerms[0]?.id || 'term-half');
    const derived = calculateDerived(builtScores, builtMeta);
    const gradePayload: Omit<StudentGrade, 'id' | 'lastUpdated'> = {
      studentId: newStudentId || `u-stud-${Date.now().toString(36)}`,
      studentName: newStudentName.trim(),
      rollNo: newRollNo.trim(),
      classSec: newClassSec,
      examTermId: activeTermId,
      scores: builtScores,
      ...(Object.keys(builtMeta).length > 0 ? { subjectMeta: builtMeta } : {}),
      totalMarks: derived.total,
      maxPossible: derived.max,
      percentage: derived.percentage,
      gpa: derived.gpa,
      grade: derived.grade,
      status: derived.status,
      remarks: newRemarks,
    };

    if (onAddGrade) {
      await onAddGrade(gradePayload);
    } else {
      await onUpdateGrade({
        ...gradePayload,
        id: `grd-${Date.now()}`,
        lastUpdated: new Date().toISOString(),
      });
    }

    setIsAddModalOpen(false);
    setNewStudentName('');
    setNewRollNo('');
    setNewStudentId('');
    setSyncNotice(`✅ New marksheet for ${gradePayload.studentName} (${newClassSec}) saved to Firestore!`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  // Quick edit mode handlers
  const handleToggleQuickEdit = () => {
    if (!isQuickEditMode) {
      // populate quickScores
      const initialMap: Record<string, Record<string, number>> = {};
      displayedGrades.forEach((g) => {
        initialMap[g.id] = { ...g.scores };
      });
      setQuickScores(initialMap);
      setIsQuickEditMode(true);
    } else {
      setIsQuickEditMode(false);
    }
  };

  const handleQuickScoreChange = (gradeId: string, subId: string, val: number) => {
    const targetGrade = displayedGrades.find((g) => g.id === gradeId);
    const maxAllowed = getSubjectMeta(subId, targetGrade).maxMarks;
    const cleanVal = Math.min(maxAllowed, Math.max(0, val));
    setQuickScores((prev) => ({
      ...prev,
      [gradeId]: {
        ...(prev[gradeId] || {}),
        [subId]: cleanVal,
      },
    }));
  };

  const handleSaveAllQuickScores = async () => {
    const updatedGradesList: StudentGrade[] = displayedGrades.map((g) => {
      const studentScores = quickScores[g.id] || g.scores;
      const derived = calculateDerived(studentScores, g.subjectMeta);
      return {
        ...g,
        scores: studentScores,
        totalMarks: derived.total,
        maxPossible: derived.max,
        percentage: derived.percentage,
        gpa: derived.gpa,
        grade: derived.grade,
        status: derived.status,
        lastUpdated: new Date().toISOString(),
      };
    });

    await onBulkUpdateGrades(updatedGradesList);
    setIsQuickEditMode(false);
    setSyncNotice(`✅ All ${updatedGradesList.length} marksheet scores synchronized to Cloud Firestore DB`);
    setTimeout(() => setSyncNotice(null), 3500);
  };

  // Refresh from Firestore database
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      if (onRefreshGrades) {
        await onRefreshGrades();
      }
      setSyncNotice('🟢 Connected to Cloud Firestore • Latest class marksheets synchronized.');
    } catch {
      setSyncNotice('Cloud database cached offline mode active.');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncNotice(null), 3500);
    }
  };

  // Export CSV for the currently selected class
  const handleExportCsv = () => {
    const headers = [
      'Roll No',
      'Student Name',
      'Class & Section',
      ...subjects.map((s) => s.name),
      'Total Marks',
      'Max Marks',
      'Percentage',
      'GPA',
      'Grade',
      'Status',
      'Remarks',
    ];
    const rows = displayedGrades.map((g) => [
      `"${g.rollNo}"`,
      `"${g.studentName}"`,
      `"${g.classSec}"`,
      ...subjects.map((s) => g.scores[s.id] || 0),
      g.totalMarks,
      g.maxPossible,
      `"${g.percentage}%"`,
      g.gpa,
      `"${g.grade}"`,
      `"${g.status}"`,
      `"${(g.remarks || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const safeClassName = (isStudent ? currentUser.fullName : selectedClass).replace(/[\s-]+/g, '_');
    link.setAttribute('download', `Sri_Sathya_Sai_Anandam_${safeClassName}_Marksheet_${selectedTerm}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-amber-400/90 shadow-[0_0_15px_rgba(245,158,11,0.3)] bg-white p-1 shrink-0 flex items-center justify-center">
            <img
              src="/assets/sai_anandam_real_logo.png"
              alt="Sri Sathya Sai Anandam School Emblem"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                Sri Sathya Sai Anandam School
              </span>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Database className="w-2.5 h-2.5" />
                Firestore DB Active
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-serif font-black text-white mt-1">
              {isStudent ? 'My Official Academic Marksheet & Report Card' : 'Classwise Academic Marksheet & Evaluation Matrix'}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {isStudent
                ? 'Confidential personal academic ledger. Only your own subject marks and progress reports are accessible here.'
                : 'Zero-paper continuous comprehensive assessment portal for teachers and administrators.'}
            </p>
          </div>
        </div>

        {/* Database Sync & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={isSyncing}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
            title="Synchronize fresh marks from Cloud Firestore Database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
          </button>

          {isTeacherOrAdmin && (
            <>
              {onSaveSubjects && (
                <button
                  type="button"
                  onClick={handleOpenSubjectManager}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Add, rename, or configure institutional subjects and max marks"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Subjects</span>
                </button>
              )}

              {onSaveExamTerms && (
                <button
                  type="button"
                  onClick={handleOpenTermManager}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Add, rename, or update exam terms"
                >
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Edit Exam Terms</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleToggleQuickEdit}
                className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                  isQuickEditMode
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="Toggle fast in-grid score entry for the selected class"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isQuickEditMode ? 'Exit Quick Edit' : 'Quick Grade Entry'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNewClassSec(selectedClass === 'ALL' ? 'Class 10-A' : selectedClass);
                  setNewExamTermId(selectedTerm !== 'ALL' ? selectedTerm : (examTerms[0]?.id || 'term-half'));
                  setNewScores(buildDefaultScores(subjects));
                  setRecordSubjectEntries(buildRecordSubjectEntries(subjects));
                  setRecNewSubName('');
                  setRecNewSubMax(100);
                  setRecNewSubScore(80);
                  setRecAlsoSaveToGradebook(false);
                  setFormError(null);
                  setIsAddModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-500/20"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Record Marksheet</span>
              </button>
            </>
          )}

          {displayedGrades.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title={isStudent ? 'Download my marksheet as CSV' : 'Download CSV for this class'}
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">{isStudent ? 'Export My CSV' : 'Export CSV'}</span>
            </button>
          )}

          {isStudent ? (
            displayedGrades.length > 0 && (
              <button
                type="button"
                onClick={() => setReportCardStudent(displayedGrades[0])}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-indigo-600/25"
                title="View and print your official report card"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print My Report Card</span>
              </button>
            )
          ) : (
            <button
              type="button"
              onClick={() => setIsClassPrintOpen(true)}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Print consolidated class marksheet"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Print Class</span>
            </button>
          )}
        </div>
      </div>

      {/* Sync Status Banner */}
      {syncNotice && (
        <div className="bg-emerald-950/40 border border-emerald-800/60 p-3 rounded-xl flex items-center justify-between text-xs text-emerald-300 font-medium">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{syncNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setSyncNotice(null)}
            className="text-emerald-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* CLASSWISE NAVIGATION & SELECTION BAR (Faculty/Admin) vs STUDENT PRIVACY BAR */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {isStudent ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  Personal Marksheet Only: {currentUser.fullName} ({currentUser.classSec || 'Student'} • Roll #{currentUser.rollNo || 'N/A'})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Other students&apos; marksheets are strictly private and hidden.
              </span>
            </div>
          ) : (
            /* Class Select Tabs for Faculty & Admin */
            <div>
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  Select Institutional Class / Grade:
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {isTeacherOrAdmin && (
                  <button
                    type="button"
                    onClick={() => setSelectedClass('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      selectedClass === 'ALL'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>All Classes</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/50">
                      {grades.length}
                    </span>
                  </button>
                )}

                {availableClasses.map((cls) => {
                  const count = grades.filter((g) => g.classSec === cls).length;
                  const isSelected = selectedClass === cls;
                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setSelectedClass(cls)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 border border-amber-400'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                      }`}
                    >
                      <span>{cls}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          isSelected ? 'bg-amber-900/30 text-slate-950' : 'bg-slate-950 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Term Selector & Search Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-xs text-slate-400 font-medium">Exam Term:</span>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500 cursor-pointer font-medium"
              >
                <option value="ALL">All Exam Terms</option>
                {examTerms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.academicYear})
                  </option>
                ))}
              </select>
              {isTeacherOrAdmin && onSaveExamTerms && (
                <button
                  type="button"
                  onClick={handleOpenTermManager}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-amber-300 transition cursor-pointer"
                  title="Edit Exam Terms"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Student Search (Faculty/Admin only) */}
            {!isStudent && (
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search student or roll no..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 font-sans"
                />
              </div>
            )}
          </div>
        </div>

        {/* Performance Metric Bar: Personal for Student vs Class Analytics for Faculty */}
        {isStudent ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Your Aggregate
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-emerald-400 font-mono">
                  {studentPrimaryGrade ? `${studentPrimaryGrade.percentage}%` : '--'}
                </span>
                <span className="text-[10px] text-amber-300 font-bold">
                  {studentPrimaryGrade ? `Grade ${studentPrimaryGrade.grade}` : 'Pending'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Total Marks
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-indigo-400 font-mono">
                  {studentPrimaryGrade ? `${studentPrimaryGrade.totalMarks}` : '--'}
                </span>
                <span className="text-[10px] text-slate-400">
                  {studentPrimaryGrade ? `/ ${studentPrimaryGrade.maxPossible}` : 'Not recorded'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Academic GPA
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-white font-mono">
                  {studentPrimaryGrade ? `${studentPrimaryGrade.gpa}` : '--'}
                </span>
                <span className="text-[10px] text-emerald-400 uppercase font-bold">
                  {studentPrimaryGrade ? studentPrimaryGrade.status : 'Awaiting'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Strongest Subject
              </span>
              <div className="truncate mt-0.5">
                {studentTopSubject ? (
                  <>
                    <span className="text-xs font-bold text-white truncate block">
                      {studentTopSubject.name}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {studentTopSubject.score} / {studentTopSubject.maxMarks}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">No scores yet</span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                {selectedClass === 'ALL' ? 'School Average' : `${selectedClass} Average`}
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-emerald-400 font-mono">
                  {classAnalytics.avgPercentage}%
                </span>
                <span className="text-[10px] text-slate-500">Overall</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Pass Rate
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-indigo-400 font-mono">
                  {classAnalytics.passRate}%
                </span>
                <span className="text-[10px] text-slate-400">
                  ({classAnalytics.passedCount} Pass / {classAnalytics.failedCount} Needs Help)
                </span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Class Strength
              </span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-xl font-bold text-white font-mono">
                  {displayedGrades.length}
                </span>
                <span className="text-[10px] text-slate-500">Enrolled Marks</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <Award className="w-3 h-3" />
                Class Topper
              </span>
              <div className="truncate mt-0.5">
                {classAnalytics.topper ? (
                  <>
                    <span className="text-xs font-bold text-white truncate block">
                      {classAnalytics.topper.studentName}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {classAnalytics.topper.totalMarks}/{classAnalytics.topper.maxPossible} ({classAnalytics.topper.percentage}%) • GPA {classAnalytics.topper.gpa}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">No records</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Edit Mode Floating Save Bar */}
      {isQuickEditMode && (
        <div className="p-3.5 bg-amber-500/15 border border-amber-500/40 rounded-xl flex items-center justify-between text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Quick Grade Entry Active:</strong> You can edit numbers directly in the marksheet table below.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsQuickEditMode(false)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAllQuickScores}
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1 cursor-pointer shadow-md"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save All to Database</span>
            </button>
          </div>
        </div>
      )}

      {/* Marksheet Evaluation Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white uppercase tracking-wide">
              {isStudent
                ? 'My Personal Official Marksheet'
                : selectedClass === 'ALL'
                ? 'All Classes Gradebook'
                : `${selectedClass} Official Evaluation Sheet`}
            </h2>
            <span className="text-[11px] text-slate-400">
              {isStudent
                ? `(${displayedGrades.length} personal marksheet${displayedGrades.length === 1 ? '' : 's'})`
                : `(${displayedGrades.length} students listed)`}
            </span>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            {isTeacherOrAdmin && onSaveSubjects && (
              <button
                type="button"
                onClick={handleOpenSubjectManager}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-semibold flex items-center gap-1 cursor-pointer transition"
                title="Change existing Gradebook subjects, names, and maximum marks"
              >
                <SlidersHorizontal className="w-3 h-3" />
                <span>Edit Subjects &amp; Max Marks</span>
              </button>
            )}
            <div>
              Term:{' '}
              <strong className="text-white">
                {getTermDisplayName(selectedTerm)}
              </strong>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans text-slate-300">
            <thead className="bg-slate-950 border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Roll #</th>
                <th className="py-3 px-4">Student Name & Class</th>
                {subjects.map((sub) => (
                  <th key={sub.id} className="py-3 px-2.5 text-center">
                    {isTeacherOrAdmin && onSaveSubjects ? (
                      <button
                        type="button"
                        onClick={handleOpenSubjectManager}
                        className="mx-auto group text-center hover:text-amber-300 transition cursor-pointer"
                        title={`Edit "${sub.name}" or change Max Marks (${sub.maxMarks})`}
                      >
                        <span className="flex items-center justify-center gap-1 truncate max-w-[100px]">
                          <span className="truncate">{sub.name.split(' ')[0]}</span>
                          <Edit3 className="w-2.5 h-2.5 text-slate-500 group-hover:text-amber-400 shrink-0" />
                        </span>
                        <span className="block text-[9px] text-slate-500 group-hover:text-amber-300/80 font-normal">
                          Max: {sub.maxMarks}
                        </span>
                      </button>
                    ) : (
                      <>
                        <span className="block truncate max-w-[95px]" title={sub.name}>{sub.name.split(' ')[0]}</span>
                        <span className="block text-[9px] text-slate-500 font-normal">Max: {sub.maxMarks}</span>
                      </>
                    )}
                  </th>
                ))}
                <th className="py-3 px-3 text-center">Total</th>
                <th className="py-3 px-3 text-center">% Age</th>
                <th className="py-3 px-3 text-center">GPA</th>
                <th className="py-3 px-3 text-center">Grade</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {displayedGrades.length === 0 ? (
                <tr>
                  <td colSpan={subjects.length + 7} className="py-12 text-center text-slate-500">
                    <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-400">
                      {isStudent
                        ? 'No marksheet has been recorded for your profile in this term yet.'
                        : `No marksheet records found for ${selectedClass} in ${getTermDisplayName(selectedTerm)}.`}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {isStudent
                        ? 'Once your class teacher publishes your marks, your marksheet and overview metrics will update automatically.'
                        : 'Click "Record Marksheet" above to enter marks for this class.'}
                    </p>
                  </td>
                </tr>
              ) : (
                displayedGrades.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400 font-bold whitespace-nowrap">
                      {g.rollNo}
                    </td>
                    <td className="py-3 px-4">
                      {(() => {
                        const extraSubjectCount = Object.keys(g.scores || {}).filter(
                          (k) => !subjects.some((s) => s.id === k)
                        ).length;
                        return isTeacherOrAdmin ? (
                          <button
                            type="button"
                            onClick={() => setEditingGrade(g)}
                            className="text-left group cursor-pointer"
                            title="Click to edit marks & subjects for this student"
                          >
                            <div className="font-bold text-white text-sm group-hover:text-amber-400 flex items-center gap-1.5 transition">
                              <span>{g.studentName}</span>
                              <Edit3 className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition" />
                            </div>
                            <div className="text-[10px] text-amber-400/90 font-medium flex flex-wrap items-center gap-1.5">
                              <span>{g.classSec} • {getTermDisplayName(g.examTermId)} • Click to edit</span>
                              {extraSubjectCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                                  +{extraSubjectCount} custom subject{extraSubjectCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </button>
                        ) : (
                          <div>
                            <div className="font-bold text-white text-sm">{g.studentName}</div>
                            <div className="text-[10px] text-amber-400/90 font-medium flex flex-wrap items-center gap-1.5">
                              <span>{g.classSec} • {getTermDisplayName(g.examTermId)}</span>
                              {extraSubjectCount > 0 && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                                  +{extraSubjectCount} custom subject{extraSubjectCount > 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </td>

                    {subjects.map((sub) => {
                      const subMeta = getSubjectMeta(sub.id, g);
                      const currentScore = isQuickEditMode
                        ? quickScores[g.id]?.[sub.id] ?? g.scores[sub.id] ?? 0
                        : g.scores[sub.id] ?? 0;
                      const pct = subMeta.maxMarks > 0 ? (currentScore / subMeta.maxMarks) * 100 : 0;

                      if (isQuickEditMode) {
                        return (
                          <td key={sub.id} className="py-2 px-1 text-center font-mono">
                            <input
                              type="number"
                              min={0}
                              max={subMeta.maxMarks}
                              value={currentScore}
                              onChange={(e) =>
                                handleQuickScoreChange(g.id, sub.id, parseInt(e.target.value) || 0)
                              }
                              className="w-14 py-1 text-center bg-slate-950 border border-amber-500/50 rounded text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                            />
                          </td>
                        );
                      }

                      return (
                        <td key={sub.id} className="py-3 px-2.5 text-center font-mono whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-bold ${
                              pct >= 90
                                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/60'
                                : pct >= 75
                                ? 'bg-indigo-950/60 text-indigo-300'
                                : currentScore >= subMeta.passMarks
                                ? 'bg-slate-800 text-slate-300'
                                : 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                            }`}
                          >
                            {currentScore}
                          </span>
                        </td>
                      );
                    })}

                    <td className="py-3 px-3 text-center font-bold text-white whitespace-nowrap">
                      {g.totalMarks} / {g.maxPossible}
                    </td>

                    <td className="py-3 px-3 text-center font-bold text-emerald-400 whitespace-nowrap">
                      {g.percentage}%
                    </td>

                    <td className="py-3 px-3 text-center font-mono text-slate-300 whitespace-nowrap">
                      {g.gpa}
                    </td>

                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {g.grade}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setReportCardStudent(g)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
                          title="Generate Official Digital Progress Report Card"
                        >
                          <Printer className="w-3 h-3 text-indigo-400" />
                          <span>Report</span>
                        </button>

                        {isTeacherOrAdmin && (
                          <button
                            type="button"
                            onClick={() => setEditingGrade(g)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-900/60 text-slate-300 hover:text-indigo-300 transition cursor-pointer"
                            title="Edit Individual Marks"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {currentUser.role === 'admin' && onDeleteGrade && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (confirm(`Remove marksheet record for ${g.studentName} (${g.classSec})?`)) {
                                await onDeleteGrade(g.id);
                                setSyncNotice(`Removed marksheet for ${g.studentName} from Firestore.`);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                            title="Delete Marksheet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD NEW MARKSHEET MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 text-slate-100 shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-400/80 bg-white p-0.5 flex items-center justify-center">
                  <img
                    src="/assets/sai_anandam_real_logo.png"
                    alt="Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Record Student Marksheet</h2>
                  <p className="text-xs text-slate-400">Classwise Entry • Cloud Firestore Synchronized</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 bg-rose-950/50 border border-rose-800/80 p-3 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateNewGrade} className="space-y-4 text-xs">
              {/* Pick from registered students */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Quick Select from Registered Students (Optional):
                </label>
                <select
                  value={newStudentId}
                  onChange={(e) => handleSelectStudentForNewGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 cursor-pointer text-xs"
                >
                  <option value="">-- Choose a student or enter manually below --</option>
                  {users
                    .filter((u) => u.role === 'student')
                    .map((stud) => (
                      <option key={stud.id} value={stud.id}>
                        {stud.fullName} ({stud.classSec || 'No Class'} • Roll #{stud.rollNo || 'N/A'})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Student Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sai Anandam K."
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Roll Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 10A-14"
                    value={newRollNo}
                    onChange={(e) => setNewRollNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Class & Section *
                  </label>
                  <select
                    value={newClassSec}
                    onChange={(e) => setNewClassSec(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {availableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Exam Term *
                  </label>
                  <select
                    value={newExamTermId}
                    onChange={(e) => setNewExamTermId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {examTerms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.academicYear})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Editable Subject Marks & Max Marks Grid */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Subjects, Maximum Marks &amp; Obtained Scores:
                  </label>
                  <span className="text-[10px] text-amber-400/90">
                    Edit subject names or max marks directly
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {recordSubjectEntries.map((entry, idx) => (
                    <div key={entry.id} className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          required
                          value={entry.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRecordSubjectEntries((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                            );
                          }}
                          placeholder="Subject Name"
                          className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-[11px] outline-none focus:border-amber-400"
                        />
                        {recordSubjectEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setRecordSubjectEntries((prev) => prev.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer shrink-0"
                            title="Remove subject from marksheet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">
                            Max Marks
                          </span>
                          <input
                            type="number"
                            min={10}
                            max={500}
                            value={entry.maxMarks}
                            onChange={(e) => {
                              const nextMax = Math.max(10, Math.min(500, parseInt(e.target.value) || 100));
                              setRecordSubjectEntries((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? {
                                        ...item,
                                        maxMarks: nextMax,
                                        passMarks: Math.max(1, Math.min(nextMax, Math.round(nextMax * 0.4))),
                                        score: Math.min(nextMax, item.score),
                                      }
                                    : item
                                )
                              );
                            }}
                            className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono text-center outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <span className="block text-[9px] text-emerald-400 uppercase font-bold mb-0.5">
                            Score Obtained
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={entry.maxMarks}
                            value={entry.score}
                            onChange={(e) => {
                              const nextScore = Math.min(
                                entry.maxMarks,
                                Math.max(0, parseInt(e.target.value) || 0)
                              );
                              setRecordSubjectEntries((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, score: nextScore } : item))
                              );
                            }}
                            className="w-full px-2 py-1 bg-slate-900 border border-indigo-500/50 rounded-lg text-white font-mono font-bold text-center outline-none focus:border-indigo-400"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Subject inside Record Marksheet */}
                <div className="mt-3 p-3 rounded-xl bg-slate-950/90 border border-dashed border-slate-700 space-y-2">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Subject to Marksheet</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                    <div className="sm:col-span-5">
                      <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">
                        Subject Name
                      </span>
                      <input
                        type="text"
                        placeholder="e.g. Computer Science"
                        value={recNewSubName}
                        onChange={(e) => setRecNewSubName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">
                        Max Marks
                      </span>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        title="Maximum Marks"
                        placeholder="Max"
                        value={recNewSubMax}
                        onChange={(e) => {
                          const maxVal = Math.max(10, Math.min(500, parseInt(e.target.value) || 100));
                          setRecNewSubMax(maxVal);
                          setRecNewSubScore((prev) => Math.min(maxVal, prev));
                        }}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono text-center text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <span className="block text-[9px] text-emerald-400 uppercase font-bold mb-0.5">
                        Score
                      </span>
                      <input
                        type="number"
                        min={0}
                        max={recNewSubMax}
                        title="Obtained Score"
                        placeholder="Score"
                        value={recNewSubScore}
                        onChange={(e) =>
                          setRecNewSubScore(Math.min(recNewSubMax, Math.max(0, parseInt(e.target.value) || 0)))
                        }
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center text-xs outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSubjectToRecordModal}
                      disabled={!recNewSubName.trim()}
                      className="sm:col-span-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                    >
                      + Add Subject
                    </button>
                  </div>
                  {isTeacherOrAdmin && onSaveSubjects && (
                    <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={recAlsoSaveToGradebook}
                        onChange={(e) => setRecAlsoSaveToGradebook(e.target.checked)}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500"
                      />
                      <span>Also add this subject to Gradebook columns for all students</span>
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Evaluator Remarks:
                </label>
                <textarea
                  rows={2}
                  value={newRemarks}
                  onChange={(e) => setNewRemarks(e.target.value)}
                  placeholder="Comprehensive academic commentary..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              {/* Real-time Calculation Summary */}
              {(() => {
                const previewScores: Record<string, number> = {};
                const previewMeta: Record<string, { name: string; maxMarks: number; passMarks: number }> = {};
                recordSubjectEntries.forEach((entry) => {
                  previewScores[entry.id] = entry.score;
                  previewMeta[entry.id] = {
                    name: entry.name || 'Subject',
                    maxMarks: entry.maxMarks || 100,
                    passMarks: entry.passMarks || 40,
                  };
                });
                const derived = calculateDerived(previewScores, previewMeta);
                return (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-slate-400">Total: </span>
                      <strong className="text-white font-mono">{derived.total} / {derived.max}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Percentage: </span>
                      <strong className="text-emerald-400 font-mono">{derived.percentage}%</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">GPA: </span>
                      <strong className="text-indigo-400 font-mono">{derived.gpa}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400">Grade: </span>
                      <strong className="text-amber-400 font-bold">{derived.grade}</strong>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Marksheet to Firestore</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT STUDENT MARKS & SUBJECTS MODAL (CLICK-TO-EDIT, Admin & Teacher Only) */}
      {isTeacherOrAdmin && editingGrade && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Classwise Marksheet Editor
                  </span>
                  <span className="text-xs text-slate-400">{editingGrade.classSec}</span>
                </div>
                <h2 className="text-xl font-bold font-serif text-white flex items-center gap-2">
                  <span>Student: {editingGrade.studentName}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Roll No: <span className="font-mono text-amber-300 font-bold">{editingGrade.rollNo}</span> • Term: {getTermDisplayName(editingGrade.examTermId)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingGrade(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="space-y-4 text-xs">
              {/* Exam Term Assignment */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Assigned Exam Term:</span>
                </label>
                <select
                  value={editingGrade.examTermId}
                  onChange={(e) => setEditingGrade({ ...editingGrade, examTermId: e.target.value })}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs font-semibold outline-none focus:border-indigo-500 cursor-pointer"
                >
                  {examTerms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.academicYear})
                    </option>
                  ))}
                  {!examTerms.some((t) => t.id === editingGrade.examTermId) && editingGrade.examTermId && (
                    <option value={editingGrade.examTermId}>{editingGrade.examTermId}</option>
                  )}
                </select>
              </div>

              {/* Existing Subjects & Marks (Name, Max Marks, and Obtained Score Editable) */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="block text-xs font-bold text-white uppercase tracking-wider">
                    Subject Name, Maximum Marks &amp; Score:
                  </label>
                  <span className="text-[10px] text-amber-400/90">
                    Edit any subject title or max marks directly
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Object.entries(editingGrade.scores).map(([subKey, score]) => {
                    const meta = getSubjectMeta(subKey, editingGrade);
                    const totalSubjectEntries = Object.keys(editingGrade.scores).length;

                    return (
                      <div key={subKey} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            required
                            value={meta.name}
                            onChange={(e) => handleEditingSubjectMetaChange(subKey, { name: e.target.value })}
                            placeholder="Subject Name"
                            className="flex-1 min-w-0 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold text-xs outline-none focus:border-amber-400"
                          />

                          {totalSubjectEntries > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSubjectFromEditingGrade(subKey)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded transition cursor-pointer shrink-0"
                              title="Remove subject from marksheet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">
                              Max Marks
                            </span>
                            <input
                              type="number"
                              min={10}
                              max={500}
                              value={meta.maxMarks}
                              onChange={(e) =>
                                handleEditingSubjectMetaChange(subKey, {
                                  maxMarks: parseInt(e.target.value) || 100,
                                })
                              }
                              className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono text-center outline-none focus:border-amber-400"
                            />
                          </div>

                          <div>
                            <span className="block text-[9px] text-amber-400 uppercase font-bold mb-0.5">
                              Obtained
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={meta.maxMarks}
                              value={score}
                              onChange={(e) => handleScoreChange(subKey, parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1 bg-slate-900 border border-amber-500/40 rounded-lg text-white font-mono font-bold text-center outline-none focus:border-amber-400"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick-add missing institutional subjects */}
              {subjects.some((s) => !(s.id in editingGrade.scores)) && (
                <div className="p-3 rounded-xl bg-indigo-950/25 border border-indigo-800/40 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-indigo-300">Add Institutional Subject:</span>
                  {subjects
                    .filter((s) => !(s.id in editingGrade.scores))
                    .map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleScoreChange(s.id, Math.round((s.maxMarks || 100) * 0.8))}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-200 text-[11px] font-semibold cursor-pointer transition"
                      >
                        + {s.name} (Max {s.maxMarks})
                      </button>
                    ))}
                </div>
              )}

              {/* Add Custom Subject Section */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Another Subject to Marksheet</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                  <div className="sm:col-span-5">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">
                      Subject Name
                    </span>
                    <input
                      type="text"
                      placeholder="e.g. Sanskrit, Moral Science..."
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[9px] text-slate-500 uppercase font-bold mb-0.5">
                      Max Marks
                    </span>
                    <input
                      type="number"
                      min={10}
                      max={500}
                      title="Maximum Marks"
                      placeholder="Max"
                      value={newSubMax}
                      onChange={(e) => {
                        const maxVal = Math.max(10, Math.min(500, parseInt(e.target.value) || 100));
                        setNewSubMax(maxVal);
                        setNewSubScore((prev) => Math.min(maxVal, prev));
                      }}
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 font-mono text-center text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-[9px] text-emerald-400 uppercase font-bold mb-0.5">
                      Score
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={newSubMax}
                      title="Score Obtained"
                      placeholder="Score"
                      value={newSubScore}
                      onChange={(e) =>
                        setNewSubScore(Math.min(newSubMax, Math.max(0, parseInt(e.target.value) || 0)))
                      }
                      className="w-full px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-white font-mono text-center text-xs outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSubjectToEditingGrade}
                    disabled={!newSubName.trim()}
                    className="sm:col-span-3 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    + Add Subject
                  </button>
                </div>
                {onSaveSubjects && (
                  <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer pt-0.5">
                    <input
                      type="checkbox"
                      checked={editAlsoSaveToGradebook}
                      onChange={(e) => setEditAlsoSaveToGradebook(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-amber-500"
                    />
                    <span>Also add this subject to Gradebook columns for all students</span>
                  </label>
                )}
              </div>

              {/* Faculty Remarks */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Faculty Evaluation Remarks:
                </label>
                <textarea
                  rows={2}
                  value={editingGrade.remarks || ''}
                  onChange={(e) => setEditingGrade({ ...editingGrade, remarks: e.target.value })}
                  placeholder="Enter developmental observations..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-xs"
                />
              </div>

              {/* Real-time calculated preview */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Total Score</span>
                  <strong className="text-white text-sm font-mono">{editingGrade.totalMarks} / {editingGrade.maxPossible}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Percentage</span>
                  <strong className="text-emerald-400 text-sm font-mono">{editingGrade.percentage}%</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">GPA Index</span>
                  <strong className="text-indigo-400 text-sm font-mono">{editingGrade.gpa} / 10.0</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Grade & Status</span>
                  <strong className="text-amber-400 text-sm font-bold uppercase">{editingGrade.grade} ({editingGrade.status})</strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGrade(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Marksheet to Firestore</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL DIGITAL PROGRESS REPORT MODAL */}
      {reportCardStudent && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-2xl w-full p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
            {/* Header with School Crest */}
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <img
                  src="/assets/sai_anandam_real_logo.png"
                  alt="Sri Sathya Sai Anandam School"
                  className="w-16 h-16 rounded-xl border-2 border-amber-600 shadow-md object-contain bg-white p-1"
                />
                <div className="text-left">
                  <div className="text-xs font-bold tracking-widest uppercase text-amber-700">
                    Sri Sathya Sai Anandam School
                  </div>
                  <h2 className="text-2xl font-serif font-black uppercase tracking-wide">
                    Official Progress Report Card
                  </h2>
                  <div className="text-[11px] text-slate-600">
                    SDBMS v5.0 • Cryptographically Verified Institutional Record
                  </div>
                </div>
              </div>
            </div>

            {/* Student metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-100 rounded-xl mb-6 text-xs">
              <div>
                <span className="text-slate-500 block">Student Name</span>
                <strong className="text-slate-900 text-sm">{reportCardStudent.studentName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Roll Number</span>
                <strong className="text-slate-900 font-mono">{reportCardStudent.rollNo}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Class & Section</span>
                <strong className="text-slate-900">{reportCardStudent.classSec}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Academic Assessment</span>
                <strong className="text-slate-900">
                  {getTermDisplayName(reportCardStudent.examTermId)}
                </strong>
              </div>
            </div>

            {/* Table of marks */}
            <table className="w-full text-left text-xs mb-6 border border-slate-300">
              <thead className="bg-slate-200 text-slate-800 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 border-b border-slate-300">Subject</th>
                  <th className="p-2.5 border-b border-slate-300 text-center">Max Marks</th>
                  <th className="p-2.5 border-b border-slate-300 text-center">Pass Marks</th>
                  <th className="p-2.5 border-b border-slate-300 text-center">Marks Obtained</th>
                  <th className="p-2.5 border-b border-slate-300 text-center">Subject Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(reportCardStudent.scores || {}).map(([subKey, scoreVal]) => {
                  const meta = getSubjectMeta(subKey, reportCardStudent);
                  const score = Number(scoreVal || 0);
                  const pct = meta.maxMarks > 0 ? (score / meta.maxMarks) * 100 : 0;
                  const subGrade =
                    pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';
                  return (
                    <tr key={subKey}>
                      <td className="p-2.5 font-medium">{meta.name}</td>
                      <td className="p-2.5 text-center text-slate-600">{meta.maxMarks}</td>
                      <td className="p-2.5 text-center text-slate-600">{meta.passMarks}</td>
                      <td className="p-2.5 text-center font-bold text-sm font-mono">{score}</td>
                      <td className="p-2.5 text-center font-bold text-indigo-700">{subGrade}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex items-center justify-between p-4 bg-slate-900 text-white rounded-xl mb-6 text-sm">
              <div>
                <span className="text-slate-400 block text-xs">Total Marks</span>
                <span className="font-bold font-mono">
                  {reportCardStudent.totalMarks} / {reportCardStudent.maxPossible}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Percentage</span>
                <span className="font-bold text-emerald-400 font-mono">{reportCardStudent.percentage}%</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Final Grade</span>
                <span className="font-bold text-amber-400 text-base">{reportCardStudent.grade}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-xs">Result</span>
                <span className="font-bold uppercase text-emerald-400">{reportCardStudent.status}</span>
              </div>
            </div>

            {/* Remarks */}
            <div className="text-xs text-slate-700 mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <strong>Institutional Remarks:</strong> {reportCardStudent.remarks}
            </div>

            {/* Verification Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 text-[10px] text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified Cloud Firestore DB Record • Sri Sathya Sai Anandam School</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReportCardStudent(null)}
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONSOLIDATED CLASS PRINT VIEW MODAL (Faculty/Admin only) */}
      {!isStudent && isClassPrintOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-4xl w-full p-8 shadow-2xl overflow-y-auto max-h-[92vh]">
            <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex items-center justify-center gap-3 mb-2">
                <img
                  src="/assets/sai_anandam_real_logo.png"
                  alt="Sri Sathya Sai Anandam School Logo"
                  className="w-16 h-16 rounded-xl border border-amber-500 object-contain bg-white p-1"
                />
                <div>
                  <div className="text-xs font-bold tracking-widest uppercase text-amber-700">
                    Sri Sathya Sai Anandam School
                  </div>
                  <h2 className="text-2xl font-serif font-black uppercase">
                    Consolidated Class Marksheet & Rank List
                  </h2>
                  <div className="text-xs text-slate-600">
                    {selectedClass} • Term: {getTermDisplayName(selectedTerm)}
                  </div>
                </div>
              </div>
            </div>

            <table className="w-full text-left text-xs mb-6 border border-slate-300">
              <thead className="bg-slate-200 text-slate-900 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2 border border-slate-300">Rank</th>
                  <th className="p-2 border border-slate-300">Roll #</th>
                  <th className="p-2 border border-slate-300">Student Name</th>
                  {subjects.map((s) => (
                    <th key={s.id} className="p-2 border border-slate-300 text-center">
                      {s.name.split(' ')[0]}
                    </th>
                  ))}
                  <th className="p-2 border border-slate-300 text-center">Total</th>
                  <th className="p-2 border border-slate-300 text-center">%</th>
                  <th className="p-2 border border-slate-300 text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {[...displayedGrades]
                  .sort((a, b) => b.totalMarks - a.totalMarks)
                  .map((g, idx) => (
                    <tr key={g.id} className="border-b border-slate-200">
                      <td className="p-2 font-bold text-center">#{idx + 1}</td>
                      <td className="p-2 font-mono">{g.rollNo}</td>
                      <td className="p-2 font-semibold">{g.studentName}</td>
                      {subjects.map((s) => (
                        <td key={s.id} className="p-2 text-center font-mono">
                          {g.scores[s.id] || 0}
                        </td>
                      ))}
                      <td className="p-2 text-center font-bold">{g.totalMarks}</td>
                      <td className="p-2 text-center font-bold text-emerald-700">{g.percentage}%</td>
                      <td className="p-2 text-center font-bold">{g.grade}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            {/* Signature Area */}
            <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300 text-center text-xs">
              <div>
                <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
                <span className="font-semibold text-slate-700">Class Teacher Signature</span>
              </div>
              <div>
                <div className="border-b border-slate-400 w-48 mx-auto mb-2" />
                <span className="font-semibold text-slate-700">Principal / Headmaster Signature</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-6 mt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={() => setIsClassPrintOpen(false)}
                className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE INSTITUTIONAL SUBJECTS MODAL (Admin & Teacher Only) */}
      {isTeacherOrAdmin && isSubjectModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Faculty & Admin Curriculum Control
                  </span>
                </div>
                <h2 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-amber-400" />
                  <span>Edit Institutional Subjects</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure subject names, codes, maximum marks, and passing thresholds for all marksheets.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSubjectModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {subjectFormError && (
              <div className="mb-4 bg-rose-950/50 border border-rose-800/80 p-3 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{subjectFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSubjectsModal} className="space-y-4 text-xs">
              <div className="space-y-2.5">
                {subjectsDraft.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-5">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Subject Name
                      </label>
                      <input
                        type="text"
                        required
                        value={sub.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSubjectsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                          );
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Code
                      </label>
                      <input
                        type="text"
                        value={sub.code}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          setSubjectsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, code: val } : item))
                          );
                        }}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Max Marks
                      </label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={sub.maxMarks}
                        onChange={(e) => {
                          const maxVal = Math.max(10, Math.min(500, parseInt(e.target.value) || 100));
                          setSubjectsDraft((prev) =>
                            prev.map((item, i) =>
                              i === idx
                                ? { ...item, maxMarks: maxVal, passMarks: Math.min(item.passMarks, maxVal) }
                                : item
                            )
                          );
                        }}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Pass Marks
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={sub.maxMarks}
                        value={sub.passMarks}
                        onChange={(e) => {
                          const passVal = Math.max(1, Math.min(sub.maxMarks, parseInt(e.target.value) || 40));
                          setSubjectsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, passMarks: passVal } : item))
                          );
                        }}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center outline-none focus:border-amber-400"
                      />
                    </div>
                    <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-4">
                      <button
                        type="button"
                        disabled={subjectsDraft.length <= 1}
                        onClick={() => setSubjectsDraft((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 disabled:opacity-30 cursor-pointer transition"
                        title={subjectsDraft.length <= 1 ? 'At least 1 subject required' : 'Remove subject'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Subject Section */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-dashed border-slate-700 space-y-2.5">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Institutional Subject</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Subject Name (e.g. Sanskrit)"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    className="sm:col-span-5 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Code (e.g. SAN-101)"
                    value={newSubjectCode}
                    onChange={(e) => setNewSubjectCode(e.target.value.toUpperCase())}
                    className="sm:col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    min={10}
                    max={500}
                    placeholder="Max"
                    value={newSubjectMax}
                    onChange={(e) => setNewSubjectMax(parseInt(e.target.value) || 100)}
                    className="sm:col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center outline-none focus:border-indigo-500"
                  />
                  <input
                    type="number"
                    min={1}
                    max={newSubjectMax}
                    placeholder="Pass"
                    value={newSubjectPass}
                    onChange={(e) => setNewSubjectPass(parseInt(e.target.value) || 40)}
                    className="sm:col-span-1 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-center outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubjectDraft}
                    className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer transition"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSubjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSubjects}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-lg shadow-amber-500/25 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSubjects ? 'Saving...' : 'Save Subjects to Firestore'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE EXAM TERMS MODAL (Admin & Teacher Only) */}
      {isTeacherOrAdmin && isTermModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Faculty & Admin Exam Term Control
                  </span>
                </div>
                <h2 className="text-lg font-bold font-serif text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  <span>Manage Exam Terms</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Create, rename, or update academic examination terms and publication status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsTermModalOpen(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {termFormError && (
              <div className="mb-4 bg-rose-950/50 border border-rose-800/80 p-3 rounded-xl flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{termFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveTermsModal} className="space-y-4 text-xs">
              <div className="space-y-2.5">
                {termsDraft.map((term, idx) => (
                  <div
                    key={term.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center"
                  >
                    <div className="sm:col-span-6">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Exam Term Name
                      </label>
                      <input
                        type="text"
                        required
                        value={term.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTermsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, name: val } : item))
                          );
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white font-semibold outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Session
                      </label>
                      <input
                        type="text"
                        value={term.academicYear}
                        onChange={(e) => {
                          const val = e.target.value;
                          setTermsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, academicYear: val } : item))
                          );
                        }}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] text-slate-500 uppercase font-bold mb-1">
                        Status
                      </label>
                      <select
                        value={term.status}
                        onChange={(e) => {
                          const val = e.target.value as ExamTerm['status'];
                          setTermsDraft((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, status: val } : item))
                          );
                        }}
                        className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-indigo-400 cursor-pointer"
                      >
                        <option value="active">Active</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                    <div className="sm:col-span-1 flex justify-end pt-4 sm:pt-4">
                      <button
                        type="button"
                        disabled={termsDraft.length <= 1}
                        onClick={() => setTermsDraft((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-800 disabled:opacity-30 cursor-pointer transition"
                        title={termsDraft.length <= 1 ? 'At least 1 exam term required' : 'Remove exam term'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Exam Term Section */}
              <div className="p-3.5 rounded-xl bg-slate-950/80 border border-dashed border-slate-700 space-y-2.5">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Exam Term</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Exam Term Name (e.g. Unit Test 1)"
                    value={newTermName}
                    onChange={(e) => setNewTermName(e.target.value)}
                    className="sm:col-span-6 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="2026-27"
                    value={newTermYear}
                    onChange={(e) => setNewTermYear(e.target.value)}
                    className="sm:col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 font-mono outline-none focus:border-indigo-500"
                  />
                  <select
                    value={newTermStatus}
                    onChange={(e) => setNewTermStatus(e.target.value as ExamTerm['status'])}
                    className="sm:col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="completed">Completed</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddTermDraft}
                    className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer transition"
                  >
                    + Add Term
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTermModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTerms}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingTerms ? 'Saving...' : 'Save Exam Terms to Firestore'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
