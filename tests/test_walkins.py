#!/usr/bin/env python3
"""Unit tests for scanner/walkins.py."""

import unittest
from datetime import date, timedelta
from scanner.walkins import (
    validate_walkin_event,
    calculate_countdown,
    generate_ics,
    generate_rss,
    get_now_ist,
    REMOVED_WALKIN_IDS,
)


class TestWalkins(unittest.TestCase):
    def setUp(self):
        self.today = get_now_ist().date()
        self.valid_event = {
            "id": "walkin_verified_test_01",
            "company": "Accenture",
            "title": "Junior Data Analyst Recruitment Drive",
            "posting_date": (self.today - timedelta(days=2)).isoformat(),
            "event_date": (self.today + timedelta(days=3)).isoformat(),
            "city": "Bengaluru",
            "venue": "Accenture Bangalore BDC3, Bannerghatta Main Rd, Bengaluru",
            "eligibility": "0–2 years / freshers",
            "skills": ["SQL", "Excel", "Power BI"],
            "official_source_url": "https://www.accenture.com/in-en/careers/jobdetails?id=walkin_test_01",
            "registration_url": "https://mycareer.accenture.com/jobs/walkin_test_01/register"
        }

    def test_valid_event_passes(self):
        ok, reason = validate_walkin_event(self.valid_event, self.today, check_http=False)
        self.assertTrue(ok, reason)

    def test_evidence_based_http_verification_success(self):
        from unittest.mock import patch, MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><h1>Accenture Walk-in Recruitment Drive</h1><p>Bengaluru</p></body></html>"
        with patch("requests.get", return_value=mock_resp):
            ok, reason = validate_walkin_event(self.valid_event, self.today, check_http=True)
            self.assertTrue(ok, reason)

    def test_evidence_based_http_verification_fails_missing_company(self):
        from unittest.mock import patch, MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = "<html><body><h1>Generic Recruitment Drive</h1><p>Bengaluru</p></body></html>"
        with patch("requests.get", return_value=mock_resp):
            ok, reason = validate_walkin_event(self.valid_event, self.today, check_http=True)
            self.assertFalse(ok)
            self.assertIn("does not mention company", reason)

    def test_evidence_based_http_verification_fails_on_404(self):
        from unittest.mock import patch, MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        with patch("requests.get", return_value=mock_resp):
            ok, reason = validate_walkin_event(self.valid_event, self.today, check_http=True)
            self.assertFalse(ok)
            self.assertIn("HTTP 404", reason)

    def test_removed_accenture_records_permanently_rejected(self):
        """Regression test: walkin_accenture_blr_01 and walkin_accenture_hyd_02 must fail validation."""
        for removed_id in ["walkin_accenture_blr_01", "walkin_accenture_hyd_02"]:
            ev = dict(self.valid_event)
            ev["id"] = removed_id
            ok, reason = validate_walkin_event(ev, self.today, check_http=False)
            self.assertFalse(ok, f"Removed ID {removed_id} must be rejected")
            self.assertIn("permanently removed and blacklisted", reason)

    def test_drive_param_url_rejected(self):
        """Regression test: URLs with drive= query parameter must fail validation."""
        for drive_param in ["drive=blr-analytics-walkin", "drive=hyd-data-walkin", "drive=any-walkin-test"]:
            ev = dict(self.valid_event)
            ev["registration_url"] = f"https://mycareer.accenture.com/events?{drive_param}"
            ok, reason = validate_walkin_event(ev, self.today, check_http=False)
            self.assertFalse(ok, f"URL with {drive_param} must be rejected")
            self.assertIn("generic careers/login page or unverified drive= URL", reason)

    def test_generic_careers_page_rejected(self):
        """Generic careers pages or generic MyCareer landing pages must never verify an event."""
        generic_urls = [
            "https://www.accenture.com/in-en/careers",
            "https://www.accenture.com/in-en/careers/",
            "https://mycareer.accenture.com",
            "https://mycareer.accenture.com/",
            "https://company.com/careers",
            "https://company.com/jobs"
        ]
        for gen_url in generic_urls:
            ev = dict(self.valid_event)
            ev["official_source_url"] = gen_url
            ok, reason = validate_walkin_event(ev, self.today, check_http=False)
            self.assertFalse(ok, f"Generic URL {gen_url} must be rejected")
            self.assertIn("generic careers/login page", reason)

    def test_past_event_suppressed(self):
        ev = dict(self.valid_event)
        ev["event_date"] = (self.today - timedelta(days=1)).isoformat()
        ok, reason = validate_walkin_event(ev, self.today, check_http=False)
        self.assertFalse(ok)
        self.assertIn("in the past", reason)

    def test_stale_posting_date_rejected(self):
        ev = dict(self.valid_event)
        ev["posting_date"] = (self.today - timedelta(days=18)).isoformat()
        ok, reason = validate_walkin_event(ev, self.today, check_http=False)
        self.assertFalse(ok)
        self.assertIn("outside allowable 0–15 days", reason)

    def test_suspicious_event_rejected(self):
        ev = dict(self.valid_event)
        ev["instructions"] = "Candidates must join the Telegram group and pay Rs 200 registration fee."
        ok, reason = validate_walkin_event(ev, self.today, check_http=False)
        self.assertFalse(ok)
        self.assertIn("payment/suspicious", reason)

    def test_countdown_calculation(self):
        self.assertEqual(calculate_countdown(self.today.isoformat(), self.today), "Today")
        self.assertEqual(calculate_countdown((self.today + timedelta(days=1)).isoformat(), self.today), "Tomorrow")
        self.assertEqual(calculate_countdown((self.today + timedelta(days=4)).isoformat(), self.today), "4 days left")

    def test_ics_generation_with_events(self):
        ics = generate_ics([self.valid_event])
        self.assertIn("BEGIN:VCALENDAR", ics)
        self.assertIn("BEGIN:VEVENT", ics)
        self.assertIn("SUMMARY:Walk-in: Accenture - Junior Data Analyst Recruitment Drive", ics)
        self.assertIn("END:VCALENDAR", ics)

    def test_ics_generation_empty(self):
        """Empty walkins feed must produce valid VCALENDAR with zero VEVENT blocks."""
        ics = generate_ics([])
        self.assertIn("BEGIN:VCALENDAR", ics)
        self.assertNotIn("BEGIN:VEVENT", ics)
        self.assertIn("END:VCALENDAR", ics)

    def test_rss_generation_with_events(self):
        rss = generate_rss([self.valid_event], get_now_ist())
        self.assertIn("<rss version=\"2.0\">", rss)
        self.assertIn("<channel>", rss)
        self.assertIn("<title>Accenture: Junior Data Analyst Recruitment Drive Walk-in (Bengaluru)</title>", rss)

    def test_rss_generation_empty(self):
        """Empty walkins feed must produce valid RSS XML with zero item elements."""
        rss = generate_rss([], get_now_ist())
        self.assertIn("<rss version=\"2.0\">", rss)
        self.assertIn("<channel>", rss)
        self.assertNotIn("<item>", rss)


if __name__ == "__main__":
    unittest.main()
