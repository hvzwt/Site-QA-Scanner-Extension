import { ComparisonReport, ContentComparisonItem, LiveContentBlock } from '../types';

/** Thresholds for the fuzzy (Dice bigram) fallback. */
const EXACT_THRESHOLD = 0.95;
const MISMATCH_THRESHOLD = 0.5;
/** Shortest compacted string allowed to match "inside" a longer block without word boundaries. */
const MIN_COMPACT_CONTAINMENT = 8;

/**
 * Normalizes text to handle smart quotes, dashes, invisible characters and irregular whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[​-‍⁠﻿­]/g, '') // Zero-width chars, BOM, soft hyphen
    .replace(/[‘’‚‛′]/g, "'") // Smart single quotes / primes
    .replace(/[“”„‟″]/g, '"') // Smart double quotes
    .replace(/[‐-―−]/g, '-') // Hyphen variants, en/em dashes, minus
    .replace(/…/g, '...') // Ellipsis
    .replace(/\s+/g, ' ') // Collapse whitespace (incl. nbsp and Figma's U+2028 soft line break)
    .trim()
    .toLowerCase();
}

/**
 * Loose comparison key: keeps only letters, digits, currency symbols and "%".
 * Drops punctuation, arrows, bullets, ™/®, emoji etc. which commonly differ between
 * a design file and the built page (icons, CSS ::before bullets, trailing "→").
 * Numbers and currency are kept so real copy changes like "$39" → "$49" still show.
 */
export function toMatchKey(text: string): string {
  return normalizeText(text)
    .replace(/[^\p{L}\p{N}\p{Sc}%]+/gu, ' ')
    .trim();
}

function getBigrams(str: string): Map<string, number> {
  const bigrams = new Map<string, number>();
  for (let i = 0; i < str.length - 1; i++) {
    const bigram = str.substring(i, i + 2);
    bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  }
  return bigrams;
}

function diceFromBigrams(a: Map<string, number>, lenA: number, b: Map<string, number>, lenB: number): number {
  const total = (lenA - 1) + (lenB - 1);
  if (total <= 0) return 0;
  // Iterate the smaller map
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let intersection = 0;
  for (const [bigram, count] of small) {
    const other = large.get(bigram);
    if (other) intersection += Math.min(count, other);
  }
  return (2 * intersection) / total;
}

/**
 * Computes Dice's bigram similarity coefficient (0 to 1) on the loose match key.
 */
export function computeStringSimilarity(a: string, b: string): number {
  const keyA = toMatchKey(a);
  const keyB = toMatchKey(b);

  if (keyA === keyB) return keyA || normalizeText(a) === normalizeText(b) ? 1.0 : 0.0;
  if (!keyA || !keyB) return 0.0;
  if (keyA.length < 2 || keyB.length < 2) return 0.0;

  return diceFromBigrams(getBigrams(keyA), keyA.length, getBigrams(keyB), keyB.length);
}

interface PreparedLive {
  index: number;
  key: string; // spaced loose key
  padded: string; // " key " for word-boundary containment
  compact: string; // key without spaces (handles <br> / inline-tag joins)
  bigrams: Map<string, number> | null; // built lazily, only if fuzzy fallback is needed
}

type FoundMatch = { live: PreparedLive; method: 'exact' | 'contained' };

/**
 * Compares approved content blocks from Google Doc/Figma against live DOM content blocks.
 *
 * Matching order per approved block (cheapest and most reliable first):
 *  1. Exact match on the loose key (O(1) map lookup)
 *  2. Exact match ignoring spaces (e.g. "Our<br>Services" rendered as "OurServices")
 *  3. Contained inside a live block (Figma layer split differently than the HTML, sr-only suffixes)
 *  4. Multi-line Figma/Doc box whose every line is found on the page
 *  5. Fuzzy Dice similarity → "mismatch" (real copy change) or "missing"
 */
export function compareContent(
  approvedBlocks: string[],
  liveBlocks: LiveContentBlock[],
  sourceUrl: string,
  sourceType: 'google-doc' | 'figma' | 'manual',
  pageUrl: string
): ComparisonReport {
  const items: ContentComparisonItem[] = [];

  let exactMatches = 0;
  let mismatches = 0;
  let missingFromPage = 0;

  // --- Prepare live blocks once (instead of per approved×live pair) ---
  const prepared: PreparedLive[] = [];
  const byKey = new Map<string, PreparedLive>();
  const byCompact = new Map<string, PreparedLive>();
  for (let i = 0; i < liveBlocks.length; i++) {
    const key = toMatchKey(liveBlocks[i].text);
    if (!key) continue;
    const p: PreparedLive = { index: i, key, padded: ` ${key} `, compact: key.replace(/ /g, ''), bigrams: null };
    prepared.push(p);
    if (!byKey.has(key)) byKey.set(key, p);
    if (!byCompact.has(p.compact)) byCompact.set(p.compact, p);
  }

  const findOnPage = (text: string): FoundMatch | null => {
    const key = toMatchKey(text);
    if (!key) return null;
    const compact = key.replace(/ /g, '');

    const exact = byKey.get(key) || byCompact.get(compact);
    if (exact) return { live: exact, method: 'exact' };

    // Containment: prefer the smallest live block that contains the approved text
    const padded = ` ${key} `;
    let best: PreparedLive | null = null;
    for (const p of prepared) {
      if (p.key.length <= key.length) continue;
      if (p.padded.includes(padded) || (compact.length >= MIN_COMPACT_CONTAINMENT && p.compact.includes(compact))) {
        if (!best || p.key.length < best.key.length) best = p;
      }
    }
    return best ? { live: best, method: 'contained' } : null;
  };

  // Filter trivial strings and dedupe repeated copy (e.g. "Learn more" on 10 Figma cards)
  const seenApproved = new Set<string>();
  const cleanApproved = approvedBlocks.filter(b => {
    if (!b || b.trim().length <= 1) return false;
    const k = normalizeText(b);
    if (seenApproved.has(k)) return false;
    seenApproved.add(k);
    return true;
  });

  for (const approvedText of cleanApproved) {
    const itemId = `comp-${Math.random().toString(36).substring(2, 9)}`;

    // 1–3. Exact / no-space / contained
    let found = findOnPage(approvedText);
    let note: string | undefined;

    if (found?.method === 'contained') {
      note = 'Found inside a larger text block on the page';
    }

    // 4. Multi-line source box (one Figma layer, several HTML elements)
    if (!found) {
      const lines = approvedText.split(/[\r\n\u2028\u2029]+/).map(l => l.trim()).filter(l => toMatchKey(l));
      if (lines.length > 1) {
        const lineMatches = lines.map(findOnPage);
        if (lineMatches.every(Boolean)) {
          found = lineMatches[0];
          note = `All ${lines.length} lines found across separate elements on the page`;
        }
      }
    }

    if (found) {
      exactMatches++;
      const live = liveBlocks[found.live.index];
      items.push({
        id: itemId,
        type: 'exact',
        approvedText,
        liveText: live.text,
        similarity: 1,
        highlightId: live.highlightId,
        elementSelector: live.elementSelector,
        note,
      });
      continue;
    }

    // 5. Fuzzy fallback: real copy differences (typos, price changes, reworded lines)
    const key = toMatchKey(approvedText);
    let bestIndex = -1;
    let highest = 0;
    if (key.length >= 2) {
      const approvedBigrams = getBigrams(key);
      for (const p of prepared) {
        // Quick length bound: Dice can't reach the threshold if lengths differ too much
        const maxPossible = (2 * Math.min(key.length, p.key.length)) / (key.length + p.key.length);
        if (maxPossible < MISMATCH_THRESHOLD || maxPossible <= highest) continue;
        if (!p.bigrams) p.bigrams = getBigrams(p.key);
        const sim = diceFromBigrams(approvedBigrams, key.length, p.bigrams, p.key.length);
        if (sim > highest) {
          highest = sim;
          bestIndex = p.index;
        }
      }
    }

    if (bestIndex >= 0 && highest >= EXACT_THRESHOLD) {
      exactMatches++;
      const live = liveBlocks[bestIndex];
      items.push({
        id: itemId,
        type: 'exact',
        approvedText,
        liveText: live.text,
        similarity: highest,
        highlightId: live.highlightId,
        elementSelector: live.elementSelector,
      });
    } else if (bestIndex >= 0 && highest >= MISMATCH_THRESHOLD) {
      mismatches++;
      const live = liveBlocks[bestIndex];
      items.push({
        id: itemId,
        type: 'mismatch',
        approvedText,
        liveText: live.text,
        similarity: highest,
        highlightId: live.highlightId,
        elementSelector: live.elementSelector,
      });
    } else {
      missingFromPage++;
      items.push({
        id: itemId,
        type: 'missing',
        approvedText,
        similarity: 0,
      });
    }
  }

  const totalApproved = cleanApproved.length;
  // Score formula: exact matches get full weight (1.0), partial mismatches get partial credit (0.4)
  const matchScore = totalApproved > 0
    ? Math.min(100, Math.round(((exactMatches * 1.0 + mismatches * 0.4) / totalApproved) * 100))
    : 100;

  return {
    sourceUrl,
    sourceType,
    pageUrl,
    matchScore,
    totalApprovedBlocks: totalApproved,
    exactMatches,
    mismatches,
    missingFromPage,
    items,
  };
}
