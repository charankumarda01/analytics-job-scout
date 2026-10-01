#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Base Adapter & Analytical Filters
Common rule evaluations, skill extraction, junior experience qualification, and scoring.
"""

from __future__ import annotations

import html
import re
from datetime import date
from typing import Any

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
    r"(?i)\b(senior|sr\.?|lead|manager|director|principal|head|vice president|vp|staff|architect)\b|"
    r"\banalyst\s+(?:ii|iii|iv)\b|\bdata scientist\s+(?:ii|iii|iv)\b"
)

ROLE_QUERIES = {
    "data-analyst": "data analyst",
    "sql": "SQL analyst",
    "power-bi": "Power BI analyst",
    "analytics": "analytics reporting",
    "any-analyst": "business analyst",
    "data-scientist": "data scientist",
}


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
    for m in re.finditer(r"\b(\d{1,2})\s*\+\s*(?:years?|yrs?)\s+of\b", text_no_ranges):
        nums.append(int(m.group(1)))
    return nums


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


def analytics_title_fit(title: str, skills: list[str]) -> bool:
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
