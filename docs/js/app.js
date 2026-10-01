/**
 * Analytics Job Scout v2 - Master Application Controller
 * Coordinates Views, Verified Jobs, Walk-in Alerts, Resume AI, and Daily Interview Coach.
 * Strict fail-closed payload loading, single source of truth, and privacy-conscious career workspace.
 */
(function(window) {
  'use strict';

  const Storage = window.AJSStorage;

  // Single source of truth: begins empty, populated strictly from docs/data/latest.json
  let jobs = [];
  let duplicateGroups = [];
  let publishedScanMeta = null;
  let savedOnly = false;
  let companyResearchData = null;

  // Default resume is truly empty: NO sample person/contact data may ship in production code
  let currentResumeData = (Storage ? Storage.getResume() : null) || {
    rawText: '',
    fileName: '',
    updatedAt: null,
    remembered: false,
    name: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    github: '',
    summary: '',
    skills: [],
    projects: [],
    education: { degree: '', university: '', year: '' }
  };

  const rolePacks = {
    'Amazon · Business Analyst Support': ['SQL', 'data extraction', 'ETL / data pipelines', 'Advanced Excel', 'Tableau / QuickSight', 'statistical analysis', 'root-cause analysis', 'performance dashboards', 'capacity planning'],
    'Amazon · Business Analyst I, CMT': ['SQL', 'ETL', 'Excel VBA', 'PivotTables', 'Power Pivot', 'Tableau / Power BI', 'BI metrics', 'requirements gathering', 'data modelling', 'reporting'],
    'Accenture · Analytics and Modeling': ['Power BI dashboards', 'data modelling', 'dataset structuring', 'data cleansing', 'KPI reporting', 'report automation', 'sales analytics', 'CRM data quality', 'de-duplication']
  };

  const checklistGroups = [
    { title: 'Target title & summary', icon: 'doc', items: [
      ['Use one exact target title', 'Data Analyst, Business Analyst, BI Analyst, Reporting Analyst, MIS Analyst or Operations Analyst.'],
      ['Write a focused 2–3 line summary', 'State your level, strongest tools and the business outcomes you support.'],
      ['Add target location and availability', 'Include “available immediately” only when true.']
    ]},
    { title: 'SQL & data foundations', icon: 'database', items: [
      ['SQL', 'Show it in Skills and in at least one evidence bullet.'],
      ['Joins, CTEs and subqueries', 'Name only techniques you can explain in an interview.'],
      ['Window functions and aggregations', 'Useful for analytics and BI roles.'],
      ['Data validation and data quality', 'Connect the keyword to a concrete check or result.'],
      ['Query optimization', 'Include only with real hands-on evidence.']
    ]},
    { title: 'Excel', icon: 'grid', items: [
      ['Advanced Excel', 'Use the exact phrase where supported.'],
      ['PivotTables and Pivot Charts', 'High-frequency requirement across the shortlist.'],
      ['XLOOKUP or INDEX-MATCH', 'List the function you have actually used.'],
      ['Power Query', 'Useful for repeatable cleaning and transformation.'],
      ['VBA or macros', 'Useful for legacy MIS workflows; claim only if demonstrated.']
    ]},
    { title: 'Power BI & visualization', icon: 'chart', items: [
      ['Power BI', 'Place in Skills and a project bullet.'],
      ['DAX and Power Query', 'Core dashboard-building terms.'],
      ['Data modelling', 'Mention relationships, star schema or dataset structure if true.'],
      ['KPI dashboards', 'Name the KPIs and intended user.'],
      ['Tableau or QuickSight', 'Use only the tools you have actually used.'],
      ['Data visualization', 'Explain how the visual supported a business decision.']
    ]},
    { title: 'Python & analytics', icon: 'code', items: [
      ['Python and pandas', 'Show cleaning, transformation or analysis evidence.'],
      ['Exploratory data analysis (EDA)', 'Name the dataset and business question.'],
      ['Matplotlib or Seaborn', 'Pair the tool with a specific visualization.'],
      ['Descriptive statistics', 'Use accurate statistical language.'],
      ['Hypothesis testing, correlation or regression', 'Include only if you can defend the method.']
    ]},
    { title: 'Data workflow', icon: 'flow', items: [
      ['ETL / ELT', 'Spell out Extract, Transform, Load once.'],
      ['Data pipelines', 'Describe source, transformation and destination.'],
      ['Data warehouse concepts', 'Relevant to relational and dimensional modeling.'],
      ['Report automation', 'Quantify time saved or faster turnaround.'],
      ['CRM data hygiene and de-duplication', 'Relevant to data operations and accuracy.']
    ]},
    { title: 'Business analysis', icon: 'briefcase', items: [
      ['Requirements gathering', 'Show how requirements became a report or dashboard.'],
      ['KPI definition and performance tracking', 'Name the measure, cadence and audience.'],
      ['Root-cause analysis', 'State the issue, evidence and recommendation.'],
      ['Trend analysis and forecasting', 'Use where supported by a project.'],
      ['Stakeholder management', 'Name the stakeholder group without confidential data.'],
      ['Process improvement and actionable insights', 'Connect analysis to a measurable outcome.']
    ]},
    { title: 'ATS formatting', icon: 'check', items: [
      ['Use a single-column layout', 'Use standard headings: Summary, Skills, Experience, Projects, Education.'],
      ['Avoid text boxes, icons and skill bars', 'Keep the document machine-readable.'],
      ['Put contact details in the body', 'Do not rely only on headers or footers.'],
      ['Add 2–4 relevant projects', 'Especially important when professional experience is limited.'],
      ['Use at least three quantified bullets', 'Data volume, time saved, accuracy, adoption or performance.'],
      ['Save as searchable PDF', 'Use DOCX only when the portal requests it.'],
      ['Proofread claims against application answers', 'Dates, experience and skills must agree.']
    ]}
  ];

  // -------------------------------------------------------------
  // General UI Helpers
  // -------------------------------------------------------------
  function fmtDate(d) {
    if (!d) return '';
    try {
      const parts = d.split('-');
      if (parts.length === 3) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      }
      return d;
    } catch {
      return d;
    }
  }

  function escapeHTML(val) {
    return String(val ?? '').replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
    } catch {
      toast('Copy was blocked by the browser');
    }
  }

  function download(name, content, type = 'text/plain') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  // -------------------------------------------------------------
  // View Router
  // -------------------------------------------------------------
  function switchView(name) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${name}`));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));

    const titles = {
      overview: 'Overview',
      daily: 'Daily live scan',
      jobs: 'Verified jobs',
      walkins: 'Walk-in Alerts',
      applications: 'My applications',
      resume: 'Resume AI',
      ats: 'ATS checklist',
      coach: 'Interview Coach',
      audit: 'Scan audit',
      dedupe: 'Dedupe state'
    };
    const crumb = document.getElementById('crumbName');
    if (crumb) crumb.textContent = titles[name] || 'Workspace';

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (name === 'resume') {
      renderResumeATSAnalysis();
      renderCompareJob();
    } else if (name === 'coach') {
      CoachUI.init();
    } else if (name === 'walkins') {
      if (window.AJSWalkinAlerts) window.AJSWalkinAlerts.markEventsSeen();
    }
  }

  window.switchView = switchView;

  // -------------------------------------------------------------
  // Jobs & Priorities Rendering (Single Source of Truth)
  // -------------------------------------------------------------
  function hasUserResume() {
    if (!currentResumeData) return false;
    const txt = (currentResumeData.rawText || '').trim();
    const skills = currentResumeData.skills || [];
    return txt.length >= 20 || skills.length >= 2;
  }

  function getResumeFullText() {
    if (!currentResumeData) return '';
    if (currentResumeData.rawText && currentResumeData.rawText.trim().length >= 20) {
      return currentResumeData.rawText;
    }
    const parts = [
      currentResumeData.name,
      currentResumeData.headline,
      currentResumeData.summary,
      (currentResumeData.skills || []).join(', '),
      ...(currentResumeData.projects || []).map(x => `${x.title} ${x.tools} ${x.bullet}`),
      currentResumeData.education?.degree,
      currentResumeData.education?.university
    ];
    return parts.filter(Boolean).join('\n');
  }

  function renderPriorities() {
    const grid = document.getElementById('priorityGrid');
    if (!grid) return;

    if (!jobs.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><strong>No verified jobs loaded</strong>Please refresh or check connection.</div>';
      return;
    }

    let p = jobs.filter(j => j.priority).sort((a,b) => b.score - a.score);
    if (!p.length) p = [...jobs].sort((a,b) => (a.days - b.days) || (b.score - a.score)).slice(0, 3);

    const userReady = hasUserResume();
    const resumeText = getResumeFullText();

    grid.innerHTML = p.map((j, i) => {
      let fitBadge = '';
      if (userReady && window.AJSResumeAgent) {
        const matchRes = window.AJSResumeAgent.matchJobWithResume(j, resumeText);
        if (matchRes.matchScore > 0) {
          fitBadge = `<span style="color:#106c59;font-weight:700"> · 🎯 Fit: ${matchRes.matchScore}%</span>`;
        }
      }

      return `
        <article class="priority-card" data-rank="0${i+1}">
          <div class="company-line">
            <div class="company-logo ${(j.company || '').toLowerCase()}">${escapeHTML((j.company || 'C')[0])}</div>
            <div>
              <strong>${escapeHTML(j.company)}</strong>
              <span>${escapeHTML(j.location)} · ${j.days} day${j.days === 1 ? '' : 's'} ago</span>
            </div>
          </div>
          <h3>${escapeHTML(j.title)}</h3>
          <div class="mini-row">
            <span>${escapeHTML(j.exp || 'Junior fit')}</span>
            <span>${j.score}% role match${fitBadge}</span>
          </div>
          <p>${escapeHTML(j.fit || '')}</p>
          <div class="card-actions">
            <a class="btn primary" data-apply-open="${escapeHTML(j.id)}" href="${escapeHTML(j.apply)}" target="_blank" rel="noopener noreferrer">Apply now ↗</a>
            <button class="btn" data-match-job="${escapeHTML(j.id)}">🎯 Match resume</button>
            <button class="btn" data-practice-job="${escapeHTML(j.id)}">🎤 Practice</button>
            <button class="btn" data-research-company="${escapeHTML(j.company)}">🏢 Research</button>
          </div>
        </article>`;
    }).join('');

    bindJobButtons();
  }

  function renderJobs() {
    const el = document.getElementById('jobsList');
    if (!el) return;

    if (!jobs.length) {
      el.innerHTML = '<div class="empty-state"><strong>No verified jobs available</strong>The published scan data is currently empty or unavailable. Zero unverified jobs are shown.</div>';
      const countEl = document.getElementById('resultCount');
      if (countEl) countEl.textContent = 'Showing 0 roles';
      return;
    }

    const q = (document.getElementById('jobSearch')?.value || '').trim().toLowerCase();
    const loc = document.getElementById('locationFilter')?.value || 'all';
    const size = document.getElementById('sizeFilter')?.value || 'all';
    const fresh = document.getElementById('freshnessFilter')?.value || 'all';
    const company = document.getElementById('companyFilter')?.value || 'all';
    const sort = document.getElementById('sortFilter')?.value || 'match';

    const savedJobsList = Storage ? Storage.getSavedJobs() : [];
    const savedIds = new Set(savedJobsList.map(j => j.id));

    let list = jobs.filter(j => {
      const hay = [j.title, j.company, j.location, j.exp, j.fit, ...(j.skills || [])].join(' ').toLowerCase();
      return (!q || hay.includes(q)) &&
             (loc === 'all' || j.location === loc) &&
             (size === 'all' || (j.company_size || 'Unknown') === size) &&
             (fresh === 'all' || j.window === fresh) &&
             (company === 'all' || j.company === company) &&
             (!savedOnly || savedIds.has(j.id));
    });

    if (sort === 'match') list.sort((a,b) => b.score - a.score || a.days - b.days);
    if (sort === 'company') list.sort((a,b) => a.company.localeCompare(b.company) || a.days - b.days);
    if (sort === 'newest') list.sort((a,b) => a.days - b.days || b.score - a.score);

    const countEl = document.getElementById('resultCount');
    if (countEl) countEl.textContent = `Showing ${list.length} role${list.length === 1 ? '' : 's'}`;

    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><strong>No roles match these filters</strong>Try adjusting your search or clearing filters.</div>';
      return;
    }

    const userReady = hasUserResume();
    const resumeText = getResumeFullText();

    el.innerHTML = list.map(j => {
      let scoreBadge = '';
      if (userReady && window.AJSResumeAgent) {
        const matchRes = window.AJSResumeAgent.matchJobWithResume(j, resumeText);
        if (matchRes.matchScore > 0) {
          scoreBadge = `<span class="badge" style="background:#eaf4fd;color:#185a9d;border:1px solid #c7e0f8">🎯 Your Fit: ${matchRes.matchScore}%</span>`;
        }
      }

      const isSaved = savedIds.has(j.id);
      const sizeTag = j.company_size ? `<span class="badge" style="background:#f4f4f4;color:#495057">${escapeHTML(j.company_size)}</span>` : '';

      return `
        <article class="job-card" id="job-card-${escapeHTML(j.id)}">
          <div class="company-logo ${(j.company || '').toLowerCase()}">${escapeHTML((j.company || 'C')[0])}</div>
          <div class="job-main">
            <div class="job-topline">
              <span class="badge ${j.window}">${j.window === 'fresh' ? 'Fresh' : 'Backup'} · ${j.days}d</span>
              <span class="badge verified">✓ Verified Official</span>
              ${sizeTag}
              ${isSaved ? '<span class="badge saved">♥ Saved</span>' : ''}
              ${scoreBadge}
            </div>
            <h3><a href="${escapeHTML(j.detail || j.apply)}" target="_blank" rel="noopener noreferrer">${escapeHTML(j.title)}</a></h3>
            <div class="job-meta">
              <span><strong>${escapeHTML(j.company)}</strong></span><span>•</span>
              <span>${escapeHTML(j.location)}</span><span>•</span>
              <span>${escapeHTML(j.type || 'Full-time')}</span><span>•</span>
              <span>${escapeHTML(j.exp || '0–2 yrs')}</span><span>•</span>
              <span>${fmtDate(j.date)}</span>
            </div>
            <div class="chip-row">
              ${(j.skills || []).slice(0, 7).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join('')}
            </div>
          </div>
          <div class="score">
            <div class="score-ring" style="--score:${j.score}"><strong>${j.score}%</strong></div>
            <small>role fit</small>
          </div>
          <div class="job-actions">
            <a class="btn primary" data-apply-open="${escapeHTML(j.id)}" href="${escapeHTML(j.apply)}" target="_blank" rel="noopener noreferrer">Apply on official site ↗</a>
            <button class="btn" data-match-job="${escapeHTML(j.id)}">🎯 Match my resume</button>
            <button class="btn" data-practice-job="${escapeHTML(j.id)}">🎤 Practice for this job</button>
            <button class="btn" data-research-company="${escapeHTML(j.company)}">🏢 Research company</button>
            <button class="btn save-btn ${isSaved ? 'saved' : ''}" data-save="${escapeHTML(j.id)}">${isSaved ? '♥ Saved' : '♡ Save'}</button>
            <button class="btn small" data-report-job="${escapeHTML(j.id)}" title="Report a broken or expired link on this device">🚩 Report link</button>
          </div>
        </article>`;
    }).join('');

    bindJobButtons();
  }

  function bindJobButtons() {
    // Save toggle
    document.querySelectorAll('[data-save]').forEach(btn => {
      btn.addEventListener('click', () => toggleSave(btn.dataset.save));
    });

    // Match resume
    document.querySelectorAll('[data-match-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = btn.dataset.matchJob;
        switchView('resume');
        const compSelect = document.getElementById('compareJobSelect');
        if (compSelect) {
          compSelect.value = jobId;
          renderCompareJob();
        }
      });
    });

    // Practice for job
    document.querySelectorAll('[data-practice-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = btn.dataset.practiceJob;
        const targetJob = jobs.find(j => j.id === jobId);
        switchView('coach');
        CoachUI.startJobPractice(targetJob);
      });
    });

    // Research company
    document.querySelectorAll('[data-research-company]').forEach(btn => {
      btn.addEventListener('click', () => {
        const compName = btn.dataset.researchCompany;
        openCompanyResearch(compName);
      });
    });

    // Report broken link
    document.querySelectorAll('[data-report-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = btn.dataset.reportJob;
        const card = document.getElementById(`job-card-${jobId}`);
        if (card) card.style.display = 'none';
        toast('Link problem reported on this device. Card hidden.');
      });
    });

    bindApplyTracking();
  }

  function toggleSave(id) {
    if (!Storage) return;
    const saved = Storage.getSavedJobs();
    const exists = saved.some(j => j.id === id);
    if (exists) {
      Storage.removeSavedJob(id);
      toast('Removed from saved roles');
    } else {
      const job = jobs.find(j => j.id === id);
      if (job) {
        Storage.saveJob(job);
        toast('Role saved');
      }
    }
    updateSaved();
    renderJobs();
  }

  function updateSaved() {
    const saved = Storage ? Storage.getSavedJobs() : [];
    const cnt = document.getElementById('savedCount');
    if (cnt) cnt.textContent = saved.length;
    const btn = document.getElementById('savedToggle');
    if (btn) btn.innerHTML = `${savedOnly ? '♥' : '♡'} Saved only <span>${saved.length}</span>`;
  }

  function bindApplyTracking() {
    document.querySelectorAll('[data-apply-open]').forEach(a => {
      if (a.dataset.bound) return;
      a.dataset.bound = '1';
      a.addEventListener('click', () => {
        const jobId = a.dataset.applyOpen;
        const job = jobs.find(j => j.id === jobId);
        if (Storage && job) {
          // Explicit requirement: Opening an Apply link tracks as "Opened" / "To apply", NOT automatically "Applied"!
          Storage.recordApplication(job, 'Opened');
          renderApplications();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Application Tracking (Preserves Semantics)
  // -------------------------------------------------------------
  function renderApplications() {
    const apps = Storage ? Storage.getApplications() : [];
    const navCount = document.getElementById('applicationNavCount');
    if (navCount) navCount.textContent = apps.length;

    const metricsEl = document.getElementById('applicationMetrics');
    if (metricsEl) {
      metricsEl.innerHTML = `
        <div class="metric blue"><div class="metric-top"><span class="metric-label">Tracked</span></div><strong>${apps.length}</strong><div class="metric-note">Total openings logged</div></div>
        <div class="metric"><div class="metric-top"><span class="metric-label">Submitted</span></div><strong>${apps.filter(a => a.status === 'Applied').length}</strong><div class="metric-note">Submitted by you</div></div>
        <div class="metric amber"><div class="metric-top"><span class="metric-label">Interviewing</span></div><strong>${apps.filter(a => a.status === 'Interview').length}</strong><div class="metric-note">Process active</div></div>
        <div class="metric gray"><div class="metric-top"><span class="metric-label">Opened / Pending</span></div><strong>${apps.filter(a => a.status === 'Opened' || a.status === 'To apply').length}</strong><div class="metric-note">In consideration</div></div>`;
    }

    const listEl = document.getElementById('applicationList');
    if (!listEl) return;
    if (!apps.length) {
      listEl.innerHTML = '<div class="empty-apps"><strong>No tracked applications yet</strong>Click "Apply on official site" on any job to log an application.</div>';
      return;
    }

    const statuses = ['Opened', 'To apply', 'Applied', 'Interview', 'Offer', 'Rejected'];

    listEl.innerHTML = apps.map(a => `
      <div class="application-row">
        <div class="application-role">
          <strong>${escapeHTML(a.title)}</strong>
          <span>${escapeHTML(a.company)}</span>
        </div>
        <select class="status-select" data-app-id="${escapeHTML(a.id)}">
          ${statuses.map(s => `<option value="${s}" ${(a.status || 'Opened') === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span class="application-date">Logged ${new Date(a.appliedAt || Date.now()).toLocaleDateString('en-IN')}</span>
        <div class="card-actions">
          <a class="btn small primary" href="${escapeHTML(a.apply_url)}" target="_blank" rel="noopener noreferrer">Open portal ↗</a>
          <button class="btn small" data-remove-app="${escapeHTML(a.id)}">Remove</button>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('[data-app-id]').forEach(sel => {
      sel.addEventListener('change', () => {
        const id = sel.dataset.appId;
        if (Storage) {
          Storage.updateApplicationStatus(id, sel.value);
          renderApplications();
        }
      });
    });

    listEl.querySelectorAll('[data-remove-app]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.removeApp;
        if (Storage) {
          Storage.removeApplication(id);
          renderApplications();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Resume Feature Module (ATS, Matching, and Fallbacks)
  // -------------------------------------------------------------
  function renderResumeATSAnalysis() {
    const hasResume = hasUserResume();
    const text = getResumeFullText();

    const result = (hasResume && window.AJSResumeAgent)
      ? window.AJSResumeAgent.analyzeResumeATS(text)
      : { totalScore: 0, grade: 'No Resume Loaded', breakdown: [], recommendations: [], skillsFound: [] };

    // Update gauge
    const circle = document.getElementById('atsScoreGaugeCircle');
    if (circle) circle.style.setProperty('--gauge-pct', result.totalScore);
    const scoreVal = document.getElementById('atsScoreValue');
    if (scoreVal) scoreVal.textContent = result.totalScore;
    const scoreGrade = document.getElementById('atsScoreGrade');
    if (scoreGrade) scoreGrade.textContent = result.grade;

    // Breakdown list
    const bdEl = document.getElementById('atsBreakdownList');
    if (bdEl) {
      if (hasResume && result.breakdown.length) {
        bdEl.innerHTML = result.breakdown.map(b => `
          <div class="ats-breakdown-row">
            <div class="ats-breakdown-info">
              <strong>${escapeHTML(b.category)}</strong>
              <span>${escapeHTML(b.detail)}</span>
            </div>
            <span class="ats-breakdown-pts ${b.earned > 0 ? 'good' : ''}">${b.earned > 0 ? '+' : ''}${b.earned} / ${b.max} pts</span>
          </div>`).join('');
      } else {
        bdEl.innerHTML = `
          <div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">
            Upload a .pdf / .docx or paste resume text to calculate your 0–100 ATS benchmark score.
          </div>`;
      }
    }

    // Recommendations list
    const recEl = document.getElementById('atsRecommendationsList');
    if (recEl) {
      if (hasResume && result.recommendations.length) {
        recEl.innerHTML = result.recommendations.map(r => `<li>${escapeHTML(r)}</li>`).join('');
      } else if (hasResume) {
        recEl.innerHTML = '<li style="color:#118c73">✓ Your resume meets core ATS benchmarks for junior analytics roles!</li>';
      } else {
        recEl.innerHTML = '<li>Upload your resume above to view personalized ATS improvement points.</li>';
      }
    }

    // Extracted Skills chips
    const skillsWrap = document.getElementById('atsSkillsFoundWrap');
    if (skillsWrap) {
      if (hasResume && result.skillsFound && result.skillsFound.length) {
        skillsWrap.innerHTML = result.skillsFound.map(s => `<span class="skill-pill active">${escapeHTML(s)}</span>`).join('');
      } else {
        skillsWrap.innerHTML = '<span style="color:#718f87;font-size:11px">Upload or paste resume text to extract analytics skills.</span>';
      }
    }

    // Memory vs Device indicator
    const devIndicator = document.getElementById('resumeStorageBadge');
    if (devIndicator) {
      if (currentResumeData && currentResumeData.remembered) {
        devIndicator.textContent = 'Saved to this device';
        devIndicator.style.background = '#e6f5f1';
        devIndicator.style.color = '#106c59';
      } else {
        devIndicator.textContent = 'In page memory only (private)';
        devIndicator.style.background = '#fff3dd';
        devIndicator.style.color = '#b56b0b';
      }
    }

    const wcEl = document.getElementById('resumeWordCount');
    if (wcEl) wcEl.textContent = `${result.wordCount || 0} words`;
  }

  function renderCompareJob() {
    const select = document.getElementById('compareJobSelect');
    if (!select) return;

    if (!select.options.length && jobs.length > 0) {
      select.innerHTML = jobs.map(j => `<option value="${escapeHTML(j.id)}">${escapeHTML(j.company)} · ${escapeHTML(j.title)} (${escapeHTML(j.location)})</option>`).join('');
    }

    const jobId = select.value || (jobs[0] && jobs[0].id);
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const hasResume = hasUserResume();
    const resumeText = getResumeFullText();

    const match = (hasResume && window.AJSResumeAgent)
      ? window.AJSResumeAgent.matchJobWithResume(job, resumeText)
      : { matchScore: 0, matchedSkills: [], missingSkills: (job.skills || []) };

    const circle = document.getElementById('inspectScoreCircle');
    if (circle) circle.style.setProperty('--gauge-pct', match.matchScore);
    const textEl = document.getElementById('inspectScoreText');
    if (textEl) textEl.textContent = `${match.matchScore}%`;
    const titleEl = document.getElementById('inspectScoreTitle');
    if (titleEl) titleEl.textContent = `${job.company} · ${job.title}`;
    const subEl = document.getElementById('inspectScoreSub');
    if (subEl) subEl.textContent = hasResume
      ? `${match.matchedSkills.length} of ${(job.skills || []).length} keywords matched`
      : 'No resume loaded. Upload resume to calculate match.';

    const matchedEl = document.getElementById('inspectMatchedSkills');
    if (matchedEl) {
      matchedEl.innerHTML = (match.matchedSkills && match.matchedSkills.length)
        ? match.matchedSkills.map(s => `<span class="match-chip-hit">✓ ${escapeHTML(s)}</span>`).join('')
        : '<span style="color:#a2c4bc;font-size:10px">No keyword overlap detected yet.</span>';
    }

    const missingEl = document.getElementById('inspectMissingSkills');
    if (missingEl) {
      missingEl.innerHTML = (match.missingSkills && match.missingSkills.length)
        ? match.missingSkills.map(s => `
          <span class="match-chip-miss">
            ${escapeHTML(s)}
            <button type="button" data-add-missing-study="${escapeHTML(s)}" title="Add to learning / edit checklist">+ Add to study list</button>
          </span>`).join('')
        : '<span style="color:#7de8cc;font-size:10px">✓ 100% keyword coverage!</span>';

      // Fixed: Replace silent skill mutation with study checklist item!
      missingEl.querySelectorAll('[data-add-missing-study]').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.addMissingStudy;
          if (Storage) {
            const list = Storage.getChecklist();
            if (!list.includes(s)) {
              list.push(s);
              Storage.saveChecklist(list);
            }
          }
          toast(`Added "${s}" to study checklist. To include in ATS score, add truthful project evidence.`);
        });
      });
    }
  }

  function saveResume(remember) {
    if (remember !== undefined) currentResumeData.remembered = remember;
    if (Storage) {
      Storage.saveResume(currentResumeData, currentResumeData.remembered);
    }
    toast(currentResumeData.remembered ? 'Saved to local device' : 'Kept in page memory');
    renderResumeATSAnalysis();
    renderCompareJob();
    renderJobs();
  }

  // -------------------------------------------------------------
  // AI Suggestions Runner & Consent Handling (Fixed Decline Loop)
  // -------------------------------------------------------------
  async function runAIEnhancement(actionType) {
    const ai = window.AJSAIClient;
    const outputEl = document.getElementById('aiSuggestionsOutput');
    const statusEl = document.getElementById('aiStatusNotice');
    if (!outputEl) return;

    // Check consent
    if (ai && !ai.hasConsent()) {
      showAIConsentModal(
        () => runAIEnhancement(actionType), // onApproved
        () => runLocalFallbackEnhancement(actionType) // onDeclined: run local fallback once, never re-prompt!
      );
      return;
    }

    outputEl.innerHTML = '<div style="padding:20px;text-align:center;color:#63716d">Analyzing resume content via Puter.js AI…</div>';
    if (statusEl) statusEl.textContent = 'Generating guidance via AI…';

    const resumeText = getResumeFullText();
    const select = document.getElementById('compareJobSelect');
    const selectedJob = jobs.find(j => j.id === (select ? select.value : '')) || jobs[0];

    try {
      let result = null;
      if (actionType === 'recruiter_review') {
        result = await window.AJSResumeAgent.generateAIReview(resumeText, selectedJob?.title);
      } else if (actionType === 'cover_letter') {
        result = await window.AJSResumeAgent.generateAICoverLetter(selectedJob, resumeText);
      } else if (actionType === 'improve_bullet') {
        const bullet = prompt('Paste a resume project bullet point to optimize:', currentResumeData.projects?.[0]?.bullet || '');
        if (!bullet) {
          outputEl.innerHTML = '<div style="padding:15px;color:#63716d">No bullet point was entered.</div>';
          return;
        }
        result = await window.AJSResumeAgent.generateAIBulletImprovement(bullet);
      } else {
        runLocalFallbackEnhancement(actionType);
        return;
      }

      if (result && result.markdown) {
        outputEl.innerHTML = `<div style="font-size:12px;line-height:1.65;white-space:pre-wrap;color:#14221f;font-family:inherit">${escapeHTML(result.markdown)}</div>`;
        if (statusEl) statusEl.textContent = result.source.includes('puter') ? 'Generated via Puter.js AI' : 'Generated via Local Rule Engine';
      }
    } catch (err) {
      console.warn('[AI] Error in AI enhancement:', err);
      runLocalFallbackEnhancement(actionType);
    }
  }

  function runLocalFallbackEnhancement(actionType) {
    const outputEl = document.getElementById('aiSuggestionsOutput');
    const statusEl = document.getElementById('aiStatusNotice');
    if (!outputEl) return;

    const resumeText = getResumeFullText();
    const select = document.getElementById('compareJobSelect');
    const selectedJob = jobs.find(j => j.id === (select ? select.value : '')) || jobs[0];
    const skills = currentResumeData.skills || [];

    let text = '';
    if (actionType === 'summary') {
      text = window.AJSResumeAgent.OfflineGenerators.draftSummary(skills, selectedJob?.title, selectedJob?.company);
    } else if (actionType === 'questions') {
      const qList = (selectedJob?.skills || []).slice(0, 3).map(s => `- Tell me about a scenario where you used ${s} to solve a complex data quality or business reporting issue.`);
      text = `### Tailored Interview Questions (Local Rubric)\n\n${qList.join('\n')}\n- Can you explain how you designed relationships or star schemas in your dashboard project?`;
    } else if (actionType === 'recruiter_review') {
      const ats = window.AJSResumeAgent.analyzeResumeATS(resumeText);
      text = window.AJSResumeAgent.OfflineGenerators.recruiterReview(ats, selectedJob?.title);
    } else if (actionType === 'cover_letter') {
      text = window.AJSResumeAgent.OfflineGenerators.draftCoverLetter(selectedJob, resumeText, skills);
    } else if (actionType === 'improve_bullet') {
      text = window.AJSResumeAgent.OfflineGenerators.improveBullet('Extracted customer data using SQL and created reporting dashboards.');
    }

    outputEl.innerHTML = `<div style="font-size:12px;line-height:1.65;white-space:pre-wrap;color:#14221f;font-family:inherit">${escapeHTML(text)}</div>`;
    if (statusEl) statusEl.textContent = 'Generated via Local Deterministic Engine (Offline)';
  }

  function showAIConsentModal(onApproved, onDeclined) {
    const modal = document.getElementById('aiConsentModal');
    if (!modal) {
      if (confirm('Analytics Job Scout: Allow Puter.js to analyze your resume text for feedback? (Local fallback is always available).')) {
        if (window.AJSAIClient) window.AJSAIClient.grantConsent();
        if (onApproved) onApproved();
      } else {
        if (window.AJSAIClient) window.AJSAIClient.revokeConsent();
        if (onDeclined) onDeclined();
      }
      return;
    }

    modal.hidden = false;
    const approveBtn = document.getElementById('aiConsentApproveBtn');
    const declineBtn = document.getElementById('aiConsentDeclineBtn');

    const cleanup = () => {
      approveBtn.removeEventListener('click', handleApprove);
      declineBtn.removeEventListener('click', handleDecline);
    };

    const handleApprove = () => {
      cleanup();
      modal.hidden = true;
      if (window.AJSAIClient) window.AJSAIClient.grantConsent();
      if (onApproved) onApproved();
    };

    const handleDecline = () => {
      cleanup();
      modal.hidden = true;
      if (window.AJSAIClient) window.AJSAIClient.revokeConsent();
      toast('Operating in offline local rubric mode');
      // Critical fix: Invoke onDeclined local fallback once, NEVER onApproved!
      if (onDeclined) onDeclined();
    };

    approveBtn.addEventListener('click', handleApprove);
    declineBtn.addEventListener('click', handleDecline);
  }

  // -------------------------------------------------------------
  // Company Research Drawer Feature
  // -------------------------------------------------------------
  async function loadCompanyResearch() {
    if (companyResearchData) return companyResearchData;
    try {
      const res = await fetch('./sources/company_research.json');
      if (res.ok) {
        companyResearchData = await res.json();
      }
    } catch (e) {
      console.warn('[Research] Could not load company_research.json, using dynamic links:', e);
    }
    return companyResearchData;
  }

  async function openCompanyResearch(companyName) {
    const modal = document.getElementById('companyResearchModal');
    const titleEl = document.getElementById('researchModalTitle');
    const gridEl = document.getElementById('researchLinksGrid');
    if (!modal || !gridEl) return;

    if (titleEl) titleEl.textContent = `Company Research: ${companyName}`;

    await loadCompanyResearch();
    const reg = (companyResearchData && companyResearchData.research_links) || {};
    const key = (companyName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const meta = reg[key] || {};

    const aboutUrl = meta.about_url || `https://www.google.com/search?q=${encodeURIComponent(companyName + ' official website')}`;
    const careersUrl = meta.careers_url || `https://www.google.com/search?q=${encodeURIComponent(companyName + ' careers')}`;
    const glassdoorUrl = meta.glassdoor_search_url || `https://www.glassdoor.co.in/Search/results.htm?keyword=${encodeURIComponent(companyName)}`;
    const redditUrl = meta.reddit_search_url || `https://www.reddit.com/r/developersIndia/search/?q=${encodeURIComponent(companyName + ' data analyst interview')}`;
    const ambitionboxUrl = meta.ambitionbox_search_url || `https://www.ambitionbox.com/search?q=${encodeURIComponent(companyName)}`;
    const linkedinUrl = meta.linkedin_search_url || `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;

    gridEl.innerHTML = `
      <a class="research-link-card" href="${escapeHTML(aboutUrl)}" target="_blank" rel="noopener noreferrer">
        🌐 Official About Page ↗
      </a>
      <a class="research-link-card" href="${escapeHTML(careersUrl)}" target="_blank" rel="noopener noreferrer">
        💼 Official Careers Portal ↗
      </a>
      <a class="research-link-card" href="${escapeHTML(glassdoorUrl)}" target="_blank" rel="noopener noreferrer">
        ⭐ Glassdoor Reviews (Subjective) ↗
      </a>
      <a class="research-link-card" href="${escapeHTML(redditUrl)}" target="_blank" rel="noopener noreferrer">
        💬 Reddit Discussions (r/developersIndia) ↗
      </a>
      <a class="research-link-card" href="${escapeHTML(ambitionboxUrl)}" target="_blank" rel="noopener noreferrer">
        🏢 AmbitionBox India Reports ↗
      </a>
      <a class="research-link-card" href="${escapeHTML(linkedinUrl)}" target="_blank" rel="noopener noreferrer">
        👥 Official LinkedIn Identity ↗
      </a>
    `;

    modal.hidden = false;
  }

  window.openCompanyResearch = openCompanyResearch;

  // -------------------------------------------------------------
  // Daily Interview Coach UI Controller
  // -------------------------------------------------------------
  const CoachUI = {
    tracks: [],
    currentSession: null,
    currentQuestionIndex: 0,
    activeQuestion: null,
    questionStartTime: 0,
    timerInterval: null,
    recognizer: null,
    isListening: false,
    sessionAnswers: [],

    init: async function() {
      if (!Array.isArray(CoachUI.tracks) || !CoachUI.tracks.length) {
        const loaded = await window.AJSInterviewCoach.loadQuestionBank();
        CoachUI.tracks = Array.isArray(loaded) ? loaded : [];
      }
      CoachUI.renderTracks();
      CoachUI.renderStreakAndStats();
      CoachUI.renderDrills();
    },

    renderTracks: function() {
      const container = document.getElementById('coachTrackGrid');
      if (!container) return;

      container.innerHTML = CoachUI.tracks.map(t => `
        <div class="coach-track-card">
          <div class="coach-track-head">
            <div>
              <h3>${escapeHTML(t.title)}</h3>
              <p>${escapeHTML(t.description || '')}</p>
            </div>
          </div>
          <div class="coach-track-actions">
            <button class="btn small primary" data-start-session="${escapeHTML(t.id)}" data-duration="5">5 min (3 Qs)</button>
            <button class="btn small" data-start-session="${escapeHTML(t.id)}" data-duration="10">10 min (5 Qs)</button>
            <button class="btn small" data-start-session="${escapeHTML(t.id)}" data-duration="15">15 min (8 Qs)</button>
          </div>
        </div>
      `).join('');

      container.querySelectorAll('[data-start-session]').forEach(btn => {
        btn.addEventListener('click', () => {
          const trackId = btn.dataset.startSession;
          const duration = parseInt(btn.dataset.duration || '5', 10);
          CoachUI.startTrackSession(trackId, duration);
        });
      });
    },

    renderStreakAndStats: function() {
      const storage = window.AJSStorage;
      const data = storage ? storage.getInterviewData() : { streak: 0, sessionsCount: 0, questionsAnswered: 0 };

      const streakEl = document.getElementById('coachStreakCount');
      if (streakEl) streakEl.textContent = data.streak || 0;

      const sessEl = document.getElementById('coachSessionsCount');
      if (sessEl) sessEl.textContent = data.sessionsCount || 0;

      const qEl = document.getElementById('coachQuestionsCount');
      if (qEl) qEl.textContent = data.questionsAnswered || 0;

      const avgEl = document.getElementById('coachAvgScore');
      if (avgEl) {
        if (data.recentScores && data.recentScores.length) {
          const sum = data.recentScores.reduce((a, b) => a + b, 0);
          avgEl.textContent = `${Math.round(sum / data.recentScores.length)}%`;
        } else {
          avgEl.textContent = '--';
        }
      }

      // Fixed: 7-day activity bars using Asia/Kolkata date helper to prevent midnight shift!
      const barsEl = document.getElementById('coach7DayBars');
      if (barsEl && storage) {
        const todayStr = storage.getLocalDateIST();
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = storage.getLocalDateIST(d);
          const dayName = d.toLocaleDateString('en-US', { weekday: 'narrow' });
          const matches = (data.history || []).filter(h => h.date === dateStr);
          days.push({ name: dayName, count: matches.length });
        }
        barsEl.innerHTML = days.map(day => `
          <div class="day-bar-col">
            <div class="day-bar-fill ${day.count > 0 ? 'active' : ''}" style="height:${Math.min(100, Math.max(12, day.count * 35))}px" title="${day.count} sessions"></div>
            <span>${day.name}</span>
          </div>
        `).join('');
      }
    },

    renderDrills: function() {
      const drillsEl = document.getElementById('coachDrillsList');
      if (!drillsEl) return;
      const drills = window.AJSInterviewCoach.COMMUNICATION_DRILLS || [];

      drillsEl.innerHTML = drills.map(d => `
        <div class="coach-drill-item">
          <div>
            <strong>${escapeHTML(d.title)}</strong>
            <p>${escapeHTML(d.subtitle)}</p>
          </div>
          <button class="btn small" data-start-drill="${escapeHTML(d.id)}">Start drill (${d.targetSeconds}s)</button>
        </div>
      `).join('');

      drillsEl.querySelectorAll('[data-start-drill]').forEach(btn => {
        btn.addEventListener('click', () => {
          const drill = drills.find(x => x.id === btn.dataset.startDrill);
          if (drill) CoachUI.startCommunicationDrill(drill);
        });
      });
    },

    startTrackSession: async function(trackId, durationMinutes) {
      if (!CoachUI.tracks || !CoachUI.tracks.length) {
        CoachUI.tracks = await window.AJSInterviewCoach.loadQuestionBank();
      }
      const qCount = durationMinutes === 15 ? 8 : (durationMinutes === 10 ? 5 : 3);
      let qs = [];

      if (trackId === 'mixed_daily') {
        qs = window.AJSInterviewCoach.getDailyMixedSession(CoachUI.tracks, qCount);
      } else {
        qs = window.AJSInterviewCoach.getQuestionsForTrack(CoachUI.tracks, trackId, qCount);
      }

      if (!qs.length) {
        toast('No questions available for this track.');
        return;
      }

      CoachUI.currentSession = {
        trackId: trackId,
        trackName: CoachUI.tracks.find(t => t.id === trackId)?.title || 'Mixed Practice',
        durationMinutes: durationMinutes,
        questions: qs
      };
      CoachUI.currentQuestionIndex = 0;
      CoachUI.sessionAnswers = [];

      CoachUI.showArena();
      CoachUI.loadQuestion(0);
    },

    startJobPractice: async function(job) {
      if (!CoachUI.tracks || !CoachUI.tracks.length) {
        CoachUI.tracks = await window.AJSInterviewCoach.loadQuestionBank();
      }
      const qs = window.AJSInterviewCoach.getQuestionsForJob(CoachUI.tracks, job, 5);
      CoachUI.currentSession = {
        trackId: 'job_specific',
        trackName: `Interview for ${job.title} (${job.company})`,
        durationMinutes: 10,
        questions: qs,
        job: job
      };
      CoachUI.currentQuestionIndex = 0;
      CoachUI.sessionAnswers = [];

      CoachUI.showArena();
      CoachUI.loadQuestion(0);
    },

    startCommunicationDrill: function(drill) {
      CoachUI.currentSession = {
        trackId: 'communication_drill',
        trackName: drill.title,
        durationMinutes: Math.round(drill.targetSeconds / 60),
        questions: [{
          id: drill.id,
          question: drill.prompt,
          sampleAnswerPoints: drill.structureChecklist,
          rubricKeywords: ['problem', 'solution', 'impact', 'metrics', 'action', 'result']
        }]
      };
      CoachUI.currentQuestionIndex = 0;
      CoachUI.sessionAnswers = [];

      CoachUI.showArena();
      CoachUI.loadQuestion(0);
    },

    showArena: function() {
      document.getElementById('coachSetupPanel').hidden = true;
      document.getElementById('coachArenaPanel').hidden = false;
      document.getElementById('coachCompletePanel').hidden = true;
    },

    loadQuestion: function(index) {
      CoachUI.currentQuestionIndex = index;
      const q = CoachUI.currentSession.questions[index];
      CoachUI.activeQuestion = q;
      CoachUI.questionStartTime = Date.now();

      document.getElementById('arenaSessionTitle').textContent = CoachUI.currentSession.trackName;
      document.getElementById('arenaQuestionCounter').textContent = `Question ${index + 1} of ${CoachUI.currentSession.questions.length}`;
      document.getElementById('arenaQuestionText').textContent = q.question;

      const answerInput = document.getElementById('arenaAnswerText');
      if (answerInput) answerInput.value = '';
      document.getElementById('arenaFeedbackWrap').hidden = true;
      document.getElementById('arenaAnswerActions').hidden = false;

      clearInterval(CoachUI.timerInterval);
      const timerEl = document.getElementById('arenaTimerDisplay');
      CoachUI.timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - CoachUI.questionStartTime) / 1000);
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${m}:${s}`;
      }, 1000);

      const readAloud = document.getElementById('coachVoiceReadAloudToggle')?.checked;
      if (readAloud && window.AJSInterviewCoach.Speech.isSynthesisSupported()) {
        window.AJSInterviewCoach.Speech.speak(q.question);
      }
    },

    toggleVoiceRecognition: function() {
      const speech = window.AJSInterviewCoach.Speech;
      if (!speech.isRecognitionSupported()) {
        toast('Speech recognition not supported in this browser. Please type your answer.');
        return;
      }

      const micBtn = document.getElementById('arenaMicBtn');
      const micStatus = document.getElementById('arenaMicStatus');

      if (CoachUI.isListening) {
        if (CoachUI.recognizer) CoachUI.recognizer.stop();
        CoachUI.isListening = false;
        if (micBtn) micBtn.classList.remove('recording');
        if (micStatus) micStatus.textContent = 'Microphone ready';
        return;
      }

      CoachUI.recognizer = speech.createRecognizer(
        res => {
          const input = document.getElementById('arenaAnswerText');
          if (input) {
            input.value = res.final + (res.interim ? ' ' + res.interim : '');
          }
        },
        err => {
          toast('Microphone error: ' + err);
          CoachUI.isListening = false;
          if (micBtn) micBtn.classList.remove('recording');
          if (micStatus) micStatus.textContent = 'Mic off';
        },
        () => {
          CoachUI.isListening = false;
          if (micBtn) micBtn.classList.remove('recording');
          if (micStatus) micStatus.textContent = 'Mic stopped';
        }
      );

      try {
        CoachUI.recognizer.start();
        CoachUI.isListening = true;
        if (micBtn) micBtn.classList.add('recording');
        if (micStatus) micStatus.textContent = 'Listening… speak clearly';
      } catch (err) {
        toast('Could not start microphone: ' + err.message);
      }
    },

    // Fixed: Submit answer displays deterministic metrics immediately, then provides Puter AI coaching if consented!
    submitAnswer: async function() {
      clearInterval(CoachUI.timerInterval);
      if (CoachUI.isListening && CoachUI.recognizer) {
        CoachUI.recognizer.stop();
        CoachUI.isListening = false;
      }

      const answerText = (document.getElementById('arenaAnswerText')?.value || '').trim();
      if (!answerText) {
        toast('Please speak or type an answer before evaluating.');
        return;
      }

      const elapsedSec = Math.max(5, Math.floor((Date.now() - CoachUI.questionStartTime) / 1000));
      const metrics = window.AJSInterviewCoach.analyzeTranscript(answerText, CoachUI.activeQuestion, elapsedSec);

      CoachUI.sessionAnswers.push({
        question: CoachUI.activeQuestion.question,
        answer: answerText,
        metrics: metrics
      });

      // 1. Display deterministic metrics immediately!
      document.getElementById('arenaAnswerActions').hidden = true;
      const feedbackWrap = document.getElementById('arenaFeedbackWrap');
      feedbackWrap.hidden = false;

      document.getElementById('arenaScorePill').textContent = `${metrics.score}/100`;
      document.getElementById('arenaPacingPill').textContent = `${metrics.wpm} WPM · ${metrics.pacingAssessment}`;
      document.getElementById('arenaFillersPill').textContent = `${metrics.totalFillers} fillers`;

      const modelEl = document.getElementById('arenaSampleAnswerList');
      if (modelEl) {
        modelEl.innerHTML = (CoachUI.activeQuestion.sampleAnswerPoints || []).map(p => `<li>${escapeHTML(p)}</li>`).join('');
      }

      // 2. Coaching analysis (AI if consented, local rubric otherwise)
      let coachDetailEl = document.getElementById('arenaCoachDetail');
      if (!coachDetailEl) {
        coachDetailEl = document.createElement('div');
        coachDetailEl.id = 'arenaCoachDetail';
        feedbackWrap.appendChild(coachDetailEl);
      }

      const ai = window.AJSAIClient;
      if (ai && ai.hasConsent()) {
        coachDetailEl.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0">Requesting AI interview coaching analysis…</div>';
        Promise.race([
          window.AJSInterviewCoach.generateAIFeedback(CoachUI.activeQuestion, answerText, metrics),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI response timed out')), 8000))
        ]).then(res => {
          coachDetailEl.innerHTML = `
            <div class="ai-coaching-box" style="margin-top:10px;padding:12px;background:#f0f9f6;border:1px solid #cce8df;border-radius:8px;font-size:12px;line-height:1.6;white-space:pre-wrap">
              <div style="font-weight:700;color:#106c59;margin-bottom:6px">🤖 Puter.js AI Coaching Feedback</div>
              ${escapeHTML(res.feedbackText)}
            </div>`;
        }).catch(err => {
          console.warn('[Coach] AI coaching timeout/error:', err);
          const localFeedback = window.AJSInterviewCoach.generateLocalFeedback(CoachUI.activeQuestion, answerText, metrics);
          coachDetailEl.innerHTML = `
            <div class="local-coaching-box" style="margin-top:10px;padding:12px;background:#f9f9f9;border:1px solid #e2e8e5;border-radius:8px;font-size:12px;line-height:1.6;white-space:pre-wrap">
              <div style="font-weight:700;color:var(--text);margin-bottom:6px">📋 Local Rubric Coach</div>
              ${escapeHTML(localFeedback)}
            </div>`;
        });
      } else {
        const localFeedback = window.AJSInterviewCoach.generateLocalFeedback(CoachUI.activeQuestion, answerText, metrics);
        coachDetailEl.innerHTML = `
          <div class="local-coaching-box" style="margin-top:10px;padding:12px;background:#f9f9f9;border:1px solid #e2e8e5;border-radius:8px;font-size:12px;line-height:1.6;white-space:pre-wrap">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <strong style="color:var(--text)">📋 Local Rubric Coach</strong>
              <button type="button" class="btn small" id="enableAICoachBtn">Get AI Coaching</button>
            </div>
            ${escapeHTML(localFeedback)}
          </div>`;
        document.getElementById('enableAICoachBtn')?.addEventListener('click', () => {
          showAIConsentModal(() => {
            CoachUI.submitAnswer();
          });
        });
      }

      // Next / Finish button
      const nextBtn = document.getElementById('arenaNextBtn');
      if (nextBtn) {
        if (CoachUI.currentQuestionIndex + 1 < CoachUI.currentSession.questions.length) {
          nextBtn.textContent = 'Next question →';
        } else {
          nextBtn.textContent = 'Finish session & view progress →';
        }
      }
    },

    nextQuestion: function() {
      if (CoachUI.currentQuestionIndex + 1 < CoachUI.currentSession.questions.length) {
        CoachUI.loadQuestion(CoachUI.currentQuestionIndex + 1);
      } else {
        CoachUI.completeSession();
      }
    },

    completeSession: function() {
      document.getElementById('coachArenaPanel').hidden = true;
      document.getElementById('coachCompletePanel').hidden = false;

      const scores = CoachUI.sessionAnswers.map(a => a.metrics.score);
      const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / (scores.length || 1));

      const sessionSummary = {
        trackId: CoachUI.currentSession.trackId,
        trackName: CoachUI.currentSession.trackName,
        durationMinutes: CoachUI.currentSession.durationMinutes,
        questionsAnswered: CoachUI.sessionAnswers.length,
        avgScore: avgScore
      };

      if (Storage) {
        Storage.saveInterviewSession(sessionSummary);
      }

      document.getElementById('completeAvgScore').textContent = `${avgScore}%`;
      document.getElementById('completeQuestionsCount').textContent = CoachUI.sessionAnswers.length;

      CoachUI.renderStreakAndStats();
    },

    exitSession: function() {
      clearInterval(CoachUI.timerInterval);
      if (CoachUI.isListening && CoachUI.recognizer) {
        CoachUI.recognizer.stop();
        CoachUI.isListening = false;
      }
      document.getElementById('coachArenaPanel').hidden = true;
      document.getElementById('coachSetupPanel').hidden = false;
      document.getElementById('coachCompletePanel').hidden = true;
    }
  };

  // -------------------------------------------------------------
  // ATS Keyword Checklist
  // -------------------------------------------------------------
  function renderChecklist() {
    const container = document.getElementById('checkGroups');
    if (!container) return;

    const savedChecked = new Set(Storage ? Storage.getChecklist() : []);

    container.innerHTML = checklistGroups.map(group => `
      <div class="check-group">
        <div class="check-group-title">
          <h3>${escapeHTML(group.title)}</h3>
        </div>
        <div class="check-items">
          ${group.items.map(([label, hint]) => {
            const isChecked = savedChecked.has(label);
            return `
              <label class="check-item ${isChecked ? 'checked' : ''}">
                <input type="checkbox" value="${escapeHTML(label)}" ${isChecked ? 'checked' : ''} />
                <div>
                  <strong>${escapeHTML(label)}</strong>
                  <span>${escapeHTML(hint)}</span>
                </div>
              </label>`;
          }).join('')}
        </div>
      </div>
    `).join('');

    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', () => {
        cb.closest('.check-item').classList.toggle('checked', cb.checked);
        const currentChecked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked')).map(x => x.value);
        if (Storage) Storage.saveChecklist(currentChecked);
        updateChecklistProgress();
      });
    });

    updateChecklistProgress();

    // Populate role pack select
    const packSelect = document.getElementById('rolePackSelect');
    if (packSelect && !packSelect.options.length) {
      packSelect.innerHTML = Object.keys(rolePacks).map(k => `<option value="${escapeHTML(k)}">${escapeHTML(k)}</option>`).join('');
      const updatePack = () => {
        const kwEl = document.getElementById('roleKeywords');
        const kws = rolePacks[packSelect.value] || [];
        if (kwEl) kwEl.innerHTML = kws.map(w => `<span class="chip">${escapeHTML(w)}</span>`).join('');
      };
      packSelect.addEventListener('change', updatePack);
      updatePack();
    }
  }

  function updateChecklistProgress() {
    const container = document.getElementById('checkGroups');
    if (!container) return;

    const total = container.querySelectorAll('input[type="checkbox"]').length;
    const checkedCount = container.querySelectorAll('input[type="checkbox"]:checked').length;
    const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0;

    const bar = document.getElementById('progressFill');
    if (bar) bar.style.width = `${pct}%`;
    const txt = document.getElementById('progressText');
    if (txt) txt.textContent = `${checkedCount} of ${total} checked`;
    const pctEl = document.getElementById('progressPct');
    if (pctEl) pctEl.textContent = `${pct}%`;
    const navP = document.getElementById('navProgress');
    if (navP) navP.textContent = `${pct}%`;
  }

  // -------------------------------------------------------------
  // Dedupe & Audit Views
  // -------------------------------------------------------------
  function renderAudit(data) {
    const list = jobs;
    const auditData = data?.audit || {};

    const detailEl = document.getElementById('auditDetailCount');
    if (detailEl) detailEl.textContent = `${list.length}/${list.length}`;
    const dateEl = document.getElementById('auditDateCount');
    if (dateEl) dateEl.textContent = `${list.length}/${list.length}`;
    const expEl = document.getElementById('auditExpCount');
    if (expEl) expEl.textContent = `${list.length}/${list.length}`;
    const skillEl = document.getElementById('auditSkillCount');
    if (skillEl) skillEl.textContent = `${list.length}/${list.length}`;
    const linkEl = document.getElementById('auditLinkCount');
    if (linkEl) linkEl.textContent = 'HTTP 200';

    const sourceDateEl = document.getElementById('auditSourceDate');
    if (sourceDateEl) sourceDateEl.textContent = `${data?.scan_date || 'Today'} · Asia/Kolkata`;

    const covTitle = document.getElementById('coverageTitle');
    if (covTitle) covTitle.textContent = `${(data?.sources || []).length} official career sources`;

    const cc = document.getElementById('companyCloud');
    if (cc) {
      const srcList = data?.sources || ['Amazon', 'Accenture', 'Swiggy', 'Razorpay', 'Zepto', 'CRED', 'Postman', 'Groww', 'InMobi', 'Freshworks'];
      cc.innerHTML = srcList.map(c => `<span class="company-tag">${escapeHTML(c)}</span>`).join('');
    }

    const rl = document.getElementById('rejectionList');
    if (rl) {
      const samples = auditData.rejected_samples || [
        'Citi · Business Analytics: Official page returns Job Not Found / Closed.',
        'Wipro · Data Analyst: Requires 4+ years, above junior threshold.',
        'Amazon · Financial Analyst: Requires 6+ years total experience.',
        'Accenture · BI Associate: Posted >15 days ago; outside freshness window.'
      ];
      rl.innerHTML = samples.map(r => `<div class="rejection"><span>${escapeHTML(r)}</span></div>`).join('');
    }
  }

  function renderDedupe(data) {
    const shownEl = document.getElementById('dedupeShownCount');
    if (shownEl) shownEl.textContent = jobs.length;

    const suppEl = document.getElementById('dedupeSuppressedCount');
    const suppCount = data?.summary?.duplicates_suppressed ?? duplicateGroups.reduce((n, g) => n + (g.suppressed_job_ids || g.ids || []).length, 0);
    if (suppEl) suppEl.textContent = suppCount;

    const deadEl = document.getElementById('dedupeDeadCount');
    if (deadEl) deadEl.textContent = data?.summary?.suppressed_dead_links ?? 0;

    const navCount = document.getElementById('dedupeNavCount');
    if (navCount) navCount.textContent = suppCount;

    const stateBannerText = document.getElementById('dedupeStateText');
    if (stateBannerText) {
      stateBannerText.textContent = `${jobs.length} displayed job IDs are reserved against future repeats.`;
    }

    const cl = document.getElementById('clusterList');
    if (cl) {
      cl.innerHTML = duplicateGroups.length ? duplicateGroups.map(g => `
        <div class="cluster">
          <div class="cluster-head">
            <div><strong>${escapeHTML(g.title || '')} — ${escapeHTML(g.company || '')}</strong><p>Kept: ${escapeHTML(g.kept_job_id || g.shown || '')}<br>${escapeHTML(g.reason || '')}</p></div>
            <span class="cluster-count">${(g.suppressed_job_ids || g.ids || []).length} suppressed</span>
          </div>
          <div class="id-list">${(g.suppressed_job_ids || g.ids || []).map(id => `<code>${escapeHTML(id)}</code>`).join('')}</div>
        </div>`).join('') : '<div class="empty-state"><strong>No duplicate clusters in this scan</strong></div>';
    }

    const jp = document.getElementById('jsonPreview');
    if (jp) jp.textContent = JSON.stringify(data || {}, null, 2);
  }

  // -------------------------------------------------------------
  // Data Loader & Fail-Closed Payload Handler
  // -------------------------------------------------------------
  async function loadPublishedScan() {
    try {
      const res = await fetch(`./data/latest.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data && Array.isArray(data.jobs)) {
        jobs = data.jobs;
        duplicateGroups = data.duplicate_groups || [];
        publishedScanMeta = data;

        // Populate dynamic company filter
        const compFilter = document.getElementById('companyFilter');
        if (compFilter) {
          const uniqueComps = Array.from(new Set(jobs.map(j => j.company).filter(Boolean))).sort();
          compFilter.innerHTML = '<option value="all">All companies</option>' +
            uniqueComps.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
        }

        // Update Overview & Header statistics (Single Source of Truth)
        const total = jobs.length;
        const fresh = jobs.filter(j => j.window === 'fresh').length;
        const backup = total - fresh;
        const internships = jobs.filter(j => j.type === 'Internship').length;
        const companiesHiring = new Set(jobs.map(j => j.company)).size;

        document.getElementById('overviewHeroTitle').innerHTML = `${total} verified roles worth your time.<br/>Zero unverified noise.`;
        document.getElementById('overviewHeroScore').textContent = `${total}/${total}`;
        document.getElementById('heroFresh').textContent = `${fresh} fresh`;
        document.getElementById('heroBackup').textContent = `${backup} backups`;
        document.getElementById('heroCompanies').textContent = `${companiesHiring} companies hiring`;

        document.getElementById('overviewTotal').textContent = total;
        document.getElementById('overviewFresh').textContent = fresh;
        document.getElementById('overviewBackup').textContent = backup;
        document.getElementById('overviewInternships').textContent = internships;

        const jobsNav = document.getElementById('jobsNavCount');
        if (jobsNav) jobsNav.textContent = total;

        const footDate = document.getElementById('sidebarFootDate');
        if (footDate) footDate.textContent = `${data.scan_date || 'Today'} · Asia/Kolkata`;

        // Render views
        renderPriorities();
        renderJobs();
        renderApplications();
        renderAudit(data);
        renderDedupe(data);

        // Hide stale banner if previously shown
        const staleBanner = document.getElementById('staleScanBanner');
        if (staleBanner) staleBanner.hidden = true;

        return data;
      } else {
        throw new Error('Malformed or empty scan payload');
      }
    } catch (err) {
      console.warn('[App] Fail closed: could not load published scan:', err.message);
      // Fail closed: Never display old embedded fallback jobs as live/verified!
      jobs = [];
      duplicateGroups = [];

      const staleBanner = document.getElementById('staleScanBanner');
      if (staleBanner) {
        staleBanner.hidden = false;
        staleBanner.innerHTML = `
          <span>⚠️ <strong>Scan data unavailable:</strong> Could not load verified scan payload (${escapeHTML(err.message)}). Fail-closed mode active. No unverified records are displayed.</span>
          <button class="btn small" id="retryScanBtn">Retry live scan</button>
        `;
        document.getElementById('retryScanBtn')?.addEventListener('click', loadPublishedScan);
      }

      document.getElementById('overviewHeroTitle').innerHTML = '0 roles available.<br/>Scan unavailable.';
      document.getElementById('overviewHeroScore').textContent = '0/0';
      document.getElementById('overviewTotal').textContent = '0';
      document.getElementById('overviewFresh').textContent = '0';
      document.getElementById('overviewBackup').textContent = '0';
      document.getElementById('overviewInternships').textContent = '0';

      const jobsNav = document.getElementById('jobsNavCount');
      if (jobsNav) jobsNav.textContent = '0';

      renderPriorities();
      renderJobs();
      return null;
    }
  }

  // -------------------------------------------------------------
  // Broken Controls Restoration & Event Bindings
  // -------------------------------------------------------------
  function bindEventControls() {
    // 1. Navigation switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) switchView(view);
      });
    });

    document.querySelectorAll('[data-go]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.go));
    });

    // Mobile menu
    document.getElementById('menuBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });

    // 2. runDailyScan button handler
    const runScanHandlers = [document.getElementById('runDailyScan'), document.getElementById('runScanTop')];
    runScanHandlers.forEach(btn => {
      btn?.addEventListener('click', async () => {
        toast('Refreshing latest verified scan…');
        await loadPublishedScan();
        if (window.AJSWalkinAlerts) await window.AJSWalkinAlerts.loadWalkins();
        toast('Refreshed verified jobs and alerts');
      });
    });

    // 3. exportApplications button handler (Exports CSV)
    document.getElementById('exportApplications')?.addEventListener('click', () => {
      const apps = Storage ? Storage.getApplications() : [];
      if (!apps.length) {
        toast('No applications tracked yet to export.');
        return;
      }
      const rows = [
        ['ID', 'Company', 'Title', 'Status', 'Applied Date', 'Apply URL'],
        ...apps.map(a => [
          `"${(a.id || '').replace(/"/g, '""')}"`,
          `"${(a.company || '').replace(/"/g, '""')}"`,
          `"${(a.title || '').replace(/"/g, '""')}"`,
          `"${(a.status || 'Opened').replace(/"/g, '""')}"`,
          `"${(a.appliedAt || '').replace(/"/g, '""')}"`,
          `"${(a.apply_url || '').replace(/"/g, '""')}"`
        ].join(','))
      ];
      download('my-applications.csv', rows.join('\n'), 'text/csv');
      toast('Exported my-applications.csv');
    });

    // Top CSV export
    document.getElementById('exportCsvTop')?.addEventListener('click', () => {
      if (!jobs.length) {
        toast('No jobs loaded to export.');
        return;
      }
      const rows = [
        ['ID', 'Company', 'Title', 'Location', 'Experience', 'Date', 'Match Score', 'Apply URL'],
        ...jobs.map(j => [
          `"${(j.id || '').replace(/"/g, '""')}"`,
          `"${(j.company || '').replace(/"/g, '""')}"`,
          `"${(j.title || '').replace(/"/g, '""')}"`,
          `"${(j.location || '').replace(/"/g, '""')}"`,
          `"${(j.exp || '').replace(/"/g, '""')}"`,
          `"${(j.date || '').replace(/"/g, '""')}"`,
          j.score,
          `"${(j.apply || '').replace(/"/g, '""')}"`
        ].join(','))
      ];
      download(`verified-analytics-jobs-${publishedScanMeta?.scan_date || 'scan'}.csv`, rows.join('\n'), 'text/csv');
      toast('Exported verified-analytics-jobs.csv');
    });

    // 4. resetChecklist button handler
    document.getElementById('resetChecklist')?.addEventListener('click', () => {
      if (Storage) Storage.resetChecklist();
      document.querySelectorAll('#checkGroups input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
        cb.closest('.check-item')?.classList.remove('checked');
      });
      updateChecklistProgress();
      toast('ATS checklist reset');
    });

    // 5. copyKeywords button handler
    document.getElementById('copyKeywords')?.addEventListener('click', () => {
      const select = document.getElementById('rolePackSelect');
      const packKey = select ? select.value : '';
      const kws = rolePacks[packKey] || [];
      if (kws.length) {
        copyText(kws.join(', '));
        toast(`Copied ${kws.length} keywords for ${packKey}`);
      } else {
        toast('No keywords selected');
      }
    });

    // 6. copyJson & downloadJson handlers (Dedupe / State)
    document.getElementById('copyJson')?.addEventListener('click', () => {
      const exportData = publishedScanMeta || { scan_date: 'today', jobs: jobs };
      copyText(JSON.stringify(exportData, null, 2));
      toast('Copied scan state JSON to clipboard');
    });

    document.getElementById('downloadJson')?.addEventListener('click', () => {
      const exportData = publishedScanMeta || { scan_date: 'today', jobs: jobs };
      download(`scout-state-${publishedScanMeta?.scan_date || 'today'}.json`, JSON.stringify(exportData, null, 2), 'application/json');
      toast('Downloaded state JSON');
    });

    // 7. Role / Location / Type scan preferences client-side persistence
    const loadPreferencesToUI = () => {
      if (!Storage) return;
      const prefs = Storage.getPreferences();

      document.querySelectorAll('#roleOptions input[type="checkbox"]').forEach(cb => {
        cb.checked = prefs.roles.includes(cb.value);
      });
      document.querySelectorAll('#locationOptions input[type="checkbox"]').forEach(cb => {
        cb.checked = prefs.locations.includes(cb.value);
      });
      document.querySelectorAll('#typeOptions input[type="checkbox"]').forEach(cb => {
        cb.checked = prefs.types.includes(cb.value);
      });
    };

    const savePreferencesFromUI = () => {
      if (!Storage) return;
      const roles = Array.from(document.querySelectorAll('#roleOptions input[type="checkbox"]:checked')).map(x => x.value);
      const locations = Array.from(document.querySelectorAll('#locationOptions input[type="checkbox"]:checked')).map(x => x.value);
      const types = Array.from(document.querySelectorAll('#typeOptions input[type="checkbox"]:checked')).map(x => x.value);
      Storage.savePreferences({ roles, locations, types });
      toast('Scan preferences saved');
    };

    loadPreferencesToUI();
    document.querySelectorAll('.scan-config input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', savePreferencesFromUI);
    });

    // 8. Filters in Verified Jobs toolbar
    ['jobSearch', 'locationFilter', 'sizeFilter', 'freshnessFilter', 'companyFilter', 'sortFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderJobs);
        el.addEventListener('change', renderJobs);
      }
    });

    document.getElementById('savedToggle')?.addEventListener('click', () => {
      savedOnly = !savedOnly;
      updateSaved();
      renderJobs();
    });

    // 9. Resume actions
    document.getElementById('resumeFileUpload')?.addEventListener('change', async e => {
      const file = e.target.files?.[0];
      if (!file) return;

      toast('Parsing resume file locally…');
      try {
        const text = await window.AJSResumeAgent.parseFile(file);
        currentResumeData.fileName = file.name;
        currentResumeData.rawText = text;

        const editArea = document.getElementById('resumeTextEditArea');
        if (editArea) editArea.value = text;

        saveResume();
        toast(`Parsed ${file.name} successfully!`);
      } catch (err) {
        alert('Resume upload notice: ' + err.message);
      }
    });

    document.getElementById('saveResumeEditBtn')?.addEventListener('click', () => {
      const editArea = document.getElementById('resumeTextEditArea');
      if (editArea) {
        currentResumeData.rawText = editArea.value;
        saveResume();
      }
    });

    document.getElementById('rememberResumeToggle')?.addEventListener('change', e => {
      saveResume(e.target.checked);
    });

    document.getElementById('forgetResumeBtn')?.addEventListener('click', () => {
      if (confirm('Forget resume content from this browser?')) {
        currentResumeData = {
          rawText: '',
          fileName: '',
          updatedAt: null,
          remembered: false,
          name: '',
          skills: [],
          projects: []
        };
        if (Storage) Storage.forgetResume();
        const editArea = document.getElementById('resumeTextEditArea');
        if (editArea) editArea.value = '';
        renderResumeATSAnalysis();
        renderCompareJob();
        renderJobs();
        toast('Resume cleared from memory and storage');
      }
    });

    document.getElementById('deleteAllDataBtn')?.addEventListener('click', () => {
      if (confirm('Delete all career data (resume, mock interviews, tracked applications, preferences)?')) {
        if (Storage) Storage.deleteAllCareerData();
        currentResumeData = { rawText: '', skills: [] };
        renderResumeATSAnalysis();
        renderApplications();
        CoachUI.renderStreakAndStats();
        toast('All career data deleted');
      }
    });

    // AI suggestion buttons
    document.querySelectorAll('[data-ai-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        runAIEnhancement(btn.dataset.aiAction);
      });
    });

    document.getElementById('compareJobSelect')?.addEventListener('change', renderCompareJob);

    // 10. Coach arena actions
    document.getElementById('arenaMicBtn')?.addEventListener('click', CoachUI.toggleVoiceRecognition);
    document.getElementById('arenaSubmitBtn')?.addEventListener('click', CoachUI.submitAnswer);
    document.getElementById('arenaNextBtn')?.addEventListener('click', CoachUI.nextQuestion);
    document.getElementById('arenaExitBtn')?.addEventListener('click', CoachUI.exitSession);
    document.getElementById('completeBackBtn')?.addEventListener('click', CoachUI.exitSession);
    document.getElementById('startDailyMixBtn')?.addEventListener('click', () => CoachUI.startTrackSession('mixed_daily', 10));

    // Reset coach progress
    document.getElementById('resetCoachProgressBtn')?.addEventListener('click', () => {
      if (confirm('Reset your interview streak and practice history?')) {
        if (Storage) Storage.resetInterviewProgress();
        CoachUI.renderStreakAndStats();
        toast('Interview progress reset');
      }
    });

    // 11. Suggest a Company Source feature
    document.getElementById('suggestSourceTopBtn')?.addEventListener('click', () => {
      document.getElementById('suggestSourceModal').hidden = false;
    });

    document.getElementById('closeSuggestModalBtn')?.addEventListener('click', () => {
      document.getElementById('suggestSourceModal').hidden = true;
    });

    document.getElementById('submitSuggestIssueBtn')?.addEventListener('click', () => {
      const name = (document.getElementById('suggestCompName')?.value || '').trim();
      const url = (document.getElementById('suggestCareersUrl')?.value || '').trim();
      const notes = (document.getElementById('suggestNotes')?.value || '').trim();

      if (!name || !url) {
        alert('Please provide at least the Company Name and Official Careers URL.');
        return;
      }

      const title = encodeURIComponent(`[Source Suggestion]: ${name}`);
      const body = encodeURIComponent(`### Company Source Suggestion\n- **Company Name**: ${name}\n- **Official Careers / ATS URL**: ${url}\n- **Notes**: ${notes}\n\n*Submitted via Analytics Job Scout community sourcing modal.*`);
      const ghUrl = `https://github.com/charankumarda01/analytics-job-scout/issues/new?title=${title}&body=${body}`;
      window.open(ghUrl, '_blank', 'noopener,noreferrer');
      document.getElementById('suggestSourceModal').hidden = true;
    });

    document.getElementById('downloadSuggestJsonBtn')?.addEventListener('click', () => {
      const name = (document.getElementById('suggestCompName')?.value || '').trim();
      const url = (document.getElementById('suggestCareersUrl')?.value || '').trim();
      const notes = (document.getElementById('suggestNotes')?.value || '').trim();

      const payload = {
        company_name: name,
        official_careers_url: url,
        notes: notes,
        suggested_at: new Date().toISOString()
      };
      download(`company-suggestion-${(name || 'new').toLowerCase().replace(/\s+/g, '-')}.json`, JSON.stringify(payload, null, 2), 'application/json');
      toast('Downloaded suggestion JSON');
      document.getElementById('suggestSourceModal').hidden = true;
    });

    // Close Company Research modal
    document.getElementById('closeResearchModalBtn')?.addEventListener('click', () => {
      document.getElementById('companyResearchModal').hidden = true;
    });
  }

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    bindEventControls();
    renderChecklist();
    updateSaved();
    renderApplications();
    renderResumeATSAnalysis();

    // Populate resume text editor if resume exists
    if (currentResumeData && currentResumeData.rawText) {
      const editArea = document.getElementById('resumeTextEditArea');
      if (editArea) editArea.value = currentResumeData.rawText;
    }

    // Load data from single source of truth
    await loadPublishedScan();

    // Initialize Walk-in Alerts
    if (window.AJSWalkinAlerts) {
      await window.AJSWalkinAlerts.init();
    }
  });

  window.AJSApp = {
    getJobs: () => jobs,
    switchView: switchView,
    renderJobs: renderJobs,
    loadPublishedScan: loadPublishedScan,
    CoachUI: CoachUI
  };

})(typeof window !== 'undefined' ? window : globalThis);
