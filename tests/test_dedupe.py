#!/usr/bin/env python3
"""
Unit tests for scanner/dedupe.py.
Covers explicit ordered deduplication, 10554403 clone pattern regression,
search-query repeats, title changes, tracking parameter normalization,
and preventing incorrect merges of different requisitions with similar titles.
"""

import unittest
from scanner.dedupe import (
    deduplicate_jobs,
    normalize_title,
    extract_requisition_id,
    normalize_url_canonical,
)


class TestDedupe(unittest.TestCase):
    def test_normalize_title(self):
        self.assertEqual(normalize_title("Data Analyst II"), "data analyst")
        self.assertEqual(normalize_title("Business Intelligence Engineer I"), "business intelligence engineer")
        self.assertEqual(normalize_title("Analytics Specialist 2"), "analytics specialist")
        self.assertEqual(normalize_title("Junior Reporting Analyst III"), "junior reporting analyst")

    def test_10554403_clone_pattern_regression(self):
        """
        Regression test for the 10554403 clone pattern:
        - Kept ID must never appear in suppressed_job_ids.
        - suppressed_job_ids must contain strictly unique IDs.
        - total_suppressed must equal the exact number of unique removed IDs.
        """
        jobs = [
            {
                "id": "10554403",
                "company": "Amazon",
                "title": "Business Analyst, Global Solutions & Risk Compliance (GSRC)",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 10,
                "score": 93,
                "skills": ["SQL", "Power BI", "Tableau", "Python"],
                "apply": "https://account.amazon.jobs/jobs/10554403/apply",
                "detail": "https://www.amazon.jobs/en/jobs/10554403/business-analyst"
            },
            # Multiple duplicate query hits / clones with repeated IDs
            {
                "id": "10554404",
                "company": "Amazon",
                "title": "Business Analyst, Global Solutions & Risk Compliance (GSRC)",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 10,
                "score": 93,
                "skills": ["SQL", "Power BI", "Tableau", "Python"],
                "apply": "https://account.amazon.jobs/jobs/10554403/apply?utm_source=search1",
                "detail": "https://www.amazon.jobs/en/jobs/10554403/business-analyst"
            },
            {
                "id": "10554405",
                "company": "Amazon",
                "title": "Business Analyst, Global Solutions & Risk Compliance (GSRC)",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 10,
                "score": 93,
                "skills": ["SQL", "Power BI", "Tableau", "Python"],
                "apply": "https://account.amazon.jobs/jobs/10554403/apply?utm_source=search2",
                "detail": "https://www.amazon.jobs/en/jobs/10554403/business-analyst"
            },
            # Duplicate item having the same ID 10554403
            {
                "id": "10554403",
                "company": "Amazon",
                "title": "Business Analyst, Global Solutions & Risk Compliance (GSRC)",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 10,
                "score": 93,
                "skills": ["SQL", "Power BI", "Tableau", "Python"],
                "apply": "https://account.amazon.jobs/jobs/10554403/apply?ref=query3",
                "detail": "https://www.amazon.jobs/en/jobs/10554403/business-analyst"
            },
            # Duplicate item having 10554404 again
            {
                "id": "10554404",
                "company": "Amazon",
                "title": "Business Analyst, Global Solutions & Risk Compliance (GSRC)",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 10,
                "score": 93,
                "skills": ["SQL", "Power BI", "Tableau", "Python"],
                "apply": "https://account.amazon.jobs/jobs/10554403/apply?ref=query4",
                "detail": "https://www.amazon.jobs/en/jobs/10554403/business-analyst"
            }
        ]

        unique, groups, total_suppressed = deduplicate_jobs(jobs)

        self.assertEqual(len(unique), 1)
        kept = unique[0]
        self.assertEqual(kept["id"], "10554403")

        self.assertEqual(len(groups), 1)
        group = groups[0]
        self.assertEqual(group["kept_job_id"], "10554403")

        # The kept ID must NEVER appear in suppressed_job_ids
        self.assertNotIn("10554403", group["suppressed_job_ids"])

        # Suppressed IDs must be unique
        suppressed_ids = group["suppressed_job_ids"]
        self.assertEqual(len(suppressed_ids), len(set(suppressed_ids)))
        self.assertEqual(set(suppressed_ids), {"10554404", "10554405"})

        # duplicates_suppressed must equal the documented number of unique removed records
        self.assertEqual(total_suppressed, 2)
        self.assertEqual(total_suppressed, len(suppressed_ids))

    def test_repeated_search_query_copies(self):
        """Copies of the same job returned by multiple search terms count as one canonical job."""
        jobs = [
            {
                "id": "AMZ_REQ_999",
                "company": "Amazon",
                "title": "Junior Data Analyst",
                "location": "Hyderabad",
                "type": "Full-time",
                "days": 1,
                "score": 90,
                "skills": ["SQL", "Excel"],
                "apply": "https://amazon.jobs/req999?query=data+analyst"
            },
            {
                "id": "AMZ_REQ_999",
                "company": "Amazon",
                "title": "Junior Data Analyst",
                "location": "Hyderabad",
                "type": "Full-time",
                "days": 1,
                "score": 90,
                "skills": ["SQL", "Excel"],
                "apply": "https://amazon.jobs/req999?query=sql+analyst"
            }
        ]
        unique, groups, total_suppressed = deduplicate_jobs(jobs)
        self.assertEqual(len(unique), 1)
        self.assertEqual(unique[0]["id"], "AMZ_REQ_999")
        # Identical ID duplicate is merged without adding kept_id to suppressed
        for g in groups:
            self.assertNotIn("AMZ_REQ_999", g["suppressed_job_ids"])

    def test_title_changes_same_requisition(self):
        """If title text changes for the same requisition, merge into one canonical job."""
        jobs = [
            {
                "id": "REQ_777",
                "company": "Accenture",
                "title": "Analytics and Modeling Associate",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 2,
                "score": 88,
                "skills": ["Power BI", "SQL"],
                "apply": "https://accenture.com/job/777"
            },
            {
                "id": "REQ_777",
                "company": "Accenture",
                "title": "Analytics and Modeling Analyst (Fresher)",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 1,  # Fresher version
                "score": 92,
                "skills": ["Power BI", "SQL"],
                "apply": "https://accenture.com/job/777?src=portal"
            }
        ]
        unique, groups, total_suppressed = deduplicate_jobs(jobs)
        self.assertEqual(len(unique), 1)
        self.assertEqual(unique[0]["id"], "REQ_777")
        self.assertEqual(unique[0]["days"], 1)  # Kept fresher version

    def test_url_tracking_parameters_normalization(self):
        """URLs differing only by tracking parameters (utm_*, fbclid, etc.) are recognized as identical."""
        url_a = "https://mycareer.accenture.com/job/12345?utm_source=linkedin&utm_campaign=spring"
        url_b = "https://mycareer.accenture.com/job/12345?fbclid=xyz&utm_medium=cpc"
        norm_a = normalize_url_canonical(url_a)
        norm_b = normalize_url_canonical(url_b)
        self.assertEqual(norm_a, norm_b)

        jobs = [
            {
                "id": "clone_a",
                "company": "Accenture",
                "title": "Data Specialist",
                "location": "Bengaluru",
                "skills": ["SQL", "Excel"],
                "days": 2,
                "score": 80,
                "apply": url_a
            },
            {
                "id": "clone_b",
                "company": "Accenture",
                "title": "Data Specialist",
                "location": "Bengaluru",
                "skills": ["SQL", "Excel"],
                "days": 1,
                "score": 85,
                "apply": url_b
            }
        ]
        unique, groups, suppressed = deduplicate_jobs(jobs)
        self.assertEqual(len(unique), 1)
        self.assertEqual(unique[0]["id"], "clone_b")  # Fresher kept
        self.assertEqual(suppressed, 1)

    def test_different_requisitions_not_merged_by_similar_titles(self):
        """Never merge different requisitions solely because titles are similar."""
        jobs = [
            {
                "id": "REQ_FINANCE_01",
                "company": "Amazon",
                "title": "Business Analyst, Finance",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 2,
                "score": 85,
                "skills": ["SQL", "Excel", "Financial Modeling"],
                "apply": "https://amazon.jobs/jobs/101/finance"
            },
            {
                "id": "REQ_OPS_02",
                "company": "Amazon",
                "title": "Business Analyst, Operations",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 2,
                "score": 85,
                "skills": ["SQL", "Power BI", "Supply Chain"],
                "apply": "https://amazon.jobs/jobs/102/operations"
            }
        ]
        unique, groups, suppressed = deduplicate_jobs(jobs)
        self.assertEqual(len(unique), 2, "Different requisitions must both be preserved")
        self.assertEqual(suppressed, 0)
        self.assertEqual(len(groups), 0)

    def test_prior_shown_consistency(self):
        """Previously shown job ID is retained for user consistency unless candidate is fresher."""
        jobs = [
            {
                "id": "EXISTING_JOB_1",
                "company": "Amazon",
                "title": "Data Analyst",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 2,
                "score": 85,
                "skills": ["SQL", "Excel"],
                "apply": "https://amazon.jobs/da"
            },
            {
                "id": "NEW_JOB_COPY_2",
                "company": "Amazon",
                "title": "Data Analyst",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 2,
                "score": 85,
                "skills": ["SQL", "Excel"],
                "apply": "https://amazon.jobs/da"
            }
        ]
        unique, groups, suppressed = deduplicate_jobs(jobs, prior_shown_ids={"EXISTING_JOB_1"})
        self.assertEqual(len(unique), 1)
        self.assertEqual(unique[0]["id"], "EXISTING_JOB_1")

    def test_distinct_amazon_requisitions_never_merged_as_duplicates(self):
        """
        Critical regression test (B1):
        Distinct Amazon requisitions 10554403, 10554404, 10554405, 10554406, 10554407
        share title, city, type, and skills, but each has an authoritative requisition ID
        and separate official detail/apply paths. They must all be preserved as distinct jobs.
        """
        jobs = []
        for req_id in ["10554403", "10554404", "10554405", "10554406", "10554407"]:
            jobs.append({
                "id": req_id,
                "company": "Amazon",
                "title": "Business Analyst, Global Solutions & Risk Compliance (GSRC)",
                "location": "Bengaluru",
                "type": "Full-time",
                "days": 5,
                "score": 93,
                "skills": ["SQL", "Power BI", "Tableau", "Python"],
                "apply": f"https://account.amazon.jobs/jobs/{req_id}/apply",
                "detail": f"https://www.amazon.jobs/en/jobs/{req_id}/business-analyst"
            })

        unique, groups, suppressed = deduplicate_jobs(jobs)
        self.assertEqual(len(unique), 5, f"Expected all 5 distinct requisitions to be preserved, got {len(unique)}")
        self.assertEqual(suppressed, 0, "No distinct requisitions should be suppressed")
        self.assertEqual(len(groups), 0, "No duplicate groups should be created for distinct requisitions")
        unique_ids = {j["id"] for j in unique}
        self.assertEqual(unique_ids, {"10554403", "10554404", "10554405", "10554406", "10554407"})


if __name__ == "__main__":
    unittest.main()

