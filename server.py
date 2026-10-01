#!/usr/bin/env python3
"""Analytics Job Scout: static app + live official-source daily scan API."""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import traceback
from datetime import datetime, timedelta
from email.message import Message
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)
TZ = ZoneInfo("Asia/Kolkata")
AMAZON_SEARCH = "https://www.amazon.jobs/en/search.json"
ACCENTURE_SEARCH = "https://www.accenture.com/api/accenture/elastic/findjobs"
ACCENTURE_TOKEN = "https://www.accenture.com/libs/granite/csrf/token.json"

ROLE_QUERIES = {
    "data-analyst": "data analyst",
    "sql": "SQL analyst",
    "power-bi": "Power BI analyst",
    "analytics": "analytics reporting",
    "any-analyst": "business analyst",
    "data-scientist": "data scientist",
}

TARGET_SKILLS = {
    "SQL": [r"\bsql\b", r"structured query language"],
    "Excel": [r"\bexcel\b", r"pivot tables?", r"xlookup", r"vba"],
    "Power BI": [r"power\s*bi", r"\bdax\b", r"power query"],
    "Tableau": [r"\btableau\b"],
    "Python": [r"\bpython\b", r"\bpandas\b", r"\bnumpy\b"],
    "Statistics": [r"\bstatistics?\b", r"statistical", r"hypothesis test", r"regression"],
    "Data cleaning": [r"data clean", r"data cleansing", r"data quality", r"data validation", r"data hygiene"],
    "Dashboards": [r"dashboards?", r"dashboarding"],
    "Visualization": [r"visuali[sz]ation", r"quicksight", r"looker"],
    "Reporting": [r"\breporting\b", r"\breports?\b", r"\bmis\b"],
    "ETL": [r"\betl\b", r"\belt\b", r"data pipeline", r"data warehouse"],
    "Google Analytics": [r"google analytics", r"\bga4\b"],
}

SENIOR_TITLE = re.compile(
    r"(?i)\b(senior|sr\.?|lead|manager|director|principal|head|vice president|vp|staff|architect)\b|\banalyst\s+(?:ii|iii|iv)\b|\bdata scientist\s+(?:ii|iii|iv)\b"
)


def now_local() -> datetime:
    return datetime.now(TZ)


def clean_html(value: str | None) -> str:
    value = value or ""
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def find_skills(text: str) -> list[str]:
    text = text.lower()
    found = []
    for skill, patterns in TARGET_SKILLS.items():
        if any(re.search(pattern, text, flags=re.I) for pattern in patterns):
            found.append(skill)
    return found


def experience_numbers(text: str) -> list[int]:
    """Extract mandatory-looking lower bounds from a qualifications string."""
    text = clean_html(text).lower()
    nums: list[int] = []
    for m in re.finditer(r"\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)\b", text):
        nums.append(int(m.group(1)))
    text_no_ranges = re.sub(r"\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:years?|yrs?)\b", "", text)
    for m in re.finditer(r"\b(\d{1,2})\s*\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:relevant\s+|professional\s+|work\s+)?experience\b", text_no_ranges):
        nums.append(int(m.group(1)))
    for m in re.finditer(r"\bexperience\s*(?::|of)?\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)\b", text_no_ranges):
        nums.append(int(m.group(1)))
    # Common wording: "2+ years of analyzing... experience"
    for m in re.finditer(r"\b(\d{1,2})\s*\+\s*(?:years?|yrs?)\s+of\b", text_no_ranges):
        nums.append(int(m.group(1)))
    return nums


def mandatory_advanced_degree(text: str) -> bool:
    text = clean_html(text).lower()
    return bool(
        re.search(r"(?:master'?s|ph\.?d\.?|doctorate)\s+degree\s+(?:is\s+)?required", text)
        or re.search(r"required\s*:\s*(?:master'?s|ph\.?d\.?|doctorate)", text)
    )


def role_matches(title: str, text: str, roles: list[str], is_intern: bool) -> bool:
    t = title.lower()
    all_text = (title + " " + text).lower()
    checks = []
    for role in roles:
        if role == "any-analyst":
            checks.append(bool(re.search(r"\banalyst\b|\banalytics\b|\breporting\b|\binsights?\b", t)))
        elif role == "data-analyst":
            checks.append(bool(re.search(r"data analyst|data analytics|analytics and model|measurement and reporting", t)))
        elif role == "sql":
            checks.append("sql" in all_text and bool(re.search(r"analyst|analytics|report|business intel|data", t)))
        elif role == "power-bi":
            checks.append(bool(re.search(r"power\s*bi", all_text)) and bool(re.search(r"analyst|analytics|report|business intel|data|model", t)))
        elif role == "analytics":
            checks.append(bool(re.search(r"analyt|report|insight|business intel|mis|measurement", t)))
        elif role == "data-scientist":
            checks.append(bool(re.search(r"data scien|decision scien", t)))
    return any(checks) or (is_intern and "intern" in t)


def normalize_location(raw: str) -> str | None:
    low = raw.lower()
    if "hyderabad" in low or re.search(r"\bts\b", low):
        return "Hyderabad"
    if "bengaluru" in low or "bangalore" in low or re.search(r"\bka\b", low):
        return "Bengaluru"
    if "chennai" in low or re.search(r"\btn\b", low):
        return "Chennai"
    if "remote" in low or "virtual" in low or "work from home" in low:
        return "Remote India"
    return None


def analytics_title_fit(title: str, skills: list[str]) -> bool:
    """Keep analytics roles broad, but avoid generic service/accounting/security titles."""
    if re.search(r"(?i)\b(analyst|analytics|reporting|measurement|insights?|data scien|business intel|bi developer|power bi|modeling)\b", title):
        return True
    return bool(
        len(skills) >= 3
        and re.search(r"(?i)\b(associate|developer)\b", title)
        and any(s in skills for s in ("SQL", "Power BI", "Python", "Dashboards"))
    )


def score_job(skills: list[str], exp_min: int, days: int, title: str, is_intern: bool) -> int:
    title_score = 30 if re.search(r"(?i)data analyst|business analyst|analytics|reporting|business intel|data scien", title) else 23
    skill_score = min(35, 10 + len(skills) * 5)
    level_score = 20 if is_intern or exp_min == 0 else 18 if exp_min == 1 else 15
    fresh_score = 15 if days <= 5 else 10 if days <= 10 else 6
    return min(100, title_score + skill_score + level_score + fresh_score)


def fit_text(skills: list[str], exp_label: str, is_intern: bool) -> str:
    kind = "Internship" if is_intern else f"Junior fit ({exp_label})"
    return f"{kind}; verified keywords: {', '.join(skills[:6])}."


def wanted_type(is_intern: bool, types: list[str]) -> bool:
    return (is_intern and "internships" in types) or ((not is_intern) and "jobs" in types)


def wanted_location(location: str | None, locations: list[str]) -> bool:
    return bool(location and location in locations)


def scan_amazon(query: str, roles: list[str], locations: list[str], types: list[str], today) -> tuple[list[dict], dict]:
    stats = {"source": "Amazon", "query": query, "received": 0, "eligible": 0, "error": None}
    try:
        r = requests.get(
            AMAZON_SEARCH,
            params={"base_query": query, "loc_query": "India", "result_limit": 100, "sort": "recent"},
            timeout=30,
            headers={"User-Agent": "AnalyticsJobScout/1.0"},
        )
        r.raise_for_status()
        raw_jobs = r.json().get("jobs", [])
        stats["received"] = len(raw_jobs)
    except Exception as exc:
        stats["error"] = str(exc)
        return [], stats

    out = []
    for x in raw_jobs:
        if x.get("country_code") not in {"IND", "IN"}:
            continue
        location = normalize_location(x.get("location", ""))
        if not wanted_location(location, locations):
            continue
        try:
            posted = datetime.strptime(x.get("posted_date", ""), "%B %d, %Y").date()
        except ValueError:
            continue
        days = (today - posted).days
        if days < 0 or days > 15:
            continue
        title = clean_html(x.get("title"))
        if not title or SENIOR_TITLE.search(title):
            continue
        basic = clean_html(x.get("basic_qualifications"))
        description = clean_html(x.get("description"))
        preferred = clean_html(x.get("preferred_qualifications"))
        is_intern = bool(x.get("is_intern")) or bool(re.search(r"(?i)\bintern(ship)?\b", title))
        if not wanted_type(is_intern, types):
            continue
        nums = experience_numbers(basic)
        if any(n >= 3 for n in nums):
            continue
        if mandatory_advanced_degree(basic):
            continue
        # Require explicit junior evidence unless it is an internship/university role.
        if not nums and not is_intern and not x.get("university_job") and not re.search(r"(?i)\b(new associate|associate|analyst i|engineer i|entry.level|early career)\b", title):
            continue
        exp_min = max(nums) if nums else 0
        exp_label = "Internship" if is_intern else (f"{exp_min}+ years" if nums else "Entry-level")
        full_text = " ".join((title, basic, preferred, description))
        skills = find_skills(full_text)
        if len(skills) < 2 or not analytics_title_fit(title, skills) or not role_matches(title, full_text, roles, is_intern):
            continue
        job_id = str(x.get("id_icims") or x.get("id") or "").strip()
        detail = "https://www.amazon.jobs" + x.get("job_path", "")
        apply_url = x.get("url_next_step") or (f"https://account.amazon.jobs/jobs/{job_id}/apply" if job_id else "")
        if not job_id or not detail or not apply_url:
            continue
        out.append({
            "id": job_id, "company": "Amazon", "title": title, "location": location,
            "date": posted.isoformat(), "days": days, "window": "fresh" if days <= 5 else "backup",
            "score": score_job(skills, exp_min, days, title, is_intern),
            "type": "Internship" if is_intern else clean_html(x.get("job_schedule_type")) or "Full-time",
            "exp": exp_label, "recruiter": "Not disclosed", "skills": skills,
            "fit": fit_text(skills, exp_label, is_intern), "detail": detail, "apply": apply_url,
            "source": "Amazon Jobs official search", "verified": True,
        })
    stats["eligible"] = len(out)
    return out, stats


def accenture_session() -> tuple[requests.Session, str]:
    s = requests.Session()
    token = ""
    try:
        token = s.get(ACCENTURE_TOKEN, timeout=15).json().get("token", "")
    except Exception:
        pass
    return s, token


def scan_accenture(session: requests.Session, token: str, query: str, roles: list[str], locations: list[str], types: list[str], today) -> tuple[list[dict], dict]:
    stats = {"source": "Accenture", "query": query, "received": 0, "eligible": 0, "error": None}
    physical = [x for x in locations if x in {"Bengaluru", "Hyderabad", "Chennai"}]
    filters: list[dict[str, Any]] = []
    if physical and "Remote India" not in locations:
        filters.append({"fieldName": "location.keyword", "items": physical, "multiSelect": False})
    filters.append({"fieldName": "yearsOfExperience.keyword", "items": ["Experience: 0-2 years"], "multiSelect": False})
    form = {
        "startIndex": "0", "maxResultSize": "100", "jobKeyword": query,
        "jobCountry": "India", "jobLanguage": "en", "countrySite": "in-en",
        "sortBy": "0", "searchType": "vectorSearch", "enableQueryBoost": "true",
        "minScore": "0.4", "getFeedbackJudgmentEnabled": "true", "useCleanEmbedding": "true",
        "score": "true", "totalHits": "true", "debugQuery": "false", "jobFilters": json.dumps(filters),
    }
    try:
        r = session.post(ACCENTURE_SEARCH, data=form, headers={"CSRF-Token": token, "User-Agent": "AnalyticsJobScout/1.0"}, timeout=40)
        r.raise_for_status()
        raw_jobs = r.json().get("data", [])
        stats["received"] = len(raw_jobs)
    except Exception as exc:
        stats["error"] = str(exc)
        return [], stats

    out = []
    for x in raw_jobs:
        loc_raw = " ".join(x.get("location") or [])
        location = normalize_location(loc_raw + " " + str(x.get("remoteType") or ""))
        if not wanted_location(location, locations):
            continue
        try:
            posted = datetime.fromisoformat(x.get("updateDate", "")).astimezone(TZ).date()
        except (ValueError, TypeError):
            continue
        days = (today - posted).days
        if days < 0 or days > 15:
            continue
        title = clean_html(x.get("title"))
        if not title or SENIOR_TITLE.search(title):
            continue
        description = clean_html(x.get("jobDescriptionClean") or x.get("jobDescription"))
        qualification = clean_html(x.get("qualificationClean") or x.get("qualification"))
        category = clean_html(x.get("yearsOfExperience"))
        job_type = clean_html(x.get("jobTypeDescription"))
        is_intern = bool(re.search(r"(?i)\bintern(ship)?\b", " ".join((title, job_type, description[:500]))))
        if not wanted_type(is_intern, types):
            continue
        nums = experience_numbers(" ".join((category, qualification, description[:1200])))
        if any(n >= 3 for n in nums):
            continue
        exp_min = max(nums) if nums else 0
        exp_label = "Internship" if is_intern else (f"{exp_min}+ years" if nums else category.replace("Experience:", "").strip() or "0–2 years")
        full_text = " ".join((title, description, qualification, x.get("jobProfile") or ""))
        skills = find_skills(full_text)
        if len(skills) < 2 or not analytics_title_fit(title, skills) or not role_matches(title, full_text, roles, is_intern):
            continue
        guid = str(x.get("guid") or "").strip()
        job_id = guid.removesuffix("_en") or clean_html(x.get("requisitionId"))
        detail = (x.get("jobDetailUrl") or "").replace("{0}", "in-en")
        apply_url = f"https://mycareer.accenture.com/?source=careers&JRID={job_id}"
        if not job_id or not detail:
            continue
        out.append({
            "id": job_id, "company": "Accenture", "title": title, "location": location,
            "date": posted.isoformat(), "days": days, "window": "fresh" if days <= 5 else "backup",
            "score": score_job(skills, exp_min, days, title, is_intern),
            "type": "Internship" if is_intern else "Full-time",
            "exp": exp_label + (" · official tag 0–2" if not is_intern else ""),
            "recruiter": "Not disclosed", "skills": skills,
            "fit": fit_text(skills, exp_label, is_intern), "detail": detail, "apply": apply_url,
            "source": "Accenture Careers official API", "verified": True,
        })
    stats["eligible"] = len(out)
    return out, stats


def scan(preferences: dict[str, Any]) -> dict[str, Any]:
    started = now_local()
    today = started.date()
    roles = [x for x in preferences.get("roles", []) if x in ROLE_QUERIES] or list(ROLE_QUERIES)
    locations = [x for x in preferences.get("locations", []) if x in {"Bengaluru", "Hyderabad", "Chennai", "Remote India"}] or ["Hyderabad", "Bengaluru", "Chennai", "Remote India"]
    types = [x for x in preferences.get("types", []) if x in {"jobs", "internships"}] or ["jobs", "internships"]
    queries = list(dict.fromkeys(ROLE_QUERIES[x] for x in roles))
    if "internships" in types:
        queries.append("data analytics intern")
    queries = list(dict.fromkeys(queries))

    all_jobs: dict[str, dict] = {}
    source_stats = []
    session, token = accenture_session()
    for query in queries:
        for runner in (
            lambda q=query: scan_amazon(q, roles, locations, types, today),
            lambda q=query: scan_accenture(session, token, q, roles, locations, types, today),
        ):
            rows, stats = runner()
            source_stats.append(stats)
            for job in rows:
                key = f"{job['company'].lower()}:{job['id']}"
                prior = all_jobs.get(key)
                if not prior or job["score"] > prior["score"]:
                    all_jobs[key] = job

    # Collapse same-day requisition clones while preserving skill-distinct variants.
    clusters: dict[tuple, dict] = {}
    suppressed: dict[tuple, list[str]] = {}
    for job in all_jobs.values():
        base_title = re.sub(r"(?i)\s+(?:[ivx]+|\d+)\s*$", "", job["title"])
        base_title = re.sub(r"[^a-z0-9]+", " ", base_title.lower()).strip()
        key = (job["company"], job["location"], base_title, tuple(sorted(job["skills"])), job["type"])
        prior = clusters.get(key)
        if prior is None:
            clusters[key] = job
            suppressed[key] = []
        else:
            winner, loser = (job, prior) if (job["days"], -job["score"]) < (prior["days"], -prior["score"]) else (prior, job)
            clusters[key] = winner
            suppressed[key].append(loser["id"])
    jobs = sorted(clusters.values(), key=lambda j: (j["days"], -j["score"], j["company"], j["title"]))[:100]
    duplicate_groups = [
        {"kept_job_id": clusters[key]["id"], "company": clusters[key]["company"], "title": clusters[key]["title"], "suppressed_job_ids": ids}
        for key, ids in suppressed.items() if ids
    ]
    fresh = sum(j["window"] == "fresh" for j in jobs)
    internships = sum(j["type"] == "Internship" for j in jobs)
    result = {
        "scan_date": today.isoformat(),
        "scanned_at": started.isoformat(timespec="seconds"),
        "timezone": "Asia/Kolkata",
        "preferences": {"roles": roles, "locations": locations, "types": types},
        "summary": {"total": len(jobs), "fresh": fresh, "backup": len(jobs) - fresh, "internships": internships, "duplicates_suppressed": sum(len(g["suppressed_job_ids"]) for g in duplicate_groups)},
        "jobs": jobs,
        "duplicate_groups": duplicate_groups,
        "source_stats": source_stats,
        "sources": ["Amazon Jobs", "Accenture Careers"],
        "policy": "Official company sources only; dates explicit; 0–15 days; minimum experience <=2; no senior titles; 2+ target skills.",
    }
    return result


def cache_key(preferences: dict[str, Any]) -> str:
    normalized = json.dumps(preferences, sort_keys=True, separators=(",", ":"))
    return hashlib.sha1(normalized.encode()).hexdigest()[:10]


def save_scan(data: dict[str, Any], preferences: dict[str, Any]) -> Path:
    key = cache_key(preferences)
    path = DATA_DIR / f"daily_scan_{data['scan_date']}_{key}.json"
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    (DATA_DIR / "latest.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    return path


def latest_scan() -> dict[str, Any] | None:
    path = DATA_DIR / "latest.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


class Handler(SimpleHTTPRequestHandler):
    server_version = "AnalyticsJobScout/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, payload: Any, status: int = 200):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/api/health":
            latest = latest_scan()
            self.send_json({"ok": True, "date": now_local().date().isoformat(), "latest_scan": latest.get("scan_date") if latest else None})
            return
        if path == "/api/latest":
            latest = latest_scan()
            self.send_json({"found": bool(latest), "data": latest})
            return
        # Support GitHub Pages subpath /analytics-job-scout/ and root routing
        if path == "/" or path == "/analytics-job-scout":
            self.send_response(302)
            self.send_header("Location", "/analytics-job-scout/")
            self.end_headers()
            return
        if path == "/analytics-job-scout/":
            self.path = "/docs/index.html"
            if parsed.query:
                self.path += "?" + parsed.query
        elif path.startswith("/analytics-job-scout/"):
            rel = path[len("/analytics-job-scout/"):]
            self.path = "/docs/" + rel
            if parsed.query:
                self.path += "?" + parsed.query
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/scan":
            self.send_json({"error": "Not found"}, 404)
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 100_000)
            body = json.loads(self.rfile.read(length) or b"{}")
            preferences = {
                "roles": body.get("roles", []),
                "locations": body.get("locations", []),
                "types": body.get("types", []),
            }
            today = now_local().date().isoformat()
            key = cache_key(preferences)
            path = DATA_DIR / f"daily_scan_{today}_{key}.json"
            if path.exists() and not body.get("force"):
                data = json.loads(path.read_text(encoding="utf-8"))
                data["cache_hit"] = True
            else:
                data = scan(preferences)
                save_scan(data, preferences)
                data["cache_hit"] = False
            self.send_json(data)
        except Exception as exc:
            traceback.print_exc()
            self.send_json({"error": str(exc), "detail": "The scan failed. Existing saved results are still available."}, 500)

    def log_message(self, fmt: str, *args):
        sys.stdout.write("[%s] %s\n" % (now_local().strftime("%Y-%m-%d %H:%M:%S"), fmt % args))
        sys.stdout.flush()


def scan_only(output: str):
    preferences = {
        "roles": list(ROLE_QUERIES),
        "locations": ["Hyderabad", "Bengaluru", "Chennai", "Remote India"],
        "types": ["jobs", "internships"],
    }
    path = Path(output).resolve()
    from scanner.engine import run_full_scan
    data = run_full_scan(preferences=preferences, output_path=path, check_live_http=True)
    print(f"Daily scan written to {path}")
    print(json.dumps(data["summary"], indent=2))


def main():
    if "--scan-only" in sys.argv:
        output = "docs/data/latest.json"
        if "--output" in sys.argv:
            try:
                output = sys.argv[sys.argv.index("--output") + 1]
            except IndexError:
                raise SystemExit("--output requires a path")
        scan_only(output)
        return
    host = "0.0.0.0"
    port = int(next((arg for arg in sys.argv[1:] if arg.isdigit()), "8000"))
    print(f"Analytics Job Scout running on http://{host}:{port}", flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
