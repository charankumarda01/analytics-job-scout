#!/usr/bin/env python3
"""Unit tests for scanner/walkins.py."""

import unittest
from datetime import date, timedelta
from scanner.walkins import validate_walkin_event, calculate_countdown, generate_ics, generate_rss, get_now_ist


class TestWalkins(unittest.TestCase):
    def setUp(self):
        self.today = get_now_ist().date()
        self.valid_event = {
            "id": "walkin_test_01",
            "company": "Accenture",
            "title": "Junior Data Analyst Walk-in",
            "posting_date": (self.today - timedelta(days=2)).isoformat(),
            "event_date": (self.today + timedelta(days=3)).isoformat(),
            "city": "Bengaluru",
            "venue": "Accenture Bangalore BDC3, Bannerghatta Main Rd",
            "eligibility": "0–2 years / freshers",
            "skills": ["SQL", "Excel", "Power BI"],
            "official_source_url": "https://www.accenture.com/in-en/careers",
            "registration_url": "https://mycareer.accenture.com/?source=careers&drive=test"
        }

    def test_valid_event_passes(self):
        ok, reason = validate_walkin_event(self.valid_event, self.today)
        self.assertTrue(ok, reason)

    def test_past_event_suppressed(self):
        ev = dict(self.valid_event)
        ev["event_date"] = (self.today - timedelta(days=1)).isoformat()
        ok, reason = validate_walkin_event(ev, self.today)
        self.assertFalse(ok)
        self.assertIn("in the past", reason)

    def test_stale_posting_date_rejected(self):
        ev = dict(self.valid_event)
        ev["posting_date"] = (self.today - timedelta(days=18)).isoformat()
        ok, reason = validate_walkin_event(ev, self.today)
        self.assertFalse(ok)
        self.assertIn("outside allowable 0–15 days", reason)

    def test_suspicious_event_rejected(self):
        ev = dict(self.valid_event)
        ev["instructions"] = "Candidates must join the Telegram group and pay Rs 200 registration fee."
        ok, reason = validate_walkin_event(ev, self.today)
        self.assertFalse(ok)
        self.assertIn("payment/suspicious", reason)

    def test_countdown_calculation(self):
        self.assertEqual(calculate_countdown(self.today.isoformat(), self.today), "Today")
        self.assertEqual(calculate_countdown((self.today + timedelta(days=1)).isoformat(), self.today), "Tomorrow")
        self.assertEqual(calculate_countdown((self.today + timedelta(days=4)).isoformat(), self.today), "4 days left")

    def test_ics_generation(self):
        ics = generate_ics([self.valid_event])
        self.assertIn("BEGIN:VCALENDAR", ics)
        self.assertIn("BEGIN:VEVENT", ics)
        self.assertIn("SUMMARY:Walk-in: Accenture - Junior Data Analyst Walk-in", ics)
        self.assertIn("END:VCALENDAR", ics)

    def test_rss_generation(self):
        rss = generate_rss([self.valid_event], get_now_ist())
        self.assertIn("<rss version=\"2.0\">", rss)
        self.assertIn("<channel>", rss)
        self.assertIn("<title>Accenture: Junior Data Analyst Walk-in Walk-in (Bengaluru)</title>", rss)


if __name__ == "__main__":
    unittest.main()
