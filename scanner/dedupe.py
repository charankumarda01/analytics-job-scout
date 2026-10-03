#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Cross-Source Deduplication Engine
Explicit ordered deduplication:
1. Company + canonical requisition ID
2. Canonical official detail/Apply URL
3. Conservative company/title/location/role fingerprint

Guarantees:
- Normalizes URLs safely while preserving IDs needed to distinguish requisitions.
- Suppressed IDs are strictly unique per group and overall.
- Kept ID never appears in suppressed_job_ids.
- Copies returned by multiple search terms count as one canonical job.
- duplicates_suppressed equals the exact count of unique removed records.
- Never merges different requisitions solely because titles are similar.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from scanner.link_verifier import clean_tracking_params


def normalize_title(title: str) -> str:
    """Strip Roman numerals and numbers at the end of titles (e.g. 'Data Analyst II' -> 'Data Analyst')."""
    base = re.sub(r"(?i)\s+(?:[ivx]+|\d+)\s*$", "", title)
    return re.sub(r"[^a-z0-9]+", " ", base.lower()).strip()


def extract_requisition_id(job: dict[str, Any]) -> str:
    """Extract or return canonical requisition ID from job record."""
    job_id = str(job.get("id") or "").strip()
    if job_id and not job_id.startswith("clone") and not job_id.startswith("temp"):
        return job_id

    # Fallback: extract from URL path (e.g. /jobs/10554403/ or id=10554403)
    urls = [job.get("apply", ""), job.get("detail", ""), job.get("apply_url", "")]
    for u in urls:
        if not u:
            continue
        # Look for /jobs/12345/ or /job/12345/
        m = re.search(r"/jobs?/(\d{5,})", u, re.I)
        if m:
            return m.group(1)
        # Look for id=12345 or reqId=12345
        m = re.search(r"[?&](?:job_?id|req_?id|id)=(\w+)", u, re.I)
        if m:
            return m.group(1)

    return job_id or f"gen_{abs(hash(str(job.get('title')) + str(job.get('company'))))}"


def normalize_url_canonical(url: str) -> str:
    """Normalize URL by stripping tracking params and trailing slashes, preserving routing paths & query IDs."""
    if not url:
        return ""
    cleaned = clean_tracking_params(url.strip())
    try:
        parsed = urlparse(cleaned)
        netloc = parsed.netloc.lower()
        path = parsed.path.rstrip("/")
        # Re-sort query parameters for deterministic comparison
        q_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        q_pairs.sort(key=lambda x: x[0].lower())
        new_query = urlencode(q_pairs)
        return urlunparse((parsed.scheme.lower(), netloc, path, "", new_query, ""))
    except Exception:
        return cleaned.lower().rstrip("/")


def is_authoritative_req_id(req_id: str) -> bool:
    """Return True if req_id is an explicit, non-synthetic official requisition identifier."""
    if not req_id:
        return False
    r = str(req_id).strip().lower()
    return not (r.startswith("gen_") or r.startswith("clone") or r.startswith("temp") or len(r) < 3)


def deduplicate_jobs(
    jobs_list: list[dict[str, Any]],
    prior_shown_ids: set[str] | None = None
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], int]:
    """
    Deduplicates a candidate job list using explicit ordered deduplication:
    1. Company + canonical requisition ID
    2. Canonical official detail/Apply URL
    3. Conservative company/title/location/role fingerprint (ONLY for records without authoritative requisition ID)

    Returns:
        unique_jobs: list of kept canonical jobs
        duplicate_groups: list of structured dedupe audit groups
        total_suppressed: exact count of unique removed duplicate records
    """
    prior_shown = prior_shown_ids or set()

    # Step 1: Pre-process and normalize URLs
    for job in jobs_list:
        clean_apply = clean_tracking_params(job.get("apply") or job.get("apply_url") or "")
        job["apply"] = clean_apply
        if job.get("detail"):
            job["detail"] = clean_tracking_params(job["detail"])

    # Group candidate jobs into equivalence clusters using ordered keys
    # Map cluster_index -> list of candidate jobs
    clusters: list[list[dict[str, Any]]] = []
    # Index maps for quick lookup of existing cluster
    req_to_cluster: dict[tuple[str, str], int] = {}       # (company_lower, req_id) -> cluster_index
    url_to_cluster: dict[str, int] = {}                  # canonical_url -> cluster_index
    fingerprint_to_cluster: dict[tuple, int] = {}        # conservative fingerprint -> cluster_index

    for job in jobs_list:
        comp = str(job.get("company", "")).strip().lower()
        req_id = extract_requisition_id(job).lower()
        is_auth = is_authoritative_req_id(req_id)
        req_key = (comp, req_id) if comp and req_id else None

        apply_url = normalize_url_canonical(job.get("apply") or "")
        detail_url = normalize_url_canonical(job.get("detail") or "")

        loc = str(job.get("location", "")).strip().lower()
        norm_title = normalize_title(str(job.get("title", "")))
        job_type = str(job.get("type", "Full-time")).strip().lower()
        skills = tuple(sorted(str(s).strip().lower() for s in job.get("skills", [])))
        # Conservative fingerprint requires all 5 fields
        fingerprint = (comp, loc, norm_title, skills, job_type) if (comp and norm_title and skills) else None

        # Check existing cluster matches in explicit order:
        matched_cluster_idx: int | None = None

        # 1. Company + requisition ID
        if req_key and req_key in req_to_cluster:
            matched_cluster_idx = req_to_cluster[req_key]
        # 2. Canonical official detail/apply URL
        elif apply_url and apply_url in url_to_cluster:
            matched_cluster_idx = url_to_cluster[apply_url]
        elif detail_url and detail_url in url_to_cluster:
            matched_cluster_idx = url_to_cluster[detail_url]
        # 3. Conservative company/title/location/role fingerprint
        # STRICT RULE (B1): A non-empty official requisition ID is authoritative.
        # Different requisition IDs with different canonical official URLs must remain separate.
        # Fallback fingerprint ONLY applies if the candidate job DOES NOT have an authoritative requisition ID,
        # AND the candidate cluster does not have an authoritative requisition ID.
        elif not is_auth and fingerprint and fingerprint in fingerprint_to_cluster:
            candidate_cluster_idx = fingerprint_to_cluster[fingerprint]
            cluster_jobs = clusters[candidate_cluster_idx]
            cluster_has_auth_id = any(is_authoritative_req_id(extract_requisition_id(cj)) for cj in cluster_jobs)
            if not cluster_has_auth_id:
                matched_cluster_idx = candidate_cluster_idx

        if matched_cluster_idx is not None:
            # Add to matched cluster
            clusters[matched_cluster_idx].append(job)
        else:
            # Create new cluster
            new_idx = len(clusters)
            clusters.append([job])
            matched_cluster_idx = new_idx

        # Register all keys to this cluster
        if req_key:
            req_to_cluster[req_key] = matched_cluster_idx
        if apply_url:
            url_to_cluster[apply_url] = matched_cluster_idx
        if detail_url:
            url_to_cluster[detail_url] = matched_cluster_idx
        if fingerprint and not is_auth:
            fingerprint_to_cluster[fingerprint] = matched_cluster_idx


    unique_jobs: list[dict[str, Any]] = []
    duplicate_groups: list[dict[str, Any]] = []
    total_suppressed_count = 0

    for cluster in clusters:
        if not cluster:
            continue

        # Deterministic sorting within cluster to pick the single best job:
        # Priority:
        # 1. Previously shown consistency (if in prior_shown_ids)
        # 2. Fresher posting date (lower days)
        # 3. Higher relevance score
        # 4. Canonical requisition ID string stability
        def sort_key(j: dict[str, Any]):
            j_id = str(j.get("id", ""))
            in_prior = 0 if j_id in prior_shown else 1
            days = j.get("days", 99)
            score = -j.get("score", 0)
            return (in_prior, days, score, j_id)

        cluster_sorted = sorted(cluster, key=sort_key)
        kept_job = cluster_sorted[0]
        kept_id = str(kept_job.get("id", "")).strip()

        # Suppressed IDs: all other IDs in this cluster, excluding kept_id, deduplicated & non-empty
        suppressed_ids_set = {
            str(j.get("id", "")).strip()
            for j in cluster_sorted[1:]
            if str(j.get("id", "")).strip() and str(j.get("id", "")).strip() != kept_id
        }

        # Ensure kept_id is NEVER in suppressed_ids_set
        suppressed_ids_set.discard(kept_id)
        suppressed_ids = sorted(suppressed_ids_set)

        unique_jobs.append(kept_job)

        if suppressed_ids:
            duplicate_groups.append({
                "kept_job_id": kept_id,
                "company": kept_job.get("company", ""),
                "title": kept_job.get("title", ""),
                "location": kept_job.get("location", ""),
                "suppressed_job_ids": suppressed_ids,
                "reason": "Identical canonical requisition, verified official URL, or company/location/skills fingerprint."
            })
            total_suppressed_count += len(suppressed_ids)

    # Sort final unique list by days asc, score desc, company, title
    unique_jobs.sort(
        key=lambda j: (j.get("days", 99), -j.get("score", 0), str(j.get("company", "")), str(j.get("title", "")))
    )

    return unique_jobs, duplicate_groups, total_suppressed_count
