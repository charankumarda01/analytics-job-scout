#!/usr/bin/env python3
"""
Regression test for Blocker B2:
Proves that cross-scan previously-shown jobs are excluded from future scan feeds,
and that restoring shown_jobs.json across independent workspace checkouts preserves state.
"""

import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch, MagicMock

from scanner.engine import run_full_scan


class TestShownJobsCrossScan(unittest.TestCase):
    def test_two_consecutive_scans_exclude_previously_shown(self):
        """
        Scan 1 finds jobs A and B in workspace 1 -> publishes A and B, saves shown_jobs.json.
        Workspace 2 restores shown_jobs.json -> Scan 2 suppresses A and B, feed has 0 repeats.
        """
        # Mock candidate job generator
        dummy_jobs = [
            {
                "id": "10554403",
                "company": "Amazon",
                "title": "Business Analyst I",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 2,
                "score": 90,
                "skills": ["SQL", "Power BI"],
                "apply": "https://account.amazon.jobs/jobs/10554403/apply",
                "detail": "https://www.amazon.jobs/en/jobs/10554403/business-analyst",
                "source": "Amazon Jobs official search",
                "verified": False
            },
            {
                "id": "10554404",
                "company": "Amazon",
                "title": "Data Analyst I",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 3,
                "score": 88,
                "skills": ["SQL", "Excel"],
                "apply": "https://account.amazon.jobs/jobs/10554404/apply",
                "detail": "https://www.amazon.jobs/en/jobs/10554404/data-analyst",
                "source": "Amazon Jobs official search",
                "verified": False
            }
        ]

        with tempfile.TemporaryDirectory() as ws1, tempfile.TemporaryDirectory() as ws2:
            ws1_data = Path(ws1) / "docs" / "data"
            ws1_data.mkdir(parents=True)
            ws2_data = Path(ws2) / "docs" / "data"
            ws2_data.mkdir(parents=True)

            out1 = ws1_data / "latest.json"
            out2 = ws2_data / "latest.json"

            def mock_verify(url, allowed_domains, requisition_id=None, timeout=10, check_http=True):
                if "passport" in url or "apply" in url:
                    return (False, "https://passport.amazon.jobs/", {"status_code": 200, "redirected_to_login": True, "checked_at": "2026-10-03T12:00:00Z"})
                return (True, url, {"status_code": 200, "checked_at": "2026-10-03T12:00:00Z"})

            mock_registry = [{"name": "Amazon", "ats_provider": "amazon", "enabled": True, "allowed_domains": ["amazon.jobs", "account.amazon.jobs"]}]

            with patch("scanner.engine.DATA_DIR", ws1_data), \
                 patch("scanner.engine.load_company_registry", return_value=mock_registry), \
                 patch("scanner.engine.verify_live_link", side_effect=mock_verify), \
                 patch("scanner.engine.scan_amazon_source", return_value=(list(dummy_jobs), {"source": "Amazon", "received": 2, "eligible": 2})):

                # Run Scan 1 in Workspace 1
                payload1 = run_full_scan(
                    preferences={"roles": ["any-analyst"], "locations": ["Bengaluru"], "types": ["jobs"]},
                    output_path=out1,
                    check_live_http=False
                )

                self.assertEqual(len(payload1["jobs"]), 2)
                self.assertEqual(payload1["summary"]["total"], 2)
                self.assertEqual(payload1["summary"]["previously_shown_suppressed"], 0)

                # Check shown_jobs.json was written in ws1
                ws1_shown = ws1_data / "shown_jobs.json"
                self.assertTrue(ws1_shown.exists())
                shown_data = json.loads(ws1_shown.read_text(encoding="utf-8"))
                self.assertIn("10554403", shown_data["shown_ids"])
                self.assertIn("10554404", shown_data["shown_ids"])

            # Simulate GitHub Actions workflow restoring shown_jobs.json from ws1 to fresh workspace 2
            ws2_shown = ws2_data / "shown_jobs.json"
            ws2_shown.write_text(ws1_shown.read_text(encoding="utf-8"), encoding="utf-8")

            # Run Scan 2 in Workspace 2 (fresh directory with restored shown_jobs.json)
            with patch("scanner.engine.DATA_DIR", ws2_data), \
                 patch("scanner.engine.load_company_registry", return_value=mock_registry), \
                 patch("scanner.engine.verify_live_link", side_effect=mock_verify), \
                 patch("scanner.engine.scan_amazon_source", return_value=(list(dummy_jobs), {"source": "Amazon", "received": 2, "eligible": 2})):

                payload2 = run_full_scan(
                    preferences={"roles": ["any-analyst"], "locations": ["Bengaluru"], "types": ["jobs"]},
                    output_path=out2,
                    check_live_http=False
                )

                # In Scan 2, both 10554403 and 10554404 were previously shown!
                # They MUST be excluded from the new-job feed:
                self.assertEqual(len(payload2["jobs"]), 0, "Previously shown jobs must not repeat in new scan feed")
                self.assertEqual(payload2["summary"]["total"], 0)
                self.assertEqual(payload2["summary"]["previously_shown_suppressed"], 2)


if __name__ == "__main__":
    unittest.main()
