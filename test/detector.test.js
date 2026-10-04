import fs from 'fs';
import path from 'path';
import assert from 'assert';

// Dynamic import of the compiled detector or source
// Let's test the functions using our built background or detector logic
import { 
  analyzeTextSnippet, 
  checkCopyrightYear, 
  checkImageElement, 
  scanHtmlString, 
  DEFAULT_SETTINGS 
} from '../src/engine/detector.ts';

console.log('🧪 Starting Detection Engine Test Suite (Year: 2026)...');

const SETTINGS_2026 = {
  ...DEFAULT_SETTINGS,
  targetYear: 2026,
};

// --- Test 1: Outdated Copyright Checks ---
console.log('\n--- Test 1: Copyright Year Mismatches ---');
const outdated2024 = checkCopyrightYear('© 2024 Acme Corp. All rights reserved.', 2026);
assert.strictEqual(outdated2024.length, 1, 'Should flag 2024 as outdated');
assert.strictEqual(outdated2024[0].meta?.foundYear, 2024);
console.log('  ✓ Flagged © 2024 correctly');

const outdated2025Range = checkCopyrightYear('Copyright 2018-2025 Widgets Inc.', 2026);
assert.strictEqual(outdated2025Range.length, 1, 'Should flag 2025 range as outdated in 2026');
assert.strictEqual(outdated2025Range[0].meta?.foundYear, 2025);
console.log('  ✓ Flagged Copyright 2018-2025 correctly');

const valid2026 = checkCopyrightYear('© 2026 Modern Platform. All rights reserved.', 2026);
assert.strictEqual(valid2026.length, 0, 'Should NOT flag 2026');
console.log('  ✓ Passed current year © 2026 without false positive');

const placeholderYear = checkCopyrightYear('© [Year] Future Corp.', 2026);
assert.strictEqual(placeholderYear.length, 1, 'Should flag placeholder [Year]');
console.log('  ✓ Flagged unfilled © [Year] placeholder');

// --- Test 2: Dummy Text & Lorem Ipsum ---
console.log('\n--- Test 2: Dummy Content & Placeholders ---');
const loremText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.';
const loremIssues = analyzeTextSnippet(loremText, SETTINGS_2026);
assert.ok(loremIssues.some(i => i.category === 'lorem-ipsum'), 'Should detect Lorem Ipsum');
console.log('  ✓ Detected Latin Lorem Ipsum');

const dummyText = 'Insert text here for product description.';
const dummyIssues = analyzeTextSnippet(dummyText, SETTINGS_2026);
assert.ok(dummyIssues.some(i => i.category === 'dummy-text'), 'Should detect "insert text here"');
console.log('  ✓ Detected dummy placeholder phrase');

const bracketText = 'Welcome to [Company Name] where innovation meets quality.';
const bracketIssues = analyzeTextSnippet(bracketText, SETTINGS_2026);
assert.ok(bracketIssues.some(i => i.category === 'template-variable'), 'Should detect [Company Name]');
console.log('  ✓ Detected bracketed placeholder [Company Name]');

const tmplText = 'Welcome back, {{ user_first_name }}!';
const tmplIssues = analyzeTextSnippet(tmplText, SETTINGS_2026);
assert.ok(tmplIssues.some(i => i.category === 'template-variable'), 'Should detect {{ user_first_name }}');
console.log('  ✓ Detected template tag variable');

// --- Test 3: HTML Page Scans ---
console.log('\n--- Test 3: Demo Website HTML Page Audits ---');

const indexHtml = fs.readFileSync(path.resolve('demo-site/index.html'), 'utf-8');
const indexScan = scanHtmlString(indexHtml, 'http://localhost/index.html', SETTINGS_2026);
console.log(`  Index Page Issues Found: ${indexScan.issues.length}`);
assert.ok(indexScan.issues.length >= 4, 'Index should have multiple dummy content & outdated copyright issues');
assert.ok(indexScan.issues.some(i => i.category === 'outdated-copyright'), 'Index should flag 2024 copyright');
assert.ok(indexScan.issues.some(i => i.category === 'lorem-ipsum'), 'Index should flag Lorem Ipsum');
assert.ok(indexScan.issues.some(i => i.category === 'placeholder-image'), 'Index should flag placeholder image');
console.log('  ✓ Index page audited with 100% expected issue match');

const aboutHtml = fs.readFileSync(path.resolve('demo-site/about.html'), 'utf-8');
const aboutScan = scanHtmlString(aboutHtml, 'http://localhost/about.html', SETTINGS_2026);
console.log(`  About Page Issues Found: ${aboutScan.issues.length}`);
assert.ok(aboutScan.issues.some(i => i.category === 'outdated-copyright'), 'About should flag 2025 copyright');
assert.ok(aboutScan.issues.some(i => i.category === 'dummy-text'), 'About should flag TODO');
console.log('  ✓ About page audited with 100% expected issue match');

const cleanHtml = fs.readFileSync(path.resolve('demo-site/clean.html'), 'utf-8');
const cleanScan = scanHtmlString(cleanHtml, 'http://localhost/clean.html', SETTINGS_2026);
console.log(`  Clean Page Issues Found: ${cleanScan.issues.length}`);
assert.strictEqual(cleanScan.issues.length, 0, 'Clean page should have 0 issues');
console.log('  ✓ Clean page passed audit with zero false positives');

// --- Test 4: Multiple Occurrences on Same Page (User Feedback) ---
console.log('\n--- Test 4: Multiple Lorem Ipsum Instances on Same Page ---');
const userHtmlSnippet = `
<div class="new-page">
  <div id="home" class="hero-section">
    <div class="container"><div class="row f2wf-columns"><div class="column">
      <div class="text-3">Heading</div>
      <p class="lorem-ipsum-para">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco</p>
    </div></div></div>
  </div>
  <div id="service" class="service-section">
    <div class="container"><div class="row f2wf-columns"><div class="column">
      <div class="text-3">Heading</div>
      <p class="lorem-ipsum-para">Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco</p>
    </div></div></div>
  </div>
</div>
`;

const userSnippetScan = scanHtmlString(userHtmlSnippet, 'https://example.com/tested-page', SETTINGS_2026);
const loremIssuesInSnippet = userSnippetScan.issues.filter(i => i.category === 'lorem-ipsum');
console.log(`  User Snippet Lorem Ipsum Issues Found: ${loremIssuesInSnippet.length}`);
assert.strictEqual(loremIssuesInSnippet.length, 2, 'Must detect both 2 Lorem Ipsum occurrences on the page');
console.log('  ✓ Correctly found both 2 Lorem Ipsum issues in HTML string scan');

// Test active DOM deduplication with distinct highlight IDs
import { deduplicateIssues } from '../src/engine/detector.ts';
const simulatedDomIssues = [
  {
    id: 'issue-1',
    category: 'lorem-ipsum',
    severity: 'high',
    title: 'Lorem Ipsum Placeholder Detected',
    snippet: 'Lorem ipsum',
    context: 'Lorem ipsum dolor sit amet...',
    pageUrl: 'https://example.com/tested-page',
    highlightId: 'sqa-obunobd',
  },
  {
    id: 'issue-2',
    category: 'lorem-ipsum',
    severity: 'high',
    title: 'Lorem Ipsum Placeholder Detected',
    snippet: 'Lorem ipsum',
    context: 'Lorem ipsum dolor sit amet...',
    pageUrl: 'https://example.com/tested-page',
    highlightId: 'sqa-mjg3zm1',
  },
];
const dedupedDom = deduplicateIssues(simulatedDomIssues);
assert.strictEqual(dedupedDom.length, 2, 'Must preserve both distinct DOM elements even with identical snippet');
console.log('  ✓ Preserved both distinct DOM elements with identical snippet in active DOM scan');

console.log('\n--- Test 5: Broken & Unlinked # Anchor Links ---');
import { checkAnchorElement } from '../src/engine/detector.ts';

const hashLink1 = checkAnchorElement('#', 'GET STARTED', 'https://example.com');
assert.ok(hashLink1 !== null, 'Should flag href="#"');
assert.strictEqual(hashLink1?.category, 'unlinked-anchor');
console.log('  ✓ Correctly flagged <a href="#">');

const hashLink2 = checkAnchorElement('#!', 'Sign up', 'https://example.com');
assert.ok(hashLink2 !== null, 'Should flag href="#!"');
console.log('  ✓ Correctly flagged <a href="#!">');

const jsVoidLink = checkAnchorElement('javascript:void(0)', 'Features', 'https://example.com');
assert.ok(jsVoidLink !== null, 'Should flag javascript:void(0)');
console.log('  ✓ Correctly flagged <a href="javascript:void(0)">');

const validLink = checkAnchorElement('https://example.com/pricing', 'Pricing', 'https://example.com');
assert.strictEqual(validLink, null, 'Should NOT flag valid link');
console.log('  ✓ Correctly passed valid destination link');

// Test with the full page snippet from user containing multiple href="#"
const pageWithHashLinks = `
<div>
  <nav>
    <a href="#" class="nav-link">About</a>
    <a href="#" class="nav-link">Features</a>
    <a href="#" class="nav-link">Pricing</a>
    <a href="#" class="button">GET STARTED</a>
  </nav>
  <p>Some clean copy here.</p>
</div>
`;
const hashPageScan = scanHtmlString(pageWithHashLinks, 'https://example.com', SETTINGS_2026);
const anchorIssues = hashPageScan.issues.filter(i => i.category === 'unlinked-anchor');
assert.strictEqual(anchorIssues.length, 4, 'Should detect all 4 unlinked # links in navigation');
console.log('  ✓ Correctly detected all 4 unlinked # navigation links on page');

console.log('\n--- Test 6: HTML Structure & SEO Quality Audits ---');
import { checkHtmlStructureFromString } from '../src/engine/detector.ts';

const flawedStructHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Short</title>
</head>
<body>
  <div>
    <h2>Subheading First</h2>
    <h4>Skipped Level Heading</h4>
  </div>
  <div>1</div><div>2</div><div>3</div><div>4</div><div>5</div>
  <div>6</div><div>7</div><div>8</div><div>9</div><div>10</div>
</body>
</html>
`;

const structIssues = checkHtmlStructureFromString(flawedStructHtml, 'https://example.com/test-struct');
assert.ok(structIssues.some(i => i.title.includes('Missing <h1>')), 'Should flag missing <h1> header');
assert.ok(structIssues.some(i => i.title.includes('Skipped Heading Level')), 'Should flag skipped heading level (<h2> to <h4>)');
assert.ok(structIssues.some(i => i.title.includes('Page Title Too Short')), 'Should flag short title');
assert.ok(structIssues.some(i => i.title.includes('Missing Meta Description')), 'Should flag missing meta description');
assert.ok(structIssues.some(i => i.title.includes('Missing <main> Landmark')), 'Should flag missing <main> container');
assert.ok(structIssues.some(i => i.title.includes('Div Soup')), 'Should flag non-semantic div soup structure');
console.log('  ✓ Correctly detected all HTML structure & SEO quality issues (Missing H1, Heading Skips, Meta Tags, Landmarks)');

console.log('\n🎉 ALL VERIFICATION TESTS PASSED (INCLUDING HTML STRUCTURE & SEO)!\n');
