type AnalyzeFailureInput = {
  error: string;
  screenshotPaths: string[];
};

/**
 * Stub — returns a placeholder until the Anthropic integration is wired up.
 * The real implementation will send error message + screenshot to Claude
 * and return a natural-language root-cause summary.
 */
export async function analyzeFailure(_input: AnalyzeFailureInput): Promise<string> {
  return 'AI analysis not yet implemented. See src/ai/failure-analyzer.ts.';
}
