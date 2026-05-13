import { Router, type Request, type Response } from 'express';
import * as fs from 'node:fs/promises';

export const visualInspectRouter: Router = Router();

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

interface InspectBody {
  imagePath?: string;
  imageBase64?: string;
  mimeType?: string;
}

visualInspectRouter.post('/', async (req: Request, res: Response) => {
  res.setTimeout(60_000);

  const { imagePath, imageBase64, mimeType: reqMimeType } = (req.body ?? {}) as InspectBody;

  if (!imagePath && !imageBase64) {
    res.status(400).json({ error: 'missing_fields', message: 'Provide imagePath or imageBase64' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'no_api_key', message: 'GEMINI_API_KEY is not set — save it in Settings' });
    return;
  }

  let base64Image: string;
  let mimeType: string;

  if (imagePath) {
    let imageData: Buffer;
    try {
      imageData = await fs.readFile(imagePath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: 'file_read_failed', message });
      return;
    }
    base64Image = imageData.toString('base64');
    const ext = imagePath.split('.').pop()?.toLowerCase() ?? 'png';
    mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
  } else {
    base64Image = imageBase64 as string;
    mimeType = reqMimeType ?? 'image/png';
    // Reject obviously malformed payloads before hitting Gemini.
    if (typeof base64Image !== 'string' || base64Image.length === 0) {
      res.status(400).json({ error: 'invalid_payload', message: 'imageBase64 must be a non-empty string' });
      return;
    }
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64Image)) {
      res.status(400).json({ error: 'invalid_payload', message: 'imageBase64 is not valid base64' });
      return;
    }
  }

  let result: { passed: boolean; reason: string };
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { maxOutputTokens: 512, temperature: 0.1 },
    });

    const geminiResult = await model.generateContent([
      { inlineData: { mimeType, data: base64Image } },
      'Inspect this UI screenshot for structural layout failures. Respond with the JSON object only.',
    ]);

    const text = geminiResult.response.text().trim();
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      res.json({ passed: true, reason: `AI inspector returned non-JSON response: ${text.slice(0, 200)}` });
      return;
    }

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'passed' in parsed &&
      'reason' in parsed &&
      typeof (parsed as Record<string, unknown>).passed === 'boolean' &&
      typeof (parsed as Record<string, unknown>).reason === 'string'
    ) {
      result = parsed as { passed: boolean; reason: string };
    } else {
      result = { passed: true, reason: `AI inspector returned unexpected JSON shape: ${cleaned.slice(0, 200)}` };
    }
  } catch (err) {
    console.error('GEMINI_ERROR:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'gemini_error', message });
    return;
  }

  res.json(result);
});
