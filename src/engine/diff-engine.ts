import { ComparisonReport, ContentComparisonItem, LiveContentBlock } from '../types';

/**
 * Normalizes text to handle smart quotes, em-dashes, and irregular whitespace.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u2018\u2019]/g, "'") // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
    .replace(/[\u2013\u2014]/g, '-') // En/em dashes
    .replace(/\u2026/g, '...') // Ellipsis
    .replace(/\s+/g, ' ') // Collapse multiple whitespace
    .trim()
    .toLowerCase();
}

/**
 * Computes Dice's bigram similarity coefficient (0 to 1).
 */
export function computeStringSimilarity(a: string, b: string): number {
  const normA = normalizeText(a);
  const normB = normalizeText(b);

  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;
  if (normA.length < 2 || normB.length < 2) return normA === normB ? 1.0 : 0.0;

  // Generate bigrams
  const getBigrams = (str: string) => {
    const bigrams = new Map<string, number>();
    for (let i = 0; i < str.length - 1; i++) {
      const bigram = str.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(normA);
  const bigramsB = getBigrams(normB);

  let intersectionSize = 0;
  for (const [bigram, countA] of bigramsA.entries()) {
    if (bigramsB.has(bigram)) {
      intersectionSize += Math.min(countA, bigramsB.get(bigram)!);
    }
  }

  const totalBigrams = (normA.length - 1) + (normB.length - 1);
  return (2.0 * intersectionSize) / totalBigrams;
}

/**
 * Compares approved content blocks from Google Doc/Figma against live DOM content blocks.
 */
export function compareContent(
  approvedBlocks: string[],
  liveBlocks: LiveContentBlock[],
  sourceUrl: string,
  sourceType: 'google-doc' | 'figma' | 'manual',
  pageUrl: string
): ComparisonReport {
  const items: ContentComparisonItem[] = [];
  const usedLiveIndices = new Set<number>();

  let exactMatches = 0;
  let mismatches = 0;
  let missingFromPage = 0;

  // Filter out tiny trivial strings like single punctuation
  const cleanApproved = approvedBlocks.filter(b => b && b.trim().length > 1);

  for (const approvedText of cleanApproved) {
    let bestMatchIndex = -1;
    let highestSimilarity = 0;

    for (let i = 0; i < liveBlocks.length; i++) {
      const liveBlock = liveBlocks[i];
      const similarity = computeStringSimilarity(approvedText, liveBlock.text);

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatchIndex = i;
      }
    }

    const itemId = `comp-${Math.random().toString(36).substring(2, 9)}`;

    if (highestSimilarity >= 0.95) {
      // 1. Exact Match
      exactMatches++;
      if (bestMatchIndex >= 0) usedLiveIndices.add(bestMatchIndex);
      items.push({
        id: itemId,
        type: 'exact',
        approvedText,
        liveText: bestMatchIndex >= 0 ? liveBlocks[bestMatchIndex].text : approvedText,
        similarity: highestSimilarity,
        highlightId: bestMatchIndex >= 0 ? liveBlocks[bestMatchIndex].highlightId : undefined,
        elementSelector: bestMatchIndex >= 0 ? liveBlocks[bestMatchIndex].elementSelector : undefined,
      });
    } else if (highestSimilarity >= 0.40 && bestMatchIndex >= 0) {
      // 2. Content Mismatch (Changed copy, typo, price change, etc.)
      mismatches++;
      usedLiveIndices.add(bestMatchIndex);
      const matchedLive = liveBlocks[bestMatchIndex];
      items.push({
        id: itemId,
        type: 'mismatch',
        approvedText,
        liveText: matchedLive.text,
        similarity: highestSimilarity,
        highlightId: matchedLive.highlightId,
        elementSelector: matchedLive.elementSelector,
      });
    } else {
      // 3. Missing Content (Approved text not found on live page)
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
