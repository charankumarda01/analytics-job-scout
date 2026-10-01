/**
 * Unit tests for docs/js/storage.js
 */
const assert = require('assert');

// Mock localStorage in Node
const storageMap = new Map();
global.localStorage = {
  getItem: (k) => storageMap.has(k) ? storageMap.get(k) : null,
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear()
};
global.window = global;

require('../docs/js/storage.js');
const Storage = global.AJSStorage;

console.log('Running Storage tests...');

// 1. Storage capping test (rawText & text at 150KB)
const longText = 'A'.repeat(200000);
const savedResume = Storage.saveResume({ rawText: longText, text: longText, fileName: 'test.pdf' }, true);
const retrieved = Storage.getResume();
assert(retrieved !== null, 'Resume should be retrieved from storage');
assert(retrieved.rawText.length <= 150000, `rawText length should be capped at 150000, got ${retrieved.rawText.length}`);
assert(retrieved.text.length <= 150000, `text length should be capped at 150000, got ${retrieved.text.length}`);
console.log('✓ Storage 150KB capping passed');

// 2. Date helper in Asia/Kolkata timezone test
const sampleUtcMidnight = new Date('2026-10-01T19:00:00Z'); // 00:30 IST on Oct 2nd
const istDate = Storage.getLocalDateIST(sampleUtcMidnight);
assert.strictEqual(istDate, '2026-10-02', `UTC 19:00 should resolve to 2026-10-02 in IST, got ${istDate}`);
console.log('✓ Timezone-safe Asia/Kolkata date helper passed');

// 3. Legacy Saved Jobs migration test (string IDs and objects)
localStorage.setItem('analytics-scout-saved', JSON.stringify(['10565269', { id: 'AIOC-S01', title: 'Associate' }]));
Storage.migrateLegacyData();
const migratedSaved = Storage.getSavedJobs();
assert(migratedSaved.some(j => j.id === '10565269'), 'Should migrate string ID saved job to object form');
assert(migratedSaved.some(j => j.id === 'AIOC-S01'), 'Should preserve existing object saved job');
console.log('✓ Legacy saved jobs migration passed');

// 4. Legacy Applications migration test (dictionary form)
localStorage.setItem('analytics-scout-applications', JSON.stringify({
  '10565269': { company: 'Amazon', title: 'BIE I', applied_at: '2026-09-30' }
}));
Storage.migrateLegacyData();
const migratedApps = Storage.getApplications();
assert(migratedApps.some(a => a.id === '10565269'), 'Should migrate dictionary applications to array form');
assert.strictEqual(migratedApps.find(a => a.id === '10565269').status, 'Opened', 'Should default legacy app status safely');
console.log('✓ Legacy applications migration passed');

// 5. Memory-only resume test
Storage.saveResume({ rawText: 'Private text', fileName: 'private.pdf' }, false);
assert.strictEqual(localStorage.getItem(Storage.KEYS.RESUME), null, 'Unremembered resume must NOT exist in localStorage');
assert.strictEqual(Storage.getResume().rawText, 'Private text', 'Resume should remain in page memory');
console.log('✓ Memory-only resume retention passed');

console.log('All Storage tests passed successfully!');
