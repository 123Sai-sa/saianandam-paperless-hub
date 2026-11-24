import React, { useState } from 'react';
import {
  Video,
  Play,
  CheckCircle,
  Clock,
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  Download,
  Search,
  Filter,
  Layers,
  Sparkles,
  FileText,
  User as UserIcon,
  X,
  Share2,
  Lock,
  Unlock,
  HelpCircle,
  AlertTriangle,
  Award,
  Check,
  RotateCcw,
  Loader2,
  Brain,
} from 'lucide-react';
import {
  User,
  Lecture,
  LectureResource,
  LectureQuiz,
  LectureQuizQuestion,
  LectureAiAnalysis,
  ALL_INSTITUTIONAL_CLASSES,
} from '../types';

interface LecturesViewProps {
  currentUser: User;
  lectures: Lecture[];
  onAddLecture: (lectureData: Omit<Lecture, 'id' | 'completedBy'>) => Promise<void>;
  onUpdateLecture: (id: string, updates: Partial<Lecture>) => Promise<void>;
  onDeleteLecture: (id: string) => Promise<void>;
  onToggleComplete: (lectureId: string, studentId: string) => Promise<void>;
}

// Convert various YouTube links to an embed URL
export function toYoutubeEmbed(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.includes('youtube.com/embed/')) return trimmed;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = trimmed.match(regExp);
  if (match && match[2].length === 11) {
    return `https://www.youtube.com/embed/${match[2]}`;
  }
  return trimmed;
}

export function isYoutubeUrl(url: string): boolean {
  if (!url) return false;
  return url.includes('youtube.com') || url.includes('youtu.be');
}

export const LecturesView: React.FC<LecturesViewProps> = ({
  currentUser,
  lectures,
  onAddLecture,
  onUpdateLecture,
  onDeleteLecture,
  onToggleComplete,
}) => {
  const isTeacherOrAdmin = currentUser.role === 'teacher' || currentUser.role === 'admin';
  const isStudent = currentUser.role === 'student';

  const [selectedSubject, setSelectedSubject] = useState<string>('All');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [activeLectureModal, setActiveLectureModal] = useState<Lecture | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLecture, setEditingLecture] = useState<Lecture | null>(null);

  // Form states for Teacher Adding/Editing Lecture (Only YouTube URL allowed!)
  const studentEnrolledClass = currentUser.classSec || 'Class 8-A';
  const [formTitle, setFormTitle] = useState('');
  const [formSubject, setFormSubject] = useState('Physics');
  const [formClassSec, setFormClassSec] = useState(currentUser.classSec || 'Class 8-A');
  const [formDuration, setFormDuration] = useState('45 mins');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formKeyPoints, setFormKeyPoints] = useState('');
  const [formResourceName, setFormResourceName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Quiz Modal State
  const [quizLecture, setQuizLecture] = useState<Lecture | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState<{ correct: number; total: number; percentage: number; passed: boolean } | null>(null);

  // AI Video Analysis & Quiz Generation State
  const [aiAnalyzingLectureId, setAiAnalyzingLectureId] = useState<string | null>(null);
  const [isAnalyzingFormVideo, setIsAnalyzingFormVideo] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiStatusNotice, setAiStatusNotice] = useState<string | null>(null);
  const [formAiQuiz, setFormAiQuiz] = useState<LectureQuiz | null>(null);
  const [formAiAnalysis, setFormAiAnalysis] = useState<LectureAiAnalysis | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const subjects = ['All', 'Physics', 'Mathematics', 'Chemistry', 'Computer Science', 'English'];

  const requestAiVideoAnalysis = async (payload: {
    videoUrl: string;
    title?: string;
    subject?: string;
    classSec?: string;
    description?: string;
    keyPoints?: string[];
    questionCount?: number;
  }): Promise<{
    analysis: LectureAiAnalysis;
    questions: LectureQuizQuestion[];
  }> => {
    const response = await fetch('/api/gemini/analyze-lecture-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result?.success || !result?.data) {
      throw new Error(
        result?.error || `AI video analysis failed (HTTP ${response.status}). Please verify the YouTube URL and server configuration.`
      );
    }

    const { videoSummary, keyConcepts, topicsCovered, questions, analyzedAt } = result.data;
    return {
      analysis: {
        videoSummary: videoSummary || '',
        keyConcepts: Array.isArray(keyConcepts) ? keyConcepts : [],
        topicsCovered: Array.isArray(topicsCovered) ? topicsCovered : [],
        analyzedAt: analyzedAt || new Date().toISOString(),
        analyzedVideoUrl: result.canonicalYoutubeUrl || payload.videoUrl,
        model: result.model || 'gemini-4-hydrogen',
      },
      questions: Array.isArray(questions) ? questions : [],
    };
  };

  const filteredLectures = lectures.filter((lec) => {
    // Class-level scoping: students only see lectures for their enrolled class or schoolwide (All)
    if (isStudent) {
      const target = (lec.classSec || '').toLowerCase().trim();
      const myClass = studentEnrolledClass.toLowerCase().trim();
      if (target !== 'all' && target !== 'all classes' && target !== myClass) {
        return false;
      }
    } else if (selectedClassFilter !== 'All') {
      const target = (lec.classSec || '').toLowerCase().trim();
      if (target !== selectedClassFilter.toLowerCase().trim() && target !== 'all' && target !== 'all classes') {
        return false;
      }
    }

    const matchesSub = selectedSubject === 'All' || lec.subject.toLowerCase() === selectedSubject.toLowerCase();
    const matchesSearch =
      lec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lec.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lec.teacherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lec.keyPoints.some(kp => kp.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSub && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingLecture(null);
    setFormTitle('');
    setFormSubject('Physics');
    setFormClassSec(currentUser.classSec || 'Class 8-A');
    setFormDuration('45 mins');
    setFormVideoUrl('https://www.youtube.com/watch?v=ZM8ECpBuQYE');
    setFormDescription('');
    setFormKeyPoints('');
    setFormResourceName('');
    setFormError(null);
    setFormAiQuiz(null);
    setFormAiAnalysis(null);
    setIsAddModalOpen(true);
  };

  const handleStartEdit = (lecture: Lecture) => {
    setEditingLecture(lecture);
    setFormTitle(lecture.title);
    setFormSubject(lecture.subject);
    setFormClassSec(lecture.classSec);
    setFormDuration(lecture.duration);
    setFormVideoUrl(lecture.youtubeUrl || lecture.videoUrl || '');
    setFormDescription(lecture.description);
    setFormKeyPoints(lecture.keyPoints.join('\n'));
    setFormResourceName(lecture.resources[0]?.name || '');
    setFormError(null);
    setFormAiQuiz(lecture.quiz?.generatedByAi ? lecture.quiz : null);
    setFormAiAnalysis(lecture.aiAnalysis || null);
    setIsAddModalOpen(true);
  };

  const handleAnalyzeFormVideo = async () => {
    setFormError(null);
    if (!formVideoUrl.trim() || !isYoutubeUrl(formVideoUrl)) {
      setFormError('Please enter a valid YouTube video URL before running AI video analysis.');
      return;
    }

    setIsAnalyzingFormVideo(true);
    try {
      const { analysis, questions } = await requestAiVideoAnalysis({
        videoUrl: formVideoUrl.trim(),
        title: formTitle.trim() || undefined,
        subject: formSubject,
        classSec: formClassSec,
        description: formDescription.trim() || undefined,
        keyPoints: formKeyPoints.split('\n').map((s) => s.trim()).filter(Boolean),
        questionCount: 4,
      });

      setFormAiAnalysis(analysis);
      setFormAiQuiz({
        id: `quiz-ai-${Date.now()}`,
        lectureId: editingLecture?.id || `lec-${Date.now()}`,
        passThreshold: 75,
        passPercentage: 75,
        generatedByAi: true,
        generatedAt: analysis.analyzedAt,
        questions,
      });

      if (!formDescription.trim() && analysis.videoSummary) {
        setFormDescription(analysis.videoSummary);
      }
      if (!formKeyPoints.trim() && analysis.keyConcepts.length > 0) {
        setFormKeyPoints(analysis.keyConcepts.join('\n'));
      }
    } catch (err: any) {
      setFormError(err?.message || 'Unable to analyze the YouTube video with AI.');
    } finally {
      setIsAnalyzingFormVideo(false);
    }
  };

  const handleSaveLecture = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formTitle.trim() || !formDescription.trim()) {
      setFormError('Please provide both a lecture title and synopsis.');
      return;
    }

    // STRICT VALIDATION: Teacher is only able to add YouTube video!
    if (!formVideoUrl.trim() || !isYoutubeUrl(formVideoUrl)) {
      setFormError('Institutional Requirement: Only valid YouTube video URLs (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...) are allowed for lectures.');
      return;
    }

    const embedUrl = toYoutubeEmbed(formVideoUrl);
    const keyPointsArray = formKeyPoints
      .split('\n')
      .map(p => p.trim())
      .filter(Boolean);

    const resources: LectureResource[] = formResourceName.trim()
      ? [
          {
            id: `res-${Date.now()}`,
            name: formResourceName.trim(),
            size: '2.1 MB',
            type: 'PDF',
            url: '#',
          },
        ]
      : [
          {
            id: `res-${Date.now()}`,
            name: `${formTitle.replace(/\s+/g, '_')}_StudyHandout.pdf`,
            size: '1.5 MB',
            type: 'PDF',
            url: '#',
          },
        ];

    // Default 4-question quiz for newly added lecture if none provided
    const defaultLectureQuiz: LectureQuiz = {
      id: `quiz-${Date.now()}`,
      lectureId: editingLecture?.id || `lec-${Date.now()}`,
      passThreshold: 75,
      passPercentage: 75,
      questions: [
        {
          id: 'q-1',
          question: `What fundamental law or principle was established in this ${formSubject} lecture on "${formTitle}"?`,
          options: [
            'Conservation principles under ideal conditions',
            'Random variance with no predictable equilibrium',
            'Arbitrary scalar transformation',
            'Linear degradation over infinite cycles',
          ],
          correctOption: 0,
          correctAnswerIndex: 0,
          explanation: 'The core syllabus principle reinforces conservation and foundational equations.',
        },
        {
          id: 'q-2',
          question: 'What is the primary mathematical relationship derived in this video?',
          options: [
            'Inverse logarithmic ratio',
            'Direct proportional relationship with boundary limits',
            'Uncorrelated stochastic distribution',
            'Static coefficient invariant',
          ],
          correctOption: 1,
          correctAnswerIndex: 1,
          explanation: 'As demonstrated in the lecture proof, proportional constraints define the relationship.',
        },
        {
          id: 'q-3',
          question: 'Why is zero-paper digital documentation emphasized for this topic?',
          options: [
            'It enables verifiable timestamps and environmental protection',
            'It eliminates all examinations entirely',
            'It prevents teachers from evaluating work',
            'It reduces laboratory safety compliance',
          ],
          correctOption: 0,
          correctAnswerIndex: 0,
          explanation: 'Digital recording ensures paperless sustainability and transparent institutional audit.',
        },
        {
          id: 'q-4',
          question: 'What practical laboratory experiment corresponds with this theoretical framework?',
          options: [
            'Direct calorimeter and energy balance observation',
            'Uncalibrated open system trial',
            'Hypothetical mental conjecture without measurement',
            'Purely intuitive observation',
          ],
          correctOption: 0,
          correctAnswerIndex: 0,
          explanation: 'Calorimetric validation verifies theoretical derivations with empirical data.',
        },
      ],
    };

    if (editingLecture) {
      await onUpdateLecture(editingLecture.id, {
        title: formTitle.trim(),
        subject: formSubject,
        classSec: formClassSec,
        duration: formDuration,
        recordingType: 'video',
        youtubeUrl: formVideoUrl.trim(),
        videoUrl: embedUrl,
        description: formDescription.trim(),
        keyPoints: keyPointsArray.length > 0 ? keyPointsArray : ['Core chapter concepts reviewed.'],
        resources,
        ...(formAiQuiz ? { quiz: { ...formAiQuiz, lectureId: editingLecture.id } } : {}),
        ...(formAiAnalysis ? { aiAnalysis: formAiAnalysis } : {}),
      });
    } else {
      await onAddLecture({
        title: formTitle.trim(),
        subject: formSubject,
        classSec: formClassSec,
        teacherId: currentUser.id,
        teacherName: currentUser.fullName,
        date: new Date().toISOString().split('T')[0],
        duration: formDuration,
        recordingType: 'video',
        youtubeUrl: formVideoUrl.trim(),
        videoUrl: embedUrl,
        description: formDescription.trim(),
        keyPoints: keyPointsArray.length > 0 ? keyPointsArray : ['Core chapter concepts reviewed.'],
        resources,
        status: 'published',
        quiz: formAiQuiz || defaultLectureQuiz,
        ...(formAiAnalysis ? { aiAnalysis: formAiAnalysis } : {}),
      });
    }

    setIsAddModalOpen(false);
    setEditingLecture(null);
    setFormAiQuiz(null);
    setFormAiAnalysis(null);
  };

  // Helper to check if student has unlocked this lecture (Sequential Progression)
  const isLectureUnlocked = (lecture: Lecture, index: number): boolean => {
    if (isTeacherOrAdmin) return true; // Teachers & admins can preview everything
    if (index === 0) return true; // First lecture is always unlocked

    // Previous lecture must have been completed by the student
    const prevLecture = filteredLectures[index - 1];
    if (!prevLecture) return true;
    return prevLecture.completedBy?.includes(currentUser.id) || false;
  };

  // Analyze an existing Lecture's YouTube video with AI & generate a tailored quiz
  const handleAnalyzeExistingLecture = async (
    lecture: Lecture,
    options: { openQuizAfter?: boolean } = {}
  ) => {
    const targetUrl = lecture.youtubeUrl || lecture.videoUrl || '';
    setAiError(null);
    setAiStatusNotice(null);

    if (!isYoutubeUrl(targetUrl)) {
      setAiError('This lecture does not have a valid YouTube video URL for AI analysis.');
      return;
    }

    setAiAnalyzingLectureId(lecture.id);
    try {
      const { analysis, questions } = await requestAiVideoAnalysis({
        videoUrl: targetUrl,
        title: lecture.title,
        subject: lecture.subject,
        classSec: lecture.classSec,
        description: lecture.description,
        keyPoints: lecture.keyPoints,
        questionCount: 4,
      });

      const updatedQuiz: LectureQuiz = {
        id: `quiz-ai-${Date.now()}`,
        lectureId: lecture.id,
        passThreshold: lecture.quiz?.passThreshold ?? lecture.quiz?.passPercentage ?? 75,
        passPercentage: lecture.quiz?.passPercentage ?? lecture.quiz?.passThreshold ?? 75,
        generatedByAi: true,
        generatedAt: analysis.analyzedAt,
        questions,
      };

      const nextKeyPoints =
        analysis.keyConcepts.length > 0 ? analysis.keyConcepts : lecture.keyPoints;

      await onUpdateLecture(lecture.id, {
        aiAnalysis: analysis,
        quiz: updatedQuiz,
        keyPoints: nextKeyPoints,
      });

      const updatedLecture: Lecture = {
        ...lecture,
        aiAnalysis: analysis,
        quiz: updatedQuiz,
        keyPoints: nextKeyPoints,
      };

      if (activeLectureModal?.id === lecture.id) {
        setActiveLectureModal(updatedLecture);
      }
      if (quizLecture?.id === lecture.id) {
        setQuizLecture(updatedLecture);
        setSelectedAnswers({});
        setQuizSubmitted(false);
        setQuizScore(null);
      }

      setAiStatusNotice(
        `AI analyzed "${lecture.title}" and generated ${questions.length} video-based quiz questions.`
      );

      if (options.openQuizAfter) {
        setActiveLectureModal(null);
        setQuizLecture(updatedLecture);
        setSelectedAnswers({});
        setQuizSubmitted(false);
        setQuizScore(null);
      }
    } catch (err: any) {
      setAiError(err?.message || 'Failed to analyze YouTube lecture video with AI.');
    } finally {
      setAiAnalyzingLectureId(null);
    }
  };

  // Fallback helper for quiz questions
  const getQuizQuestionsForLecture = (lecture: Lecture): LectureQuizQuestion[] => {
    if (lecture.quiz?.questions && lecture.quiz.questions.length > 0) {
      return lecture.quiz.questions;
    }
    return [
      {
        id: 1,
        question: `What fundamental law or principle was established in this ${lecture.subject} lecture on "${lecture.title}"?`,
        options: [
          'Conservation principles under ideal boundary conditions',
          'Random variance with no predictable equilibrium',
          'Arbitrary scalar transformation',
          'Linear degradation over infinite cycles',
        ],
        correctAnswerIndex: 0,
        explanation: 'The core syllabus principle reinforces conservation and foundational equations.',
      },
      {
        id: 2,
        question: 'What is the primary mathematical relationship derived in this video?',
        options: [
          'Inverse logarithmic ratio',
          'Direct proportional relationship with boundary limits',
          'Uncorrelated stochastic distribution',
          'Static coefficient invariant',
        ],
        correctAnswerIndex: 1,
        explanation: 'As demonstrated in the lecture proof, proportional constraints define the relationship.',
      },
      {
        id: 3,
        question: 'Why is zero-paper digital documentation emphasized for this topic?',
        options: [
          'It enables verifiable timestamps and environmental protection',
          'It eliminates all examinations entirely',
          'It prevents teachers from evaluating work',
          'It reduces laboratory safety compliance',
        ],
        correctAnswerIndex: 0,
        explanation: 'Digital recording ensures paperless sustainability and transparent institutional audit.',
      },
      {
        id: 4,
        question: 'What practical laboratory experiment corresponds with this theoretical framework?',
        options: [
          'Direct calorimeter and energy balance observation',
          'Uncalibrated open system trial',
          'Hypothetical mental conjecture without measurement',
          'Purely intuitive observation',
        ],
        correctAnswerIndex: 0,
        explanation: 'Calorimetric validation verifies theoretical derivations with empirical data.',
      },
    ];
  };

  // Open Quiz Modal
  const handleOpenQuiz = (lecture: Lecture) => {
    setAiError(null);
    setQuizLecture(lecture);
    setSelectedAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
  };

  // Submit Quiz Answers & Enforce 75% Passing Threshold
  const handleSubmitQuiz = async () => {
    if (!quizLecture) return;

    const questions = getQuizQuestionsForLecture(quizLecture);


    let correctCount = 0;
    questions.forEach((q, idx) => {
      const targetAns = q.correctAnswerIndex ?? q.correctOption ?? 0;
      if (selectedAnswers[idx] === targetAns) {
        correctCount += 1;
      }
    });

    const total = questions.length;
    const percentage = Math.round((correctCount / total) * 100);
    const passThreshold = quizLecture.quiz?.passThreshold ?? quizLecture.quiz?.passPercentage ?? 75;
    const passed = percentage >= passThreshold;

    setQuizScore({
      correct: correctCount,
      total,
      percentage,
      passed,
    });
    setQuizSubmitted(true);

    if (passed) {
      // Mark as completed and unlock next lecture
      await onToggleComplete(quizLecture.id, currentUser.id);
    }
  };

  // Student completion statistics
  const completedCount = isStudent
    ? lectures.filter(l => l.completedBy?.includes(currentUser.id)).length
    : 0;
  const progressPercent = lectures.length > 0 ? Math.round((completedCount / lectures.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Action Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              Zero-Paper Digital Hub
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>AI Video Analyzer & Quiz</span>
            </span>
            <span className="text-xs text-slate-500">•</span>
            <span className="text-xs text-slate-400 font-medium">YouTube Video Lectures & Topic Quizzes</span>
          </div>
          <h1 className="text-2xl font-bold font-serif text-white mt-1 flex items-center gap-2.5">
            <Video className="w-6 h-6 text-indigo-400" />
            <span>Classroom Video Lectures & Progression</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Watch faculty YouTube lectures, run AI video analysis for instant concept summaries and tailored questions, and pass the topic quiz with at least 75% to unlock the next lecture.
          </p>
        </div>

        {isTeacherOrAdmin && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add YouTube Lecture</span>
          </button>
        )}
      </div>

      {/* Global AI Status / Error Banners */}
      {aiStatusNotice && (
        <div className="p-3.5 rounded-xl bg-violet-950/60 border border-violet-500/40 text-violet-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <span>{aiStatusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAiStatusNotice(null)}
            className="text-violet-300 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {aiError && !activeLectureModal && !quizLecture && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{aiError}</span>
          </div>
          <button
            type="button"
            onClick={() => setAiError(null)}
            className="text-rose-300 hover:text-white p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Student Progress Tracker Card */}
      {isStudent && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Lecture Syllabus Progression: {currentUser.fullName}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {completedCount} / {lectures.length} Passed
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Rule: Pass each lecture's topic quiz (≥ 75%) to complete the step and unlock the next lesson.
              </div>
            </div>
          </div>

          <div className="w-full sm:w-48 flex items-center gap-2">
            <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-indigo-400">{progressPercent}%</span>
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search lectures by topic, faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-indigo-500 transition"
          />
        </div>

        {/* Class Filter for Faculty / Privacy Badge for Students */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isTeacherOrAdmin ? (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl">
              <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">Class:</span>
              <select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                className="bg-transparent text-xs text-indigo-300 font-semibold outline-none cursor-pointer"
              >
                <option value="All" className="bg-slate-900 text-white">All Classes</option>
                {ALL_INSTITUTIONAL_CLASSES.map((cls) => (
                  <option key={cls} value={cls} className="bg-slate-900 text-white">
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold whitespace-nowrap">
              <Lock className="w-3.5 h-3.5 text-indigo-400" />
              <span>{studentEnrolledClass} Curriculum</span>
            </div>
          )}

          {/* Subject Pills */}
          <div className="flex gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {subjects.map((sub) => (
              <button
                key={sub}
                type="button"
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                  selectedSubject === sub
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Lectures Grid with Sequential Lock Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLectures.map((lecture, index) => {
          const isDone = isStudent && lecture.completedBy?.includes(currentUser.id);
          const isUnlocked = isLectureUnlocked(lecture, index);

          return (
            <div
              key={lecture.id}
              className={`bg-slate-900 border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-xl relative group ${
                isDone
                  ? 'border-emerald-500/40 bg-slate-900/90'
                  : !isUnlocked
                  ? 'border-slate-800/60 opacity-70 bg-slate-950/60'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header info */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                      {lecture.subject}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300">
                      Step {index + 1}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      YouTube
                    </span>
                    {(lecture.aiAnalysis || lecture.quiz?.generatedByAi) && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>AI Quiz</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{lecture.duration}</span>
                  </div>
                </div>

                {/* Lecture Title */}
                <h3
                  onClick={() => {
                    if (isUnlocked) {
                      setAiError(null);
                      setActiveLectureModal(lecture);
                    }
                  }}
                  className={`text-base font-bold transition leading-snug mb-2 ${
                    isUnlocked
                      ? 'text-white hover:text-indigo-400 cursor-pointer'
                      : 'text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {lecture.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                  {lecture.description}
                </p>

                {/* Key Points Preview */}
                <div className="space-y-1 mb-4 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>{lecture.aiAnalysis ? 'AI Key Concepts' : 'Key Concepts'}</span>
                    {isDone ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>Quiz Passed (≥ 75%)</span>
                      </span>
                    ) : !isUnlocked ? (
                      <span className="text-amber-400 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Locked Step</span>
                      </span>
                    ) : (
                      <span className="text-indigo-400 font-bold">Quiz Required</span>
                    )}
                  </div>
                  {(lecture.aiAnalysis?.keyConcepts?.length ? lecture.aiAnalysis.keyConcepts : lecture.keyPoints)
                    .slice(0, 2)
                    .map((pt, i) => (
                      <div key={i} className="text-[11px] text-slate-300 flex items-start gap-1.5 line-clamp-1">
                        <span className="text-indigo-400">•</span>
                        <span>{pt}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Bottom Footer Actions */}
              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] min-w-0">
                  <UserIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate max-w-[95px]">{lecture.teacherName}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {!isUnlocked ? (
                    <div
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-amber-400 font-semibold"
                      title={`Pass Step ${index} quiz to unlock this lecture.`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Pass Step {index} First</span>
                    </div>
                  ) : (
                    <>
                      {/* Watch Video Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setAiError(null);
                          setActiveLectureModal(lecture);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-md shadow-indigo-600/20 cursor-pointer"
                      >
                        <Play className="w-3 h-3" />
                        <span>Watch</span>
                      </button>

                      {/* AI Analyze & Ask Quiz Quick Button */}
                      <button
                        type="button"
                        disabled={aiAnalyzingLectureId === lecture.id}
                        onClick={() =>
                          handleAnalyzeExistingLecture(lecture, { openQuizAfter: isStudent })
                        }
                        title={
                          isStudent
                            ? 'AI analyzes this YouTube video and asks a tailored quiz'
                            : 'Analyze video with AI and save tailored quiz questions'
                        }
                        className="px-2.5 py-1.5 rounded-xl bg-violet-600/90 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold text-[11px] flex items-center gap-1 shadow-md shadow-violet-600/20 cursor-pointer"
                      >
                        {aiAnalyzingLectureId === lecture.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3" />
                        )}
                        <span>{aiAnalyzingLectureId === lecture.id ? 'Analyzing...' : 'AI Quiz'}</span>
                      </button>

                      {/* Take Quiz Button */}
                      {isStudent && (
                        <button
                          type="button"
                          onClick={() => handleOpenQuiz(lecture)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 transition cursor-pointer ${
                            isDone
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60'
                              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20'
                          }`}
                        >
                          <HelpCircle className="w-3 h-3" />
                          <span>{isDone ? 'Passed ✓' : 'Quiz'}</span>
                        </button>
                      )}
                    </>
                  )}

                  {isTeacherOrAdmin && (
                    <div className="flex items-center gap-1 ml-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(lecture)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Edit YouTube Lecture"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      {confirmDeleteId === lecture.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteLecture(lecture.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-1.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[10px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(lecture.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                          title="Delete Lecture"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredLectures.length === 0 && (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl">
          <Video className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No digital lectures found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {isTeacherOrAdmin
              ? 'Click "+ Add YouTube Lecture" to publish an educational video and quiz for your students.'
              : 'No lectures matched your subject filter.'}
          </p>
        </div>
      )}

      {/* Video / Lecture Player Modal */}
      {activeLectureModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto text-slate-100 shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/20 text-indigo-400">
                    {activeLectureModal.subject}
                  </span>
                  <span className="text-xs text-slate-400">{activeLectureModal.classSec}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                    YouTube Stream
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
                  {activeLectureModal.title}
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  Delivered by {activeLectureModal.teacherName} • {activeLectureModal.duration}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveLectureModal(null)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* YouTube Video Player Embed */}
            <div className="bg-black aspect-video w-full flex items-center justify-center relative border-b border-slate-800">
              {activeLectureModal.videoUrl ? (
                <iframe
                  src={toYoutubeEmbed(activeLectureModal.videoUrl)}
                  title={activeLectureModal.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="text-center p-8">
                  <Video className="w-16 h-16 text-indigo-400/50 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-300">YouTube Video Lecture</p>
                </div>
              )}
            </div>

            {/* Details, AI Video Analysis & Take Quiz Callout */}
            <div className="p-4 sm:p-6 space-y-4">
              {/* AI Video Analyzer & Quiz Panel */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-violet-950/45 via-slate-950 to-indigo-950/40 border border-violet-500/35 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span>AI Lecture Video Analyzer & Quiz Assistant</span>
                      {activeLectureModal.aiAnalysis && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                          Video Analyzed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Let AI analyze this YouTube video to summarize core takeaways and ask you conceptual quiz questions directly from the lesson.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={aiAnalyzingLectureId === activeLectureModal.id}
                      onClick={() =>
                        handleAnalyzeExistingLecture(activeLectureModal, {
                          openQuizAfter: isStudent,
                        })
                      }
                      className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-bold shadow-lg shadow-violet-600/25 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      {aiAnalyzingLectureId === activeLectureModal.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {aiAnalyzingLectureId === activeLectureModal.id
                          ? 'Analyzing Video...'
                          : isStudent
                          ? 'Analyze Video & Ask AI Quiz'
                          : activeLectureModal.aiAnalysis
                          ? 'Re-analyze Video & Refresh Quiz'
                          : 'Analyze Video & Generate Quiz'}
                      </span>
                    </button>

                    {activeLectureModal.quiz?.generatedByAi && (
                      <button
                        type="button"
                        onClick={() => {
                          const lec = activeLectureModal;
                          setActiveLectureModal(null);
                          handleOpenQuiz(lec);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>Open AI Quiz ({activeLectureModal.quiz.questions.length} Qs)</span>
                      </button>
                    )}
                  </div>
                </div>

                {aiAnalyzingLectureId === activeLectureModal.id && (
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-violet-500/30 text-xs text-violet-200 flex items-center gap-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-400 shrink-0" />
                    <span>
                      AI is analyzing the YouTube video narration and visuals to build summary notes and quiz questions...
                    </span>
                  </div>
                )}

                {aiError && (
                  <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}

                {activeLectureModal.aiAnalysis && (
                  <div className="pt-2 border-t border-violet-500/20 space-y-2.5 text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-violet-300 mb-1">
                        AI Video Summary
                      </div>
                      <p className="text-slate-200 leading-relaxed">
                        {activeLectureModal.aiAnalysis.videoSummary}
                      </p>
                    </div>

                    {activeLectureModal.aiAnalysis.topicsCovered &&
                      activeLectureModal.aiAnalysis.topicsCovered.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {activeLectureModal.aiAnalysis.topicsCovered.map((topic, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-500/15 text-violet-200 border border-violet-500/30"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                      )}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Lecture Synopsis
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {activeLectureModal.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Key Takeaways & Conceptual Roadmap
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-300">
                  {activeLectureModal.keyPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-indigo-400 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Handout Attachments */}
              {activeLectureModal.resources && activeLectureModal.resources.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Zero-Paper Digital Handouts & Slides
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activeLectureModal.resources.map((res) => (
                      <div
                        key={res.id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="truncate">
                            <div className="text-xs font-semibold text-white truncate">{res.name}</div>
                            <div className="text-[10px] text-slate-500">{res.size} • {res.type}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAiStatusNotice(`Prepared digital lecture handout: ${res.name}`)
                          }
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                          title="Download handout"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Student Topic Quiz Action Bar */}
              {isStudent && (
                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Mandatory Topic Quiz</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Pass Mark: 75%
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {activeLectureModal.completedBy?.includes(currentUser.id)
                        ? '✓ You have passed the quiz and unlocked subsequent lectures.'
                        : 'You must answer the conceptual questions and score at least 75% to unlock the next step.'}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const lec = activeLectureModal;
                      setActiveLectureModal(null);
                      handleOpenQuiz(lec);
                    }}
                    className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg transition cursor-pointer flex items-center justify-center gap-2 ${
                      activeLectureModal.completedBy?.includes(currentUser.id)
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        : 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>{activeLectureModal.completedBy?.includes(currentUser.id) ? 'Retake Topic Quiz' : 'Take Topic Quiz to Complete'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          INTERACTIVE TOPIC QUIZ MODAL (Enforces ≥ 75% Passing Threshold)
          ========================================================================= */}
      {quizLecture && (() => {
        const activeQuestions = getQuizQuestionsForLecture(quizLecture);
        const totalQuestions = activeQuestions.length;

        return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto text-slate-100 shadow-2xl p-6">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4 gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    Topic Mastery Quiz
                  </span>
                  {quizLecture.quiz?.generatedByAi && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>AI Video Quiz</span>
                    </span>
                  )}
                  <span className="text-xs text-slate-400">{quizLecture.subject}</span>
                  <span className="text-xs font-bold text-amber-300">Passing Threshold: 75%</span>
                </div>
                <h2 className="text-lg font-bold text-white mt-1">
                  Quiz on: {quizLecture.title}
                </h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  Answer all {totalQuestions} conceptual questions. If you fail (&lt; 75%), you will not be allowed to proceed to the next step.
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={aiAnalyzingLectureId === quizLecture.id}
                  onClick={() => handleAnalyzeExistingLecture(quizLecture)}
                  className="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-violet-600/20"
                  title="Have AI analyze the lecture video and ask a fresh set of questions"
                >
                  {aiAnalyzingLectureId === quizLecture.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {aiAnalyzingLectureId === quizLecture.id
                      ? 'Analyzing Video...'
                      : 'Ask Fresh AI Quiz from Video'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setQuizLecture(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {aiError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-950/70 border border-rose-700/60 text-rose-200 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{aiError}</span>
              </div>
            )}

            {quizLecture.aiAnalysis?.videoSummary && (
              <div className="mb-4 p-3.5 rounded-xl bg-violet-950/35 border border-violet-500/30 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-violet-300 flex items-center gap-1.5 mb-1">
                  <Brain className="w-3.5 h-3.5" />
                  <span>AI Video Analysis Context</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {quizLecture.aiAnalysis.videoSummary}
                </p>
              </div>
            )}

            {/* Quiz Result Banner */}
            {quizSubmitted && quizScore && (
              <div
                className={`p-4 rounded-xl border mb-6 ${
                  quizScore.passed
                    ? 'bg-emerald-950/80 border-emerald-600/70 text-emerald-200'
                    : 'bg-rose-950/80 border-rose-600/70 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {quizScore.passed ? (
                    <Award className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      {quizScore.passed
                        ? `Congratulations! You Passed (${quizScore.percentage}% - ${quizScore.correct}/${quizScore.total} Correct)`
                        : `Quiz Failed: Score ${quizScore.percentage}% (${quizScore.correct}/${quizScore.total} Correct)`}
                    </h3>
                    <p className="text-xs mt-1 leading-relaxed">
                      {quizScore.passed
                        ? 'You have successfully satisfied the 75% threshold! This lecture is now marked completed, and the subsequent lecture step has been unlocked for you.'
                        : 'Institutional Rule: You scored below the mandatory 75% threshold. You are NOT permitted to complete this lecture or proceed to the next step. Please review the video lecture and retake the quiz.'}
                    </p>

                    <div className="mt-3 flex items-center gap-2">
                      {!quizScore.passed && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAnswers({});
                            setQuizSubmitted(false);
                            setQuizScore(null);
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retake Quiz Now</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const lec = quizLecture;
                          setQuizLecture(null);
                          setActiveLectureModal(lec);
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
                      >
                        Rewatch YouTube Video
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-5">
              {activeQuestions.map((q, qIdx) => {
                const userChoice = selectedAnswers[qIdx];
                const targetAns = q.correctAnswerIndex ?? q.correctOption ?? 0;
                const isCorrect = quizSubmitted && userChoice === targetAns;
                const isWrong = quizSubmitted && userChoice !== undefined && userChoice !== targetAns;

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-xl border transition ${
                      quizSubmitted
                        ? isCorrect
                          ? 'bg-emerald-950/30 border-emerald-800/60'
                          : isWrong
                          ? 'bg-rose-950/30 border-rose-800/60'
                          : 'bg-slate-950/80 border-slate-800'
                        : 'bg-slate-950/80 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-white mb-2">
                      <span className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 flex items-center justify-center text-[10px] shrink-0">
                          {qIdx + 1}
                        </span>
                        <span>{q.question}</span>
                      </span>
                      {quizSubmitted && (
                        <span className="shrink-0 ml-2">
                          {isCorrect && <span className="text-emerald-400 font-bold">✓ Correct</span>}
                          {isWrong && <span className="text-rose-400 font-bold">✗ Incorrect</span>}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 mt-3">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = userChoice === oIdx;
                        const isThisOptionCorrect = quizSubmitted && oIdx === targetAns;

                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={quizSubmitted}
                            onClick={() => {
                              setSelectedAnswers({
                                ...selectedAnswers,
                                [qIdx]: oIdx,
                              });
                            }}
                            className={`w-full text-left p-2.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center justify-between border ${
                              isThisOptionCorrect
                                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 font-bold'
                                : isSelected
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:bg-slate-800/80 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] text-slate-400">
                                [{String.fromCharCode(65 + oIdx)}]
                              </span>
                              <span>{opt}</span>
                            </div>

                            {isSelected && !quizSubmitted && (
                              <Check className="w-3.5 h-3.5 text-white" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {quizSubmitted && q.explanation && (
                      <div className="mt-2.5 pt-2 border-t border-slate-900 text-[11px] text-slate-400">
                        <strong className="text-slate-300">Explanation:</strong> {q.explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quiz Submit Bar */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400">
                {Object.keys(selectedAnswers).length} of {totalQuestions} answered
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuizLecture(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>

                {!quizSubmitted ? (
                  <button
                    type="button"
                    onClick={handleSubmitQuiz}
                    disabled={Object.keys(selectedAnswers).length < totalQuestions}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit Quiz Answers
                  </button>
                ) : (
                  quizScore?.passed && (
                    <button
                      type="button"
                      onClick={() => setQuizLecture(null)}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 cursor-pointer"
                    >
                      Done & Proceed ✓
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
        );
      })()}

      {/* =========================================================================
          TEACHER ADD / EDIT LECTURE MODAL (Strictly Enforces YouTube Video Only)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-rose-500/20 text-rose-300 border border-rose-500/30 inline-block mb-1">
                  YouTube Video Required
                </span>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Video className="w-5 h-5 text-indigo-400" />
                  <span>{editingLecture ? 'Edit YouTube Lecture' : 'Publish New YouTube Lecture (Teacher)'}</span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-rose-950/80 border border-rose-700/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveLecture} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Lecture Title
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Thermodynamics & Heat Engines"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              {/* Strict YouTube Video URL Input + AI Video Analyzer */}
              <div className="p-3.5 bg-rose-950/20 border border-rose-800/40 rounded-xl space-y-2">
                <label className="block text-[11px] font-extrabold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-rose-400" />
                  <span>YouTube Video Link (Required)</span>
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    required
                    value={formVideoUrl}
                    onChange={(e) => setFormVideoUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="flex-1 px-3 py-2 bg-slate-950 border border-rose-800/50 rounded-xl text-white outline-none focus:border-rose-500 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={isAnalyzingFormVideo}
                    onClick={handleAnalyzeFormVideo}
                    className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-md shadow-violet-600/20"
                  >
                    {isAnalyzingFormVideo ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>{isAnalyzingFormVideo ? 'Analyzing Video...' : 'Analyze Video & Build AI Quiz'}</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  Institutional policy: Only YouTube video links are permitted. Click "Analyze Video & Build AI Quiz" to let AI watch the video, fill concepts, and generate a custom quiz.
                </p>

                {formAiQuiz && formAiAnalysis && (
                  <div className="mt-2 p-2.5 rounded-xl bg-violet-950/40 border border-violet-500/35 text-[11px] text-violet-200 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-violet-300">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span>
                        AI Video Analysis Ready ({formAiQuiz.questions.length} tailored quiz questions generated)
                      </span>
                    </div>
                    <p className="text-slate-300 line-clamp-2">{formAiAnalysis.videoSummary}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Subject
                  </label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Mathematics">Mathematics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Computer Science">Computer Science</option>
                    <option value="English">English</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Target Class (To which class are you assigning this lecture?)
                  </label>
                  <select
                    required
                    value={formClassSec}
                    onChange={(e) => setFormClassSec(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500 text-xs font-semibold"
                  >
                    <option value="All">All Classes (School-wide)</option>
                    {ALL_INSTITUTIONAL_CLASSES.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Estimated Duration
                </label>
                <input
                  type="text"
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="45 mins"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Lecture Description / Synopsis
                </label>
                <textarea
                  rows={3}
                  required
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Outline key derivations, equations, and topics covered..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Key Takeaways (one per line)
                </label>
                <textarea
                  rows={2}
                  value={formKeyPoints}
                  onChange={(e) => setFormKeyPoints(e.target.value)}
                  placeholder="Concept 1: Definition of Work&#10;Concept 2: Conservation law..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Digital Handout / Slides Attachment
                </label>
                <input
                  type="text"
                  value={formResourceName}
                  onChange={(e) => setFormResourceName(e.target.value)}
                  placeholder="e.g. Chapter4_Formulas_Handout.pdf"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white outline-none focus:border-indigo-500"
                />
              </div>

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
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 cursor-pointer"
                >
                  {editingLecture ? 'Save Updates' : 'Publish YouTube Lecture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
