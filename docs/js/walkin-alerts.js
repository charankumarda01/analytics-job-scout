/**
 * Analytics Job Scout v2 - Walk-in Alerts Controller
 * Official date-aware walk-in recruitment events, calendar .ics exports,
 * attending/saved state persistence, and in-app alert notifications.
 */
(function(window) {
  'use strict';

  let walkinsData = { events: [], total: 0 };
  let currentFilters = {
    city: 'all',
    size: 'all',
    status: 'all'
  };

  function escapeHTML(str) {
    return String(str ?? '').replace(/[&<>'"]/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[ch]));
  }

  function downloadFile(name, content, mimeType) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type: mimeType }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  }

  function buildEventICS(ev) {
    const dStr = (ev.event_date || '').replace(/-/g, '');
    const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Analytics Job Scout//Walk-in Alert//EN',
      'BEGIN:VEVENT',
      `UID:walkin-${ev.id}@analytics-job-scout`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Kolkata:${dStr}T093000`,
      `DTEND;TZID=Asia/Kolkata:${dStr}T160000`,
      `SUMMARY:${ev.company} - ${ev.title} Walk-in Drive`,
      `LOCATION:${ev.venue}, ${ev.city}`,
      `DESCRIPTION:${ev.title} at ${ev.company}\\nEligibility: ${ev.eligibility}\\nRegister: ${ev.registration_url}`,
      `URL:${ev.registration_url}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');
  }

  const WalkinAlerts = {
    init: async function() {
      await WalkinAlerts.loadWalkins();
      WalkinAlerts.bindFilterControls();
      WalkinAlerts.checkNewAlerts();
    },

    loadWalkins: async function() {
      try {
        const res = await fetch(`./data/walkins.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data && Array.isArray(data.events)) {
          walkinsData = data;
          WalkinAlerts.renderWalkins();
          WalkinAlerts.updateNavCount();
        }
      } catch (err) {
        console.warn('[WalkinAlerts] Could not load walkins.json:', err.message);
        // Fail closed: show clear unavailable message
        const listEl = document.getElementById('walkinsList');
        if (listEl) {
          listEl.innerHTML = '<div class="empty-state"><strong>No verified walk-ins available</strong>Check back during the daily 08:30 IST scan.</div>';
        }
      }
    },

    updateNavCount: function() {
      const badge = document.getElementById('walkinNavCount');
      if (badge) {
        badge.textContent = walkinsData.events.length;
      }
    },

    checkNewAlerts: function() {
      const storage = window.AJSStorage;
      if (!storage) return;

      const state = storage.getWalkinState();
      const seen = new Set(state.seenIds || []);
      const newEvents = walkinsData.events.filter(e => !seen.has(e.id));

      const banner = document.getElementById('walkinAlertBanner');
      if (banner) {
        if (newEvents.length > 0) {
          banner.hidden = false;
          banner.innerHTML = `
            <div class="walkin-new-alert">
              <span>🔔 <strong>${newEvents.length} new verified walk-in recruitment event${newEvents.length === 1 ? '' : 's'}</strong> posted today</span>
              <button class="btn small primary" id="viewNewWalkinsBtn">View walk-in alerts →</button>
            </div>
          `;
          document.getElementById('viewNewWalkinsBtn')?.addEventListener('click', () => {
            if (window.switchView) window.switchView('walkins');
          });
        } else {
          banner.hidden = true;
        }
      }
    },

    markEventsSeen: function() {
      const storage = window.AJSStorage;
      if (!storage) return;
      const state = storage.getWalkinState();
      const allIds = walkinsData.events.map(e => e.id);
      storage.saveWalkinState({ seenIds: Array.from(new Set([...(state.seenIds || []), ...allIds])) });
      const banner = document.getElementById('walkinAlertBanner');
      if (banner) banner.hidden = true;
    },

    renderWalkins: function() {
      const listEl = document.getElementById('walkinsList');
      if (!listEl) return;

      const storage = window.AJSStorage;
      const state = storage ? storage.getWalkinState() : { attending: [], saved: [], dismissed: [] };
      const attendingSet = new Set(state.attending || []);
      const savedSet = new Set(state.saved || []);
      const dismissedSet = new Set(state.dismissed || []);

      const filtered = walkinsData.events.filter(ev => {
        if (dismissedSet.has(ev.id)) return false;
        if (currentFilters.city !== 'all' && ev.city !== currentFilters.city) return false;
        if (currentFilters.size !== 'all' && (ev.company_size || 'Unknown') !== currentFilters.size) return false;
        if (currentFilters.status === 'attending' && !attendingSet.has(ev.id)) return false;
        if (currentFilters.status === 'saved' && !savedSet.has(ev.id)) return false;
        return true;
      });

      const countEl = document.getElementById('walkinsResultCount');
      if (countEl) countEl.textContent = `Showing ${filtered.length} verified walk-in event${filtered.length === 1 ? '' : 's'}`;

      if (!filtered.length) {
        if (!walkinsData.events || !walkinsData.events.length) {
          listEl.innerHTML = '<div class="empty-state"><strong>Zero Unverified Walk-ins Active</strong>All walk-ins require official recruitment verification. No unverified or generic links are displayed.</div>';
          return;
        }
        listEl.innerHTML = '<div class="empty-state"><strong>No verified walk-ins match your active filters</strong>Try clearing location or company size filters.</div>';
        return;
      }

      listEl.innerHTML = filtered.map(ev => {
        const isAttending = attendingSet.has(ev.id);
        const isSaved = savedSet.has(ev.id);
        const countdownClass = ev.countdown === 'Today' || ev.countdown === 'Tomorrow' ? 'urgent' : '';

        return `
          <article class="job-card walkin-card" id="walkin-${escapeHTML(ev.id)}">
            <div class="company-logo ${escapeHTML(ev.company.toLowerCase())}">${escapeHTML(ev.company[0])}</div>
            <div class="job-main">
              <div class="job-topline">
                <span class="badge countdown-badge ${countdownClass}">⏳ ${escapeHTML(ev.countdown || 'Upcoming')}</span>
                <span class="badge verified">✓ Official Event</span>
                <span class="badge" style="background:#e8f4fc;color:#185a9d">${escapeHTML(ev.city)}</span>
                ${isAttending ? '<span class="badge attending" style="background:#d4edda;color:#155724">✓ Attending</span>' : ''}
                ${isSaved ? '<span class="badge saved">♥ Saved</span>' : ''}
              </div>
              <h3>${escapeHTML(ev.title)} — ${escapeHTML(ev.company)}</h3>
              <div class="job-meta">
                <span><strong>Date:</strong> ${escapeHTML(ev.event_date)} (${escapeHTML(ev.time || '09:30 AM - 04:00 PM IST')})</span><span>•</span>
                <span><strong>Venue:</strong> ${escapeHTML(ev.venue)}</span><span>•</span>
                <span><strong>Experience:</strong> ${escapeHTML(ev.eligibility)}</span>
              </div>
              <p style="font-size:12px;color:var(--text);margin:6px 0">${escapeHTML(ev.instructions || 'Bring 2 copies of your updated resume, photo ID, and academic certificates.')}</p>
              <div class="chip-row">
                ${(ev.skills || []).map(s => `<span class="chip">${escapeHTML(s)}</span>`).join('')}
              </div>
            </div>
            <div class="job-actions">
              <a class="btn primary" href="${escapeHTML(ev.registration_url)}" target="_blank" rel="noopener noreferrer">Register / Apply officially ↗</a>
              <button class="btn" data-calendar-walkin="${escapeHTML(ev.id)}">📅 Add to calendar</button>
              <button class="btn ${isAttending ? 'active-green' : ''}" data-attending-walkin="${escapeHTML(ev.id)}">
                ${isAttending ? '✓ Attending' : 'Mark attending'}
              </button>
              <button class="btn" data-research-company="${escapeHTML(ev.company)}">🏢 Research company</button>
              <button class="btn save-btn ${isSaved ? 'saved' : ''}" data-save-walkin="${escapeHTML(ev.id)}">${isSaved ? '♥ Saved' : '♡ Save'}</button>
              <button class="btn small" data-dismiss-walkin="${escapeHTML(ev.id)}" title="Dismiss this event">✕ Dismiss</button>
            </div>
          </article>
        `;
      }).join('');

      WalkinAlerts.bindCardButtons();
    },

    bindCardButtons: function() {
      const storage = window.AJSStorage;
      if (!storage) return;

      // Calendar ICS download
      document.querySelectorAll('[data-calendar-walkin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.calendarWalkin;
          const ev = walkinsData.events.find(x => x.id === id);
          if (ev) {
            const ics = buildEventICS(ev);
            downloadFile(`walkin-${ev.company.toLowerCase()}-${ev.event_date}.ics`, ics, 'text/calendar');
            if (window.toast) window.toast('Downloaded calendar event (.ics)');
          }
        });
      });

      // Attending toggle
      document.querySelectorAll('[data-attending-walkin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.attendingWalkin;
          const state = storage.getWalkinState();
          let attending = state.attending || [];
          if (attending.includes(id)) {
            attending = attending.filter(x => x !== id);
            if (window.toast) window.toast('Removed from attending list');
          } else {
            attending.push(id);
            if (window.toast) window.toast('Marked as attending!');
          }
          storage.saveWalkinState({ attending: attending });
          WalkinAlerts.renderWalkins();
        });
      });

      // Save toggle
      document.querySelectorAll('[data-save-walkin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.saveWalkin;
          const state = storage.getWalkinState();
          let saved = state.saved || [];
          if (saved.includes(id)) {
            saved = saved.filter(x => x !== id);
            if (window.toast) window.toast('Removed from saved walk-ins');
          } else {
            saved.push(id);
            if (window.toast) window.toast('Walk-in event saved!');
          }
          storage.saveWalkinState({ saved: saved });
          WalkinAlerts.renderWalkins();
        });
      });

      // Dismiss event
      document.querySelectorAll('[data-dismiss-walkin]').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.dismissWalkin;
          const state = storage.getWalkinState();
          const dismissed = state.dismissed || [];
          if (!dismissed.includes(id)) dismissed.push(id);
          storage.saveWalkinState({ dismissed: dismissed });
          if (window.toast) window.toast('Walk-in event dismissed from this device');
          WalkinAlerts.renderWalkins();
        });
      });

      // Research company button
      document.querySelectorAll('[data-research-company]').forEach(btn => {
        btn.addEventListener('click', () => {
          const compName = btn.dataset.researchCompany;
          if (window.openCompanyResearch) window.openCompanyResearch(compName);
        });
      });
    },

    bindFilterControls: function() {
      document.getElementById('walkinCityFilter')?.addEventListener('change', e => {
        currentFilters.city = e.target.value;
        WalkinAlerts.renderWalkins();
      });

      document.getElementById('walkinSizeFilter')?.addEventListener('change', e => {
        currentFilters.size = e.target.value;
        WalkinAlerts.renderWalkins();
      });

      document.getElementById('walkinStatusFilter')?.addEventListener('change', e => {
        currentFilters.status = e.target.value;
        WalkinAlerts.renderWalkins();
      });

      document.getElementById('subscribeWalkinsBtn')?.addEventListener('click', () => {
        if ('Notification' in window) {
          Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
              if (window.toast) window.toast('Notifications enabled! You will be alerted to new walk-ins while the site is open.');
            } else {
              if (window.toast) window.toast('Notification permission was not granted.');
            }
          });
        } else {
          if (window.toast) window.toast('Browser notifications not supported.');
        }
      });
    }
  };

  window.AJSWalkinAlerts = WalkinAlerts;
})(typeof window !== 'undefined' ? window : globalThis);
