# Analytics Job Scout v2 — Free Career Workspace & Verified Job Intelligence

> **Production URL**: [https://charankumarda01.github.io/analytics-job-scout/](https://charankumarda01.github.io/analytics-job-scout/)  
> **Hosting**: 100% Free Static GitHub Pages under the repository subpath `/analytics-job-scout/`  
> **Scheduled Scanner**: Every day at **08:30 IST** via GitHub Actions

Analytics Job Scout v2 is a free, privacy-first career workspace designed for junior data and business analytics aspirants in India. It pairs a verified daily job search across startups, mid-size companies, and enterprises with date-aware **Walk-in Alerts**, client-side **Resume AI**, and an offline-first **Daily Interview Coach**.

---

## Key Features in v2

### 0. Verified Startup & Mid-Size Discovery, Walk-in Alerts & Research
- **Curated Multi-Source Registry (`sources/companies.json`)**: Expands coverage beyond large enterprises to verified startups, scale-ups, and mid-market employers hiring in Bengaluru, Hyderabad, Chennai, and Remote India. Supports official career portals and direct ATS integrations (Greenhouse, Lever, Ashby, SmartRecruiters, Workday).
- **Anti-Scam Authenticity Checks**: Enforces strict verification criteria. Rejects unverified forms, Telegram/WhatsApp groups, personal recruiter emails, shortened URLs, training fees, deposit demands, or third-party scraper reposts.
- **Strict Live-Link Gate**: Every candidate job must pass a live HTTP validation check confirming an allowed official domain, absence of expiration phrases ("job closed", "page not found"), and active requisition status before appearing in `latest.json`. Failed/dead links are safely suppressed and logged in audit data.
- **Dedicated Walk-in Alerts View**: Date-aware recruitment alert feed for verified in-person recruitment drives. Includes dynamic countdowns (*"Tomorrow"*, *"3 days left"*), complete venue details, document instructions, one-click Apple/Google calendar `.ics` generation with local timezone support, attending/saved markers, and an RSS/Atom feed (`docs/data/walkins.xml`).
- **Research Company Intelligence**: Separate research drawer on job cards offering checked outbound links to official About/Culture pages, LinkedIn profiles, Glassdoor, AmbitionBox, and Reddit discussions. Strictly separates official verification from subjective community reports with clear disclaimers.
- **Safe Source Suggestions**: Prefilled GitHub Issue and local JSON download tools allow users to suggest official company ATS boards without collecting any personal data or credentials.

### 1. Resume AI & Explainable ATS Analyzer
- **Local Browser-Based Parsing**: Drag-and-drop or select `.pdf`, `.docx`, or `.txt` resumes (up to 5MB) with a large paste-text fallback. Files are parsed entirely in-browser via client-side libraries (PDF.js and Mammoth.js). No raw files or sensitive personal data are ever uploaded.
- **Explainable 0–100 Deterministic ATS Scoring**: Transparent point-by-point breakdown across Contact & Links, Standard Resume Sections, Analytics Hard Skills (SQL, Excel, Power BI, Tableau, Python, Statistics, ETL, Junior ML), Quantified Metrics, Strong Action Verbs, Conciseness, and Cliché Phrase deductions.
- **Role-Aware Job Matcher**: Compare your resume against any live verified job opening from `latest.json` to calculate match percentages, matched technical keywords, and missing skill checklists without silently mutating candidate profile data.
- **Optional AI Enhancements (Puter.js)**: After explicit consent, generate recruiter-style reviews, bullet rewrites using Google's XYZ formula (*Accomplished X, measured by Y, by doing Z*), tailored cover letters, professional summaries, and job-specific interview questions.
- **Zero-AI Offline Fallback**: If offline, CDN-blocked, or if the user declines AI, all evaluations seamlessly fallback to deterministic rule engines.

### 2. Daily Interview Coach
- **10 Curated Practice Tracks (120 Questions)**:
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
- **Calibrated Scoring Formula**: Enforces strict boundary caps (short <10 word answers max 15/100, 22-word answers max 50/100, irrelevant answers max 38/100) ensuring that only well-structured answers with substantive analytics depth receive high scores.
- **Transcript Metrics & Offline Rubric**: Real-time words-per-minute (WPM) pacing assessment, filler-word counting (*um, uh, like, actually, basically*), STAR component detection, and key concept matching. Strong answer guidance is revealed *after* candidate response.
- **6 Focused Communication Drills**: 60-second self-introduction, explaining a project to a non-technical stakeholder, presenting a dashboard insight, clarifying vague requests, standup updates, and asking questions at interview close.
- **Daily Streak Tracking**: Persistent local streak counter (calendar-date aware to prevent timezone breaks), 7-day activity chart, rolling score averages, and JSON progress export.

---

## Free AI Architecture & Privacy Guarantees

Analytics Job Scout adheres to a strict privacy and zero-cost design:

1. **Local File Parsing & Privacy**:
   - Resume parsing is 100% client-side. No raw file is ever sent to any server.
   - By default, resumes are held in temporary **page memory only**.
   - Resumes are only persisted if the user explicitly checks **"Remember on this device"** (capped at 150KB).
   - Includes **"Forget resume"** and **"Delete all career data"** one-click actions.
2. **Transparent Third-Party AI Disclosure**:
   - Uses Puter.js through its official browser SDK (`puter.ai.chat(...)`) without requiring user API keys.
   - File selection alone never transmits data.
   - An explicit consent dialog is required before any prompt is dispatched to third-party AI.
   - Extracted text transmitted to Puter or its model provider is governed by [Puter's Privacy Policy](https://puter.com/privacy) and [Terms of Service](https://puter.com/terms).
   - Declining consent runs local deterministic scoring immediately without transmitting data.
3. **Prompt Injection & Data Isolation**:
   - Resume and job data are enclosed in `<<<UNTRUSTED_CONTENT>>>` delimiters with strict system directives instructing the model to treat the text strictly as passive data.
   - Output is rendered safely using text sanitization to protect against XSS.

---

## Project Structure

```text
analytics-job-scout/
├── .github/
│   └── workflows/
│       └── daily-scan-pages.yml     # Automated test suite, scan, & Pages deployment
├── docs/
│   ├── index.html                   # Main dashboard application
│   ├── assets/
│   │   └── app.css                  # Design system, responsive views, modal & walk-in styles
│   ├── js/
│   │   ├── storage.js               # Storage manager, 150KB capping, timezone-safe IST dates
│   │   ├── ai-client.js             # Puter.js SDK client with prompt-injection defense
│   │   ├── resume-agent.js          # In-browser file parser, 0-100 ATS scoring & job matcher
│   │   ├── interview-coach.js       # Speech recognition, calibrated rubric scoring & streaks
│   │   ├── walkin-alerts.js         # Walk-in alerts controller, countdowns & .ics generation
│   │   └── app.js                   # Application coordinator, filters, and event wiring
│   └── data/
│       ├── latest.json              # Published daily scan payload with verified jobs & audit
│       ├── walkins.json             # Verified walk-in alerts with countdowns & venues
│       ├── walkins.ics              # Calendar subscription file for walk-in drives
│       ├── walkins.xml              # RSS/Atom subscription feed for walk-in alerts
│       └── interview-questions.json # Curated question bank (120 questions across 10 tracks)
├── scanner/
│   ├── adapters/                    # Provider adapters (Amazon, Accenture, Greenhouse, Lever, etc.)
│   ├── authenticity.py              # Anti-scam and recruiter credential validation
│   ├── dedupe.py                    # Multi-source requisition deduplication
│   ├── engine.py                    # Scanner pipeline coordinator
│   ├── link_verifier.py             # Strict HTTP 200 live-link validator
│   ├── registry.py                  # Sources registry & research destination loader
│   └── walkins.py                   # Walk-in verification, countdowns, and feed generator
├── sources/
│   ├── companies.json               # Curated employer registry with size & allowed domains
│   └── company_research.json        # Verified outbound research & review links
├── tests/
│   ├── test_authenticity.py         # Anti-scam rule unit tests
│   ├── test_dedupe.py               # Requisition deduplication tests
│   ├── test_interview_scoring.test.js # Calibrated interview scoring boundary tests
│   ├── test_link_verifier.py        # Live-link validation tests
│   ├── test_payload_schema.py       # Pre-deployment schema & safety tests
│   ├── test_registry.py             # Registry schema & domain validation tests
│   ├── test_resume_ats.test.js      # ATS scoring & job matching unit tests
│   ├── test_storage.test.js         # Storage capping & legacy migration tests
│   └── test_walkins.py              # Walk-in expiration & calendar tests
├── server.py                        # Python server for scanner runs & local HTTP preview
├── requirements.txt                 # Python dependencies
└── README.md                        # Documentation
```

---

## Local Verification & Development

### 1. Prerequisites
- Python 3.10+
- Node.js 18+ (for client-side unit test execution)
- Modern Web Browser (Chrome, Edge, Firefox, Safari)

### 2. Run Test Suites
Run the automated Python and Node.js test suites:
```bash
# Python unit and schema tests (22 tests)
python -m unittest discover -s tests -p "test_*.py"

# Node client-side test suites (storage, interview calibration, resume ATS)
node tests/test_storage.test.js
node tests/test_interview_scoring.test.js
node tests/test_resume_ats.test.js
```

### 3. Run Scanner Locally
Execute the scanner locally to verify live-link validation and payload generation:
```bash
python server.py --scan-only --output docs/data/latest.json
```

### 4. Serve the Web Application
To preview the web app with the exact GitHub Pages `/analytics-job-scout/` subpath:
```bash
python server.py --port 8000
```
Open your browser to: `http://localhost:8000/analytics-job-scout/`

---

## Quality Gates & Verification Matrix

Before every deployment, the GitHub Actions workflow enforces:
- **Syntax validation**: `python -m compileall` and `node -c` on all application files.
- **Unit & Schema validation**: Automated testing of anti-scam rules, deduplication, live-link filters, countdown calculations, and storage limits.
- **Pre-publish Safety Gate**: Ensures all jobs in `latest.json` have `verified: true`, HTTPS URLs, allowed company domains, and explicit 0–15 day dates.
