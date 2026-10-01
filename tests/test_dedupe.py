#!/usr/bin/env python3
"""Unit tests for scanner/dedupe.py."""

import unittest
from scanner.dedupe import deduplicate_jobs, normalize_title


class TestDedupe(unittest.TestCase):
    def test_normalize_title(self):
        self.assertEqual(normalize_title("Data Analyst II"), "data analyst")
        self.assertEqual(normalize_title("Business Intelligence Engineer I"), "business intelligence engineer")
        self.assertEqual(normalize_title("Analytics Specialist 2"), "analytics specialist")

    def test_deduplicate_identical_roles(self):
        jobs = [
            {
                "id": "job_1",
                "company": "Accenture",
                "title": "Sales Operations Associate",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 0,
                "score": 85,
                "skills": ["Excel", "SQL"],
                "apply": "https://mycareer.accenture.com/1?utm_source=a"
            },
            {
                "id": "job_2",
                "company": "Accenture",
                "title": "Sales Operations Associate",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 1,
                "score": 82,
                "skills": ["Excel", "SQL"],
                "apply": "https://mycareer.accenture.com/2?utm_source=b"
            }
        ]
        unique, groups, suppressed_count = deduplicate_jobs(jobs)
        self.assertEqual(len(unique), 1)
        self.assertEqual(unique[0]["id"], "job_1")  # Kept fresher/higher score
        self.assertEqual(suppressed_count, 1)
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["suppressed_job_ids"], ["job_2"])


if __name__ == "__main__":
    unittest.main()
