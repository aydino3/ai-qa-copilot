import { promises as fs } from 'fs';
import path from 'path';
import { FRAMEWORK_ROOT } from '../ui/server/src/config.js'; // Assuming transpiled .js or TS-aware runtime

/**
 * Reads the content of a file, resolving the path relative to FRAMEWORK_ROOT.
 * This function provides the 'real file-read context' for engineer agents,
 * allowing them to access actual file contents from the codebase.
 * @param {string} relativePath The path to the file, relative to FRAMEWORK_ROOT.
 * @returns {Promise<string | null>} The file content as a string, or null if the file is not found.
 * @throws {Error} If an error other than file not found occurs during reading.
 */
export async function readFileContext(relativePath) {
  const absolutePath = path.join(FRAMEWORK_ROOT, relativePath);
  try {
    const content = await fs.readFile(absolutePath, { encoding: 'utf8' });
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn(`[Agent File Read] File not found: ${absolutePath}`);
      return null;
    }
    console.error(`[Agent File Read] Error reading file ${absolutePath}:`, error);
    throw error;
  }
}

// This file can be extended with other agent-related utilities or the main agent orchestration logic.
// For now, it primarily provides the file reading capability as per the work item.
