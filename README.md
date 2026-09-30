# Analytics Job Scout — Free GitHub Pages Deployment

A free, permanent, daily-updating job dashboard for junior analytics roles and internships.

## How the free deployment works

- **GitHub Actions** runs the strict official-source scanner every day at **08:30 IST**.
- It checks Amazon Jobs and Accenture Careers for junior Data Analyst, SQL, Power BI, reporting/analytics, analyst, and junior Data Scientist roles plus internships.
- The workflow rebuilds and publishes the web app to **GitHub Pages**.
- Opening the site or clicking **Refresh latest verified jobs** loads the most recently published scan.
- Saved jobs, ATS progress and application statuses stay in your browser using local storage.

The site never stores company credentials and never submits applications automatically.

## Free deployment steps

### 1. Create the repository

1. Sign in to GitHub.
2. Create a new **public** repository named `analytics-job-scout`.
3. Do not add a README or other starter files.

### 2. Upload this project

**Windows shortcut:** after extracting the ZIP, double-click `DEPLOY_GITHUB_WINDOWS.bat`. It asks for your GitHub username and pushes the project. Git may open a browser so you can authorize GitHub securely.

Using GitHub Desktop is also easy:

1. Extract the deployment ZIP.
2. In GitHub Desktop choose **File → Add local repository** and select the extracted folder.
3. If prompted, choose **create a repository here**.
4. Commit all files, then choose **Publish repository**.
5. Confirm that the repository name is `analytics-job-scout` and that it is public.

Or use Git from a terminal:

```bash
git init
git add .
git commit -m "Deploy Analytics Job Scout"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/analytics-job-scout.git
git push -u origin main
```

### 3. Enable GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Open the **Actions** tab and select **Daily verified job scan and Pages deploy**.
5. Click **Run workflow** once if the push did not start it automatically.

After the green check appears, the permanent URL is:

```text
https://YOUR_USERNAME.github.io/analytics-job-scout/
```

## Daily schedule

The workflow runs at **08:30 IST**. To change the time, edit the cron expression in:

```text
.github/workflows/daily-scan-pages.yml
```

You can also run it at any time from **GitHub → Actions → Daily verified job scan and Pages deploy → Run workflow**.

## Strict filters

A role is displayed only when it has:

- An official company source and application URL
- A date no older than 15 days
- No senior/lead/manager/director title
- A minimum experience requirement of no more than 2 years, or internship/entry-level evidence
- At least two relevant analytics skills

## Project structure

- `docs/index.html` — GitHub Pages application
- `docs/data/latest.json` — latest bundled scan (replaced at deployment time)
- `server.py` — official-source scanner and optional local server
- `.github/workflows/daily-scan-pages.yml` — scheduled scan and deployment workflow
- `requirements.txt` — Python dependency
