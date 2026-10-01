#!/usr/bin/env python3
"""Unit tests for scanner/authenticity.py."""

import unittest
from scanner.authenticity import audit_job_authenticity


class TestAuthenticity(unittest.TestCase):
    def test_authentic_job_passes(self):
        job = {
            "title": "Junior Data Analyst",
            "company": "Swiggy",
            "apply": "https://boards.greenhouse.io/swiggy/jobs/123",
            "detail": "https://boards.greenhouse.io/swiggy/jobs/123",
            "recruiter": "Official Talent Acquisition",
            "fit": "SQL and Excel analytics role"
        }
        ok, reason, meta = audit_job_authenticity(job, ["swiggy.com", "greenhouse.io"])
        self.assertTrue(ok)
        self.assertEqual(meta["source_confidence"], "High")

    def test_scam_fee_rejected(self):
        job = {
            "title": "Data Analyst",
            "company": "Suspicious Inc",
            "apply": "https://careers.suspicious.com/apply",
            "description": "Selected candidates must pay a registration fee of Rs 500 for training."
        }
        ok, reason, meta = audit_job_authenticity(job, ["suspicious.com"])
        self.assertFalse(ok)
        self.assertEqual(meta["source_confidence"], "Quarantined")
        self.assertIn("registration fee", str(meta["scam_indicators_found"]).lower())

    def test_telegram_shortener_rejected(self):
        job = {
            "title": "Data Analyst Trainee",
            "company": "FakeCo",
            "apply": "https://t.me/free_job_channel"
        }
        ok, reason, meta = audit_job_authenticity(job, ["fakeco.com"])
        self.assertFalse(ok)
        self.assertIn("disallowed communication/shortener", reason)

    def test_personal_email_recruiter_rejected(self):
        job = {
            "title": "Data Analyst Intern",
            "company": "Acme",
            "apply": "https://acme.com/jobs/123",
            "recruiter": "hr_recruiter_acme@gmail.com"
        }
        ok, reason, meta = audit_job_authenticity(job, ["acme.com"])
        self.assertFalse(ok)
        self.assertIn("personal webmail", reason)


if __name__ == "__main__":
    unittest.main()
