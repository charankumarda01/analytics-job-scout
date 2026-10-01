#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Live Link Verifier
Strict verification layer that inspects HTTP status, detects closed/expired postings,
strips tracking tokens, and ensures allowlisted official company destinations.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from zoneinfo import ZoneInfo
import requests

TZ = ZoneInfo("Asia/Kolkata")

TRACKING_PARAMS = {
    "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
    "fbclid", "gclid", "msclkid", "ref_id", "tracking_code", "_hsenc", "_hsmi",
    "mc_cid", "mc_eid", "igshid"
}

CLOSED_PHRASES = [
    re.compile(r"(?i)\b(job|position|opening|role)\s+(?:has\s+been\s+)?(?:closed|filled|expired|removed|archived)\b"),
    re.compile(r"(?i)\bthis\s+(?:job|position|role|opening)\s+is\s+no\s+longer\s+(?:available|accepting\s+applications)\b"),
    re.compile(r"(?i)\bjob\s+(?:not\s+found|does\s+not\s+exist)\b"),
    re.compile(r"(?i)\bwe\s+are\s+no\s+longer\s+accepting\s+applications\b"),
    re.compile(r"(?i)\bno\s+longer\s+active\b"),
]

GENERIC_PATHS = {"/", "/careers", "/careers/", "/en", "/en/", "/jobs", "/jobs/", "/in-en/careers", "/in-en/careers/"}


def clean_tracking_params(url: str) -> str:
    """Strip only known analytics/tracking query params, preserving functional routing tokens."""
    try:
        parsed = urlparse(url)
        query_pairs = parse_qsl(parsed.query, keep_blank_values=True)
        filtered = [(k, v) for k, v in query_pairs if k.lower() not in TRACKING_PARAMS]
        new_query = urlencode(filtered)
        return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))
    except Exception:
        return url


def is_allowed_domain(url: str, allowed_domains: list[str]) -> bool:
    try:
        host = (urlparse(url).hostname or "").lower()
        for d in allowed_domains:
            dom = d.lower()
            if host == dom or host.endswith("." + dom):
                return True
        return False
    except Exception:
        return False


def verify_live_link(
    url: str,
    allowed_domains: list[str],
    requisition_id: str | None = None,
    timeout: int = 10,
    check_http: bool = True,
    verification_url: str | None = None
) -> tuple[bool, str, dict[str, Any]]:
    """
    Strict Live-Link Gate:
    1. Validates syntax & HTTPS.
    2. Checks allowlisted official domain.
    3. Performs HTTP HEAD/GET verification with redirect following (bounded).
       Uses verification_url as the authority if provided (e.g. for bot-sensitive or sign-in gates).
    4. Detects closed/expired content and generic homepage redirects.
    """
    check_meta = {
        "original_url": url,
        "final_url": url,
        "status_code": None,
        "checked_at": datetime.now(TZ).isoformat(timespec="seconds"),
        "reason": "OK"
    }

    if not url or not isinstance(url, str):
        check_meta["reason"] = "Empty or non-string URL"
        return False, url, check_meta

    url = clean_tracking_params(url.strip())
    check_meta["final_url"] = url

    if not url.startswith("https://"):
        check_meta["reason"] = "Insecure scheme (must be HTTPS)"
        return False, url, check_meta

    if allowed_domains and not is_allowed_domain(url, allowed_domains):
        check_meta["reason"] = f"Domain {urlparse(url).netloc} not in allowed registry domains {allowed_domains}"
        return False, url, check_meta

    if not check_http:
        return True, url, check_meta

    # Use verification_url if specified (for official detail check when apply is login-gated)
    target_http_url = verification_url or url
    if verification_url:
        target_http_url = clean_tracking_params(verification_url.strip())
        if not target_http_url.startswith("https://") or not is_allowed_domain(target_http_url, allowed_domains):
            target_http_url = url

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AnalyticsJobScout/2.0",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }

    try:
        # Try HEAD first for performance, fall back to GET if 405/403 or redirects
        session = requests.Session()
        session.max_redirects = 5

        resp = None
        try:
            resp = session.head(target_http_url, headers=headers, timeout=timeout, allow_redirects=True)
            if resp.status_code in (405, 403, 400):
                resp = session.get(target_http_url, headers=headers, timeout=timeout, allow_redirects=True, stream=True)
        except requests.RequestException:
            # Fall back to GET with stream=True (fetch first chunk of body)
            resp = session.get(target_http_url, headers=headers, timeout=timeout, allow_redirects=True, stream=True)

        check_meta["status_code"] = resp.status_code
        final_url = clean_tracking_params(resp.url)
        check_meta["final_url"] = final_url

        if resp.status_code >= 400:
            check_meta["reason"] = f"HTTP {resp.status_code} error"
            return False, final_url, check_meta

        # Check for generic homepage redirect
        final_path = urlparse(final_url).path
        if final_path in GENERIC_PATHS and requisition_id and requisition_id not in final_url:
            check_meta["reason"] = f"Redirected to generic homepage {final_url}"
            return False, final_url, check_meta

        # Verify allowed domain on final redirected URL
        if allowed_domains and not is_allowed_domain(final_url, allowed_domains):
            check_meta["reason"] = f"Final destination {urlparse(final_url).netloc} outside allowed domains"
            return False, final_url, check_meta

        # Inspect content snippet for expired/closed phrasing
        content_snippet = resp.text[:4000] if hasattr(resp, "text") else ""
        for pattern in CLOSED_PHRASES:
            if pattern.search(content_snippet):
                check_meta["reason"] = "Page content indicates opening is closed or expired"
                return False, final_url, check_meta

        return True, final_url, check_meta

    except requests.exceptions.TooManyRedirects:
        check_meta["reason"] = "Redirect loop encountered"
        return False, url, check_meta
    except requests.exceptions.SSLError:
        check_meta["reason"] = "SSL certificate validation failure"
        return False, url, check_meta
    except requests.exceptions.Timeout:
        check_meta["reason"] = "Connection timed out after bounded retries"
        return False, url, check_meta
    except Exception as exc:
        check_meta["reason"] = f"Live verification request failed: {str(exc)[:100]}"
        return False, url, check_meta
