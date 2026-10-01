/**
 * Unit tests for docs/js/resume-agent.js
 * Verifies deterministic ATS analysis, scoring boundaries, and job matching.
 */
const assert = require('assert');

// Mock browser environment for node
global.window = global;
require('../docs/js/resume-agent.js');
const ResumeAgent = global.AJSResumeAgent;

console.log('Running Resume ATS & Matching tests...');

// 1. Empty resume test
const emptyRes = ResumeAgent.analyzeATS('');
assert.strictEqual(emptyRes.totalScore, 0, 'Empty resume should score 0');
assert.strictEqual(emptyRes.grade, 'No Content', 'Empty resume grade should be No Content');
console.log('✓ Empty resume scores 0 with No Content grade');

// 2. Empty resume job matching
const dummyJob = {
  id: 'test_job_1',
  title: 'Data Analyst',
  company: 'Swiggy',
  skills: ['SQL', 'Power BI', 'Excel']
};
const emptyMatch = ResumeAgent.matchJob(dummyJob, '');
assert.strictEqual(emptyMatch.matchScore, 0, 'Matching with empty resume must score 0');
assert.strictEqual(emptyMatch.matchedSkills.length, 0, 'No skills should be matched');
console.log('✓ Job matching with empty resume fails closed (0% match)');

// 3. Realistic strong junior analytics resume
const strongResume = `
Jane Doe
jane.doe@example.com | +91 9876543210
linkedin.com/in/janedoe | github.com/janedoe

PROFESSIONAL SUMMARY
Results-driven Junior Data Analyst skilled in SQL, Power BI, Python, and Excel. Passionate about transforming raw transactional data into actionable business intelligence dashboards.

TECHNICAL SKILLS
- Querying & Modeling: SQL, PostgreSQL, joins, CTEs, window functions, subqueries
- BI & Visualisation: Power BI, DAX, Tableau, Excel, PivotTables, XLOOKUP
- Programming: Python, pandas, NumPy
- Core Concepts: ETL, data cleaning, KPI reporting, statistics, dashboard design

PROJECTS
E-Commerce Churn Analytics Platform
- Engineered complex SQL queries using window functions and CTEs to segment 120,000+ customer records.
- Built interactive Power BI dashboard featuring 8 custom DAX KPIs, reducing monthly reporting cycle by 35%.
- Automated daily ETL data cleaning pipeline with Python and pandas, processing 50,000 rows in under 2 minutes.

Supply Chain Inventory Optimization
- Analyzed 85,000 shipment transactions in Excel and Power Query using PivotTables and advanced statistical modeling.
- Identified bottleneck patterns resulting in ₹4,50,000 estimated annual inventory cost savings.

EDUCATION
Bachelor of Technology in Computer Science - CGPA: 8.4/10
`;

const strongAnalysis = ResumeAgent.analyzeATS(strongResume);
assert(strongAnalysis.totalScore >= 75, `Strong resume should score >= 75, got ${strongAnalysis.totalScore}`);
assert(strongAnalysis.skillsFound.includes('sql'), 'Should identify SQL');
assert(strongAnalysis.skillsFound.includes('power bi'), 'Should identify Power BI');
assert(strongAnalysis.skillsFound.includes('python'), 'Should identify Python');
assert(strongAnalysis.skillsFound.includes('excel'), 'Should identify Excel');
assert(strongAnalysis.impactEvidence.length >= 3, 'Should identify multiple metrics and quantified impact');
console.log(`✓ Strong resume scored ${strongAnalysis.totalScore}/100 with ${strongAnalysis.skillsFound.length} skills found`);

// 4. Job matching with strong resume
const matchResult = ResumeAgent.matchJob(dummyJob, strongResume);
assert(matchResult.matchScore >= 80, `Should have high match score for SQL/Power BI/Excel, got ${matchResult.matchScore}`);
assert(matchResult.matchedSkills.includes('sql'), 'Should match SQL');
assert(matchResult.matchedSkills.includes('power bi'), 'Should match Power BI');
assert(matchResult.checklist.length > 0, 'Should provide checklist for candidate review');
console.log(`✓ Job match score: ${matchResult.matchScore}% with matched: ${matchResult.matchedSkills.join(', ')}`);

// 5. Missing skills detection without silent mutation
const advancedJob = {
  id: 'test_job_2',
  title: 'Senior Analytics Specialist',
  company: 'CRED',
  skills: ['SQL', 'Snowflake', 'Airflow', 'dbt', 'Kubernetes']
};
const advancedMatch = ResumeAgent.matchJob(advancedJob, strongResume);
assert(advancedMatch.missingSkills.includes('snowflake'), 'Should detect missing snowflake');
assert(advancedMatch.missingSkills.includes('dbt'), 'Should detect missing dbt');
console.log(`✓ Missing skills cleanly identified: ${advancedMatch.missingSkills.join(', ')}`);

console.log('All Resume ATS & Matching tests passed successfully!');
