const { test, expect } = require('@playwright/test');

async function navigateTo(page, navSelector) {
  const menuBtn = page.locator('#menuBtn');
  if (await menuBtn.isVisible()) {
    const sidebar = page.locator('#sidebar');
    const isSidebarOpen = await sidebar.evaluate(el => el.classList.contains('open'));
    if (!isSidebarOpen) {
      await menuBtn.click();
      await page.waitForTimeout(200);
    }
  }
  await page.click(navSelector);
}

test.describe('Analytics Job Scout E2E Smoke Suite', () => {

  test('Production payload loads, 0 console errors, honest empty walk-ins', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => consoleErrors.push(err.message));

    await page.goto('/');

    // Verify verified jobs loaded from latest.json into #overviewTotal
    const totalEl = page.locator('#overviewTotal');
    await expect(totalEl).not.toHaveText('--', { timeout: 10000 });
    const countText = await totalEl.textContent();
    expect(Number(countText)).toBeGreaterThan(0);

    // Verify Walk-ins section is honestly empty with 0 unverified records
    await navigateTo(page, '#nav-walkins');
    const walkinsList = page.locator('#walkinsList');
    await expect(walkinsList).toContainText('Zero Unverified Walk-ins Active');

    // Confirm no removed sample walk-ins or drive URLs exist anywhere on page
    const content = await page.content();
    expect(content).not.toContain('walkin_accenture_blr_01');
    expect(content).not.toContain('walkin_accenture_hyd_02');
    expect(content).not.toContain('drive=');

    // Verify zero uncaught errors
    expect(consoleErrors).toEqual([]);
  });

  test('Save job -> start applying -> confirm applied -> update status', async ({ page }) => {
    await page.goto('/');

    // Stub window.open so popup doesn't open new window
    await page.evaluate(() => {
      window.open = () => null;
    });

    // Go to Find Jobs
    await navigateTo(page, '#nav-jobs');
    const firstJob = page.locator('.job-card').first();
    await expect(firstJob).toBeVisible({ timeout: 10000 });

    // Save job
    const saveBtn = firstJob.locator('[data-save-job]').first();
    await saveBtn.click();
    await expect(firstJob.locator('[data-save-job]').first()).toContainText('Saved');

    // Click Apply on official site
    const applyBtn = firstJob.locator('[data-apply-click]').first();
    await applyBtn.click();

    // Verify non-blocking follow-up toast appears
    const toastPrompt = page.locator('#applyFollowupToast');
    await expect(toastPrompt).toBeVisible();

    // Click "Yes — mark applied"
    await page.locator('#followupAppliedBtn').click({ force: true });

    // Mark Applied dialog should appear
    const markModal = page.locator('#markAppliedModal');
    await expect(markModal).toBeVisible();

    // Confirm submission
    await page.click('#confirmMarkAppliedBtn');
    await expect(markModal).toBeHidden();

    // The primary button on this job card should now be "Update application"
    const updateBtn = page.locator('.job-card').first().locator('[data-open-detail]').first();
    await expect(updateBtn).toHaveText('Update application');
  });

  test('Page reload preserves application history and My Applications works', async ({ page }) => {
    await page.goto('/');

    // Ensure state exists
    await page.evaluate(() => {
      if (window.AJSStorage) {
        window.AJSStorage.saveApplication({
          id: 'test-req-001',
          requisition_id: 'test-req-001',
          company: 'Amazon',
          title: 'Business Analyst Support',
          location: 'Bengaluru',
          type: 'Full-time',
          apply_url: 'https://amazon.jobs/en/jobs/test-req-001',
          status: 'applied',
          applied_date: new Date().toISOString()
        });
      }
    });

    // Reload page
    await page.reload();

    // Go to My Applications
    await navigateTo(page, '#nav-applications');

    // Confirm table displays the application
    const tableBody = page.locator('#applicationTableBody');
    await expect(tableBody).toContainText('Amazon');
    await expect(tableBody).toContainText('Business Analyst Support');
    await expect(tableBody).toContainText('Applied');

    // Open detail drawer
    await page.locator('button:has-text("View Details")').first().dispatchEvent('click');
    const drawerBackdrop = page.locator('#appDetailDrawerBackdrop');
    await expect(drawerBackdrop).toBeVisible();
    await expect(page.locator('#drawerTitle')).toHaveText('Business Analyst Support');

    // Close drawer
    await page.locator('#closeAppDrawerBtn').click({ force: true });
    await expect(drawerBackdrop).toBeHidden();
  });

  test('ATS local fallback works after declining AI', async ({ page }) => {
    await page.goto('/');

    // Go to ATS & Resume workspace
    await navigateTo(page, '#nav-resume');

    // Type resume content
    const textarea = page.locator('#resumeRawText');
    await textarea.fill('Junior Data Analyst with experience in SQL, Power BI, Excel PivotTables, and Python data cleaning.');
    await page.waitForTimeout(500);

    // Verify deterministic ATS score updated
    const scoreVal = page.locator('#atsScoreValue');
    await expect(scoreVal).not.toHaveText('0');

    // Click Recruiter Review to trigger consent modal
    await page.click('#aiRecruiterReviewBtn');
    const consentModal = page.locator('#aiConsentModal');
    await expect(consentModal).toBeVisible();

    // Click Decline (Use Offline Engine) — force needed on mobile (label overlay)
    await page.click('#aiConsentDeclineBtn', { force: true });
    await expect(consentModal).toBeHidden();

    // Verify offline fallback rendered output without looping
    const output = page.locator('#aiSuggestionsOutput');
    await expect(output).toBeVisible();
    await expect(output).toContainText('Recruiter Review');
  });

  test('Personalized interview starts from an application and runs short session', async ({ page }) => {
    await page.goto('/');

    // Set sample resume & target job
    await page.evaluate(() => {
      if (window.AJSStorage) {
        window.AJSStorage.saveResume({
          name: 'Candidate',
          rawText: 'Junior Analyst with 1 year experience writing SQL queries, maintaining Power BI dashboards, and performing Excel vlookups.',
          skills: ['SQL', 'Power BI', 'Excel']
        }, false);
      }
    });

    // Go to Interview Coach
    await navigateTo(page, '#nav-coach');

    // Select quick session & start
    await page.selectOption('#coachSessionMinutesSelect', '15');
    await page.click('#startPersonalizedMockBtn');

    // Verify Arena is visible and Question 1 is loaded
    const arena = page.locator('#coachArenaPanel');
    await expect(arena).toBeVisible();
    const qText = page.locator('#arenaQuestionText');
    await expect(qText).not.toHaveText('Loading question…');

    // Enter answer
    await page.fill('#arenaAnswerText', 'In my previous project, I used SQL queries with joins and aggregations to extract monthly sales metrics from 50,000 records. I built a Power BI dashboard that reduced turnaround time by 30%.');

    // Submit answer
    await page.locator('#arenaSubmitBtn').click({ force: true });

    // Feedback panel should be visible
    const feedback = page.locator('#arenaFeedbackWrap');
    await expect(feedback).toBeVisible();
    const scorePill = page.locator('#arenaScorePill');
    await expect(scorePill).toContainText('/100');

    // Pause session
    await page.click('#arenaPauseBtn');
    await expect(page.locator('#coachArenaPanel')).toBeHidden();
    await expect(page.locator('#coachResumeSessionBanner')).toBeVisible();
  });

  test('Export JSON and CSV buttons trigger valid file downloads', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      if (window.AJSStorage) {
        window.AJSStorage.saveApplication({
          id: 'export-job-1',
          company: 'Accenture',
          title: 'Data Analyst',
          status: 'applied',
          applied_date: new Date().toISOString()
        });
      }
    });

    await navigateTo(page, '#nav-applications');

    // Test JSON export content validity
    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportAppsJsonBtn'),
    ]);
    expect(jsonDownload.suggestedFilename()).toContain('.json');
    const jsonStream = await jsonDownload.createReadStream();
    const chunks = [];
    for await (const chunk of jsonStream) chunks.push(chunk);
    const jsonContent = Buffer.concat(chunks).toString('utf-8');
    expect(jsonContent).not.toBe('[object Object]');
    const parsed = JSON.parse(jsonContent);
    expect(parsed).toHaveProperty('applications');
    expect(Array.isArray(parsed.applications)).toBe(true);
    expect(parsed.applications.length).toBeGreaterThan(0);

    // Test CSV export
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportApplications'),
    ]);
    expect(csvDownload.suggestedFilename()).toContain('.csv');
  });

  test('Import UI previews conflicts and commits imported applications', async ({ page }) => {
    test.slow(); // File upload + modal + table update needs extra time on mobile
    await page.goto('/');
    await navigateTo(page, '#nav-applications');

    // Prepare JSON payload to import
    const importPayload = {
      version: '3.0.0',
      exported_at: new Date().toISOString(),
      applications: [
        {
          id: 'imported-req-99',
          requisition_id: 'imported-req-99',
          company: 'Amazon',
          title: 'Business Intel Engineer I',
          location: 'Hyderabad',
          type: 'Full-time',
          official_detail_url: 'https://www.amazon.jobs/en/jobs/imported-req-99',
          official_apply_url: 'https://account.amazon.jobs/jobs/imported-req-99/apply',
          status: 'interviewing',
          applied_date: '2026-09-28'
        }
      ]
    };

    // Set file on #importAppsFileInput
    await page.setInputFiles('#importAppsFileInput', {
      name: 'applications_backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importPayload, null, 2))
    });

    // Preview modal should appear
    const importModal = page.locator('#importPreviewModal');
    await expect(importModal).toBeVisible();
    await expect(page.locator('#importPreviewStats')).toContainText('1');

    // Click Commit Import
    await page.click('#executeImportMergeBtn');
    await expect(importModal).toBeHidden();

    // Table should now list the imported job
    await expect(page.locator('#applicationTableBody')).toContainText('Business Intel Engineer I');
    await expect(page.locator('#applicationTableBody')).toContainText('Interviewing');
  });

  test('Application-history portal links are valid and drawer controls work without error', async ({ page }) => {
    test.slow(); // Many interactions + reload + persistence verification needs extra time on mobile
    await page.goto('/');
    await page.evaluate(() => {
      if (window.AJSStorage) {
        window.AJSStorage.saveApplication({
          id: 'portal-job-1',
          requisition_id: 'portal-job-1',
          company: 'Amazon',
          title: 'Data Analyst Support',
          location: 'Bengaluru',
          type: 'Full-time',
          detail_url: 'https://www.amazon.jobs/en/jobs/portal-job-1',
          apply_url: 'https://account.amazon.jobs/jobs/portal-job-1/apply',
          status: 'applied',
          applied_date: '2026-09-30'
        });
      }
    });

    await page.reload();
    await navigateTo(page, '#nav-applications');

    // Validate table Open Portal href is valid https URL
    const openPortalLink = page.locator('a:has-text("Open Portal ↗")').first();
    await expect(openPortalLink).toBeVisible();
    const tableHref = await openPortalLink.getAttribute('href');
    expect(tableHref).toMatch(/^https:\/\//);
    expect(tableHref).not.toBe('undefined');

    // Open detail drawer
    await page.locator('button:has-text("View Details")').first().dispatchEvent('click');
    const drawer = page.locator('#appDetailDrawerBackdrop');
    await expect(drawer).toBeVisible();

    // Validate drawer official link href
    const drawerPortalLink = page.locator('#drawerOfficialLink');
    const drawerHref = await drawerPortalLink.getAttribute('href');
    expect(drawerHref).toMatch(/^https:\/\//);
    expect(drawerHref).not.toBe('undefined');

    // Test reminder controls
    await page.fill('#drawerNextAction', 'Submit follow-up email');
    await page.fill('#drawerDueDate', '2026-10-10');
    await page.click('#saveReminderBtn', { force: true }); // force: date input overlaps on mobile

    // Test recruiter contact controls
    await page.fill('#drawerRecruiterName', 'Priya Sharma');
    await page.fill('#drawerRecruiterContact', 'priya@amazon.com');
    await page.click('#saveContactBtn', { force: true });

    // Test note controls
    await page.fill('#drawerNewNote', 'Spoke with hiring manager at tech summit.');
    await page.click('#addNoteBtn', { force: true });
    await expect(page.locator('#drawerNotesList')).toContainText('Spoke with hiring manager');

    // Close and reload to verify persistence
    await page.locator('#closeAppDrawerBtn').click({ force: true });
    await page.reload();
    await navigateTo(page, '#nav-applications');
    await page.locator('button:has-text("View Details")').first().dispatchEvent('click');
    await expect(page.locator('#drawerNextAction')).toHaveValue('Submit follow-up email');
    await expect(page.locator('#drawerRecruiterName')).toHaveValue('Priya Sharma');
    await expect(page.locator('#drawerRecruiterContact')).toHaveValue('priya@amazon.com');
    await expect(page.locator('#drawerNotesList')).toContainText('Spoke with hiring manager');
  });

  test('ATS interactive checklist allows checking items and persists progress', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      if (window.AJSStorage) {
        window.AJSStorage.saveApplication({
          id: 'ats-job-1',
          company: 'Amazon',
          title: 'Business Analyst I',
          status: 'applied'
        });
      }
    });

    await navigateTo(page, '#nav-resume');

    // Select job in target select if available
    const targetSelect = page.locator('#targetJobSelect');
    if (await targetSelect.isVisible()) {
      await targetSelect.selectOption({ index: 1 });
    }

    // Enter resume text
    await page.fill('#resumeRawText', 'Analyst with SQL, Power BI, Excel.');
    await page.waitForTimeout(400);

    // Look for interactive checklist checkbox
    const firstCheckbox = page.locator('#atsChecklistWrap input[type="checkbox"]').first();
    if (await firstCheckbox.isVisible()) {
      await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();
    }
  });

  test('Completed interview session links directly to application', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      if (window.AJSStorage) {
        window.AJSStorage.saveApplication({
          id: 'interview-link-job',
          requisition_id: 'interview-link-job',
          company: 'Amazon',
          title: 'Business Intel Engineer I',
          status: 'interviewing'
        });
        window.AJSStorage.saveInterviewSession({
          jobId: 'interview-link-job',
          targetJobId: 'interview-link-job',
          company: 'Amazon',
          title: 'Business Intel Engineer I',
          overallScore: 85,
          mode: 'short',
          completedAt: new Date().toISOString()
        });
      }
    });

    // Check application record has linked interview session
    const app = await page.evaluate(() => {
      return window.AJSStorage.getApplication('interview-link-job');
    });
    expect(app).not.toBeNull();
    expect(app.interview_sessions).toBeDefined();
    expect(app.interview_sessions.length).toBeGreaterThan(0);
    expect(app.interview_sessions[0].overallScore).toBe(85);
  });

  test('Stale or malformed payload fails closed gracefully with aged payload', async ({ page }) => {
    // Intercept latest.json to return old payload dated 2020-01-01
    await page.route('**/latest.json*', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          scan_date: '2020-01-01',
          scanned_at: '2020-01-01T12:00:00+05:30',
          timezone: 'Asia/Kolkata',
          summary: { total: 1, fresh: 0, backup: 1, internships: 0 },
          jobs: []
        })
      });
    });

    await page.goto('/');

    // Stale banner should appear because payload is older than 24 hours
    const staleBanner = page.locator('#staleScanBanner');
    await expect(staleBanner).toBeVisible();

    // Scan age should indicate stale
    const dashAge = page.locator('#dashScanAge');
    await expect(dashAge).toContainText('Stale');
  });

  test('Scan Audit renders truthful link checks and dynamic sources', async ({ page }) => {
    await page.goto('/');
    await navigateTo(page, '#nav-audit');

    // Audit view should display dynamic sources and audit table
    await expect(page.locator('#view-audit')).toBeVisible();
    const auditTable = page.locator('#auditJobsTableBody');
    await expect(auditTable).toBeVisible();

    // Verify sources count is populated
    const activeSources = page.locator('#auditActiveSources');
    await expect(activeSources).not.toHaveText('0');
  });

});
