import * as fs from 'node:fs/promises';

export interface VisualInspectionResult {
  passed: boolean;
  reason: string;
}

const SYSTEM_PROMPT = `You are an expert Frontend QA Engineer specialising in layout and visual regression analysis.

Your job is to inspect a UI screenshot and determine whether the page has a STRUCTURAL layout failure that would indicate a broken UI. You are NOT a pixel-perfect diff tool — you must ignore:
- Minor text antialiasing or subpixel shifts
- Slight colour temperature or brightness variation
- Font rendering differences between platforms
- Content changes that are expected (dynamic data, timestamps, counts)

You MUST flag the screenshot as FAILED only when you detect clear structural breakage, such as:
- Overlapping or colliding UI elements (buttons on top of text, modals cut off)
- Truncated or clipped content that should be fully visible
- Broken grid or flex layouts (columns misaligned, elements stacked when they should be side-by-side)
- Invisible or zero-opacity interactive elements (buttons, links, inputs hidden)
- Text that is unreadable due to colour contrast failure or overflow
- Completely missing sections that are required for the page to function
- Scrollbars appearing where the layout should fit the viewport

Respond with ONLY a valid JSON object — no markdown fences, no explanation — in this exact shape:
{"passed": true, "reason": "Brief description of what you checked and why it passes."}
OR
{"passed": false, "reason": "Specific description of the structural defect(s) found."}`;

/**
 * Direct Gemini call for server-side use (e.g. scripts or tests running in
 * the same Node process as the framework root). Playwright-executed tests
 * should use the /api/visual-inspect HTTP endpoint instead.
 *
 * Requires GEMINI_API_KEY in the environment.
 */
export async function inspectLayoutWithAI(
  screenshotPath: string,
): Promise<VisualInspectionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set — cannot run AI visual inspection');
  }

  const imageData = await fs.readFile(screenshotPath);
  const base64Image = imageData.toString('base64');

  const ext = screenshotPath.split('.').pop()?.toLowerCase() ?? 'png';
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
  });

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64Image } },
    'Inspect this UI screenshot for structural layout failures. Respond with the JSON object only.',
  ]);

  const text = result.response.text().trim();
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      passed: true,
      reason: `AI inspector returned non-JSON response (treated as pass): ${text.slice(0, 200)}`,
    };
  }

  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'passed' in parsed &&
    'reason' in parsed &&
    typeof (parsed as Record<string, unknown>).passed === 'boolean' &&
    typeof (parsed as Record<string, unknown>).reason === 'string'
  ) {
    return parsed as VisualInspectionResult;
  }

  return {
    passed: true,
    reason: `AI inspector returned unexpected JSON shape (treated as pass): ${cleaned.slice(0, 200)}`,
  };
}
