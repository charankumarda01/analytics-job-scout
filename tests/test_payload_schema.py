#!/usr/bin/env python3
"""
Unit test for payload schema validation and pre-deployment safety checks.
Ensures docs/data/latest.json and docs/data/walkins.json adhere to strict schema requirements.
"""

import json
import unittest
from datetime import datetime, date, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
LATEST_JSON = ROOT / "docs" / "data" / "latest.json"
WALKINS_JSON = ROOT / "docs" / "data" / "walkins.json"
COMPANIES_JSON = ROOT / "sources" / "companies.json"
TZ = ZoneInfo("Asia/Kolkata")


class TestPayloadSchema(unittest.TestCase):
    def test_latest_json_schema(self):
        self.assertTrue(LATEST_JSON.exists(), f"Payload file {LATEST_JSON} does not exist.")
        data = json.loads(LATEST_JSON.read_text(encoding="utf-8"))

        # Root fields
        for field in ["scan_date", "scanned_at", "summary", "jobs", "sources", "audit"]:
            self.assertIn(field, data, f"Missing required top-level field: {field}")

        summary = data["summary"]
        for sum_field in ["total", "fresh", "backup", "internships", "duplicates_suppressed"]:
            self.assertIn(sum_field, summary, f"Missing summary field: {sum_field}")

        jobs = data["jobs"]
        self.assertEqual(len(jobs), summary["total"], "Job array length must match summary.total")

        # Load allowed company domains
        from scanner.registry import load_company_registry
        companies = load_company_registry(COMPANIES_JSON)
        domain_map = {c["name"]: c.get("allowed_domains", []) for c in companies}

        today = datetime.now(TZ).date()

        for j in jobs:
            # Check required fields
            for key in ["id", "company", "title", "location", "date", "apply", "verified", "skills"]:
                self.assertIn(key, j, f"Job {j.get('id')} missing required key: {key}")

            self.assertTrue(j["verified"], f"Job {j['id']} must have verified: true")
            self.assertTrue(j["apply"].startswith("https://"), f"Job {j['id']} apply URL must be HTTPS")

            # Skills check
            self.assertGreaterEqual(len(j["skills"]), 2, f"Job {j['id']} must match at least 2 skills")

            # Date check (0-15 days)
            job_date = date.fromisoformat(j["date"])
            age_days = (today - job_date).days
            self.assertGreaterEqual(age_days, 0, f"Job {j['id']} date {j['date']} cannot be in future")
            self.assertLessEqual(age_days, 15, f"Job {j['id']} date {j['date']} is older than 15 days")

            # Domain check
            allowed = domain_map.get(j["company"], [])
            if allowed:
                has_allowed_domain = any(d in j["apply"] for d in allowed)
                self.assertTrue(has_allowed_domain, f"Job {j['id']} apply URL {j['apply']} not in allowed domains for {j['company']}")

    def test_walkins_json_schema(self):
        self.assertTrue(WALKINS_JSON.exists(), f"Walkins file {WALKINS_JSON} does not exist.")
        data = json.loads(WALKINS_JSON.read_text(encoding="utf-8"))

        self.assertIn("events", data)
        self.assertIn("total", data)
        events = data["events"]
        self.assertEqual(len(events), data["total"])

        today = datetime.now(TZ).date()

        for ev in events:
            for key in ["id", "company", "title", "event_date", "posting_date", "city", "registration_url", "verified"]:
                self.assertIn(key, ev, f"Walkin event {ev.get('id')} missing key: {key}")

            self.assertTrue(ev["verified"], f"Event {ev['id']} must have verified: true")
            self.assertTrue(ev["registration_url"].startswith("https://"), f"Event {ev['id']} registration URL must be HTTPS")

            # Event date must be today or future
            ev_date = date.fromisoformat(ev["event_date"])
            self.assertGreaterEqual(ev_date, today, f"Event {ev['id']} date {ev['event_date']} is in the past")


if __name__ == "__main__":
    unittest.main()
