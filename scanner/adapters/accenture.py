#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Accenture Careers Official API Adapter
Queries Accenture public elastic findjobs API and filters for explicit dates, junior tags, and target skills.
"""

from __future__ import annotations

import re
from datetime import datetime, date
from typing import Any
import requests

from scanner.adapters.base import (
    clean_html, find_skills, experience_numbers, normalize_location,
    role_matches, analytics_title_fit, score_job, fit_text, SENIOR_TITLE,
    SENIOR_DESCRIPTION
)

ACCENTURE_SEARCH = "https://www.accenture.com/api/accenture/elastic/findjobs"
ACCENTURE_TOKEN = "https://www.accenture.com/libs/granite/csrf/token.json"


def get_accenture_session() -> tuple[requests.Session, str]:
    session = requests.Session()
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.accenture.com/in-en/careers/jobsearch",
        "Origin": "https://www.accenture.com",
    })
    token = ""
    try:
        r = session.get(ACCENTURE_TOKEN, timeout=15)
        if r.ok:
            token = r.json().get("token", "")
    except Exception:
        pass
    return session, token


def scan_accenture_source(
    company_conf: dict[str, Any],
    session: requests.Session,
    csrf_token: str,
    query: str,
    roles: list[str],
    locations: list[str],
    types: list[str],
    today: date
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    stats = {"source": "Accenture", "query": query, "received": 0, "eligible": 0, "error": None}
    headers = {"CSRF-Token": csrf_token} if csrf_token else {}
    payload = {
        "keywords": query,
        "country": "India",
        "start": 0,
        "size": 100,
        "sortBy": "relevance",
        "sortOrder": "desc",
        "locale": "en",
    }
    try:
        r = session.post(ACCENTURE_SEARCH, json=payload, headers=headers, timeout=25)
        r.raise_for_status()
        raw_jobs = r.json().get("results", [])
        stats["received"] = len(raw_jobs)
    except Exception as exc:
        stats["error"] = str(exc)
        return [], stats

    out = []
    for x in raw_jobs:
        city_raw = " ".join([x.get("city") or "", x.get("state") or "", x.get("location") or ""])
        location = normalize_location(city_raw)
        if not location or location not in locations:
            continue

        raw_posted = x.get("postedDate") or x.get("posted_date") or ""
        try:
            posted = datetime.fromisoformat(raw_posted.replace("Z", "+00:00")).date() if "T" in raw_posted else datetime.strptime(raw_posted[:10], "%Y-%m-%d").date()
        except Exception:
            continue

        days = (today - posted).days
        if days < 0 or days > 15:
            continue

        title = clean_html(x.get("title"))
        if not title or SENIOR_TITLE.search(title):
            continue

        description = clean_html(x.get("description"))
        qualification = clean_html(x.get("qualification"))
        category = clean_html(x.get("jobCategory") or "")
        experience_tag = x.get("experienceTag") or x.get("experience") or ""

        # Junior fit checks
        if SENIOR_TITLE.search(title) or SENIOR_DESCRIPTION.search(description + " " + qualification):
            continue
        nums = experience_numbers(qualification + " " + description)
        if any(n > 2 for n in nums):
            continue
        exp_min = max(nums) if nums else 0
        if exp_min > 2:
            continue

        is_intern = "intern" in title.lower() or "intern" in category.lower()
        if (is_intern and "internships" not in types) or ((not is_intern) and "jobs" not in types):
            continue

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
            "id": job_id,
            "company": "Accenture",
            "company_size": company_conf.get("size", "Enterprise"),
            "title": title,
            "location": location,
            "date": posted.isoformat(),
            "days": days,
            "window": "fresh" if days <= 5 else "backup",
            "score": score_job(skills, exp_min, days, title, is_intern),
            "type": "Internship" if is_intern else "Full-time",
            "exp": exp_label + (" · official tag 0–2" if not is_intern else ""),
            "recruiter": "Not disclosed",
            "skills": skills,
            "fit": fit_text(skills, exp_label, is_intern),
            "detail": detail,
            "apply": apply_url,
            "source": "Accenture Careers official API",
            "verified": False  # Evaluated by link verifier
        })

    stats["eligible"] = len(out)
    return out, stats
