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
- EVERY discrete action MUST be wrapped in its own await test.step('Human-readable sentence', async () => { ... }) block. No test logic may live outside a test.step. Derive step titles directly from the user's natural language input.
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
- Import { inspectLayoutWithAI } from '@ai/visual-inspector' at the top of the file.
- Import * as path from 'node:path' and import * as fs from 'node:fs/promises' at the top.
- After the page reaches a stable state in each meaningful step, capture a screenshot with \`await page.screenshot({ path: screenshotPath })\` then call \`await inspectLayoutWithAI(screenshotPath)\`.
- If the result's \`passed\` property is false, throw an Error with the \`reason\` text so the test step fails with Gemini's visual feedback.
- Store screenshots in the test-results/ai-visual/ directory, named descriptively (e.g. 'test-results/ai-visual/step-1.png').
- Include at least one full-page AI visual check at the end of the test (use { fullPage: true } in page.screenshot options).
- Prefer screenshotting after explicit waits on visible elements.`;

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
  // Leading fence: ```typescript / ```ts / ```
  out = out.replace(/^```(?:typescript|ts|javascript|js)?\s*\n/i, '');
  // Trailing fence
  out = out.replace(/\n?```\s*$/i, '');
  return out.trim() + '\n';
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

${visualRegression ? 'Visual regression: ENABLED — use inspectLayoutWithAI() (NOT toHaveScreenshot()) as described in the system prompt.\n\n' : ''}Generate the complete Playwright TypeScript test file now. Output raw TypeScript only — no markdown fences.`;

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

  const stepBlocks = parsedSteps.map((step, i) => {
    const screenshot = visualRegression
      ? `\n    const _shot${i + 1} = 'test-results/ai-visual/step-${i + 1}.png';\n    await page.screenshot({ path: _shot${i + 1} });\n    const _result${i + 1} = await inspectLayoutWithAI(_shot${i + 1});\n    if (!_result${i + 1}.passed) throw new Error(_result${i + 1}.reason);`
      : '';
    return `  await test.step(${JSON.stringify(step)}, async () => {\n    // TODO: implement\n    await page.waitForLoadState('domcontentloaded');${screenshot}\n  });`;
  }).join('\n\n');

  const finalScreenshot = visualRegression
    ? `\n\n  await test.step('Full-page visual snapshot (AI)', async () => {\n    const _finalShot = 'test-results/ai-visual/final-full.png';\n    await page.screenshot({ path: _finalShot, fullPage: true });\n    const _finalResult = await inspectLayoutWithAI(_finalShot);\n    if (!_finalResult.passed) throw new Error(_finalResult.reason);\n  });`
    : '';

  const gotoStep = isUrl
    ? `  await test.step('Navigate to ${humanTitle}', async () => {\n    await page.goto(${JSON.stringify(targetUrl)});\n    await expect(page).toHaveURL(${JSON.stringify(targetUrl)});\n  });`
    : `  await test.step('Open ${humanTitle}', async () => {\n    await page.goto(process.env.BASE_URL ?? '/');\n  });`;

  const visualImports = visualRegression
    ? `import * as fs from 'node:fs/promises';\nimport { inspectLayoutWithAI } from '@ai/visual-inspector';`
    : '';

  const beforeAll = visualRegression
    ? `\ntest.beforeAll(async () => {\n  await fs.mkdir('test-results/ai-visual', { recursive: true });\n});\n`
    : '';

  return `// Generated: ${new Date().toISOString()}
// To use Gemini instead of this template, set AI_ENABLED=true and GEMINI_API_KEY in your .env
import { test, expect } from '@playwright/test';
${visualImports}
${beforeAll}
test(
  ${JSON.stringify(humanTitle)},
  { tag: ${tagsLiteral} },
  async ({ page }) => {
${gotoStep}

${stepBlocks}${finalScreenshot}
  }
);
`;
}
