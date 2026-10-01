/**
 * Analytics Job Scout v2 - Storage Manager
 * Namespaced, privacy-conscious local storage abstraction with quota protection,
 * type validation, and robust legacy migration.
 */
(function(window) {
  'use strict';

  const PREFIX = 'ajs.v2.';
  const KEYS = {
    RESUME: PREFIX + 'resume',
    INTERVIEWS: PREFIX + 'interviews',
    SETTINGS: PREFIX + 'settings',
    PREFERENCES: PREFIX + 'preferences',
    SAVED_JOBS: PREFIX + 'saved_jobs',
    APPLICATIONS: PREFIX + 'applications',
    CHECKLIST: PREFIX + 'checklist',
    WALKINS: PREFIX + 'walkins'
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

  const Storage = {
    PREFIX: PREFIX,
    KEYS: KEYS,
    getLocalDateIST: getLocalDateIST,

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
    // Resume Management
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

    saveInterviewSession: function(sessionSummary) {
      const data = Storage.getInterviewData();
      const today = getLocalDateIST();

      // Streak calculation (Asia/Kolkata local calendar date aware)
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
          data.streak = 1; // Streak broken
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

      // Track-level stats
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

      // Add to recent history (cap at 30 items)
      data.history = data.history || [];
      data.history.unshift({
        id: 'sess_' + Date.now(),
        date: today,
        timestamp: new Date().toISOString(),
        trackId: trackId,
        trackName: sessionSummary.trackName || trackId,
        durationMinutes: sessionSummary.durationMinutes || 5,
        questionsAnswered: sessionSummary.questionsAnswered || 0,
        avgScore: sessionSummary.avgScore || 0
      });
      if (data.history.length > 30) data.history.pop();

      Storage.set(KEYS.INTERVIEWS, data);
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
        rememberResumeDevice: false
      });
    },

    saveSettings: function(updates) {
      const current = Storage.getSettings();
      const merged = Object.assign({}, current, updates);
      Storage.set(KEYS.SETTINGS, merged);
      return merged;
    },

    // ----------------------------------------------------
    // Scan Preferences (Roles, Locations, Types)
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
    // Saved Jobs & Applications (Preserved Semantics)
    // ----------------------------------------------------
    getSavedJobs: function() {
      const raw = Storage.get(KEYS.SAVED_JOBS, []);
      if (!Array.isArray(raw)) return [];
      // Normalize to array of objects
      return raw.map(item => {
        if (typeof item === 'string') return { id: item, title: 'Saved Role', company: 'Company' };
        if (item && typeof item === 'object') return item;
        return null;
      }).filter(Boolean);
    },

    saveJob: function(job) {
      const saved = Storage.getSavedJobs();
      const jobId = job.id || job.apply_url;
      const exists = saved.some(j => (j.id && j.id === jobId) || (j.apply_url && j.apply_url === jobId));
      if (!exists) {
        saved.push({
          id: job.id || 'job_' + Date.now(),
          title: job.title || 'Analytics Role',
          company: job.company || 'Company',
          location: job.location || 'India',
          apply: job.apply || job.apply_url || '#',
          savedAt: new Date().toISOString()
        });
        Storage.set(KEYS.SAVED_JOBS, saved);
      }
      return saved;
    },

    removeSavedJob: function(jobId) {
      let saved = Storage.getSavedJobs();
      saved = saved.filter(j => j.id !== jobId && j.apply_url !== jobId && j.apply !== jobId);
      Storage.set(KEYS.SAVED_JOBS, saved);
      return saved;
    },

    getApplications: function() {
      const raw = Storage.get(KEYS.APPLICATIONS, []);
      if (!Array.isArray(raw)) return [];
      return raw.filter(a => a && typeof a === 'object' && a.id);
    },

    recordApplication: function(job, status) {
      const apps = Storage.getApplications();
      const jobId = job.id || job.apply_url;
      const existingIdx = apps.findIndex(a => (a.id && a.id === jobId) || (a.apply_url && a.apply_url === jobId));
      const entryStatus = status || 'Opened'; // Default to 'Opened' or 'To apply', never assume submitted!

      const entry = {
        id: job.id || 'job_' + Date.now(),
        title: job.title || 'Data Analyst',
        company: job.company || 'Company',
        apply_url: job.apply || job.apply_url || '#',
        appliedAt: new Date().toISOString(),
        status: entryStatus
      };

      if (existingIdx >= 0) {
        // If already tracked, preserve user-set status unless explicitly updated
        if (status) entry.status = status;
        else entry.status = apps[existingIdx].status || 'Opened';
        apps[existingIdx] = entry;
      } else {
        apps.unshift(entry);
      }
      Storage.set(KEYS.APPLICATIONS, apps);
      return apps;
    },

    updateApplicationStatus: function(jobId, newStatus) {
      const apps = Storage.getApplications();
      const target = apps.find(a => a.id === jobId);
      if (target) {
        target.status = newStatus;
        target.updatedAt = new Date().toISOString();
        Storage.set(KEYS.APPLICATIONS, apps);
      }
      return apps;
    },

    removeApplication: function(jobId) {
      let apps = Storage.getApplications();
      apps = apps.filter(a => a.id !== jobId);
      Storage.set(KEYS.APPLICATIONS, apps);
      return apps;
    },

    // ----------------------------------------------------
    // Walk-in Alerts State
    // ----------------------------------------------------
    getWalkinState: function() {
      return Storage.get(KEYS.WALKINS, {
        attending: [], // array of walkin IDs
        saved: [],     // array of walkin IDs
        dismissed: [], // array of walkin IDs
        seenIds: []    // array of walkin IDs seen in browser
      });
    },

    saveWalkinState: function(updates) {
      const current = Storage.getWalkinState();
      const merged = Object.assign({}, current, updates);
      Storage.set(KEYS.WALKINS, merged);
      return merged;
    },

    // ----------------------------------------------------
    // Complete Career Data Cleanup & Export
    // ----------------------------------------------------
    deleteAllCareerData: function() {
      memoryResume = null;
      Storage.remove(KEYS.RESUME);
      Storage.remove(KEYS.INTERVIEWS);
      Storage.remove(KEYS.SETTINGS);
      Storage.remove(KEYS.PREFERENCES);
      Storage.remove(KEYS.SAVED_JOBS);
      Storage.remove(KEYS.APPLICATIONS);
      Storage.remove(KEYS.CHECKLIST);
      Storage.remove(KEYS.WALKINS);

      // Clean up legacy keys if present
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

    exportAllDataJSON: function() {
      return {
        exportedAt: new Date().toISOString(),
        version: 'v2.0',
        resume: Storage.getResume() ? {
          fileName: Storage.getResume().fileName,
          extractedLength: (Storage.getResume().rawText || Storage.getResume().text || '').length,
          updatedAt: Storage.getResume().updatedAt
        } : null,
        interviews: Storage.getInterviewData(),
        savedJobs: Storage.getSavedJobs(),
        applications: Storage.getApplications(),
        checklist: Storage.getChecklist(),
        walkins: Storage.getWalkinState(),
        preferences: Storage.getPreferences(),
        settings: Storage.getSettings()
      };
    },

    // Auto-migration from legacy v1 keys
    migrateLegacyData: function() {
      try {
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

            // Merge without duplicates
            normalized.forEach(item => {
              if (!currentSaved.some(c => c.id === item.id)) currentSaved.push(item);
            });
            Storage.set(KEYS.SAVED_JOBS, currentSaved);
          }
        }

        // 2. Applications migration (object dictionary or array form)
        const legApps = localStorage.getItem('analytics-scout-applications');
        if (legApps) {
          const parsed = safeParse(legApps, null);
          const currentApps = Storage.getApplications();
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed)) {
              parsed.forEach(item => {
                if (item && item.id && !currentApps.some(c => c.id === item.id)) {
                  currentApps.push({
                    id: item.id,
                    title: item.title || 'Data Analyst',
                    company: item.company || 'Company',
                    apply_url: item.apply_url || item.apply || '#',
                    appliedAt: item.appliedAt || item.applied_at || new Date().toISOString(),
                    status: item.status || 'Opened'
                  });
                }
              });
            } else {
              // Dictionary { "10565269": { "company": "Amazon", "title": "..." } }
              Object.keys(parsed).forEach(id => {
                const item = parsed[id];
                if (item && typeof item === 'object' && !currentApps.some(c => c.id === id)) {
                  currentApps.push({
                    id: id,
                    title: item.title || 'Data Analyst',
                    company: item.company || 'Company',
                    apply_url: item.apply_url || item.apply || '#',
                    appliedAt: item.appliedAt || item.applied_at || new Date().toISOString(),
                    status: item.status || 'Opened'
                  });
                }
              });
            }
            Storage.set(KEYS.APPLICATIONS, currentApps);
          }
        }

        // 3. Checklist migration
        const legChecklist = localStorage.getItem('analytics-scout-checklist') || localStorage.getItem('analytics-checklist');
        if (legChecklist && !localStorage.getItem(KEYS.CHECKLIST)) {
          const parsed = safeParse(legChecklist, []);
          if (Array.isArray(parsed)) {
            Storage.set(KEYS.CHECKLIST, parsed);
          }
        }

        // 4. Preferences migration
        const legPrefs = localStorage.getItem('analytics-scout-prefs') || localStorage.getItem('analytics-preferences');
        if (legPrefs && !localStorage.getItem(KEYS.PREFERENCES)) {
          const parsed = safeParse(legPrefs, null);
          if (parsed && typeof parsed === 'object') {
            Storage.savePreferences(parsed);
          }
        }
      } catch (e) {
        console.warn('[Storage] Migration check warning:', e);
      }
    }
  };

  // Run migration on initial load
  Storage.migrateLegacyData();

  window.AJSStorage = Storage;
})(typeof window !== 'undefined' ? window : globalThis);
