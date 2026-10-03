/**
 * Analytics Job Scout v2 - Daily Interview Coach
 * Voice & text mock interviews, calibrated deterministic rubric scoring, filler-word analysis,
 * speech recognition/synthesis, communication drills, streak tracking, and optional progressive AI feedback.
 */
(function(window) {
  'use strict';

  const PREFIX = 'ajs.v2.';
  const FILLER_WORDS = ['um', 'uh', 'like', 'basically', 'actually', 'you know', 'kind of', 'sort of', 'i mean', 'so yeah', 'right?'];

  const COMMUNICATION_DRILLS = [
    {
      id: 'drill_intro',
      title: '60-Second Self-Introduction',
      subtitle: 'The quintessential "Tell me about yourself" for freshers and career transitioners.',
      prompt: 'Deliver a crisp, professional 60-second introduction highlighting your background, analytical toolset (SQL, BI, Python), key project, and enthusiasm for this role.',
      targetSeconds: 60,
      structureChecklist: [
        'Present: Current education / focus area',
        'Past: 1 relevant analytics project with measurable outcome',
        'Skills: Top tools mentioned naturally (e.g. SQL, Power BI)',
        'Future: Why you are passionate about data analytics'
      ],
      sampleAnswer: 'Hello! I am an early-career data analyst with hands-on expertise in SQL, Power BI, and Python. Recently, I built an end-to-end sales performance project analyzing 50,000+ transaction records where I designed a star schema and interactive dashboards that highlighted customer retention patterns. I love uncovering actionable insights from messy data, and I am excited to bring my technical foundation and curiosity to your analytics team.'
    },
    {
      id: 'drill_nontech_project',
      title: 'Explain a Project to a Non-Technical Stakeholder',
      subtitle: 'Demonstrate data storytelling without relying on jargon like CTEs or p-values.',
      prompt: 'Explain your most proud analytics project to an operations manager or marketing lead who has no background in SQL or machine learning.',
      targetSeconds: 75,
      structureChecklist: [
        'The Business Problem: What was costing time or money?',
        'The Action: How you gathered and simplified the data (no heavy jargon)',
        'The Visual/Result: What the stakeholder could now see and do',
        'The Business Impact: Time saved, cost reduced, or decision enabled'
      ],
      sampleAnswer: 'Our marketing team was unsure which customer campaigns were actually driving repeat purchases. I collected data across email and sales channels, cleaned out duplicates, and created a visual dashboard. For the first time, the team could filter by customer age and see exactly which campaign led to repeat orders, helping them reallocate 20% of their quarterly ad budget to the highest-performing channel.'
    },
    {
      id: 'drill_dashboard_insight',
      title: 'Explain a Dashboard Insight',
      subtitle: 'Present a key finding clearly and propose the next logical business step.',
      prompt: 'You notice in your Power BI dashboard that customer churn increased by 18% in the southern region last quarter. Present this insight to your team lead.',
      targetSeconds: 60,
      structureChecklist: [
        'State the headline finding clearly with exact metric (18% churn increase)',
        'Isolate the segment or dimension (Southern region, last quarter)',
        'Identify probable contributing factor or anomaly',
        'Propose an immediate next step to investigate'
      ],
      sampleAnswer: 'Hi team, while reviewing our quarterly customer metrics, I noticed an 18% spike in churn specifically in our southern territory. Looking deeper into the customer categories, the drop was concentrated among new subscribers who joined during the summer campaign. I propose pulling the customer support ticket logs for this cohort today so we can identify whether this is linked to delivery delays or product confusion.'
    },
    {
      id: 'drill_vague_request',
      title: 'Clarify a Vague Business Request',
      subtitle: 'Ask smart clarifying questions when a manager says "Give me a report on sales".',
      prompt: 'A business stakeholder asks you: "Can you send me a quick report on our sales performance?" How do you respond to clarify requirements without sounding unhelpful?',
      targetSeconds: 45,
      structureChecklist: [
        'Acknowledge request enthusiastically',
        'Clarify the core decision they need to make',
        'Clarify timeframe, granularity, and format (Excel vs Dashboard)',
        'Confirm the deadline'
      ],
      sampleAnswer: 'I would be glad to put that together! To make sure it gives you exactly what you need for your decision: Which time period should we focus on—this month compared to last month, or year-to-date? Also, are you looking for high-level revenue figures by region, or a detailed product breakdown in Excel? Let me know your target deadline so I can prioritize it accordingly.'
    },
    {
      id: 'drill_status_update',
      title: 'Deliver a Concise Status Update',
      subtitle: 'Daily standup communication: what is done, what is next, and blockers.',
      prompt: 'Give your 30-second standup status update on building an automated data cleaning script.',
      targetSeconds: 30,
      structureChecklist: [
        'Completed: What was accomplished yesterday',
        'Planned: What will be done today',
        'Blockers: Explicitly state if clear or if assistance is needed'
      ],
      sampleAnswer: 'Yesterday I finished the SQL queries for extracting raw transactions and validated missing values in Python. Today, I am building the automated error-checking logic and testing edge cases with null dates. No blockers currently—I plan to have the draft dataset ready for peer review by 3 PM.'
    },
    {
      id: 'drill_candidate_questions',
      title: 'Ask Thoughtful Questions at Interview End',
      subtitle: '"Do you have any questions for us?" — demonstrate genuine curiosity and culture fit.',
      prompt: 'The interviewer asks: "We have 5 minutes left. What questions do you have for me?" Ask 2 high-impact questions.',
      targetSeconds: 60,
      structureChecklist: [
        'Question 1: Focus on team analytics stack, data maturity, or day-to-day workflow',
        'Question 2: Focus on success criteria for this role in the first 90 days',
        'Polite closing appreciation'
      ],
      sampleAnswer: 'Thank you! I have two questions. First, what does the day-to-day collaboration look like between the data analyst and business stakeholders—are analysts embedded in product teams, or centralized? Second, for a junior analyst joining your team, what would success look like in the first 90 days? Thank you so much for this conversation today.'
    }
  ];

  // -------------------------------------------------------------
  // Speech Recognition & Synthesis Wrappers
  // -------------------------------------------------------------
  const Speech = {
    isRecognitionSupported: function() {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    },

    isSynthesisSupported: function() {
      return !!(window.speechSynthesis && window.SpeechSynthesisUtterance);
    },

    createRecognizer: function(onTranscript, onError, onEnd) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return null;

      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-IN';

      recognizer.onresult = function(event) {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + ' ';
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        if (onTranscript) {
          onTranscript({
            final: finalTranscript.trim(),
            interim: interimTranscript.trim()
          });
        }
      };

      recognizer.onerror = function(event) {
        console.warn('[Speech] Recognition error:', event.error);
        if (onError) onError(event.error);
      };

      recognizer.onend = function() {
        if (onEnd) onEnd();
      };

      return recognizer;
    },

    speak: function(text, onComplete) {
      if (!Speech.isSynthesisSupported()) {
        if (onComplete) onComplete();
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.lang = 'en-US';

        utterance.onend = function() {
          if (onComplete) onComplete();
        };
        utterance.onerror = function() {
          if (onComplete) onComplete();
        };
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('[Speech] Speak error:', e);
        if (onComplete) onComplete();
      }
    },

    stopSpeaking: function() {
      if (Speech.isSynthesisSupported()) {
        window.speechSynthesis.cancel();
      }
    }
  };

  // -------------------------------------------------------------
  // Calibrated Deterministic Offline Rubric Analyzer
  // -------------------------------------------------------------
  function analyzeTranscript(transcript, questionObj, durationSeconds) {
    const text = (transcript || '').trim();
    if (!text) {
      return {
        score: 0,
        wordCount: 0,
        durationSeconds: Math.round(durationSeconds || 0),
        wpm: 0,
        pacingAssessment: 'No answer provided',
        totalFillers: 0,
        fillerCounts: {},
        matchedKeywords: [],
        missingKeywords: (questionObj && questionObj.rubricKeywords) ? questionObj.rubricKeywords : [],
        starCoverage: { situation: false, task: false, action: false, result: false },
        starCount: 0,
        metricsFound: [],
        breakdown: { substance: 0, concepts: 0, structure: 0, metrics: 0, pacing: 0, deductions: 0 },
        disclaimer: 'Voice pace & metrics are approximate heuristics. No accent, gender, or demographic traits are evaluated.'
      };
    }

    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // 1. Words Per Minute Pacing
    const duration = Math.max(1, durationSeconds || 30);
    const minutes = duration / 60;
    const wpm = Math.round(wordCount / minutes);

    let pacingAssessment = 'Optimal pace';
    let pacingPoints = 8; // Default for typed text
    if (durationSeconds && durationSeconds > 3) {
      if (wpm >= 110 && wpm <= 155) {
        pacingAssessment = 'Optimal natural interview pace (110–155 WPM)';
        pacingPoints = 10;
      } else if ((wpm >= 85 && wpm < 110) || (wpm > 155 && wpm <= 175)) {
        pacingAssessment = wpm < 110 ? 'Slightly deliberate / slow' : 'Slightly fast';
        pacingPoints = 7;
      } else if (wpm < 85) {
        pacingAssessment = 'Too slow / hesitant (aim for 110–140 WPM)';
        pacingPoints = 4;
      } else {
        pacingAssessment = 'Too fast (pause after key points for clarity)';
        pacingPoints = 4;
      }
    }

    // 2. Filler word detection
    const lower = text.toLowerCase();
    const fillerCounts = {};
    let totalFillers = 0;

    FILLER_WORDS.forEach(fw => {
      const rx = new RegExp(`(^|\\b)${fw}(\\b|$)`, 'gi');
      const matches = lower.match(rx);
      if (matches && matches.length > 0) {
        fillerCounts[fw] = matches.length;
        totalFillers += matches.length;
      }
    });

    // 3. Rubric Keywords / Key Concept Matching (with basic stemming)
    const rubricKeywords = (questionObj && Array.isArray(questionObj.rubricKeywords)) ? questionObj.rubricKeywords : [];
    const matchedKeywords = [];
    const missingKeywords = [];

    rubricKeywords.forEach(kw => {
      // Build a flexible pattern: e.g. "clean" matches "cleaning", "cleaned", "cleans"
      const baseStem = kw.toLowerCase().replace(/(ing|ed|s|es)$/, '');
      const pattern = baseStem.length >= 3 ? baseStem : kw;
      const rx = new RegExp(`(^|[^a-zA-Z0-9])${pattern}`, 'i');
      if (rx.test(lower)) {
        matchedKeywords.push(kw);
      } else {
        missingKeywords.push(kw);
      }
    });

    // 4. STAR Methodology Coverage (Situation, Task, Action, Result)
    const starMatches = {
      situation: /(situation|context|project was|company was|background|when I was|working on|scenario|analyzing|dataset)/i.test(lower),
      task: /(task|goal|objective|needed to|assigned to|responsible for|target was|challenge|aim was)/i.test(lower),
      action: /(action|built|created|engineered|queried|analyzed|designed|developed|implemented|automated|calculated|modeled|extracted|cleaned|tested)/i.test(lower),
      result: /(result|outcome|impact|achieved|reduced|increased|improved|saved|delivered|metric|helped|concluded|identified|highlighted)/i.test(lower)
    };
    const starCount = Object.values(starMatches).filter(Boolean).length;

    // 5. Quantifiable Metrics & Evidence (supports commas like 45,000 and % like 18%)
    const metricsFound = lower.match(/(?:\b\d{1,3}(?:,\d{3})*|\b\d+)(?:\.\d+)?%|[$₹]\s*\d+|\b\d{1,3}(?:,\d{3})*\+?\s*(?:records|rows|users|customers|orders|transactions|seconds|hours|minutes|queries|crore|lakh|percent|tables?|kpis?|pages?|measures?)\b/gi) || [];

    // ---------------------------------------------------------
    // 6. Calibrated Multi-Factor Scoring (0-100)
    // ---------------------------------------------------------
    // A. Substance & Length (up to 30 pts)
    let substancePoints = 0;
    if (wordCount < 10) substancePoints = 4;
    else if (wordCount < 20) substancePoints = 8;
    else if (wordCount < 35) substancePoints = 14;
    else if (wordCount < 50) substancePoints = 20;
    else if (wordCount <= 220) substancePoints = 30; // Ideal interview answer length
    else substancePoints = 24; // Slightly verbose

    // B. Relevance & Key Concept Coverage (up to 35 pts)
    let conceptPoints = 0;
    if (rubricKeywords.length > 0) {
      const fraction = matchedKeywords.length / rubricKeywords.length;
      conceptPoints = Math.round(fraction * 35);
    } else {
      // General question without rubric keywords: evaluate analytics terms
      const generalKeywords = ['data', 'analysis', 'metric', 'insight', 'table', 'result', 'decision', 'user', 'team', 'process'];
      const matchedGen = generalKeywords.filter(k => lower.includes(k));
      conceptPoints = Math.min(30, Math.round((matchedGen.length / 5) * 30));
    }

    // C. Structure & Problem Solving / STAR (up to 15 pts)
    let structurePoints = 0;
    if (starCount === 4) structurePoints = 15;
    else if (starCount === 3) structurePoints = 12;
    else if (starCount === 2) structurePoints = 8;
    else if (starCount === 1) structurePoints = 4;

    // D. Quantifiable Evidence & Concrete Metrics (up to 10 pts)
    let metricsPoints = Math.min(10, metricsFound.length * 5);

    // E. Deductions for heavy filler usage
    let fillerDeduction = 0;
    if (totalFillers > 2) {
      fillerDeduction = Math.min(15, (totalFillers - 2) * 2);
    }

    // Uncapped raw sum
    let rawScore = substancePoints + conceptPoints + structurePoints + metricsPoints + pacingPoints - fillerDeduction;

    // Hard boundary caps to strictly prevent short / incomplete answers from receiving high scores
    if (wordCount < 10) {
      rawScore = Math.min(15, rawScore);
    } else if (wordCount < 20) {
      rawScore = Math.min(30, rawScore);
    } else if (wordCount < 35) {
      rawScore = Math.min(50, rawScore);
    } else if (wordCount < 50) {
      rawScore = Math.min(70, rawScore);
    }

    // Irrelevant answer cap: if question had rubric keywords and candidate matched 0
    if (rubricKeywords.length >= 3 && matchedKeywords.length === 0) {
      rawScore = Math.min(38, rawScore);
    }

    const finalScore = Math.min(100, Math.max(0, Math.round(rawScore)));

    return {
      score: finalScore,
      wordCount: wordCount,
      durationSeconds: Math.round(durationSeconds || 0),
      wpm: wpm,
      pacingAssessment: pacingAssessment,
      totalFillers: totalFillers,
      fillerCounts: fillerCounts,
      matchedKeywords: matchedKeywords,
      missingKeywords: missingKeywords,
      starCoverage: starMatches,
      starCount: starCount,
      metricsFound: metricsFound,
      breakdown: {
        substance: substancePoints,
        concepts: conceptPoints,
        structure: structurePoints,
        metrics: metricsPoints,
        pacing: pacingPoints,
        deductions: fillerDeduction
      },
      disclaimer: 'Voice pace & metrics are approximate heuristics. No accent, gender, or demographic traits are evaluated.'
    };
  }

  // -------------------------------------------------------------
  // Interview Coach Engine
  // -------------------------------------------------------------
  const Coach = {
    COMMUNICATION_DRILLS: COMMUNICATION_DRILLS,
    Speech: Speech,
    analyzeTranscript: analyzeTranscript,

    loadQuestionBank: async function() {
      try {
        const res = await fetch('./data/interview-questions.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && data.tracks && data.questions) {
          // Format into tracks array
          const tracks = [];
          Object.keys(data.tracks).forEach(trackKey => {
            const meta = data.tracks[trackKey];
            const qs = data.questions.filter(q => q.track === trackKey);
            tracks.push({
              id: trackKey,
              title: meta.title,
              icon: meta.icon,
              description: meta.description,
              questions: qs
            });
          });
          return tracks;
        }
        return [];
      } catch (e) {
        console.warn('[Coach] Could not load questions JSON, using fallback:', e.message);
        return Coach.getFallbackTracks();
      }
    },

    getQuestionsForTrack: function(tracks, trackId, count = 5) {
      const track = (tracks || []).find(t => t.id === trackId);
      if (!track || !track.questions || !track.questions.length) return [];
      
      // Deterministic rotation based on local day of year to ensure daily variety
      const d = new Date();
      const startOfYear = new Date(d.getFullYear(), 0, 0);
      const diff = d - startOfYear;
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);

      const qs = [...track.questions];
      const offset = dayOfYear % qs.length;
      const rotated = qs.slice(offset).concat(qs.slice(0, offset));
      return rotated.slice(0, count);
    },

    getDailyMixedSession: function(tracks, count = 5) {
      const targetTracks = ['hr-fresher', 'sql', 'power-bi', 'case-study', 'behavioral-star'];
      const chosen = [];
      targetTracks.forEach(tId => {
        const t = (tracks || []).find(x => x.id === tId);
        if (t && t.questions && t.questions.length) {
          const qs = Coach.getQuestionsForTrack(tracks, tId, 1);
          if (qs.length) chosen.push(qs[0]);
        }
      });
      return chosen.slice(0, count);
    },

    getQuestionsForJob: function(tracks, job, count = 5) {
      if (!job || !tracks || !tracks.length) return Coach.getDailyMixedSession(tracks, count);
      const skills = (job.skills || []).map(s => s.toLowerCase());
      const chosenQuestions = [];

      // Company/Role opening question
      chosenQuestions.push({
        id: 'job_custom_intro',
        track: 'hr-fresher',
        difficulty: 'easy',
        question: `Why are you interested in joining ${job.company || 'our company'} as a ${job.title || 'Data Analyst'}, and how does your project background fit this role?`,
        sampleAnswerPoints: [
          `Demonstrate research on ${job.company || 'the company'} and understanding of the role`,
          'Connect your skills in ' + (skills.slice(0, 3).join(', ') || 'analytics') + ' directly to their business needs',
          'Convey genuine enthusiasm for solving real-world data problems'
        ],
        rubricKeywords: ['company', 'role', 'skills', 'analytics', 'growth', 'data']
      });

      if (skills.some(s => s.includes('sql') || s.includes('query'))) {
        const sqlTrack = tracks.find(t => t.id.includes('sql'));
        if (sqlTrack && sqlTrack.questions.length) chosenQuestions.push(sqlTrack.questions[0]);
      }
      if (skills.some(s => s.includes('power bi') || s.includes('bi') || s.includes('tableau') || s.includes('excel'))) {
        const biTrack = tracks.find(t => t.id.includes('power-bi') || t.id.includes('excel'));
        if (biTrack && biTrack.questions.length) chosenQuestions.push(biTrack.questions[0]);
      }
      if (skills.some(s => s.includes('python') || s.includes('pandas'))) {
        const pyTrack = tracks.find(t => t.id.includes('python'));
        if (pyTrack && pyTrack.questions.length) chosenQuestions.push(pyTrack.questions[0]);
      }

      const caseTrack = tracks.find(t => t.id.includes('case'));
      if (caseTrack && caseTrack.questions.length) chosenQuestions.push(caseTrack.questions[0]);

      const starTrack = tracks.find(t => t.id.includes('star') || t.id.includes('behavioral'));
      if (starTrack && starTrack.questions.length) chosenQuestions.push(starTrack.questions[0]);

      return chosenQuestions.slice(0, count);
    },

    // Progressive AI Feedback with graceful offline fallback
    generateAIFeedback: async function(questionObj, transcript, metricAnalysis) {
      const ai = window.AJSAIClient;
      if (!ai || !ai.hasConsent()) {
        return {
          source: 'local_rubric_engine',
          feedbackText: Coach.generateLocalFeedback(questionObj, transcript, metricAnalysis)
        };
      }

      const prompt = [
        `You are a supportive, precise analytics interview coach for junior and fresher candidates.`,
        `Question Asked: "${questionObj.question}"`,
        `Candidate Answer:`,
        ai.wrapUntrusted('TRANSCRIPT', transcript),
        '',
        `Deterministic Rubric Statistics:`,
        `- Calibrated Score: ${metricAnalysis.score}/100`,
        `- Word count: ${metricAnalysis.wordCount} words`,
        `- Pacing: ${metricAnalysis.wpm} WPM (${metricAnalysis.pacingAssessment})`,
        `- Filler words detected: ${metricAnalysis.totalFillers}`,
        `- Matched key concepts: ${metricAnalysis.matchedKeywords.join(', ') || 'None'}`,
        `- Missing expected concepts: ${metricAnalysis.missingKeywords.join(', ') || 'None'}`,
        `- STAR structure count: ${metricAnalysis.starCount}/4`,
        '',
        `Provide concise, structured coaching:`,
        `1. What was done well.`,
        `2. Technical accuracy & concept gaps to fix.`,
        `3. Improved rewrite outline (or model answer).`,
        `4. One natural follow-up question.`,
        `Keep response constructive, ATS/interview-focused, and strictly under 250 words.`
      ].join('\n');

      try {
        const res = await ai.chat('You are an expert analytics technical interviewer.', prompt);
        if (res && res.success && res.text) {
          return { source: 'puter_ai', feedbackText: res.text };
        }
      } catch (err) {
        console.warn('[Coach] AI feedback call failed, using local rubric fallback:', err);
      }

      return {
        source: 'local_rubric_engine_fallback',
        feedbackText: Coach.generateLocalFeedback(questionObj, transcript, metricAnalysis)
      };
    },

    generateLocalFeedback: function(questionObj, transcript, metricAnalysis) {
      const lines = [
        `### Interview Coach Analysis (Deterministic Local Rubric)`,
        `**Answer Score**: ${metricAnalysis.score}/100 | **Pacing**: ${metricAnalysis.wpm} WPM (${metricAnalysis.pacingAssessment})`,
        '',
        `#### Key Concept Check:`,
        `- **Concepts Addressed**: ${metricAnalysis.matchedKeywords.join(', ') || 'None explicitly matched'}`,
        `- **Concepts to Incorporate**: ${metricAnalysis.missingKeywords.join(', ') || 'Great coverage of expected concepts'}`,
        '',
        `#### Delivery & Style:`,
        `- **Filler Words**: Detected ${metricAnalysis.totalFillers} fillers (${Object.keys(metricAnalysis.fillerCounts).map(k => `${k}: ${metricAnalysis.fillerCounts[k]}`).join(', ') || 'Zero fillers detected! Poised delivery.'})`,
        `- **STAR Method Coverage**: Situation: ${metricAnalysis.starCoverage.situation ? '✓' : '✗'}, Task: ${metricAnalysis.starCoverage.task ? '✓' : '✗'}, Action: ${metricAnalysis.starCoverage.action ? '✓' : '✗'}, Result: ${metricAnalysis.starCoverage.result ? '✓' : '✗'}`,
        `- **Quantifiable Proof**: ${metricAnalysis.metricsFound.length > 0 ? `Good use of metrics (${metricAnalysis.metricsFound.slice(0, 3).join(', ')})` : 'Include specific figures (e.g. rows processed, % time saved) to validate your experience.'}`,
        '',
        `#### Recommended Model Answer Points:`,
        ...(questionObj.sampleAnswerPoints || []).map(p => `- ${p}`),
        '',
        `#### Follow-up Question:`,
        `*"Can you walk me through how you would validate data quality or handle unexpected null values in this scenario?"*`
      ];

      return lines.join('\n');
    },

    getFallbackTracks: function() {
      return [
        {
          id: 'hr-fresher',
          title: 'HR & Fresher Introduction',
          description: 'Foundational motivation and background questions.',
          questions: [
            {
              id: 'fb_hr_1',
              track: 'hr-fresher',
              question: 'Tell me about yourself and why you want to build a career in data analytics.',
              sampleAnswerPoints: ['Highlight analytics tools (SQL, Excel, BI)', 'Mention 1 project with business outcome', 'Convey enthusiasm for problem-solving'],
              rubricKeywords: ['analytics', 'sql', 'excel', 'power bi', 'project', 'insight']
            }
          ]
        },
        {
          id: 'sql',
          title: 'SQL & Relational Databases',
          description: 'Core SQL queries, joins, and aggregations.',
          questions: [
            {
              id: 'fb_sql_1',
              track: 'sql',
              question: 'What is the difference between WHERE and HAVING in SQL, and when would you use each?',
              sampleAnswerPoints: ['WHERE filters rows before aggregation', 'HAVING filters aggregated groups', 'HAVING requires GROUP BY and aggregate functions'],
              rubricKeywords: ['where', 'having', 'aggregate', 'group by', 'filter', 'rows']
            }
          ]
        }
      ];
    },

    // -------------------------------------------------------------
    // Personalized Adaptive End-to-End Interview Coach
    // -------------------------------------------------------------
    buildPersonalizedSession: function(job, resumeData, options) {
      const opts = options || {};
      const sessionType = opts.sessionType || 'standard'; // 'quick' (3-4 Qs), 'standard' (5-6 Qs), 'full_mock' (8-10 Qs)
      const targetStage = opts.targetStage || 'full_loop'; // 'screening', 'technical', 'hiring_manager', 'behavioral', 'case_study', 'full_loop'

      const jobTitle = job ? (job.title || 'Data Analyst') : 'Junior Data Analyst';
      const company = job ? (job.company || 'Company') : 'Analytics Team';
      const skills = (job && Array.isArray(job.skills)) ? job.skills : ['SQL', 'Excel', 'Power BI'];

      // Extract user's truthful resume projects if present
      let userProjectTitle = '';
      if (resumeData) {
        if (Array.isArray(resumeData.projects) && resumeData.projects.length > 0 && resumeData.projects[0].title) {
          userProjectTitle = resumeData.projects[0].title;
        } else if (resumeData.rawText) {
          const match = resumeData.rawText.match(/(?:project|platform|dashboard|analysis)[:\s]+([^\n\r,]{4,40})/i);
          if (match) userProjectTitle = match[1].trim();
        }
      }

      const questions = [];

      // 1. Role-Focused Introduction
      if (['screening', 'hiring_manager', 'full_loop'].includes(targetStage)) {
        questions.push({
          id: 'q_intro',
          stage: 'intro',
          stageLabel: 'Role-Focused Introduction',
          question: `Welcome! To start our interview for the ${jobTitle} opening at ${company}: please give a concise 60–90 second overview of your analytical background, the core tools you work with, and why you are excited about this specific opportunity.`,
          rubricKeywords: ['analytics', 'sql', 'tools', 'experience', 'projects', company.toLowerCase()],
          sampleAnswerPoints: [
            'State current education or focus area clearly',
            'Mention top analytics tools (SQL, Excel, Power BI or Python)',
            'Highlight 1 real project or hands-on experience',
            `Connect your interest directly to ${company} and the ${jobTitle} role`
          ],
          truthfulOutlineTemplate: 'Present education/focus -> Highlight SQL/BI tools -> Cite 1 real project -> State enthusiasm for ' + company,
          isHypothetical: false
        });
      }

      // 2. Resume & Project Deep-Dive
      if (['screening', 'technical', 'hiring_manager', 'full_loop'].includes(targetStage)) {
        const projectPrompt = userProjectTitle
          ? `In your resume, you highlighted your project "${userProjectTitle}". Walk me through the end-to-end data pipeline: what was the business question, how did you source and clean the data, and what measurable outcome did you deliver?`
          : `Walk me through the most significant analytics project on your resume: what business problem were you solving, how did you extract and validate the data using SQL/Excel, and what actionable insight did you produce?`;

        questions.push({
          id: 'q_project_deepdive',
          stage: 'resume_project',
          stageLabel: 'Project Deep-Dive (Resume Grounded)',
          question: projectPrompt,
          rubricKeywords: ['data', 'sql', 'pipeline', 'cleaning', 'dashboard', 'metric', 'result', 'insights'],
          sampleAnswerPoints: [
            'Context: State the business question or problem clearly',
            'Action: Detail the technical tools used (e.g. SQL joins/CTEs, Power Query)',
            'Data Hygiene: Mention data cleaning or null-handling checks',
            'Impact: Provide at least one quantified outcome or time saved'
          ],
          truthfulOutlineTemplate: 'Business Context -> Data extraction (SQL) -> Cleaning & Validation -> Visualisation -> Quantified Business Result',
          isHypothetical: false
        });
      }

      // 3. Technical Analytics: SQL & Databases
      if (['technical', 'screening', 'full_loop'].includes(targetStage)) {
        questions.push({
          id: 'q_tech_sql',
          stage: 'technical',
          stageLabel: 'Technical Analytics: SQL & Data Foundations',
          question: `For our analytics team at ${company}, SQL query accuracy and performance are critical. How would you approach identifying and removing duplicate transaction records in a large table, and when would you use a window function like ROW_NUMBER() over GROUP BY?`,
          rubricKeywords: ['sql', 'duplicate', 'row_number', 'partition by', 'group by', 'cte', 'distinct'],
          sampleAnswerPoints: [
            'Explain identifying duplicates by key columns using GROUP BY and HAVING count(*) > 1',
            'Explain ROW_NUMBER() OVER (PARTITION BY key ORDER BY date DESC) inside a CTE',
            'Delete or filter where rn > 1 to retain only the latest verified record',
            'Explain distinction: GROUP BY collapses rows; ROW_NUMBER preserves individual records'
          ],
          truthfulOutlineTemplate: 'GROUP BY vs Window Function -> CTE structure -> PARTITION BY key column -> Filtering duplicate rank',
          isHypothetical: false
        });
      }

      // 4. Technical Analytics: BI, Modeling & Reporting
      const hasBI = skills.some(s => /power\s*bi|tableau|dashboard|reporting/i.test(s));
      if (hasBI && ['technical', 'full_loop'].includes(targetStage)) {
        questions.push({
          id: 'q_tech_bi',
          stage: 'technical',
          stageLabel: 'Technical Analytics: BI & Data Modeling',
          question: `When designing a business intelligence dashboard for stakeholders at ${company}: how do you structure your data model (e.g., star schema with fact and dimension tables) versus working with a single flat table, and how does this affect report refresh and calculation speed?`,
          rubricKeywords: ['star schema', 'fact', 'dimension', 'relationships', 'dax', 'performance', 'model'],
          sampleAnswerPoints: [
            'Differentiate Fact table (transactions/metrics) from Dimension tables (dates, customers, products)',
            'Star schema reduces redundancy, enables 1-to-many relationships, and optimizes DAX engine memory',
            'Flat tables cause massive row width and slower filter propagation',
            'Ensure clean surrogate keys and avoid bi-directional cross-filtering unless strictly necessary'
          ],
          truthfulOutlineTemplate: 'Fact vs Dimension definition -> Star schema advantages -> Memory and DAX efficiency -> Real dashboard best practices',
          isHypothetical: false
        });
      }

      // 5. Diagnostic Case Study (Hypothetical, clearly labeled)
      if (['case_study', 'technical', 'hiring_manager', 'full_loop'].includes(targetStage)) {
        questions.push({
          id: 'q_case_diagnostic',
          stage: 'case_study',
          stageLabel: 'Practical Case Study: Root-Cause Diagnostics',
          question: `[Hypothetical Scenario]: At ${company}, suppose our weekly order conversion rate suddenly drops by 14% across our primary mobile flow. As our analyst, walk me step-by-step through how you would investigate this anomaly to pinpoint the root cause before reporting to leadership.`,
          rubricKeywords: ['conversion', 'funnel', 'segment', 'hypothesis', 'drop', 'anomaly', 'device', 'version', 'root cause'],
          sampleAnswerPoints: [
            'Verify instrumentation first: check if logging or analytics tracking failed versus actual order drops',
            'Segment the funnel: identify exact drop-off step (cart -> checkout -> payment)',
            'Cross-tabulate dimensions: slice by device OS, app version, geography, and payment method',
            'Formulate hypothesis, check deployment timeline with engineers, and summarize findings with next steps'
          ],
          truthfulOutlineTemplate: 'Verify tracking sanity -> Funnel step segmentation -> Dimension slicing (OS/version/region) -> Engineer check -> Executive summary',
          isHypothetical: true
        });
      }

      // 6. Behavioral Question using STAR Method
      if (['behavioral', 'hiring_manager', 'full_loop'].includes(targetStage)) {
        questions.push({
          id: 'q_behavioral_star',
          stage: 'behavioral',
          stageLabel: 'Behavioral: Ambiguity & Stakeholder Communication',
          question: `Tell me about a time when you received messy, contradictory, or incomplete data with an urgent deadline. How did you handle stakeholder expectations, validate accuracy, and deliver actionable insights?`,
          rubricKeywords: ['situation', 'task', 'action', 'result', 'stakeholder', 'deadline', 'validation', 'accuracy'],
          sampleAnswerPoints: [
            'Situation: Concrete context (academic project, internship, or course assignment)',
            'Task: What report or delivery was required under what timeline',
            'Action: Documented discrepancies, ran sanity checks, and proactively aligned with stakeholders',
            'Result: Accurate delivery on time and established repeatable validation rules'
          ],
          truthfulOutlineTemplate: 'STAR format: Concrete Situation -> Assigned Task -> Proactive Action & Sanity Checks -> Quantified Result',
          isHypothetical: false
        });
      }

      // 7. Candidate Questions for the Interviewer
      if (['hiring_manager', 'screening', 'full_loop'].includes(targetStage)) {
        questions.push({
          id: 'q_candidate_questions',
          stage: 'closing',
          stageLabel: 'Candidate Questions for the Interviewer',
          question: `We have 5 minutes left. What two questions would you like to ask me about our analytics team culture, our data infrastructure, or our expectations for a junior analyst joining ${company}?`,
          rubricKeywords: ['questions', 'team', 'stack', 'culture', 'onboarding', '90 days', company.toLowerCase()],
          sampleAnswerPoints: [
            'Question 1: Focus on team analytics stack, data maturity, or day-to-day collaboration',
            'Question 2: Focus on success criteria for this role in the first 90 days',
            'Polite closing appreciation for the interviewer\'s time'
          ],
          truthfulOutlineTemplate: 'Data stack & collaboration question -> 90-day success criteria question -> Gracious closing',
          isHypothetical: false
        });
      }

      // Adjust question count based on session type
      let maxCount = 5;
      if (sessionType === 'quick') maxCount = 3;
      else if (sessionType === 'full_mock') maxCount = 8;

      const finalQuestions = questions.slice(0, maxCount);

      return {
        id: 'sess_' + Date.now(),
        jobId: job ? (job.id || job.requisition_id) : null,
        company: company,
        jobTitle: jobTitle,
        sessionType: sessionType,
        targetStage: targetStage,
        createdAt: new Date().toISOString(),
        currentIndex: 0,
        questions: finalQuestions,
        responses: [],
        completed: false
      };
    },

    evaluateAnswer: function(questionObj, transcript, durationSeconds) {
      const metricAnalysis = analyzeTranscript(transcript, questionObj, durationSeconds);
      const text = (transcript || '').trim();

      // What was strong
      const strongPoints = [];
      if (metricAnalysis.matchedKeywords.length >= 3) {
        strongPoints.push(`Strong conceptual grasp: covered key terms like ${metricAnalysis.matchedKeywords.slice(0, 3).join(', ')}.`);
      }
      if (metricAnalysis.starCount >= 3) {
        strongPoints.push('Effective structural discipline: followed the STAR storytelling framework.');
      }
      if (metricAnalysis.metricsFound.length >= 1) {
        strongPoints.push(`Concrete evidence: backed up claims with quantified numbers (${metricAnalysis.metricsFound[0]}).`);
      }
      if (strongPoints.length === 0) {
        strongPoints.push('Direct response addressed the core topic of the question.');
      }

      // What was unclear or missing
      const missingPoints = [];
      if (metricAnalysis.missingKeywords.length > 0) {
        missingPoints.push(`Did not explicitly cover expected concepts: ${metricAnalysis.missingKeywords.slice(0, 3).join(', ')}.`);
      }
      if (metricAnalysis.wordCount < 40) {
        missingPoints.push('Answer was too brief. Expand with concrete step-by-step reasoning or a specific example.');
      }
      if (metricAnalysis.metricsFound.length === 0 && questionObj.stage !== 'closing') {
        missingPoints.push('Lacked measurable proof. Add specific volumes (e.g. rows processed, % time saved).');
      }

      // Immediate improvement
      let immediateImprovement = 'Include a specific project example to substantiate your claims.';
      if (metricAnalysis.missingKeywords.length > 0) {
        immediateImprovement = `Explicitly explain how you would apply ${metricAnalysis.missingKeywords[0]} in this scenario.`;
      } else if (metricAnalysis.metricsFound.length === 0) {
        immediateImprovement = 'Quantify your impact: state approximately how much data you handled or time you saved.';
      }

      // Contextual follow-up question
      let followUpQuestion = null;
      if (metricAnalysis.score < 70) {
        if (questionObj.stage === 'technical') {
          followUpQuestion = `Follow-up: Could you clarify how you would handle null values or edge cases in that query?`;
        } else if (questionObj.stage === 'case_study') {
          followUpQuestion = `Follow-up: What if the drop was only on Android devices—what team would you consult first?`;
        } else {
          followUpQuestion = `Follow-up: Can you give me one concrete metric that proved your approach was successful?`;
        }
      }

      return {
        metricAnalysis: metricAnalysis,
        score: metricAnalysis.score,
        whatWasStrong: strongPoints,
        whatWasUnclearOrMissing: missingPoints,
        immediateImprovement: immediateImprovement,
        strongerAnswerOutline: questionObj.sampleAnswerPoints || [],
        canRetry: true,
        followUpQuestion: followUpQuestion
      };
    },

    generateFinalReport: function(session) {
      if (!session || !Array.isArray(session.responses) || session.responses.length === 0) {
        return {
          overallScore: 0,
          stageScores: {},
          strongestAnswers: [],
          needsPractice: [],
          technicalGaps: [],
          communicationSummary: 'No answers recorded.',
          improvements: ['Complete an interview session to generate personalized feedback.'],
          threeDayPlan: ['Review basic SQL syntax', 'Prepare 1 STAR project story', 'Practice 60-second introduction'],
          sevenDayPlan: ['Day 1-2: Core SQL & Joins', 'Day 3-4: Dashboard modeling', 'Day 5-6: Case diagnostics', 'Day 7: Full mock'],
          recommendedNextSession: 'quick'
        };
      }

      const responses = session.responses;
      const totalScore = Math.round(responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length);

      const stageScores = {};
      responses.forEach(r => {
        const stage = r.stage || 'general';
        if (!stageScores[stage]) stageScores[stage] = { sum: 0, count: 0 };
        stageScores[stage].sum += (r.score || 0);
        stageScores[stage].count += 1;
      });

      const stageAverages = {};
      Object.keys(stageScores).forEach(st => {
        stageAverages[st] = Math.round(stageScores[st].sum / stageScores[st].count);
      });

      const strongestAnswers = responses.filter(r => r.score >= 75).map(r => ({
        question: r.question,
        score: r.score,
        strongPoints: r.whatWasStrong
      }));

      const needsPractice = responses.filter(r => r.score < 75).map(r => ({
        question: r.question,
        score: r.score,
        missingPoints: r.whatWasUnclearOrMissing,
        improvement: r.immediateImprovement
      }));

      const technicalGaps = [];
      responses.forEach(r => {
        if (r.metricAnalysis && r.metricAnalysis.missingKeywords) {
          r.metricAnalysis.missingKeywords.forEach(k => {
            if (!technicalGaps.includes(k)) technicalGaps.push(k);
          });
        }
      });

      const totalFillers = responses.reduce((sum, r) => sum + (r.metricAnalysis?.totalFillers || 0), 0);
      const avgWpm = Math.round(responses.reduce((sum, r) => sum + (r.metricAnalysis?.wpm || 0), 0) / responses.length);

      const improvements = [
        technicalGaps.length > 0 ? `Deepen revision on technical concepts: ${technicalGaps.slice(0, 3).join(', ')}.` : 'Continue practicing crisp technical explanations.',
        totalFillers > 5 ? `Reduce filler words (detected ${totalFillers} total). Pause silently between sentences.` : 'Great delivery composure with minimal fillers.',
        'Always quantify results with concrete metrics (rows, percentages, hours saved).',
        'Structure all behavioral and case answers using the STAR format (Situation, Task, Action, Result).',
        `Re-read the job description for ${session.company || 'the role'} to align terminology.`
      ];

      return {
        overallScore: totalScore,
        stageScores: stageAverages,
        strongestAnswers: strongestAnswers,
        needsPractice: needsPractice,
        technicalGaps: technicalGaps.slice(0, 5),
        communicationSummary: `Average pace: ${avgWpm} WPM · Total filler words: ${totalFillers}`,
        improvements: improvements.slice(0, 5),
        threeDayPlan: [
          `Day 1: Revise technical gaps (${technicalGaps.slice(0, 2).join(', ') || 'SQL syntax'})`,
          `Day 2: Rewrite your 2 weakest answers using STAR framework`,
          `Day 3: Re-take a quick mock session for ${session.company || 'your target role'}`
        ],
        sevenDayPlan: [
          'Day 1-2: Core SQL window functions & aggregations',
          'Day 3: BI dashboard modeling & metrics definitions',
          'Day 4: Diagnostic root-cause case study practice',
          'Day 5: Behavioral STAR storytelling practice',
          'Day 6: Mock interview with speech recognition',
          'Day 7: Final full mock review and confidence building'
        ],
        recommendedNextSession: totalScore < 70 ? 'standard' : 'quick'
      };
    },

    saveActiveSession: function(session) {
      if (!session) return;
      try {
        localStorage.setItem(PREFIX + 'active_interview_session', JSON.stringify(session));
      } catch (e) {}
    },

    loadActiveSession: function() {
      try {
        const str = localStorage.getItem(PREFIX + 'active_interview_session');
        return str ? JSON.parse(str) : null;
      } catch (e) {
        return null;
      }
    },

    clearActiveSession: function() {
      try {
        localStorage.removeItem(PREFIX + 'active_interview_session');
      } catch (e) {}
    }
  };

  window.AJSInterviewCoach = Coach;
})(typeof window !== 'undefined' ? window : globalThis);

