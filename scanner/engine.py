#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Master Scanner Engine
Orchestrates multi-source scanning across curated company registry, executes authenticity checks,
strict live-link verification gate, deduplication, and writes verified payload.
"""

from __future__ import annotations

import json
from datetime import datetime, date
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

from scanner.registry import load_company_registry, is_allowed_domain
from scanner.link_verifier import verify_live_link, clean_tracking_params
from scanner.authenticity import audit_job_authenticity
from scanner.dedupe import deduplicate_jobs
from scanner.adapters.base import ROLE_QUERIES
from scanner.adapters.amazon import scan_amazon_source
from scanner.adapters.accenture import scan_accenture_source, get_accenture_session
from scanner.adapters.greenhouse import scan_greenhouse_source
from scanner.adapters.lever import scan_lever_source
from scanner.adapters.ashby import scan_ashby_source
from scanner.adapters.smartrecruiters import scan_smartrecruiters_source

TZ = ZoneInfo("Asia/Kolkata")
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "docs" / "data"


def run_full_scan(
    preferences: dict[str, Any] | None = None,
    output_path: Path | None = None,
    check_live_http: bool = True
) -> dict[str, Any]:
    started_at = datetime.now(TZ)
    today = started_at.date()

    prefs = preferences or {}
    roles = [x for x in prefs.get("roles", []) if x in ROLE_QUERIES] or list(ROLE_QUERIES)
    locations = [x for x in prefs.get("locations", []) if x in {"Bengaluru", "Hyderabad", "Chennai", "Remote India"}] or ["Hyderabad", "Bengaluru", "Chennai", "Remote India"]
    types = [x for x in prefs.get("types", []) if x in {"jobs", "internships"}] or ["jobs", "internships"]

    # Load registry
    companies = load_company_registry()
    enabled_companies = [c for c in companies if c.get("enabled", True)]

    source_stats = []
    candidate_jobs = []
    suppressed_scam_count = 0
    suppressed_dead_link_count = 0
    audit_rejected_reasons = []

    # Prepare Accenture session once if needed
    accenture_session, accenture_token = (None, "")
    if any(c.get("ats_provider") == "accenture" for c in enabled_companies):
        try:
            accenture_session, accenture_token = get_accenture_session()
        except Exception as exc:
            source_stats.append({"source": "Accenture Session", "error": str(exc), "received": 0, "eligible": 0})

    # Scan each company via adapter
    for comp in enabled_companies:
        provider = comp.get("ats_provider", "").lower()
        comp_name = comp.get("name", "Company")

        try:
            if provider == "amazon":
                queries = list(dict.fromkeys(ROLE_QUERIES[r] for r in roles))
                if "internships" in types:
                    queries.append("data analytics intern")
                for q in queries:
                    rows, stat = scan_amazon_source(comp, q, roles, locations, types, today)
                    source_stats.append(stat)
                    candidate_jobs.extend(rows)

            elif provider == "accenture" and accenture_session:
                queries = list(dict.fromkeys(ROLE_QUERIES[r] for r in roles))
                if "internships" in types:
                    queries.append("data analytics intern")
                for q in queries:
                    rows, stat = scan_accenture_source(comp, accenture_session, accenture_token, q, roles, locations, types, today)
                    source_stats.append(stat)
                    candidate_jobs.extend(rows)

            elif provider == "greenhouse":
                rows, stat = scan_greenhouse_source(comp, roles, locations, types, today)
                source_stats.append(stat)
                candidate_jobs.extend(rows)

            elif provider == "lever":
                rows, stat = scan_lever_source(comp, roles, locations, types, today)
                source_stats.append(stat)
                candidate_jobs.extend(rows)

            elif provider == "ashby":
                rows, stat = scan_ashby_source(comp, roles, locations, types, today)
                source_stats.append(stat)
                candidate_jobs.extend(rows)

            elif provider == "smartrecruiters":
                rows, stat = scan_smartrecruiters_source(comp, roles, locations, types, today)
                source_stats.append(stat)
                candidate_jobs.extend(rows)

        except Exception as exc:
            source_stats.append({
                "source": comp_name,
                "error": f"Adapter error: {str(exc)[:120]}",
                "received": 0,
                "eligible": 0
            })

    # Strict Authenticity and Live-Link Validation Gates
    verified_jobs = []
    company_domain_map = {c["name"]: c.get("allowed_domains", []) for c in companies}

    for job in candidate_jobs:
        comp_name = job.get("company", "")
        allowed_domains = company_domain_map.get(comp_name, [])

        # 1. Authenticity check
        is_auth, auth_reason, auth_meta = audit_job_authenticity(job, allowed_domains)
        job["source_confidence"] = auth_meta.get("source_confidence", "High")
        if not is_auth:
            suppressed_scam_count += 1
            audit_rejected_reasons.append(f"{comp_name} ({job.get('id')}): {auth_reason}")
            continue

        # 2. Strict Live-Link Verification Gate
        apply_url = job.get("apply") or ""
        detail_url = job.get("detail") or ""
        link_ok, final_url, link_meta = verify_live_link(
            apply_url,
            allowed_domains,
            requisition_id=job.get("id"),
            timeout=10,
            check_http=check_live_http,
            verification_url=detail_url
        )
        job["apply"] = apply_url  # Keep the browser-facing official apply endpoint
        job["last_link_checked_at"] = link_meta.get("checked_at")

        if not link_ok:
            suppressed_dead_link_count += 1
            audit_rejected_reasons.append(f"{comp_name} ({job.get('id')}): Dead or expired link ({link_meta.get('reason')})")
            continue

        # Passes both gates
        job["verified"] = True
        verified_jobs.append(job)

    # Cross-source Deduplication
    unique_jobs, duplicate_groups, duplicates_suppressed = deduplicate_jobs(verified_jobs)

    # Format Priorities
    for i, j in enumerate(unique_jobs):
        j["priority"] = (i < 3)

    fresh_count = sum(1 for j in unique_jobs if j.get("window") == "fresh")
    backup_count = len(unique_jobs) - fresh_count
    internships_count = sum(1 for j in unique_jobs if j.get("type") == "Internship")

    # Source and Company Coverage Counts
    participating_sources = list(dict.fromkeys(c.get("name", "") for c in enabled_companies))

    payload = {
        "scan_date": today.isoformat(),
        "scanned_at": started_at.isoformat(timespec="seconds"),
        "timezone": "Asia/Kolkata",
        "preferences": {
            "roles": roles,
            "locations": locations,
            "types": types
        },
        "summary": {
            "total": len(unique_jobs),
            "fresh": fresh_count,
            "backup": backup_count,
            "internships": internships_count,
            "duplicates_suppressed": duplicates_suppressed,
            "suppressed_dead_links": suppressed_dead_link_count,
            "suppressed_scam_leads": suppressed_scam_count
        },
        "jobs": unique_jobs,
        "duplicate_groups": duplicate_groups,
        "source_stats": source_stats,
        "sources": participating_sources,
        "audit": {
            "companies_checked": len(enabled_companies),
            "total_received_raw": sum(s.get("received", 0) for s in source_stats),
            "total_eligible_before_gates": len(candidate_jobs),
            "passed_verification": len(unique_jobs),
            "rejected_samples": audit_rejected_reasons[:15]
        },
        "policy": "Official company sources only; explicit dates 0–15 days; junior requirements (<=2 yrs); no senior titles; 2+ target skills; HTTP 200 live-link verified."
    }

    # Write output
    target = output_path or (DATA_DIR / "latest.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    return payload
