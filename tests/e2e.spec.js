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

    // Click Decline (Use Offline Engine)
    await page.click('#aiConsentDeclineBtn');
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

    // Test JSON export
    const [jsonDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportAppsJsonBtn'),
    ]);
    expect(jsonDownload.suggestedFilename()).toContain('.json');

    // Test CSV export
    const [csvDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportApplications'),
    ]);
    expect(csvDownload.suggestedFilename()).toContain('.csv');
  });

  test('Stale or malformed payload fails closed gracefully', async ({ page }) => {
    // Intercept latest.json to return 500 error
    await page.route('**/latest.json*', route => {
      route.fulfill({ status: 500, body: 'Server Error' });
    });

    await page.goto('/');

    // Stale banner should appear
    const staleBanner = page.locator('#staleScanBanner');
    await expect(staleBanner).toBeVisible();

    // 0 verified jobs shown
    await expect(page.locator('#overviewTotal')).toHaveText('0');
  });

});
