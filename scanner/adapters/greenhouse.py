#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Greenhouse Public Board Adapter
Fetches official jobs from public Greenhouse boards (e.g., Swiggy, InMobi) for junior analytics openings in India.
"""

from __future__ import annotations

from datetime import datetime, date
from typing import Any
import requests

from scanner.adapters.base import (
    clean_html, find_skills, experience_numbers, normalize_location,
    role_matches, analytics_title_fit, score_job, fit_text, SENIOR_TITLE
)


def scan_greenhouse_source(
    company_conf: dict[str, Any],
    roles: list[str],
    locations: list[str],
    types: list[str],
    today: date
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    tenant = company_conf.get("ats_tenant", "")
    company_name = company_conf.get("name", "Startup")
    company_size = company_conf.get("size", "Mid-size")
    stats = {"source": f"{company_name} (Greenhouse)", "received": 0, "eligible": 0, "error": None}

    if not tenant:
        stats["error"] = "No ATS tenant configured"
        return [], stats

    url = f"https://boards-api.greenhouse.io/v1/boards/{tenant}/jobs?content=true"
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
        loc_obj = x.get("location") or {}
        loc_str = loc_obj.get("name", "") if isinstance(loc_obj, dict) else str(loc_obj)
        location = normalize_location(loc_str)
        if not location or location not in locations:
            continue

        raw_updated = x.get("updated_at") or ""
        try:
            posted = datetime.fromisoformat(raw_updated.replace("Z", "+00:00")).date()
        except Exception:
            continue

        days = (today - posted).days
        if days < 0 or days > 15:
            continue

        title = clean_html(x.get("title"))
        if not title or SENIOR_TITLE.search(title):
            continue

        content = clean_html(x.get("content"))
        nums = experience_numbers(content)
        exp_min = min(nums) if nums else 0
        if exp_min > 2:
            continue

        is_intern = "intern" in title.lower() or "intern" in content.lower()
        if (is_intern and "internships" not in types) or ((not is_intern) and "jobs" not in types):
            continue

        full_text = " ".join((title, content))
        skills = find_skills(full_text)
        if len(skills) < 2 or not analytics_title_fit(title, skills) or not role_matches(title, full_text, roles, is_intern):
            continue

        job_id = str(x.get("id"))
        detail_url = x.get("absolute_url") or f"https://boards.greenhouse.io/{tenant}/jobs/{job_id}"
        apply_url = detail_url  # Greenhouse job detail page embeds the official application form

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
            "detail": detail_url,
            "apply": apply_url,
            "source": f"{company_name} Official Greenhouse Board",
            "verified": False
        })

    stats["eligible"] = len(out)
    return out, stats
