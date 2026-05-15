import * as fs from 'node:fs/promises';

type AnalyzeFailureInput = {
  error: string;
  screenshotPaths: string[];
};

const SYSTEM_PROMPT = `You are an expert QA engineer analyzing a Playwright test failure.
Given an error message and optional screenshots, identify the root cause in 1-2 sentences.
Be specific: name the element, selector, or assertion that failed and why.
Do not repeat the raw error — interpret it. Output plain text only, no markdown.`;

export async function analyzeFailure(input: AnalyzeFailureInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return 'AI analysis skipped — GEMINI_API_KEY not set.';

  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: 256, temperature: 0.2 },
  });

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: `Test failure error:\n${input.error}` },
  ];

  for (const screenshotPath of input.screenshotPaths.slice(0, 3)) {
    try {
      const data = await fs.readFile(screenshotPath);
      parts.push({ inlineData: { mimeType: 'image/png', data: data.toString('base64') } });
    } catch {
      // Skip unreadable screenshots rather than failing the whole analysis
    }
  }

  parts.push({ text: 'What is the root cause of this test failure?' });

  const result = await model.generateContent(parts);
  const text = result.response.text().trim();
  return text || 'AI analysis returned an empty response.';
}
