/**
 * Experiment runner - orchestrates running evals against agent.
 */

import type {
  ResolvedExperimentConfig,
  EvalFixture,
  EvalRunData,
  EvalSummary,
  ExperimentResults,
} from './types.js';
import { getAgent } from './agents/index.js';
import {
  agentResultToEvalRunData,
  createEvalSummary,
  createExperimentResults,
  saveResults,
  formatResultsTable,
  formatRunResult,
  createProgressDisplay,
} from './results.js';

/**
 * Options for running an experiment.
 */
export interface RunExperimentOptions {
  /** Resolved experiment configuration */
  config: ResolvedExperimentConfig;
  /** Fixtures to run */
  fixtures: EvalFixture[];
  /** API key for the agent */
  apiKey: string;
  /** Directory to save results */
  resultsDir: string;
  /** Experiment name */
  experimentName: string;
  /** Callback for progress updates */
  onProgress?: (message: string) => void;
  /** Whether to run in verbose mode */
  verbose?: boolean;
}

/**
 * Run an experiment - execute all evals with configured runs.
 */
export async function runExperiment(
  options: RunExperimentOptions
): Promise<ExperimentResults> {
  const { config, fixtures, apiKey, resultsDir, experimentName, onProgress, verbose } = options;
  const startedAt = new Date();
  const evalSummaries: EvalSummary[] = [];

  // Get the agent from registry
  const agent = getAgent(config.agent);

  const log = (msg: string) => {
    if (onProgress) {
      onProgress(msg);
    } else if (verbose) {
      console.log(msg);
    }
  };

  for (const fixture of fixtures) {
    const runDataList: EvalRunData[] = [];

    for (let i = 0; i < config.runs; i++) {
      log(createProgressDisplay(fixture.name, i + 1, config.runs));

      const agentResult = await agent.run(fixture.path, {
        prompt: fixture.prompt,
        model: config.model,
        timeout: config.timeout * 1000, // Convert to milliseconds
        apiKey,
        setup: config.setup,
        scripts: config.scripts,
      });

      const runData = agentResultToEvalRunData(agentResult);
      runDataList.push(runData);

      log(formatRunResult(fixture.name, i + 1, config.runs, runData.result));

      // Early exit if configured and we got a pass
      if (config.earlyExit && runData.result.status === 'passed') {
        log(`Early exit: ${fixture.name} passed on run ${i + 1}`);
        break;
      }
    }

    const summary = createEvalSummary(fixture.name, runDataList);
    evalSummaries.push(summary);
  }

  const completedAt = new Date();
  const results = createExperimentResults(config, evalSummaries, startedAt, completedAt);

  // Save results to disk
  const outputDir = saveResults(results, {
    resultsDir,
    experimentName,
  });

  log(`\nResults saved to: ${outputDir}`);
  log(formatResultsTable(results));

  return results;
}

/**
 * Run a single eval (for testing/debugging).
 */
export async function runSingleEval(
  fixture: EvalFixture,
  options: {
    agent?: ResolvedExperimentConfig['agent'];
    model: ResolvedExperimentConfig['model'];
    timeout: number;
    apiKey: string;
    setup?: ResolvedExperimentConfig['setup'];
    scripts?: string[];
    verbose?: boolean;
  }
): Promise<EvalRunData> {
  const agent = getAgent(options.agent ?? 'vercel-ai-gateway/claude-code');

  const agentResult = await agent.run(fixture.path, {
    prompt: fixture.prompt,
    model: options.model,
    timeout: options.timeout * 1000,
    apiKey: options.apiKey,
    setup: options.setup,
    scripts: options.scripts,
  });

  return agentResultToEvalRunData(agentResult);
}
