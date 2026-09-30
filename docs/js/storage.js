/**
 * Analytics Job Scout v2 - Storage Manager
 * Namespaced, privacy-conscious local storage abstraction with quota protection and legacy migration.
 */
(function(window) {
  'use strict';

  const PREFIX = 'ajs.v2.';
  const KEYS = {
    RESUME: PREFIX + 'resume',
    INTERVIEWS: PREFIX + 'interviews',
    SETTINGS: PREFIX + 'settings',
    SAVED_JOBS: PREFIX + 'saved_jobs',
    APPLICATIONS: PREFIX + 'applications'
  };

  // In-memory resume store (never persisted unless user explicitly chooses 'Remember on this device')
  let memoryResume = null;

  function safeParse(str, fallback) {
    if (!str) return fallback;
    try {
      return JSON.parse(str);
    } catch (e) {
      console.warn('[Storage] Corrupted key encountered, returning fallback:', e);
      return fallback;
    }
  }

  function getLocalDateString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const Storage = {
    KEYS: KEYS,

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
      if (stored && stored.remembered) {
        memoryResume = stored;
        return stored;
      }
      return null;
    },

    saveResume: function(resumeData, rememberOnDevice) {
      resumeData = resumeData || {};
      resumeData.remembered = !!rememberOnDevice;
      resumeData.updatedAt = new Date().toISOString();
      memoryResume = resumeData;

      if (rememberOnDevice) {
        // Enforce max text length in storage to prevent quota blowout (cap at 150KB)
        const toPersist = Object.assign({}, resumeData);
        if (toPersist.text && toPersist.text.length > 150000) {
          toPersist.text = toPersist.text.slice(0, 150000);
        }
        Storage.set(KEYS.RESUME, toPersist);
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
        trackProgress: {}, // { [trackId]: { answered: number, avgScore: number } }
        history: [], // Recent 30 session summaries
        recentScores: [] // Last 20 answer scores for rolling average
      };
      return Storage.get(KEYS.INTERVIEWS, defaultData);
    },

    saveInterviewSession: function(sessionSummary) {
      const data = Storage.getInterviewData();
      const today = getLocalDateString();

      // Streak calculation (Local calendar date aware)
      if (!data.lastActiveDate) {
        data.streak = 1;
      } else if (data.lastActiveDate === today) {
        // Already practiced today, keep streak
      } else {
        const last = new Date(data.lastActiveDate);
        const curr = new Date(today);
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
    // Saved Jobs & Applications (Migrated & Preserved)
    // ----------------------------------------------------
    getSavedJobs: function() {
      return Storage.get(KEYS.SAVED_JOBS, []);
    },

    saveJob: function(job) {
      const saved = Storage.getSavedJobs();
      const exists = saved.some(j => (j.id && j.id === job.id) || (j.apply_url && j.apply_url === job.apply_url));
      if (!exists) {
        saved.push(job);
        Storage.set(KEYS.SAVED_JOBS, saved);
      }
      return saved;
    },

    removeSavedJob: function(jobId) {
      let saved = Storage.getSavedJobs();
      saved = saved.filter(j => j.id !== jobId && j.apply_url !== jobId);
      Storage.set(KEYS.SAVED_JOBS, saved);
      return saved;
    },

    getApplications: function() {
      return Storage.get(KEYS.APPLICATIONS, []);
    },

    recordApplication: function(job) {
      const apps = Storage.getApplications();
      const existingIdx = apps.findIndex(a => (a.id && a.id === job.id) || (a.apply_url && a.apply_url === job.apply_url));
      const entry = {
        id: job.id || 'job_' + Date.now(),
        title: job.title || 'Data Analyst',
        company: job.company || 'Company',
        apply_url: job.apply_url || '#',
        appliedAt: new Date().toISOString(),
        status: 'Applied'
      };
      if (existingIdx >= 0) {
        apps[existingIdx] = entry;
      } else {
        apps.unshift(entry);
      }
      Storage.set(KEYS.APPLICATIONS, apps);
      return apps;
    },

    // ----------------------------------------------------
    // Complete Career Data Cleanup & Export
    // ----------------------------------------------------
    deleteAllCareerData: function() {
      memoryResume = null;
      Storage.remove(KEYS.RESUME);
      Storage.remove(KEYS.INTERVIEWS);
      Storage.remove(KEYS.SETTINGS);
      Storage.remove(KEYS.SAVED_JOBS);
      Storage.remove(KEYS.APPLICATIONS);

      // Clean up legacy keys if present
      const legacyKeys = [
        'analytics-scout-saved',
        'analytics-scout-applications',
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
          extractedLength: (Storage.getResume().text || '').length,
          updatedAt: Storage.getResume().updatedAt
        } : null,
        interviews: Storage.getInterviewData(),
        savedJobs: Storage.getSavedJobs(),
        applications: Storage.getApplications(),
        settings: Storage.getSettings()
      };
    },

    // Auto-migration from legacy v1 keys
    migrateLegacyData: function() {
      try {
        // Saved jobs
        const legSaved = localStorage.getItem('analytics-scout-saved');
        if (legSaved && !localStorage.getItem(KEYS.SAVED_JOBS)) {
          const parsed = safeParse(legSaved, []);
          if (Array.isArray(parsed) && parsed.length > 0) {
            Storage.set(KEYS.SAVED_JOBS, parsed);
          }
        }
        // Applications
        const legApps = localStorage.getItem('analytics-scout-applications');
        if (legApps && !localStorage.getItem(KEYS.APPLICATIONS)) {
          const parsed = safeParse(legApps, []);
          if (Array.isArray(parsed) && parsed.length > 0) {
            Storage.set(KEYS.APPLICATIONS, parsed);
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
})(window);
