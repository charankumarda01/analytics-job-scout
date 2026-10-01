#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Job Authenticity & Anti-Scam Verification
Audits job candidates against strict provenance, domain ownership, and anti-scam indicators.
Ensures zero pay-to-apply, Telegram/WhatsApp, or unverified form postings enter production.
"""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

SCAM_PATTERNS = [
    re.compile(r"(?i)\b(registration|processing|assessment|interview|laptop|training|security)\s+fee\b"),
    re.compile(r"(?i)\bsecurity\s+deposit\b"),
    re.compile(r"(?i)\bpay\s+(?:to\s+apply|for\s+training|deposit)\b"),
    re.compile(r"(?i)\b100%\s*(?:job\s+guarantee|guaranteed\s+selection|direct\s+joining)\b"),
    re.compile(r"(?i)\bno\s+interview\s+required\b"),
    re.compile(r"(?i)\b(cryptocurrency|bitcoin|usdt|gift\s*card|telegram\s+task)\b"),
    re.compile(r"(?i)\b(send\s+money|bank\s+transfer|gpay|phonepe|paytm\s+to\s+hr)\b"),
    re.compile(r"(?i)\bupload\s+(?:aadhaar|pan)\s+(?:card\s+)?to\s+proceed\b")
]

DISALLOWED_DOMAINS = {
    "t.me", "telegram.org", "whatsapp.com", "wa.me", "bit.ly", "tinyurl.com",
    "cutt.ly", "is.gd", "rb.gy", "shorturl.at", "forms.gle"
}

FREE_MAIL_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "rediffmail.com", "mail.com"}


def audit_job_authenticity(job: dict[str, Any], allowed_domains: list[str]) -> tuple[bool, str, dict[str, Any]]:
    """
    Evaluates candidate job for authenticity indicators.
    Returns (is_authentic, reason, audit_metadata).
    """
    audit = {
        "source_confidence": "High",
        "red_flags": [],
        "domain_verified": False,
        "scam_indicators_found": []
    }

    apply_url = job.get("apply") or job.get("apply_url") or ""
    detail_url = job.get("detail") or job.get("detail_url") or ""

    # 1. URL Domain Checks
    parsed_apply = urlparse(apply_url)
    apply_host = (parsed_apply.hostname or "").lower()

    for disallowed in DISALLOWED_DOMAINS:
        if apply_host == disallowed or apply_host.endswith("." + disallowed):
            audit["red_flags"].append(f"Destination is on disallowed communication/shortener host: {apply_host}")

    # Check against company registry allowed domains
    for d in allowed_domains:
        d_clean = d.lower()
        if apply_host == d_clean or apply_host.endswith("." + d_clean):
            audit["domain_verified"] = True
            break

    if not audit["domain_verified"]:
        audit["red_flags"].append(f"Apply domain '{apply_host}' not verified in allowed company domains")

    # 2. Text / Scam Language Inspection
    full_text = " ".join([
        str(job.get("title", "")),
        str(job.get("company", "")),
        str(job.get("fit", "")),
        str(job.get("description", "")),
        str(job.get("recruiter", ""))
    ])

    for pat in SCAM_PATTERNS:
        match = pat.search(full_text)
        if match:
            audit["scam_indicators_found"].append(match.group(0))
            audit["red_flags"].append(f"Suspicious hiring language: '{match.group(0)}'")

    # 3. Recruiter contact checks (reject free personal webmail as official recruiters)
    recruiter = job.get("recruiter", "")
    if "@" in recruiter:
        mail_host = recruiter.split("@")[-1].lower().strip()
        if mail_host in FREE_MAIL_DOMAINS:
            audit["red_flags"].append(f"Recruiter contact is personal webmail ({mail_host}) rather than official corporate domain")

    # Final verdict
    if audit["red_flags"]:
        audit["source_confidence"] = "Quarantined"
        return False, "; ".join(audit["red_flags"]), audit

    audit["source_confidence"] = "High"
    return True, "Passed authenticity verification", audit
