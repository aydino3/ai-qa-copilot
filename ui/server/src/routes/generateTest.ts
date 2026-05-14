import { Router, type Request, type Response } from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FRAMEWORK_ROOT } from '../config.js';

export const generateTestRouter: Router = Router();

const AI_GENERATED_DIR = path.join(FRAMEWORK_ROOT, 'tests', 'ai-generated');
const AI_ENABLED = process.env.AI_ENABLED === 'true';

const BASE_SYSTEM_PROMPT = `You are an expert Playwright test engineer. Given a target URL/feature, natural language test steps, and optional tags, generate a single, complete, production-ready Playwright TypeScript test file.

Rules (ALL are mandatory — violation will break the Manager View):
- Import { test, expect } from '@playwright/test'
- Use one test() block. Title must reflect the feature (e.g. "Login flow" not "AI-generated test"). Tags array must include '@ai-generated' plus any user-supplied tags.
- EVERY discrete action MUST be wrapped in its own await test.step(\`Human-readable sentence\`, async () => { ... }) block. No test logic may live outside a test.step. Derive step titles directly from the user's natural language input.
- MANDATORY STRING QUOTING: ALL test titles AND ALL test.step descriptions MUST be wrapped in backticks (\` … \`), NEVER single quotes and NEVER double quotes. User-supplied text may contain apostrophes (e.g. Aydın'ın), quote marks (e.g. "About Me"), or both — backticks are the only delimiter that survives this safely. If any backtick character appears inside the text itself, escape it as \\\`. Example: await test.step(\`Open Aydın'ın "About Me" page\`, async () => { ... }).
- Use Playwright-native locators exclusively: getByRole, getByLabel, getByPlaceholder, getByText, getByTestId
- Never use page.waitForTimeout() — use expect(locator).toBeVisible() or waitFor() instead
- Always await expect(page).toHaveURL(...) after navigation — inside its own test.step

CRITICAL OUTPUT FORMAT:
- Output ONLY the raw TypeScript file contents.
- DO NOT wrap the code in markdown fences (no \`\`\`typescript, no \`\`\`ts, no \`\`\`).
- DO NOT include any preamble, explanation, or trailing commentary.
- The first character of your response MUST be the first character of the TypeScript code (typically "import").`;

const VISUAL_REGRESSION_ADDENDUM = `

Visual regression requirement (REQUIRED for this test):
- Add the tag '@visual' to the tags array.
- After the page reaches a stable state in each meaningful step, add \`await expect(page).toHaveScreenshot();\` as the last line of that step.
- Add a final test.step that captures a full-page snapshot: \`await expect(page).toHaveScreenshot({ fullPage: true });\`
- No extra imports are needed — toHaveScreenshot is part of '@playwright/test'.`;

interface GenerateBody {
  targetUrl?: string;
  steps?: string;
  tags?: string;
  visualRegression?: boolean;
}

function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('@') ? t : `@${t}`));
}

function toSlug(input: string): string {
  return input
    .replace(/https?:\/\/[^/]+/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'feature';
}

/** Strip any markdown code fences a model might emit despite instructions. */
function stripMarkdownFences(text: string): string {
  let out = text.trim();
  out = out.replace(/^```(?:typescript|ts|javascript|js)?\s*\n/i, '');
  out = out.replace(/\n?```\s*$/i, '');
  return out.trim() + '\n';
}

/** Escape a raw user string for embedding inside a backtick template literal. */
function toBacktick(raw: string): string {
  return '`' + raw.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`';
}

/**
 * Normalize all test() and test.step() title arguments to backtick template
 * literals. The AI sometimes ignores the backtick rule and emits 'single' or
 * "double" quoted strings, which break the moment user text contains a
 * matching quote (Aydın'ın, "About Me", etc.). This post-processor finds the
 * first-argument string of every test() / test.step() call and rewrites it.
 *
 * Recognized forms:
 *   test('title', ...)              → test(`title`, ...)
 *   test("title", { tag: ... }, ...)
 *   test.step('desc', async () => …)
 *   test.step("desc", async () => …)
 *
 * Strings already using backticks are left untouched.
 */
function normalizeQuotesToBackticks(code: string): string {
  // Match: (test|test.step)( optional-whitespace ('|") body same-quote
  // The body matches any char that isn't the closing quote or a newline,
  // with support for backslash-escaped chars.
  const pattern =
    /(\btest(?:\.step)?\s*\(\s*)(['"])((?:\\.|(?!\2)[^\\\n])*)\2/g;
  return code.replace(pattern, (_match, prefix: string, quote: string, body: string) => {
    // Unescape the quote-specific backslash sequences so we get the raw text.
    const unescaped = body
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\r/g, '\r')
      .replace(new RegExp('\\\\' + quote, 'g'), quote)
      .replace(/\\\\/g, '\\');
    return prefix + toBacktick(unescaped);
  });
}

generateTestRouter.post('/', async (req: Request, res: Response) => {
  const { targetUrl, steps, tags: rawTags, visualRegression } = (req.body ?? {}) as GenerateBody;
  if (!targetUrl || !steps) {
    res.status(400).json({ error: 'missing_fields', message: '`targetUrl` and `steps` are required' });
    return;
  }

  const wantVisual = !!visualRegression;
  const userTags = parseTags(rawTags ?? '');

  let code: string;
  try {
    code = AI_ENABLED && process.env.GEMINI_API_KEY
      ? await generateWithAI(targetUrl, steps, userTags, wantVisual)
      : generateMock(targetUrl, steps, userTags, wantVisual);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'generation_failed', message });
    return;
  }

  // Defense in depth: regardless of source (AI or mock), rewrite every
  // test()/test.step() title argument to a backtick template literal so
  // apostrophes / double quotes in user text can never break the syntax.
  code = normalizeQuotesToBackticks(code);

  const slug = toSlug(targetUrl);
  const filename = `${slug}.ai-generated.ts`;
  const filePath = path.join(AI_GENERATED_DIR, filename);

  try {
    await fs.mkdir(AI_GENERATED_DIR, { recursive: true });
    await fs.writeFile(filePath, code, 'utf8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'write_failed', message });
    return;
  }

  res.status(201).json({ filename, filePath, code, aiEnabled: AI_ENABLED && !!process.env.GEMINI_API_KEY, visualRegression: wantVisual });
});

async function generateWithAI(
  targetUrl: string,
  steps: string,
  userTags: string[],
  visualRegression: boolean,
): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

  const systemInstruction = visualRegression
    ? BASE_SYSTEM_PROMPT + VISUAL_REGRESSION_ADDENDUM
    : BASE_SYSTEM_PROMPT;

  const allTags = ['@ai-generated', ...userTags, ...(visualRegression ? ['@visual'] : [])];
  const userPrompt = `Target URL / Feature: ${targetUrl}
Tags: ${allTags.join(', ')}

Natural language steps:
${steps}

${visualRegression ? 'Visual regression: ENABLED — use toHaveScreenshot() as described in the system prompt.\n\n' : ''}Generate the complete Playwright TypeScript test file now. Output raw TypeScript only — no markdown fences.`;

  const model = client.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction,
    generationConfig: { maxOutputTokens: 4096, temperature: 0.2 },
  });

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  if (!text) throw new Error('Empty response from Gemini');
  return stripMarkdownFences(text);
}

/**
 * Infers a plausible Playwright action stub from a natural-language step.
 * Handles the most common patterns: fill, click, navigate, verify/assert.
 * Falls back to a waitForLoadState stub when the intent is unclear.
 */
function inferStepBody(step: string): string {
  const s = step.toLowerCase();

  // Navigate / go to
  if (/\b(go to|navigate to|open|visit)\b/.test(s)) {
    const urlMatch = step.match(/https?:\/\/\S+/);
    const pathMatch = step.match(/['"]([^'"]+)['"]/);
    const target = urlMatch?.[0] ?? pathMatch?.[1] ?? 'process.env.BASE_URL ?? \'/\'';
    const quoted = urlMatch ? JSON.stringify(urlMatch[0]) : (pathMatch ? JSON.stringify(pathMatch[1]) : "process.env.BASE_URL ?? '/'");
    void target;
    return `    await page.goto(${quoted});\n    await expect(page).toHaveURL(${quoted});`;
  }

  // Fill / type / enter
  if (/\b(fill|type|enter|input)\b/.test(s)) {
    const labelMatch = step.match(/\b(?:the\s+)?["']?([A-Z][a-zA-Z ]{1,30})["']?\s+(?:field|input|box)/i);
    const valueMatch = step.match(/(?:with|value)\s+["']?([^"'\n]+)["']?/i);
    const label = labelMatch?.[1] ?? 'Field label';
    const value = valueMatch?.[1]?.trim() ?? 'value';
    return `    await page.getByLabel(${JSON.stringify(label)}).fill(${JSON.stringify(value)});`;
  }

  // Click / press / tap / select
  if (/\b(click|press|tap|select|choose)\b/.test(s)) {
    const nameMatch = step.match(/(?:the\s+)?["']([^"']+)["']\s+(?:button|link|tab|option)/i)
      ?? step.match(/\b(?:the\s+)?([A-Z][a-zA-Z ]{1,30})\s+(?:button|link|tab|option)/i);
    const name = nameMatch?.[1] ?? 'Button or link';
    return `    await page.getByRole('button', { name: ${JSON.stringify(name)} }).click();`;
  }

  // Verify / assert / check / expect / should / see
  if (/\b(verify|assert|check|expect|should|see|visible|shown)\b/.test(s)) {
    const textMatch = step.match(/["']([^"']+)['"]/);
    const urlMatch = step.match(/url\s+(?:contains?|is)\s+["']?(\S+)["']?/i);
    if (urlMatch?.[1]) {
      return `    await expect(page).toHaveURL(/${urlMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/);`;
    }
    const text = textMatch?.[1] ?? 'Expected text';
    return `    await expect(page.getByText(${JSON.stringify(text)})).toBeVisible();`;
  }

  // Default stub
  return `    await page.waitForLoadState('domcontentloaded');`;
}

function generateMock(
  targetUrl: string,
  steps: string,
  userTags: string[],
  visualRegression: boolean,
): string {
  const isUrl = /^https?:\/\//i.test(targetUrl);
  const humanTitle = isUrl
    ? targetUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')
    : targetUrl;

  const allTags = ['@ai-generated', ...userTags, ...(visualRegression ? ['@visual'] : [])];
  const tagsLiteral = allTags.length === 1
    ? JSON.stringify(allTags[0])
    : `[${allTags.map((t) => JSON.stringify(t)).join(', ')}]`;

  const parsedSteps = steps.split('\n').map((s) => s.trim()).filter(Boolean);

  const stepBlocks = parsedSteps.map((step) => {
    const snapshot = visualRegression ? `\n    await expect(page).toHaveScreenshot();` : '';
    const body = inferStepBody(step);
    return `  await test.step(${toBacktick(step)}, async () => {\n${body}${snapshot}\n  });`;
  }).join('\n\n');

  const finalSnapshot = visualRegression
    ? `\n\n  await test.step(${toBacktick('Full-page visual snapshot')}, async () => {\n    await expect(page).toHaveScreenshot({ fullPage: true });\n  });`
    : '';

  const gotoStep = isUrl
    ? `  await test.step(${toBacktick(`Navigate to ${humanTitle}`)}, async () => {\n    await page.goto(${JSON.stringify(targetUrl)});\n    await expect(page).toHaveURL(${JSON.stringify(targetUrl)});\n  });`
    : `  await test.step(${toBacktick(`Open ${humanTitle}`)}, async () => {\n    await page.goto(process.env.BASE_URL ?? '/');\n  });`;

  return `// Generated: ${new Date().toISOString()}
// To use Gemini instead of this template, set AI_ENABLED=true and GEMINI_API_KEY in your .env
import { test, expect } from '@playwright/test';

test(
  ${toBacktick(humanTitle)},
  { tag: ${tagsLiteral} },
  async ({ page }) => {
${gotoStep}

${stepBlocks}${finalSnapshot}
  }
);
`;
}
