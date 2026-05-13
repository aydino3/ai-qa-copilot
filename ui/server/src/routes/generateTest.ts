import { Router, type Request, type Response } from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { FRAMEWORK_ROOT } from '../config.js';

export const generateTestRouter: Router = Router();

const AI_GENERATED_DIR = path.join(FRAMEWORK_ROOT, 'tests', 'ai-generated');
const AI_ENABLED = process.env.AI_ENABLED === 'true';
const API_KEY = process.env.ANTHROPIC_API_KEY;

const BASE_SYSTEM_PROMPT = `You are an expert Playwright test engineer. Given a target URL/feature and natural language test steps, generate a single, complete, production-ready Playwright TypeScript test file.

Rules:
- Import { test, expect } from '@playwright/test'
- Use one test() block with a descriptive title and { tag: '@ai-generated' }
- Use test.step() for each logical step
- Use Playwright-native locators: getByRole, getByLabel, getByPlaceholder, getByText
- Never use page.waitForTimeout()
- Always await expect(page).toHaveURL(...) after navigation
- Output ONLY the TypeScript file contents — no markdown fences, no explanation`;

const VISUAL_REGRESSION_PROMPT_ADDENDUM = `

Visual regression requirement (REQUIRED for this test):
- Add the tag '@visual' alongside '@ai-generated'.
- After the page reaches a stable state in each meaningful step, call \`await expect(page).toHaveScreenshot()\` with a descriptive name argument, e.g. \`await expect(page).toHaveScreenshot('login-loaded.png')\`.
- Include at least one full-page screenshot assertion at the end of the test.
- Prefer screenshotting after explicit waits on visible elements rather than arbitrary timeouts.`;

interface GenerateBody {
  targetUrl?: string;
  steps?: string;
  visualRegression?: boolean;
}

generateTestRouter.post('/', async (req: Request, res: Response) => {
  const { targetUrl, steps, visualRegression } = (req.body ?? {}) as GenerateBody;
  if (!targetUrl || !steps) {
    res.status(400).json({ error: 'missing_fields', message: '`targetUrl` and `steps` are required' });
    return;
  }

  const wantVisual = !!visualRegression;
  let code: string;
  try {
    code = AI_ENABLED && API_KEY
      ? await generateWithAI(targetUrl, steps, wantVisual)
      : generateMock(targetUrl, steps, wantVisual);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'generation_failed', message });
    return;
  }

  const slug = targetUrl
    .replace(/https?:\/\/[^/]+/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'feature';
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

  res.status(201).json({
    filename,
    filePath,
    code,
    aiEnabled: AI_ENABLED && !!API_KEY,
    visualRegression: wantVisual,
  });
});

async function generateWithAI(
  targetUrl: string,
  steps: string,
  visualRegression: boolean
): Promise<string> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: API_KEY });

  const systemPrompt = visualRegression
    ? BASE_SYSTEM_PROMPT + VISUAL_REGRESSION_PROMPT_ADDENDUM
    : BASE_SYSTEM_PROMPT;

  const userPrompt = `Target URL / Feature: ${targetUrl}

Natural language steps:
${steps}

${visualRegression ? 'Visual regression: ENABLED — include toHaveScreenshot() assertions.\n\n' : ''}Generate the complete Playwright TypeScript test file.`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = message.content.find((b) => b.type === 'text');
  if (!block || block.type !== 'text') throw new Error('No text block in AI response');

  // Strip any accidental markdown fences the model might include.
  return block.text.replace(/^```(?:typescript|ts)?\n?/m, '').replace(/\n?```$/m, '').trim() + '\n';
}

function generateMock(targetUrl: string, steps: string, visualRegression: boolean): string {
  const id = crypto.randomBytes(3).toString('hex');
  const tag = visualRegression ? '@ai-generated @visual' : '@ai-generated';
  const stepLines = steps
    .split('\n')
    .filter(Boolean)
    .map((s, i) => {
      const screenshot = visualRegression
        ? `\n    await expect(page).toHaveScreenshot('step-${i + 1}.png');`
        : '';
      return `  await test.step(${JSON.stringify(s.trim())}, async () => {\n    // TODO: implement step ${i + 1}${screenshot}\n  });`;
    })
    .join('\n\n');

  const finalScreenshot = visualRegression
    ? `\n\n    await test.step('Visual regression — full page snapshot', async () => {\n      await expect(page).toHaveScreenshot('final.png', { fullPage: true });\n    });`
    : '';

  return `// AI-generated test (mock — set AI_ENABLED=true and ANTHROPIC_API_KEY to use Claude)
// Generated: ${new Date().toISOString()}
// ID: ${id}
import { test, expect } from '@playwright/test';

test(
  'AI-generated: ${targetUrl.slice(0, 80)}',
  { tag: '${tag}' },
  async ({ page }) => {
    await test.step('Navigate to target', async () => {
      await page.goto(${JSON.stringify(targetUrl)});
      await expect(page).toHaveURL(${JSON.stringify(targetUrl)});
    });

${stepLines}${finalScreenshot}
  }
);
`;
}
