import React, { useState } from 'react';
import {
  Users,
  GraduationCap,
  CreditCard,
  ShieldCheck,
  TrendingUp,
  Award,
  AlertTriangle,
  FileText,
  Clock,
  ArrowUpRight,
  Sparkles,
  CheckCircle2,
  Calendar,
  Lock,
  Medal,
  Crown,
  Trophy,
  Edit2,
  Plus,
  X,
  Check,
  CalendarCheck,
  BookOpen,
} from 'lucide-react';
import {
  User,
  StudentGrade,
  FeeTransaction,
  Announcement,
  AuditLog,
  NavigationTab,
  ALL_INSTITUTIONAL_CLASSES,
  AcademicSubject,
  ExamTerm,
  AttendanceRecord,
  Assessment,
  Lecture,
} from '../types';
import { INITIAL_EXAM_TERMS, INITIAL_SUBJECTS } from '../data/sdbmsInitialData';

interface DashboardViewProps {
  currentUser: User;
  onNavigate: (tab: NavigationTab) => void;
  grades: StudentGrade[];
  transactions: FeeTransaction[];
  announcements: Announcement[];
  auditLogs: AuditLog[];
  users?: User[];
  subjects?: AcademicSubject[];
  examTerms?: ExamTerm[];
  attendanceRecords?: AttendanceRecord[];
  assessments?: Assessment[];
  lectures?: Lecture[];
  onUpdateStudentBadges?: (studentId: string, badges: string[]) => Promise<void>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onNavigate,
  grades,
  transactions,
  announcements,
  auditLogs,
  users = [],
  subjects = INITIAL_SUBJECTS,
  examTerms = INITIAL_EXAM_TERMS,
  attendanceRecords = [],
  assessments = [],
  lectures = [],
  onUpdateStudentBadges,
}) => {
  const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';
  const isStudent = currentUser.role === 'student';

  // State for Class Rank Board
  const studentEnrolledClass = currentUser.classSec || 'Class 8-A';
  const defaultClass = isStudent ? studentEnrolledClass : (currentUser.classSec || 'Class 8-A');
  const [selectedClass, setSelectedClass] = useState<string>(defaultClass);

  // Active class: students are strictly locked to their enrolled class
  const activeClass = isStudent ? studentEnrolledClass : selectedClass;

  // State for Teacher Editing Badges Modal
  const [editingStudent, setEditingStudent] = useState<{ id: string; fullName: string; rollNo?: string; classSec?: string; badges?: string[] } | null>(null);
  const [activeBadges, setActiveBadges] = useState<string[]>([]);
  const [customBadgeInput, setCustomBadgeInput] = useState('');
  const [isSavingBadge, setIsSavingBadge] = useState(false);
  const [badgeSuccessMessage, setBadgeSuccessMessage] = useState<string | null>(null);

  const presetBadges = [
    '🌟 Math Star',
    '🏆 Prasanthi Scholar',
    '🏅 Dharma Star',
    '💎 100% Attendance',
    '🔬 Science Whiz',
    '🎨 Creative Genius',
    '⚡ Speed Solver',
    '🚀 AI Pioneer',
    '📖 Literature Laureate',
    '🌱 Eco Champion',
  ];

  const [selectedOverviewGradeId, setSelectedOverviewGradeId] = useState<string>('');

  // Real Aggregate Metrics (from live Gradebook, Attendance, Fee Ledger, Assessments & Lectures)
  const totalCollections = transactions.reduce((acc, t) => acc + t.amount, 0);
  const verifiedTxCount = transactions.filter((t) => t.status === 'verified').length;
  const pendingTxCount = transactions.filter((t) => t.status !== 'verified').length;

  const avgPercentage = grades.length
    ? (grades.reduce((acc, g) => acc + g.percentage, 0) / grades.length).toFixed(1)
    : '0.0';
  const avgGpa = grades.length
    ? (grades.reduce((acc, g) => acc + g.gpa, 0) / grades.length).toFixed(1)
    : '0.0';
  const passedGradesCount = grades.filter((g) => g.status === 'pass').length;
  const distinctGradeClassesCount = new Set(grades.map((g) => g.classSec).filter(Boolean)).size;
  const activeExamTerm = examTerms.find((t) => t.status === 'active') || examTerms[0];

  const campusAttendanceStats = React.useMemo(() => {
    let totalEntries = 0;
    let presentEntries = 0;
    attendanceRecords.forEach((rec) => {
      rec.records.forEach((entry) => {
        totalEntries += 1;
        if (entry.status === 'present' || entry.status === 'late') {
          presentEntries += 1;
        }
      });
    });
    const rate = totalEntries > 0 ? ((presentEntries / totalEntries) * 100).toFixed(1) : null;
    const latestDate = attendanceRecords[0]?.date || null;
    return {
      totalEntries,
      presentEntries,
      absentEntries: totalEntries - presentEntries,
      rate,
      latestDate,
      registerCount: attendanceRecords.length,
    };
  }, [attendanceRecords]);

  const myAttendanceStats = React.useMemo(() => {
    if (!isStudent) return { total: 0, present: 0, absent: 0, rate: null as number | null };
    let total = 0;
    let present = 0;
    let absent = 0;
    attendanceRecords.forEach((rec) => {
      const entry = rec.records.find(
        (r) =>
          r.studentId === currentUser.id ||
          (Boolean(currentUser.rollNo) &&
            Boolean(r.rollNo) &&
            r.rollNo.trim().toLowerCase() === currentUser.rollNo!.trim().toLowerCase()) ||
          r.studentName.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase()
      );
      if (entry) {
        total += 1;
        if (entry.status === 'present' || entry.status === 'late') present += 1;
        else if (entry.status === 'absent') absent += 1;
      }
    });
    return {
      total,
      present,
      absent,
      rate: total > 0 ? Math.round((present / total) * 100) : null,
    };
  }, [attendanceRecords, currentUser, isStudent]);

  const myAcademicExtras = React.useMemo(() => {
    if (!isStudent) return null;
    const classAssessments = assessments.filter(
      (a) => a.status !== 'draft' && (!a.classSec || a.classSec === studentEnrolledClass)
    );
    const submittedList = classAssessments
      .map((a) => ({
        assessment: a,
        submission: a.submissions.find(
          (s) =>
            s.studentId === currentUser.id ||
            (Boolean(currentUser.rollNo && s.rollNo) &&
              s.rollNo!.trim().toLowerCase() === currentUser.rollNo!.trim().toLowerCase()) ||
            s.studentName.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase()
        ),
      }))
      .filter((x) => Boolean(x.submission));
    const gradedList = submittedList.filter(
      (x) => x.submission?.status === 'graded' && typeof x.submission.score === 'number'
    );

    const classLectures = lectures.filter(
      (l) => l.status !== 'draft' && (!l.classSec || l.classSec === studentEnrolledClass)
    );
    const completedLectures = classLectures.filter((l) => l.completedBy?.includes(currentUser.id)).length;

    const myTx = transactions.filter(
      (t) =>
        t.studentId === currentUser.id ||
        t.studentName.trim().toLowerCase() === currentUser.fullName.trim().toLowerCase()
    );
    const verifiedPaid = myTx.filter((t) => t.status === 'verified').reduce((s, t) => s + t.amount, 0);
    const pendingFeeCount = myTx.filter((t) => t.status !== 'verified').length;

    return {
      totalAssessments: classAssessments.length,
      submittedCount: submittedList.length,
      gradedCount: gradedList.length,
      totalLectures: classLectures.length,
      completedLectures,
      verifiedPaid,
      receiptCount: myTx.length,
      pendingFeeCount,
    };
  }, [assessments, lectures, transactions, currentUser, isStudent, studentEnrolledClass]);

  const isGradeOwnedByStudent = (g: StudentGrade, student: { id: string; rollNo?: string; fullName?: string }) =>
    g.studentId === student.id ||
    (Boolean(student.rollNo) &&
      Boolean(g.rollNo) &&
      g.rollNo.trim().toLowerCase() === student.rollNo!.trim().toLowerCase()) ||
    (Boolean(student.fullName) &&
      g.studentName.trim().toLowerCase() === student.fullName!.trim().toLowerCase());

  const getTermName = (termId?: string) => {
    if (!termId) return 'Academic Assessment';
    const found = examTerms.find((t) => t.id === termId);
    if (found) return found.name;
    if (termId === 'term-mid-2026') return 'Mid-Term / Half-Yearly (2026)';
    return termId.replace(/^term-/, '').toUpperCase();
  };

  const getSubjectMeta = (subKey: string) => {
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

  // All marksheets belonging strictly to the currently logged-in student (sorted newest first, active term prioritized)
  const myGradesList: StudentGrade[] = isStudent
    ? [...grades]
        .filter((g) => isGradeOwnedByStudent(g, currentUser))
        .sort((a, b) => {
          const timeDiff =
            new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
          if (timeDiff !== 0) return timeDiff;
          return a.examTermId === (examTerms[0]?.id || 'term-half') ? -1 : 1;
        })
    : [];

  // Active marksheet driving the student's overview (null if teacher hasn't recorded one yet)
  const myGrade: StudentGrade | null = isStudent
    ? myGradesList.find((g) => g.id === selectedOverviewGradeId) || myGradesList[0] || null
    : null;

  // Dynamic Overview Insights computed strictly from the student's marksheet
  const myMarksheetInsights = React.useMemo(() => {
    if (!myGrade) return null;
    const scoreEntries = Object.entries(myGrade.scores || {}).map(([key, val]) => {
      const meta = getSubjectMeta(key);
      const score = Number(val || 0);
      const pct = meta.maxMarks > 0 ? Math.round((score / meta.maxMarks) * 100) : 0;
      return {
        key,
        name: meta.name,
        score,
        maxMarks: meta.maxMarks,
        passMarks: meta.passMarks,
        pct,
      };
    });

    const sortedDesc = [...scoreEntries].sort((a, b) => b.pct - a.pct);
    const strongest = sortedDesc[0] || null;
    const focus = sortedDesc[sortedDesc.length - 1] || null;
    const distinctionCount = scoreEntries.filter((s) => s.pct >= 90).length;
    const passedSubjects = scoreEntries.filter((s) => s.score >= s.passMarks);
    const failedSubjects = scoreEntries.filter((s) => s.score < s.passMarks);

    let standingLabel = 'Merit Standing';
    let standingTone: 'emerald' | 'indigo' | 'amber' | 'rose' = 'indigo';
    let standingSummary = '';

    if (myGrade.status === 'fail' || myGrade.percentage < 40 || failedSubjects.length > 0) {
      standingLabel = 'Academic Support Needed';
      standingTone = 'rose';
      const weakNames =
        failedSubjects.length > 0
          ? failedSubjects.map((s) => `${s.name} (${s.score}/${s.maxMarks})`).join(', ')
          : focus
          ? `${focus.name} (${focus.score}/${focus.maxMarks})`
          : 'core subjects';
      standingSummary = `Your marksheet shows priority improvement needed in ${weakNames} to reach the subject passing benchmark.`;
    } else if (myGrade.percentage >= 90) {
      standingLabel = 'Honors & Distinction';
      standingTone = 'emerald';
      standingSummary = strongest
        ? `Outstanding ${myGrade.percentage}% aggregate led by ${strongest.name} (${strongest.score}/${strongest.maxMarks}) with ${distinctionCount} distinction${distinctionCount === 1 ? '' : 's'}.`
        : `Outstanding ${myGrade.percentage}% aggregate across your evaluated subjects.`;
    } else if (myGrade.percentage >= 75) {
      standingLabel = 'Merit Standing';
      standingTone = 'indigo';
      standingSummary =
        strongest && focus
          ? `Strong ${myGrade.percentage}% performance led by ${strongest.name} (${strongest.score}/${strongest.maxMarks}). Boosting ${focus.name} (${focus.score}/${focus.maxMarks}) can lift you into A+ honors.`
          : `Consistent ${myGrade.percentage}% performance across evaluated subjects.`;
    } else {
      standingLabel = 'Steady Progress';
      standingTone = 'amber';
      standingSummary = focus
        ? `Current aggregate is ${myGrade.percentage}% (${myGrade.grade}). Focused revision in ${focus.name} (${focus.score}/${focus.maxMarks}) will raise your overall GPA.`
        : `Current aggregate is ${myGrade.percentage}% (${myGrade.grade}).`;
    }

    return {
      scoreEntries,
      strongest,
      focus,
      distinctionCount,
      passedSubjectsCount: passedSubjects.length,
      failedSubjectsCount: failedSubjects.length,
      standingLabel,
      standingTone,
      standingSummary,
      termName: getTermName(myGrade.examTermId),
    };
  }, [myGrade, subjects, examTerms]);

  // Collect student list for the Rank Board
  const studentUsers = users.filter((u) => u.role === 'student');

  // Filter students based on activeClass (Strictly locked to enrolled class for students)
  const matchedStudents = studentUsers.filter((s) => s.classSec === activeClass);

  // Fallback representative students if class is newly provisioned with no students yet
  const filteredStudents = matchedStudents.length > 0
    ? matchedStudents
    : [
        {
          id: `u-gen-${activeClass.replace(/\s+/g, '-').toLowerCase()}-01`,
          fullName: `Sai Teja (${activeClass})`,
          role: 'student' as const,
          username: `student_${activeClass.replace(/\s+/g, '_').toLowerCase()}_01`,
          email: `teja.${activeClass.replace(/\s+/g, '').toLowerCase()}@sssas.edu`,
          classSec: activeClass,
          rollNo: `${activeClass.replace('Class ', '').replace('-', '')}-01`,
          status: 'active' as const,
          twoFactorEnabled: false,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          rank: 1,
          badges: ['🌟 Math Star', '🏆 Prasanthi Scholar'],
        },
        {
          id: `u-gen-${activeClass.replace(/\s+/g, '-').toLowerCase()}-02`,
          fullName: `Bhavya Rao (${activeClass})`,
          role: 'student' as const,
          username: `student_${activeClass.replace(/\s+/g, '_').toLowerCase()}_02`,
          email: `bhavya.${activeClass.replace(/\s+/g, '').toLowerCase()}@sssas.edu`,
          classSec: activeClass,
          rollNo: `${activeClass.replace('Class ', '').replace('-', '')}-02`,
          status: 'active' as const,
          twoFactorEnabled: false,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          rank: 2,
          badges: ['🏅 Dharma Star', '💎 100% Attendance'],
        },
        {
          id: `u-gen-${activeClass.replace(/\s+/g, '-').toLowerCase()}-03`,
          fullName: `Kavya Reddy (${activeClass})`,
          role: 'student' as const,
          username: `student_${activeClass.replace(/\s+/g, '_').toLowerCase()}_03`,
          email: `kavya.${activeClass.replace(/\s+/g, '').toLowerCase()}@sssas.edu`,
          classSec: activeClass,
          rollNo: `${activeClass.replace('Class ', '').replace('-', '')}-03`,
          status: 'active' as const,
          twoFactorEnabled: false,
          lastLogin: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          rank: 3,
          badges: ['🔬 Science Whiz', '🎨 Creative Genius'],
        },
      ];

  // Map each student with their latest/selected marksheet and sort by percentage/rank
  const rankedStudents = filteredStudents
    .map((student) => {
      const matchingGrades = grades
        .filter((grade) => isGradeOwnedByStudent(grade, student))
        .sort(
          (a, b) =>
            new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime()
        );
      // If this row is the currently logged-in student and they selected a specific term marksheet in overview, reflect it
      const isCurrentStudentRow =
        isStudent &&
        (student.id === currentUser.id ||
          (Boolean(currentUser.rollNo) &&
            Boolean(student.rollNo) &&
            student.rollNo!.trim().toLowerCase() === currentUser.rollNo!.trim().toLowerCase()) ||
          student.fullName.toLowerCase().trim() === currentUser.fullName.toLowerCase().trim());
      const g = isCurrentStudentRow && myGrade ? myGrade : matchingGrades[0];

      const percentage = g ? g.percentage : 0;
      const gpa = g ? g.gpa : 0;
      const gradeLetter = g ? g.grade : 'Pending';
      return {
        ...student,
        calculatedPercentage: percentage,
        calculatedGpa: gpa,
        calculatedGrade: gradeLetter,
        hasMarksheet: Boolean(g),
        displayBadges: student.badges || [],
      };
    })
    .sort((a, b) => {
      if (a.hasMarksheet !== b.hasMarksheet) return a.hasMarksheet ? -1 : 1;
      return b.calculatedPercentage - a.calculatedPercentage;
    });

  const activeClassGradebookSummary = React.useMemo(() => {
    const classGrades = grades.filter((g) => g.classSec === activeClass);
    const avgPct = classGrades.length
      ? (classGrades.reduce((sum, g) => sum + g.percentage, 0) / classGrades.length).toFixed(1)
      : null;
    const passCount = classGrades.filter((g) => g.status === 'pass').length;
    const passRate = classGrades.length ? Math.round((passCount / classGrades.length) * 100) : null;
    const topper = classGrades.length
      ? [...classGrades].sort((a, b) => b.percentage - a.percentage)[0]
      : null;

    const subjectBreakdown = subjects.map((sub) => {
      const relevant = classGrades.filter((g) => sub.id in (g.scores || {}));
      const avgScore = relevant.length
        ? Number((relevant.reduce((sum, g) => sum + Number(g.scores[sub.id] || 0), 0) / relevant.length).toFixed(1))
        : null;
      const avgSubPct =
        avgScore !== null && sub.maxMarks > 0 ? Math.round((avgScore / sub.maxMarks) * 100) : 0;
      return {
        id: sub.id,
        name: sub.name,
        maxMarks: sub.maxMarks,
        avgScore,
        avgSubPct,
      };
    });

    const totalAssessments = assessments.filter((a) => a.status !== 'draft').length;
    const totalSubmissions = assessments.reduce((sum, a) => sum + (a.submissions?.length || 0), 0);
    const gradedSubmissions = assessments.reduce(
      (sum, a) => sum + (a.submissions?.filter((s) => s.status === 'graded').length || 0),
      0
    );
    const publishedLectures = lectures.filter((l) => l.status !== 'draft').length;

    return {
      count: classGrades.length,
      avgPct,
      passCount,
      passRate,
      topper,
      subjectBreakdown,
      totalAssessments,
      totalSubmissions,
      gradedSubmissions,
      publishedLectures,
    };
  }, [grades, activeClass, subjects, assessments, lectures]);

  const myClassRankIndex = isStudent
    ? rankedStudents.findIndex(
        (s) =>
          s.id === currentUser.id ||
          (currentUser.rollNo && s.rollNo === currentUser.rollNo) ||
          s.fullName.toLowerCase().trim() === currentUser.fullName.toLowerCase().trim()
      )
    : -1;
  const myClassRank = myClassRankIndex >= 0 ? myClassRankIndex + 1 : null;

  // Open Teacher Badge Editing Modal
  const handleOpenEditBadges = (student: { id: string; fullName: string; rollNo?: string; classSec?: string; badges?: string[]; displayBadges?: string[] }) => {
    setEditingStudent(student);
    setActiveBadges(student.displayBadges || student.badges || []);
    setCustomBadgeInput('');
    setBadgeSuccessMessage(null);
  };

  const handleTogglePresetBadge = (badge: string) => {
    if (activeBadges.includes(badge)) {
      setActiveBadges(activeBadges.filter((b) => b !== badge));
    } else {
      setActiveBadges([...activeBadges, badge]);
    }
  };

  const handleAddCustomBadge = () => {
    if (!customBadgeInput.trim()) return;
    const formatted = customBadgeInput.trim();
    if (!activeBadges.includes(formatted)) {
      setActiveBadges([...activeBadges, formatted]);
    }
    setCustomBadgeInput('');
  };

  const handleRemoveBadge = (badgeToRemove: string) => {
    setActiveBadges(activeBadges.filter((b) => b !== badgeToRemove));
  };

  const handleSaveBadges = async () => {
    if (!editingStudent || !onUpdateStudentBadges) return;
    setIsSavingBadge(true);
    try {
      await onUpdateStudentBadges(editingStudent.id, activeBadges);
      setBadgeSuccessMessage('Badges updated and synchronized with student profile!');
      setTimeout(() => {
        setEditingStudent(null);
        setBadgeSuccessMessage(null);
      }, 1200);
    } catch (err: any) {
      alert(err.message || 'Failed to update badges.');
    } finally {
      setIsSavingBadge(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                Institutional Workspace Active
              </span>
              <span className="text-xs text-slate-400 font-medium">
                Academic Session 2026–27
              </span>
              {isStudent && myGrade && myMarksheetInsights && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {myMarksheetInsights.standingLabel}: {myGrade.grade} ({myGrade.percentage}%)
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif text-white tracking-tight">
              Welcome back, {currentUser.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              {currentUser.role === 'admin' && 'Centralized command center. Oversee user accounts, class rank boards, academic marksheets, fee audit trails, and attendance books.'}
              {currentUser.role === 'teacher' && 'Academic faculty console. Manage subject marks, award badges on the Class Rank Board, and track daily classroom attendance.'}
              {currentUser.role === 'student' && (myMarksheetInsights
                ? `${myMarksheetInsights.standingSummary}`
                : 'Student academic portal. Your personal overview will dynamically update once your teacher publishes your marksheet.')}
              {currentUser.role === 'accountant' && 'Institutional treasury console. Issue verified digital fee vouchers and audit cryptographic transaction ledgers.'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(isStudent ? 'academics' : currentUser.role === 'teacher' ? 'academics' : currentUser.role === 'accountant' ? 'fees' : 'attendance')}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <span>{isStudent ? 'View My Marksheet' : 'Explore Active Tasks'}</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid (Dynamically Driven by Real Gradebook, Attendance, Assessments & Fee Ledger) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Marksheet Grade & Percentage (Student) / Real Enrollment & Gradebook Records (Faculty) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isStudent ? 'Marksheet Grade' : 'Students & Gradebook'}
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {isStudent
                ? myGrade
                  ? `${myGrade.grade} (${myGrade.percentage}%)`
                  : 'Pending Entry'
                : `${studentUsers.length} Students`}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              {isStudent ? (
                myGrade ? (
                  <>
                    <span className="text-emerald-400 font-semibold font-mono">
                      {myGrade.totalMarks} / {myGrade.maxPossible}
                    </span>
                    <span className="truncate">• {myMarksheetInsights?.termName}</span>
                  </>
                ) : (
                  <span>Awaiting teacher grade entry</span>
                )
              ) : (
                <>
                  <span className="text-emerald-400 font-semibold">{grades.length} Marksheets</span>
                  <span className="truncate">• {distinctGradeClassesCount} classes graded</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* KPI 2: Academic Index (GPA) & Standing */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isStudent ? 'Academic Index (GPA)' : 'Gradebook Aggregate'}
            </span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white">
              {isStudent
                ? myGrade
                  ? `${myGrade.gpa} / 10.0`
                  : '-- / 10.0'
                : grades.length > 0
                ? `${avgPercentage}% (${avgGpa} GPA)`
                : 'No Marks Yet'}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              {isStudent ? (
                myGrade && myMarksheetInsights ? (
                  <>
                    <span
                      className={`font-semibold ${
                        myMarksheetInsights.standingTone === 'rose'
                          ? 'text-rose-400'
                          : myMarksheetInsights.standingTone === 'amber'
                          ? 'text-amber-400'
                          : myMarksheetInsights.standingTone === 'emerald'
                          ? 'text-emerald-400'
                          : 'text-indigo-400'
                      }`}
                    >
                      {myMarksheetInsights.standingLabel}
                    </span>
                    <span>• {myMarksheetInsights.distinctionCount} Distinctions</span>
                  </>
                ) : (
                  <span>Calculated from your marksheet</span>
                )
              ) : (
                <>
                  <span className="text-indigo-400 font-semibold">
                    {passedGradesCount}/{grades.length} Passed
                  </span>
                  <span className="truncate">• {activeExamTerm?.name || 'Active Term'}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* KPI 3: Live Class Rank & Attendance (Student) / Real Campus Attendance (Faculty) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isStudent ? 'Class Rank & Attendance' : 'Campus Attendance'}
            </span>
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              {isStudent ? <Trophy className="w-5 h-5" /> : <CalendarCheck className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-teal-400">
              {isStudent
                ? myClassRank
                  ? `#${myClassRank} in ${activeClass}`
                  : activeClass
                : campusAttendanceStats.rate !== null
                ? `${campusAttendanceStats.rate}% Present`
                : 'No Registers'}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
              <span className="text-slate-300 font-medium truncate">
                {isStudent
                  ? myAttendanceStats.total > 0
                    ? `Att: ${myAttendanceStats.rate}% (${myAttendanceStats.present}/${myAttendanceStats.total}) • ${rankedStudents.length} peers`
                    : myGrade
                    ? `Status: ${myGrade.status.toUpperCase()} (${rankedStudents.length} peers)`
                    : 'Rank updates with marksheet'
                  : campusAttendanceStats.totalEntries > 0
                  ? `${campusAttendanceStats.presentEntries}/${campusAttendanceStats.totalEntries} marked • ${campusAttendanceStats.registerCount} registers`
                  : 'No attendance marked yet'}
              </span>
              <button
                type="button"
                onClick={() => onNavigate(isStudent ? 'academics' : 'attendance')}
                className="text-teal-400 hover:text-teal-300 font-bold cursor-pointer shrink-0 ml-2"
              >
                {isStudent ? 'Marksheet →' : 'View Log →'}
              </button>
            </div>
          </div>
        </div>

        {/* KPI 4: Subject Mastery (Student) / Real Fee Collections & Receipts (Faculty) */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isStudent ? 'Subject Mastery' : 'Treasury / Collections'}
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {isStudent ? <Award className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-white truncate">
              {isStudent
                ? myMarksheetInsights
                  ? `${myMarksheetInsights.passedSubjectsCount}/${myMarksheetInsights.scoreEntries.length} Passed`
                  : 'No Subjects'
                : `₹ ${totalCollections.toLocaleString()}`}
            </div>
            <div className="text-xs text-slate-400 mt-1 flex items-center gap-1 truncate">
              {isStudent ? (
                myMarksheetInsights?.strongest ? (
                  <>
                    <span className="text-amber-400 font-semibold truncate">
                      Top: {myMarksheetInsights.strongest.name}
                    </span>
                    <span className="shrink-0">
                      ({myMarksheetInsights.strongest.score}/{myMarksheetInsights.strongest.maxMarks} • {myMarksheetInsights.strongest.pct}%)
                    </span>
                  </>
                ) : (
                  <span>Subject scores pending</span>
                )
              ) : (
                <>
                  <span className="text-amber-400 font-semibold">
                    {verifiedTxCount}/{transactions.length} Verified
                  </span>
                  <span>• {pendingTxCount} Pending</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          CLASS RANK BOARD & BADGES SHOWCASE (Front Page for Students & Faculty)
          ========================================================================= */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Front Page Leaderboard
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-medium">Peer Achievements & Distinctions</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-serif text-white mt-1 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Class Rank Board & Badges Showcase</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isStudent
                ? 'Check your class standing, see your classmates’ ranks, and celebrate awarded distinction badges.'
                : 'Faculty review: Observe class standings, track student academic performance, and award/edit badges.'}
            </p>
          </div>

          {/* Class Filter Selector for Students vs Faculty */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {isStudent ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-sm">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Class Privacy: {studentEnrolledClass}</span>
              </div>
            ) : (
              <div className="text-xs font-bold text-amber-400 font-mono bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                Active: <span className="underline">{activeClass}</span>
              </div>
            )}
          </div>
        </div>

        {/* All 24 Institutional Classes Toolbar for Admin & Faculty */}
        {isTeacherOrAdmin && (
          <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-extrabold text-slate-200 uppercase tracking-wider">
                  Select Class to View Rank Board & Badges ({ALL_INSTITUTIONAL_CLASSES.length} Classes):
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Click any class to review student ranks, GPA, and faculty distinction badges.
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-950/80 border border-slate-800 max-h-36 overflow-y-auto">
              {ALL_INSTITUTIONAL_CLASSES.map((cls) => {
                const isCurrent = activeClass === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedClass(cls)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 font-black'
                        : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800'
                    }`}
                  >
                    <span>{cls}</span>
                    {isCurrent && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isStudent && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-amber-300 font-medium">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Showing your class standing among peers in <strong>{studentEnrolledClass}</strong>. Cross-class records remain confidential.</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Academic Year 2026-27 • Section {studentEnrolledClass}
            </span>
          </div>
        )}

        {/* Rank Board Table */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 uppercase text-[10px] font-extrabold tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 w-20">Rank</th>
                <th className="py-3 px-4">Student Name & Roll No</th>
                <th className="py-3 px-4 text-center">Class</th>
                <th className="py-3 px-4 text-center">Score / GPA</th>
                <th className="py-3 px-4">Distinction Badges (Awarded by Faculty)</th>
                {isTeacherOrAdmin && (
                  <th className="py-3 px-4 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {rankedStudents.map((student, index) => {
                const rankNum = index + 1;
                const isMe = isStudent && (student.id === currentUser.id || student.rollNo === currentUser.rollNo);

                return (
                  <tr
                    key={student.id}
                    className={`transition ${
                      isMe
                        ? 'bg-indigo-950/40 border-l-4 border-l-indigo-500 hover:bg-indigo-950/60'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Rank Medal / Badge */}
                    <td className="py-3 px-4">
                      {rankNum === 1 && (
                        <div className="flex items-center gap-1.5 font-black text-amber-400">
                          <Crown className="w-4 h-4 text-amber-400 animate-bounce" />
                          <span className="text-sm">1st</span>
                        </div>
                      )}
                      {rankNum === 2 && (
                        <div className="flex items-center gap-1.5 font-bold text-slate-300">
                          <Medal className="w-4 h-4 text-slate-300" />
                          <span className="text-sm">2nd</span>
                        </div>
                      )}
                      {rankNum === 3 && (
                        <div className="flex items-center gap-1.5 font-bold text-amber-600">
                          <Medal className="w-4 h-4 text-amber-600" />
                          <span className="text-sm">3rd</span>
                        </div>
                      )}
                      {rankNum > 3 && (
                        <span className="px-2.5 py-1 rounded-md bg-slate-950 text-slate-400 font-mono font-bold text-xs">
                          #{rankNum}
                        </span>
                      )}
                    </td>

                    {/* Student Identity */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                          rankNum === 1
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                        }`}>
                          {student.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{student.fullName}</span>
                            {isMe && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            Roll #{student.rollNo || '101'} • ID: {student.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 text-slate-300 font-semibold text-[11px] border border-slate-800">
                        {student.classSec || activeClass}
                      </span>
                    </td>

                    {/* Academic Score */}
                    <td className="py-3 px-4 text-center">
                      <div className="font-black text-white text-sm">
                        {student.calculatedPercentage}%
                      </div>
                      <div className="text-[10px] text-slate-400">
                        GPA: <span className="text-emerald-400 font-bold">{student.calculatedGpa}</span> ({student.calculatedGrade})
                      </div>
                    </td>

                    {/* Badges List */}
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {student.displayBadges && student.displayBadges.length > 0 ? (
                          student.displayBadges.map((badge, bIdx) => (
                            <span
                              key={bIdx}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-950 text-amber-300 border border-amber-500/30 shadow-sm flex items-center gap-1"
                            >
                              <span>{badge}</span>
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">
                            No badges awarded yet
                          </span>
                        )}

                        {isTeacherOrAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditBadges(student)}
                            className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                            title="Edit Badges"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Teacher Action */}
                    {isTeacherOrAdmin && (
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenEditBadges(student)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-white text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Edit2 className="w-3 h-3 text-indigo-400" />
                          <span>Edit Badges</span>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rankedStudents.length === 0 && (
          <div className="text-center p-8 text-slate-500 text-xs">
            No students found for {activeClass}.
          </div>
        )}
      </div>

      {/* Role-Specific Secondary View Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Academic Standings & Highlights */}
        <div className="lg:col-span-2 space-y-6">
          {/* Student Specific Marksheet-Driven Academic Performance Summary */}
          {isStudent && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>
                      Academic Performance Overview
                      {myMarksheetInsights ? ` (${myMarksheetInsights.termName})` : ''}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Student: <strong className="text-slate-200">{myGrade?.studentName || currentUser.fullName}</strong> • Roll #{myGrade?.rollNo || currentUser.rollNo || 'N/A'} • {myGrade?.classSec || currentUser.classSec || 'Enrolled'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {myGradesList.length > 1 && (
                    <select
                      value={myGrade?.id || ''}
                      onChange={(e) => setSelectedOverviewGradeId(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      {myGradesList.map((g) => (
                        <option key={g.id} value={g.id}>
                          {getTermName(g.examTermId)} ({g.percentage}%)
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => onNavigate('academics')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    View My Marksheet →
                  </button>
                </div>
              </div>

              {myGrade && myMarksheetInsights ? (
                <>
                  {/* Marksheet-Driven Dynamic Standing Banner */}
                  <div
                    className={`mb-4 p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      myMarksheetInsights.standingTone === 'rose'
                        ? 'bg-rose-950/35 border-rose-600/40 text-rose-200'
                        : myMarksheetInsights.standingTone === 'amber'
                        ? 'bg-amber-950/35 border-amber-600/40 text-amber-200'
                        : myMarksheetInsights.standingTone === 'emerald'
                        ? 'bg-emerald-950/35 border-emerald-600/40 text-emerald-200'
                        : 'bg-indigo-950/35 border-indigo-600/40 text-indigo-200'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="font-bold flex items-center gap-2">
                        <span>{myMarksheetInsights.standingLabel}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-950/70 border border-white/10 font-mono">
                          {myGrade.totalMarks}/{myGrade.maxPossible} • {myGrade.percentage}% • Grade {myGrade.grade}
                        </span>
                      </div>
                      <p className="text-[11px] opacity-90">{myMarksheetInsights.standingSummary}</p>
                    </div>
                    {myMarksheetInsights.focus && (
                      <div className="text-[11px] px-2.5 py-1.5 rounded-lg bg-slate-950/60 border border-white/10 shrink-0">
                        Focus Area: <strong>{myMarksheetInsights.focus.name}</strong> ({myMarksheetInsights.focus.score}/{myMarksheetInsights.focus.maxMarks})
                      </div>
                    )}
                  </div>

                  {/* Subject Score Breakdown (Dynamically reflects all subjects in marksheet) */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {myMarksheetInsights.scoreEntries.map(({ key, name, score, maxMarks, pct }) => {
                      const subGrade =
                        pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B+' : pct >= 60 ? 'B' : pct >= 50 ? 'C' : pct >= 40 ? 'D' : 'F';
                      const barColor =
                        pct >= 90
                          ? 'bg-emerald-500'
                          : pct >= 75
                          ? 'bg-indigo-500'
                          : pct >= 40
                          ? 'bg-amber-500'
                          : 'bg-rose-500';
                      const gradeTextColor =
                        pct >= 90
                          ? 'text-emerald-400'
                          : pct >= 75
                          ? 'text-indigo-400'
                          : pct >= 40
                          ? 'text-amber-400'
                          : 'text-rose-400';

                      return (
                        <div key={key} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                          <div className="flex items-center justify-between gap-1">
                            <div className="text-[11px] font-bold text-slate-400 truncate" title={name}>
                              {name}
                            </div>
                            <span className={`text-[10px] font-black ${gradeTextColor}`}>
                              {subGrade}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-xl font-black text-white">{score}</span>
                            <span className="text-[10px] text-slate-400 font-bold">/ {maxMarks}</span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                            <div
                              className={`${barColor} h-full rounded-full transition-all duration-300`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-3 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-start gap-3 text-xs text-indigo-200">
                    <Sparkles className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <p>
                      <strong>Faculty Remark:</strong> &ldquo;{myGrade.remarks || 'Consistent academic performance and paperless compliance.'}&rdquo;
                    </p>
                  </div>

                  {/* Live Attendance, Assignments, Lectures & Fee Ledger Summary */}
                  {myAcademicExtras && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">My Attendance</div>
                        <div className="text-sm font-black text-teal-400 mt-0.5">
                          {myAttendanceStats.rate !== null ? `${myAttendanceStats.rate}%` : 'No Logs'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {myAttendanceStats.total > 0
                            ? `${myAttendanceStats.present}/${myAttendanceStats.total} days present`
                            : 'Awaiting register'}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Assignments</div>
                        <div className="text-sm font-black text-indigo-300 mt-0.5">
                          {myAcademicExtras.submittedCount}/{myAcademicExtras.totalAssessments}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {myAcademicExtras.gradedCount} graded
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Lectures</div>
                        <div className="text-sm font-black text-amber-300 mt-0.5">
                          {myAcademicExtras.completedLectures}/{myAcademicExtras.totalLectures}
                        </div>
                        <div className="text-[10px] text-slate-400">Completed</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Fee Ledger</div>
                        <div className="text-sm font-black text-emerald-400 mt-0.5">
                          ₹ {myAcademicExtras.verifiedPaid.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {myAcademicExtras.receiptCount} receipts • {myAcademicExtras.pendingFeeCount} pending
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
                    <BookOpen className="w-8 h-8 text-slate-600 mx-auto" />
                    <div className="text-sm font-bold text-slate-300">No Marksheet Recorded Yet</div>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Your personal academic overview, subject breakdown, GPA, and standing insights will automatically appear here as soon as your teacher publishes your marksheet.
                    </p>
                  </div>
                  {myAcademicExtras && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">My Attendance</div>
                        <div className="text-sm font-black text-teal-400 mt-0.5">
                          {myAttendanceStats.rate !== null ? `${myAttendanceStats.rate}%` : 'No Logs'}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {myAttendanceStats.present}/{myAttendanceStats.total} days present
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Assignments</div>
                        <div className="text-sm font-black text-indigo-300 mt-0.5">
                          {myAcademicExtras.submittedCount}/{myAcademicExtras.totalAssessments}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {myAcademicExtras.gradedCount} graded
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Lectures</div>
                        <div className="text-sm font-black text-amber-300 mt-0.5">
                          {myAcademicExtras.completedLectures}/{myAcademicExtras.totalLectures}
                        </div>
                        <div className="text-[10px] text-slate-400">Completed</div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Fee Ledger</div>
                        <div className="text-sm font-black text-emerald-400 mt-0.5">
                          ₹ {myAcademicExtras.verifiedPaid.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {myAcademicExtras.receiptCount} receipts
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Faculty / Admin / Accountant Real Gradebook & Institutional Operations Card */}
          {!isStudent && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    <span>
                      Gradebook &amp; Academic Operations ({activeClass})
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeClassGradebookSummary.count > 0
                      ? `${activeClassGradebookSummary.count} marksheets evaluated • Avg ${activeClassGradebookSummary.avgPct}% • Pass Rate ${activeClassGradebookSummary.passRate}%${activeClassGradebookSummary.topper ? ` • Topper: ${activeClassGradebookSummary.topper.studentName} (${activeClassGradebookSummary.topper.percentage}%)` : ''}`
                      : `No marksheets recorded for ${activeClass} yet. School-wide total: ${grades.length} marksheets across ${distinctGradeClassesCount} classes.`}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate('academics')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                >
                  Open Gradebook →
                </button>
              </div>

              {/* Subject Averages from Real Gradebook */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {activeClassGradebookSummary.subjectBreakdown.map((sub) => (
                  <div key={sub.id} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <div className="text-[11px] font-bold text-slate-400 truncate" title={sub.name}>
                      {sub.name}
                    </div>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className="text-lg font-black text-white">
                        {sub.avgScore !== null ? sub.avgScore : '--'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">/ {sub.maxMarks}</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, sub.avgSubPct))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Attendance, Assessments, Lectures & Fee Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Attendance</div>
                  <div className="text-sm font-black text-teal-400 mt-0.5">
                    {campusAttendanceStats.rate !== null ? `${campusAttendanceStats.rate}%` : 'No Logs'}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {campusAttendanceStats.presentEntries}/{campusAttendanceStats.totalEntries} marked
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Assessments</div>
                  <div className="text-sm font-black text-indigo-300 mt-0.5">
                    {activeClassGradebookSummary.totalAssessments} Active
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {activeClassGradebookSummary.totalSubmissions} submissions ({activeClassGradebookSummary.gradedSubmissions} graded)
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Lectures</div>
                  <div className="text-sm font-black text-amber-300 mt-0.5">
                    {activeClassGradebookSummary.publishedLectures} Published
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {subjects.length} subjects • {examTerms.length} terms
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="text-[10px] font-bold uppercase text-slate-400">Fee Ledger</div>
                  <div className="text-sm font-black text-emerald-400 mt-0.5">
                    ₹ {totalCollections.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {verifiedTxCount} verified • {pendingTxCount} pending
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Institutional Circulars & Notices Preview */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Recent Institutional Circulars</span>
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('announcements')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                All Announcements ({announcements.length}) →
              </button>
            </div>

            <div className="space-y-3">
              {announcements.slice(0, 3).map((ann) => (
                <div
                  key={ann.id}
                  className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">
                      {ann.title}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                        ann.priority === 'critical'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                      }`}
                    >
                      {ann.priority}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 line-clamp-2 mt-1.5 leading-relaxed">
                    {ann.content}
                  </p>
                  <div className="flex items-center justify-between mt-3 text-[11px] text-slate-400 pt-2 border-t border-slate-900">
                    <span>By {ann.author} ({ann.role.toUpperCase()})</span>
                    <span>{new Date(ann.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Quick Access & SecOps Feed */}
        <div className="space-y-6">
          {/* Quick Action Tiles */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-base font-bold text-white mb-3">
              Quick Shortcuts
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onNavigate('attendance')}
                className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-left transition cursor-pointer"
              >
                <CalendarCheck className="w-4 h-4 text-teal-400 mb-1" />
                <div className="text-xs font-bold text-white">Attendance</div>
                <div className="text-[10px] text-slate-400">Day-wise log</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('academics')}
                className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-left transition cursor-pointer"
              >
                <GraduationCap className="w-4 h-4 text-indigo-400 mb-1" />
                <div className="text-xs font-bold text-white">Gradebook</div>
                <div className="text-[10px] text-slate-400">Classwise marks</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('lectures')}
                className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-left transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400 mb-1" />
                <div className="text-xs font-bold text-white">Lectures</div>
                <div className="text-[10px] text-slate-400">Video & quizzes</div>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('assignments')}
                className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-800 border border-slate-800 text-left transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400 mb-1" />
                <div className="text-xs font-bold text-white">Assignments</div>
                <div className="text-[10px] text-slate-400">Attachments & HW</div>
              </button>
            </div>
          </div>

          {/* Security & Audit Summary */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-amber-400" />
                <span>Security Audit Feed</span>
              </h2>
              {['admin', 'accountant'].includes(currentUser.role) && (
                <button
                  type="button"
                  onClick={() => onNavigate('audit')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  View Full Logs →
                </button>
              )}
            </div>

            <div className="space-y-3">
              {auditLogs.slice(0, 4).map((log) => (
                <div key={log.id} className="text-xs p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                      {log.eventType}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 leading-normal">
                    {log.details}
                  </p>
                  <div className="text-[10px] text-slate-400 mt-1.5 font-mono">
                    IP: {log.ipAddress}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          TEACHER BADGE EDITING MODAL
          ========================================================================= */}
      {editingStudent && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 text-slate-100 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 inline-block mb-1">
                  Faculty Distinction Portal
                </span>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Award & Edit Badges: {editingStudent.fullName}</span>
                </h3>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  Roll #{editingStudent.rollNo || '101'} • {editingStudent.classSec || 'Class 10-A'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {badgeSuccessMessage && (
              <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{badgeSuccessMessage}</span>
              </div>
            )}

            {/* Currently Assigned Badges */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Currently Awarded Badges ({activeBadges.length})
                </label>
                {activeBadges.length > 0 ? (
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-950 rounded-xl border border-slate-800">
                    {activeBadges.map((badge, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{badge}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBadge(badge)}
                          className="hover:text-rose-400 transition cursor-pointer"
                          title="Remove badge"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-slate-500 italic text-center">
                    No badges assigned to this student yet. Click preset chips below to award.
                  </div>
                )}
              </div>

              {/* Preset Badges Quick Select */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Click to Toggle Preset Distinction Badges
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {presetBadges.map((badge) => {
                    const isSelected = activeBadges.includes(badge);
                    return (
                      <button
                        key={badge}
                        type="button"
                        onClick={() => handleTogglePresetBadge(badge)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {badge} {isSelected && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Badge Field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Or Add Custom Badge (e.g. 🎯 Debate Champion)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customBadgeInput}
                    onChange={(e) => setCustomBadgeInput(e.target.value)}
                    placeholder="Enter emoji + badge label"
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-amber-500 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomBadge();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomBadge}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingBadge}
                  onClick={handleSaveBadges}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold shadow-lg shadow-amber-600/30 cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingBadge ? 'Saving...' : 'Save & Synchronize Badges'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
