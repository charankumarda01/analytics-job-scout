#!/usr/bin/env python3
"""Unit tests for sources/companies.json and sources/company_research.json."""

import unittest
from pathlib import Path
from scanner.registry import load_company_registry, load_research_registry, is_allowed_domain

ROOT = Path(__file__).resolve().parent.parent


class TestCompanyRegistry(unittest.TestCase):
    def test_load_registry(self):
        companies = load_company_registry()
        self.assertGreaterEqual(len(companies), 10)

        # Check required fields
        for c in companies:
            self.assertIn("id", c)
            self.assertIn("name", c)
            self.assertIn("size", c)
            self.assertIn(c["size"], {"Startup", "Mid-size", "Enterprise", "Unknown"})
            self.assertTrue(c["careers_url"].startswith("https://"))
            self.assertIsInstance(c["allowed_domains"], list)
            self.assertGreater(len(c["allowed_domains"]), 0)
            self.assertIn("ats_provider", c)

    def test_allowed_domains(self):
        self.assertTrue(is_allowed_domain("https://account.amazon.jobs/jobs/123", ["amazon.jobs"]))
        self.assertTrue(is_allowed_domain("https://mycareer.accenture.com/in-en", ["accenture.com"]))
        self.assertTrue(is_allowed_domain("https://boards.greenhouse.io/swiggy/jobs/123", ["greenhouse.io", "swiggy.com"]))
        self.assertFalse(is_allowed_domain("https://phishing-scam.com/job", ["amazon.jobs"]))
        self.assertFalse(is_allowed_domain("https://t.me/fake_jobs", ["amazon.jobs"]))

    def test_research_registry(self):
        research = load_research_registry()
        self.assertIn("research_links", research)
        links = research["research_links"]
        self.assertIn("amazon", links)
        self.assertIn("accenture", links)
        self.assertIn("swiggy", links)

        for key, info in links.items():
            self.assertIn("name", info)
            self.assertIn("about_url", info)
            self.assertIn("careers_url", info)
            self.assertIn("glassdoor_search_url", info)
            self.assertTrue(info["about_url"].startswith("https://"))


if __name__ == "__main__":
    unittest.main()
