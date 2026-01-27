/**
 * Agent registry with built-in agents.
 */

import { registerAgent, getAgent, listAgents, hasAgent } from './registry.js';
import { claudeCodeAgent } from './claude-code.js';
import { codexAgent } from './codex.js';

// Auto-register built-in agents
registerAgent(claudeCodeAgent);
registerAgent(codexAgent);

// Re-export registry functions
export { registerAgent, getAgent, listAgents, hasAgent };

// Re-export agent types
export type { Agent, AgentRunOptions, AgentRunResult } from './types.js';

// Re-export individual agents for direct access if needed
export { claudeCodeAgent } from './claude-code.js';
export { codexAgent } from './codex.js';
