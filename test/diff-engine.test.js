import assert from 'assert';
import { parseGoogleDocId, parseFigmaUrl, splitTextIntoBlocks } from '../src/engine/source-extractor.ts';
import { computeStringSimilarity, normalizeText, compareContent } from '../src/engine/diff-engine.ts';

console.log('🧪 Starting Content Verification & Diff Engine Test Suite...');

// --- Test 1: Google Doc URL Parser ---
console.log('\n--- Test 1: Google Doc URL Parsing ---');
const docUrl1 = 'https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?tab=t.0';
const docId1 = parseGoogleDocId(docUrl1);
assert.strictEqual(docId1, '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
console.log('  ✓ Extracted Google Doc ID from standard edit link');

const invalidDocUrl = 'https://example.com/document/d/123';
assert.strictEqual(parseGoogleDocId(invalidDocUrl), null);
console.log('  ✓ Gracefully returned null for non-Google Doc URL');

// --- Test 2: Figma URL Parser ---
console.log('\n--- Test 2: Figma URL Parsing ---');
const figmaUrl1 = 'https://www.figma.com/design/AbCdEf12345/App-Redesign?node-id=102-456&t=xyz';
const figmaParsed1 = parseFigmaUrl(figmaUrl1);
assert.ok(figmaParsed1 !== null);
assert.strictEqual(figmaParsed1?.fileKey, 'AbCdEf12345');
assert.strictEqual(figmaParsed1?.nodeId, '102:456');
console.log('  ✓ Extracted Figma fileKey and formatted nodeId (102:456)');

const figmaUrl2 = 'https://www.figma.com/file/98765ZYXWV/Design-System';
const figmaParsed2 = parseFigmaUrl(figmaUrl2);
assert.strictEqual(figmaParsed2?.fileKey, '98765ZYXWV');
assert.strictEqual(figmaParsed2?.nodeId, undefined);
console.log('  ✓ Extracted Figma fileKey without nodeId');

// --- Test 3: String Normalization & Similarity ---
console.log('\n--- Test 3: String Normalization & Bigram Similarity ---');
const textWithSmartQuotes = '“Transforming Digital Experiences” – 2026';
const textWithStraightQuotes = '"Transforming Digital Experiences" - 2026';
assert.strictEqual(normalizeText(textWithSmartQuotes), normalizeText(textWithStraightQuotes));
assert.strictEqual(computeStringSimilarity(textWithSmartQuotes, textWithStraightQuotes), 1.0);
console.log('  ✓ Normalized smart quotes and em-dashes to 100% similarity');

const approvedPrice = 'Get started for only $39 per month';
const livePrice = 'Get started for only $49 per month';
const simPrice = computeStringSimilarity(approvedPrice, livePrice);
assert.ok(simPrice > 0.70 && simPrice < 1.0, `Similarity was ${simPrice}, expected between 0.7 and 1.0`);
console.log(`  ✓ Detected partial discrepancy (Similarity: ${Math.round(simPrice * 100)}%)`);

// --- Test 4: Content Compare Workflow ---
console.log('\n--- Test 4: End-to-End Content Comparison ---');
const approvedSpec = [
  'Transforming Digital Experiences',
  'Get started for only $39 per month',
  'Enterprise Grade Security Guarantee', // Missing from live site
];

const liveWebpageBlocks = [
  { text: 'Transforming Digital Experiences', elementSelector: 'h1.hero-title', highlightId: 'sqa-h1' },
  { text: 'Get started for only $49 per month', elementSelector: 'p.price-tag', highlightId: 'sqa-price' }, // Changed price
  { text: 'Unapproved marketing banner', elementSelector: 'div.banner', highlightId: 'sqa-banner' },
];

const report = compareContent(
  approvedSpec,
  liveWebpageBlocks,
  docUrl1,
  'google-doc',
  'https://mysite.com'
);

console.log(`  Match Score: ${report.matchScore}%`);
console.log(`  Exact Matches: ${report.exactMatches}`);
console.log(`  Mismatches: ${report.mismatches}`);
console.log(`  Missing: ${report.missingFromPage}`);

assert.strictEqual(report.totalApprovedBlocks, 3);
assert.strictEqual(report.exactMatches, 1, 'Should find 1 exact match');
assert.strictEqual(report.mismatches, 1, 'Should find 1 mismatch (price change)');
assert.strictEqual(report.missingFromPage, 1, 'Should find 1 missing block');

const mismatchItem = report.items.find(i => i.type === 'mismatch');
assert.strictEqual(mismatchItem?.approvedText, 'Get started for only $39 per month');
assert.strictEqual(mismatchItem?.liveText, 'Get started for only $49 per month');
assert.strictEqual(mismatchItem?.highlightId, 'sqa-price');
console.log('  ✓ Successfully identified mismatched item with on-page highlightId');

const missingItem = report.items.find(i => i.type === 'missing');
assert.strictEqual(missingItem?.approvedText, 'Enterprise Grade Security Guarantee');
console.log('  ✓ Successfully identified missing copy block');

console.log('\n🎉 ALL CONTENT VERIFICATION & DIFF TESTS PASSED SUCCESSFULLY!\n');
