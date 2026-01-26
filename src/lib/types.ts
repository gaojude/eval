/**
 * Core types for the eval framework.
 */

/**
 * Supported AI agent types.
 */
export type AgentType = 'claude-code';

/**
 * Supported Claude model tiers.
 */
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

/**
 * Function type for filtering evals.
 */
export type EvalFilter = (name: string) => boolean;

/**
 * Sandbox interface for setup functions.
 * Provides methods to interact with the isolated VM.
 */
export interface Sandbox {
  /** Run a command in the sandbox */
  runCommand(command: string, args?: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  /** Read a file from the sandbox */
  readFile(path: string): Promise<string>;
  /** Write files to the sandbox */
  writeFiles(files: Record<string, string>): Promise<void>;
  /** Get the sandbox working directory */
  getWorkingDirectory(): string;
}

/**
 * Setup function that runs before the agent starts.
 * Receives a sandbox instance for pre-configuration.
 */
export type SetupFunction = (sandbox: Sandbox) => Promise<void>;

/**
 * Experiment configuration.
 * Defines what to test and how.
 */
export interface ExperimentConfig {
  /** Which AI agent to use (currently only 'claude-code' supported) */
  agent: AgentType;

  /** Which AI model the agent should use */
  model?: ModelTier;

  /** Which evals to run. Can be a string, array, or filter function */
  evals?: string | string[] | EvalFilter;

  /** How many times to run each eval */
  runs?: number;

  /** Stop early after first success? */
  earlyExit?: boolean;

  /** npm scripts that must pass after agent finishes */
  scripts?: string[];

  /** Maximum time in seconds for agent to complete */
  timeout?: number;

  /** Setup function that runs before agent starts */
  setup?: SetupFunction;
}

/**
 * Resolved experiment config with all defaults applied.
 */
export interface ResolvedExperimentConfig {
  agent: AgentType;
  model: ModelTier;
  evals: string | string[] | EvalFilter;
  runs: number;
  earlyExit: boolean;
  scripts: string[];
  timeout: number;
  setup?: SetupFunction;
}

/**
 * Required files for a valid eval fixture.
 */
export const REQUIRED_EVAL_FILES = ['PROMPT.md', 'EVAL.ts', 'package.json'] as const;

/**
 * Files excluded from being copied to sandbox (agent cannot see these).
 */
export const EXCLUDED_FILES = ['PROMPT.md', 'EVAL.ts', 'node_modules', '.git'] as const;

/**
 * Represents a discovered eval fixture.
 */
export interface EvalFixture {
  /** Name of the eval (folder name) */
  name: string;
  /** Absolute path to the eval folder */
  path: string;
  /** Contents of PROMPT.md */
  prompt: string;
  /** Whether package.json has "type": "module" */
  isModule: boolean;
}

/**
 * Result of a single eval run.
 */
export interface EvalRunResult {
  /** Pass or fail status */
  status: 'passed' | 'failed';
  /** Which step failed (if status is 'failed') */
  failedStep?: 'setup' | 'agent' | 'scripts' | 'tests';
  /** Error message if failed */
  error?: string;
  /** Duration in seconds */
  duration: number;
  /** Individual script results */
  scriptResults?: Array<{
    name: string;
    success: boolean;
    output?: string;
  }>;
  /** Test output */
  testOutput?: string;
}

/**
 * Summary of multiple runs for a single eval.
 */
export interface EvalSummary {
  /** Name of the eval */
  name: string;
  /** Total number of runs */
  totalRuns: number;
  /** Number of passed runs */
  passedRuns: number;
  /** Pass rate as a percentage */
  passRate: number;
  /** Mean duration across all runs */
  meanDuration: number;
  /** Individual run results */
  runs: EvalRunResult[];
}

/**
 * Complete experiment results.
 */
export interface ExperimentResults {
  /** Timestamp when experiment started */
  startedAt: string;
  /** Timestamp when experiment completed */
  completedAt: string;
  /** Experiment configuration used */
  config: ResolvedExperimentConfig;
  /** Results for each eval */
  evals: EvalSummary[];
}
