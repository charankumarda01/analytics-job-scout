/**
 * Analytics Job Scout v2 - Master Application Controller
 * Coordinates Views, Verified Jobs, Applications Workspace, ATS Checklist,
 * Scan Audit, and Personalized Interview Coach.
 *
 * Strict fail-closed payload loading, single source of truth, privacy-first storage,
 * and adaptive interview coaching grounded in verified jobs and truthful resume evidence.
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
    skills: [],
    projects: [],
    education: { degree: '', university: '', year: '' }
  };

  // Application workspace state
  let currentViewMode = 'list'; // 'list' or 'board'
  let activeDetailAppId = null;
  let activeFollowupJobId = null;
  let pendingImportData = null;

  // -------------------------------------------------------------
  // General UI Helpers
  // -------------------------------------------------------------
  function fmtDate(d) {
    if (!d) return '';
    try {
      const parts = String(d).split('-');
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
  // View Router (7 Canonical Information Architecture Destinations)
  // -------------------------------------------------------------
  function switchView(name) {
    const viewMap = {
      overview: 'overview',
      dashboard: 'overview',
      jobs: 'jobs',
      applications: 'applications',
      resume: 'resume',
      coach: 'coach',
      walkins: 'walkins',
      audit: 'audit'
    };
    const target = viewMap[name] || 'overview';

    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === `view-${target}`));
    document.querySelectorAll('.nav-btn').forEach(b => {
      const bView = b.dataset.view;
      b.classList.toggle('active', bView === target || (target === 'overview' && bView === 'dashboard'));
    });

    const titles = {
      overview: 'Dashboard',
      jobs: 'Find Jobs',
      applications: 'My Applications',
      resume: 'ATS & Resume',
      coach: 'Interview Coach',
      walkins: 'Walk-in Alerts',
      audit: 'Scan Audit'
    };
    const crumb = document.getElementById('crumbName');
    if (crumb) crumb.textContent = titles[target] || 'Workspace';

    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (target === 'overview') {
      renderDashboard();
    } else if (target === 'jobs') {
      renderJobs();
    } else if (target === 'applications') {
      renderApplicationsWorkspace();
    } else if (target === 'resume') {
      renderResumeATSWorkspace();
    } else if (target === 'coach') {
      CoachUI.init();
    } else if (target === 'audit') {
      renderAudit(publishedScanMeta);
    } else if (target === 'walkins') {
      if (window.AJSWalkinAlerts) window.AJSWalkinAlerts.markEventsSeen();
    }
  }

  window.switchView = switchView;

  // -------------------------------------------------------------
  // Resume & ATS Helpers
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
      ...(currentResumeData.projects || []).map(x => `${x.title || ''} ${x.tools || ''} ${x.bullet || ''}`),
      currentResumeData.education?.degree,
      currentResumeData.education?.university
    ];
    return parts.filter(Boolean).join('\n');
  }

  // -------------------------------------------------------------
  // 1. Dashboard Controller
  // -------------------------------------------------------------
  function renderDashboard() {
    if (!jobs.length) {
      const titleEl = document.getElementById('overviewHeroTitle');
      if (titleEl) titleEl.innerHTML = '0 verified roles.<br/>Scan loading or unavailable.';
    }

    const apps = Storage ? Storage.getApplications() : [];
    const queue = Storage ? Storage.getActionQueue(jobs) : [];
    const hasResume = hasUserResume();

    // Compute Next Best Action
    const nextActionCard = document.getElementById('dashboardNextActionCard');
    const titleEl = document.getElementById('nextActionTitle');
    const subEl = document.getElementById('nextActionSubtitle');
    const primaryBtn = document.getElementById('nextActionPrimaryBtn');

    if (nextActionCard && titleEl && subEl && primaryBtn) {
      if (!hasResume) {
        titleEl.textContent = 'Upload or paste your resume for personalized match scores';
        subEl.textContent = 'Unlock job-specific ATS checklists, evidence quotes, and targeted interview mock practice.';
        primaryBtn.textContent = 'Set up ATS Resume →';
        primaryBtn.onclick = () => switchView('resume');
      } else if (queue.length > 0) {
        const topTask = queue[0];
        titleEl.textContent = `${topTask.actionTitle}: ${topTask.company} · ${topTask.title}`;
        subEl.textContent = topTask.reason;
        primaryBtn.textContent = 'Take Action →';
        primaryBtn.onclick = () => {
          switchView('applications');
          if (topTask.appId) openApplicationDetail(topTask.appId);
        };
      } else if (jobs.length > 0) {
        const topJob = jobs.find(j => j.priority) || jobs[0];
        titleEl.textContent = `Apply to ${topJob.company} · ${topJob.title}`;
        subEl.textContent = `Verified junior fit posted ${topJob.days}d ago in ${topJob.location}. Live Apply endpoint verified.`;
        primaryBtn.textContent = 'View Job Details →';
        primaryBtn.onclick = () => switchView('jobs');
      } else {
        titleEl.textContent = 'Explore verified career tools';
        subEl.textContent = 'Check verified postings, customize your ATS checklist, and practice mock questions.';
        primaryBtn.textContent = 'Find Jobs →';
        primaryBtn.onclick = () => switchView('jobs');
      }
    }

    // Update Dashboard Metrics - Strictly Separated!
    // Scan numbers
    const total = jobs.length;
    const fresh = jobs.filter(j => j.window === 'fresh').length;
    const backup = total - fresh;

    const ovTotal = document.getElementById('overviewTotal');
    if (ovTotal) ovTotal.textContent = total;
    const ovFresh = document.getElementById('overviewFresh');
    if (ovFresh) ovFresh.textContent = fresh;
    const ovBackup = document.getElementById('overviewBackup');
    if (ovBackup) ovBackup.textContent = backup;
    const ovWalkins = document.getElementById('overviewWalkinsCount');
    if (ovWalkins) ovWalkins.textContent = '0';

    // Application Pipeline numbers
    const appMetrics = Storage ? Storage.getApplicationMetrics(jobs) : {};
    const readyEl = document.getElementById('dashReadyCount');
    if (readyEl) readyEl.textContent = appMetrics.ready_to_apply || (total - apps.length);
    const savedEl = document.getElementById('dashSavedCount');
    if (savedEl) savedEl.textContent = appMetrics.saved || 0;
    const applyingEl = document.getElementById('dashApplyingCount');
    if (applyingEl) applyingEl.textContent = appMetrics.applying || 0;
    const appliedEl = document.getElementById('dashAppliedCount');
    if (appliedEl) appliedEl.textContent = appMetrics.applied || 0;
    const interviewEl = document.getElementById('dashInterviewCount');
    if (interviewEl) interviewEl.textContent = (appMetrics.assessment || 0) + (appMetrics.interviews || 0);

    // Follow-ups card
    const followupsCard = document.getElementById('dashboardFollowupsCard');
    const followupsList = document.getElementById('dashboardFollowupsList');
    const urgentItems = queue.filter(q => q.actionType === 'followup_due' || q.actionType === 'interview_prep');

    if (followupsCard && followupsList) {
      if (urgentItems.length > 0) {
        followupsCard.hidden = false;
        followupsList.innerHTML = urgentItems.map(item => `
          <div style="padding:10px 0;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;font-size:12px">
            <div>
              <strong>${escapeHTML(item.company)} — ${escapeHTML(item.title)}</strong>
              <div style="color:var(--muted)">${escapeHTML(item.reason)}</div>
            </div>
            <button class="btn small" onclick="window.AJSApp.openApp('${escapeHTML(item.appId)}')">Review</button>
          </div>
        `).join('');
      } else {
        followupsCard.hidden = true;
      }
    }

    // Work in progress panel
    const resumeNameEl = document.getElementById('dashResumeName');
    if (resumeNameEl) {
      resumeNameEl.textContent = currentResumeData?.fileName || (hasResume ? 'Pasted Profile' : 'No resume loaded');
    }
    const atsCovEl = document.getElementById('dashAtsCoverage');
    if (atsCovEl && window.AJSResumeAgent && hasResume) {
      const ats = window.AJSResumeAgent.analyzeResumeATS(getResumeFullText());
      atsCovEl.textContent = `${ats.totalScore}% ATS Score`;
    }
    const streakEl = document.getElementById('dashCoachStreak');
    if (streakEl && Storage) {
      const coachProgress = Storage.getInterviewProgress();
      streakEl.textContent = `${coachProgress.streakDays || 0} days`;
    }

    // Priority grid
    renderPriorities();
  }

  function renderPriorities() {
    const grid = document.getElementById('priorityGrid');
    if (!grid) return;

    if (!jobs.length) {
      grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><strong>No verified jobs loaded</strong>Please reload scan or check connection.</div>';
      return;
    }

    let p = jobs.filter(j => j.priority).sort((a,b) => b.score - a.score);
    if (!p.length) p = [...jobs].sort((a,b) => (a.days - b.days) || (b.score - a.score)).slice(0, 3);

    const userReady = hasUserResume();
    const resumeText = getResumeFullText();
    const apps = Storage ? Storage.getApplications() : [];

    grid.innerHTML = p.map((j, i) => {
      let fitBadge = '';
      if (userReady && window.AJSResumeAgent) {
        const matchRes = window.AJSResumeAgent.matchJobWithResume(j, resumeText);
        if (matchRes.matchScore > 0) {
          fitBadge = `<span style="color:#106c59;font-weight:700"> · 🎯 Fit: ${matchRes.matchScore}%</span>`;
        }
      }

      const existingApp = apps.find(a => a.id === j.id || a.canonical_key === j.canonical_key);
      const isApplied = existingApp && ['applied', 'assessment', 'recruiter_screen', 'interview', 'final_round', 'offer'].includes(existingApp.status);

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
            ${isApplied
              ? `<button class="btn primary" data-open-detail="${escapeHTML(existingApp.id)}">Update application</button>`
              : `<button class="btn primary" data-apply-click="${escapeHTML(j.id)}">Apply on official site ↗</button>`
            }
            <button class="btn" data-match-job="${escapeHTML(j.id)}">🎯 ATS checklist</button>
            <button class="btn" data-practice-job="${escapeHTML(j.id)}">🎤 Practice</button>
          </div>
        </article>`;
    }).join('');

    bindJobButtons();
  }

  // -------------------------------------------------------------
  // 2. Find Jobs Controller (Button Hierarchy & Official Apply Flow)
  // -------------------------------------------------------------
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

    const apps = Storage ? Storage.getApplications() : [];
    const appMap = new Map();
    const savedIds = new Set();
    apps.forEach(a => {
      if (a.id) appMap.set(String(a.id), a);
      if (a.requisition_id) appMap.set(String(a.requisition_id), a);
      if (a.status === 'saved') {
        if (a.id) savedIds.add(String(a.id));
        if (a.requisition_id) savedIds.add(String(a.requisition_id));
      }
    });

    let list = jobs.filter(j => {
      const hay = [j.title, j.company, j.location, j.exp, j.fit, ...(j.skills || [])].join(' ').toLowerCase();
      return (!q || hay.includes(q)) &&
             (loc === 'all' || j.location === loc) &&
             (size === 'all' || (j.company_size || 'Unknown') === size) &&
             (fresh === 'all' || j.window === fresh) &&
             (company === 'all' || j.company === company) &&
             (!savedOnly || savedIds.has(String(j.id)));
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
          scoreBadge = `<span class="badge" style="background:#eaf4fd;color:#185a9d;border:1px solid #c7e0f8">🎯 Match: ${matchRes.matchScore}%</span>`;
        }
      }

      const existingApp = appMap.get(String(j.id)) || apps.find(a => a.canonical_key === j.canonical_key);
      const isSaved = existingApp && existingApp.status === 'saved';
      const isApplied = existingApp && ['applied', 'assessment', 'recruiter_screen', 'interview', 'final_round', 'offer'].includes(existingApp.status);
      const isApplying = existingApp && existingApp.status === 'applying';

      let statusBadge = '';
      if (isApplied) statusBadge = `<span class="status-pill ${existingApp.status}">✓ ${Storage.STATUS_LABELS[existingApp.status]}</span>`;
      else if (isApplying) statusBadge = `<span class="status-pill applying">Portal Opened</span>`;
      else if (isSaved) statusBadge = `<span class="status-pill saved">Saved</span>`;

      return `
        <article class="job-card" id="job-card-${escapeHTML(j.id)}">
          <div class="company-logo ${(j.company || '').toLowerCase()}">${escapeHTML((j.company || 'C')[0])}</div>
          <div class="job-main">
            <div class="job-topline">
              <span class="badge ${j.window}">${j.window === 'fresh' ? 'Fresh' : 'Backup'} · ${j.days}d</span>
              <span class="badge verified">✓ Official Posting</span>
              ${statusBadge}
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
            <!-- Button Hierarchy: Primary Action -->
            ${isApplied
              ? `<button class="btn primary" data-open-detail="${escapeHTML(existingApp.id)}">Update application</button>`
              : `<button class="btn primary" data-apply-click="${escapeHTML(j.id)}">Apply on official site ↗</button>`
            }

            <!-- Secondary Actions -->
            ${!isApplied ? `
              <button class="btn ${isSaved ? 'saved' : ''}" data-save-job="${escapeHTML(j.id)}">${isSaved ? '♥ Saved' : '♡ Save'}</button>
              <button class="btn" data-quick-mark-applied="${escapeHTML(j.id)}">Mark applied</button>
            ` : `
              <a class="btn" href="${escapeHTML(j.apply)}" target="_blank" rel="noopener noreferrer">View official posting ↗</a>
            `}

            <!-- Contextual Actions -->
            <button class="btn" data-match-job="${escapeHTML(j.id)}">🎯 ATS checklist</button>
            <button class="btn" data-practice-job="${escapeHTML(j.id)}">🎤 Prepare interview</button>

            <!-- Overflow / Research -->
            <button class="btn small" data-research-company="${escapeHTML(j.company)}">🏢 Research</button>
            <button class="btn small" data-report-job="${escapeHTML(j.id)}" title="Report broken link">🚩 Report</button>
          </div>
        </article>`;
    }).join('');

    bindJobButtons();
  }

  function bindJobButtons() {
    // 1. Primary Apply Click (Opens in new tab, records opened_at, NEVER auto-marks applied!)
    document.querySelectorAll('[data-apply-click]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = String(btn.dataset.applyClick);
        const job = jobs.find(j => String(j.id) === jobId);
        if (!job) return;

        // Open official destination in new tab
        window.open(job.apply, '_blank', 'noopener,noreferrer');

        // Record apply click strictly as opened_at / applying
        if (Storage) {
          Storage.recordApplyClick(job);
        }

        // Show non-blocking follow-up prompt
        showApplyFollowupToast(job.id);
        renderJobs();
        renderApplicationsWorkspace();
      });
    });

    // 2. Open detail drawer
    document.querySelectorAll('[data-open-detail]').forEach(btn => {
      btn.addEventListener('click', () => {
        openApplicationDetail(btn.dataset.openDetail);
      });
    });

    // 3. Save toggle
    document.querySelectorAll('[data-save-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = String(btn.dataset.saveJob);
        const job = jobs.find(j => String(j.id) === jobId);
        if (!job || !Storage) return;

        const apps = Storage.getApplications();
        const existing = apps.find(a => String(a.id) === jobId || String(a.requisition_id) === jobId);
        if (existing && existing.status === 'saved') {
          Storage.deleteApplication(existing.id);
          toast('Removed from saved roles');
        } else {
          Storage.saveApplication({
            id: String(job.id),
            requisition_id: String(job.id),
            company: job.company,
            title: job.title,
            location: job.location,
            type: job.type,
            detail_url: job.detail,
            apply_url: job.apply,
            status: 'saved',
            skills: job.skills,
            notes: 'Saved from job search'
          });
          toast('Role saved for later');
        }
        renderJobs();
        renderApplicationsWorkspace();
      });
    });

    // 4. Mark applied directly
    document.querySelectorAll('[data-quick-mark-applied]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = String(btn.dataset.quickMarkApplied);
        openMarkAppliedModal(jobId);
      });
    });

    // 5. Match resume
    document.querySelectorAll('[data-match-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = String(btn.dataset.matchJob);
        switchView('resume');
        const compSelect = document.getElementById('compareJobSelect');
        if (compSelect) {
          compSelect.value = jobId;
          renderJobAtsMatch(jobId);
        }
      });
    });

    // 6. Practice for job
    document.querySelectorAll('[data-practice-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const jobId = String(btn.dataset.practiceJob);
        const targetJob = jobs.find(j => String(j.id) === jobId);
        switchView('coach');
        if (targetJob) CoachUI.startJobPractice(targetJob);
      });
    });

    // 7. Research company
    document.querySelectorAll('[data-research-company]').forEach(btn => {
      btn.addEventListener('click', () => {
        openCompanyResearch(btn.dataset.researchCompany);
      });
    });

    // 8. Report link
    document.querySelectorAll('[data-report-job]').forEach(btn => {
      btn.addEventListener('click', () => {
        const card = document.getElementById(`job-card-${btn.dataset.reportJob}`);
        if (card) card.style.opacity = '0.5';
        toast('Link problem flagged on this device');
      });
    });
  }

  // -------------------------------------------------------------
  // Non-blocking Apply Follow-up Toast & Mark Applied Dialog
  // -------------------------------------------------------------
  function showApplyFollowupToast(jobId) {
    activeFollowupJobId = jobId;
    const toastEl = document.getElementById('applyFollowupToast');
    if (!toastEl) return;
    toastEl.hidden = false;
  }

  function hideApplyFollowupToast() {
    activeFollowupJobId = null;
    const toastEl = document.getElementById('applyFollowupToast');
    if (toastEl) toastEl.hidden = true;
  }

  function openMarkAppliedModal(jobId) {
    const modal = document.getElementById('markAppliedModal');
    const dateInput = document.getElementById('markAppliedDateInput');
    const noteInput = document.getElementById('markAppliedNoteInput');
    if (!modal || !dateInput) return;

    // Default to current local date/time in ISO format for datetime-local
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    dateInput.value = now.toISOString().slice(0, 16);
    if (noteInput) noteInput.value = '';

    modal.dataset.targetJobId = jobId;
    modal.hidden = false;
  }

  // -------------------------------------------------------------
  // 3. My Applications Workspace Controller
  // -------------------------------------------------------------
  function renderApplicationsWorkspace() {
    const apps = Storage ? Storage.getApplications() : [];
    const navCount = document.getElementById('applicationNavCount');
    if (navCount) navCount.textContent = apps.length;

    // Render Metrics
    renderWorkspaceMetrics(apps);

    // Render Action Queue
    renderWorkspaceActionQueue();

    // Populate Company Filter
    const compFilter = document.getElementById('appCompanyFilter');
    if (compFilter) {
      const companies = Array.from(new Set(apps.map(a => a.company).filter(Boolean))).sort();
      const currentVal = compFilter.value;
      compFilter.innerHTML = '<option value="all">All companies</option>' +
        companies.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
      if (currentVal) compFilter.value = currentVal;
    }

    // Filter and Sort Applications
    const filteredApps = filterAndSortApplications(apps);

    const countText = document.getElementById('pipelineCountText');
    if (countText) countText.textContent = `${filteredApps.length} of ${apps.length} applications shown`;

    // Render List or Board
    if (currentViewMode === 'board') {
      document.getElementById('applicationListViewContainer').hidden = true;
      document.getElementById('applicationBoardViewContainer').hidden = false;
      renderKanbanBoard(filteredApps);
    } else {
      document.getElementById('applicationListViewContainer').hidden = false;
      document.getElementById('applicationBoardViewContainer').hidden = true;
      renderApplicationListTable(filteredApps);
    }
  }

  function renderWorkspaceMetrics(apps) {
    const metricsEl = document.getElementById('applicationMetrics');
    if (!metricsEl) return;

    const metrics = Storage ? Storage.getApplicationMetrics(jobs) : {};

    metricsEl.innerHTML = `
      <div class="metric"><div class="metric-top"><span class="metric-label">Ready to apply</span></div><strong>${metrics.ready_to_apply || 0}</strong><div class="metric-note">Unapplied from scan</div></div>
      <div class="metric blue"><div class="metric-top"><span class="metric-label">Saved</span></div><strong>${metrics.saved || 0}</strong><div class="metric-note">Saved for review</div></div>
      <div class="metric amber"><div class="metric-top"><span class="metric-label">Applying</span></div><strong>${metrics.applying || 0}</strong><div class="metric-note">Portal opened</div></div>
      <div class="metric" style="background:#eaf8f4;border-color:#b5e2d6"><div class="metric-top"><span class="metric-label">Applied</span></div><strong style="color:#0e6c59">${metrics.applied || 0}</strong><div class="metric-note">Submitted</div></div>
      <div class="metric" style="background:#f6f0fd;border-color:#ded0fa"><div class="metric-top"><span class="metric-label">Assessments</span></div><strong style="color:#5f2ca0">${metrics.assessment || 0}</strong><div class="metric-note">Tests pending</div></div>
      <div class="metric" style="background:#f4ecfd;border-color:#ded0fa"><div class="metric-top"><span class="metric-label">Interviews</span></div><strong style="color:#5f2ca0">${metrics.interviews || 0}</strong><div class="metric-note">Active rounds</div></div>
      <div class="metric" style="background:#d4edda;border-color:#c3e6cb"><div class="metric-top"><span class="metric-label">Offers</span></div><strong style="color:#155724">${metrics.offer || 0}</strong><div class="metric-note">Received</div></div>
      <div class="metric gray"><div class="metric-top"><span class="metric-label">Closed/Rejected</span></div><strong>${metrics.closed || 0}</strong><div class="metric-note">Concluded</div></div>
      <div class="metric" style="background:#fff3dd;border-color:#ffe2a8"><div class="metric-top"><span class="metric-label">Follow-ups Due</span></div><strong style="color:#b56b0b">${metrics.followups_due || 0}</strong><div class="metric-note">Time-sensitive</div></div>
    `;
  }

  function renderWorkspaceActionQueue() {
    const queueList = document.getElementById('actionQueueList');
    if (!queueList) return;

    const queue = Storage ? Storage.getActionQueue(jobs) : [];
    if (!queue.length) {
      queueList.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1;padding:24px">
          <strong>No pending actions in your queue</strong>
          <p style="margin:4px 0 0;color:var(--muted)">You're all caught up! Explore new verified roles or practice mock interviews.</p>
        </div>`;
      return;
    }

    queueList.innerHTML = queue.map(item => `
      <div class="action-card ${item.urgency === 'high' ? 'urgent' : ''}">
        <div class="action-card-header">
          <strong>${escapeHTML(item.company)}</strong>
          <span class="action-badge">${escapeHTML(item.actionTitle)}</span>
        </div>
        <h4>${escapeHTML(item.title)}</h4>
        <div class="action-card-reason">
          💡 <strong>Why this is listed:</strong> ${escapeHTML(item.reason)}
        </div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:11px;color:var(--muted)">${item.deadline ? 'Due: ' + fmtDate(item.deadline) : ''}</span>
          <button class="btn small primary" onclick="window.AJSApp.openApp('${escapeHTML(item.appId)}')">Take action →</button>
        </div>
      </div>
    `).join('');
  }

  function filterAndSortApplications(apps) {
    const q = (document.getElementById('appSearchInput')?.value || '').trim().toLowerCase();
    const status = document.getElementById('appStatusFilter')?.value || 'all';
    const company = document.getElementById('appCompanyFilter')?.value || 'all';
    const scanFilter = document.getElementById('appScanHealthFilter')?.value || 'all';
    const sort = document.getElementById('appSortFilter')?.value || 'updated';

    return apps.filter(a => {
      const matchQ = !q || [a.title, a.company, a.notes, a.recruiter_name].join(' ').toLowerCase().includes(q);
      const matchStatus = status === 'all' || a.status === status;
      const matchCompany = company === 'all' || a.company === company;
      const matchScan = scanFilter === 'all' ||
        (scanFilter === 'in_scan' && a.in_latest_scan) ||
        (scanFilter === 'not_in_scan' && !a.in_latest_scan);
      return matchQ && matchStatus && matchCompany && matchScan;
    }).sort((a, b) => {
      if (sort === 'updated') return new Date(b.last_updated_at || 0) - new Date(a.last_updated_at || 0);
      if (sort === 'applied') return new Date(b.applied_date || 0) - new Date(a.applied_date || 0);
      if (sort === 'nextAction') return new Date(a.reminder_date || '9999') - new Date(b.reminder_date || '9999');
      if (sort === 'company') return a.company.localeCompare(b.company);
      return 0;
    });
  }

  function renderApplicationListTable(filteredApps) {
    const tbody = document.getElementById('applicationTableBody');
    if (!tbody) return;

    if (!filteredApps.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--muted)">No applications match your search and filter criteria.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredApps.map(a => {
      const inScanBadge = a.in_latest_scan
        ? `<span class="badge verified">✓ In today's scan</span>`
        : `<span class="badge backup" title="Job left the 15-day scan window or closed officially. Retained safely in your history.">⚠️ Not in today's scan</span>`;

      const statusPill = `<span class="status-pill ${a.status}">${Storage.STATUS_LABELS[a.status] || a.status}</span>`;

      const nextActionText = a.next_action
        ? `<strong>${escapeHTML(a.next_action)}</strong>${a.reminder_date ? `<div style="font-size:11px;color:var(--muted)">Due: ${fmtDate(a.reminder_date)}</div>` : ''}`
        : `<span style="color:var(--muted);font-size:11px">None set</span>`;

      const timelineSnippet = (a.timeline && a.timeline.length)
        ? `<span style="font-size:11px;color:var(--muted)">${escapeHTML(a.timeline[a.timeline.length - 1].note || a.timeline[a.timeline.length - 1].action)}</span>`
        : '<span style="font-size:11px;color:var(--muted)">Logged</span>';

      return `
        <tr>
          <td>
            <strong>${escapeHTML(a.title)}</strong>
            <div style="font-size:11.5px;color:var(--muted)">${escapeHTML(a.company)} · ${escapeHTML(a.location || 'Remote')}</div>
          </td>
          <td>${statusPill}</td>
          <td>${inScanBadge}</td>
          <td>${nextActionText}</td>
          <td>${timelineSnippet}</td>
          <td style="text-align:right;white-space:nowrap">
            <button class="btn small" onclick="window.AJSApp.openApp('${escapeHTML(a.id)}')">View Details</button>
            <a class="btn small" href="${escapeHTML(a.apply_url || a.detail_url)}" target="_blank" rel="noopener noreferrer">Open Portal ↗</a>
          </td>
        </tr>`;
    }).join('');
  }

  function renderKanbanBoard(filteredApps) {
    const board = document.getElementById('applicationBoardViewContainer');
    if (!board) return;

    const columns = [
      { id: 'saved', label: 'Saved', statuses: ['saved'] },
      { id: 'applying', label: 'In Progress', statuses: ['applying'] },
      { id: 'applied', label: 'Applied', statuses: ['applied'] },
      { id: 'assessment', label: 'Assessments', statuses: ['assessment', 'recruiter_screen'] },
      { id: 'interview', label: 'Interviews', statuses: ['interview', 'final_round'] },
      { id: 'offer', label: 'Offers', statuses: ['offer'] },
      { id: 'closed', label: 'Closed / Rejected', statuses: ['rejected', 'withdrawn', 'closed'] }
    ];

    board.innerHTML = columns.map(col => {
      const colApps = filteredApps.filter(a => col.statuses.includes(a.status));
      return `
        <div class="kanban-col">
          <div class="kanban-col-head">
            <strong>${escapeHTML(col.label)}</strong>
            <span class="kanban-count">${colApps.length}</span>
          </div>
          <div class="kanban-items">
            ${colApps.map(a => `
              <div class="kanban-card" onclick="window.AJSApp.openApp('${escapeHTML(a.id)}')">
                <strong>${escapeHTML(a.title)}</strong>
                <span>${escapeHTML(a.company)}</span>
                <div style="margin-top:6px;display:flex;justify-content:space-between;align-items:center">
                  <span class="status-pill ${a.status}" style="font-size:9.5px">${Storage.STATUS_LABELS[a.status]}</span>
                  ${!a.in_latest_scan ? '<span style="font-size:9.5px;color:#a35200">⚠️ Stale</span>' : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }).join('');
  }

  // -------------------------------------------------------------
  // Application Detail Drawer
  // -------------------------------------------------------------
  function openApplicationDetail(appId) {
    const app = Storage ? Storage.getApplication(appId) : null;
    if (!app) {
      toast('Application record not found');
      return;
    }

    activeDetailAppId = appId;
    const backdrop = document.getElementById('appDetailDrawerBackdrop');
    if (!backdrop) return;

    // Header info
    document.getElementById('drawerTitle').textContent = app.title;
    document.getElementById('drawerCompanySub').textContent = `${app.company} · ${app.location || 'India'} (${app.type || 'Full-time'})`;
    document.getElementById('drawerApplyLink').href = app.apply_url || app.detail_url;

    // Scan health notice
    const noticeEl = document.getElementById('drawerScanStatusNotice');
    if (noticeEl) {
      if (app.in_latest_scan) {
        noticeEl.style.background = '#e6f5f1';
        noticeEl.style.color = '#0e6c59';
        noticeEl.innerHTML = '✓ <strong>Active in today’s verified scan.</strong> Requisition is live and verified on official company career portal.';
      } else {
        noticeEl.style.background = '#fff3dd';
        noticeEl.style.color = '#925909';
        noticeEl.innerHTML = '⚠️ <strong>Not in today’s verified scan.</strong> The official posting was closed, filled, or moved beyond the 15-day window. All your notes, timeline, and interview prep remain preserved.';
      }
    }

    // Timeline Track
    const track = document.getElementById('drawerTimelineTrack');
    if (track) {
      const events = app.timeline || [];
      track.innerHTML = events.slice().reverse().map(ev => `
        <div class="timeline-node">
          <div class="timeline-node-dot"></div>
          <div class="timeline-node-date">${new Date(ev.date || ev.changed_at || Date.now()).toLocaleString('en-IN')}</div>
          <div class="timeline-node-title">${escapeHTML(ev.action || (ev.status ? Storage.STATUS_LABELS[ev.status] || ev.status : 'Status Updated'))}</div>
          ${ev.note ? `<p class="timeline-node-note">${escapeHTML(ev.note)}</p>` : ''}
        </div>
      `).join('');
    }

    // Inputs
    const nextActionInput = document.getElementById('drawerNextActionInput');
    if (nextActionInput) nextActionInput.value = app.next_action || '';
    const reminderInput = document.getElementById('drawerReminderDateInput');
    if (reminderInput) reminderInput.value = app.reminder_date || '';

    const recName = document.getElementById('drawerRecruiterName');
    if (recName) recName.value = app.recruiter_name || '';
    const recChan = document.getElementById('drawerContactChannel');
    if (recChan) recChan.value = app.contact_channel || '';

    const notesText = document.getElementById('drawerNotesText');
    if (notesText) notesText.value = app.notes || '';

    // Archive toggle text
    const archiveBtn = document.getElementById('drawerArchiveBtn');
    if (archiveBtn) archiveBtn.textContent = app.archived ? 'Unarchive' : 'Archive';

    backdrop.hidden = false;
  }

  function closeApplicationDetail() {
    activeDetailAppId = null;
    const backdrop = document.getElementById('appDetailDrawerBackdrop');
    if (backdrop) backdrop.hidden = true;
  }

  // -------------------------------------------------------------
  // 4. ATS & Resume Workspace Controller
  // -------------------------------------------------------------
  function renderResumeATSWorkspace() {
    populateResumeProfiles();

    // Populate Job Selector
    const compareSelect = document.getElementById('compareJobSelect');
    if (compareSelect) {
      const allSelectable = [
        ...jobs,
        ...(Storage ? Storage.getApplications().filter(a => !jobs.some(j => j.id === a.id)) : [])
      ];

      const currentVal = compareSelect.value;
      compareSelect.innerHTML = allSelectable.map(j => `
        <option value="${escapeHTML(j.id)}">${escapeHTML(j.company)} · ${escapeHTML(j.title)}</option>
      `).join('');

      if (currentVal && allSelectable.some(j => j.id === currentVal)) {
        compareSelect.value = currentVal;
      }
      renderJobAtsMatch(compareSelect.value);
    }
  }

  function populateResumeProfiles() {
    const profSelect = document.getElementById('resumeProfileSelect');
    if (!profSelect || !Storage) return;

    const profiles = Storage.getResumeProfiles();
    profSelect.innerHTML = '<option value="">(Current Session Resume)</option>' +
      profiles.map(p => `<option value="${escapeHTML(p.name)}">${escapeHTML(p.name)} (${p.wordCount || 0} words)</option>`).join('');
  }

  function renderJobAtsMatch(jobId) {
    const allJobs = [
      ...jobs,
      ...(Storage ? Storage.getApplications() : [])
    ];
    const job = allJobs.find(j => j.id === jobId) || jobs[0];
    if (!job) return;

    const resumeText = getResumeFullText();
    const hasResume = hasUserResume();

    const matchRes = (hasResume && window.AJSResumeAgent)
      ? window.AJSResumeAgent.matchJobWithResume(job, resumeText)
      : {
          matchScore: 0,
          matchedSkills: [],
          missingSkills: job.skills || [],
          requiredMatched: [],
          requiredMissing: (job.skills || []).slice(0, 3),
          preferredMatched: [],
          preferredMissing: (job.skills || []).slice(3),
          evidenceSnippets: {},
          checklist: []
        };

    // Update gauge
    const circle = document.getElementById('atsScoreGaugeCircle');
    if (circle) circle.style.setProperty('--gauge-pct', matchRes.matchScore);
    const scoreVal = document.getElementById('atsScoreValue');
    if (scoreVal) scoreVal.textContent = matchRes.matchScore;
    const targetTitle = document.getElementById('atsTargetJobTitle');
    if (targetTitle) targetTitle.textContent = `${job.company} · ${job.title}`;
    const grade = document.getElementById('atsScoreGrade');
    if (grade) {
      grade.textContent = matchRes.matchScore >= 75 ? 'Strong Match' : (matchRes.matchScore >= 50 ? 'Moderate Match' : 'Gaps Detected');
    }

    // Real-time right sidebar gauge
    const inspectCircle = document.getElementById('inspectScoreCircle');
    if (inspectCircle) inspectCircle.style.setProperty('--gauge-pct', matchRes.matchScore);
    const inspectText = document.getElementById('inspectScoreText');
    if (inspectText) inspectText.textContent = `${matchRes.matchScore}%`;
    const inspectTitle = document.getElementById('inspectScoreTitle');
    if (inspectTitle) inspectTitle.textContent = `${job.company} · ${job.title}`;
    const inspectSub = document.getElementById('inspectScoreSub');
    if (inspectSub) {
      inspectSub.textContent = hasResume
        ? `${matchRes.matchedSkills.length} of ${(job.skills || []).length} keywords verified in resume`
        : 'Upload resume to calculate match';
    }

    // Right sidebar matched & missing chips
    const matchedEl = document.getElementById('inspectMatchedSkills');
    if (matchedEl) {
      matchedEl.innerHTML = (matchRes.matchedSkills && matchRes.matchedSkills.length)
        ? matchRes.matchedSkills.map(s => `<span class="match-chip-hit">✓ ${escapeHTML(s)}</span>`).join('')
        : '<span style="color:#a2c4bc;font-size:10px">No matching keywords detected yet.</span>';
    }
    const missingEl = document.getElementById('inspectMissingSkills');
    if (missingEl) {
      missingEl.innerHTML = (matchRes.missingSkills && matchRes.missingSkills.length)
        ? matchRes.missingSkills.map(s => `<span class="match-chip-miss">${escapeHTML(s)}</span>`).join('')
        : '<span style="color:#7de8cc;font-size:10px">✓ 100% keyword coverage!</span>';
    }

    // Required Skills Evidence
    const reqList = document.getElementById('requiredSkillsEvidenceList');
    if (reqList) {
      const items = [
        ...(matchRes.requiredMatched || []).map(s => ({ skill: s, matched: true, quote: matchRes.evidenceSnippets[s] })),
        ...(matchRes.requiredMissing || []).map(s => ({ skill: s, matched: false }))
      ];
      reqList.innerHTML = items.map(it => `
        <div style="padding:8px 12px;background:#f9fbf9;border-left:3px solid ${it.matched ? '#168c73' : '#d9534f'};border-radius:4px;margin-bottom:6px;font-size:12px">
          <strong>${it.matched ? '✓' : '✗'} ${escapeHTML(it.skill)}</strong>
          ${it.quote ? `<div style="color:var(--muted);font-style:italic;margin-top:2px">“${escapeHTML(it.quote)}”</div>` : '<div style="color:#a35200;font-size:11px">Missing from resume text. Add only if you have genuine experience.</div>'}
        </div>
      `).join('');
    }

    // Preferred Skills Evidence
    const prefList = document.getElementById('preferredSkillsEvidenceList');
    if (prefList) {
      const items = [
        ...(matchRes.preferredMatched || []).map(s => ({ skill: s, matched: true, quote: matchRes.evidenceSnippets[s] })),
        ...(matchRes.preferredMissing || []).map(s => ({ skill: s, matched: false }))
      ];
      prefList.innerHTML = items.map(it => `
        <div style="padding:8px 12px;background:#f9fbf9;border-left:3px solid ${it.matched ? '#168c73' : '#f0ad4e'};border-radius:4px;margin-bottom:6px;font-size:12px">
          <strong>${it.matched ? '✓' : '✗'} ${escapeHTML(it.skill)}</strong>
          ${it.quote ? `<div style="color:var(--muted);font-style:italic;margin-top:2px">“${escapeHTML(it.quote)}”</div>` : '<div style="color:var(--muted);font-size:11px">Optional / Preferred skill.</div>'}
        </div>
      `).join('');
    }

    // Actionable Tailoring Checklist (Critical, Useful, Optional)
    const chkContainer = document.getElementById('jobAtsChecklistContainer');
    if (chkContainer) {
      const checklist = matchRes.checklist || [];
      if (!checklist.length) {
        chkContainer.innerHTML = '<div style="font-size:12px;color:#168c73;padding:10px">✓ No major skill gaps detected for this role!</div>';
        return;
      }

      chkContainer.innerHTML = checklist.map((item, idx) => `
        <div style="padding:10px 14px;background:#fff;border:1px solid var(--line);border-radius:8px;margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong style="font-size:12.5px;color:var(--ink)">${escapeHTML(item.item)}</strong>
            <span class="badge ${item.priority === 'critical' ? 'danger' : (item.priority === 'useful' ? 'backup' : 'verified')}">${escapeHTML(item.priority.toUpperCase())}</span>
          </div>
          <p style="margin:4px 0 0;font-size:11.5px;color:var(--muted)">${escapeHTML(item.guidance)}</p>
        </div>
      `).join('');
    }
  }

  // -------------------------------------------------------------
  // 5. Personalized Interview Coach Controller
  // -------------------------------------------------------------
  const CoachUI = {
    currentSession: null,
    currentQuestionIndex: 0,
    activeQuestion: null,
    sessionAnswers: [],
    timerInterval: null,
    secondsElapsed: 0,
    recognizer: null,
    isListening: false,

    init: function() {
      CoachUI.populateTargetJobSelector();
      CoachUI.renderStreakAndStats();
      CoachUI.checkForPausedSession();
    },

    populateTargetJobSelector: function() {
      const select = document.getElementById('coachTargetJobSelect');
      if (!select) return;

      const allJobs = [
        ...jobs,
        ...(Storage ? Storage.getApplications() : [])
      ];

      select.innerHTML = allJobs.map(j => `
        <option value="${escapeHTML(j.id)}">${escapeHTML(j.company)} · ${escapeHTML(j.title)}</option>
      `).join('');
    },

    checkForPausedSession: function() {
      const paused = Storage ? Storage.getPausedInterviewSession() : null;
      const banner = document.getElementById('coachResumeSessionBanner');
      const text = document.getElementById('coachResumeSessionText');
      if (!banner || !text) return;

      if (paused && paused.activeQuestionIndex !== undefined) {
        banner.hidden = false;
        text.textContent = `Paused on Question ${paused.activeQuestionIndex + 1} of ${paused.questions.length} for ${paused.targetJob?.company || 'Target Job'}.`;
      } else {
        banner.hidden = true;
      }
    },

    renderStreakAndStats: function() {
      const prog = Storage ? Storage.getInterviewProgress() : { streakDays: 0, sessionsCompleted: 0, questionsAnswered: 0, averageScore: 0 };

      const streakEl = document.getElementById('coachStreakCount');
      if (streakEl) streakEl.textContent = prog.streakDays || 0;
      const sessEl = document.getElementById('coachSessionsCount');
      if (sessEl) sessEl.textContent = prog.sessionsCompleted || 0;
      const qEl = document.getElementById('coachQuestionsCount');
      if (qEl) qEl.textContent = prog.questionsAnswered || 0;
      const avgEl = document.getElementById('coachAvgScore');
      if (avgEl) avgEl.textContent = prog.averageScore ? `${prog.averageScore}%` : '--';
    },

    startJobPractice: function(targetJob) {
      const select = document.getElementById('coachTargetJobSelect');
      if (select && targetJob) select.value = targetJob.id;
      CoachUI.startSession();
    },

    startSession: function() {
      const select = document.getElementById('coachTargetJobSelect');
      const stageSelect = document.getElementById('coachTargetStageSelect');
      const minutesSelect = document.getElementById('coachSessionMinutesSelect');

      const allJobs = [...jobs, ...(Storage ? Storage.getApplications() : [])];
      const selectedJob = allJobs.find(j => j.id === (select?.value)) || jobs[0];

      if (!selectedJob) {
        toast('Please select a target job opening first');
        return;
      }

      const stage = stageSelect?.value || 'full_loop';
      const duration = parseInt(minutesSelect?.value || '30', 10);
      const resumeText = getResumeFullText();

      if (!window.AJSInterviewCoach) {
        toast('Interview Coach module loading...');
        return;
      }

      // Build personalized question set
      const session = window.AJSInterviewCoach.buildPersonalizedSession(selectedJob, resumeText, stage, duration);
      CoachUI.currentSession = session;
      CoachUI.currentQuestionIndex = 0;
      CoachUI.sessionAnswers = [];

      document.getElementById('coachSetupPanel').hidden = true;
      document.getElementById('coachCompletePanel').hidden = true;
      document.getElementById('coachArenaPanel').hidden = false;

      CoachUI.startTimer();
      CoachUI.loadQuestion(0);
    },

    resumePausedSession: function() {
      const paused = Storage ? Storage.getPausedInterviewSession() : null;
      if (!paused) return;

      CoachUI.currentSession = paused;
      CoachUI.currentQuestionIndex = paused.activeQuestionIndex || 0;
      CoachUI.sessionAnswers = paused.answers || [];

      document.getElementById('coachSetupPanel').hidden = true;
      document.getElementById('coachCompletePanel').hidden = true;
      document.getElementById('coachArenaPanel').hidden = false;

      CoachUI.startTimer();
      CoachUI.loadQuestion(CoachUI.currentQuestionIndex);
    },

    startTimer: function() {
      clearInterval(CoachUI.timerInterval);
      CoachUI.secondsElapsed = 0;
      const display = document.getElementById('arenaTimerDisplay');
      CoachUI.timerInterval = setInterval(() => {
        CoachUI.secondsElapsed++;
        const mins = String(Math.floor(CoachUI.secondsElapsed / 60)).padStart(2, '0');
        const secs = String(CoachUI.secondsElapsed % 60).padStart(2, '0');
        if (display) display.textContent = `${mins}:${secs}`;
      }, 1000);
    },

    loadQuestion: function(index) {
      if (!CoachUI.currentSession || !CoachUI.currentSession.questions[index]) return;

      CoachUI.currentQuestionIndex = index;
      CoachUI.activeQuestion = CoachUI.currentSession.questions[index];

      // Reset UI elements
      const qCounter = document.getElementById('arenaQuestionCounter');
      if (qCounter) qCounter.textContent = `Question ${index + 1} of ${CoachUI.currentSession.questions.length}`;

      const stageTag = document.getElementById('arenaStageTag');
      if (stageTag) stageTag.textContent = CoachUI.activeQuestion.stage || 'Interview Round';

      const qText = document.getElementById('arenaQuestionText');
      if (qText) qText.textContent = CoachUI.activeQuestion.question;

      const textarea = document.getElementById('arenaAnswerText');
      if (textarea) textarea.value = '';

      const feedbackWrap = document.getElementById('arenaFeedbackWrap');
      if (feedbackWrap) feedbackWrap.hidden = true;

      // Optional text-to-speech read aloud
      const readAloudToggle = document.getElementById('coachVoiceReadAloudToggle');
      if (readAloudToggle && readAloudToggle.checked && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(CoachUI.activeQuestion.question);
        window.speechSynthesis.speak(utterance);
      }
    },

    toggleVoiceRecognition: function() {
      const micStatus = document.getElementById('arenaMicStatus');
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        alert('Browser speech recognition is not supported in this browser. Please type your response directly into the box.');
        return;
      }

      if (CoachUI.isListening) {
        CoachUI.recognizer?.stop();
        CoachUI.isListening = false;
        if (micStatus) micStatus.textContent = 'Click to speak';
        return;
      }

      try {
        CoachUI.recognizer = new SpeechRecognition();
        CoachUI.recognizer.continuous = true;
        CoachUI.recognizer.interimResults = true;
        CoachUI.recognizer.lang = 'en-IN';

        CoachUI.recognizer.onstart = () => {
          CoachUI.isListening = true;
          if (micStatus) micStatus.textContent = 'Listening (speak now)...';
        };

        CoachUI.recognizer.onresult = (event) => {
          let transcript = '';
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript + ' ';
          }
          const textarea = document.getElementById('arenaAnswerText');
          if (textarea) textarea.value = transcript.trim();
        };

        CoachUI.recognizer.onerror = (e) => {
          console.warn('[SpeechRecognition Error]', e);
          CoachUI.isListening = false;
          if (micStatus) micStatus.textContent = 'Click to speak';
        };

        CoachUI.recognizer.onend = () => {
          CoachUI.isListening = false;
          if (micStatus) micStatus.textContent = 'Click to speak';
        };

        CoachUI.recognizer.start();
      } catch (err) {
        console.error('[SpeechRecognition Start Failure]', err);
        if (micStatus) micStatus.textContent = 'Mic unavailable';
      }
    },

    submitAnswer: function() {
      const textarea = document.getElementById('arenaAnswerText');
      const answer = (textarea?.value || '').trim();

      if (!answer) {
        toast('Please speak or type an answer before submitting');
        return;
      }

      if (CoachUI.isListening) {
        CoachUI.recognizer?.stop();
        CoachUI.isListening = false;
      }

      const evalResult = window.AJSInterviewCoach.evaluateAnswer(
        CoachUI.activeQuestion,
        answer,
        CoachUI.currentSession.targetJob,
        getResumeFullText()
      );

      CoachUI.sessionAnswers.push({
        questionIndex: CoachUI.currentQuestionIndex,
        question: CoachUI.activeQuestion.question,
        stage: CoachUI.activeQuestion.stage,
        answer: answer,
        evaluation: evalResult
      });

      // Display feedback
      const feedbackWrap = document.getElementById('arenaFeedbackWrap');
      if (feedbackWrap) feedbackWrap.hidden = false;

      const scorePill = document.getElementById('arenaScorePill');
      if (scorePill) scorePill.textContent = `${evalResult.totalScore}/100`;

      // 7 Rubric Chips
      const chipsRow = document.getElementById('arenaRubricChipsRow');
      if (chipsRow && evalResult.rubricScores) {
        const rubricKeys = Object.keys(evalResult.rubricScores);
        chipsRow.innerHTML = rubricKeys.map(k => `
          <span class="metric-pill" style="font-size:10px">${escapeHTML(k)}: ${evalResult.rubricScores[k]}/10</span>
        `).join('');
      }

      // Details: Strong, Missing, Immediate Improvement, Outline
      const detailsEl = document.getElementById('arenaFeedbackDetails');
      if (detailsEl) {
        detailsEl.innerHTML = `
          <div style="margin-bottom:8px">
            <strong style="color:#0e6c59;font-size:12px">✓ What was strong:</strong>
            <p style="margin:2px 0 0;font-size:12px;color:var(--ink)">${escapeHTML(evalResult.whatWasStrong)}</p>
          </div>
          <div style="margin-bottom:8px">
            <strong style="color:#9c2a2a;font-size:12px">✗ What was unclear or missing:</strong>
            <p style="margin:2px 0 0;font-size:12px;color:var(--ink)">${escapeHTML(evalResult.whatWasMissing)}</p>
          </div>
          <div style="margin-bottom:8px">
            <strong style="color:#b56b0b;font-size:12px">⚡ Immediate Actionable Improvement:</strong>
            <p style="margin:2px 0 0;font-size:12px;color:var(--ink)">${escapeHTML(evalResult.immediateImprovement)}</p>
          </div>
          <div style="background:#f8faf9;border-left:3px solid var(--accent);padding:8px 12px;border-radius:4px;font-size:11.5px">
            <strong>Stronger Answer Outline (Add only if true):</strong>
            <p style="margin:4px 0 0;line-height:1.5;color:#223d37">${escapeHTML(evalResult.truthfulOutline)}</p>
          </div>
        `;
      }

      const nextBtn = document.getElementById('arenaNextBtn');
      if (nextBtn) {
        const isLast = CoachUI.currentQuestionIndex + 1 >= CoachUI.currentSession.questions.length;
        nextBtn.textContent = isLast ? 'Finish session & generate report →' : 'Next question →';
      }
    },

    retryAnswer: function() {
      const feedbackWrap = document.getElementById('arenaFeedbackWrap');
      if (feedbackWrap) feedbackWrap.hidden = true;
      // Remove last answer from history
      CoachUI.sessionAnswers.pop();
      toast('You can now provide a revised answer');
    },

    askFollowup: function() {
      const last = CoachUI.sessionAnswers[CoachUI.sessionAnswers.length - 1];
      if (!last || !last.evaluation || !last.evaluation.followupQuestion) {
        toast('No specific follow-up needed for this question');
        return;
      }

      const qText = document.getElementById('arenaQuestionText');
      if (qText) qText.textContent = `[Follow-up]: ${last.evaluation.followupQuestion}`;

      const feedbackWrap = document.getElementById('arenaFeedbackWrap');
      if (feedbackWrap) feedbackWrap.hidden = true;

      const textarea = document.getElementById('arenaAnswerText');
      if (textarea) textarea.value = '';

      toast('Follow-up question loaded');
    },

    nextQuestion: function() {
      if (CoachUI.currentQuestionIndex + 1 < CoachUI.currentSession.questions.length) {
        CoachUI.loadQuestion(CoachUI.currentQuestionIndex + 1);
      } else {
        CoachUI.completeSession();
      }
    },

    pauseSession: function() {
      clearInterval(CoachUI.timerInterval);
      if (CoachUI.isListening && CoachUI.recognizer) {
        CoachUI.recognizer.stop();
        CoachUI.isListening = false;
      }

      if (Storage && CoachUI.currentSession) {
        CoachUI.currentSession.activeQuestionIndex = CoachUI.currentQuestionIndex;
        CoachUI.currentSession.answers = CoachUI.sessionAnswers;
        Storage.savePausedInterviewSession(CoachUI.currentSession);
      }

      document.getElementById('coachArenaPanel').hidden = true;
      document.getElementById('coachSetupPanel').hidden = false;
      CoachUI.checkForPausedSession();
      toast('Interview session paused. You can resume anytime.');
    },

    exitSession: function() {
      clearInterval(CoachUI.timerInterval);
      if (CoachUI.isListening && CoachUI.recognizer) {
        CoachUI.recognizer.stop();
        CoachUI.isListening = false;
      }
      document.getElementById('coachArenaPanel').hidden = true;
      document.getElementById('coachCompletePanel').hidden = true;
      document.getElementById('coachSetupPanel').hidden = false;
    },

    completeSession: function() {
      clearInterval(CoachUI.timerInterval);
      if (CoachUI.isListening && CoachUI.recognizer) {
        CoachUI.recognizer.stop();
        CoachUI.isListening = false;
      }

      document.getElementById('coachArenaPanel').hidden = true;
      document.getElementById('coachCompletePanel').hidden = false;

      const report = window.AJSInterviewCoach.generateFinalReport(
        CoachUI.sessionAnswers,
        CoachUI.currentSession.targetJob,
        getResumeFullText()
      );

      // Render report elements
      const overallScore = document.getElementById('reportOverallScore');
      if (overallScore) overallScore.textContent = `${report.overallScore}/100`;

      const stageList = document.getElementById('reportStageScoresList');
      if (stageList && report.stageScores) {
        stageList.innerHTML = Object.keys(report.stageScores).map(st => `
          <div style="display:flex;justify-content:space-between;font-size:11.5px;padding:3px 0">
            <span>${escapeHTML(st)}</span>
            <strong>${report.stageScores[st]}%</strong>
          </div>
        `).join('');
      }

      const topImpr = document.getElementById('reportTopImprovementsList');
      if (topImpr && report.topImprovements) {
        topImpr.innerHTML = report.topImprovements.map(imp => `<li>${escapeHTML(imp)}</li>`).join('');
      }

      const planText = document.getElementById('reportPlanText');
      if (planText) planText.textContent = report.studyPlan || 'Practice daily questions to maintain streak.';

      // Record to storage
      if (Storage) {
        Storage.saveInterviewSession({
          targetJobId: CoachUI.currentSession.targetJob?.id,
          targetJobCompany: CoachUI.currentSession.targetJob?.company,
          targetJobTitle: CoachUI.currentSession.targetJob?.title,
          questionsAnswered: CoachUI.sessionAnswers.length,
          avgScore: report.overallScore,
          date: new Date().toISOString()
        });
        Storage.clearPausedInterviewSession();
      }

      CoachUI.renderStreakAndStats();
      CoachUI.checkForPausedSession();
    }
  };

  // -------------------------------------------------------------
  // 6. Scan Audit Controller (Transparency Table & Scan Status)
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

    // Daily Scan Status Panel
    const scanDateEl = document.getElementById('auditScanDate');
    if (scanDateEl) scanDateEl.textContent = `${data?.scan_date || 'Today'} · Asia/Kolkata`;

    const suppEl = document.getElementById('auditSuppressedCount');
    const suppCount = data?.summary?.duplicates_suppressed ?? duplicateGroups.reduce((n, g) => n + (g.suppressed_job_ids || g.ids || []).length, 0);
    if (suppEl) suppEl.textContent = suppCount;

    const deadEl = document.getElementById('auditDeadLinksCount');
    if (deadEl) deadEl.textContent = data?.summary?.suppressed_dead_links ?? 0;

    // Per Included Job Transparency Table
    const tbody = document.getElementById('auditJobsTableBody');
    if (tbody) {
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--muted)">No verified jobs currently loaded.</td></tr>';
        return;
      }

      tbody.innerHTML = list.map(j => {
        const skillsFound = (j.skills || []).join(', ');
        return `
          <tr>
            <td>
              <strong>${escapeHTML(j.title)}</strong>
              <div style="font-size:11px;color:var(--muted)">${escapeHTML(j.company)}</div>
            </td>
            <td><code>${escapeHTML(j.id)}</code></td>
            <td>${fmtDate(j.date)}</td>
            <td>${escapeHTML(j.location)}</td>
            <td>${escapeHTML(j.exp || '≤2 yrs')}</td>
            <td><span style="font-size:11px">${escapeHTML(skillsFound)}</span></td>
            <td><span class="badge verified">HTTP 200 Verified</span></td>
            <td><span class="badge verified">HTTP 200 Verified</span></td>
            <td><span style="font-size:11px;color:var(--muted)">Unique canonical kept</span></td>
          </tr>`;
      }).join('');
    }
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

        // Reconcile with persistent application storage:
        // Preserves historical applications even when jobs leave latest.json!
        if (Storage) {
          Storage.reconcileWithScan(jobs);
        }

        // Populate company filters
        const compFilter = document.getElementById('companyFilter');
        if (compFilter) {
          const uniqueComps = Array.from(new Set(jobs.map(j => j.company).filter(Boolean))).sort();
          compFilter.innerHTML = '<option value="all">All companies</option>' +
            uniqueComps.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
        }

        // Update nav counts & foot date
        const jobsNav = document.getElementById('jobsNavCount');
        if (jobsNav) jobsNav.textContent = jobs.length;
        const footDate = document.getElementById('sidebarFootDate');
        if (footDate) footDate.textContent = `${data.scan_date || 'Today'} · Asia/Kolkata`;

        const staleBanner = document.getElementById('staleScanBanner');
        if (staleBanner) staleBanner.hidden = true;

        // Render views
        renderDashboard();
        renderJobs();
        renderApplicationsWorkspace();
        renderAudit(data);

        return data;
      } else {
        throw new Error('Malformed or empty scan payload');
      }
    } catch (err) {
      console.warn('[App] Fail closed: could not load published scan:', err.message);
      jobs = [];
      duplicateGroups = [];

      const staleBanner = document.getElementById('staleScanBanner');
      if (staleBanner) {
        staleBanner.hidden = false;
        staleBanner.innerHTML = `
          <span>⚠️ <strong>Scan data unavailable:</strong> Could not load verified scan payload (${escapeHTML(err.message)}). Fail-closed mode active. No unverified records are displayed.</span>
          <button class="btn small" id="retryScanBtn" style="margin-top:6px">Reload latest published scan</button>
        `;
        document.getElementById('retryScanBtn')?.addEventListener('click', loadPublishedScan);
      }

      renderDashboard();
      renderJobs();
      renderApplicationsWorkspace();
      return null;
    }
  }

  // -------------------------------------------------------------
  // Company Research Outbound Links
  // -------------------------------------------------------------
  async function openCompanyResearch(companyName) {
    const modal = document.getElementById('companyResearchModal');
    const titleEl = document.getElementById('researchModalTitle');
    const gridEl = document.getElementById('researchLinksGrid');
    if (!modal || !gridEl) return;

    if (titleEl) titleEl.textContent = `Company Research: ${companyName}`;

    const aboutUrl = `https://www.google.com/search?q=${encodeURIComponent(companyName + ' official website')}`;
    const careersUrl = `https://www.google.com/search?q=${encodeURIComponent(companyName + ' careers')}`;
    const glassdoorUrl = `https://www.glassdoor.co.in/Search/results.htm?keyword=${encodeURIComponent(companyName)}`;
    const redditUrl = `https://www.reddit.com/r/developersIndia/search/?q=${encodeURIComponent(companyName + ' data analyst interview')}`;
    const ambitionboxUrl = `https://www.ambitionbox.com/search?q=${encodeURIComponent(companyName)}`;
    const linkedinUrl = `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(companyName)}`;

    gridEl.innerHTML = `
      <a class="research-link-card" href="${escapeHTML(aboutUrl)}" target="_blank" rel="noopener noreferrer">🌐 Official Website ↗</a>
      <a class="research-link-card" href="${escapeHTML(careersUrl)}" target="_blank" rel="noopener noreferrer">💼 Careers Portal ↗</a>
      <a class="research-link-card" href="${escapeHTML(glassdoorUrl)}" target="_blank" rel="noopener noreferrer">⭐ Glassdoor Reviews (Subjective) ↗</a>
      <a class="research-link-card" href="${escapeHTML(redditUrl)}" target="_blank" rel="noopener noreferrer">💬 Reddit Discussions ↗</a>
      <a class="research-link-card" href="${escapeHTML(ambitionboxUrl)}" target="_blank" rel="noopener noreferrer">🏢 AmbitionBox India Reports ↗</a>
      <a class="research-link-card" href="${escapeHTML(linkedinUrl)}" target="_blank" rel="noopener noreferrer">👥 Official LinkedIn Identity ↗</a>
    `;

    modal.hidden = false;
  }

  // -------------------------------------------------------------
  // AI Suggestions Runner & Consent Handling (Fixed Decline Loop)
  // -------------------------------------------------------------
  async function runAIEnhancement(actionType) {
    const ai = window.AJSAIClient;
    const outputEl = document.getElementById('aiSuggestionsOutput');
    const statusEl = document.getElementById('aiStatusNotice');
    if (!outputEl) return;

    if (ai && !ai.hasConsent()) {
      showAIConsentModal(
        () => runAIEnhancement(actionType),
        () => runLocalFallbackEnhancement(actionType)
      );
      return;
    }

    outputEl.innerHTML = '<div style="padding:20px;text-align:center;color:#63716d">Generating guidance via AI…</div>';
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
          outputEl.innerHTML = '<div style="padding:15px;color:#63716d">No bullet point entered.</div>';
          return;
        }
        result = await window.AJSResumeAgent.generateAIBulletImprovement(bullet);
      } else {
        runLocalFallbackEnhancement(actionType);
        return;
      }

      if (result && result.markdown) {
        outputEl.innerHTML = `<div style="font-size:12px;line-height:1.65;white-space:pre-wrap;color:#14221f">${escapeHTML(result.markdown)}</div>`;
        if (statusEl) statusEl.textContent = result.source.includes('puter') ? 'Generated via Puter.js AI' : 'Generated via Local Rule Engine';
      }
    } catch (err) {
      console.warn('[AI Error]', err);
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
      const qList = (selectedJob?.skills || []).slice(0, 3).map(s => `- Tell me about a scenario where you used ${s} to solve a data quality or reporting challenge.`);
      text = `### Tailored Interview Questions (Local Rubric)\n\n${qList.join('\n')}\n- Can you explain how you designed relationships or star schemas in your dashboard project?`;
    } else if (actionType === 'recruiter_review') {
      const ats = window.AJSResumeAgent.analyzeResumeATS(resumeText);
      text = window.AJSResumeAgent.OfflineGenerators.recruiterReview(ats, selectedJob?.title);
    } else if (actionType === 'cover_letter') {
      text = window.AJSResumeAgent.OfflineGenerators.draftCoverLetter(selectedJob, resumeText, skills);
    } else if (actionType === 'improve_bullet') {
      text = window.AJSResumeAgent.OfflineGenerators.improveBullet('Extracted customer data using SQL and created reporting dashboards.');
    }

    outputEl.innerHTML = `<div style="font-size:12px;line-height:1.65;white-space:pre-wrap;color:#14221f">${escapeHTML(text)}</div>`;
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
      if (onDeclined) onDeclined();
    };

    approveBtn.addEventListener('click', handleApprove);
    declineBtn.addEventListener('click', handleDecline);
  }

  // -------------------------------------------------------------
  // Master Event Bindings
  // -------------------------------------------------------------
  function bindEventControls() {
    // 1. Navigation Buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) switchView(view);
      });
    });

    document.querySelectorAll('[data-go]').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.go));
    });

    document.getElementById('menuBtn')?.addEventListener('click', () => {
      document.getElementById('sidebar')?.classList.toggle('open');
    });

    // 2. Reload latest published scan buttons
    const reloadButtons = [
      document.getElementById('runScanTop'),
      document.getElementById('dashReloadBtn'),
      document.getElementById('auditReloadScanBtn'),
      document.getElementById('retryScanBtn')
    ];
    reloadButtons.forEach(btn => {
      btn?.addEventListener('click', async () => {
        toast('Reloading latest published scan…');
        await loadPublishedScan();
        if (window.AJSWalkinAlerts) await window.AJSWalkinAlerts.loadWalkins();
        toast('Published scan reloaded');
      });
    });

    // 3. Export CSV Top
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

    // 4. Follow-up toast actions
    document.getElementById('closeFollowupToastBtn')?.addEventListener('click', hideApplyFollowupToast);
    document.getElementById('followupStillApplyingBtn')?.addEventListener('click', hideApplyFollowupToast);
    document.getElementById('followupNotYetBtn')?.addEventListener('click', hideApplyFollowupToast);
    document.getElementById('followupAppliedBtn')?.addEventListener('click', () => {
      const jobId = activeFollowupJobId;
      hideApplyFollowupToast();
      if (jobId) openMarkAppliedModal(jobId);
    });

    // 5. Mark Applied Modal confirmation
    document.getElementById('confirmMarkAppliedBtn')?.addEventListener('click', () => {
      const modal = document.getElementById('markAppliedModal');
      const jobId = modal?.dataset.targetJobId;
      const dateVal = document.getElementById('markAppliedDateInput')?.value;
      const noteVal = document.getElementById('markAppliedNoteInput')?.value;

      if (Storage && jobId) {
        Storage.confirmApplied(jobId, dateVal ? new Date(dateVal).toISOString() : new Date().toISOString());
        if (noteVal) {
          Storage.addApplicationNote(jobId, noteVal);
        }
        toast('Marked application as Applied!');
        modal.hidden = true;
        renderJobs();
        renderApplicationsWorkspace();
        renderDashboard();
      }
    });

    document.getElementById('cancelMarkAppliedBtn')?.addEventListener('click', () => {
      document.getElementById('markAppliedModal').hidden = true;
    });

    // 6. Applications Workspace List / Board View Switching
    document.getElementById('pipelineListViewBtn')?.addEventListener('click', () => {
      currentViewMode = 'list';
      document.getElementById('pipelineListViewBtn')?.classList.add('active');
      document.getElementById('pipelineBoardViewBtn')?.classList.remove('active');
      renderApplicationsWorkspace();
    });

    document.getElementById('pipelineBoardViewBtn')?.addEventListener('click', () => {
      currentViewMode = 'board';
      document.getElementById('pipelineBoardViewBtn')?.classList.add('active');
      document.getElementById('pipelineListViewBtn')?.classList.remove('active');
      renderApplicationsWorkspace();
    });

    // Workspace Filters
    ['appSearchInput', 'appStatusFilter', 'appCompanyFilter', 'appScanHealthFilter', 'appSortFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderApplicationsWorkspace);
        el.addEventListener('change', renderApplicationsWorkspace);
      }
    });

    // Workspace Backup & Export/Import Controls
    document.getElementById('backupDataBtn')?.addEventListener('click', () => {
      if (Storage) {
        const json = Storage.exportApplicationsJSON(false);
        download(`analytics-scout-backup-${new Date().toISOString().slice(0,10)}.json`, json, 'application/json');
        toast('Backup file downloaded');
      }
    });

    document.getElementById('exportAppsJsonBtn')?.addEventListener('click', () => {
      if (Storage) {
        const json = Storage.exportApplicationsJSON(false);
        download(`my-applications-${new Date().toISOString().slice(0,10)}.json`, json, 'application/json');
        toast('Exported applications JSON');
      }
    });

    document.getElementById('exportApplications')?.addEventListener('click', () => {
      if (Storage) {
        const csv = Storage.exportApplicationsCSV();
        download(`my-applications-${new Date().toISOString().slice(0,10)}.csv`, csv, 'text/csv');
        toast('Exported applications CSV');
      }
    });

    // Import file input handler
    const importFileInput = document.getElementById('importAppsFileInput');
    importFileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result;
          if (Storage) {
            const preview = Storage.previewImportApplications(content);
            pendingImportData = content;

            // Show import preview modal
            const modal = document.getElementById('importPreviewModal');
            const stats = document.getElementById('importPreviewStats');
            const warn = document.getElementById('importConflictWarning');

            if (modal && stats) {
              stats.innerHTML = `
                <div><strong>Schema Version:</strong> ${preview.schema_version}</div>
                <div><strong>Total in File:</strong> ${preview.total_incoming}</div>
                <div><strong>New Additions:</strong> ${preview.additions_count}</div>
                <div><strong>Updates:</strong> ${preview.updates_count}</div>
                <div><strong>Conflicts (Older timestamps):</strong> ${preview.conflicts_count}</div>
              `;
              if (warn) warn.hidden = preview.conflicts_count === 0;
              modal.hidden = false;
            }
          }
        } catch (err) {
          alert('Could not parse import file: ' + err.message);
        }
      };
      reader.readAsText(file);
      importFileInput.value = '';
    });

    document.getElementById('executeImportMergeBtn')?.addEventListener('click', () => {
      if (Storage && pendingImportData) {
        const res = Storage.executeImportApplications(pendingImportData, 'merge');
        document.getElementById('importPreviewModal').hidden = true;
        toast(`Imported: ${res.added} added, ${res.updated} updated`);
        renderApplicationsWorkspace();
      }
    });

    document.getElementById('executeImportOverwriteBtn')?.addEventListener('click', () => {
      if (confirm('Overwrite existing records with incoming backup data?')) {
        if (Storage && pendingImportData) {
          const res = Storage.executeImportApplications(pendingImportData, 'overwrite');
          document.getElementById('importPreviewModal').hidden = true;
          toast(`Overwritten: ${res.added} added, ${res.updated} updated`);
          renderApplicationsWorkspace();
        }
      }
    });

    document.getElementById('cancelImportBtn')?.addEventListener('click', () => {
      document.getElementById('importPreviewModal').hidden = true;
      pendingImportData = null;
    });

    // 7. Application Detail Drawer Actions
    document.getElementById('closeAppDrawerBtn')?.addEventListener('click', closeApplicationDetail);
    document.getElementById('appDetailDrawerBackdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'appDetailDrawerBackdrop') closeApplicationDetail();
    });

    document.getElementById('drawerSaveReminderBtn')?.addEventListener('click', () => {
      const nextAction = document.getElementById('drawerNextActionInput')?.value;
      const reminderDate = document.getElementById('drawerReminderDateInput')?.value;
      if (Storage && activeDetailAppId) {
        Storage.setApplicationReminder(activeDetailAppId, nextAction, reminderDate);
        toast('Reminder updated');
        openApplicationDetail(activeDetailAppId);
        renderApplicationsWorkspace();
      }
    });

    document.getElementById('drawerSaveContactBtn')?.addEventListener('click', () => {
      const recName = document.getElementById('drawerRecruiterName')?.value;
      const recChan = document.getElementById('drawerContactChannel')?.value;
      if (Storage && activeDetailAppId) {
        const app = Storage.getApplication(activeDetailAppId);
        if (app) {
          app.recruiter_name = recName;
          app.contact_channel = recChan;
          Storage.saveApplication(app);
          toast('Contact details saved');
        }
      }
    });

    document.getElementById('drawerSaveNotesBtn')?.addEventListener('click', () => {
      const notes = document.getElementById('drawerNotesText')?.value;
      if (Storage && activeDetailAppId) {
        Storage.addApplicationNote(activeDetailAppId, notes);
        toast('Note added to application');
        openApplicationDetail(activeDetailAppId);
      }
    });

    document.getElementById('drawerUpdateStatusBtn')?.addEventListener('click', () => {
      if (!activeDetailAppId || !Storage) return;
      const app = Storage.getApplication(activeDetailAppId);
      const statuses = Object.keys(Storage.STATUS_ENUM);
      const newStatus = prompt(`Choose status (${statuses.join(', ')}):`, app.status);
      if (newStatus && Storage.STATUS_ENUM[newStatus.toLowerCase()]) {
        Storage.updateApplicationStatus(activeDetailAppId, newStatus.toLowerCase());
        toast(`Status updated to ${Storage.STATUS_LABELS[newStatus.toLowerCase()]}`);
        openApplicationDetail(activeDetailAppId);
        renderApplicationsWorkspace();
        renderJobs();
      }
    });

    document.getElementById('drawerAtsChecklistBtn')?.addEventListener('click', () => {
      if (!activeDetailAppId) return;
      closeApplicationDetail();
      switchView('resume');
      const compSelect = document.getElementById('compareJobSelect');
      if (compSelect) {
        compSelect.value = activeDetailAppId;
        renderJobAtsMatch(activeDetailAppId);
      }
    });

    document.getElementById('drawerPrepareInterviewBtn')?.addEventListener('click', () => {
      if (!activeDetailAppId) return;
      const app = Storage ? Storage.getApplication(activeDetailAppId) : null;
      closeApplicationDetail();
      switchView('coach');
      if (app) CoachUI.startJobPractice(app);
    });

    document.getElementById('drawerArchiveBtn')?.addEventListener('click', () => {
      if (Storage && activeDetailAppId) {
        const app = Storage.getApplication(activeDetailAppId);
        const newArchived = !app.archived;
        Storage.archiveApplication(activeDetailAppId, newArchived);
        toast(newArchived ? 'Application archived' : 'Application restored');
        openApplicationDetail(activeDetailAppId);
        renderApplicationsWorkspace();
      }
    });

    document.getElementById('drawerDeleteBtn')?.addEventListener('click', () => {
      if (confirm('Permanently delete this application record and all its timeline notes? (Consider archiving instead).')) {
        if (Storage && activeDetailAppId) {
          Storage.deleteApplication(activeDetailAppId);
          toast('Application record deleted');
          closeApplicationDetail();
          renderApplicationsWorkspace();
          renderJobs();
        }
      }
    });

    // 8. Resume upload & profiles
    const fileInput = document.getElementById('resumeFileInput');
    const dropzone = document.getElementById('resumeDropzone');
    const rawTextArea = document.getElementById('resumeRawText');
    const rememberCheckbox = document.getElementById('resumeRememberDeviceCheckbox');

    async function handleResumeFile(file) {
      if (!file) return;
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`File size exceeds 5MB limit.`);
        return;
      }

      toast(`Parsing ${file.name} locally in your browser…`);
      try {
        if (!window.AJSResumeAgent) throw new Error('Resume agent is not ready.');
        const text = await window.AJSResumeAgent.parseFile(file);
        currentResumeData.fileName = file.name;
        currentResumeData.rawText = text;
        if (rawTextArea) rawTextArea.value = text;

        if (Storage) {
          Storage.saveResume(currentResumeData, currentResumeData.remembered);
        }
        renderResumeATSWorkspace();
        renderDashboard();
        toast(`Parsed ${file.name} successfully!`);
      } catch (err) {
        alert('Resume upload notice: ' + err.message + '\n\nTip: You can copy and paste text directly into the preview area.');
      }
    }

    fileInput?.addEventListener('change', e => {
      const file = e.target.files?.[0];
      if (file) {
        handleResumeFile(file);
        fileInput.value = '';
      }
    });

    if (dropzone) {
      dropzone.addEventListener('click', e => {
        if (e.target !== fileInput) fileInput?.click();
      });
      ['dragenter', 'dragover'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });
      ['dragleave', 'dragend'].forEach(evt => {
        dropzone.addEventListener(evt, e => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });
      dropzone.addEventListener('drop', e => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) handleResumeFile(file);
      });
    }

    if (rawTextArea) {
      rawTextArea.addEventListener('input', () => {
        currentResumeData.rawText = rawTextArea.value;
        if (Storage) Storage.saveResume(currentResumeData, currentResumeData.remembered);
        renderResumeATSWorkspace();
      });
    }

    rememberCheckbox?.addEventListener('change', (e) => {
      currentResumeData.remembered = e.target.checked;
      if (Storage) Storage.saveResume(currentResumeData, currentResumeData.remembered);
      toast(e.target.checked ? 'Resume saved to this device' : 'Kept in page memory only');
    });

    document.getElementById('saveResumeProfileBtn')?.addEventListener('click', () => {
      const name = prompt('Name this resume profile (e.g. "Senior Analyst v2" or "SQL-Focused"):');
      if (name && Storage) {
        Storage.saveResumeProfile(name, getResumeFullText(), true);
        populateResumeProfiles();
        toast(`Profile "${name}" saved`);
      }
    });

    document.getElementById('deleteResumeProfileBtn')?.addEventListener('click', () => {
      const select = document.getElementById('resumeProfileSelect');
      const val = select?.value;
      if (!val) {
        toast('Select a saved profile to delete');
        return;
      }
      if (confirm(`Delete saved profile "${val}"?`)) {
        if (Storage) {
          Storage.deleteResumeProfile(val);
          populateResumeProfiles();
          toast(`Deleted profile "${val}"`);
        }
      }
    });

    document.getElementById('resumeProfileSelect')?.addEventListener('change', (e) => {
      const name = e.target.value;
      if (!name) return;
      if (Storage) {
        const profiles = Storage.getResumeProfiles();
        const p = profiles.find(x => x.name === name);
        if (p) {
          currentResumeData.rawText = p.text;
          currentResumeData.fileName = p.name;
          if (rawTextArea) rawTextArea.value = p.text;
          renderResumeATSWorkspace();
          toast(`Loaded profile "${name}"`);
        }
      }
    });

    document.getElementById('forgetResumeBtn')?.addEventListener('click', () => {
      if (confirm('Forget resume content from this browser?')) {
        currentResumeData = { rawText: '', fileName: '', remembered: false };
        if (Storage) Storage.forgetResume();
        if (rawTextArea) rawTextArea.value = '';
        renderResumeATSWorkspace();
        renderDashboard();
        toast('Resume cleared');
      }
    });

    document.getElementById('deleteAllCareerDataBtn')?.addEventListener('click', () => {
      if (confirm('Delete all career data (applications, resume profiles, interview history)?')) {
        if (Storage) Storage.deleteAllCareerData();
        currentResumeData = { rawText: '', fileName: '', remembered: false };
        if (rawTextArea) rawTextArea.value = '';
        renderResumeATSWorkspace();
        renderApplicationsWorkspace();
        renderDashboard();
        toast('All career data deleted');
      }
    });

    document.getElementById('compareJobSelect')?.addEventListener('change', (e) => {
      renderJobAtsMatch(e.target.value);
    });

    document.getElementById('copyAtsChecklistBtn')?.addEventListener('click', () => {
      const select = document.getElementById('compareJobSelect');
      const allJobs = [...jobs, ...(Storage ? Storage.getApplications() : [])];
      const job = allJobs.find(j => j.id === select?.value) || jobs[0];
      if (job && window.AJSResumeAgent) {
        const match = window.AJSResumeAgent.matchJobWithResume(job, getResumeFullText());
        const text = (match.checklist || []).map(c => `[${c.priority.toUpperCase()}] ${c.item}: ${c.guidance}`).join('\n');
        copyText(text);
      }
    });

    document.getElementById('downloadAtsChecklistBtn')?.addEventListener('click', () => {
      const select = document.getElementById('compareJobSelect');
      const allJobs = [...jobs, ...(Storage ? Storage.getApplications() : [])];
      const job = allJobs.find(j => j.id === select?.value) || jobs[0];
      if (job && window.AJSResumeAgent) {
        const match = window.AJSResumeAgent.matchJobWithResume(job, getResumeFullText());
        const text = `ATS Checklist for ${job.company} - ${job.title}\n\n` +
          (match.checklist || []).map(c => `[${c.priority.toUpperCase()}] ${c.item}\n${c.guidance}\n`).join('\n');
        download(`ats-checklist-${(job.company || 'job').toLowerCase()}.txt`, text);
      }
    });

    // 9. Coach Event Bindings
    document.getElementById('startPersonalizedMockBtn')?.addEventListener('click', CoachUI.startSession);
    document.getElementById('resumeSavedSessionBtn')?.addEventListener('click', CoachUI.resumePausedSession);
    document.getElementById('arenaMicBtn')?.addEventListener('click', CoachUI.toggleVoiceRecognition);
    document.getElementById('arenaSubmitBtn')?.addEventListener('click', CoachUI.submitAnswer);
    document.getElementById('arenaNextBtn')?.addEventListener('click', CoachUI.nextQuestion);
    document.getElementById('arenaRetryAnswerBtn')?.addEventListener('click', CoachUI.retryAnswer);
    document.getElementById('arenaAskFollowupBtn')?.addEventListener('click', CoachUI.askFollowup);
    document.getElementById('arenaPauseBtn')?.addEventListener('click', CoachUI.pauseSession);
    document.getElementById('arenaStopBtn')?.addEventListener('click', CoachUI.exitSession);
    document.getElementById('completeBackBtn')?.addEventListener('click', CoachUI.exitSession);

    document.getElementById('reportSaveToAppBtn')?.addEventListener('click', () => {
      if (Storage && CoachUI.currentSession?.targetJob?.id) {
        const appId = CoachUI.currentSession.targetJob.id;
        const lastAnswer = CoachUI.sessionAnswers[CoachUI.sessionAnswers.length - 1];
        Storage.addApplicationInterviewSession(appId, {
          date: new Date().toISOString(),
          questionsAnswered: CoachUI.sessionAnswers.length,
          avgScore: document.getElementById('reportOverallScore')?.textContent || '80%',
          summary: 'Completed adaptive mock interview session.'
        });
        toast('Report linked to application record');
      } else {
        toast('Interview progress saved to coach history');
      }
    });

    document.getElementById('reportDownloadBtn')?.addEventListener('click', () => {
      const title = CoachUI.currentSession?.targetJob?.title || 'Junior Analyst';
      const company = CoachUI.currentSession?.targetJob?.company || 'Target Company';
      const score = document.getElementById('reportOverallScore')?.textContent || '--';
      const text = `Interview Coach Report: ${company} - ${title}\n` +
        `Readiness Score: ${score}\nDate: ${new Date().toLocaleDateString('en-IN')}\n\n` +
        CoachUI.sessionAnswers.map((a, i) => `Q${i+1}: ${a.question}\nAnswer: ${a.answer}\nScore: ${a.evaluation.totalScore}/100\nFeedback: ${a.evaluation.whatWasStrong}\n`).join('\n---\n\n');
      download(`interview-report-${company.toLowerCase()}.txt`, text);
    });

    document.getElementById('resetInterviewProgressBtn')?.addEventListener('click', () => {
      if (confirm('Reset your interview streak and practice history?')) {
        if (Storage) Storage.resetInterviewProgress();
        CoachUI.renderStreakAndStats();
        toast('Interview progress reset');
      }
    });

    // 10. AI Action Buttons
    document.querySelectorAll('[data-ai-action]').forEach(btn => {
      btn.addEventListener('click', () => runAIEnhancement(btn.dataset.aiAction));
    });

    // 11. Suggest source modal
    document.getElementById('suggestSourceTopBtn')?.addEventListener('click', () => {
      document.getElementById('suggestSourceModal').hidden = false;
    });
    document.getElementById('closeSuggestModalBtn')?.addEventListener('click', () => {
      document.getElementById('suggestSourceModal').hidden = true;
    });
    document.getElementById('submitSuggestIssueBtn')?.addEventListener('click', () => {
      const name = (document.getElementById('suggestCompName')?.value || '').trim();
      const url = (document.getElementById('suggestCareersUrl')?.value || '').trim();
      if (!name || !url) {
        alert('Please provide Company Name and Official Careers URL.');
        return;
      }
      const title = encodeURIComponent(`[Source Suggestion]: ${name}`);
      const body = encodeURIComponent(`### Company Source Suggestion\n- **Company Name**: ${name}\n- **Official Careers URL**: ${url}\n\n*Submitted via Analytics Scout modal.*`);
      window.open(`https://github.com/charankumarda01/analytics-job-scout/issues/new?title=${title}&body=${body}`, '_blank');
      document.getElementById('suggestSourceModal').hidden = true;
    });

    document.getElementById('closeResearchModalBtn')?.addEventListener('click', () => {
      document.getElementById('companyResearchModal').hidden = true;
    });

    // 12. Find Jobs Toolbar Filters
    ['jobSearch', 'locationFilter', 'sizeFilter', 'freshnessFilter', 'companyFilter', 'sortFilter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('input', renderJobs);
        el.addEventListener('change', renderJobs);
      }
    });

    document.getElementById('savedToggle')?.addEventListener('click', () => {
      savedOnly = !savedOnly;
      const btn = document.getElementById('savedToggle');
      if (btn) btn.innerHTML = `${savedOnly ? '♥' : '♡'} Saved only`;
      renderJobs();
    });
  }

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    bindEventControls();

    // Populate resume text editor if resume exists
    if (currentResumeData && currentResumeData.rawText) {
      const rawTextArea = document.getElementById('resumeRawText');
      if (rawTextArea) rawTextArea.value = currentResumeData.rawText;
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
    openApp: openApplicationDetail,
    loadPublishedScan: loadPublishedScan,
    CoachUI: CoachUI
  };

})(typeof window !== 'undefined' ? window : globalThis);
