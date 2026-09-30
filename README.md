# Analytics Job Scout v2 — Free Career Workspace & Verified Job Intelligence

> **Production URL**: [https://charankumarda01.github.io/analytics-job-scout/](https://charankumarda01.github.io/analytics-job-scout/)  
> **Hosting**: 100% Free Static GitHub Pages under the repository subpath `/analytics-job-scout/`  
> **Scheduled Scanner**: Every day at **08:30 IST** via GitHub Actions

Analytics Job Scout v2 turns the daily verified junior analytics job dashboard into a comprehensive, privacy-first career workspace featuring **Resume AI** and the **Daily Interview Coach**.

---

## What's New in v2

### 1. Resume AI & Explainable ATS Analyzer
- **Local Browser-Based Parsing**: Drag-and-drop or select `.pdf`, `.docx`, or `.txt` resumes (up to 5MB) with an instant paste-text fallback. Files are parsed entirely within the browser via client-side libraries (PDF.js and Mammoth.js). No raw files or sensitive personal data are ever uploaded to any custom server.
- **Explainable 0–100 Deterministic ATS Scoring**: Transparent point-by-point breakdown across Contact & Links, Standard Resume Sections, Analytics Hard Skills (SQL, Excel, Power BI, Tableau, Python, Statistics, ETL, Junior ML), Quantified Metrics, Strong Action Verbs, Conciseness, and Cliché Phrase deductions.
- **Role-Aware Job Matcher**: Compare your resume against any live verified job opening from `latest.json` to calculate match percentages, matched technical keywords, and missing skill checklists.
- **Optional AI Enhancements (Puter.js)**: After explicit consent, generate recruiter-style reviews, bullet rewrites using Google's XYZ formula, tailored cover letters, professional summaries, and job-specific interview questions.
- **Zero-AI Offline Fallback**: If offline, CDN-blocked, or if the user declines AI, all evaluations seamlessly fallback to deterministic rule engines.

### 2. Daily Interview Coach
- **10 Curated Practice Tracks**:
  1. HR & Fresher Introduction
  2. Behavioural / STAR
  3. Spoken English & Communication
  4. Data Analyst Fundamentals
  5. SQL (Joins, CTEs, Window Functions)
  6. Advanced Excel (PivotTables, XLOOKUP, Power Query)
  7. Power BI & DAX
  8. Python / pandas
  9. Analytics Case Study & Business Metrics
  10. Junior Data Science / Statistics / ML
- **Job-Specific Practice Flow**: Click **"Practice for this job"** on any job card to practice with questions tailored specifically to that job's required tools and company context.
- **Speech & Voice Integration**: Feature-detected speech recognition (`webkitSpeechRecognition`) for voice answers and interviewer read-aloud via `speechSynthesis`, with a typed textarea fallback. Audio is never recorded or retained.
- **Transcript Metrics & Offline Rubric**: Real-time words-per-minute (WPM) pacing assessment, filler-word counting (*um, uh, like, actually, basically*), STAR component detection, and key concept matching. Strong answer guidance is revealed *after* candidate response.
- **6 Focused Communication Drills**: 60-second self-introduction, explaining a project to a non-technical stakeholder, presenting a dashboard insight, clarifying vague requests, standup updates, and asking questions at interview close.
- **Daily Streak Tracking**: Persistent local streak counter (calendar-date aware to prevent timezone breaks), 7-day activity chart, rolling score averages, and JSON progress export.

### 3. Non-Negotiable Core Job Intelligence
- **100% Official Company Career Portals**: Only direct company listings (e.g. Amazon Jobs, Accenture Careers). Zero unverified aggregators or scraped third parties.
- **Strict Quality Rules**:
  - Explicit posting date required (0–15 days old; 0–5 days fresh, 6–15 days backup).
  - True junior/entry level (minimum experience ≤ 2 years; senior/lead/manager titles eliminated).
  - Minimum of 2 verified analytics skills per job.
  - Live HTTP 200 application link.
  - Apply-first ordering and duplicate suppression.

---

## Free AI Architecture & Privacy Guarantees

Analytics Job Scout adheres to a strict privacy and zero-cost design:

1. **Progressive Enhancement via Puter.js**:
   - Uses the official keyless browser SDK (`puter.ai.chat(...)`).
   - Does **not** require any paid API key (no OpenAI, Gemini, or GitHub token needed in client or server).
   - Graceful timeout (22s) and fallback if the script is blocked by an ad-blocker or CDN outage.
2. **Explicit Consent Gate**:
   - File selection alone never transmits data.
   - An explicit consent dialog is required before any prompt is dispatched to third-party AI.
   - Users can decline and use 100% deterministic local scoring.
3. **Prompt Injection & Data Isolation**:
   - Resume and job data are enclosed in `<<<UNTRUSTED_CONTENT>>>` delimiters with strict system directives instructing the model to treat the text strictly as passive data.
   - Output is rendered safely using text sanitization to protect against XSS.
4. **Data Ownership & Storage**:
   - By default, resumes are held in temporary **page memory only**.
   - Resumes are only persisted if the user explicitly checks **"Remember on this device"**.
   - Includes **"Forget resume"** and **"Delete all career data"** one-click actions.
   - Namespaced keys (`ajs.v2.*`) with automatic migration from v1 keys and localStorage quota protection.

---

## Project Structure

```text
analytics-job-scout/
├── .github/
│   └── workflows/
│       └── daily-scan-pages.yml     # Scheduled daily scan (08:30 IST) & Pages deployment
├── docs/
│   ├── index.html                   # Main single-page web app
│   ├── assets/
│   │   └── app.css                  # Master stylesheet (theme, responsive, print media)
│   ├── js/
│   │   ├── storage.js               # Namespaced ajs.v2.* storage, migration & memory fallback
│   │   ├── ai-client.js             # Puter.js progressive AI wrapper & prompt-injection guards
│   │   ├── resume-agent.js          # File parsers, 0-100 ATS scoring, and job matcher
│   │   ├── interview-coach.js       # Speech API, transcript metrics, 10 tracks, and streak
│   │   └── app.js                   # Application coordinator & event bindings
│   └── data/
│       ├── latest.json              # Published daily scan data (updated automatically)
│       └── interview-questions.json # Curated question bank (120 questions across 10 tracks)
├── server.py                        # Python scanner and local verification test server
├── requirements.txt                 # Dependencies for GitHub Actions scanner
└── README.md                        # Documentation
```

---

## Local Verification & Development

### 1. Prerequisites
- Python 3.10+
- Modern Web Browser (Chrome, Edge, Firefox, Safari)

### 2. Run Local Server
To test the web app with the exact GitHub Pages `/analytics-job-scout/` subpath:
```bash
python server.py --port 8000
```
Open your browser to:
```text
http://localhost:8000/analytics-job-scout/
```

### 3. Run Scanner in Dry-Run Mode
To execute the scanner locally and verify data ingestion without a browser:
```bash
python server.py --scan-only --output docs/data/latest.json
```

---

## GitHub Pages Setup & Deployment

1. Push changes to the `main` branch:
   ```bash
   git add .
   git commit -m "Add free resume AI and daily interview coach"
   git push origin main
   ```
2. Enable GitHub Pages:
   - Navigate to **Settings → Pages** in your GitHub repository.
   - Under **Build and deployment**, select **GitHub Actions** as the source.
   - Go to the **Actions** tab, select **Daily verified job scan and Pages deploy**, and click **Run workflow**.
3. Once deployed, the live site is permanently available at:
   ```text
   https://charankumarda01.github.io/analytics-job-scout/
   ```

---

## Browser Compatibility

| Feature | Chrome / Edge | Firefox | Safari | Offline / CDN Blocked |
| :--- | :--- | :--- | :--- | :--- |
| **Verified Job Directory** | Supported | Supported | Supported | Supported |
| **Deterministic ATS Analysis** | Supported | Supported | Supported | Supported |
| **PDF/DOCX Local Parsing** | Supported | Supported | Supported | Paste-text fallback |
| **Speech Recognition** | Supported (Webkit) | Fallback to Typed | Fallback to Typed | Fallback to Typed |
| **Speech Synthesis (Voice)** | Supported | Supported | Supported | Fallback to Text |
| **Optional AI (Puter.js)** | Supported | Supported | Supported | Deterministic fallback |
