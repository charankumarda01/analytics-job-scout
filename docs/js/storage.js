/**
 * Analytics Job Scout v2 - Storage Manager
 * Namespaced, privacy-conscious local storage abstraction with quota protection,
 * schema versioning, durable application snapshots, and robust legacy migrations.
 */
(function(window) {
  'use strict';

  const PREFIX = 'ajs.v2.';
  const SCHEMA_VERSION = 3;

  const KEYS = {
    SCHEMA: PREFIX + 'schema_version',
    RESUME: PREFIX + 'resume',
    RESUME_PROFILES: PREFIX + 'resume_profiles',
    INTERVIEWS: PREFIX + 'interviews',
    PAUSED_INTERVIEW: PREFIX + 'paused_interview',
    SETTINGS: PREFIX + 'settings',
    PREFERENCES: PREFIX + 'preferences',
    SAVED_JOBS: PREFIX + 'saved_jobs',
    APPLICATIONS: PREFIX + 'applications',
    CHECKLIST: PREFIX + 'checklist',
    WALKINS: PREFIX + 'walkins'
  };

  // Canonical Application Statuses Enum
  const APPLICATION_STATUSES = [
    'saved',            // Saved for later
    'applying',         // Application in progress
    'applied',          // Applied
    'assessment',       // Assessment / online test
    'recruiter_screen', // Recruiter screening
    'interview',        // Interviewing
    'final_round',      // Final round
    'offer',            // Offer received
    'rejected',         // Not selected
    'withdrawn',        // Withdrawn
    'closed'            // Posting closed / outcome unknown
  ];

  const STATUS_LABELS = {
    saved: 'Saved for later',
    applying: 'Application in progress',
    applied: 'Applied',
    assessment: 'Assessment / online test',
    recruiter_screen: 'Recruiter screening',
    interview: 'Interviewing',
    final_round: 'Final round',
    offer: 'Offer received',
    rejected: 'Not selected',
    withdrawn: 'Withdrawn',
    closed: 'Posting closed / outcome unknown'
  };

  // In-memory resume store (never persisted unless user explicitly chooses 'Remember on this device')
  let memoryResume = null;

  function safeParse(str, fallback) {
    if (!str || typeof str !== 'string') return fallback;
    try {
      const parsed = JSON.parse(str);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (e) {
      console.warn('[Storage] Corrupted key encountered, returning fallback:', e);
      return fallback;
    }
  }

  /**
   * Timezone-safe local date helper for Asia/Kolkata (IST).
   * Guarantees consistent YYYY-MM-DD across midnight boundaries regardless of client system clock timezone.
   */
  function getLocalDateIST(dateInput) {
    try {
      const d = dateInput ? (dateInput instanceof Date ? dateInput : new Date(dateInput)) : new Date();
      if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      return formatter.format(d);
    } catch (e) {
      const d = dateInput ? new Date(dateInput) : new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  function makeCanonicalKey(company, reqId) {
    const c = String(company || '').trim().toLowerCase();
    const r = String(reqId || '').trim().toLowerCase();
    return `${c}::${r}`;
  }

  function normalizeStatus(rawStatus) {
    if (!rawStatus) return 'saved';
    const s = String(rawStatus).trim().toLowerCase().replace(/[\s-]+/g, '_');
    if (APPLICATION_STATUSES.includes(s)) return s;
    if (s === 'opened' || s === 'to_apply' || s === 'in_progress') return 'applying';
    if (s === 'submitted') return 'applied';
    if (s === 'hr' || s === 'screen' || s === 'recruiter') return 'recruiter_screen';
    if (s === 'test' || s === 'oa' || s === 'online_test') return 'assessment';
    if (s === 'interviewing' || s === 'interview_round' || s === 'interviewed') return 'interview';
    if (s === 'final' || s === 'final_round_interview') return 'final_round';
    if (s === 'offered') return 'offer';
    if (s === 'declined' || s === 'reject') return 'rejected';
    return 'saved';
  }

  const Storage = {
    PREFIX: PREFIX,
    KEYS: KEYS,
    SCHEMA_VERSION: SCHEMA_VERSION,
    APPLICATION_STATUSES: APPLICATION_STATUSES,
    STATUS_ENUM: APPLICATION_STATUSES.reduce((acc, s) => { acc[s] = s; return acc; }, {}),
    STATUS_LABELS: STATUS_LABELS,
    getLocalDateIST: getLocalDateIST,
    makeCanonicalKey: makeCanonicalKey,
    normalizeStatus: normalizeStatus,

    get: function(key, fallback) {
      try {
        const val = localStorage.getItem(key);
        return val !== null ? safeParse(val, fallback) : fallback;
      } catch (e) {
        console.warn('[Storage] Read error for key:', key, e);
        return fallback;
      }
    },

    set: function(key, value) {
      try {
        const payload = JSON.stringify(value);
        localStorage.setItem(key, payload);
        return true;
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          console.error('[Storage] LocalStorage quota exceeded. Pruning older interview logs...');
          Storage.pruneOldLogs();
          try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
          } catch (retryErr) {
            console.error('[Storage] Write failed after pruning:', retryErr);
            return false;
          }
        }
        console.error('[Storage] Write error:', e);
        return false;
      }
    },

    remove: function(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('[Storage] Remove error:', e);
      }
    },

    // ----------------------------------------------------
    // Resume Management & Profiles
    // ----------------------------------------------------
    getResume: function() {
      if (memoryResume) return memoryResume;
      const stored = Storage.get(KEYS.RESUME, null);
      if (stored && typeof stored === 'object' && stored.remembered) {
        memoryResume = stored;
        return stored;
      }
      return null;
    },

    saveResume: function(resumeData, rememberOnDevice) {
      resumeData = resumeData || {};
      resumeData.remembered = !!rememberOnDevice;
      resumeData.updatedAt = new Date().toISOString();

      // Enforce max text length (150KB / 150,000 chars) to prevent storage and memory blowout
      if (resumeData.rawText && typeof resumeData.rawText === 'string' && resumeData.rawText.length > 150000) {
        resumeData.rawText = resumeData.rawText.slice(0, 150000);
      }
      if (resumeData.text && typeof resumeData.text === 'string' && resumeData.text.length > 150000) {
        resumeData.text = resumeData.text.slice(0, 150000);
      }

      memoryResume = resumeData;

      if (rememberOnDevice) {
        const toPersist = Object.assign({}, resumeData);
        const ok = Storage.set(KEYS.RESUME, toPersist);
        if (!ok) {
          console.warn('[Storage] Could not persist resume to storage; keeping in memory only.');
          resumeData.remembered = false;
        }
      } else {
        Storage.remove(KEYS.RESUME);
      }
      return resumeData;
    },

    forgetResume: function() {
      memoryResume = null;
      Storage.remove(KEYS.RESUME);
    },

    getResumeProfiles: function() {
      const profiles = Storage.get(KEYS.RESUME_PROFILES, []);
      return Array.isArray(profiles) ? profiles : [];
    },

    saveResumeProfile: function(profileName, rawText, isDefault) {
      if (!profileName || !rawText) return null;
      const profiles = Storage.getResumeProfiles();
      const existingIdx = profiles.findIndex(p => p.name.toLowerCase() === profileName.trim().toLowerCase());
      const record = {
        name: profileName.trim(),
        rawText: rawText.slice(0, 150000),
        isDefault: !!isDefault,
        updatedAt: new Date().toISOString()
      };
      if (isDefault) {
        profiles.forEach(p => p.isDefault = false);
      }
      if (existingIdx >= 0) {
        profiles[existingIdx] = record;
      } else {
        profiles.push(record);
      }
      Storage.set(KEYS.RESUME_PROFILES, profiles);
      return record;
    },

    deleteResumeProfile: function(profileName) {
      let profiles = Storage.getResumeProfiles();
      profiles = profiles.filter(p => p.name.toLowerCase() !== profileName.trim().toLowerCase());
      Storage.set(KEYS.RESUME_PROFILES, profiles);
      return profiles;
    },

    // ----------------------------------------------------
    // Interview Progress & Streak
    // ----------------------------------------------------
    getInterviewData: function() {
      const defaultData = {
        streak: 0,
        lastActiveDate: '',
        sessionsCount: 0,
        questionsAnswered: 0,
        totalScoreSum: 0,
        totalScoresCount: 0,
        trackProgress: {},
        history: [],
        recentScores: []
      };
      const data = Storage.get(KEYS.INTERVIEWS, defaultData);
      if (!data || typeof data !== 'object') return defaultData;
      data.history = Array.isArray(data.history) ? data.history : [];
      data.recentScores = Array.isArray(data.recentScores) ? data.recentScores : [];
      data.trackProgress = (data.trackProgress && typeof data.trackProgress === 'object') ? data.trackProgress : {};
      return data;
    },

    getInterviewProgress: function() {
      const data = Storage.getInterviewData();
      return {
        streakDays: data.streak || 0,
        sessionsCompleted: data.sessionsCount || 0,
        questionsAnswered: data.questionsAnswered || 0,
        averageScore: data.totalScoresCount ? Math.round(data.totalScoreSum / data.totalScoresCount) : 0,
        history: data.history || []
      };
    },

    savePausedInterviewSession: function(session) {
      Storage.set(KEYS.PAUSED_INTERVIEW, session);
    },

    getPausedInterviewSession: function() {
      return Storage.get(KEYS.PAUSED_INTERVIEW, null);
    },

    clearPausedInterviewSession: function() {
      Storage.remove(KEYS.PAUSED_INTERVIEW);
    },

    addApplicationInterviewSession: function(jobId, sessionRecord) {
      return Storage.addInterviewSession(jobId, sessionRecord);
    },

    saveInterviewSession: function(sessionSummary) {
      const data = Storage.getInterviewData();
      const today = getLocalDateIST();

      if (!data.lastActiveDate) {
        data.streak = 1;
      } else if (data.lastActiveDate === today) {
        // Practiced today, retain streak
      } else {
        const last = new Date(data.lastActiveDate + 'T12:00:00+05:30');
        const curr = new Date(today + 'T12:00:00+05:30');
        const diffDays = Math.round((curr - last) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          data.streak = (data.streak || 0) + 1;
        } else if (diffDays > 1) {
          data.streak = 1;
        }
      }
      data.lastActiveDate = today;
      data.sessionsCount = (data.sessionsCount || 0) + 1;
      data.questionsAnswered = (data.questionsAnswered || 0) + (sessionSummary.questionsAnswered || 0);

      if (sessionSummary.avgScore && !isNaN(sessionSummary.avgScore)) {
        data.totalScoreSum = (data.totalScoreSum || 0) + sessionSummary.avgScore;
        data.totalScoresCount = (data.totalScoresCount || 0) + 1;
        data.recentScores = data.recentScores || [];
        data.recentScores.push(Math.round(sessionSummary.avgScore));
        if (data.recentScores.length > 20) data.recentScores.shift();
      }

      const trackId = sessionSummary.trackId || 'general';
      data.trackProgress = data.trackProgress || {};
      if (!data.trackProgress[trackId]) {
        data.trackProgress[trackId] = { answered: 0, avgScore: 0, sessions: 0 };
      }
      const t = data.trackProgress[trackId];
      t.answered = (t.answered || 0) + (sessionSummary.questionsAnswered || 0);
      t.sessions = (t.sessions || 0) + 1;
      if (sessionSummary.avgScore) {
        t.avgScore = Math.round(((t.avgScore * (t.sessions - 1)) + sessionSummary.avgScore) / t.sessions);
      }

      data.history = data.history || [];
      const targetJobId = sessionSummary.jobId || sessionSummary.targetJobId || null;
      const targetCompany = sessionSummary.company || sessionSummary.targetJobCompany || null;
      const targetTitle = sessionSummary.title || sessionSummary.targetJobTitle || null;

      const sessionRecord = {
        id: sessionSummary.id || ('sess_' + Date.now()),
        date: today,
        timestamp: new Date().toISOString(),
        trackId: trackId,
        trackName: sessionSummary.trackName || trackId,
        jobId: targetJobId,
        targetJobId: targetJobId,
        company: targetCompany,
        targetJobCompany: targetCompany,
        title: targetTitle,
        targetJobTitle: targetTitle,
        durationMinutes: sessionSummary.durationMinutes || 5,
        questionsAnswered: sessionSummary.questionsAnswered || 0,
        avgScore: Math.round(sessionSummary.avgScore || sessionSummary.overallScore || 0),
        overallScore: Math.round(sessionSummary.overallScore || sessionSummary.avgScore || 0),
        stageScores: sessionSummary.stageScores || {},
        reportSummary: sessionSummary.reportSummary || null
      };

      data.history.unshift(sessionRecord);
      if (data.history.length > 30) data.history.pop();

      Storage.set(KEYS.INTERVIEWS, data);

      // If associated with a target job or application, link session
      if (targetJobId) {
        Storage.addInterviewSession(targetJobId, sessionRecord);
      }

      return data;
    },

    pruneOldLogs: function() {
      const data = Storage.getInterviewData();
      if (data.history && data.history.length > 10) {
        data.history = data.history.slice(0, 10);
        Storage.set(KEYS.INTERVIEWS, data);
      }
    },

    resetInterviewProgress: function() {
      Storage.remove(KEYS.INTERVIEWS);
    },

    // ----------------------------------------------------
    // User Settings & Privacy
    // ----------------------------------------------------
    getSettings: function() {
      return Storage.get(KEYS.SETTINGS, {
        aiConsent: false,
        aiConsentDate: null,
        speechEnabled: true,
        speechRate: 1.0,
        rememberResumeDevice: false,
        followUpAlertDays: 7
      });
    },

    saveSettings: function(updates) {
      const current = Storage.getSettings();
      const merged = Object.assign({}, current, updates);
      Storage.set(KEYS.SETTINGS, merged);
      return merged;
    },

    // ----------------------------------------------------
    // Scan Preferences
    // ----------------------------------------------------
    getPreferences: function() {
      return Storage.get(KEYS.PREFERENCES, {
        roles: ['data-analyst', 'sql', 'power-bi', 'analytics', 'any-analyst', 'data-scientist'],
        locations: ['Hyderabad', 'Bengaluru', 'Chennai', 'Remote India'],
        types: ['jobs', 'internships']
      });
    },

    savePreferences: function(prefs) {
      const validRoles = ['data-analyst', 'sql', 'power-bi', 'analytics', 'any-analyst', 'data-scientist'];
      const validLocations = ['Hyderabad', 'Bengaluru', 'Chennai', 'Remote India'];
      const validTypes = ['jobs', 'internships'];

      const sanitized = {
        roles: Array.isArray(prefs.roles) ? prefs.roles.filter(r => validRoles.includes(r)) : validRoles,
        locations: Array.isArray(prefs.locations) ? prefs.locations.filter(l => validLocations.includes(l)) : validLocations,
        types: Array.isArray(prefs.types) ? prefs.types.filter(t => validTypes.includes(t)) : validTypes
      };
      Storage.set(KEYS.PREFERENCES, sanitized);
      return sanitized;
    },

    // ----------------------------------------------------
    // ATS Keyword Checklist State
    // ----------------------------------------------------
    getChecklist: function() {
      const checked = Storage.get(KEYS.CHECKLIST, []);
      return Array.isArray(checked) ? checked : [];
    },

    saveChecklist: function(checkedItems) {
      const arr = Array.isArray(checkedItems) ? checkedItems : [];
      Storage.set(KEYS.CHECKLIST, arr);
      return arr;
    },

    resetChecklist: function() {
      Storage.remove(KEYS.CHECKLIST);
    },

    // ----------------------------------------------------
    // Saved Jobs (Lightweight bookmarking list)
    // ----------------------------------------------------
    getSavedJobs: function() {
      const raw = Storage.get(KEYS.SAVED_JOBS, []);
      if (!Array.isArray(raw)) return [];
      return raw.map(item => {
        if (typeof item === 'string') return { id: item, title: 'Saved Role', company: 'Company' };
        if (item && typeof item === 'object') return item;
        return null;
      }).filter(Boolean);
    },

    saveJob: function(job) {
      const saved = Storage.getSavedJobs();
      const jobId = String(job.id || job.apply || '').trim();
      const exists = saved.some(j => (j.id && j.id === jobId) || (j.apply && j.apply === jobId));
      if (!exists) {
        saved.push({
          id: job.id || ('job_' + Date.now()),
          requisition_id: String(job.id || ''),
          title: job.title || 'Analytics Role',
          company: job.company || 'Company',
          location: job.location || 'India',
          apply: job.apply || job.apply_url || '#',
          savedAt: new Date().toISOString()
        });
        Storage.set(KEYS.SAVED_JOBS, saved);
      }
      // Also ensure application record exists with status 'saved' if not already tracked
      Storage.ensureApplicationFromJob(job, 'saved');
      return saved;
    },

    removeSavedJob: function(jobId) {
      let saved = Storage.getSavedJobs();
      saved = saved.filter(j => j.id !== jobId && j.apply !== jobId);
      Storage.set(KEYS.SAVED_JOBS, saved);
      return saved;
    },

    // ----------------------------------------------------
    // First-Class Applications Workspace & Durable Store
    // ----------------------------------------------------
    getApplications: function(options) {
      const opts = options || {};
      const raw = Storage.get(KEYS.APPLICATIONS, []);
      if (!Array.isArray(raw)) return [];
      let list = raw.filter(a => a && typeof a === 'object' && a.id).map(a => {
        // Guarantee bidirectional property availability across legacy & UI naming
        const applyUrl = a.official_apply_url || a.apply_url || a.apply || '#';
        const detailUrl = a.official_detail_url || a.detail_url || a.detail || a.apply_url || '#';
        const empType = a.employment_type || a.type || 'Full-time';
        const reminderDate = a.next_action_due_date || a.reminder_date || null;
        const recruiterContact = a.recruiter_contact || a.contact_channel || '';

        a.apply_url = applyUrl;
        a.official_apply_url = applyUrl;
        a.detail_url = detailUrl;
        a.official_detail_url = detailUrl;
        a.type = empType;
        a.employment_type = empType;
        a.reminder_date = reminderDate;
        a.next_action_due_date = reminderDate;
        a.contact_channel = recruiterContact;
        a.recruiter_contact = recruiterContact;
        return a;
      });

      if (!opts.includeArchived) {
        list = list.filter(a => !a.archived);
      }
      if (opts.status && opts.status !== 'all') {
        list = list.filter(a => a.status === opts.status);
      }
      if (opts.company && opts.company !== 'all') {
        list = list.filter(a => a.company === opts.company);
      }
      return list;
    },

    getApplication: function(idOrKey) {
      if (!idOrKey) return null;
      const apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      return apps.find(a =>
        a.id.toLowerCase() === targetStr ||
        ('app_' + String(a.requisition_id || '').toLowerCase()) === targetStr ||
        ('app_' + String(a.id || '').toLowerCase()) === targetStr ||
        (a.id.toLowerCase().replace(/^app_/, '')) === targetStr ||
        (a.canonical_key && a.canonical_key.toLowerCase() === targetStr) ||
        (a.requisition_id && a.requisition_id.toLowerCase() === targetStr) ||
        (a.official_apply_url && a.official_apply_url.toLowerCase() === targetStr) ||
        (a.apply_url && a.apply_url.toLowerCase() === targetStr) ||
        (a.official_detail_url && a.official_detail_url.toLowerCase() === targetStr) ||
        (a.detail_url && a.detail_url.toLowerCase() === targetStr)
      ) || null;
    },

    ensureApplicationFromJob: function(job, initialStatus) {
      if (!job) return null;
      const comp = String(job.company || 'Company').trim();
      const reqId = String(job.id || job.requisition_id || 'req_' + Date.now()).trim();
      const canonicalKey = makeCanonicalKey(comp, reqId);

      const apps = Storage.getApplications({ includeArchived: true });
      let existing = apps.find(a =>
        a.canonical_key === canonicalKey ||
        a.id === reqId ||
        a.id === ('app_' + reqId) ||
        (a.requisition_id && a.requisition_id === reqId) ||
        (a.official_apply_url && a.official_apply_url === (job.apply || job.apply_url))
      );

      const now = new Date().toISOString();
      const statusToUse = normalizeStatus(initialStatus || 'saved');
      const applyUrl = job.apply || job.apply_url || job.detail || '#';
      const detailUrl = job.detail || job.detail_url || job.apply || '#';
      const empType = job.type || job.employment_type || 'Full-time';

      if (!existing) {
        existing = {
          id: 'app_' + reqId,
          canonical_key: canonicalKey,
          requisition_id: reqId,
          company: comp,
          title: job.title || 'Analytics Opportunity',
          location: job.location || 'India',
          employment_type: empType,
          type: empType,
          official_detail_url: detailUrl,
          detail_url: detailUrl,
          official_apply_url: applyUrl,
          apply_url: applyUrl,
          link_status: 'live',
          last_link_checked_at: job.last_link_checked_at || now,
          date_saved: statusToUse === 'saved' ? now : null,
          official_link_opened_at: null,
          applied_date: null,
          last_updated_at: now,
          status: statusToUse,
          timeline: [
            {
              status: statusToUse,
              changed_at: now,
              note: statusToUse === 'saved' ? 'Saved opportunity to watchlist' : 'Created application entry'
            }
          ],
          next_action: statusToUse === 'saved' ? 'Review requirements & ATS checklist' : 'Prepare application submission',
          next_action_due_date: null,
          reminder_date: null,
          application_deadline: null,
          resume_version: 'Default Local Resume',
          ats_checklist: {
            checkedItems: [],
            notes: {},
            matchScore: 0,
            lastCheckedAt: null
          },
          interview_sessions: [],
          recruiter_name: '',
          recruiter_contact: '',
          contact_channel: '',
          notes: '',
          outcome_reason: '',
          archived: false,
          in_latest_scan: true
        };
        apps.unshift(existing);
      } else {
        // Non-destructive snapshot update
        existing.in_latest_scan = true;
        if (job.title && job.title !== existing.title) existing.title = job.title;
        if (job.location && job.location !== existing.location) existing.location = job.location;
        if (applyUrl && applyUrl !== '#') {
          existing.official_apply_url = applyUrl;
          existing.apply_url = applyUrl;
        }
        if (detailUrl && detailUrl !== '#') {
          existing.official_detail_url = detailUrl;
          existing.detail_url = detailUrl;
        }
        if (job.last_link_checked_at) existing.last_link_checked_at = job.last_link_checked_at;
      }

      Storage.set(KEYS.APPLICATIONS, apps);
      return existing;
    },

    /**
     * Save or update an application record.
     */
    saveApplication: function(appData) {
      if (!appData) return null;
      const apps = Storage.getApplications({ includeArchived: true });
      const targetId = String(appData.id || appData.requisition_id || '').toLowerCase().trim();
      const comp = String(appData.company || 'Unknown Company').trim();
      const reqId = String(appData.requisition_id || appData.id || '').trim();
      const canonicalKey = appData.canonical_key || makeCanonicalKey(comp, reqId || targetId);

      let existing = apps.find(a =>
        (targetId && (String(a.id).toLowerCase() === targetId || String(a.requisition_id || '').toLowerCase() === targetId || ('app_' + String(a.requisition_id || '').toLowerCase()) === targetId)) ||
        (a.canonical_key && a.canonical_key === canonicalKey)
      );

      const now = new Date().toISOString();
      const applyUrl = appData.official_apply_url || appData.apply_url || appData.apply || '#';
      const detailUrl = appData.official_detail_url || appData.detail_url || appData.detail || '#';
      const empType = appData.employment_type || appData.type || 'Full-time';
      const reminderDue = appData.next_action_due_date !== undefined ? appData.next_action_due_date : (appData.reminder_date !== undefined ? appData.reminder_date : null);
      const recContact = appData.recruiter_contact !== undefined ? appData.recruiter_contact : (appData.contact_channel !== undefined ? appData.contact_channel : '');

      if (!existing) {
        const status = normalizeStatus(appData.status || 'saved');
        existing = {
          id: String(appData.id || `app_${reqId || Date.now()}`),
          canonical_key: canonicalKey,
          requisition_id: reqId || String(appData.id || ''),
          company: comp,
          title: appData.title || 'Analytics Opportunity',
          location: appData.location || 'Bengaluru',
          employment_type: empType,
          type: empType,
          official_detail_url: detailUrl,
          detail_url: detailUrl,
          official_apply_url: applyUrl,
          apply_url: applyUrl,
          link_status: appData.link_status || 'live',
          last_link_checked_at: appData.last_link_checked_at || now,
          date_saved: appData.date_saved || (status === 'saved' ? now : null),
          official_link_opened_at: appData.official_link_opened_at || null,
          applied_date: appData.applied_date || (status === 'applied' ? now : null),
          last_updated_at: now,
          status: status,
          timeline: Array.isArray(appData.timeline) && appData.timeline.length ? appData.timeline : [
            {
              status: status,
              changed_at: now,
              note: appData.notes || `Created application with status: ${status}`
            }
          ],
          next_action: appData.next_action || (status === 'applied' ? 'Follow up with recruiter / team' : 'Review requirements & ATS checklist'),
          next_action_due_date: reminderDue,
          reminder_date: reminderDue,
          application_deadline: appData.application_deadline || null,
          resume_version: appData.resume_version || 'Default Local Resume',
          ats_checklist: appData.ats_checklist || { checkedItems: [], notes: {}, matchScore: 0, lastCheckedAt: null },
          interview_sessions: appData.interview_sessions || [],
          recruiter_name: appData.recruiter_name || '',
          recruiter_contact: recContact,
          contact_channel: recContact,
          notes: appData.notes || '',
          outcome_reason: appData.outcome_reason || '',
          archived: !!appData.archived,
          in_latest_scan: appData.in_latest_scan !== undefined ? appData.in_latest_scan : true
        };
        apps.unshift(existing);
      } else {
        if (appData.status && appData.status !== existing.status) {
          existing.status = normalizeStatus(appData.status);
          existing.timeline.unshift({
            status: existing.status,
            changed_at: now,
            note: appData.statusNote || `Updated status to ${existing.status}`
          });
        }
        if (appData.applied_date) existing.applied_date = appData.applied_date;
        if (appData.notes !== undefined) existing.notes = appData.notes;
        if (appData.next_action !== undefined) existing.next_action = appData.next_action;
        if (reminderDue !== null && reminderDue !== undefined) {
          existing.next_action_due_date = reminderDue;
          existing.reminder_date = reminderDue;
        }
        if (appData.recruiter_name !== undefined) existing.recruiter_name = appData.recruiter_name;
        if (recContact !== '') {
          existing.recruiter_contact = recContact;
          existing.contact_channel = recContact;
        }
        if (appData.outcome_reason !== undefined) existing.outcome_reason = appData.outcome_reason;
        if (appData.archived !== undefined) existing.archived = !!appData.archived;
        if (appData.title) existing.title = appData.title;
        if (appData.location) existing.location = appData.location;
        if (applyUrl && applyUrl !== '#') {
          existing.official_apply_url = applyUrl;
          existing.apply_url = applyUrl;
        }
        if (detailUrl && detailUrl !== '#') {
          existing.official_detail_url = detailUrl;
          existing.detail_url = detailUrl;
        }
        if (empType) {
          existing.employment_type = empType;
          existing.type = empType;
        }
        existing.last_updated_at = now;
      }

      Storage.set(KEYS.APPLICATIONS, apps);
      return existing;
    },

    setApplicationReminder: function(idOrKey, nextAction, dueDate) {
      const apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      const app = apps.find(a =>
        a.id.toLowerCase() === targetStr ||
        ('app_' + String(a.requisition_id || '').toLowerCase()) === targetStr ||
        (a.id.toLowerCase().replace(/^app_/, '')) === targetStr ||
        (a.canonical_key && a.canonical_key.toLowerCase() === targetStr) ||
        (a.requisition_id && a.requisition_id.toLowerCase() === targetStr)
      );
      if (!app) return null;

      const now = new Date().toISOString();
      if (nextAction !== undefined) app.next_action = nextAction;
      app.next_action_due_date = dueDate || null;
      app.reminder_date = dueDate || null;
      app.last_updated_at = now;

      app.timeline = app.timeline || [];
      app.timeline.unshift({
        status: app.status,
        changed_at: now,
        note: `Set reminder: ${nextAction || 'Next action'} (due: ${dueDate || 'no date'})`
      });

      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) apps[idx] = app;
      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    addApplicationNote: function(idOrKey, noteText) {
      if (!noteText || !String(noteText).trim()) return null;
      const apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      const app = apps.find(a =>
        a.id.toLowerCase() === targetStr ||
        ('app_' + String(a.requisition_id || '').toLowerCase()) === targetStr ||
        (a.id.toLowerCase().replace(/^app_/, '')) === targetStr ||
        (a.canonical_key && a.canonical_key.toLowerCase() === targetStr) ||
        (a.requisition_id && a.requisition_id.toLowerCase() === targetStr)
      );
      if (!app) return null;

      const now = new Date().toISOString();
      const trimmedNote = String(noteText).trim();
      if (app.notes) {
        app.notes = app.notes + '\n\n' + trimmedNote;
      } else {
        app.notes = trimmedNote;
      }
      app.last_updated_at = now;

      app.timeline = app.timeline || [];
      app.timeline.unshift({
        status: app.status,
        changed_at: now,
        note: trimmedNote
      });

      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) apps[idx] = app;
      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    updateApplicationContact: function(idOrKey, recruiterName, contactChannel) {
      const apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      const app = apps.find(a =>
        a.id.toLowerCase() === targetStr ||
        ('app_' + String(a.requisition_id || '').toLowerCase()) === targetStr ||
        (a.id.toLowerCase().replace(/^app_/, '')) === targetStr ||
        (a.canonical_key && a.canonical_key.toLowerCase() === targetStr) ||
        (a.requisition_id && a.requisition_id.toLowerCase() === targetStr)
      );
      if (!app) return null;

      const now = new Date().toISOString();
      if (recruiterName !== undefined) app.recruiter_name = recruiterName;
      if (contactChannel !== undefined) {
        app.recruiter_contact = contactChannel;
        app.contact_channel = contactChannel;
      }
      app.last_updated_at = now;

      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) apps[idx] = app;
      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    /**
     * Correct Apply Workflow:
     * When user clicks "Apply on official site", we record official_link_opened_at
     * and set status to 'applying' (if previously saved), but NEVER automatically mark applied.
     */
    recordApplyClick: function(job) {
      const app = Storage.ensureApplicationFromJob(job, 'applying');
      if (!app) return null;

      const now = new Date().toISOString();
      app.official_link_opened_at = now;
      app.last_updated_at = now;

      // If status is still 'saved', advance to 'applying'
      if (app.status === 'saved') {
        app.status = 'applying';
        app.timeline.unshift({
          status: 'applying',
          changed_at: now,
          note: 'Opened official application portal in browser'
        });
      }

      const apps = Storage.getApplications({ includeArchived: true });
      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) apps[idx] = app;
      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    /**
     * Mark an application as applied after user confirmation.
     */
    confirmApplied: function(idOrKey, customAppliedDate, note) {
      const apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      const app = apps.find(a =>
        a.id.toLowerCase() === targetStr ||
        (a.canonical_key && a.canonical_key.toLowerCase() === targetStr) ||
        (a.requisition_id && a.requisition_id.toLowerCase() === targetStr)
      );
      if (!app) return null;

      const now = new Date().toISOString();
      const appliedTimestamp = customAppliedDate ? new Date(customAppliedDate).toISOString() : now;

      app.status = 'applied';
      app.applied_date = appliedTimestamp;
      app.last_updated_at = now;
      app.next_action = 'Follow up with recruiter / team';
      app.next_action_due_date = Storage.getLocalDateIST(new Date(Date.now() + 7 * 86400000));

      app.timeline.unshift({
        status: 'applied',
        changed_at: appliedTimestamp,
        note: note || 'Confirmed application submission on official portal'
      });

      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    updateApplicationStatus: function(idOrKey, newStatus, note, extraUpdates) {
      const canonicalStatus = normalizeStatus(newStatus);
      const apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      const app = apps.find(a =>
        a.id.toLowerCase() === targetStr ||
        (a.canonical_key && a.canonical_key.toLowerCase() === targetStr) ||
        (a.requisition_id && a.requisition_id.toLowerCase() === targetStr)
      );
      if (!app) return null;

      const now = new Date().toISOString();
      app.status = canonicalStatus;
      app.last_updated_at = now;

      if (extraUpdates && typeof extraUpdates === 'object') {
        if (extraUpdates.next_action !== undefined) app.next_action = extraUpdates.next_action;
        if (extraUpdates.next_action_due_date !== undefined) app.next_action_due_date = extraUpdates.next_action_due_date;
        if (extraUpdates.notes !== undefined) app.notes = extraUpdates.notes;
        if (extraUpdates.outcome_reason !== undefined) app.outcome_reason = extraUpdates.outcome_reason;
        if (extraUpdates.recruiter_name !== undefined) app.recruiter_name = extraUpdates.recruiter_name;
        if (extraUpdates.recruiter_contact !== undefined) app.recruiter_contact = extraUpdates.recruiter_contact;
      }

      app.timeline = app.timeline || [];
      app.timeline.unshift({
        status: canonicalStatus,
        changed_at: now,
        note: note || `Updated status to ${STATUS_LABELS[canonicalStatus] || canonicalStatus}`
      });

      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    archiveApplication: function(idOrKey, isArchived) {
      const apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      const app = apps.find(a =>
        a.id.toLowerCase() === targetStr ||
        (a.canonical_key && a.canonical_key.toLowerCase() === targetStr)
      );
      if (!app) return null;

      app.archived = isArchived !== undefined ? !!isArchived : !app.archived;
      app.last_updated_at = new Date().toISOString();
      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    deleteApplication: function(idOrKey) {
      let apps = Storage.getApplications({ includeArchived: true });
      const targetStr = String(idOrKey).toLowerCase().trim();
      apps = apps.filter(a =>
        a.id.toLowerCase() !== targetStr &&
        (a.canonical_key || '').toLowerCase() !== targetStr &&
        (a.requisition_id || '').toLowerCase() !== targetStr &&
        a.id.toLowerCase() !== ('app_' + targetStr)
      );
      Storage.set(KEYS.APPLICATIONS, apps);
      return apps;
    },

    updateJobAtsChecklist: function(jobId, checklistState) {
      let app = Storage.getApplication(jobId);
      if (!app) {
        // If application doesn't exist yet, ensure application
        app = Storage.ensureApplicationFromJob({ id: jobId }, 'saved');
      }
      if (!app) return null;
      app.ats_checklist = Object.assign({}, app.ats_checklist || {}, checklistState, {
        lastCheckedAt: new Date().toISOString()
      });
      app.last_updated_at = new Date().toISOString();
      const apps = Storage.getApplications({ includeArchived: true });
      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) apps[idx] = app;
      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    addInterviewSession: function(jobId, sessionRecord) {
      let app = Storage.getApplication(jobId);
      if (!app) {
        // If not tracked yet, ensure application
        app = Storage.ensureApplicationFromJob({
          id: jobId,
          company: sessionRecord.company || sessionRecord.targetJobCompany || 'Target Company',
          title: sessionRecord.title || sessionRecord.targetJobTitle || 'Analytics Opportunity'
        }, 'interview');
      }
      if (!app) return null;
      app.interview_sessions = app.interview_sessions || [];
      app.interview_sessions.unshift(sessionRecord);
      app.last_updated_at = new Date().toISOString();
      const apps = Storage.getApplications({ includeArchived: true });
      const idx = apps.findIndex(a => a.id === app.id);
      if (idx >= 0) apps[idx] = app;
      Storage.set(KEYS.APPLICATIONS, apps);
      return app;
    },

    /**
     * Daily scan reconciliation:
     * Never erase application history!
     * Marks in_latest_scan true/false without deleting user's notes or timeline.
     */
    reconcileWithDailyScan: function(verifiedJobs) {
      const apps = Storage.getApplications({ includeArchived: true });
      const verifiedList = Array.isArray(verifiedJobs) ? verifiedJobs : [];

      const verifiedKeys = new Set(
        verifiedList.map(j => makeCanonicalKey(j.company, j.id || j.requisition_id))
      );
      const verifiedIds = new Set(
        verifiedList.map(j => String(j.id || '').trim().toLowerCase())
      );

      apps.forEach(app => {
        const hasKey = verifiedKeys.has(app.canonical_key);
        const hasId = verifiedIds.has((app.requisition_id || '').toLowerCase());
        app.in_latest_scan = hasKey || hasId;
      });

      Storage.set(KEYS.APPLICATIONS, apps);
      return apps;
    },

    reconcileWithScan: function(verifiedJobs) {
      return Storage.reconcileWithDailyScan(verifiedJobs);
    },

    getApplicationMetrics: function(verifiedJobs) {
      const s = Storage.getApplicationsStats(verifiedJobs);
      return {
        ...s,
        ready_to_apply: s.readyToApply,
        interviews: s.interviews,
        closed: s.closedRejected,
        followups_due: s.followUpsDue
      };
    },

    getApplicationsStats: function(verifiedJobs) {
      const allApps = Storage.getApplications({ includeArchived: false });
      const verifiedList = Array.isArray(verifiedJobs) ? verifiedJobs : [];
      const trackedCanonicalKeys = new Set(allApps.map(a => a.canonical_key));

      // Ready to apply = verified jobs from today's scan not yet tracked or only saved
      const readyToApply = verifiedList.filter(j => {
        const key = makeCanonicalKey(j.company, j.id);
        const app = allApps.find(a => a.canonical_key === key);
        return !app || app.status === 'saved';
      }).length;

      const counts = {
        readyToApply: readyToApply,
        saved: allApps.filter(a => a.status === 'saved').length,
        applying: allApps.filter(a => a.status === 'applying').length,
        applied: allApps.filter(a => a.status === 'applied').length,
        assessment: allApps.filter(a => a.status === 'assessment').length,
        interviews: allApps.filter(a => ['recruiter_screen', 'interview', 'final_round'].includes(a.status)).length,
        offers: allApps.filter(a => a.status === 'offer').length,
        closedRejected: allApps.filter(a => ['rejected', 'withdrawn', 'closed'].includes(a.status)).length,
        followUpsDue: 0
      };

      const today = getLocalDateIST();
      counts.followUpsDue = allApps.filter(a => {
        if (['rejected', 'withdrawn', 'closed', 'offer'].includes(a.status)) return false;
        if (a.next_action_due_date && a.next_action_due_date <= today) return true;
        if (a.status === 'applied' && a.applied_date) {
          const appliedDate = a.applied_date.slice(0, 10);
          const daysAgo = Math.round((new Date(today) - new Date(appliedDate)) / 86400000);
          if (daysAgo >= 7 && (!a.timeline || a.timeline.length <= 1)) return true;
        }
        return false;
      }).length;

      return counts;
    },

    getActionQueue: function(verifiedJobs, followUpDaysThreshold) {
      const apps = Storage.getApplications({ includeArchived: false });
      const threshold = followUpDaysThreshold || 7;
      const today = getLocalDateIST();
      const queue = [];

      apps.forEach(app => {
        // 1. Finish an application in progress
        if (app.status === 'applying') {
          const openedAt = app.official_link_opened_at ? app.official_link_opened_at.slice(0, 10) : 'recently';
          queue.push({
            id: `act_${app.id}_finish`,
            appId: app.id,
            company: app.company,
            title: app.title,
            actionTitle: `Finish applying to ${app.company}`,
            application: app,
            priority: 'high',
            urgency: 'high',
            type: 'finish_application',
            actionType: 'finish_application',
            reason: `Application portal opened on ${openedAt}. Complete and confirm submission to stay in the review cycle.`,
            actionLabel: 'Mark applied or Update',
            targetStatus: 'applied'
          });
        }

        // 2. Follow up after configurable number of days
        if (app.status === 'applied') {
          const appliedDay = app.applied_date ? app.applied_date.slice(0, 10) : today;
          const daysSince = Math.round((new Date(today) - new Date(appliedDay)) / 86400000);
          const isDue = (app.next_action_due_date && app.next_action_due_date <= today) || daysSince >= threshold;

          if (isDue) {
            queue.push({
              id: `act_${app.id}_followup`,
              appId: app.id,
              company: app.company,
              title: app.title,
              actionTitle: `Follow up with ${app.company}`,
              application: app,
              priority: 'medium',
              urgency: 'medium',
              type: 'follow_up',
              actionType: 'followup_due',
              reason: `Applied ${daysSince} days ago (${appliedDay}) with no recorded recruiter update. Reach out or check candidate portal.`,
              actionLabel: 'Log follow-up',
              targetStatus: 'applied'
            });
          }
        }

        // 3. Prepare for assessment or interview
        if (['assessment', 'recruiter_screen', 'interview', 'final_round'].includes(app.status)) {
          queue.push({
            id: `act_${app.id}_prep`,
            appId: app.id,
            company: app.company,
            title: app.title,
            actionTitle: `Prepare for ${STATUS_LABELS[app.status]} at ${app.company}`,
            application: app,
            priority: 'high',
            urgency: 'high',
            type: 'prepare_interview',
            actionType: 'interview_prep',
            reason: `Active interview process. Practice tailored role questions and sharpen your STAR project stories.`,
            actionLabel: 'Open Interview Coach',
            targetView: 'coach'
          });
        }

        // 4. Update a stale status (> 14 days without status update)
        if (!['rejected', 'withdrawn', 'closed', 'offer'].includes(app.status)) {
          const lastUpdate = app.last_updated_at ? app.last_updated_at.slice(0, 10) : today;
          const daysStale = Math.round((new Date(today) - new Date(lastUpdate)) / 86400000);
          if (daysStale >= 14) {
            queue.push({
              id: `act_${app.id}_stale`,
              appId: app.id,
              company: app.company,
              title: app.title,
              actionTitle: `Update stale status for ${app.company}`,
              application: app,
              priority: 'low',
              urgency: 'low',
              type: 'update_stale',
              actionType: 'update_stale',
              reason: `No timeline changes recorded in ${daysStale} days. Re-verify the posting or update stage.`,
              actionLabel: 'Update status',
              targetStatus: app.status
            });
          }
        }

        // 5. Recheck an official posting no longer in latest scan
        if (!app.in_latest_scan && !['rejected', 'withdrawn', 'closed'].includes(app.status)) {
          queue.push({
            id: `act_${app.id}_recheck`,
            appId: app.id,
            company: app.company,
            title: app.title,
            actionTitle: `Recheck posting for ${app.company}`,
            application: app,
            priority: 'medium',
            urgency: 'medium',
            type: 'recheck_posting',
            actionType: 'recheck_posting',
            reason: `Not in today’s verified scan (may have filled or aged past 15d window). Check if portal still accepts submissions.`,
            actionLabel: 'Check portal',
            openUrl: app.official_apply_url
          });
        }

        // 6. Improve low ATS match (< 70%)
        const atsScore = app.ats_checklist ? app.ats_checklist.matchScore : 0;
        if (atsScore > 0 && atsScore < 70 && ['saved', 'applying'].includes(app.status)) {
          queue.push({
            id: `act_${app.id}_ats`,
            appId: app.id,
            company: app.company,
            title: app.title,
            actionTitle: `Improve ATS match for ${app.company} (${atsScore}%)`,
            application: app,
            priority: 'medium',
            urgency: 'medium',
            type: 'improve_ats',
            actionType: 'improve_ats',
            reason: `Your resume matched ${atsScore}% of required keywords. Review missing keywords in the ATS checklist before submitting.`,
            actionLabel: 'Open ATS checklist',
            targetView: 'ats'
          });
        }
      });

      // Sort by high -> medium -> low priority
      const weight = { high: 1, medium: 2, low: 3 };
      queue.sort((a, b) => (weight[a.priority] || 9) - (weight[b.priority] || 9));
      return queue;
    },

    // ----------------------------------------------------
    // Export, Import & Backup
    // ----------------------------------------------------
    exportApplicationsJSON: function(includeRawResume) {
      const apps = Storage.getApplications({ includeArchived: true });
      const currentResume = Storage.getResume();
      let resumeSnippet = null;

      if (currentResume) {
        resumeSnippet = {
          fileName: currentResume.fileName || 'resume',
          updatedAt: currentResume.updatedAt,
          skills: currentResume.skills || [],
          rawText: includeRawResume ? (currentResume.rawText || currentResume.text || '') : undefined
        };
      }

      return {
        schema_version: SCHEMA_VERSION,
        exported_at: new Date().toISOString(),
        applications_count: apps.length,
        applications: apps,
        resume_profile: resumeSnippet,
        preferences: Storage.getPreferences(),
        settings: Storage.getSettings()
      };
    },

    exportApplicationsCSV: function() {
      const apps = Storage.getApplications({ includeArchived: true });
      const headers = [
        'Application ID',
        'Company',
        'Role Title',
        'Requisition ID',
        'Location',
        'Status',
        'Date Saved',
        'Date Applied',
        'Next Action',
        'Next Action Due',
        'Recruiter Name',
        'Recruiter Contact',
        'Official Apply URL',
        'Archived',
        'Notes'
      ];

      const rows = apps.map(a => [
        a.id,
        a.company,
        a.title,
        a.requisition_id,
        a.location,
        STATUS_LABELS[a.status] || a.status,
        a.date_saved || '',
        a.applied_date || '',
        a.next_action || '',
        a.next_action_due_date || '',
        a.recruiter_name || '',
        a.recruiter_contact || '',
        a.official_apply_url || '',
        a.archived ? 'Yes' : 'No',
        (a.notes || '').replace(/"/g, '""')
      ]);

      const csvLines = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell ?? '').replace(/\n/g, ' ')}"`).join(','))
      ];
      return csvLines.join('\r\n');
    },

    importApplicationsJSON: function(jsonString) {
      let data;
      try {
        data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      } catch (err) {
        return { success: false, error: 'Invalid JSON file: ' + err.message };
      }

      if (!data || typeof data !== 'object') {
        return { success: false, error: 'Empty or invalid backup payload' };
      }

      const importedApps = Array.isArray(data.applications) ? data.applications : [];
      const currentApps = Storage.getApplications({ includeArchived: true });
      const currentMap = new Map(currentApps.map(a => [a.canonical_key || a.id, a]));

      const preview = {
        success: true,
        schemaVersion: data.schema_version || 1,
        totalIncoming: importedApps.length,
        toAdd: [],
        toUpdate: [],
        conflicts: []
      };

      importedApps.forEach(item => {
        if (!item || !item.company || !item.title) return;
        const key = item.canonical_key || makeCanonicalKey(item.company, item.requisition_id || item.id);
        const existing = currentMap.get(key);

        if (!existing) {
          preview.toAdd.push(item);
        } else {
          // Check if there is conflict (different status or newer modification)
          const existingUpdated = new Date(existing.last_updated_at || 0).getTime();
          const incomingUpdated = new Date(item.last_updated_at || 0).getTime();

          if (existing.status !== item.status) {
            preview.conflicts.push({
              key: key,
              company: item.company,
              title: item.title,
              currentStatus: existing.status,
              incomingStatus: item.status,
              existingIsNewer: existingUpdated > incomingUpdated,
              existingRecord: existing,
              incomingRecord: item
            });
          } else {
            preview.toUpdate.push(item);
          }
        }
      });

      return preview;
    },

    commitImport: function(importPreview, overwriteNewerConflicts) {
      if (!importPreview || !importPreview.success) return false;
      const apps = Storage.getApplications({ includeArchived: true });
      const appMap = new Map(apps.map(a => [a.canonical_key || a.id, a]));

      // 1. Add new items
      (importPreview.toAdd || []).forEach(item => {
        const canonicalKey = item.canonical_key || makeCanonicalKey(item.company, item.requisition_id || item.id);
        item.canonical_key = canonicalKey;
        item.status = normalizeStatus(item.status);
        item.apply_url = item.official_apply_url || item.apply_url || item.apply || '#';
        item.official_apply_url = item.apply_url;
        item.detail_url = item.official_detail_url || item.detail_url || item.detail || item.apply_url;
        item.official_detail_url = item.detail_url;
        item.employment_type = item.employment_type || item.type || 'Full-time';
        item.type = item.employment_type;
        item.reminder_date = item.next_action_due_date || item.reminder_date || null;
        item.next_action_due_date = item.reminder_date;
        item.recruiter_contact = item.recruiter_contact || item.contact_channel || '';
        item.contact_channel = item.recruiter_contact;
        appMap.set(canonicalKey, item);
      });

      // 2. Update non-conflicting items
      (importPreview.toUpdate || []).forEach(item => {
        const key = item.canonical_key || makeCanonicalKey(item.company, item.requisition_id || item.id);
        const existing = appMap.get(key);
        if (existing) {
          Object.assign(existing, item, {
            timeline: [...(item.timeline || []), ...(existing.timeline || [])]
          });
          // deduplicate timeline
          const seen = new Set();
          existing.timeline = existing.timeline.filter(t => {
            const tk = `${t.status}_${t.changed_at}`;
            if (seen.has(tk)) return false;
            seen.add(tk);
            return true;
          });
        }
      });

      // 3. Resolve conflicts
      (importPreview.conflicts || []).forEach(conf => {
        const existing = appMap.get(conf.key);
        if (!existing) return;
        if (overwriteNewerConflicts || !conf.existingIsNewer) {
          Object.assign(existing, conf.incomingRecord);
        }
      });

      const mergedList = Array.from(appMap.values());
      Storage.set(KEYS.APPLICATIONS, mergedList);
      return true;
    },

    previewImportApplications: function(jsonStringOrObj) {
      const preview = Storage.importApplicationsJSON(jsonStringOrObj);
      if (!preview.success) throw new Error(preview.error || 'Failed to parse import');
      preview.schema_version = preview.schemaVersion || 3;
      preview.total_incoming = preview.totalIncoming || ((preview.toAdd ? preview.toAdd.length : 0) + (preview.toUpdate ? preview.toUpdate.length : 0) + (preview.conflicts ? preview.conflicts.length : 0));
      preview.additions_count = preview.toAdd ? preview.toAdd.length : 0;
      preview.updates_count = preview.toUpdate ? preview.toUpdate.length : 0;
      preview.conflicts_count = preview.conflicts ? preview.conflicts.length : 0;
      preview.raw = jsonStringOrObj;
      return preview;
    },

    executeImportApplications: function(contentOrPreview, mode) {
      let preview = contentOrPreview;
      if (typeof preview === 'string' || !preview.toAdd) {
        preview = Storage.previewImportApplications(contentOrPreview);
      }
      const overwrite = (mode === 'overwrite');
      const success = Storage.commitImport(preview, overwrite);
      const added = preview.toAdd ? preview.toAdd.length : 0;
      const updated = (preview.toUpdate ? preview.toUpdate.length : 0) + (overwrite && preview.conflicts ? preview.conflicts.length : 0);
      return { success, added, updated };
    },

    // ----------------------------------------------------
    // Walk-in Alerts State
    // ----------------------------------------------------
    getWalkinState: function() {
      return Storage.get(KEYS.WALKINS, {
        attending: [],
        saved: [],
        dismissed: [],
        seenIds: []
      });
    },

    saveWalkinState: function(updates) {
      const current = Storage.getWalkinState();
      const merged = Object.assign({}, current, updates);
      Storage.set(KEYS.WALKINS, merged);
      return merged;
    },

    // ----------------------------------------------------
    // Complete Data Cleanup
    // ----------------------------------------------------
    deleteAllCareerData: function() {
      memoryResume = null;
      Storage.remove(KEYS.RESUME);
      Storage.remove(KEYS.RESUME_PROFILES);
      Storage.remove(KEYS.INTERVIEWS);
      Storage.remove(KEYS.SETTINGS);
      Storage.remove(KEYS.PREFERENCES);
      Storage.remove(KEYS.SAVED_JOBS);
      Storage.remove(KEYS.APPLICATIONS);
      Storage.remove(KEYS.CHECKLIST);
      Storage.remove(KEYS.WALKINS);

      const legacyKeys = [
        'analytics-scout-saved',
        'analytics-scout-applications',
        'analytics-scout-checklist',
        'analytics-checklist',
        'analytics-scout-prefs',
        'analytics-preferences',
        'ajs_saved_jobs',
        'ajs_applications'
      ];
      legacyKeys.forEach(k => {
        try { localStorage.removeItem(k); } catch(e){}
      });
      return true;
    },

    // Auto-migration from legacy v1 & v2 keys to canonical v3 schema
    migrateLegacyData: function() {
      try {
        const currentVersion = Storage.get(KEYS.SCHEMA, 1);

        // 1. Saved jobs migration
        const legSaved = localStorage.getItem('analytics-scout-saved');
        if (legSaved) {
          const parsed = safeParse(legSaved, []);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const currentSaved = Storage.getSavedJobs();
            const normalized = parsed.map(item => {
              if (typeof item === 'string') return { id: item, title: 'Saved Role', company: 'Company' };
              if (item && typeof item === 'object') return item;
              return null;
            }).filter(Boolean);

            normalized.forEach(item => {
              if (!currentSaved.some(c => c.id === item.id)) currentSaved.push(item);
            });
            Storage.set(KEYS.SAVED_JOBS, currentSaved);
          }
        }

        // 2. Applications migration (object dictionary or array form)
        let apps = Storage.get(KEYS.APPLICATIONS, []);
        const legApps = localStorage.getItem('analytics-scout-applications');
        if (legApps && (!apps || apps.length === 0)) {
          const parsed = safeParse(legApps, null);
          if (parsed && typeof parsed === 'object') {
            apps = [];
            if (Array.isArray(parsed)) {
              parsed.forEach(item => {
                if (item && item.id) apps.push(item);
              });
            } else {
              Object.keys(parsed).forEach(id => {
                const item = parsed[id];
                if (item && typeof item === 'object') {
                  apps.push(Object.assign({ id: id }, item));
                }
              });
            }
          }
        }

        // Migrate every application to canonical schema version 3
        if (Array.isArray(apps) && apps.length > 0) {
          const now = new Date().toISOString();
          const migratedApps = apps.map(app => {
            const comp = String(app.company || 'Company').trim();
            const reqId = String(app.requisition_id || app.id || 'req_' + Date.now()).trim();
            const canonicalKey = app.canonical_key || makeCanonicalKey(comp, reqId);
            const canonicalStatus = normalizeStatus(app.status || 'applying');
            const appliedDate = app.applied_date || app.appliedAt || app.applied_at || (canonicalStatus === 'applied' ? now : null);

            let timeline = Array.isArray(app.timeline) ? app.timeline : [];
            if (!timeline.length) {
              timeline.push({
                status: canonicalStatus,
                changed_at: appliedDate || app.date_saved || now,
                note: `Migrated status: ${STATUS_LABELS[canonicalStatus] || canonicalStatus}`
              });
            }

            return {
              id: app.id || reqId,
              canonical_key: canonicalKey,
              requisition_id: reqId,
              company: comp,
              title: app.title || 'Analytics Role',
              location: app.location || 'India',
              employment_type: app.employment_type || app.type || 'Full-time',
              official_detail_url: app.official_detail_url || app.detail || app.apply_url || app.apply || '#',
              official_apply_url: app.official_apply_url || app.apply || app.apply_url || '#',
              link_status: app.link_status || 'live',
              last_link_checked_at: app.last_link_checked_at || null,
              date_saved: app.date_saved || app.savedAt || null,
              official_link_opened_at: app.official_link_opened_at || null,
              applied_date: appliedDate,
              last_updated_at: app.last_updated_at || now,
              status: canonicalStatus,
              timeline: timeline,
              next_action: app.next_action || (canonicalStatus === 'applied' ? 'Follow up with recruiter' : 'Review requirements'),
              next_action_due_date: app.next_action_due_date || null,
              application_deadline: app.application_deadline || null,
              resume_version: app.resume_version || 'Default Local Resume',
              ats_checklist: app.ats_checklist || { checkedItems: [], notes: {}, matchScore: 0, lastCheckedAt: null },
              interview_sessions: Array.isArray(app.interview_sessions) ? app.interview_sessions : [],
              recruiter_name: app.recruiter_name || '',
              recruiter_contact: app.recruiter_contact || '',
              notes: app.notes || '',
              outcome_reason: app.outcome_reason || '',
              archived: !!app.archived,
              in_latest_scan: app.in_latest_scan !== undefined ? !!app.in_latest_scan : true
            };
          });

          // Deduplicate by canonical key
          const dedupeMap = new Map();
          migratedApps.forEach(a => {
            const k = a.canonical_key;
            if (!dedupeMap.has(k)) {
              dedupeMap.set(k, a);
            } else {
              // merge
              const prev = dedupeMap.get(k);
              if (a.applied_date && !prev.applied_date) prev.applied_date = a.applied_date;
              if (a.status !== 'saved' && prev.status === 'saved') prev.status = a.status;
            }
          });

          Storage.set(KEYS.APPLICATIONS, Array.from(dedupeMap.values()));
        }

        // Set current schema version
        Storage.set(KEYS.SCHEMA, SCHEMA_VERSION);
      } catch (e) {
        console.warn('[Storage] Migration check warning:', e);
      }
    }
  };

  // Run migration on initial load
  Storage.migrateLegacyData();

  window.AJSStorage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
