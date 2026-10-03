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

    def test_login_portal_recognized(self):
        from unittest.mock import patch, MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.url = "https://passport.amazon.jobs/ap/signin"
        mock_resp.text = "<html><body>Sign in to your Amazon account</body></html>"

        with patch("requests.Session.head", return_value=mock_resp):
            ok, final_url, meta = verify_live_link(
                "https://account.amazon.jobs/jobs/10565269/apply",
                ["amazon.jobs"],
                requisition_id="10565269",
                check_http=True
            )
            # A generic login portal is an official authentication gate, NOT a verified Apply destination (B4)
            self.assertFalse(ok)
            self.assertTrue(meta.get("redirected_to_login"))
            self.assertIn("Official Authentication Gate", meta.get("status_label"))

    def test_generic_homepage_redirect_rejected(self):
        from unittest.mock import patch, MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.url = "https://www.amazon.jobs/en/"
        mock_resp.text = "<html><body>Explore careers at Amazon</body></html>"

        with patch("requests.Session.head", return_value=mock_resp):
            ok, final_url, meta = verify_live_link(
                "https://www.amazon.jobs/en/jobs/99999999",
                ["amazon.jobs"],
                requisition_id="99999999",
                check_http=True
            )
            self.assertFalse(ok)
            self.assertIn("generic homepage", meta["reason"])

    def test_closed_phrase_detection(self):
        from unittest.mock import patch, MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.url = "https://www.amazon.jobs/en/jobs/10565269"
        mock_resp.text = "<html><body>This position has been filled. We are no longer accepting applications.</body></html>"

        with patch("requests.Session.head", return_value=mock_resp):
            ok, final_url, meta = verify_live_link(
                "https://www.amazon.jobs/en/jobs/10565269",
                ["amazon.jobs"],
                requisition_id="10565269",
                check_http=True
            )
            self.assertFalse(ok)
            self.assertIn("closed or expired", meta["reason"])


if __name__ == "__main__":
    unittest.main()
