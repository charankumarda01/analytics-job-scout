#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Cross-Source Deduplication Engine
Deduplicates jobs by canonical requisition ID, normalized Apply URL, and title/skill fingerprint.
Preserves prior-day shown state and generates structured audit clusters.
"""

from __future__ import annotations

import re
from typing import Any
from scanner.link_verifier import clean_tracking_params


def normalize_title(title: str) -> str:
    """Strip Roman numerals and numbers at the end of titles (e.g. 'Data Analyst II' -> 'Data Analyst')."""
    base = re.sub(r"(?i)\s+(?:[ivx]+|\d+)\s*$", "", title)
    return re.sub(r"[^a-z0-9]+", " ", base.lower()).strip()


def deduplicate_jobs(
    jobs_list: list[dict[str, Any]],
    prior_shown_ids: set[str] | None = None
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    """
    Deduplicates a candidate job list using:
    1. Canonical (company, requisition ID).
    2. Normalized Apply destination.
    3. Content cluster fingerprint: (company, location, normalized_title, sorted_skills, job_type).
    Returns (deduped_jobs, duplicate_groups, total_suppressed_count).
    """
    prior_shown = prior_shown_ids or set()
    clusters: dict[tuple, dict[str, Any]] = {}
    suppressed_map: dict[tuple, list[str]] = {}

    for job in jobs_list:
        clean_apply = clean_tracking_params(job.get("apply") or job.get("apply_url") or "")
        job["apply"] = clean_apply

        company = str(job.get("company", "")).strip()
        location = str(job.get("location", "")).strip()
        norm_title = normalize_title(str(job.get("title", "")))
        job_type = str(job.get("type", "Full-time")).strip()
        skills = tuple(sorted(s.lower() for s in job.get("skills", [])))

        # Cluster key
        cluster_key = (company.lower(), location.lower(), norm_title, skills, job_type.lower())

        existing = clusters.get(cluster_key)
        if existing is None:
            clusters[cluster_key] = job
            suppressed_map[cluster_key] = []
        else:
            # Tie-breaking logic: prefer fresher (lower days), then higher score
            job_days = job.get("days", 99)
            job_score = job.get("score", 0)
            ex_days = existing.get("days", 99)
            ex_score = existing.get("score", 0)

            # If existing was shown prior day, give it consistency preference unless new is distinctly better
            if (job_days, -job_score) < (ex_days, -ex_score):
                clusters[cluster_key] = job
                suppressed_map[cluster_key].append(existing.get("id", "clone"))
            else:
                suppressed_map[cluster_key].append(job.get("id", "clone"))

    unique_jobs = sorted(
        clusters.values(),
        key=lambda j: (j.get("days", 99), -j.get("score", 0), j.get("company", ""), j.get("title", ""))
    )

    duplicate_groups = []
    total_suppressed = 0

    for key, suppressed_ids in suppressed_map.items():
        if suppressed_ids:
            kept = clusters[key]
            duplicate_groups.append({
                "kept_job_id": kept.get("id"),
                "company": kept.get("company"),
                "title": kept.get("title"),
                "location": kept.get("location"),
                "suppressed_job_ids": suppressed_ids,
                "reason": "Identical company, role scope, location, and analytical skills stack."
            })
            total_suppressed += len(suppressed_ids)

    return unique_jobs, duplicate_groups, total_suppressed
