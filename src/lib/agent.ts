/**
 * Agent execution in sandbox.
 *
 * This module re-exports from the agents/ directory for backwards compatibility.
 * For new code, import directly from './agents/index.js'.
 */

import { claudeCodeAgent } from './agents/index.js';

// Re-export types for backwards compatibility
export type { AgentRunOptions, AgentRunResult } from './agents/types.js';

/**
 * Run the Claude Code agent on a fixture in an isolated sandbox.
 * @deprecated Use getAgent('claude-code').run() instead
 */
export async function runAgent(
  fixturePath: string,
  options: import('./agents/types.js').AgentRunOptions
): Promise<import('./agents/types.js').AgentRunResult> {
  return claudeCodeAgent.run(fixturePath, options);
}
