import express from 'express';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy Gemini client getter
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Digitize Paper Content into Structured Digital Workflow
app.post('/api/gemini/digitize', async (req, res) => {
  try {
    const { rawText, workflowType, targetAudience, audienceCount = 50 } = req.body;

    if (!rawText || typeof rawText !== 'string') {
      return res.status(400).json({ error: 'Text content is required' });
    }

    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `You are an expert institutional sustainability and paperless digitization specialist.
A user has provided the following paper-based notice, register template, assignment, or memo that used to be printed on paper:

"${rawText}"

Context:
- Suggested Workflow Category: ${workflowType || 'notice'} (can be 'notice', 'register', 'assignment', 'receipt_bill', 'record')
- Target Audience: ${targetAudience || 'institution'}
- Number of recipients/copies typically printed: ${audienceCount}

Convert this into a modernized digital internet entity.
Return ONLY valid JSON with this exact schema:
{
  "title": "Clean, descriptive digital title",
  "category": "notice" | "register" | "assignment" | "receipt_bill" | "record",
  "department": "Academic" | "Hostel" | "Administration" | "Finance" | "General",
  "priority": "High" | "Medium" | "Low",
  "formattedContent": "Clean markdown or formatted text representation for screen viewing",
  "keyFields": [
    { "label": "string", "value": "string" }
  ],
  "actionItems": ["string"],
  "estimatedPagesPerCopy": number,
  "totalSheetsSaved": number,
  "treesSavedFraction": number,
  "waterSavedLiters": number,
  "carbonSavedKg": number,
  "costSavedUSD": number,
  "digitalAdvantageExplanation": "Explain why sending/viewing this over the internet saves ink, paper, reprint time, and physical space"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          return res.json({ success: true, data: parsed, source: 'gemini' });
        }
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to local digitizer:', err.message);
      }
    }

    // Fallback heuristic parsing when Gemini key is not configured or fails
    const pages = Math.max(1, Math.ceil(rawText.length / 500));
    const totalSheets = pages * Number(audienceCount || 40);
    const trees = Number((totalSheets / 8333).toFixed(4));
    const water = totalSheets * 10;
    const carbon = Number((totalSheets * 0.05).toFixed(2));
    const cost = Number((totalSheets * 0.08).toFixed(2));

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const fallbackTitle = lines[0]?.slice(0, 60) || 'Digitized Document';

    return res.json({
      success: true,
      data: {
        title: fallbackTitle,
        category: workflowType || 'notice',
        department: 'General',
        priority: 'Medium',
        formattedContent: rawText,
        keyFields: [
          { label: 'Recipient Count', value: `${audienceCount} recipients via instant internet link` },
          { label: 'Original Paper Pages', value: `${pages} printed sheet(s) per person` },
          { label: 'Zero-Print Distribution', value: 'Broadcasted electronically without ink or physical file' },
        ],
        actionItems: [
          'Review information digitally',
          'Acknowledge or reply online without paper slips',
        ],
        estimatedPagesPerCopy: pages,
        totalSheetsSaved: totalSheets,
        treesSavedFraction: trees,
        waterSavedLiters: water,
        carbonSavedKg: carbon,
        costSavedUSD: cost,
        digitalAdvantageExplanation:
          'By distributing this document over the internet, no physical copies needed printing, updating can be performed instantly without reprinting, and it occupies zero shelf space.',
      },
      source: 'local-heuristic',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// AI Student Performance Diagnostic Analysis
app.post('/api/gemini/analyze-student', async (req, res) => {
  try {
    const { studentName, grade } = req.body;
    const ai = getGeminiClient();

    if (ai && grade) {
      try {
        const prompt = `You are an elite educational counselor and academic performance analyst for the SDBMS (Student Database & Management System).
Analyze this student's grade matrix:
Student Name: ${studentName || grade.studentName}
Class / Section: ${grade.classSec}
Total Marks: ${grade.totalMarks}/${grade.maxPossible} (${grade.percentage}%)
Letter Grade: ${grade.grade}
Subject Breakdown: ${JSON.stringify(grade.scores)}

Generate an academic diagnostic in valid JSON with this exact schema:
{
  "overallStatus": "Short executive summary of academic standing",
  "strengthArea": "Detailed recognition of top performing subjects and competencies",
  "opportunityArea": "Constructive analysis of subjects with room for growth",
  "recommendedActions": ["action item 1", "action item 2", "action item 3"],
  "estimatedReadiness": "Projection for board exams, Olympiads, and future terms"
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({ success: true, data: parsed, source: 'gemini' });
        }
      } catch (err: any) {
        console.warn('Gemini student analysis failed:', err.message);
      }
    }

    // Heuristic fallback
    const scores = grade?.scores ? Object.entries(grade.scores) : [];
    const highest = [...scores].sort((a, b) => (b[1] as number) - (a[1] as number))[0];
    const lowest = [...scores].sort((a, b) => (a[1] as number) - (b[1] as number))[0];

    return res.json({
      success: true,
      data: {
        overallStatus: `Student demonstrates strong scholastic engagement with an aggregate score of ${grade?.percentage || 85}%.`,
        strengthArea: `Highest performance registered in ${highest ? highest[0].replace('sub-', '').toUpperCase() : 'analytical modules'} (${highest ? highest[1] : 90}/100).`,
        opportunityArea: `Marginal opportunity in ${lowest ? lowest[0].replace('sub-', '').toUpperCase() : 'core disciplines'} (${lowest ? lowest[1] : 72}/100).`,
        recommendedActions: [
          'Solve two timed practice problem sets weekly to build pacing.',
          'Form peer study circles for structured problem discussions.',
          'Schedule targeted 20-minute bi-weekly consultations with course faculty.'
        ],
        estimatedReadiness: 'High readiness for semester finals and competitive scholarship assessments.'
      },
      source: 'local-heuristic'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Diagnostic failed' });
  }
});

// AI Advisor Query
app.post('/api/gemini/advisor-query', async (req, res) => {
  try {
    const { query, studentContext } = req.body;
    const ai = getGeminiClient();

    if (ai && query) {
      try {
        const prompt = `You are the AI Academic Advisor in the Sri Sathya Sai Anandam SDBMS portal.
Context: ${JSON.stringify(studentContext || {})}
User Query: "${query}"

Provide a concise, encouraging, and actionable response (formatted in clean markdown, 3-4 bullet points) focused on academic mastery, study pacing, zero-paper digital habits, and examination preparation.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        if (response.text) {
          return res.json({ success: true, text: response.text, source: 'gemini' });
        }
      } catch (err: any) {
        console.warn('Gemini advisor failed:', err.message);
      }
    }

    return res.json({
      success: true,
      text: `### Strategic Recommendations:\n\n- **Structured Pacing**: Allocate 45-minute focused blocks followed by a 10-minute conceptual review.\n- **Zero-Paper Revision**: Leverage the digital academic matrix and online practice materials to track mistake logs electronically.\n- **Subject Balancing**: Dedicate earlier study sessions to high-friction numerical or scientific concepts before moving to review tasks.\n- **Faculty Consultation**: Utilize digital office hours to clarify edge cases and derivation proofs.`,
      source: 'local-heuristic'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Advisor request failed' });
  }
});

// Institutional Paper Audit API
app.post('/api/gemini/audit', async (req, res) => {
  try {
    const { institutionType, studentCount, staffCount, noticeFrequency, printBudgetMonthly } = req.body;
    const ai = getGeminiClient();

    if (ai) {
      try {
        const prompt = `Conduct a rigorous paper-waste reduction audit for:
Institution Type: ${institutionType}
User/Student Count: ${studentCount}
Staff/Teacher Count: ${staffCount}
Printed notices/circulars per month: ${noticeFrequency}
Estimated Monthly Printing Budget: $${printBudgetMonthly}

Provide strategic recommendations and mathematical impact of adopting Internet-based digital alternatives (online notices, digital registers, homework portals, cloud records, digital receipts).
Return ONLY JSON with this format:
{
  "summary": "string",
  "yearlySheetsAvoided": number,
  "yearlyTreesConserved": number,
  "yearlyWaterSavedLiters": number,
  "yearlyDollarSavings": number,
  "topTransitions": [
    { "paperMethod": "string", "internetAlternative": "string", "sheetsSavedMonthly": number, "primaryBenefit": "string" }
  ],
  "implementationRoadmap": [
    { "phase": "string", "duration": "string", "keyMilestone": "string" }
  ]
}`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        if (response.text) {
          const parsed = JSON.parse(response.text);
          return res.json({ success: true, data: parsed, source: 'gemini' });
        }
      } catch (e: any) {
        console.warn('Gemini audit failed, using fallback:', e.message);
      }
    }

    // Heuristic calculation fallback
    const totalUsers = (Number(studentCount) || 500) + (Number(staffCount) || 50);
    const noticesPerMonth = Number(noticeFrequency) || 12;
    const monthlySheets = noticesPerMonth * totalUsers * 1.5 + totalUsers * 10;
    const yearlySheets = Math.round(monthlySheets * 12);
    const yearlyTrees = Number((yearlySheets / 8333).toFixed(2));
    const yearlyWater = yearlySheets * 10;
    const yearlyDollars = Math.round(yearlySheets * 0.08);

    return res.json({
      success: true,
      data: {
        summary: `By migrating ${institutionType} operations to internet-based communications and cloud document storage, you eliminate over ${yearlySheets.toLocaleString()} paper sheets annually.`,
        yearlySheetsAvoided: yearlySheets,
        yearlyTreesConserved: yearlyTrees,
        yearlyWaterSavedLiters: yearlyWater,
        yearlyDollarSavings: yearlyDollars,
        topTransitions: [
          {
            paperMethod: 'Printed Notice Board & Circulars',
            internetAlternative: 'Real-time Digital Notification Feed & Broadcasts',
            sheetsSavedMonthly: Math.round(noticesPerMonth * totalUsers),
            primaryBenefit: 'Instant distribution to thousands with zero reprint cost on edits',
          },
          {
            paperMethod: 'Bound Daily Attendance Registers',
            internetAlternative: 'Cloud Digital Attendance Logs',
            sheetsSavedMonthly: Math.round(totalUsers * 4),
            primaryBenefit: 'No bulky physical registers taking up staff room cabinet space',
          },
          {
            paperMethod: 'Printed Homework & Assignment Handouts',
            internetAlternative: 'Online Assignment Portal & PDF Resource Hub',
            sheetsSavedMonthly: Math.round(totalUsers * 6),
            primaryBenefit: 'Direct digital submission and electronic feedback loop',
          },
          {
            paperMethod: 'Paper Receipts, Fee Slips & Application Forms',
            internetAlternative: 'Instant Web Receipts & Digital Approval Workflows',
            sheetsSavedMonthly: Math.round(totalUsers * 2),
            primaryBenefit: 'Searchable forever, tamper-evident, zero carbon paper',
          },
        ],
        implementationRoadmap: [
          { phase: 'Phase 1: Zero-Print Notice Policy', duration: 'Week 1-2', keyMilestone: 'Adopt web circulars for all school/office announcements' },
          { phase: 'Phase 2: Digital Register & Attendance', duration: 'Week 3-4', keyMilestone: 'Retire physical paper attendance registers across all sections' },
          { phase: 'Phase 3: Online Homework & Materials', duration: 'Month 2', keyMilestone: 'Distribute study guides and homework digitally via portal' },
          { phase: 'Phase 4: Cloud Records & E-Receipts', duration: 'Month 3', keyMilestone: 'Digitize fee receipts, vouchers, and permanent archives' },
        ],
      },
      source: 'local-heuristic',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Audit computation failed' });
  }
});

// Helper: Extract canonical YouTube watch URL from any YouTube link format
function toCanonicalYoutubeUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  if (match && match[1]) {
    return `https://www.youtube.com/watch?v=${match[1]}`;
  }
  return null;
}

// AI Lecture Video Analysis & Quiz Generator (YouTube Video -> Summary + Key Concepts + MCQ Quiz)
app.post('/api/gemini/analyze-lecture-video', async (req, res) => {
  try {
    const {
      videoUrl,
      title,
      subject,
      classSec,
      description,
      keyPoints,
      questionCount = 4,
    } = req.body || {};

    const canonicalYoutubeUrl = toCanonicalYoutubeUrl(videoUrl);
    if (!canonicalYoutubeUrl) {
      return res.status(400).json({
        error:
          'Please provide a valid YouTube video URL (youtube.com/watch?v=... or youtu.be/...) so AI can analyze the lecture video.',
      });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({
        error:
          'Gemini API key is not configured on the server. Please add GEMINI_API_KEY in Settings > Secrets to enable AI video analysis and quiz generation.',
      });
    }

    const clampedCount = Math.min(8, Math.max(3, Number(questionCount) || 4));
    const safeKeyPoints = Array.isArray(keyPoints)
      ? keyPoints.filter((p) => typeof p === 'string' && p.trim()).join('; ')
      : '';

    const prompt = `You are an expert school educator and curriculum assessor.
Watch and analyze the attached YouTube lecture video carefully (both spoken audio/narration and visual slides/board work).

Lecture metadata (for context):
- Title: ${title || 'Classroom Video Lecture'}
- Subject: ${subject || 'General'}
- Target Class: ${classSec || 'Secondary School'}
${description ? `- Teacher Synopsis: ${description}` : ''}
${safeKeyPoints ? `- Listed Key Points: ${safeKeyPoints}` : ''}

Tasks:
1. Write a clear, accurate "videoSummary" (2-4 sentences) summarizing what is actually taught and demonstrated in the video.
2. Extract 4 to 6 concrete "keyConcepts" (short bullet points of definitions, formulas, or ideas covered in the video).
3. List 3 to 5 "topicsCovered" (short topic labels from the video).
4. Create ${clampedCount} conceptual multiple-choice "questions" that directly test student understanding of the material taught in this video:
   - Each question must have exactly 4 distinct answer choices in "options".
   - "correctAnswerIndex" must be an integer 0, 1, 2, or 3 corresponding to the single correct choice in "options".
   - "explanation" must briefly explain why the correct answer is right based on the video content.
   - Make questions age-appropriate for ${classSec || 'school students'} and avoid trivial "all of the above" options.`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: [
        {
          fileData: {
            fileUri: canonicalYoutubeUrl,
            mimeType: 'video/mp4',
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videoSummary: { type: Type.STRING },
            keyConcepts: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            topicsCovered: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  correctAnswerIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING },
                },
                required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
              },
            },
          },
          required: ['videoSummary', 'keyConcepts', 'topicsCovered', 'questions'],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      return res.status(502).json({
        error: 'Gemini returned an empty response while analyzing the lecture video.',
      });
    }

    const parsed = JSON.parse(rawText);
    const normalizedQuestions = Array.isArray(parsed.questions)
      ? parsed.questions
          .filter((q: any) => q && typeof q.question === 'string' && Array.isArray(q.options) && q.options.length >= 2)
          .slice(0, clampedCount)
          .map((q: any, idx: number) => {
            const opts = q.options.slice(0, 4).map((o: any) => String(o));
            while (opts.length < 4) {
              opts.push(`Option ${opts.length + 1}`);
            }
            const rawIdx = Number(q.correctAnswerIndex);
            const safeIdx = Number.isInteger(rawIdx) && rawIdx >= 0 && rawIdx < opts.length ? rawIdx : 0;
            return {
              id: `ai-q-${Date.now()}-${idx + 1}`,
              question: q.question.trim(),
              options: opts,
              correctOption: safeIdx,
              correctAnswerIndex: safeIdx,
              explanation: String(q.explanation || 'Derived from the lecture video content.').trim(),
            };
          })
      : [];

    if (normalizedQuestions.length === 0) {
      return res.status(502).json({
        error: 'AI analysis completed but did not produce valid quiz questions. Please try again.',
      });
    }

    return res.json({
      success: true,
      source: 'gemini',
      model: 'gemini-4-hydrogen',
      canonicalYoutubeUrl,
      data: {
        videoSummary: String(parsed.videoSummary || '').trim(),
        keyConcepts: Array.isArray(parsed.keyConcepts)
          ? parsed.keyConcepts.map((c: any) => String(c).trim()).filter(Boolean)
          : [],
        topicsCovered: Array.isArray(parsed.topicsCovered)
          ? parsed.topicsCovered.map((t: any) => String(t).trim()).filter(Boolean)
          : [],
        questions: normalizedQuestions,
        analyzedAt: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('Gemini analyze-lecture-video error:', err);
    const message = err?.message || 'Failed to analyze YouTube video with Gemini AI.';
    const status =
      message.includes('API key') || message.includes('PERMISSION_DENIED')
        ? 403
        : message.includes('INVALID_ARGUMENT') || message.includes('not found') || message.includes('private')
        ? 400
        : 502;
    return res.status(status).json({
      error: `AI Video Analysis failed: ${message}`,
    });
  }
});

// Vite middleware & Static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Reduce Paper Demand Server running at http://localhost:${PORT}`);
  });
}

startServer();
