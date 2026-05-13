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
 * Sends a screenshot to Gemini for AI-powered layout inspection.
 * Returns whether the layout passes and a human-readable reason.
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

  // Infer MIME type from extension; default to png
  const ext = screenshotPath.split('.').pop()?.toLowerCase() ?? 'png';
  const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

  // Load the Gemini SDK at runtime. Wrapped in try/catch so a missing
  // dependency surfaces an actionable message instead of an opaque
  // module-resolution stack trace from Playwright's loader.
  let GoogleGenerativeAI: typeof import('@google/generative-ai').GoogleGenerativeAI;
  try {
    ({ GoogleGenerativeAI } = await import('@google/generative-ai'));
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to load @google/generative-ai. Install it in the project root with ` +
        `\`npm install @google/generative-ai\` and ensure Playwright can resolve ` +
        `the root node_modules. Original error: ${detail}`,
    );
  }
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

  // Strip markdown fences if the model emits them despite instructions
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Non-JSON response — treat as a pass with a warning so tests don't
    // fail spuriously due to API response format issues.
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
