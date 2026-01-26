/**
 * @vercel/eval-framework
 *
 * Framework for testing AI coding agents in isolated sandboxes.
 */

// Re-export types
export type {
  AgentType,
  ModelTier,
  EvalFilter,
  Sandbox,
  SetupFunction,
  ExperimentConfig,
  ResolvedExperimentConfig,
  EvalFixture,
  EvalRunResult,
  EvalSummary,
  ExperimentResults,
} from './lib/types.js';

// Re-export constants
export { REQUIRED_EVAL_FILES, EXCLUDED_FILES } from './lib/types.js';

// Re-export config utilities
export {
  CONFIG_DEFAULTS,
  validateConfig,
  resolveConfig,
  loadConfig,
  resolveEvalNames,
} from './lib/config.js';
