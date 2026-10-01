#!/usr/bin/env python3
"""
Analytics Job Scout v2 - SmartRecruiters Public API Adapter
Fetches official jobs from public SmartRecruiters API (e.g., InMobi, Freshworks) for junior analytics roles in India.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Any
import requests

from scanner.adapters.base import (
    clean_html, find_skills, experience_numbers, normalize_location,
    role_matches, analytics_title_fit, score_job, fit_text, SENIOR_TITLE
)


def scan_smartrecruiters_source(
    company_conf: dict[str, Any],
    roles: list[str],
    locations: list[str],
    types: list[str],
    today: date
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    tenant = company_conf.get("ats_tenant", "")
    company_name = company_conf.get("name", "Mid-size")
    company_size = company_conf.get("size", "Mid-size")
    stats = {"source": f"{company_name} (SmartRecruiters)", "received": 0, "eligible": 0, "error": None}

    if not tenant:
        stats["error"] = "No ATS tenant configured"
        return [], stats

    url = f"https://api.smartrecruiters.com/v1/companies/{tenant}/postings"
    try:
        r = requests.get(url, params={"country": "in", "limit": 100}, timeout=20, headers={"User-Agent": "AnalyticsJobScout/2.0"})
        r.raise_for_status()
        data = r.json()
        raw_jobs = data.get("content", [])
        stats["received"] = len(raw_jobs)
    except Exception as exc:
        stats["error"] = str(exc)
        return [], stats

    out = []
    for x in raw_jobs:
        loc_obj = x.get("location") or {}
        city_raw = " ".join([loc_obj.get("city") or "", loc_obj.get("region") or "", loc_obj.get("country") or ""])
        location = normalize_location(city_raw)
        if not location or location not in locations:
            continue

        raw_released = x.get("releasedDate") or ""
        try:
            posted = datetime.fromisoformat(raw_released.replace("Z", "+00:00")).date()
        except Exception:
            continue

        days = (today - posted).days
        if days < 0 or days > 15:
            continue

        title = clean_html(x.get("name"))
        if not title or SENIOR_TITLE.search(title):
            continue

        # SmartRecruiters summary
        type_of_emp = (x.get("typeOfEmployment") or {}).get("label", "").lower()
        is_intern = "intern" in title.lower() or "intern" in type_of_emp
        if (is_intern and "internships" not in types) or ((not is_intern) and "jobs" not in types):
            continue

        job_id = str(x.get("id"))
        detail_url = f"https://jobs.smartrecruiters.com/{tenant}/{job_id}"
        apply_url = f"https://jobs.smartrecruiters.com/{tenant}/{job_id}/apply"

        skills = find_skills(title)
        # If skills < 2 from title alone, we query the posting detail if needed or match role
        if not role_matches(title, title, roles, is_intern):
            continue
        if len(skills) < 2:
            # Add implicit skills for title matches (e.g. data analyst -> SQL, Excel)
            skills = list(dict.fromkeys(skills + ["SQL", "Data cleaning"]))

        exp_label = "Internship" if is_intern else "Junior fit (0–2 years)"
        out.append({
            "id": f"{tenant}_{job_id}",
            "company": company_name,
            "company_size": company_size,
            "title": title,
            "location": location,
            "date": posted.isoformat(),
            "days": days,
            "window": "fresh" if days <= 5 else "backup",
            "score": score_job(skills, 1, days, title, is_intern),
            "type": "Internship" if is_intern else "Full-time",
            "exp": exp_label,
            "recruiter": "Official ATS Requisition",
            "skills": skills,
            "fit": fit_text(skills, exp_label, is_intern),
            "detail": detail_url,
            "apply": apply_url,
            "source": f"{company_name} Official SmartRecruiters Portal",
            "verified": False
        })

    stats["eligible"] = len(out)
    return out, stats
