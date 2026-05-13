import { Router, type Request, type Response } from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FRAMEWORK_ROOT } from '../config.js';

export const generateTestRouter: Router = Router();

const AI_GENERATED_DIR = path.join(FRAMEWORK_ROOT, 'tests', 'ai-generated');
const AI_ENABLED = process.env.AI_ENABLED === 'true';
const API_KEY = process.env.ANTHROPIC_API_KEY;

const BASE_SYSTEM_PROMPT = `You are an expert Playwright test engineer. Given a target URL/feature, natural language test steps, and optional tags, generate a single, complete, production-ready Playwright TypeScript test file.

Rules (ALL are mandatory — violation will break the Manager View):
- Import { test, expect } from '@playwright/test'
- Use one test() block. Title must reflect the feature (e.g. "Login flow" not "AI-generated test"). Tags array must include '@ai-generated' plus any user-supplied tags.
- EVERY discrete action MUST be wrapped in its own await test.step('Human-readable sentence', async () => { ... }) block. No test logic may live outside a test.step. Derive step titles directly from the user's natural language input.
- Use Playwright-native locators exclusively: getByRole, getByLabel, getByPlaceholder, getByText, getByTestId
- Never use page.waitForTimeout() — use expect(locator).toBeVisible() or waitFor() instead
- Always await expect(page).toHaveURL(...) after navigation — inside its own test.step
- Output ONLY the TypeScript file contents — no markdown fences, no preamble, no explanation`;

const VISUAL_REGRESSION_ADDENDUM = `

Visual regression requirement (REQUIRED for this test):
- Add the tag '@visual' to the tags array.
- After the page reaches a stable state in each meaningful step, call \`await expect(page).toHaveScreenshot('step-N.png')\` with a descriptive name.
- Include at least one full-page screenshot assertion at the end of the test.
- Prefer screenshotting after explicit waits on visible elements.`;

interface GenerateBody {
  targetUrl?: string;
  steps?: string;
  tags?: string;
  visualRegression?: boolean;
}

/** Parses a tags string like "@smoke, @regression" into ['@smoke', '@regression'] */
function parseTags(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('@') ? t : `@${t}`));
}

/** Derives a kebab-case filename slug from the feature/URL string */
function toSlug(input: string): string {
  return input
    .replace(/https?:\/\/[^/]+/i, '') // strip origin from URLs
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 48) || 'feature';
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
    code = AI_ENABLED && API_KEY
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

  res.status(201).json({ filename, filePath, code, aiEnabled: AI_ENABLED && !!API_KEY, visualRegression: wantVisual });
});

async function generateWithAI(
  targetUrl: string,
  steps: string,
  userTags: string[],
  visualRegression: boolean,
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: API_KEY });

  const systemPrompt = visualRegression
    ? BASE_SYSTEM_PROMPT + VISUAL_REGRESSION_ADDENDUM
    : BASE_SYSTEM_PROMPT;

  const allTags = ['@ai-generated', ...userTags, ...(visualRegression ? ['@visual'] : [])];
  const userPrompt = `Target URL / Feature: ${targetUrl}
Tags: ${allTags.join(', ')}

Natural language steps:
${steps}

${visualRegression ? 'Visual regression: ENABLED — include toHaveScreenshot() assertions.\n\n' : ''}Generate the complete Playwright TypeScript test file now.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text block in AI response');
  return block.text.replace(/^```(?:typescript|ts)?\n?/m, '').replace(/\n?```$/m, '').trim() + '\n';
}

function generateMock(
  targetUrl: string,
  steps: string,
  userTags: string[],
  visualRegression: boolean,
): string {
  // Derive a human title from the URL/feature string.
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
      ? `\n    await expect(page).toHaveScreenshot(${JSON.stringify(`step-${i + 1}.png`)});`
      : '';
    return `  await test.step(${JSON.stringify(step)}, async () => {\n    // TODO: implement\n    await page.waitForLoadState('domcontentloaded');${screenshot}\n  });`;
  }).join('\n\n');

  const finalScreenshot = visualRegression
    ? `\n\n  await test.step('Full-page visual snapshot', async () => {\n    await expect(page).toHaveScreenshot('final.png', { fullPage: true });\n  });`
    : '';

  const gotoStep = isUrl
    ? `  await test.step('Navigate to ${humanTitle}', async () => {\n    await page.goto(${JSON.stringify(targetUrl)});\n    await expect(page).toHaveURL(${JSON.stringify(targetUrl)});\n  });`
    : `  await test.step('Open ${humanTitle}', async () => {\n    await page.goto(process.env.BASE_URL ?? '/');\n  });`;

  return `// Generated: ${new Date().toISOString()}
// To use Claude instead of this template, set AI_ENABLED=true and ANTHROPIC_API_KEY in your .env
import { test, expect } from '@playwright/test';

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
