/**
 * Unit tests for docs/js/storage.js
 * Verifies schema versioning, canonical application status enum,
 * apply workflow (no auto-applied), timeline preservation, daily scan reconciliation,
 * duplicate merging, export/import round-trip, conflict previews, and quota management.
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

// 4. Legacy Applications migration test (migrates to canonical schema v3 and 'applying' status)
localStorage.setItem('analytics-scout-applications', JSON.stringify({
  '10565269': { company: 'Amazon', title: 'BIE I', applied_at: '2026-09-30' }
}));
Storage.migrateLegacyData();
const migratedApps = Storage.getApplications({ includeArchived: true });
assert(migratedApps.some(a => a.id === '10565269'), 'Should migrate dictionary applications to array form');
const migratedRecord = migratedApps.find(a => a.id === '10565269');
assert.strictEqual(migratedRecord.status, 'applying', 'Should map legacy unconfirmed application to canonical applying status');
assert(Array.isArray(migratedRecord.timeline) && migratedRecord.timeline.length > 0, 'Migration must initialize timeline');
console.log('✓ Legacy applications migration to canonical schema v3 passed');

// 5. Memory-only resume test
Storage.saveResume({ rawText: 'Private text', fileName: 'private.pdf' }, false);
assert.strictEqual(localStorage.getItem(Storage.KEYS.RESUME), null, 'Unremembered resume must NOT exist in localStorage');
assert.strictEqual(Storage.getResume().rawText, 'Private text', 'Resume should remain in page memory');
console.log('✓ Memory-only resume retention passed');

// 6. Apply click does NOT automatically mark applied
const testJob = {
  id: 'JOB_APPLY_TEST',
  company: 'Swiggy',
  title: 'Data Analyst',
  location: 'Bengaluru',
  apply: 'https://careers.swiggy.com/apply/123'
};
const applyRecord = Storage.recordApplyClick(testJob);
assert(applyRecord !== null, 'recordApplyClick must return an application record');
assert.strictEqual(applyRecord.status, 'applying', 'Apply click must record status as applying, NEVER applied');
assert(applyRecord.official_link_opened_at !== null, 'official_link_opened_at must be recorded');
assert.strictEqual(applyRecord.applied_date, null, 'applied_date must remain null until confirmed');
console.log('✓ Apply click tracks link opening without auto-marking applied');

// 7. Confirmed application creates timeline entry and updates status to 'applied'
const customAppliedTime = '2026-10-02T11:00:00+05:30';
const confirmedRecord = Storage.confirmApplied(applyRecord.id, customAppliedTime, 'User submitted via Swiggy portal');
assert.strictEqual(confirmedRecord.status, 'applied', 'Status must be applied after confirmation');
assert.strictEqual(confirmedRecord.applied_date, new Date(customAppliedTime).toISOString(), 'applied_date must match custom time');
assert(confirmedRecord.timeline.some(t => t.status === 'applied'), 'Timeline must include applied entry');
console.log('✓ Confirmed application creates timeline entry');

// 8. Every status transition persists in timeline
const allStatuses = ['assessment', 'recruiter_screen', 'interview', 'final_round', 'offer'];
for (const st of allStatuses) {
  Storage.updateApplicationStatus(confirmedRecord.id, st, `Advanced to ${st}`);
  const current = Storage.getApplication(confirmedRecord.id);
  assert.strictEqual(current.status, st, `Status should be updated to ${st}`);
  assert(current.timeline.some(t => t.status === st), `Timeline must record transition to ${st}`);
}
console.log('✓ Every canonical status transition persists with timeline');

// 9. Daily payload refresh preserves application history
const simulatedVerifiedJobsToday = [
  { id: 'NEW_JOB_TODAY', company: 'Accenture', title: 'BI Associate', location: 'Hyderabad' }
];
// Reconcile: our testJob is NOT in simulatedVerifiedJobsToday
Storage.reconcileWithDailyScan(simulatedVerifiedJobsToday);
const reconciledApp = Storage.getApplication(testJob.id);
assert(reconciledApp !== null, 'Application record must not be erased during daily scan');
assert.strictEqual(reconciledApp.in_latest_scan, false, 'Stale job must have in_latest_scan set to false');
assert.strictEqual(reconciledApp.status, 'offer', 'User application status must remain intact');
console.log('✓ Daily scan refresh preserves application history and flags not-in-scan jobs');

// 10. Duplicates merge by canonical requisition ID
const duplicateQueryJob = {
  id: 'JOB_APPLY_TEST',
  company: 'Swiggy',
  title: 'Data Analyst (Updated Query)',
  location: 'Bengaluru',
  apply: 'https://careers.swiggy.com/apply/123?utm_source=search'
};
Storage.ensureApplicationFromJob(duplicateQueryJob);
const allSwiggyApps = Storage.getApplications({ includeArchived: true }).filter(a => a.requisition_id === 'JOB_APPLY_TEST');
assert.strictEqual(allSwiggyApps.length, 1, 'Same requisition returned by another search must merge into canonical record');
console.log('✓ Duplicates merge by canonical requisition ID');

// 11. Export / Import round-trip and conflict preview
const exportedJson = Storage.exportApplicationsJSON(false);
assert.strictEqual(exportedJson.schema_version, 3, 'Export must declare schema version 3');
assert(exportedJson.applications.length > 0, 'Export must include application records');
assert.strictEqual(exportedJson.resume_profile?.rawText, undefined, 'Export must omit raw resume by default');

const importPreview = Storage.importApplicationsJSON(JSON.stringify(exportedJson));
assert.strictEqual(importPreview.success, true, 'Import preview must succeed');
assert.strictEqual(importPreview.toAdd.length, 0, 'Importing existing data should have 0 toAdd');
assert(importPreview.toUpdate.length > 0, 'Existing items should be identified in toUpdate');

// Conflict preview test: create an incoming modified record
const conflictingExport = JSON.parse(JSON.stringify(exportedJson));
conflictingExport.applications[0].status = 'rejected';
const conflictPreview = Storage.importApplicationsJSON(JSON.stringify(conflictingExport));
assert.strictEqual(conflictPreview.conflicts.length, 1, 'Conflict preview must detect status difference');
assert.strictEqual(conflictPreview.conflicts[0].incomingStatus, 'rejected');
console.log('✓ Export/import round-trip and conflict preview passed');

// 12. Deletion / Clear controls
const beforeDeleteCount = Storage.getApplications({ includeArchived: true }).length;
Storage.deleteApplication(testJob.id);
const afterDeleteCount = Storage.getApplications({ includeArchived: true }).length;
assert.strictEqual(afterDeleteCount, beforeDeleteCount - 1, 'deleteApplication must remove the record');
console.log('✓ Deletion control works cleanly');

// 13. previewImportApplications and executeImportApplications
const backupPayload = {
  schema_version: 3,
  applications: [
    {
      id: 'app_IMPORT_TEST_01',
      requisition_id: 'IMPORT_TEST_01',
      company: 'Amazon',
      title: 'Business Analyst I',
      location: 'Bengaluru',
      official_apply_url: 'https://amazon.jobs/apply/1',
      status: 'saved',
      timeline: []
    }
  ]
};
const pPreview = Storage.previewImportApplications(JSON.stringify(backupPayload));
assert.strictEqual(pPreview.schema_version, 3);
assert.strictEqual(pPreview.total_incoming, 1);
assert.strictEqual(pPreview.additions_count, 1);
const execResult = Storage.executeImportApplications(JSON.stringify(backupPayload), 'merge');
assert.strictEqual(execResult.success, true);
assert.strictEqual(execResult.added, 1);
const importedApp = Storage.getApplication('IMPORT_TEST_01');
assert(importedApp !== null, 'Imported app must exist in storage');
assert.strictEqual(importedApp.company, 'Amazon');
console.log('✓ previewImportApplications & executeImportApplications passed');

// 14. Reminders, notes, and recruiter contacts
Storage.setApplicationReminder('IMPORT_TEST_01', 'Follow up on referral', '2026-10-10');
let refreshedApp = Storage.getApplication('IMPORT_TEST_01');
assert.strictEqual(refreshedApp.next_action, 'Follow up on referral');
assert.strictEqual(refreshedApp.next_action_due_date, '2026-10-10');
assert.strictEqual(refreshedApp.reminder_date, '2026-10-10');

Storage.addApplicationNote('IMPORT_TEST_01', 'Spoke to recruiter on LinkedIn');
refreshedApp = Storage.getApplication('IMPORT_TEST_01');
assert(refreshedApp.notes.includes('Spoke to recruiter on LinkedIn'));
assert(refreshedApp.timeline.some(t => t.note === 'Spoke to recruiter on LinkedIn'));

Storage.updateApplicationContact('IMPORT_TEST_01', 'John Doe', 'john.doe@amazon.com');
refreshedApp = Storage.getApplication('IMPORT_TEST_01');
assert.strictEqual(refreshedApp.recruiter_name, 'John Doe');
assert.strictEqual(refreshedApp.recruiter_contact, 'john.doe@amazon.com');
assert.strictEqual(refreshedApp.contact_channel, 'john.doe@amazon.com');
console.log('✓ setApplicationReminder, addApplicationNote, and updateApplicationContact passed');

// 15. Bidirectional property normalization
assert(refreshedApp.apply_url && refreshedApp.official_apply_url, 'Both apply_url and official_apply_url must exist');
assert.strictEqual(refreshedApp.apply_url, refreshedApp.official_apply_url);
assert(refreshedApp.detail_url && refreshedApp.official_detail_url, 'Both detail_url and official_detail_url must exist');
assert.strictEqual(refreshedApp.detail_url, refreshedApp.official_detail_url);
assert(refreshedApp.type && refreshedApp.employment_type, 'Both type and employment_type must exist');
assert.strictEqual(refreshedApp.type, refreshedApp.employment_type);
console.log('✓ Bidirectional property normalization passed');

// 16. ATS checklist interactive persistence
Storage.updateJobAtsChecklist('IMPORT_TEST_01', {
  checkedItems: ['SQL', 'Tableau'],
  notes: { 'SQL': 'Completed LeetCode hard problems' },
  matchScore: 85
});
refreshedApp = Storage.getApplication('IMPORT_TEST_01');
assert.deepStrictEqual(refreshedApp.ats_checklist.checkedItems, ['SQL', 'Tableau']);
assert.strictEqual(refreshedApp.ats_checklist.notes['SQL'], 'Completed LeetCode hard problems');
assert.strictEqual(refreshedApp.ats_checklist.matchScore, 85);
console.log('✓ ATS checklist interactive persistence passed');

// 17. Interview session linked to target application
Storage.saveInterviewSession({
  targetJobId: 'IMPORT_TEST_01',
  targetJobCompany: 'Amazon',
  targetJobTitle: 'Business Analyst I',
  questionsAnswered: 5,
  avgScore: 90
});
refreshedApp = Storage.getApplication('IMPORT_TEST_01');
assert(Array.isArray(refreshedApp.interview_sessions), 'Application must have interview_sessions array');
assert.strictEqual(refreshedApp.interview_sessions.length, 1, 'Interview session must be linked to application');
assert.strictEqual(refreshedApp.interview_sessions[0].avgScore, 90);
assert.strictEqual(refreshedApp.interview_sessions[0].jobId, 'IMPORT_TEST_01');
console.log('✓ Interview session linked to application passed');

console.log('All Storage tests passed successfully!');
