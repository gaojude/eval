/**
 * @judegao/eval
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
  EvalRunData,
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

// Re-export fixture utilities
export {
  FixtureValidationError,
  discoverFixtures,
  validateFixtureFiles,
  validatePackageJson,
  loadFixture,
  loadAllFixtures,
  getFixtureFiles,
  readFixtureFiles,
} from './lib/fixture.js';

// Re-export sandbox utilities
export type { SandboxOptions, CommandResult, SandboxFile } from './lib/sandbox.js';
export {
  SandboxManager,
  DEFAULT_SANDBOX_TIMEOUT,
  IGNORED_PATTERNS,
  TEST_FILE_PATTERNS,
  collectLocalFiles,
  splitTestFiles,
  verifyNoTestFiles,
} from './lib/sandbox.js';

// Re-export agent utilities
export type { AgentRunOptions, AgentRunResult } from './lib/agent.js';
export { runAgent, getModelId } from './lib/agent.js';

// Re-export results utilities
export type { SaveResultsOptions } from './lib/results.js';
export {
  agentResultToEvalRunData,
  createEvalSummary,
  createExperimentResults,
  saveResults,
  formatResultsTable,
  formatRunResult,
  createProgressDisplay,
} from './lib/results.js';

// Re-export runner utilities
export type { RunExperimentOptions } from './lib/runner.js';
export { runExperiment, runSingleEval } from './lib/runner.js';

// Re-export init utilities
export type { InitOptions } from './lib/init.js';
export { initProject, getPostInitInstructions } from './lib/init.js';
