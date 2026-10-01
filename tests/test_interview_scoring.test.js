/**
 * Calibrated Interview Scoring Boundary Tests
 * Verifies that very short/incomplete or irrelevant answers cannot receive high scores.
 */
const assert = require('assert');

// Mock browser environment for node
global.window = global;
require('../docs/js/interview-coach.js');
const Coach = global.AJSInterviewCoach;

console.log('Running Interview Scoring Calibration tests...');

const sampleQuestion = {
  id: 'test_sql_1',
  track: 'sql',
  question: 'Explain the difference between WHERE and HAVING in SQL, and provide an example.',
  rubricKeywords: ['where', 'having', 'aggregate', 'group by', 'filter', 'rows']
};

// 1. Empty answer boundary
const emptyRes = Coach.analyzeTranscript('', sampleQuestion, 0);
assert.strictEqual(emptyRes.score, 0, 'Empty answer must score 0');
console.log('✓ Empty answer scores 0');

// 2. 10-word answer boundary
const tenWordAnswer = 'I use where to filter rows and having for aggregates.';
const tenWordRes = Coach.analyzeTranscript(tenWordAnswer, sampleQuestion, 15);
assert(tenWordRes.score <= 30, `10-word answer must be <= 30, got ${tenWordRes.score}`);
console.log(`✓ 10-word answer capped appropriately (score: ${tenWordRes.score})`);

// 3. 22-word answer boundary spoken over 60 seconds (defect mentioned in prompt: used to score ~90)
const twentyTwoWordAnswer = 'WHERE filters individual records before any grouping happens, while HAVING is used specifically after GROUP BY to filter grouped summary results.';
const twentyTwoWordRes = Coach.analyzeTranscript(twentyTwoWordAnswer, sampleQuestion, 60);
assert(twentyTwoWordRes.score <= 50, `22-word answer must NOT score high; expected <= 50, got ${twentyTwoWordRes.score}`);
console.log(`✓ 22-word answer defect resolved: scored ${twentyTwoWordRes.score}/100 instead of ~90`);

// 4. 25-word answer boundary
const twentyFiveWordAnswer = 'WHERE is applied before aggregation to filter individual table rows. In contrast, HAVING filters aggregated results produced by GROUP BY, evaluating conditions on aggregate calculations.';
const twentyFiveWordRes = Coach.analyzeTranscript(twentyFiveWordAnswer, sampleQuestion, 20);
assert(twentyFiveWordRes.score <= 50, `25-word answer must be <= 50, got ${twentyFiveWordRes.score}`);
console.log(`✓ 25-word answer capped appropriately (score: ${twentyFiveWordRes.score})`);

// 5. Irrelevant answer boundary
const irrelevantAnswer = 'Yesterday I went to the park and watched people playing football in the rain. The weather was nice and I bought some ice cream.';
const irrelevantRes = Coach.analyzeTranscript(irrelevantAnswer, sampleQuestion, 45);
assert(irrelevantRes.score <= 38, `Irrelevant answer must not score well; expected <= 38, got ${irrelevantRes.score}`);
console.log(`✓ Irrelevant answer penalized (score: ${irrelevantRes.score})`);

// 6. Filler-heavy answer boundary
const fillerHeavyAnswer = 'Um basically you know where is like filtering rows uh basically and like having is actually you know for grouping like um yeah.';
const fillerRes = Coach.analyzeTranscript(fillerHeavyAnswer, sampleQuestion, 40);
assert(fillerRes.totalFillers >= 6, 'Should detect heavy filler words');
assert(fillerRes.breakdown.deductions >= 8, 'Should apply filler deductions');
assert(fillerRes.score <= 35, `Filler heavy answer must be <= 35, got ${fillerRes.score}`);
console.log(`✓ Filler-heavy answer detected ${fillerRes.totalFillers} fillers and deducted ${fillerRes.breakdown.deductions} points (score: ${fillerRes.score})`);

// 7. Strong, complete, structured answer with metrics & STAR
const strongAnswer = `In a recent analytics project for an e-commerce platform, our situation was analyzing a transaction dataset with over 45,000 orders.
The task was to identify top customers with high spend while excluding cancelled transactions.
My action was writing a SQL query where I first used the WHERE clause to filter out cancelled orders before any grouping occurred. Then I grouped by customer_id and applied the HAVING clause to filter aggregate revenue, requiring sum(amount) greater than 10,000.
As a result, we successfully reduced query execution time by 18% and delivered an accurate cohort report to stakeholders.
In summary, WHERE filters individual rows prior to aggregation, while HAVING operates strictly on aggregated groups created by GROUP BY.`;

const strongRes = Coach.analyzeTranscript(strongAnswer, sampleQuestion, 65);
assert(strongRes.score >= 80, `Strong complete answer should score >= 80, got ${strongRes.score}`);
assert(strongRes.starCount >= 3, `Should identify STAR structure, found ${strongRes.starCount}`);
assert(strongRes.metricsFound.length >= 2, `Should identify quantifiable metrics, found ${strongRes.metricsFound.length}`);
console.log(`✓ Strong complete answer scored ${strongRes.score}/100 with STAR=${strongRes.starCount} and metrics=${strongRes.metricsFound.length}`);

console.log('All Interview Scoring Calibration tests passed successfully!');
