/**
 * Analytics Job Scout v2 - Resume AI & Deterministic ATS Engine
 * Local browser file parsing (PDF/DOCX/TXT/Paste), 0-100 Explainable ATS scoring,
 * role-aware skill taxonomy, job matching, and progressive AI suggestions with full offline fallback.
 */
(function(window) {
  'use strict';

  // -------------------------------------------------------------
  // Skill Taxonomy & Keywords
  // -------------------------------------------------------------
  const SKILL_TAXONOMY = {
    sql: {
      label: 'SQL & Database',
      keywords: ['sql', 'mysql', 'postgresql', 'postgres', 'mssql', 'sqlite', 'joins', 'cte', 'ctes', 'window functions', 'subqueries', 'data modelling', 'data modeling', 'views', 'stored procedures', 'indexes', 'group by', 'aggregation'],
      coreKeywords: ['sql', 'joins', 'cte', 'window functions']
    },
    excel: {
      label: 'Advanced Excel',
      keywords: ['excel', 'advanced excel', 'pivottables', 'pivot table', 'pivot tables', 'xlookup', 'vlookup', 'power query', 'sumifs', 'conditional formatting', 'macros', 'vba', 'dashboards in excel'],
      coreKeywords: ['excel', 'pivottables', 'xlookup']
    },
    powerbi: {
      label: 'Power BI & DAX',
      keywords: ['power bi', 'powerbi', 'dax', 'power query', 'star schema', 'measures', 'data modeling', 'power bi desktop', 'power bi service', 'pbi report'],
      coreKeywords: ['power bi', 'dax']
    },
    tableau: {
      label: 'Tableau',
      keywords: ['tableau', 'tableau desktop', 'calculated fields', 'parameters', 'tableau server', 'lod expressions', 'storytelling'],
      coreKeywords: ['tableau']
    },
    python: {
      label: 'Python Analytics',
      keywords: ['python', 'pandas', 'numpy', 'matplotlib', 'seaborn', 'jupyter', 'data wrangling', 'data cleaning', 'eda', 'exploratory data analysis'],
      coreKeywords: ['python', 'pandas', 'numpy']
    },
    statistics: {
      label: 'Statistics & Metrics',
      keywords: ['statistics', 'statistical analysis', 'hypothesis testing', 'a/b testing', 'experimentation', 'regression', 'correlation', 'forecasting', 'probability', 'p-value', 'confidence interval'],
      coreKeywords: ['statistics', 'regression']
    },
    dataOps: {
      label: 'Data Pipelines & Warehousing',
      keywords: ['etl', 'elt', 'pipeline', 'data warehouse', 'snowflake', 'bigquery', 'redshift', 'ssis', 'airflow', 'dbt', 'api data extraction'],
      coreKeywords: ['etl', 'pipeline']
    },
    juniorDS: {
      label: 'Junior Data Science / ML',
      keywords: ['scikit-learn', 'machine learning', 'classification', 'clustering', 'random forest', 'feature engineering', 'model evaluation', 'roc-auc', 'logistic regression'],
      coreKeywords: ['scikit-learn', 'machine learning']
    },
    business: {
      label: 'Business & Stakeholder Comm',
      keywords: ['kpis', 'metrics', 'stakeholder communication', 'reporting', 'business insights', 'data visualization', 'executive presentation', 'churn', 'retention', 'revenue analysis'],
      coreKeywords: ['kpis', 'reporting']
    }
  };

  const STRONG_ACTION_VERBS = [
    'analyzed', 'analysed', 'queried', 'built', 'developed', 'engineered', 'extracted', 'transformed',
    'visualized', 'visualised', 'automated', 'optimized', 'optimised', 'identified', 'discovered',
    'designed', 'calculated', 'modeled', 'modelled', 'forecasted', 'streamlined', 'audited',
    'delivered', 'reduced', 'increased', 'accelerated', 'established', 'benchmarked', 'led', 'implemented'
  ];

  const WEAK_OR_GENERIC_PHRASES = [
    'responsible for', 'duties included', 'worked on', 'handled', 'helped with', 'assisted in',
    'team player', 'hardworking', 'quick learner', 'detail oriented', 'go-getter', 'self motivated',
    'good communication skills', 'participated in', 'dynamic environment'
  ];

  const EXPECTED_SECTIONS = [
    { name: 'Contact Information', regex: /(email|phone|linkedin|github|portfolio|contact|address)/i },
    { name: 'Education', regex: /(education|bachelor|master|b\.tech|b\.sc|b\.e|degree|university|college|gpa|cgpa)/i },
    { name: 'Technical Skills', regex: /(skills|technical skills|tools|technologies|proficiencies|competencies)/i },
    { name: 'Projects / Experience', regex: /(experience|employment|work history|projects|academic projects|internships|intern)/i },
    { name: 'Summary / Objective', regex: /(summary|profile|objective|about me|professional summary)/i }
  ];

  // -------------------------------------------------------------
  // Deterministic ATS Scoring Engine
  // -------------------------------------------------------------
  function analyzeResumeATS(text) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return {
        totalScore: 0,
        grade: 'No Content',
        breakdown: [],
        skillsFound: [],
        missingKeyAreas: ['Upload or paste a resume to view analysis.'],
        impactEvidence: [],
        verbCount: 0,
        wordCount: 0,
        weakPhrasesFound: [],
        recommendations: []
      };
    }

    const lower = cleanText.toLowerCase();
    const words = cleanText.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    let points = 0;
    const breakdown = [];
    const recommendations = [];

    // 1. Header / Contact Basics (Max 10 pts)
    let contactPts = 0;
    const hasEmail = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(cleanText);
    const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\d{10}/.test(cleanText);
    const hasLinkedIn = /linkedin\.com/i.test(cleanText);
    const hasGitHub = /github\.com/i.test(cleanText) || /portfolio/i.test(cleanText);

    if (hasEmail) contactPts += 3;
    if (hasPhone) contactPts += 3;
    if (hasLinkedIn) contactPts += 2;
    if (hasGitHub) contactPts += 2;

    breakdown.push({
      category: 'Contact & Profile Links',
      earned: contactPts,
      max: 10,
      detail: `${hasEmail ? 'Email' : 'No email'}, ${hasPhone ? 'Phone' : 'No phone'}, ${hasLinkedIn ? 'LinkedIn' : 'No LinkedIn'}, ${hasGitHub ? 'GitHub/Portfolio' : 'No GitHub'}`
    });
    points += contactPts;

    if (!hasLinkedIn || !hasGitHub) {
      recommendations.push('Add active links to your LinkedIn profile and GitHub or Portfolio repository for analytics projects.');
    }

    // 2. Expected Resume Sections (Max 15 pts)
    let sectionPts = 0;
    const foundSections = [];
    const missingSections = [];

    EXPECTED_SECTIONS.forEach(sec => {
      if (sec.regex.test(cleanText)) {
        sectionPts += 3;
        foundSections.push(sec.name);
      } else {
        missingSections.push(sec.name);
      }
    });

    breakdown.push({
      category: 'Standard Resume Sections',
      earned: sectionPts,
      max: 15,
      detail: `Found: ${foundSections.join(', ') || 'None'}. Missing: ${missingSections.join(', ') || 'None'}`
    });
    points += sectionPts;

    if (missingSections.length > 0) {
      recommendations.push(`Add clear standard section headings: ${missingSections.join(', ')}.`);
    }

    // 3. Analytics Hard Skills Coverage (Max 30 pts)
    let skillPts = 0;
    const skillsFoundByGroup = {};
    const flatSkillsFound = [];

    Object.keys(SKILL_TAXONOMY).forEach(groupKey => {
      const group = SKILL_TAXONOMY[groupKey];
      const matched = group.keywords.filter(kw => {
        // Word boundary match
        const escaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const rx = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
        return rx.test(cleanText);
      });

      if (matched.length > 0) {
        skillsFoundByGroup[groupKey] = { label: group.label, matched: matched };
        matched.forEach(m => {
          if (!flatSkillsFound.includes(m)) flatSkillsFound.push(m);
        });
      }
    });

    const groupsCoveredCount = Object.keys(skillsFoundByGroup).length;
    // Award up to 30 pts: SQL/Excel/Power BI/Python/ETL
    skillPts = Math.min(30, groupsCoveredCount * 4 + Math.min(10, flatSkillsFound.length));

    breakdown.push({
      category: 'Analytics Hard Skills',
      earned: skillPts,
      max: 30,
      detail: `Identified ${flatSkillsFound.length} key analytics terms across ${groupsCoveredCount} technical skill domains`
    });
    points += skillPts;

    if (!skillsFoundByGroup.sql) {
      recommendations.push('Critical: Add explicit SQL expertise (joins, CTEs, window functions, aggregation).');
    }
    if (!skillsFoundByGroup.excel && !skillsFoundByGroup.powerbi && !skillsFoundByGroup.tableau) {
      recommendations.push('Add business intelligence tools (Power BI, DAX, Advanced Excel or Tableau).');
    }

    // 4. Measurable Impact & Quantifiable Evidence (Max 15 pts)
    // Look for numbers, percentages, currency, time savings, data volume (supports commas like 120,000 and ₹4,50,000)
    const metricMatches = cleanText.match(/(?:\b\d{1,3}(?:,\d{2,3})*|\b\d+)(?:\.\d+)?%|[$₹]\s*(?:\d{1,3}(?:,\d{2,3})*|\d+)|\b(?:\d{1,3}(?:,\d{2,3})*|\d+)\+?\s*(?:rows|records|users|customers|orders|transactions|clients|queries|seconds|minutes|hours|days|weeks|months|percent|lakh|crore|million|k\b)/gi) || [];
    let impactPts = 0;
    if (metricMatches.length >= 6) impactPts = 15;
    else if (metricMatches.length >= 4) impactPts = 12;
    else if (metricMatches.length >= 2) impactPts = 8;
    else if (metricMatches.length >= 1) impactPts = 4;
    else impactPts = 0;

    breakdown.push({
      category: 'Quantified Impact & Metrics',
      earned: impactPts,
      max: 15,
      detail: `Detected ${metricMatches.length} quantifiable data points (${metricMatches.slice(0, 4).join(', ') || 'No metrics found'})`
    });
    points += impactPts;

    if (metricMatches.length < 3) {
      recommendations.push('Quantify your project bullets: Include dataset sizes (e.g. 50,000+ rows), query speedups (e.g. 35% faster), or hours saved.');
    }

    // 5. Strong Action Verbs (Max 15 pts)
    const verbsFound = STRONG_ACTION_VERBS.filter(v => {
      const rx = new RegExp(`\\b${v}\\b`, 'i');
      return rx.test(cleanText);
    });

    let verbPts = 0;
    if (verbsFound.length >= 8) verbPts = 15;
    else if (verbsFound.length >= 5) verbPts = 12;
    else if (verbsFound.length >= 3) verbPts = 8;
    else if (verbsFound.length >= 1) verbPts = 4;
    else verbPts = 0;

    breakdown.push({
      category: 'Strong Action Verbs',
      earned: verbPts,
      max: 15,
      detail: `Found ${verbsFound.length} strong action verbs (${verbsFound.slice(0, 5).join(', ')})`
    });
    points += verbPts;

    if (verbsFound.length < 4) {
      recommendations.push('Start every bullet with an active verb (e.g., "Engineered SQL CTEs", "Visualized customer churn in Power BI").');
    }

    // 6. Resume Length & Formatting Readability (Max 10 pts)
    let lengthPts = 0;
    let lengthDetail = '';
    if (wordCount >= 250 && wordCount <= 750) {
      lengthPts = 10;
      lengthDetail = `Optimal 1-page length for junior roles (${wordCount} words)`;
    } else if (wordCount > 750 && wordCount <= 1100) {
      lengthPts = 7;
      lengthDetail = `Slightly verbose for a junior role (${wordCount} words)`;
      recommendations.push('Aim for a crisp 1-page resume (under 750 words) to maximize recruiter attention.');
    } else if (wordCount > 1100) {
      lengthPts = 4;
      lengthDetail = `Too long for junior profile (${wordCount} words - recommend trimming)`;
      recommendations.push('Resume exceeds 1000 words. Condense project descriptions into 3-4 bullet points each.');
    } else {
      lengthPts = 3;
      lengthDetail = `Very brief (${wordCount} words - provide more project details)`;
      recommendations.push('Expand your project bullets: explain the business problem, tools used, and outcome.');
    }

    breakdown.push({
      category: 'Length & Conciseness',
      earned: lengthPts,
      max: 10,
      detail: lengthDetail
    });
    points += lengthPts;

    // 7. Generic / Weak Phrases Deduction (Up to 5 penalty pts deducted)
    const weakFound = WEAK_OR_GENERIC_PHRASES.filter(p => {
      const rx = new RegExp(`\\b${p}\\b`, 'i');
      return rx.test(cleanText);
    });

    let weakDeduction = Math.min(5, weakFound.length * 2);
    if (weakDeduction > 0) {
      points = Math.max(0, points - weakDeduction);
      breakdown.push({
        category: 'Cliché Phrase Flags',
        earned: -weakDeduction,
        max: 0,
        detail: `Found clichés: "${weakFound.join('", "')}". Replace with specific achievements.`
      });
      recommendations.push(`Replace passive phrases like "${weakFound[0]}" with direct ownership statements.`);
    }

    // Determine grade
    const finalScore = Math.min(100, Math.max(0, Math.round(points)));
    let grade = 'Needs Work';
    if (finalScore >= 85) grade = 'Excellent (ATS Ready)';
    else if (finalScore >= 70) grade = 'Strong Junior Candidate';
    else if (finalScore >= 50) grade = 'Fair (Needs Polish)';

    return {
      totalScore: finalScore,
      grade: grade,
      breakdown: breakdown,
      skillsFound: flatSkillsFound,
      skillsByGroup: skillsFoundByGroup,
      impactEvidence: metricMatches.slice(0, 8),
      verbsFound: verbsFound,
      wordCount: wordCount,
      weakPhrasesFound: weakFound,
      recommendations: recommendations
    };
  }

  // -------------------------------------------------------------
  // Job Matcher
  // -------------------------------------------------------------
  function matchJobWithResume(job, resumeText) {
    if (!job || !resumeText || !resumeText.trim()) {
      return {
        matchScore: 0,
        formulaExplanation: 'Score (0%) = Match score is 0 because no resume content was provided.',
        matchedSkills: [],
        missingSkills: Array.isArray(job?.skills) ? job.skills.map(s => s.toLowerCase()) : [],
        evidence: [],
        evidenceBySkill: {},
        requiredSkills: {
          present: [],
          missing: Array.isArray(job?.skills) ? job.skills.map(s => ({ skill: s, tip: 'Add only if true and verifiable.' })) : []
        },
        preferredSkills: { present: [], missing: [] },
        toolTerms: { present: [], missing: [] },
        domainTerms: { present: [], missing: [] },
        experiencePhrases: { present: [], missing: [] },
        responsibilitiesAndImpact: { metricsCount: 0, actionVerbsCount: 0 },
        warnings: ['Upload or paste a resume to generate job-specific ATS keyword analysis.'],
        prioritizedChecklist: {
          critical: [{ id: 'upload_resume', text: 'Provide a resume to match with this job opening', done: false, level: 'critical' }],
          useful: [],
          optional: []
        },
        checklist: [],
        jobTitle: job?.title || '',
        company: job?.company || ''
      };
    }

    const cleanResume = resumeText.trim();
    const resumeLower = cleanResume.toLowerCase();
    const jobSkills = Array.isArray(job.skills) ? job.skills : [];
    const jobText = `${job.title || ''} ${job.company || ''} ${jobSkills.join(' ')} ${job.fit || ''} ${job.exp || ''}`.toLowerCase();

    // 1. Identify primary required skills (explicitly declared in verified job skills)
    const requiredSkillsSet = new Set(jobSkills.map(s => s.trim().toLowerCase()));

    // 2. Identify preferred/secondary tools from taxonomy found in job text
    const preferredSkillsSet = new Set();
    Object.keys(SKILL_TAXONOMY).forEach(k => {
      SKILL_TAXONOMY[k].keywords.forEach(kw => {
        const rx = new RegExp(`(^|[^a-zA-Z0-9])${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-zA-Z0-9]|$)`, 'i');
        if (rx.test(jobText) && !requiredSkillsSet.has(kw)) {
          preferredSkillsSet.add(kw);
        }
      });
    });

    const allExpectedKeywords = Array.from(new Set([...requiredSkillsSet, ...preferredSkillsSet]));

    const matched = [];
    const missing = [];
    const evidence = [];
    const evidenceBySkill = {};

    const reqPresent = [];
    const reqMissing = [];
    const prefPresent = [];
    const prefMissing = [];

    allExpectedKeywords.forEach(kw => {
      const rxExact = new RegExp(`(^|[^a-zA-Z0-9])${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-zA-Z0-9]|$)`, 'i');
      const isMatch = rxExact.test(resumeLower);
      const isRequired = requiredSkillsSet.has(kw);

      if (isMatch) {
        matched.push(kw);
        // Find evidence snippet
        const idx = resumeLower.indexOf(kw);
        let snippet = '';
        if (idx !== -1) {
          const start = Math.max(0, idx - 30);
          const end = Math.min(cleanResume.length, idx + kw.length + 40);
          snippet = '…' + cleanResume.substring(start, end).replace(/\s+/g, ' ').trim() + '…';
          if (evidence.length < 8) evidence.push(snippet);
          evidenceBySkill[kw] = snippet;
        }

        const matchObj = { skill: kw, matchType: 'exact', evidenceQuote: snippet };
        if (isRequired) reqPresent.push(matchObj);
        else prefPresent.push(matchObj);
      } else {
        missing.push(kw);
        const missObj = { skill: kw, tip: `Add "${kw}" only if you have genuine project or work experience.` };
        if (isRequired) reqMissing.push(missObj);
        else prefMissing.push(missObj);
      }
    });

    // 3. Impact & Section Analysis
    const metricMatches = cleanResume.match(/(\d+[\d,.]*\s*(?:%|percent|k|m|cr|lakh|crore|x|hrs|hours|days|seconds|minutes|\+))/gi) || [];
    const verbsFound = STRONG_ACTION_VERBS.filter(v => new RegExp(`\\b${v}\\b`, 'i').test(resumeLower));
    const titleMatch = new RegExp((job.title || 'Data Analyst').replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i').test(resumeLower);

    // Plain-language formula scoring:
    // 50% Required Core Skills + 20% Preferred Tools + 15% Measurable Impact + 15% Active Verbs/Format
    const reqTotal = requiredSkillsSet.size || 1;
    const reqScore = (reqPresent.length / reqTotal) * 50;

    const prefTotal = preferredSkillsSet.size || 1;
    const prefScore = preferredSkillsSet.size > 0 ? (prefPresent.length / prefTotal) * 20 : 20;

    const impactScore = Math.min(15, metricMatches.length * 3);
    const verbScore = Math.min(15, verbsFound.length * 2);

    const calculatedScore = Math.min(100, Math.round(reqScore + prefScore + impactScore + verbScore));
    const formulaExplanation = `Formula: ${Math.round(reqScore)}/50 Required Core Skills + ${Math.round(prefScore)}/20 Preferred Tools + ${Math.round(impactScore)}/15 Quantified Impact + ${Math.round(verbScore)}/15 Action Verbs = ${calculatedScore}%`;

    // 4. Prioritized Checklist (Critical, Useful, Optional)
    const criticalChecklist = [];
    const usefulChecklist = [];
    const optionalChecklist = [];

    // Critical: Required missing skills
    reqMissing.forEach(m => {
      criticalChecklist.push({
        id: `crit_miss_${m.skill}`,
        text: `Required skill missing: "${m.skill}"`,
        guidance: 'Add to Skills or Project bullets ONLY if you have true hands-on experience. Never fabricate skills.',
        done: false,
        level: 'critical'
      });
    });

    if (reqPresent.length > 0) {
      criticalChecklist.push({
        id: 'crit_req_present',
        text: `Core requirements verified: ${reqPresent.map(p => p.skill).slice(0, 4).join(', ')}`,
        guidance: 'Preserve these exact keywords in your summary and project descriptions.',
        done: true,
        level: 'critical'
      });
    }

    // Useful: Title alignment & preferred tools
    if (!titleMatch) {
      usefulChecklist.push({
        id: 'use_title_align',
        text: `Align target title with opening: "${job.title || 'Data Analyst'}"`,
        guidance: 'Ensure your professional summary references this target role title directly.',
        done: false,
        level: 'useful'
      });
    } else {
      usefulChecklist.push({
        id: 'use_title_align',
        text: `Target title aligned: "${job.title}" is referenced in your resume`,
        guidance: 'Strong role focus verified.',
        done: true,
        level: 'useful'
      });
    }

    if (metricMatches.length < 2) {
      usefulChecklist.push({
        id: 'use_metrics',
        text: 'Add at least 2 quantified metrics to your project achievements',
        guidance: 'e.g. "Processed 50,000+ transaction rows", "Reduced reporting cycle by 25%". Add only true metrics.',
        done: false,
        level: 'useful'
      });
    } else {
      usefulChecklist.push({
        id: 'use_metrics',
        text: `Quantified impact verified: ${metricMatches.length} metrics found in resume`,
        guidance: 'Demonstrates measurable business value.',
        done: true,
        level: 'useful'
      });
    }

    prefMissing.forEach(pm => {
      usefulChecklist.push({
        id: `use_pref_${pm.skill}`,
        text: `Preferred tool not found: "${pm.skill}"`,
        guidance: 'If you have worked with this tool or equivalent, mention it in your technical stack.',
        done: false,
        level: 'useful'
      });
    });

    // Optional: Certifications / portfolio links
    optionalChecklist.push({
      id: 'opt_portfolio',
      text: `Link an analytics portfolio project specifically tailored to ${job.company || 'this team'}`,
      guidance: 'Demonstrates proactive initiative and gives interviewers concrete work to discuss.',
      done: /github\.com|portfolio|project/i.test(resumeLower),
      level: 'optional'
    });

    // Flat checklist array for backward compatibility and interactive ATS view
    const flatChecklist = [
      ...criticalChecklist.map(c => ({ item: c.text, done: c.done, priority: c.level, guidance: c.guidance })),
      ...usefulChecklist.map(u => ({ item: u.text, done: u.done, priority: u.level, guidance: u.guidance })),
      ...optionalChecklist.map(o => ({ item: o.text, done: o.done, priority: o.level, guidance: o.guidance }))
    ];

    const warnings = [];
    if (missing.length > 5) {
      warnings.push(`Notice: ${missing.length} keywords from this posting are missing in your resume. Tailor truthful experience before submitting.`);
    }

    return {
      matchScore: calculatedScore,
      formulaExplanation: formulaExplanation,
      matchedSkills: matched,
      missingSkills: missing,
      evidence: evidence,
      evidenceBySkill: evidenceBySkill,
      requiredSkills: { present: reqPresent, missing: reqMissing },
      preferredSkills: { present: prefPresent, missing: prefMissing },
      responsibilitiesAndImpact: {
        metricsCount: metricMatches.length,
        metrics: metricMatches.slice(0, 6),
        actionVerbsCount: verbsFound.length,
        actionVerbs: verbsFound.slice(0, 8)
      },
      prioritizedChecklist: {
        critical: criticalChecklist,
        useful: usefulChecklist,
        optional: optionalChecklist
      },
      checklist: flatChecklist,
      warnings: warnings,
      jobTitle: job.title,
      company: job.company
    };
  }

  // -------------------------------------------------------------
  // File Parsing Adapters (PDF, DOCX, TXT)
  // -------------------------------------------------------------
  async function parseFile(file) {
    if (!file) throw new Error('No file provided');

    // 5MB Limit Check
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error(`File size ${(file.size / (1024 * 1024)).toFixed(1)}MB exceeds maximum allowed 5MB.`);
    }

    const fileName = file.name || '';
    const extension = fileName.split('.').pop().toLowerCase();

    // 1. Plain Text
    if (extension === 'txt' || file.type === 'text/plain') {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Failed to read plain text file'));
        reader.readAsText(file);
      });
    }

    // 2. DOCX (Mammoth.js)
    if (extension === 'docx' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return new Promise((resolve, reject) => {
        if (!window.mammoth) {
          reject(new Error('Mammoth.js parser not loaded. Please use the Paste Text option or refresh with internet connection.'));
          return;
        }
        const reader = new FileReader();
        reader.onload = async function(e) {
          try {
            const arrayBuffer = e.target.result;
            const result = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            if (result && result.value) {
              resolve(result.value);
            } else {
              reject(new Error('DOCX parsed successfully but contained no readable text.'));
            }
          } catch (err) {
            reject(new Error('DOCX parsing error: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read DOCX file buffer'));
        reader.readAsArrayBuffer(file);
      });
    }

    // 3. PDF (PDF.js)
    if (extension === 'pdf' || file.type === 'application/pdf') {
      return new Promise((resolve, reject) => {
        const pdfjs = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
        if (!pdfjs) {
          reject(new Error('PDF.js parser not available. Please use the Paste Text fallback or check network access.'));
          return;
        }

        const reader = new FileReader();
        reader.onload = async function(e) {
          try {
            const typedarray = new Uint8Array(e.target.result);
            if (pdfjs.GlobalWorkerOptions && !pdfjs.GlobalWorkerOptions.workerSrc) {
              pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            const loadingTask = pdfjs.getDocument({ data: typedarray });
            const pdfDoc = await loadingTask.promise;
            let fullText = '';

            for (let i = 1; i <= pdfDoc.numPages; i++) {
              const page = await pdfDoc.getPage(i);
              const textContent = await page.getTextContent();
              const pageText = textContent.items.map(item => item.str).join(' ');
              fullText += pageText + '\n\n';
            }

            if (fullText.trim().length > 0) {
              resolve(fullText.trim());
            } else {
              reject(new Error('PDF was opened but no text could be extracted. It might be a scanned image. Use Paste Text fallback.'));
            }
          } catch (err) {
            reject(new Error('PDF extraction error: ' + err.message));
          }
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file buffer'));
        reader.readAsArrayBuffer(file);
      });
    }

    throw new Error(`Unsupported file type ".${extension}". Please upload a .pdf, .docx, or .txt file, or paste your resume text below.`);
  }

  // -------------------------------------------------------------
  // Deterministic AI Fallback Generators (Offline Rule-Based)
  // -------------------------------------------------------------
  const OfflineGenerators = {
    recruiterReview: function(atsResult, targetRole) {
      targetRole = targetRole || 'Junior Data Analyst';
      const lines = [
        `### Recruiter Review (Offline Mode)`,
        `**Target Profile**: ${targetRole}`,
        `**Overall Assessment**: ${atsResult.grade} (Score: ${atsResult.totalScore}/100)`,
        '',
        `#### Key Strengths:`,
        `- Technical Skills: Detected strong grounding in ${atsResult.skillsFound.slice(0, 6).join(', ') || 'foundational analytics'}.`,
        `- Metrics & Evidence: Found ${atsResult.impactEvidence.length} quantifiable metrics across experience.`,
        '',
        `#### Critical Recruiter Advice:`,
        ...atsResult.recommendations.map(r => `- ${r}`),
        '',
        `*Note: This feedback was generated locally using ATS heuristic rubrics without sending your data to any external server.*`
      ];
      return lines.join('\n');
    },

    improveBullet: function(bullet) {
      if (!bullet || bullet.trim().length < 5) {
        return 'Please select or type a specific bullet point from your resume to improve.';
      }
      return [
        '### Bullet Point Optimization (STAR / Google XYZ Formula)',
        `**Original**: "${bullet.trim()}"`,
        '',
        '**Formula**: Accomplished [X], as measured by [Y], by doing [Z]',
        '',
        '**Suggested Variations**:',
        `1. **Impact-Focused**: "Engineered optimized SQL queries and interactive dashboards to analyze operational KPIs, reducing ad-hoc reporting turnaround time by 30%."`,
        `2. **Tool-Focused**: "Visualized 50,000+ transaction records using Power BI (DAX, Star Schema) to identify seasonal trends and deliver executive weekly insights."`,
        `3. **Metric-Focused**: "Automated weekly ETL and data validation workflows using Python (pandas), cutting manual reporting overhead by 5 hours every week."`,
        '',
        '*Tip: Replace the placeholder numbers with your real project figures.*'
      ].join('\n');
    },

    draftSummary: function(skills, targetRole, company) {
      const skillsStr = skills.slice(0, 4).join(', ') || 'SQL, Excel, and Power BI';
      const roleStr = targetRole || 'Data Analyst';
      const compStr = company ? ` at ${company}` : '';
      return [
        `### Professional Summary Draft`,
        `Detail-oriented ${roleStr} with hands-on expertise in ${skillsStr} and data storytelling. Proven track record of translating complex datasets into actionable stakeholder reports, optimizing relational queries, and creating automated business dashboards. Passionate about leveraging data-driven analytics to solve operational challenges${compStr}.`
      ].join('\n');
    },

    draftCoverLetter: function(job, resumeText, skillsFound) {
      const title = job ? job.title : 'Data Analyst';
      const company = job ? job.company : 'the Hiring Team';
      const topSkills = skillsFound.slice(0, 3).join(', ') || 'SQL, Power BI, and Advanced Excel';

      return [
        `Dear Hiring Manager,`,
        '',
        `I am writing to express my strong enthusiasm for the ${title} position at ${company}. Having built hands-on analytics projects utilizing ${topSkills}, I am eager to contribute clean data pipelines, robust SQL queries, and actionable visual reports to your team.`,
        '',
        `In my recent analytics work, I developed end-to-end workflows including data cleaning, exploratory data analysis, and KPI dashboarding. I take pride in delivering clear, reproducible analyses that help business stakeholders make evidence-based decisions without ambiguity.`,
        '',
        `I am particularly drawn to ${company} because of your commitment to data-driven growth. I welcome the opportunity to discuss how my technical foundation and analytical curiosity align with your team's goals.`,
        '',
        `Thank you for your time and consideration.`,
        '',
        `Sincerely,`,
        `[Candidate Name]`,
        `[Phone | Email | LinkedIn | GitHub]`
      ].join('\n');
    },

    interviewQuestions: function(skillsFound, jobTitle) {
      const title = jobTitle || 'Data Analyst';
      return [
        `### Likely Interview Questions for ${title}`,
        '1. **SQL**: Can you explain the difference between `RANK()`, `DENSE_RANK()`, and `ROW_NUMBER()` with an example?',
        '2. **Data Modeling**: Walk me through how you would design a Star Schema for an e-commerce or sales reporting dashboard.',
        '3. **Project Deep-Dive**: Pick one project from your resume where you found unexpected anomalies or missing data. How did you resolve them?',
        '4. **Business Acumen**: If an executive asks why sales dropped 15% last month, what structured steps would you take to diagnose the root cause?',
        '5. **Power BI / BI**: How do you optimize a slow-performing dashboard or DAX calculated column versus measure?'
      ].join('\n');
    }
  };

  // -------------------------------------------------------------
  // Public Interface
  // -------------------------------------------------------------
  const ResumeAgent = {
    SKILL_TAXONOMY: SKILL_TAXONOMY,
    STRONG_ACTION_VERBS: STRONG_ACTION_VERBS,
    parseFile: parseFile,
    analyzeResumeATS: analyzeResumeATS,
    analyzeATS: analyzeResumeATS,
    matchJobWithResume: matchJobWithResume,
    matchJob: matchJobWithResume,
    OfflineGenerators: OfflineGenerators,

    // Exact Outgoing Prompt Builders (B8 Exact Disclosure)
    buildReviewPrompt: function(resumeText, targetRole) {
      const ai = window.AJSAIClient;
      if (!ai) return '';
      const userPrompt = [
        `Role: Junior Analytics Recruiter reviewing candidate for "${targetRole || 'Junior Data Analyst'}".`,
        `Review the candidate's resume below. Provide:`,
        `1. 3 Top strengths for a junior analytics role.`,
        `2. 3 Specific improvement areas with concrete action items.`,
        `3. Bullet rewriting advice using Google XYZ format (Accomplished X measured by Y doing Z).`,
        `Keep response crisp, professional, and free of filler. Never invent tools or experience not mentioned.`,
        '',
        ai.wrapUntrusted('RESUME', resumeText)
      ].join('\n');
      return ai.buildOutgoingPrompt('You are an expert junior analytics recruiter. Respond in structured Markdown.', userPrompt);
    },

    buildCoverLetterPrompt: function(job, resumeText) {
      const ai = window.AJSAIClient;
      if (!ai) return '';
      const userPrompt = [
        `Write a concise, professional 3-paragraph cover letter for a junior analytics applicant.`,
        `Job Title: ${job ? job.title : 'Data Analyst'}`,
        `Company: ${job ? job.company : 'Company'}`,
        `Job Description/Skills: ${job ? (job.skills || []).join(', ') : 'SQL, Excel, BI'}`,
        `Rules:`,
        `- Never fabricate unmentioned degrees, companies, or tools.`,
        `- Highlight only skills present in the resume below.`,
        `- Include bracketed placeholders like [Your Name] for missing candidate details.`,
        '',
        ai.wrapUntrusted('RESUME', resumeText)
      ].join('\n');
      return ai.buildOutgoingPrompt('You are a professional analytics career advisor.', userPrompt);
    },

    buildBulletImprovementPrompt: function(bullet) {
      const ai = window.AJSAIClient;
      if (!ai) return '';
      const userPrompt = [
        `Improve the following analytics resume bullet point for a junior candidate.`,
        `Apply Google's XYZ formula: Accomplished [X], as measured by [Y], by doing [Z].`,
        `Provide 3 distinct strong variations: Impact-focused, Technical/Tool-focused, and Efficiency-focused.`,
        `Never invent facts; use bracketed placeholders for metrics if missing.`,
        '',
        ai.wrapUntrusted('BULLET', bullet)
      ].join('\n');
      return ai.buildOutgoingPrompt('You are an expert technical resume editor.', userPrompt);
    },

    // AI-Enhanced actions with graceful fallback
    generateAIReview: async function(resumeText, targetRole, preapprovedPrompt) {
      const ats = analyzeResumeATS(resumeText);
      const ai = window.AJSAIClient;

      if (!ai || !ai.hasConsent()) {
        return {
          source: 'local_rule_engine',
          markdown: OfflineGenerators.recruiterReview(ats, targetRole)
        };
      }

      const finalPrompt = preapprovedPrompt || ResumeAgent.buildReviewPrompt(resumeText, targetRole);
      const res = await ai.sendDirect(finalPrompt);
      if (res.success && res.text) {
        return { source: 'puter_ai', markdown: res.text };
      }

      return {
        source: 'local_rule_engine_fallback',
        markdown: OfflineGenerators.recruiterReview(ats, targetRole) + `\n\n*(Note: Live AI timed out or was offline. Local rule analysis was used.)*`
      };
    },

    generateAICoverLetter: async function(job, resumeText, preapprovedPrompt) {
      const ats = analyzeResumeATS(resumeText);
      const ai = window.AJSAIClient;

      if (!ai || !ai.hasConsent()) {
        return {
          source: 'local_rule_engine',
          markdown: OfflineGenerators.draftCoverLetter(job, resumeText, ats.skillsFound)
        };
      }

      const finalPrompt = preapprovedPrompt || ResumeAgent.buildCoverLetterPrompt(job, resumeText);
      const res = await ai.sendDirect(finalPrompt);
      if (res.success && res.text) {
        return { source: 'puter_ai', markdown: res.text };
      }

      return {
        source: 'local_rule_engine_fallback',
        markdown: OfflineGenerators.draftCoverLetter(job, resumeText, ats.skillsFound)
      };
    },

    generateAIBulletImprovement: async function(bullet, preapprovedPrompt) {
      const ai = window.AJSAIClient;
      if (!ai || !ai.hasConsent()) {
        return { source: 'local_rule_engine', markdown: OfflineGenerators.improveBullet(bullet) };
      }

      const finalPrompt = preapprovedPrompt || ResumeAgent.buildBulletImprovementPrompt(bullet);
      const res = await ai.sendDirect(finalPrompt);
      if (res.success && res.text) {
        return { source: 'puter_ai', markdown: res.text };
      }

      return { source: 'local_rule_engine_fallback', markdown: OfflineGenerators.improveBullet(bullet) };
    }
  };

  window.AJSResumeAgent = ResumeAgent;
})(typeof window !== 'undefined' ? window : globalThis);
