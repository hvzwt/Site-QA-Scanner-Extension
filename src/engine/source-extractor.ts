/**
 * Source Extractor for Google Docs and Figma Links.
 */

export function parseGoogleDocId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i);
  return match ? match[1] : null;
}

export function parseFigmaUrl(url: string): { fileKey: string; nodeId?: string } | null {
  if (!url) return null;
  const keyMatch = url.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/i);
  if (!keyMatch) return null;

  const fileKey = keyMatch[1];
  let nodeId: string | undefined;

  try {
    const parsedUrl = new URL(url);
    const rawNodeId = parsedUrl.searchParams.get('node-id');
    if (rawNodeId) {
      // Figma node IDs in URLs can be "1-2" or "1:2"
      nodeId = decodeURIComponent(rawNodeId).replace('-', ':');
    }
  } catch {
    // Ignore URL parse error
  }

  return { fileKey, nodeId };
}

/**
 * Fetches text blocks from a Google Doc using its public export endpoint.
 */
export async function fetchGoogleDocText(docUrl: string): Promise<string[]> {
  const docId = parseGoogleDocId(docUrl);
  if (!docId) {
    throw new Error('Invalid Google Doc URL. Format must be: https://docs.google.com/document/d/...');
  }

  const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  const response = await fetch(exportUrl);

  if (!response.ok) {
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error(
        'Unable to access Google Doc. Please ensure the document sharing permission is set to "Anyone with the link can view".'
      );
    }
    throw new Error(`Failed to fetch Google Doc (HTTP ${response.status})`);
  }

  const rawText = await response.text();

  // If Google returns HTML instead of text, it redirected to a login prompt
  if (rawText.trim().startsWith('<!DOCTYPE html') || rawText.includes('<html')) {
    throw new Error(
      'Document requires Google Login. Please set document sharing to "Anyone with the link can view" to allow automated verification.'
    );
  }

  return splitTextIntoBlocks(rawText);
}

/**
 * Fetches text blocks from Figma REST API using a Figma Personal Access Token.
 */
export async function fetchFigmaText(figmaUrl: string, token: string): Promise<string[]> {
  const parsed = parseFigmaUrl(figmaUrl);
  if (!parsed) {
    throw new Error('Invalid Figma URL. Format must be: https://www.figma.com/design/:file_key/...');
  }

  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    throw new Error(
      'Figma Personal Access Token is required. You can generate one in Figma under Account Settings → Personal access tokens.'
    );
  }

  let apiUrl = `https://api.figma.com/v1/files/${parsed.fileKey}`;
  if (parsed.nodeId) {
    apiUrl = `https://api.figma.com/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}`;
  }

  const response = await fetch(apiUrl, {
    headers: {
      'X-Figma-Token': cleanToken,
    },
  });

  if (!response.ok) {
    if (response.status === 403 || response.status === 401) {
      throw new Error('Invalid Figma Personal Access Token or access denied to this file.');
    }
    if (response.status === 404) {
      throw new Error('Figma file not found. Please verify the URL.');
    }
    throw new Error(`Figma API error: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const textBlocks: string[] = [];

  // Traverse JSON node tree
  if (data.nodes) {
    for (const id in data.nodes) {
      const nodeData = data.nodes[id];
      if (nodeData && nodeData.document) {
        collectFigmaTextNodes(nodeData.document, textBlocks);
      }
    }
  } else if (data.document) {
    collectFigmaTextNodes(data.document, textBlocks);
  }

  // Deduplicate and filter empty blocks
  return textBlocks
    .map(t => t.trim())
    .filter(t => t.length > 1);
}

function collectFigmaTextNodes(node: any, outList: string[]) {
  if (!node) return;

  if (node.type === 'TEXT' && node.characters && typeof node.characters === 'string') {
    const chars = node.characters.trim();
    if (chars.length > 0) {
      outList.push(chars);
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectFigmaTextNodes(child, outList);
    }
  }
}

/**
 * Splits raw document text into logical blocks (paragraphs, headers, list items).
 */
export function splitTextIntoBlocks(rawText: string): string[] {
  // Strip BOM
  const clean = rawText.replace(/^\uFEFF/, '');
  
  // Split on double line breaks or single line breaks with indentation
  const lines = clean.split(/\r?\n+/);

  return lines
    .map(line => line.trim())
    .filter(line => line.length > 2);
}
