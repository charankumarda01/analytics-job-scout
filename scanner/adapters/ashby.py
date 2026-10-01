#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Ashby Public Board Adapter
Fetches official jobs from public Ashby boards (e.g., Zepto, CRED) for junior analytics roles in India.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Any
import requests

from scanner.adapters.base import (
    clean_html, find_skills, experience_numbers, normalize_location,
    role_matches, analytics_title_fit, score_job, fit_text, SENIOR_TITLE
)


def scan_ashby_source(
    company_conf: dict[str, Any],
    roles: list[str],
    locations: list[str],
    types: list[str],
    today: date
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    tenant = company_conf.get("ats_tenant", "")
    company_name = company_conf.get("name", "Startup")
    company_size = company_conf.get("size", "Startup")
    stats = {"source": f"{company_name} (Ashby)", "received": 0, "eligible": 0, "error": None}

    if not tenant:
        stats["error"] = "No ATS tenant configured"
        return [], stats

    url = f"https://api.ashbyhq.com/posting-api/job-board/{tenant}"
    try:
        r = requests.get(url, timeout=20, headers={"User-Agent": "AnalyticsJobScout/2.0"})
        r.raise_for_status()
        data = r.json()
        raw_jobs = data.get("jobs", [])
        stats["received"] = len(raw_jobs)
    except Exception as exc:
        stats["error"] = str(exc)
        return [], stats

    out = []
    for x in raw_jobs:
        loc_str = " ".join([x.get("location") or "", str(x.get("address") or "")])
        location = normalize_location(loc_str)
        if not location or location not in locations:
            continue

        raw_published = x.get("publishedAt") or x.get("updatedAt") or ""
        try:
            posted = datetime.fromisoformat(raw_published.replace("Z", "+00:00")).date()
        except Exception:
            continue

        days = (today - posted).days
        if days < 0 or days > 15:
            continue

        title = clean_html(x.get("title"))
        if not title or SENIOR_TITLE.search(title):
            continue

        desc = clean_html(x.get("descriptionHtml") or x.get("description") or "")
        nums = experience_numbers(desc)
        exp_min = min(nums) if nums else 0
        if exp_min > 2:
            continue

        is_intern = "intern" in title.lower() or (x.get("employmentType") or "").lower() == "intern"
        if (is_intern and "internships" not in types) or ((not is_intern) and "jobs" not in types):
            continue

        full_text = " ".join((title, desc))
        skills = find_skills(full_text)
        if len(skills) < 2 or not analytics_title_fit(title, skills) or not role_matches(title, full_text, roles, is_intern):
            continue

        job_id = str(x.get("id"))
        job_url = x.get("jobUrl") or f"https://jobs.ashbyhq.com/{tenant}/{job_id}"
        apply_url = x.get("applyUrl") or f"{job_url}/application"

        exp_label = "Internship" if is_intern else (f"{exp_min}+ years" if nums else "Junior level")
        out.append({
            "id": f"{tenant}_{job_id}",
            "company": company_name,
            "company_size": company_size,
            "title": title,
            "location": location,
            "date": posted.isoformat(),
            "days": days,
            "window": "fresh" if days <= 5 else "backup",
            "score": score_job(skills, exp_min, days, title, is_intern),
            "type": "Internship" if is_intern else "Full-time",
            "exp": exp_label,
            "recruiter": "Official ATS Requisition",
            "skills": skills,
            "fit": fit_text(skills, exp_label, is_intern),
            "detail": job_url,
            "apply": apply_url,
            "source": f"{company_name} Official Ashby Board",
            "verified": False
        })

    stats["eligible"] = len(out)
    return out, stats
