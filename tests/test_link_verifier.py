#!/usr/bin/env python3
"""Unit tests for scanner/link_verifier.py."""

import unittest
from scanner.link_verifier import clean_tracking_params, is_allowed_domain, verify_live_link


class TestLinkVerifier(unittest.TestCase):
    def test_clean_tracking_params(self):
        url = "https://www.amazon.jobs/en/jobs/10565269?utm_source=linkedin&utm_medium=job_board&ref_id=987&functional_id=123"
        cleaned = clean_tracking_params(url)
        self.assertNotIn("utm_source", cleaned)
        self.assertNotIn("utm_medium", cleaned)
        self.assertNotIn("ref_id", cleaned)
        self.assertIn("functional_id=123", cleaned)

    def test_insecure_scheme_rejected(self):
        ok, final_url, meta = verify_live_link("http://insecure.com/job", ["insecure.com"], check_http=False)
        self.assertFalse(ok)
        self.assertIn("HTTPS", meta["reason"])

    def test_disallowed_domain_rejected(self):
        ok, final_url, meta = verify_live_link("https://unauthorized-domain.com/apply", ["amazon.jobs"], check_http=False)
        self.assertFalse(ok)
        self.assertIn("not in allowed registry domains", meta["reason"])

    def test_allowed_domain_passes_structure(self):
        ok, final_url, meta = verify_live_link("https://account.amazon.jobs/jobs/10565269/apply", ["amazon.jobs"], check_http=False)
        self.assertTrue(ok)
        self.assertEqual(final_url, "https://account.amazon.jobs/jobs/10565269/apply")


if __name__ == "__main__":
    unittest.main()
