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

// --- Test 5: Figma copy that IS on the page must not be tagged "mismatch" ---
console.log('\n--- Test 5: Figma ↔ HTML formatting differences (false-mismatch regressions) ---');
const presentCases = [
  ['<br> line break in heading', 'Our\nServices', 'OurServices'],
  ['Figma split into 2 layers', 'Starting at', 'Starting at $39/mo'],
  ['Arrow glyph / icon', 'Get Started →', 'Get Started'],
  ['sr-only text in link', 'Learn more', 'Learn more about our pricing plans'],
  ['nbsp + zero-width space', 'Free 14-day trial', 'Free\u00A014\u2011day\u200B trial'],
  ['Soft hyphen', 'Internationalization support', 'Interna\u00ADtionalization support'],
  ['Trademark symbol', 'Acme Cloud™ platform', 'Acme Cloud platform'],
  ['Bullet glyph', '• Unlimited projects', 'Unlimited projects'],
  ['Figma \u2028 soft return', 'Built for\u2028modern teams', 'Built for modern teams'],
];
for (const [label, figmaText, liveText] of presentCases) {
  const r = compareContent([figmaText], [{ text: liveText, elementSelector: 'x', highlightId: 'sqa-x' }], '', 'figma', '');
  assert.strictEqual(r.items[0].type, 'exact', `${label}: expected exact, got ${r.items[0].type}`);
  assert.strictEqual(r.items[0].highlightId, 'sqa-x', `${label}: locate target lost`);
  console.log(`  ✓ ${label}`);
}

const multi = compareContent(
  ['We build fast websites.\nOur team ships every week.'],
  [
    { text: 'We build fast websites.', elementSelector: 'p.a', highlightId: 'sqa-a' },
    { text: 'Our team ships every week.', elementSelector: 'p.b', highlightId: 'sqa-b' },
  ],
  '', 'figma', ''
);
assert.strictEqual(multi.items[0].type, 'exact');
assert.strictEqual(multi.items[0].highlightId, 'sqa-a');
console.log('  ✓ Multi-paragraph Figma text box matched across separate <p> elements');

// Real changes must still be caught
const stillMismatch = compareContent(['Plans from $39/mo'], [{ text: 'Plans from $49/mo', elementSelector: 'p', highlightId: 'h' }], '', 'figma', '');
assert.strictEqual(stillMismatch.items[0].type, 'mismatch');
const currency = compareContent(['Only €39 today'], [{ text: 'Only $39 today', elementSelector: 'p', highlightId: 'h' }], '', 'figma', '');
assert.notStrictEqual(currency.items[0].type, 'exact');
const wordBoundary = compareContent(['Art'], [{ text: 'Start your journey', elementSelector: 'p', highlightId: 'h' }], '', 'figma', '');
assert.notStrictEqual(wordBoundary.items[0].type, 'exact');
const partialLines = compareContent(
  ['We build fast websites.\nOur team ships every month.'],
  [{ text: 'We build fast websites.', elementSelector: 'p', highlightId: 'h' }, { text: 'Our team ships every week.', elementSelector: 'p', highlightId: 'h2' }],
  '', 'figma', ''
);
assert.notStrictEqual(partialLines.items[0].type, 'exact');
console.log('  ✓ Price, currency, partial-word and changed-line differences are still flagged');

const dupes = compareContent(['Learn more', 'Learn more', 'Learn more'], [{ text: 'Learn more', elementSelector: 'a', highlightId: 'h' }], '', 'figma', '');
assert.strictEqual(dupes.totalApprovedBlocks, 1);
console.log('  ✓ Repeated Figma labels counted once');

// Performance: 1,500 Figma layers × 1,500 page blocks
const words = 'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda omicron sigma omega'.split(' ');
const sentence = (seed) => Array.from({ length: 6 + (seed % 8) }, (_, k) => words[(seed * 7 + k * 3) % words.length]).join(' ') + ` ${seed}`;
const bigApproved = Array.from({ length: 1500 }, (_, i) => sentence(i) + (i % 3 === 0 ? ' changed' : ''));
const bigLive = Array.from({ length: 1500 }, (_, i) => ({ text: sentence(i), elementSelector: 'p', highlightId: `h${i}` }));
const t0 = performance.now();
compareContent(bigApproved, bigLive, '', 'figma', '');
const ms = Math.round(performance.now() - t0);
console.log(`  ✓ 1,500 × 1,500 blocks compared in ${ms} ms`);

console.log('\n🎉 ALL CONTENT VERIFICATION & DIFF TESTS PASSED SUCCESSFULLY!\n');
