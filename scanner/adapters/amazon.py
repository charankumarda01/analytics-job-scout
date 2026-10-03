#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Amazon Jobs Official Search Adapter
Queries Amazon Jobs public search API and filters for explicit dates, junior experience, and target skills.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Any
import requests

from scanner.adapters.base import (
    clean_html, find_skills, experience_numbers, normalize_location,
    role_matches, analytics_title_fit, score_job, fit_text, SENIOR_TITLE,
    SENIOR_DESCRIPTION, is_junior_eligible
)

AMAZON_SEARCH = "https://www.amazon.jobs/en/search.json"


def scan_amazon_source(
    company_conf: dict[str, Any],
    query: str,
    roles: list[str],
    locations: list[str],
    types: list[str],
    today: date
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    stats = {"source": "Amazon", "query": query, "received": 0, "eligible": 0, "error": None}
    try:
        r = requests.get(
            AMAZON_SEARCH,
            params={"base_query": query, "loc_query": "India", "result_limit": 100, "sort": "recent"},
            timeout=25,
            headers={"User-Agent": "AnalyticsJobScout/2.0"}
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
        if not location or location not in locations:
            continue

        try:
            posted = datetime.strptime(x.get("posted_date", ""), "%B %d, %Y").date()
        except ValueError:
            continue

        days = (today - posted).days
        if days < 0 or days > 15:
            continue

        title = clean_html(x.get("title"))
        basic = clean_html(x.get("basic_qualifications"))
        pref = clean_html(x.get("preferred_qualifications"))
        desc = clean_html(x.get("description"))

        is_intern = bool("intern" in title.lower() or "intern" in (x.get("job_schedule_type") or "").lower())
        if (is_intern and "internships" not in types) or ((not is_intern) and "jobs" not in types):
            continue

        exp_snippet = None
        exp_confidence = "High"
        if not is_intern:
            eligible, exp_min, exp_label, exp_snippet, exp_confidence = is_junior_eligible(title, basic, desc)
            if not eligible:
                continue
        else:
            if SENIOR_TITLE.search(title) or SENIOR_DESCRIPTION.search(f"{title} {desc}"):
                continue
            exp_min = 0
            exp_label = "Internship"
            exp_snippet = f'Internship posting: "{title}"'
            exp_confidence = "High"

        full_text = " ".join((title, basic, pref, desc))
        skills = find_skills(full_text)
        if len(skills) < 2 or not analytics_title_fit(title, skills) or not role_matches(title, full_text, roles, is_intern):
            continue

        job_path = (x.get("job_path") or "").lstrip("/")
        if job_path:
            if job_path.startswith("en/"):
                detail_url = f"https://www.amazon.jobs/{job_path}"
            else:
                detail_url = f"https://www.amazon.jobs/en/{job_path}"
        else:
            detail_url = f"https://www.amazon.jobs/en/jobs/{x.get('id_icims')}"
        apply_url = f"https://account.amazon.jobs/jobs/{x.get('id_icims')}/apply"
        out.append({
            "id": str(x.get("id_icims") or x.get("id")),
            "company": "Amazon",
            "company_size": company_conf.get("size", "Enterprise"),
            "title": title,
            "location": location,
            "date": posted.isoformat(),
            "days": days,
            "window": "fresh" if days <= 5 else "backup",
            "score": score_job(skills, exp_min, days, title, is_intern),
            "type": "Internship" if is_intern else "Full-time",
            "exp": exp_label,
            "exp_snippet": exp_snippet,
            "exp_confidence": exp_confidence,
            "recruiter": "Not disclosed",
            "skills": skills,
            "fit": fit_text(skills, exp_label, is_intern),
            "detail": detail_url,
            "apply": apply_url,
            "source": "Amazon Jobs official search",
            "verified": False  # Will be confirmed by the live-link verification gate!
        })

    stats["eligible"] = len(out)
    return out, stats
