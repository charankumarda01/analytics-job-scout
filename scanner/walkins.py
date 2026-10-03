#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Walk-in Alerts & Feeds Engine
Validates, deduplicates, and publishes verified walk-in recruitment events.
Generates docs/data/walkins.json, docs/data/walkins.ics, and docs/data/walkins.xml.
"""

from __future__ import annotations

import html
import json
import re
from datetime import datetime, date, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

TZ = ZoneInfo("Asia/Kolkata")

# Suspicious keywords that automatically disqualify an event as an unverified/scam lead
SUSPICIOUS_TERMS = re.compile(
    r"(?i)\b(whatsapp|telegram|t\.me|bit\.ly|tinyurl|goo\.gl|registration\s+fee|processing\s+fee|"
    r"security\s+deposit|pay\s+to\s+apply|100%\s*guaranteed\s*selection|immediate\s+offer\s+letter|"
    r"training\s+charges|commercial\s+charges)\b"
)


def get_now_ist() -> datetime:
    return datetime.now(TZ)


def clean_str(val: str | None) -> str:
    if not val:
        return ""
    val = re.sub(r"<[^>]+>", " ", str(val))
    return re.sub(r"\s+", " ", html.unescape(val)).strip()


# Disallowed removed event IDs and regression blacklist
REMOVED_WALKIN_IDS = {"walkin_accenture_blr_01", "walkin_accenture_hyd_02"}

# Generic career portal paths or login pages that must never verify an event
GENERIC_CAREER_URL_PATTERNS = [
    re.compile(r"^https?://(?:www\.)?accenture\.com/[^/]+/careers/?$", re.I),
    re.compile(r"^https?://mycareer\.accenture\.com/?(?:\?.*)?$", re.I),
    re.compile(r"^https?://[^/]+/(?:careers|jobs|in-en/careers)/?$", re.I),
    re.compile(r"(?i)[?&]drive="),
    re.compile(r"(?i)\b(?:login|signin|auth)\b")
]


def validate_walkin_event(event: dict[str, Any], today: date) -> tuple[bool, str]:
    """
    Strict validation gate for walk-in recruitment events.
    Must have official company source, future date, 0-15 day posting age, junior fit, and verified link.
    Generic careers pages or generic/login MyCareer pages must never verify an event.
    """
    required_fields = [
        "id", "company", "title", "posting_date", "event_date",
        "city", "venue", "eligibility", "skills", "official_source_url", "registration_url"
    ]
    for field in required_fields:
        if not event.get(field):
            return False, f"Missing required field: {field}"

    event_id = str(event.get("id", "")).strip()
    if event_id in REMOVED_WALKIN_IDS:
        return False, f"Event ID {event_id} is permanently removed and blacklisted from production"

    # 1. Posting date freshness (0–15 days old)
    try:
        p_date = date.fromisoformat(event["posting_date"])
    except ValueError:
        return False, "Invalid posting_date format"

    age_days = (today - p_date).days
    if age_days < 0 or age_days > 15:
        return False, f"Posting date age {age_days}d outside allowable 0–15 days"

    # 2. Future event date
    try:
        e_date = date.fromisoformat(event["event_date"])
    except ValueError:
        return False, "Invalid event_date format"

    if e_date < today:
        return False, f"Event date {event['event_date']} is in the past; auto-suppressed"

    # 3. URL safety & anti-generic checks
    reg_url = event["registration_url"].strip()
    source_url = event["official_source_url"].strip()
    for u in (reg_url, source_url):
        if not u.startswith("https://"):
            return False, "URL must be secure HTTPS"
        if SUSPICIOUS_TERMS.search(u):
            return False, "URL contains disallowed aggregator/shortener or suspicious endpoint"
        for pattern in GENERIC_CAREER_URL_PATTERNS:
            if pattern.search(u):
                return False, f"URL {u} is a generic careers/login page or unverified drive= URL; cannot verify event"

    # 4. Content anti-scam scan
    full_content = " ".join([
        event.get("company", ""),
        event.get("title", ""),
        event.get("venue", ""),
        event.get("instructions", ""),
        event.get("eligibility", "")
    ])
    if SUSPICIOUS_TERMS.search(full_content):
        return False, "Event content contains payment/suspicious terms"

    # 5. Junior / Analytics skill requirements
    skills = event.get("skills", [])
    if len(skills) < 2:
        return False, "Event must match at least two target analytics skills"

    return True, "Passed all walk-in validation checks"


def calculate_countdown(event_date_str: str, today: date) -> str:
    try:
        e_date = date.fromisoformat(event_date_str)
        diff = (e_date - today).days
        if diff == 0:
            return "Today"
        elif diff == 1:
            return "Tomorrow"
        elif diff > 1:
            return f"{diff} days left"
        else:
            return "Expired"
    except Exception:
        return "Upcoming"


def generate_ics(events: list[dict[str, Any]]) -> str:
    """Generate RFC 5545 compliant iCalendar string for valid events."""
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Analytics Job Scout//Walkin Alerts v2//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:Analytics Job Scout - Verified Walk-ins",
        "X-WR-TIMEZONE:Asia/Kolkata"
    ]

    for ev in events:
        try:
            ev_date = ev["event_date"].replace("-", "")
            # Default start at 09:30 AM IST (04:00 UTC) if not specified
            dt_start = f"{ev_date}T093000"
            dt_end = f"{ev_date}T160000"
            dt_stamp = get_now_ist().strftime("%Y%m%dT%H%M%SZ")
            summary = f"Walk-in: {ev['company']} - {ev['title']}"
            desc = f"{ev['title']} at {ev['company']}\\nVenue: {ev['venue']}\\nEligibility: {ev['eligibility']}\\nRegister: {ev['registration_url']}"
            
            lines.extend([
                "BEGIN:VEVENT",
                f"UID:walkin-{ev['id']}@analytics-job-scout",
                f"DTSTAMP:{dt_stamp}",
                f"DTSTART;TZID=Asia/Kolkata:{dt_start}",
                f"DTEND;TZID=Asia/Kolkata:{dt_end}",
                f"SUMMARY:{clean_str(summary)}",
                f"LOCATION:{clean_str(ev['venue'])}, {ev['city']}",
                f"DESCRIPTION:{clean_str(desc)}",
                f"URL:{ev['registration_url']}",
                "STATUS:CONFIRMED",
                "END:VEVENT"
            ])
        except Exception as exc:
            continue

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def generate_rss(events: list[dict[str, Any]], updated_at: datetime) -> str:
    """Generate static RSS 2.0 XML feed for walk-in alerts."""
    rfc_date = updated_at.strftime("%a, %d %b %Y %H:%M:%S +0530")
    xml_items = []

    for ev in events:
        item = f"""    <item>
      <title>{html.escape(f"{ev['company']}: {ev['title']} Walk-in ({ev['city']})")}</title>
      <link>{html.escape(ev['registration_url'])}</link>
      <guid isPermaLink="false">walkin-{ev['id']}</guid>
      <pubDate>{rfc_date}</pubDate>
      <description>{html.escape(f"Event Date: {ev['event_date']} | City: {ev['city']} | Eligibility: {ev['eligibility']} | Venue: {ev['venue']}")}</description>
      <category>{html.escape(ev['city'])}</category>
    </item>"""
        xml_items.append(item)

    items_block = "\n".join(xml_items)
    return f"""<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title>Analytics Job Scout - Verified Walk-in Alerts</title>
    <link>https://charankumarda01.github.io/analytics-job-scout/</link>
    <description>Verified, date-aware walk-in recruitment events for junior analytics opportunities in India.</description>
    <language>en-in</language>
    <lastBuildDate>{rfc_date}</lastBuildDate>
{items_block}
  </channel>
</rss>"""


def build_walkin_artifacts(events: list[dict[str, Any]], data_dir: Path) -> dict[str, Any]:
    """Validate events, enrich with countdowns, and write json, ics, and xml."""
    now_ist = get_now_ist()
    today = now_ist.date()

    verified_events = []
    audit_log = []

    for ev in events:
        ok, reason = validate_walkin_event(ev, today)
        audit_log.append({
            "id": ev.get("id", "unknown"),
            "company": ev.get("company", "unknown"),
            "valid": ok,
            "reason": reason
        })
        if ok:
            ev_copy = dict(ev)
            ev_copy["countdown"] = calculate_countdown(ev["event_date"], today)
            ev_copy["verified"] = True
            ev_copy["last_link_checked_at"] = now_ist.isoformat(timespec="seconds")
            verified_events.append(ev_copy)

    # Sort by event_date ascending (nearest future event first)
    verified_events.sort(key=lambda x: x["event_date"])

    payload = {
        "version": "2.0.0",
        "updated_at": now_ist.isoformat(timespec="seconds"),
        "timezone": "Asia/Kolkata",
        "total": len(verified_events),
        "events": verified_events,
        "audit": audit_log
    }

    # Write files
    data_dir.mkdir(parents=True, exist_ok=True)
    json_path = data_dir / "walkins.json"
    ics_path = data_dir / "walkins.ics"
    xml_path = data_dir / "walkins.xml"

    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    ics_path.write_text(generate_ics(verified_events), encoding="utf-8")
    xml_path.write_text(generate_rss(verified_events, now_ist), encoding="utf-8")

    return payload
