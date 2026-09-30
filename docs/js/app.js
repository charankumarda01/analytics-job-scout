/**
 * Analytics Job Scout v2 - Master Application Controller
 * Coordinates Views, Verified Jobs, Resume AI, and Daily Interview Coach.
 */
(function(window) {
  'use strict';

  // Fallback initial jobs dataset (in case latest.json is loading or offline)
  let jobs = [
    {
      id:'10565269', company:'Amazon', title:'Business Intel Engineer I, AOP', location:'Hyderabad', date:'2026-09-30', days:0, window:'fresh', score:91, type:'Full-time', exp:'2+ years', recruiter:'Not disclosed', priority:false,
      skills:['SQL','Excel','Tableau','Python','Statistics','Visualization'],
      fit:'Strong BI scope across data stores, visualization, scripting and statistical analysis. Master’s is preferred, not mandatory.',
      detail:'https://www.amazon.jobs/en/jobs/10565269/business-intel-engineer-i-aop', apply:'https://account.amazon.jobs/jobs/10565269/apply'
    },
    {
      id:'AIOC-S01665514', company:'Accenture', title:'Sales Operations Associate', location:'Bengaluru', date:'2026-09-30', days:0, window:'fresh', score:84, type:'Full-time', exp:'1–3 years · tag 0–2', recruiter:'Not disclosed', priority:false,
      skills:['Excel','Data cleaning','MIS reporting','Data analysis'],
      fit:'Excel pivots/lookups, data cleaning, MIS reporting and large-dataset analysis in an early-career role.',
      detail:'https://www.accenture.com/in-en/careers/jobdetails?id=AIOC-S01665514_en&title=Sales+Operations+Associate', apply:'https://mycareer.accenture.com/?source=careers&JRID=AIOC-S01665514'
    },
    {
      id:'10563248', company:'Amazon', title:'Business Analyst Support, IN Supply Chain – Speed', location:'Bengaluru', date:'2026-09-29', days:1, window:'fresh', score:96, type:'Full-time', exp:'1+ year', recruiter:'Not disclosed', priority:true,
      skills:['SQL','Excel','ETL','Tableau','Dashboards','Statistics'],
      fit:'Best fresh junior match: SQL extraction, Excel, ETL, visualization, statistical analysis, reports and dashboards.',
      detail:'https://www.amazon.jobs/en/jobs/10563248/business-analyst-support-in-supply-chain-speed', apply:'https://account.amazon.jobs/jobs/10563248/apply'
    },
    {
      id:'AIOC-S01661069', company:'Accenture', title:'Measurement and Reporting Associate', location:'Bengaluru', date:'2026-09-29', days:1, window:'fresh', score:83, type:'Full-time', exp:'1–3 years · tag 0–2', recruiter:'Not disclosed', priority:false,
      skills:['Advanced Excel','Reporting','KPI / SLA','Automation'],
      fit:'Reporting analytics role covering advanced Excel, KPI/SLA reporting and report automation.',
      detail:'https://www.accenture.com/in-en/careers/jobdetails?id=AIOC-S01661069_en&title=Measurement+and+Reporting+Associate', apply:'https://mycareer.accenture.com/?source=careers&JRID=AIOC-S01661069'
    },
    {
      id:'10561075', company:'Amazon', title:'Business Analyst I, CMT', location:'Bengaluru', date:'2026-09-28', days:2, window:'fresh', score:95, type:'Full-time', exp:'1+ analytical · 2+ Excel', recruiter:'Not disclosed', priority:true,
      skills:['SQL','ETL','Excel / VBA','Tableau','Power BI','Reporting'],
      fit:'Strong analyst title and skill mix: SQL/ETL, Excel/VBA, BI metrics, visualization, reports and dashboards.',
      detail:'https://www.amazon.jobs/en/jobs/10561075/business-analyst-i-cmt', apply:'https://account.amazon.jobs/jobs/10561075/apply'
    },
    {
      id:'AIOC-S01656754', company:'Accenture', title:'Analytics and Modeling Associate', location:'Bengaluru', date:'2026-09-24', days:6, window:'backup', score:94, type:'Full-time', exp:'1–3 years · tag 0–2', recruiter:'Not disclosed', priority:true,
      skills:['Power BI','Dashboards','Data modelling','Data cleaning','Reporting','CRM'],
      fit:'Best Power BI match with data modelling, cleansing, KPI dashboards, reporting automation and CRM data quality.',
      detail:'https://www.accenture.com/in-en/careers/jobdetails?id=AIOC-S01656754_en&title=Analytics+and+Modeling+Associate', apply:'https://mycareer.accenture.com/?source=careers&JRID=AIOC-S01656754'
    },
    {
      id:'10557492', company:'Amazon', title:'Business Analyst, Catalog Support and Operations, GCO', location:'Bengaluru', date:'2026-09-23', days:7, window:'backup', score:94, type:'Full-time', exp:'1+ analytical · 2+ Excel/Tableau', recruiter:'Not disclosed', priority:false,
      skills:['SQL','Excel','Tableau','Python','ETL / DW','Reporting'],
      fit:'Data-heavy business analysis covering complex SQL, ETL/DW, advanced Excel/Tableau, Python and catalog quality.',
      detail:'https://www.amazon.jobs/en/jobs/10557492/business-analyst-catalog-support-and-operations-gco', apply:'https://account.amazon.jobs/jobs/10557492/apply'
    },
    {
      id:'10554403', company:'Amazon', title:'Business Analyst, Global Solutions & Risk Compliance', location:'Bengaluru', date:'2026-09-21', days:9, window:'backup', score:89, type:'Full-time', exp:'1+ year BI support', recruiter:'Not disclosed', priority:false,
      skills:['SQL','Power BI','Tableau','ETL / ELT','Python','Data quality'],
      fit:'BI technical-support role spanning SQL, modelling, dashboards, pipelines, scripting and data-quality troubleshooting.',
      detail:'https://www.amazon.jobs/en/jobs/10554403/business-analyst-global-solutions-risk-compliance-gsrc', apply:'https://account.amazon.jobs/jobs/10554403/apply'
    },
    {
      id:'AIOC-S01663615', company:'Accenture', title:'Measurement and Reporting Associate', location:'Hyderabad', date:'2026-09-21', days:9, window:'backup', score:90, type:'Full-time', exp:'1–3 years · tag 0–2', recruiter:'Not disclosed', priority:false,
      skills:['SQL','Advanced Excel','Power BI','Tableau','Dashboards','Forecasting'],
      fit:'Excellent WFM reporting stack. Note the official Trust & Safety proximity and potential indirect content exposure warning.',
      detail:'https://www.accenture.com/in-en/careers/jobdetails?id=AIOC-S01663615_en&title=Measurement+and+Reporting+Associate', apply:'https://mycareer.accenture.com/?source=careers&JRID=AIOC-S01663615'
    },
    {
      id:'10542484', company:'Amazon', title:'Business Analyst I, GTS Field', location:'Hyderabad', date:'2026-09-15', days:15, window:'backup', score:92, type:'Full-time', exp:'2+ years', recruiter:'Not disclosed', priority:false,
      skills:['SQL','ETL','Excel / VBA','Tableau','Power BI','Dashboards'],
      fit:'Exact analytics remit across dashboards, reports, ETL jobs, KPIs, monitoring and data quality. Last eligible day.',
      detail:'https://www.amazon.jobs/en/jobs/10542484/business-analyst-i-gts-field', apply:'https://account.amazon.jobs/jobs/10542484/apply'
    }
  ];

  let duplicateGroups = [
    { shown:'Amazon · 10554403', title:'GSRC Business Analyst', reason:'Same title, company, location and substantially identical description.', ids:['10554404','10554405','10554406','10554407'] },
    { shown:'Accenture · AIOC-S01665514', title:'Sales Operations Associate', reason:'Same title, company, location and identical or near-identical description.', ids:['AIOC-S01665515','AIOC-S01665516','AIOC-S01665517','AIOC-S01665518','AIOC-S01665519','AIOC-S01665520','AIOC-S01665523'] },
    { shown:'Accenture · AIOC-S01661069', title:'Measurement and Reporting Associate', reason:'Same title, company, location and identical or near-identical reporting role.', ids:['AIOC-S01661070','AIOC-S01659409','AIOC-S01667140'] }
  ];

  const companies = ['Accenture','Amazon','Citi','Wipro','HCLTech','JPMorgan Chase','Deloitte USI','Fractal','Tiger Analytics','LatentView','Mastercard','Barclays','Visa','Deutsche Bank','Wells Fargo','Cognizant','Genpact'];
  const rejections = [
    ['Citi · Business Analytics Analyst','Official page now says “Job Not Found”; the opening is closed.'],
    ['Wipro · Data Analyst','Requires 4+ years and states a 3–5 year range.'],
    ['Amazon · Financial Analyst I','Requires 6+ years overall and 4+ relevant experience.'],
    ['Deloitte USI · Data Analytics Analyst','Requires 3–5 years, above the junior limit.'],
    ['JPMorgan · Associate – Data Analytics','Requires 4–7 years and its deadline had passed.'],
    ['HCLTech · Analyst (Non-Voice)','Resolves to Michigan and shows no posting date.'],
    ['Accenture · BI Engineering Associate','Strong skill match but posted 31 Aug; outside the 15-day window.']
  ];

  const checklist = [
    { title:'Target title & summary', icon:'doc', items:[
      ['Use one exact target title','Data Analyst, Business Analyst, BI Analyst, Reporting Analyst, MIS Analyst or Operations Analyst.'],
      ['Write a focused 2–3 line summary','State your level, strongest tools and the business outcomes you support.'],
      ['Add target location and availability','Include “available immediately” only when true.']
    ]},
    { title:'SQL & data foundations', icon:'database', items:[
      ['SQL','Show it in Skills and in at least one evidence bullet.'],['Joins, CTEs and subqueries','Name only techniques you can explain in an interview.'],['Window functions and aggregations','Useful for Amazon analyst roles.'],['Data validation and data quality','Connect the keyword to a concrete check or result.'],['Query optimization','Include only with real hands-on evidence.']
    ]},
    { title:'Excel', icon:'grid', items:[
      ['Advanced Excel','Use the exact phrase where supported.'],['PivotTables and Pivot Charts','High-frequency requirement across the shortlist.'],['XLOOKUP or INDEX-MATCH','List the function you have actually used.'],['Power Query','Useful for repeatable cleaning and transformation.'],['VBA or macros','Required for GTS Field; claim only if demonstrated.']
    ]},
    { title:'Power BI & visualization', icon:'chart', items:[
      ['Power BI','Place in Skills and a project bullet.'],['DAX and Power Query','Core dashboard-building terms.'],['Data modelling','Mention relationships, star schema or dataset structure if true.'],['KPI dashboards','Name the KPIs and intended user.'],['Tableau or QuickSight','Use only the tools you have actually used.'],['Data visualization','Explain how the visual supported a decision.']
    ]},
    { title:'Python & analytics', icon:'code', items:[
      ['Python and pandas','Show cleaning, transformation or analysis evidence.'],['Exploratory data analysis (EDA)','Name the dataset and business question.'],['Matplotlib or Seaborn','Pair the tool with a specific visualization.'],['Descriptive statistics','Use accurate statistical language.'],['Hypothesis testing, correlation or regression','Include only if you can defend the method.']
    ]},
    { title:'Data workflow', icon:'flow', items:[
      ['ETL / ELT','Spell out Extract, Transform, Load once.'],['Data pipelines','Describe source, transformation and destination.'],['Data warehouse concepts','Relevant to Amazon’s SQL/ETL roles.'],['Report automation','Quantify time saved or faster turnaround.'],['CRM data hygiene and de-duplication','Especially relevant to Accenture Analytics and Modeling.']
    ]},
    { title:'Business analysis', icon:'briefcase', items:[
      ['Requirements gathering','Show how requirements became a report or dashboard.'],['KPI definition and performance tracking','Name the measure, cadence and audience.'],['Root-cause analysis','State the issue, evidence and recommendation.'],['Trend analysis and forecasting','Use where supported by a project.'],['Stakeholder management','Name the stakeholder group without confidential data.'],['Process improvement and actionable insights','Connect analysis to a measurable outcome.']
    ]},
    { title:'ATS formatting', icon:'check', items:[
      ['Use a single-column layout','Use standard headings: Summary, Skills, Experience, Projects, Education.'],['Avoid text boxes, icons and skill bars','Keep the document machine-readable.'],['Put contact details in the body','Do not rely only on headers or footers.'],['Add 2–4 relevant projects','Especially important when professional experience is limited.'],['Use at least three quantified bullets','Data volume, time saved, accuracy, adoption or performance.'],['Save as searchable PDF','Use DOCX only when the portal requests it.'],['Proofread claims against application answers','Dates, experience and skills must agree.']
    ]}
  ];

  const rolePacks = {
    'Amazon · Business Analyst Support':['SQL','data extraction','ETL / data pipelines','Advanced Excel','Tableau / QuickSight','statistical analysis','root-cause analysis','performance dashboards','capacity planning'],
    'Amazon · Business Analyst I, CMT':['SQL','ETL','Excel VBA','PivotTables','Power Pivot','Tableau / Power BI','BI metrics','requirements gathering','data modelling','reporting'],
    'Accenture · Analytics and Modeling':['Power BI dashboards','data modelling','dataset structuring','data cleansing','KPI reporting','report automation','sales analytics','CRM data quality','de-duplication']
  };

  const icons = {
    doc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>',
    database:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>',
    grid:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>',
    chart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2"/></svg>',
    code:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 9-4 3 4 3m8-6 4 3-4 3m-3-9-2 12"/></svg>',
    flow:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h4a4 4 0 0 1 4 4v5M6 9v8a2 2 0 0 0 2 2h7"/></svg>',
    briefcase:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/></svg>',
    check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>'
  };

  function buildState(scanDate='2026-09-30') {
    return {
      schema_version:'2.0',
      scan_date:scanDate,
      timezone:'Asia/Kolkata',
      prior_state_found:false,
      eligible_date_window:{
        start:new Date(new Date(scanDate+'T12:00:00').getTime()-15*86400000).toISOString().slice(0,10),
        end:scanDate,
        fresh_days:'0-5',
        backup_days:'6-15'
      },
      shown_jobs:jobs.map(j=>({
        dedupe_key:`${j.company.toLowerCase()}:${j.id}`,
        company:j.company,
        job_id:j.id,
        title:j.title,
        location:j.location,
        posted_date:j.date,
        official_detail_url:j.detail,
        official_apply_url:j.apply,
        status_at_scan:'live'
      })),
      suppressed_duplicate_groups:duplicateGroups.map(g=>({
        shown_job:g.shown,
        reason:g.reason,
        suppressed_job_ids:g.ids
      })),
      suppressed_duplicate_count:duplicateGroups.reduce((n,g)=>n+g.ids.length,0),
      future_match_rules:{
        primary:'company + requisition/job ID',
        secondary:'normalized company + title + location + substantially identical description',
        never_reshow_keys_in_shown_jobs:true
      }
    };
  }

  let state = buildState();

  // Storage integration
  const Storage = window.AJSStorage;
  let savedJobs = new Set((Storage ? Storage.getSavedJobs() : []).map(j => j.id || j));
  let savedOnly = false;
  let checked = new Set(Storage ? Storage.get('ajs.v2.checks', []) : []);
  let latestScanMeta = null;

  // Active state for Resume and Coach
  let currentResumeData = (Storage ? Storage.getResume() : null) || {
    rawText: '',
    fileName: '',
    updatedAt: null,
    remembered: false,
    name: 'Rahul Sharma',
    headline: 'Junior Data Analyst | SQL & Power BI Specialist',
    email: 'rahul.sharma@example.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    linkedin: 'https://linkedin.com/in/rahulsharma-analytics',
    github: 'https://github.com/rahulsharma-da',
    summary: 'Analytical Junior Data Analyst with hands-on proficiency in SQL, Power BI, Python, and Excel. Experienced in extracting relational data, designing interactive business dashboards with DAX, and automating reporting cadences.',
    skills: ['SQL', 'Power BI', 'Excel', 'Python', 'DAX', 'Data cleaning', 'Reporting', 'Dashboards', 'Pandas', 'Visualization', 'Statistics', 'ETL'],
    projects: [
      {
        title: 'E-Commerce Sales Performance & Churn Dashboard',
        tools: 'SQL, Power BI, DAX, Advanced Excel',
        bullet: 'Engineered an interactive 4-page Power BI dashboard modeling 120,000+ transaction records; created 15+ complex DAX measures and automated weekly KPI reporting, reducing manual analysis time by 40%.'
      },
      {
        title: 'Customer Segmentation & Behavioral Analysis',
        tools: 'Python (pandas, matplotlib), SQL, Statistics',
        bullet: 'Extracted and preprocessed 45,000 customer interaction logs using SQL CTEs and pandas; performed RFM segmentation and exploratory data analysis to identify high-value cohorts with 92% retention.'
      }
    ],
    education: {
      degree: 'B.Tech in Information Technology',
      university: 'Visvesvaraya Technological University (VTU)',
      year: '2025'
    }
  };

  // -------------------------------------------------------------
  // General UI Helpers
  // -------------------------------------------------------------
  const fmtDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  
  function toast(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(window.toastTimer);
    window.toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
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

  function escapeHTML(val) {
    return String(val ?? '').replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
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
    }
  }

  window.switchView = switchView;

  // -------------------------------------------------------------
  // Jobs & Priorities Rendering with "Match" & "Practice" Buttons
  // -------------------------------------------------------------
  function renderPriorities() {
    let p = jobs.filter(j => j.priority).sort((a,b) => b.score - a.score);
    if (!p.length) p = [...jobs].sort((a,b) => (a.days - b.days) || (b.score - a.score)).slice(0, 3);
    const grid = document.getElementById('priorityGrid');
    if (!grid) return;

    grid.innerHTML = p.map((j, i) => `
      <article class="priority-card" data-rank="0${i+1}">
        <div class="company-line">
          <div class="company-logo ${j.company.toLowerCase()}">${escapeHTML(j.company[0])}</div>
          <div>
            <strong>${escapeHTML(j.company)}</strong>
            <span>${escapeHTML(j.location)} · ${j.days} day${j.days === 1 ? '' : 's'} ago</span>
          </div>
        </div>
        <h3>${escapeHTML(j.title)}</h3>
        <div class="mini-row">
          <span>${escapeHTML(j.exp)}</span>
          <span>${j.score}% match</span>
        </div>
        <p>${escapeHTML(j.fit)}</p>
        <div class="card-actions">
          <a class="btn primary" data-apply-open="${escapeHTML(j.id)}" href="${escapeHTML(j.apply)}" target="_blank" rel="noopener">Apply now ↗</a>
          <button class="btn" data-match-job="${escapeHTML(j.id)}">🎯 Match resume</button>
          <button class="btn" data-practice-job="${escapeHTML(j.id)}">🎤 Practice</button>
        </div>
      </article>`).join('');

    bindJobButtons();
  }

  function renderJobs() {
    const q = (document.getElementById('jobSearch')?.value || '').trim().toLowerCase();
    const loc = document.getElementById('locationFilter')?.value || 'all';
    const fresh = document.getElementById('freshnessFilter')?.value || 'all';
    const company = document.getElementById('companyFilter')?.value || 'all';
    const sort = document.getElementById('sortFilter')?.value || 'match';

    let list = jobs.filter(j => {
      const hay = [j.title, j.company, j.location, j.exp, j.fit, ...(j.skills || [])].join(' ').toLowerCase();
      return (!q || hay.includes(q)) &&
             (loc === 'all' || j.location === loc) &&
             (fresh === 'all' || j.window === fresh) &&
             (company === 'all' || j.company === company) &&
             (!savedOnly || savedJobs.has(j.id));
    });

    if (sort === 'match') list.sort((a,b) => b.score - a.score || a.days - b.days);
    if (sort === 'company') list.sort((a,b) => a.company.localeCompare(b.company) || a.days - b.days);
    if (sort === 'newest') list.sort((a,b) => a.days - b.days || b.score - a.score);

    const countEl = document.getElementById('resultCount');
    if (countEl) countEl.textContent = `Showing ${list.length} role${list.length === 1 ? '' : 's'}`;

    const el = document.getElementById('jobsList');
    if (!el) return;

    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><strong>No roles match these filters</strong>Try clearing a filter or turning off “Saved only”.</div>';
      return;
    }

    const resumeSkills = (currentResumeData && currentResumeData.skills) || [];

    el.innerHTML = list.map(j => {
      const matchRes = window.AJSResumeAgent ? window.AJSResumeAgent.matchJobWithResume(j, getResumeFullText()) : { matchScore: 0 };
      const scoreBadge = matchRes.matchScore > 0 ?
        `<span class="badge" style="background:#eaf4fd;color:#185a9d;border:1px solid #c7e0f8">🎯 Your Fit: ${matchRes.matchScore}%</span>` : '';

      return `
        <article class="job-card">
          <div class="company-logo ${j.company.toLowerCase()}">${escapeHTML(j.company[0])}</div>
          <div class="job-main">
            <div class="job-topline">
              <span class="badge ${j.window}">${j.window === 'fresh' ? 'Fresh' : 'Backup'} · ${j.days}d</span>
              <span class="badge verified">✓ Verified</span>
              ${savedJobs.has(j.id) ? '<span class="badge saved">♥ Saved</span>' : ''}
              ${scoreBadge}
            </div>
            <h3><a href="${escapeHTML(j.detail)}" target="_blank" rel="noopener">${escapeHTML(j.title)}</a></h3>
            <div class="job-meta">
              <span>${escapeHTML(j.company)}</span><span>•</span>
              <span>${escapeHTML(j.location)}</span><span>•</span>
              <span>${escapeHTML(j.type)}</span><span>•</span>
              <span>${escapeHTML(j.exp)}</span><span>•</span>
              <span>${fmtDate(j.date)}</span>
            </div>
            <div class="chip-row">
              ${(j.skills || []).slice(0, 6).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join('')}
            </div>
          </div>
          <div class="score">
            <div class="score-ring" style="--score:${j.score}"><strong>${j.score}%</strong></div>
            <small>role fit</small>
          </div>
          <div class="job-actions">
            <a class="btn primary" data-apply-open="${escapeHTML(j.id)}" href="${escapeHTML(j.apply)}" target="_blank" rel="noopener">Apply on official site ↗</a>
            <button class="btn" data-match-job="${escapeHTML(j.id)}">🎯 Match my resume</button>
            <button class="btn" data-practice-job="${escapeHTML(j.id)}">🎤 Practice for this job</button>
            <button class="btn save-btn ${savedJobs.has(j.id) ? 'saved' : ''}" data-save="${escapeHTML(j.id)}">${savedJobs.has(j.id) ? '♥ Saved' : '♡ Save'}</button>
          </div>
        </article>`;
    }).join('');

    bindJobButtons();
  }

  function bindJobButtons() {
    document.querySelectorAll('[data-save]').forEach(btn => {
      btn.addEventListener('click', () => toggleSave(btn.dataset.save));
    });
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
    document.querySelectorAll('[data-practice-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = btn.dataset.practiceJob;
        const targetJob = jobs.find(j => j.id === jobId);
        switchView('coach');
        CoachUI.startJobPractice(targetJob);
      });
    });
    bindApplyTracking();
  }

  function toggleSave(id) {
    if (savedJobs.has(id)) {
      savedJobs.delete(id);
      if (Storage) Storage.removeSavedJob(id);
    } else {
      savedJobs.add(id);
      const job = jobs.find(j => j.id === id);
      if (Storage && job) Storage.saveJob(job);
    }
    updateSaved();
    renderJobs();
  }

  function updateSaved() {
    const cnt = document.getElementById('savedCount');
    if (cnt) cnt.textContent = savedJobs.size;
    const btn = document.getElementById('savedToggle');
    if (btn) btn.innerHTML = `${savedOnly ? '♥' : '♡'} Saved only <span>${savedJobs.size}</span>`;
  }

  function bindApplyTracking() {
    document.querySelectorAll('[data-apply-open]').forEach(a => {
      if (a.dataset.bound) return;
      a.dataset.bound = '1';
      a.addEventListener('click', () => {
        const jobId = a.dataset.applyOpen;
        const job = jobs.find(j => j.id === jobId);
        if (Storage && job) {
          Storage.recordApplication(job);
          renderApplications();
        }
      });
    });
  }

  function renderApplications() {
    const apps = Storage ? Storage.getApplications() : [];
    const navCount = document.getElementById('applicationNavCount');
    if (navCount) navCount.textContent = apps.length;

    const metricsEl = document.getElementById('applicationMetrics');
    if (metricsEl) {
      metricsEl.innerHTML = `
        <div class="metric blue"><div class="metric-top"><span class="metric-label">Tracked</span></div><strong>${apps.length}</strong><div class="metric-note">Applications saved</div></div>
        <div class="metric"><div class="metric-top"><span class="metric-label">Applied</span></div><strong>${apps.filter(a => a.status === 'Applied').length}</strong><div class="metric-note">Submitted by you</div></div>
        <div class="metric amber"><div class="metric-top"><span class="metric-label">Interviewing</span></div><strong>${apps.filter(a => a.status === 'Interview').length}</strong><div class="metric-note">Process active</div></div>
        <div class="metric gray"><div class="metric-top"><span class="metric-label">Offers</span></div><strong>${apps.filter(a => a.status === 'Offer').length}</strong><div class="metric-note">Offer stage</div></div>`;
    }

    const listEl = document.getElementById('applicationList');
    if (!listEl) return;
    if (!apps.length) {
      listEl.innerHTML = '<div class="empty-apps"><strong>No tracked applications yet</strong>Click "Apply on official site" on any job to start tracking.</div>';
      return;
    }

    listEl.innerHTML = apps.map(a => `
      <div class="application-row">
        <div class="application-role">
          <strong>${escapeHTML(a.title)}</strong>
          <span>${escapeHTML(a.company)}</span>
        </div>
        <select class="status-select" data-app-id="${escapeHTML(a.id)}">
          ${['Applied', 'Interview', 'Offer', 'Rejected'].map(s => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
        <span class="application-date">Applied ${new Date(a.appliedAt || Date.now()).toLocaleDateString('en-IN')}</span>
        <div class="card-actions">
          <a class="btn small primary" href="${escapeHTML(a.apply_url)}" target="_blank" rel="noopener">Open ↗</a>
          <button class="btn small" data-remove-app="${escapeHTML(a.id)}">Remove</button>
        </div>
      </div>`).join('');

    listEl.querySelectorAll('[data-app-id]').forEach(sel => {
      sel.addEventListener('change', () => {
        const id = sel.dataset.appId;
        const app = apps.find(x => x.id === id);
        if (app && Storage) {
          app.status = sel.value;
          Storage.set(Storage.KEYS.APPLICATIONS, apps);
          renderApplications();
        }
      });
    });

    listEl.querySelectorAll('[data-remove-app]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.removeApp;
        const filtered = apps.filter(x => x.id !== id);
        if (Storage) {
          Storage.set(Storage.KEYS.APPLICATIONS, filtered);
          renderApplications();
        }
      });
    });
  }

  // -------------------------------------------------------------
  // Resume Feature Module
  // -------------------------------------------------------------
  function getResumeFullText() {
    if (currentResumeData.rawText && currentResumeData.rawText.trim().length > 30) {
      return currentResumeData.rawText;
    }
    // Synthesize from structured fields
    const p = [
      currentResumeData.name,
      currentResumeData.headline,
      currentResumeData.summary,
      (currentResumeData.skills || []).join(', '),
      ...(currentResumeData.projects || []).map(x => `${x.title} ${x.tools} ${x.bullet}`),
      currentResumeData.education?.degree,
      currentResumeData.education?.university
    ];
    return p.filter(Boolean).join('\n');
  }

  function renderResumeATSAnalysis() {
    const text = getResumeFullText();
    const result = window.AJSResumeAgent ? window.AJSResumeAgent.analyzeResumeATS(text) : { totalScore: 0, breakdown: [], recommendations: [] };

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
      bdEl.innerHTML = (result.breakdown || []).map(b => `
        <div class="ats-breakdown-row">
          <div class="ats-breakdown-info">
            <strong>${escapeHTML(b.category)}</strong>
            <span>${escapeHTML(b.detail)}</span>
          </div>
          <span class="ats-breakdown-pts ${b.earned > 0 ? 'good' : ''}">${b.earned > 0 ? '+' : ''}${b.earned} / ${b.max} pts</span>
        </div>
      `).join('');
    }

    // Recommendations list
    const recEl = document.getElementById('atsRecommendationsList');
    if (recEl) {
      if (result.recommendations && result.recommendations.length) {
        recEl.innerHTML = result.recommendations.map(r => `<li>${escapeHTML(r)}</li>`).join('');
      } else {
        recEl.innerHTML = '<li style="color:#118c73">✓ Your resume meets core ATS benchmarks for junior analytics roles!</li>';
      }
    }

    // Extracted Skills chips
    const skillsWrap = document.getElementById('atsSkillsFoundWrap');
    if (skillsWrap) {
      if (result.skillsFound && result.skillsFound.length) {
        skillsWrap.innerHTML = result.skillsFound.map(s => `<span class="skill-pill active">${escapeHTML(s)}</span>`).join('');
      } else {
        skillsWrap.innerHTML = '<span style="color:#718f87;font-size:11px">Upload or type resume text to extract skills.</span>';
      }
    }

    // Memory vs Device indicator
    const devIndicator = document.getElementById('resumeStorageBadge');
    if (devIndicator) {
      if (currentResumeData.remembered) {
        devIndicator.textContent = 'Saved to this device';
        devIndicator.style.background = '#e6f5f1';
        devIndicator.style.color = '#106c59';
      } else {
        devIndicator.textContent = 'In page memory only (private)';
        devIndicator.style.background = '#fff3dd';
        devIndicator.style.color = '#b56b0b';
      }
    }

    // Update Word Count
    const wcEl = document.getElementById('resumeWordCount');
    if (wcEl) wcEl.textContent = `${result.wordCount || 0} words`;
  }

  function renderCompareJob() {
    const select = document.getElementById('compareJobSelect');
    if (!select) return;
    if (!select.options.length) {
      select.innerHTML = jobs.map(j => `<option value="${escapeHTML(j.id)}">${escapeHTML(j.company)} · ${escapeHTML(j.title)} (${escapeHTML(j.location)})</option>`).join('');
    }

    const jobId = select.value || (jobs[0] && jobs[0].id);
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const match = window.AJSResumeAgent ? window.AJSResumeAgent.matchJobWithResume(job, getResumeFullText()) : { matchScore: 0, matchedSkills: [], missingSkills: [] };

    const circle = document.getElementById('inspectScoreCircle');
    if (circle) circle.style.setProperty('--gauge-pct', match.matchScore);
    const textEl = document.getElementById('inspectScoreText');
    if (textEl) textEl.textContent = `${match.matchScore}%`;
    const titleEl = document.getElementById('inspectScoreTitle');
    if (titleEl) titleEl.textContent = `${job.company} · ${job.title}`;
    const subEl = document.getElementById('inspectScoreSub');
    if (subEl) subEl.textContent = `${match.matchedSkills.length} of ${(job.skills || []).length} keywords matched`;

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
            <button type="button" data-add-missing-skill="${escapeHTML(s)}" title="Add to skills">+</button>
          </span>`).join('')
        : '<span style="color:#7de8cc;font-size:10px">✓ 100% keyword coverage!</span>';

      missingEl.querySelectorAll('[data-add-missing-skill]').forEach(btn => {
        btn.addEventListener('click', () => {
          const s = btn.dataset.addMissingSkill;
          if (!currentResumeData.skills.includes(s)) {
            currentResumeData.skills.push(s);
            saveResume();
            renderResumeATSAnalysis();
            renderCompareJob();
          }
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
  // AI Suggestions Runner
  // -------------------------------------------------------------
  async function runAIEnhancement(actionType) {
    const ai = window.AJSAIClient;
    const outputEl = document.getElementById('aiSuggestionsOutput');
    const statusEl = document.getElementById('aiStatusNotice');
    if (!outputEl) return;

    // Check consent
    if (ai && !ai.hasConsent()) {
      showAIConsentModal(() => runAIEnhancement(actionType));
      return;
    }

    outputEl.innerHTML = '<div style="padding:20px;text-align:center;color:#63716d">Analyzing resume content and formulating recommendations…</div>';
    if (statusEl) statusEl.textContent = 'Generating guidance via AI / heuristic fallback…';

    const resumeText = getResumeFullText();
    const select = document.getElementById('compareJobSelect');
    const selectedJob = jobs.find(j => j.id === (select ? select.value : '')) || jobs[0];

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
    } else if (actionType === 'summary') {
      result = {
        source: 'local_rule_engine',
        markdown: window.AJSResumeAgent.OfflineGenerators.draftSummary(currentResumeData.skills || [], selectedJob?.title, selectedJob?.company)
      };
    } else if (actionType === 'questions') {
      result = {
        source: 'local_rule_engine',
        markdown: window.AJSResumeAgent.OfflineGenerators.interviewQuestions(currentResumeData.skills || [], selectedJob?.title)
      };
    }

    if (result && result.markdown) {
      outputEl.innerHTML = `
        <div style="font-size:12px;line-height:1.65;white-space:pre-wrap;color:#14221f;font-family:inherit">
          ${escapeHTML(result.markdown)}
        </div>
      `;
      if (statusEl) {
        statusEl.textContent = result.source.includes('puter') ? 'Generated via Puter.js AI' : 'Generated via Local Deterministic Engine';
      }
    }
  }

  function showAIConsentModal(onApproved) {
    const modal = document.getElementById('aiConsentModal');
    if (!modal) {
      if (confirm('Analytics Job Scout: Allow Puter.js to analyze your resume text for feedback? (Your data is never saved on external servers; local fallback is always available).')) {
        if (window.AJSAIClient) window.AJSAIClient.grantConsent();
        if (onApproved) onApproved();
      }
      return;
    }

    modal.hidden = false;
    const approveBtn = document.getElementById('aiConsentApproveBtn');
    const declineBtn = document.getElementById('aiConsentDeclineBtn');

    const handleApprove = () => {
      modal.hidden = true;
      if (window.AJSAIClient) window.AJSAIClient.grantConsent();
      approveBtn.removeEventListener('click', handleApprove);
      if (onApproved) onApproved();
    };

    const handleDecline = () => {
      modal.hidden = true;
      if (window.AJSAIClient) window.AJSAIClient.revokeConsent();
      approveBtn.removeEventListener('click', handleApprove);
      toast('Operating in offline local rule mode');
      if (onApproved) onApproved();
    };

    approveBtn.addEventListener('click', handleApprove);
    declineBtn.addEventListener('click', handleDecline);
  }

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
      const listEl = document.getElementById('coachTracksList');
      if (!listEl) return;
      if (!Array.isArray(CoachUI.tracks) || !CoachUI.tracks.length) {
        listEl.innerHTML = '<div style="padding:18px;color:var(--muted)">Loading curated analytics tracks…</div>';
        return;
      }

      listEl.innerHTML = CoachUI.tracks.map(t => `
        <div class="coach-track-card" data-track-id="${escapeHTML(t.id)}">
          <div class="coach-track-icon">💬</div>
          <div class="coach-track-info">
            <strong>${escapeHTML(t.title)}</strong>
            <p>${escapeHTML(t.description)}</p>
            <div class="coach-track-meta">
              <span>${t.questions ? t.questions.length : 12} curated questions</span>
              <span>Junior / Fresher</span>
            </div>
          </div>
          <button class="btn small primary" data-start-track="${escapeHTML(t.id)}">Practice track</button>
        </div>
      `).join('');

      listEl.querySelectorAll('[data-start-track]').forEach(btn => {
        btn.addEventListener('click', () => {
          const tid = btn.dataset.startTrack;
          const mins = parseInt(document.getElementById('coachSessionMinutesSelect')?.value || '5', 10);
          CoachUI.startTrackSession(tid, mins);
        });
      });
    },

    renderStreakAndStats: function() {
      const data = Storage ? Storage.getInterviewData() : { streak: 0, sessionsCount: 0, questionsAnswered: 0, recentScores: [] };
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

      // Render 7-day activity bars
      const barsEl = document.getElementById('coach7DayBars');
      if (barsEl) {
        const today = new Date();
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
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

      // Update Header
      document.getElementById('arenaSessionTitle').textContent = CoachUI.currentSession.trackName;
      document.getElementById('arenaQuestionCounter').textContent = `Question ${index + 1} of ${CoachUI.currentSession.questions.length}`;
      document.getElementById('arenaQuestionText').textContent = q.question;

      // Reset Answer Input & Feedback
      const answerInput = document.getElementById('arenaAnswerText');
      if (answerInput) answerInput.value = '';
      document.getElementById('arenaFeedbackWrap').hidden = true;
      document.getElementById('arenaAnswerActions').hidden = false;

      // Start elapsed timer
      clearInterval(CoachUI.timerInterval);
      const timerEl = document.getElementById('arenaTimerDisplay');
      CoachUI.timerInterval = setInterval(() => {
        const sec = Math.floor((Date.now() - CoachUI.questionStartTime) / 1000);
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${m}:${s}`;
      }, 1000);

      // Auto-read question if voice enabled
      const readAloud = document.getElementById('coachVoiceReadAloudToggle')?.checked;
      if (readAloud && window.AJSInterviewCoach.Speech.isSynthesisSupported()) {
        window.AJSInterviewCoach.Speech.speak(q.question);
      }
    },

    toggleVoiceRecognition: function() {
      const speech = window.AJSInterviewCoach.Speech;
      if (!speech.isRecognitionSupported()) {
        toast('Speech recognition is not supported in this browser. Please type your answer.');
        return;
      }

      const micBtn = document.getElementById('arenaMicBtn');
      const micStatus = document.getElementById('arenaMicStatus');

      if (CoachUI.isListening) {
        if (CoachUI.recognizer) CoachUI.recognizer.stop();
        CoachUI.isListening = false;
        if (micBtn) micBtn.classList.remove('recording');
        if (micStatus) micStatus.textContent = 'Mic paused';
        return;
      }

      CoachUI.recognizer = speech.createRecognizer(
        (finalTranscript, interim) => {
          const textarea = document.getElementById('arenaAnswerText');
          if (textarea) {
            textarea.value = (textarea.value + ' ' + finalTranscript).trim();
          }
        },
        (error) => {
          toast('Microphone error: ' + error);
          CoachUI.isListening = false;
          if (micBtn) micBtn.classList.remove('recording');
          if (micStatus) micStatus.textContent = 'Type your answer';
        },
        () => {
          CoachUI.isListening = false;
          if (micBtn) micBtn.classList.remove('recording');
          if (micStatus) micStatus.textContent = 'Mic paused';
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

      // Display feedback
      document.getElementById('arenaAnswerActions').hidden = true;
      const feedbackWrap = document.getElementById('arenaFeedbackWrap');
      feedbackWrap.hidden = false;

      document.getElementById('arenaScorePill').textContent = `${metrics.score}/100`;
      document.getElementById('arenaPacingPill').textContent = `${metrics.wpm} WPM · ${metrics.pacingAssessment}`;
      document.getElementById('arenaFillersPill').textContent = `${metrics.totalFillers} fillers`;

      // Rubric points & model answer
      const modelEl = document.getElementById('arenaSampleAnswerList');
      if (modelEl) {
        modelEl.innerHTML = (CoachUI.activeQuestion.sampleAnswerPoints || []).map(p => `<li>${escapeHTML(p)}</li>`).join('');
      }

      // Check next button
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

    exitArena: function() {
      clearInterval(CoachUI.timerInterval);
      if (CoachUI.recognizer) CoachUI.recognizer.stop();
      document.getElementById('coachSetupPanel').hidden = false;
      document.getElementById('coachArenaPanel').hidden = true;
      document.getElementById('coachCompletePanel').hidden = true;
    }
  };

  // -------------------------------------------------------------
  // Event Bindings & Initializers
  // -------------------------------------------------------------
  function initEventBindings() {
    // Navigation items
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.view)));
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => switchView(b.dataset.go)));
    document.getElementById('menuBtn')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));

    // Job search & filters
    ['jobSearch', 'locationFilter', 'freshnessFilter', 'companyFilter', 'sortFilter'].forEach(id => {
      document.getElementById(id)?.addEventListener(id === 'jobSearch' ? 'input' : 'change', renderJobs);
    });

    document.getElementById('savedToggle')?.addEventListener('click', () => {
      savedOnly = !savedOnly;
      updateSaved();
      renderJobs();
    });

    // Top actions
    document.getElementById('runScanTop')?.addEventListener('click', () => switchView('daily'));
    document.getElementById('exportCsvTop')?.addEventListener('click', () => {
      const cols = ['job_id','company','title','location','posted_date','days_old','window','type','experience','match_percent','skills','recruiter','official_detail_url','official_apply_url'];
      const esc = v => '"' + String(v).replaceAll('"', '""') + '"';
      const lines = [cols.join(','), ...jobs.map(j => [j.id, j.company, j.title, j.location, j.date, j.days, j.window, j.type, j.exp, j.score, (j.skills || []).join('; '), j.recruiter, j.detail, j.apply].map(esc).join(','))];
      download(`analytics_jobs_${todayIST()}.csv`, lines.join('\n'), 'text/csv');
      toast('Jobs CSV exported');
    });

    // Resume: Remember on device checkbox
    const rememberCheckbox = document.getElementById('resumeRememberDeviceCheckbox');
    if (rememberCheckbox) {
      rememberCheckbox.checked = !!currentResumeData.remembered;
      rememberCheckbox.addEventListener('change', () => {
        saveResume(rememberCheckbox.checked);
      });
    }

    // Resume: Forget & Delete all
    document.getElementById('forgetResumeBtn')?.addEventListener('click', () => {
      if (confirm('Forget resume on this device? (It will be cleared from local storage and memory)')) {
        if (Storage) Storage.forgetResume();
        currentResumeData = { rawText: '', skills: [], projects: [], education: {}, remembered: false };
        renderResumeATSAnalysis();
        renderCompareJob();
        renderJobs();
        toast('Resume cleared from memory and storage');
      }
    });

    document.getElementById('deleteAllCareerDataBtn')?.addEventListener('click', () => {
      if (confirm('Delete ALL career data? This will erase resume, interview history, streak, saved jobs, and applications.')) {
        if (Storage) Storage.deleteAllCareerData();
        savedJobs.clear();
        currentResumeData = { rawText: '', skills: [], projects: [], education: {}, remembered: false };
        renderResumeATSAnalysis();
        renderJobs();
        renderApplications();
        CoachUI.renderStreakAndStats();
        toast('All career data erased from this browser');
      }
    });

    // Resume AI Action buttons
    document.getElementById('aiRecruiterReviewBtn')?.addEventListener('click', () => runAIEnhancement('recruiter_review'));
    document.getElementById('aiCoverLetterBtn')?.addEventListener('click', () => runAIEnhancement('cover_letter'));
    document.getElementById('aiImproveBulletBtn')?.addEventListener('click', () => runAIEnhancement('improve_bullet'));
    document.getElementById('aiSummaryBtn')?.addEventListener('click', () => runAIEnhancement('summary'));
    document.getElementById('aiQuestionsBtn')?.addEventListener('click', () => runAIEnhancement('questions'));

    // Copy / Download AI suggestion output
    document.getElementById('copyAiOutputBtn')?.addEventListener('click', () => {
      const text = document.getElementById('aiSuggestionsOutput')?.textContent || '';
      copyText(text.trim());
    });
    document.getElementById('downloadAiOutputBtn')?.addEventListener('click', () => {
      const text = document.getElementById('aiSuggestionsOutput')?.textContent || '';
      download('ai_career_guidance.txt', text.trim(), 'text/plain');
    });

    // Resume File Dropzone & Input
    const fileInput = document.getElementById('resumeFileInput');
    const dropzone = document.getElementById('resumeDropzone');

    const handleFile = async (file) => {
      if (!file) return;
      try {
        toast('Extracting text from ' + file.name + ' locally…');
        const text = await window.AJSResumeAgent.parseFile(file);
        currentResumeData.rawText = text;
        currentResumeData.fileName = file.name;
        const rawEl = document.getElementById('resumeRawText');
        if (rawEl) rawEl.value = text;
        saveResume();
        toast('Resume parsed successfully (' + text.length + ' chars)');
      } catch (err) {
        toast(err.message || 'File parsing failed');
      }
    };

    if (fileInput) {
      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
      });
    }
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(n => dropzone.addEventListener(n, e => { e.preventDefault(); dropzone.classList.add('dragover'); }));
      ['dragleave', 'drop'].forEach(n => dropzone.addEventListener(n, e => { e.preventDefault(); dropzone.classList.remove('dragover'); }));
      dropzone.addEventListener('drop', e => {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      });
    }

    // Editable text area
    document.getElementById('resumeRawText')?.addEventListener('input', e => {
      currentResumeData.rawText = e.target.value;
      saveResume();
    });

    // Compare job selection change
    document.getElementById('compareJobSelect')?.addEventListener('change', renderCompareJob);

    // Interview Arena Controls
    document.getElementById('arenaMicBtn')?.addEventListener('click', CoachUI.toggleVoiceRecognition);
    document.getElementById('arenaSubmitBtn')?.addEventListener('click', CoachUI.submitAnswer);
    document.getElementById('arenaNextBtn')?.addEventListener('click', CoachUI.nextQuestion);
    document.getElementById('arenaStopBtn')?.addEventListener('click', CoachUI.exitArena);
    document.getElementById('completeBackBtn')?.addEventListener('click', CoachUI.exitArena);

    // Mixed daily session start
    document.getElementById('startDailyMixedSessionBtn')?.addEventListener('click', () => {
      const mins = parseInt(document.getElementById('coachSessionMinutesSelect')?.value || '5', 10);
      CoachUI.startTrackSession('mixed_daily', mins);
    });

    // Reset Progress / Export progress
    document.getElementById('resetInterviewProgressBtn')?.addEventListener('click', () => {
      if (confirm('Reset interview practice streak and history?')) {
        if (Storage) Storage.resetInterviewProgress();
        CoachUI.renderStreakAndStats();
        toast('Interview progress reset');
      }
    });

    document.getElementById('exportInterviewProgressBtn')?.addEventListener('click', () => {
      const data = Storage ? Storage.exportAllDataJSON() : {};
      download('career_workspace_backup.json', JSON.stringify(data, null, 2), 'application/json');
      toast('Progress data exported');
    });

    // Checklist bindings
    renderChecklist();
    renderRolePacks();
    renderAudit();
    renderDedupe();
  }

  function todayIST() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  function renderChecklist() {
    let idx = 0;
    const groupsEl = document.getElementById('checkGroups');
    if (!groupsEl) return;

    groupsEl.innerHTML = checklist.map((g, gi) => {
      const rows = g.items.map(item => {
        const id = `c${idx++}`;
        return `<label class="check-item ${checked.has(id) ? 'checked' : ''}">
          <input type="checkbox" data-check="${id}" ${checked.has(id) ? 'checked' : ''}>
          <span class="checkbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="m5 12 4 4L19 6"/></svg></span>
          <span class="check-copy"><strong>${item[0]}</strong><span>${item[1]}</span></span>
        </label>`;
      }).join('');
      return `<div class="check-group ${gi < 2 ? 'open' : ''}">
        <button class="group-head">
          <span class="group-icon">${icons[g.icon]}</span>
          <span class="group-title"><strong>${g.title}</strong><span>${g.items.length} checks</span></span>
          <span class="group-count" data-group-count="${gi}">0/${g.items.length}</span>
          <span class="chevron">⌄</span>
        </button>
        <div class="group-body">${rows}</div>
      </div>`;
    }).join('');

    groupsEl.querySelectorAll('.group-head').forEach(b => b.addEventListener('click', () => b.parentElement.classList.toggle('open')));
    groupsEl.querySelectorAll('[data-check]').forEach(cb => cb.addEventListener('change', () => {
      if (cb.checked) checked.add(cb.dataset.check);
      else checked.delete(cb.dataset.check);
      cb.closest('.check-item').classList.toggle('checked', cb.checked);
      if (Storage) Storage.set('ajs.v2.checks', [...checked]);
      updateChecklistProgress();
    }));

    updateChecklistProgress();
  }

  function updateChecklistProgress() {
    const total = checklist.reduce((n, g) => n + g.items.length, 0);
    const done = checked.size;
    const pct = Math.round((done / total) * 100);

    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = pct + '%';
    const txt = document.getElementById('progressText');
    if (txt) txt.textContent = `${done} of ${total} checked`;
    const pctEl = document.getElementById('progressPct');
    if (pctEl) pctEl.textContent = pct + '%';
    const navProg = document.getElementById('navProgress');
    if (navProg) navProg.textContent = pct + '%';
  }

  function renderRolePacks() {
    const select = document.getElementById('rolePackSelect');
    if (!select) return;
    select.innerHTML = Object.keys(rolePacks).map(k => `<option>${k}</option>`).join('');
    const update = () => {
      const kw = document.getElementById('roleKeywords');
      if (kw) kw.innerHTML = rolePacks[select.value].map(k => `<span>${k}</span>`).join('');
    };
    select.addEventListener('change', update);
    update();
  }

  function renderAudit() {
    const cc = document.getElementById('companyCloud');
    if (cc) cc.innerHTML = companies.map(c => `<span class="company-tag">${c}</span>`).join('');
    const rl = document.getElementById('rejectionList');
    if (rl) rl.innerHTML = rejections.map(r => `<div class="rejection"><strong>${r[0]}</strong><span>${r[1]}</span></div>`).join('');
  }

  function renderDedupe() {
    const suppressed = duplicateGroups.reduce((n, g) => n + g.ids.length, 0);
    const cl = document.getElementById('clusterList');
    if (cl) {
      cl.innerHTML = duplicateGroups.length ? duplicateGroups.map(g => `
        <div class="cluster">
          <div class="cluster-head">
            <div><strong>${g.title}</strong><p>Kept: ${g.shown}<br>${g.reason}</p></div>
            <span class="cluster-count">${g.ids.length} suppressed</span>
          </div>
          <div class="id-list">${g.ids.map(id => `<code>${id}</code>`).join('')}</div>
        </div>`).join('') : '<div class="empty-state"><strong>No duplicate cluster in this scan</strong></div>';
    }
    const jp = document.getElementById('jsonPreview');
    if (jp) jp.textContent = JSON.stringify(state, null, 2);
  }

  async function loadPublishedScan() {
    try {
      const res = await fetch(`./data/latest.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && Array.isArray(data.jobs) && data.jobs.length > 0) {
        jobs = data.jobs.map((j, i) => ({ ...j, priority: i < 3 }));
        state = buildState(data.scan_date || todayIST());
        renderPriorities();
        renderJobs();
        renderApplications();
      }
    } catch (e) {
      console.warn('[App] Loading latest.json failed, using baseline data:', e.message);
    }
  }

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initEventBindings();
    renderPriorities();
    renderJobs();
    updateSaved();
    renderApplications();
    renderResumeATSAnalysis();
    renderCompareJob();
    loadPublishedScan();
  });

  window.AJSApp = {
    jobs: jobs,
    switchView: switchView,
    renderJobs: renderJobs,
    CoachUI: CoachUI
  };

})(window);
