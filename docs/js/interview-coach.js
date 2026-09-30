/**
 * Analytics Job Scout v2 - Daily Interview Coach
 * Voice & text mock interviews, deterministic rubric scoring, filler-word analysis,
 * speech recognition/synthesis, communication drills, and streak tracking.
 */
(function(window) {
  'use strict';

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
      sampleAnswer: 'Hello! I am a junior data analyst with a background in [Your Field] and hands-on expertise in SQL, Power BI, and Python. Recently, I built an end-to-end sales analytics project analyzing 50,000+ customer records where I designed a star schema and interactive dashboards that highlighted customer retention drop-offs. I love uncovering actionable insights from messy data, and I am excited to bring my technical skills and curiosity to your analytics team.'
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
      sampleAnswer: 'Our marketing team was unsure which customer campaigns were actually driving repeat purchases. I collected data across our email and sales channels, cleaned out duplicates, and created a simple visual dashboard. For the first time, the team could filter by customer age and see exactly which campaign led to repeat orders. This helped them reallocate 20% of their quarterly ad budget to the highest-performing channel.'
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
      sampleAnswer: 'Hi team, while reviewing our quarterly customer metrics, I noticed an 18% spike in churn specifically in our southern territory. Diving deeper into the product categories, the drop was concentrated among new subscribers who joined during the summer discount. I propose pulling the customer support ticket logs for this cohort today so we can identify whether this is linked to delivery delays or onboarding confusion.'
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
      sampleAnswer: 'I would be glad to put that together! To make sure it gives you exactly what you need for your decision: Which time period should we focus on—this month compared to last month, or year-to-date? Also, are you looking for high-level revenue figures by region, or a detailed product breakdown in Excel? Let me know your deadline so I can prioritize it accordingly.'
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
      recognizer.lang = 'en-IN'; // Default to Indian English / English

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
        if (typeof onTranscript === 'function') {
          onTranscript(finalTranscript, interimTranscript);
        }
      };

      recognizer.onerror = function(event) {
        console.warn('[Speech] Recognition error:', event.error);
        if (typeof onError === 'function') {
          onError(event.error);
        }
      };

      recognizer.onend = function() {
        if (typeof onEnd === 'function') {
          onEnd();
        }
      };

      return recognizer;
    },

    speak: function(text, onComplete) {
      if (!Speech.isSynthesisSupported()) {
        if (onComplete) onComplete();
        return;
      }
      try {
        window.speechSynthesis.cancel(); // Stop any pending speech
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
  // Deterministic Offline Transcript & Rubric Analyzer
  // -------------------------------------------------------------
  function analyzeTranscript(transcript, questionObj, durationSeconds) {
    const text = (transcript || '').trim();
    const words = text.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // 1. Approximate Words Per Minute
    const minutes = Math.max(0.1, (durationSeconds || 30) / 60);
    const wpm = Math.round(wordCount / minutes);

    // 2. Filler words detection
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

    // 3. Key Concepts / Rubric Keywords
    const rubricKeywords = (questionObj && questionObj.rubricKeywords) ? questionObj.rubricKeywords : [];
    const matchedKeywords = [];
    const missingKeywords = [];

    rubricKeywords.forEach(kw => {
      const rx = new RegExp(`(^|[^a-zA-Z0-9])${kw}([^a-zA-Z0-9]|$)`, 'i');
      if (rx.test(lower)) {
        matchedKeywords.push(kw);
      } else {
        missingKeywords.push(kw);
      }
    });

    // 4. STAR Methodology check (Situation, Task, Action, Result)
    const starMatches = {
      situation: /(situation|context|project was|company was|background|when I was)/i.test(lower),
      task: /(task|goal|objective|needed to|assigned to|responsible for|target was)/i.test(lower),
      action: /(action|built|created|engineered|queried|analyzed|designed|developed|implemented|automated)/i.test(lower),
      result: /(result|outcome|impact|achieved|reduced|increased|improved|saved|delivered|metric)/i.test(lower)
    };
    const starCount = Object.values(starMatches).filter(Boolean).length;

    // 5. Numerical / Metric evidence check
    const metricsFound = lower.match(/\b(\d+(\.\d+)?%|\$\d+|\₹\d+|\b\d+\+?\s*(rows|records|users|seconds|hours|queries|crore|lakh|percent))\b/gi) || [];

    // 6. Score calculation (0 - 100)
    let score = 50; // base score for a typed answer

    // Length check
    if (wordCount < 20) {
      score = 30; // Very brief
    } else if (wordCount >= 40 && wordCount <= 250) {
      score += 15; // Healthy length
    } else if (wordCount > 250) {
      score += 10;
    }

    // Concept match
    if (rubricKeywords.length > 0) {
      const conceptFraction = matchedKeywords.length / rubricKeywords.length;
      score += Math.round(conceptFraction * 25);
    } else {
      score += 15;
    }

    // STAR bonus (for behavioral/scenario)
    if (starCount >= 3) score += 10;
    else if (starCount >= 2) score += 5;

    // Metrics bonus
    if (metricsFound.length > 0) score += 5;

    // Filler penalty
    if (totalFillers > 5) score -= Math.min(15, totalFillers);

    score = Math.min(100, Math.max(10, Math.round(score)));

    // Qualitative assessment
    let pacingAssessment = 'Normal speaking pace';
    if (wpm < 90 && wordCount > 15) pacingAssessment = 'Deliberate / slightly slow (try 110-140 WPM)';
    else if (wpm > 165) pacingAssessment = 'Fast-paced (pause after main points for clarity)';
    else if (wpm >= 110 && wpm <= 150) pacingAssessment = 'Optimal natural interview pace';

    return {
      score: score,
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
        
        const tracksObj = data.tracks || {};
        const questionsList = Array.isArray(data.questions) ? data.questions : [];

        const normalizedTracks = Object.keys(tracksObj).map(trackKey => {
          const t = tracksObj[trackKey];
          const trackQuestions = questionsList
            .filter(q => q.track === trackKey || q.track === trackKey.replace(/-/g, '_'))
            .map(q => ({
              id: q.id,
              trackId: trackKey,
              difficulty: q.difficulty || 'junior',
              question: q.question,
              keyConcepts: q.key_concepts || [],
              sampleAnswerPoints: q.sample_answer_points || [],
              rubricKeywords: (q.rubric && q.rubric.keywords) ? q.rubric.keywords : []
            }));

          return {
            id: trackKey,
            title: t.title || trackKey,
            description: t.description || '',
            icon: t.icon || '💬',
            questions: trackQuestions
          };
        });

        return normalizedTracks;
      } catch (e) {
        console.warn('[Coach] Could not fetch interview questions file:', e);
        return [];
      }
    },

    getQuestionsForTrack: function(tracks, trackId, count) {
      count = count || 5;
      if (!Array.isArray(tracks)) return [];
      const normId = (trackId || '').replace(/_/g, '-');
      const track = tracks.find(t => t.id.replace(/_/g, '-') === normId);
      if (!track || !track.questions || track.questions.length === 0) {
        return [];
      }

      // Deterministic daily rotation using day-of-year seed
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const diff = now - start;
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);

      const qs = [...track.questions];
      const shuffled = qs.sort((a, b) => {
        const hashA = (a.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + dayOfYear) % 17;
        const hashB = (b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + dayOfYear) % 17;
        return hashA - hashB;
      });

      return shuffled.slice(0, count);
    },

    getDailyMixedSession: function(tracks, count) {
      count = count || 5;
      if (!Array.isArray(tracks)) return [];
      const picked = [];
      const trackKeywords = ['hr', 'fundamentals', 'sql', 'case', 'star'];

      trackKeywords.forEach(kw => {
        const t = tracks.find(tr => (tr.id || '').toLowerCase().includes(kw));
        if (t && Array.isArray(t.questions) && t.questions.length > 0) {
          const randomIndex = Math.floor(Math.random() * t.questions.length);
          picked.push(Object.assign({}, t.questions[randomIndex], { trackId: t.id, trackName: t.title }));
        }
      });

      // If less than count, fill with random questions from any track
      if (picked.length < count) {
        tracks.forEach(tr => {
          if (picked.length < count && tr.questions && tr.questions.length) {
            picked.push(Object.assign({}, tr.questions[0], { trackId: tr.id, trackName: tr.title }));
          }
        });
      }

      return picked.slice(0, count);
    },

    getQuestionsForJob: function(tracks, job, count) {
      count = count || 5;
      if (!Array.isArray(tracks)) return [];
      const title = (job.title || '').toLowerCase();
      const skills = (job.skills || []).map(s => s.toLowerCase());

      const chosenQuestions = [];

      // 1. Tailored introduction
      const hrTrack = tracks.find(t => t.id.includes('hr'));
      if (hrTrack && hrTrack.questions.length > 0) {
        chosenQuestions.push(Object.assign({}, hrTrack.questions[0], {
          question: `Why are you interested in the ${job.title || 'Data Analyst'} role at ${job.company || 'our company'}?`,
          sampleAnswerPoints: [
            `Demonstrate research on ${job.company || 'the company'} and understanding of the role`,
            'Connect your skills in ' + (skills.slice(0, 3).join(', ') || 'analytics') + ' directly to their business needs',
            'Convey genuine enthusiasm for solving their data problems'
          ],
          rubricKeywords: ['company', 'role', 'skills', 'analytics', 'growth', 'data']
        }));
      }

      // 2. Select tech questions matching job requirements
      if (skills.some(s => s.includes('sql') || s.includes('query'))) {
        const sqlTrack = tracks.find(t => t.id.includes('sql'));
        if (sqlTrack && sqlTrack.questions.length) chosenQuestions.push(sqlTrack.questions[0]);
      }
      if (skills.some(s => s.includes('power bi') || s.includes('bi') || s.includes('tableau') || s.includes('excel'))) {
        const biTrack = tracks.find(t => t.id.includes('powerbi') || t.id.includes('excel'));
        if (biTrack && biTrack.questions.length) chosenQuestions.push(biTrack.questions[0]);
      }
      if (skills.some(s => s.includes('python') || s.includes('pandas'))) {
        const pyTrack = tracks.find(t => t.id.includes('python'));
        if (pyTrack && pyTrack.questions.length) chosenQuestions.push(pyTrack.questions[0]);
      }

      // 3. Case study & metrics
      const caseTrack = tracks.find(t => t.id.includes('case'));
      if (caseTrack && caseTrack.questions.length) chosenQuestions.push(caseTrack.questions[0]);

      // 4. STAR behavioral
      const starTrack = tracks.find(t => t.id.includes('star') || t.id.includes('behavioral'));
      if (starTrack && starTrack.questions.length) chosenQuestions.push(starTrack.questions[0]);

      return chosenQuestions.slice(0, count);
    },

    // AI Coaching with fallback
    generateAIFeedback: async function(questionObj, transcript, metricAnalysis) {
      const ai = window.AJSAIClient;
      if (!ai || !ai.hasConsent()) {
        return {
          source: 'local_rubric_engine',
          feedbackText: Coach.generateLocalFeedback(questionObj, transcript, metricAnalysis)
        };
      }

      const prompt = [
        `You are a supportive, precise analytics interview coach for freshers and junior analysts.`,
        `Question Asked: "${questionObj.question}"`,
        `Candidate Answer:`,
        ai.wrapUntrusted('TRANSCRIPT', transcript),
        '',
        `Deterministic Heuristic Stats:`,
        `- Score: ${metricAnalysis.score}/100`,
        `- Word count: ${metricAnalysis.wordCount} words`,
        `- Pacing: ${metricAnalysis.wpm} WPM (${metricAnalysis.pacingAssessment})`,
        `- Filler words detected: ${metricAnalysis.totalFillers}`,
        `- Matched key concepts: ${metricAnalysis.matchedKeywords.join(', ') || 'None'}`,
        `- Missing expected concepts: ${metricAnalysis.missingKeywords.join(', ') || 'None'}`,
        '',
        `Provide concise coaching:`,
        `1. What was done well.`,
        `2. Technical accuracy & concept gaps to fix.`,
        `3. Improved rewrite outline (or model answer).`,
        `4. One natural follow-up question.`,
        `Keep response constructive, concise, and professional.`
      ].join('\n');

      const res = await ai.chat('You are an expert analytics technical interviewer.', prompt);
      if (res.success && res.text) {
        return { source: 'puter_ai', feedbackText: res.text };
      }

      return {
        source: 'local_rubric_engine_fallback',
        feedbackText: Coach.generateLocalFeedback(questionObj, transcript, metricAnalysis)
      };
    },

    generateLocalFeedback: function(questionObj, transcript, metricAnalysis) {
      const lines = [
        `### Interview Coach Analysis (Deterministic Rubric)`,
        `**Answer Score**: ${metricAnalysis.score}/100 | **Pacing**: ${metricAnalysis.wpm} WPM (${metricAnalysis.pacingAssessment})`,
        '',
        `#### Key Concept Check:`,
        `- **Concepts Addressed**: ${metricAnalysis.matchedKeywords.join(', ') || 'None explicitly matched'}`,
        `- **Concepts to Incorporate**: ${metricAnalysis.missingKeywords.join(', ') || 'Great coverage of expected concepts'}`,
        '',
        `#### Delivery & Style:`,
        `- **Filler Words**: Detected ${metricAnalysis.totalFillers} fillers (${Object.keys(metricAnalysis.fillerCounts).map(k => `${k}: ${metricAnalysis.fillerCounts[k]}`).join(', ') || 'Zero fillers detected! Excellent poise.'})`,
        `- **STAR Method Coverage**: Situation: ${metricAnalysis.starCoverage.situation ? '✓' : '✗'}, Task: ${metricAnalysis.starCoverage.task ? '✓' : '✗'}, Action: ${metricAnalysis.starCoverage.action ? '✓' : '✗'}, Result: ${metricAnalysis.starCoverage.result ? '✓' : '✗'}`,
        `- **Quantifiable Proof**: ${metricAnalysis.metricsFound.length > 0 ? `Good use of numbers (${metricAnalysis.metricsFound.slice(0, 3).join(', ')})` : 'Include specific figures (e.g. rows processed, % saved, time taken) to validate your experience.'}`,
        '',
        `#### Model Answer Key Points:`,
        ...(questionObj.sampleAnswerPoints || []).map(p => `- ${p}`),
        '',
        `#### Follow-up Question:`,
        `*"Can you elaborate on how you handled edge cases or unexpected null values in this scenario?"*`
      ];

      return lines.join('\n');
    }
  };

  window.AJSInterviewCoach = Coach;
})(window);
