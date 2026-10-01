#!/usr/bin/env python3
"""
Analytics Job Scout v2 - Company Source Registry Loader & Validator
Loads sources/companies.json and sources/company_research.json.
Validates official domains, ATS tenants, size classifications, and outbound research links.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
COMPANIES_FILE = ROOT / "sources" / "companies.json"
RESEARCH_FILE = ROOT / "sources" / "company_research.json"

ALLOWED_SIZES = {"Startup", "Mid-size", "Enterprise", "Unknown"}
ALLOWED_ATS = {"amazon", "accenture", "greenhouse", "lever", "ashby", "smartrecruiters", "workable", "workday", "generic"}


class RegistryError(Exception):
    pass


def load_company_registry(file_path: Path = COMPANIES_FILE) -> list[dict[str, Any]]:
    if not file_path.exists():
        raise RegistryError(f"Company registry file not found: {file_path}")

    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RegistryError(f"Failed to parse company registry JSON: {exc}")

    companies = data.get("companies", [])
    if not isinstance(companies, list) or not companies:
        raise RegistryError("Registry must contain a non-empty list of companies")

    seen_ids = set()
    validated = []

    for c in companies:
        cid = c.get("id")
        name = c.get("name")
        if not cid or not name:
            raise RegistryError(f"Company record missing required id or name: {c}")

        if cid in seen_ids:
            raise RegistryError(f"Duplicate company ID in registry: {cid}")
        seen_ids.add(cid)

        size = c.get("size", "Unknown")
        if size not in ALLOWED_SIZES:
            raise RegistryError(f"Invalid size classification '{size}' for company {cid}")

        allowed_domains = c.get("allowed_domains", [])
        if not isinstance(allowed_domains, list) or not allowed_domains:
            raise RegistryError(f"Company {cid} must have at least one allowed official domain")

        ats = c.get("ats_provider", "").lower()
        if ats not in ALLOWED_ATS:
            raise RegistryError(f"Unsupported or missing ATS provider '{ats}' for company {cid}")

        careers_url = c.get("careers_url", "")
        if not careers_url.startswith("https://"):
            raise RegistryError(f"Company {cid} careers_url must be HTTPS: {careers_url}")

        validated.append(c)

    return validated


def load_research_registry(file_path: Path = RESEARCH_FILE) -> dict[str, Any]:
    if not file_path.exists():
        return {"companies": {}, "disclaimer": "Subjective community reviews"}

    try:
        data = json.loads(file_path.read_text(encoding="utf-8"))
        return data
    except Exception:
        return {"companies": {}, "disclaimer": "Subjective community reviews"}


def is_allowed_domain(url: str, allowed_domains: list[str]) -> bool:
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        for domain in allowed_domains:
            d = domain.lower()
            if host == d or host.endswith("." + d):
                return True
        return False
    except Exception:
        return False
