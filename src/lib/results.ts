/**
 * Results storage and reporting for eval experiments.
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';
import type {
  EvalRunResult,
  EvalRunData,
  EvalSummary,
  ExperimentResults,
  ResolvedExperimentConfig,
} from './types.js';
import type { AgentRunResult } from './agent.js';

/**
 * Convert AgentRunResult to EvalRunData (result + transcript).
 */
export function agentResultToEvalRunData(agentResult: AgentRunResult): EvalRunData {
  return {
    result: {
      status: agentResult.success ? 'passed' : 'failed',
      failedStep: agentResult.error
        ? determineFailedStep(agentResult)
        : undefined,
      error: agentResult.error,
      duration: agentResult.duration / 1000, // Convert to seconds
    },
    transcript: agentResult.transcript,
    outputs: agentResult.generatedFiles,
  };
}

/**
 * Determine which step failed based on the result.
 */
function determineFailedStep(
  result: AgentRunResult
): 'setup' | 'agent' | 'scripts' | 'tests' {
  if (result.error?.includes('install failed') || result.error?.includes('setup')) {
    return 'setup';
  }
  if (result.error?.includes('Claude Code')) {
    return 'agent';
  }
  if (result.buildSuccess === false || result.lintSuccess === false) {
    return 'scripts';
  }
  if (result.testSuccess === false) {
    return 'tests';
  }
  return 'agent';
}

/**
 * Create a summary from multiple run data.
 */
export function createEvalSummary(name: string, runData: EvalRunData[]): EvalSummary {
  const runs = runData.map((r) => r.result);
  const passedRuns = runs.filter((r) => r.status === 'passed').length;
  const totalDuration = runs.reduce((sum, r) => sum + r.duration, 0);

  return {
    name,
    totalRuns: runs.length,
    passedRuns,
    passRate: runs.length > 0 ? (passedRuns / runs.length) * 100 : 0,
    meanDuration: runs.length > 0 ? totalDuration / runs.length : 0,
    runs: runData,
  };
}

/**
 * Create experiment results from eval summaries.
 */
export function createExperimentResults(
  config: ResolvedExperimentConfig,
  evals: EvalSummary[],
  startedAt: Date,
  completedAt: Date
): ExperimentResults {
  return {
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    config,
    evals,
  };
}

/**
 * Options for saving results.
 */
export interface SaveResultsOptions {
  /** Base directory for results */
  resultsDir: string;
  /** Experiment name (used for subdirectory) */
  experimentName: string;
}

/**
 * Save experiment results to disk.
 *
 * Creates a directory structure per design:
 * results/
 *   experiment-name/
 *     2024-01-26T12-00-00Z/
 *       eval-1/
 *         run-1/
 *           result.json
 *           transcript.jsonl
 *           outputs/
 *         summary.json
 *       experiment.json
 */
export function saveResults(
  results: ExperimentResults,
  options: SaveResultsOptions
): string {
  const timestamp = results.startedAt.replace(/:/g, '-');
  const experimentDir = join(options.resultsDir, options.experimentName, timestamp);

  // Create experiment directory
  mkdirSync(experimentDir, { recursive: true });

  // Save experiment-level results
  writeFileSync(
    join(experimentDir, 'experiment.json'),
    JSON.stringify(results, null, 2)
  );

  // Save per-eval results
  for (const evalSummary of results.evals) {
    const evalDir = join(experimentDir, evalSummary.name);
    mkdirSync(evalDir, { recursive: true });

    // Save summary (simplified format per design)
    const summaryForFile = {
      totalRuns: evalSummary.totalRuns,
      passedRuns: evalSummary.passedRuns,
      passRate: `${evalSummary.passRate.toFixed(0)}%`,
      meanDuration: evalSummary.meanDuration,
    };
    writeFileSync(
      join(evalDir, 'summary.json'),
      JSON.stringify(summaryForFile, null, 2)
    );

    // Save individual run results
    for (let i = 0; i < evalSummary.runs.length; i++) {
      const runData = evalSummary.runs[i];
      const runDir = join(evalDir, `run-${i + 1}`);
      mkdirSync(runDir, { recursive: true });

      // Save result.json (just the result fields)
      writeFileSync(
        join(runDir, 'result.json'),
        JSON.stringify(runData.result, null, 2)
      );

      // Save transcript.jsonl if available
      if (runData.transcript) {
        writeFileSync(join(runDir, 'transcript.jsonl'), runData.transcript);
      }

      // Save generated files to outputs/
      const outputsDir = join(runDir, 'outputs');
      mkdirSync(outputsDir, { recursive: true });
      if (runData.outputs) {
        for (const [filePath, content] of Object.entries(runData.outputs)) {
          // Normalize path (remove leading ./ if present)
          const normalizedPath = filePath.replace(/^\.\//, '');
          const fullPath = join(outputsDir, normalizedPath);
          // Create parent directories
          mkdirSync(dirname(fullPath), { recursive: true });
          writeFileSync(fullPath, content);
        }
      }
    }
  }

  return experimentDir;
}

/**
 * Format results for terminal display.
 */
export function formatResultsTable(results: ExperimentResults): string {
  const lines: string[] = [];
  const separator = '─'.repeat(60);

  lines.push('');
  lines.push(chalk.bold('Experiment Results'));
  lines.push(chalk.gray(separator));
  lines.push('');

  // Calculate overall stats
  const totalRuns = results.evals.reduce((sum, e) => sum + e.totalRuns, 0);
  const totalPassed = results.evals.reduce((sum, e) => sum + e.passedRuns, 0);
  const overallPassRate = totalRuns > 0 ? (totalPassed / totalRuns) * 100 : 0;

  for (const evalSummary of results.evals) {
    const passIcon = evalSummary.passedRuns === evalSummary.totalRuns ? '✓' : '✗';
    const passColor = evalSummary.passedRuns === evalSummary.totalRuns ? chalk.green : chalk.red;

    lines.push(
      passColor(
        `${passIcon} ${evalSummary.name}: ${evalSummary.passedRuns}/${evalSummary.totalRuns} passed (${evalSummary.passRate.toFixed(0)}%)`
      )
    );
    lines.push(chalk.gray(`  Mean duration: ${evalSummary.meanDuration.toFixed(1)}s`));
    lines.push('');
  }

  lines.push(chalk.gray(separator));
  lines.push('');

  const overallColor = overallPassRate === 100 ? chalk.green : overallPassRate >= 50 ? chalk.yellow : chalk.red;
  lines.push(overallColor(`Overall: ${totalPassed}/${totalRuns} passed (${overallPassRate.toFixed(0)}%)`));

  const duration = (new Date(results.completedAt).getTime() - new Date(results.startedAt).getTime()) / 1000;
  lines.push(chalk.gray(`Total time: ${duration.toFixed(1)}s`));
  lines.push('');

  return lines.join('\n');
}

/**
 * Format a single eval result for terminal display (used during progress).
 */
export function formatRunResult(
  evalName: string,
  runNumber: number,
  totalRuns: number,
  result: EvalRunResult
): string {
  const icon = result.status === 'passed' ? '✓' : '✗';
  const color = result.status === 'passed' ? chalk.green : chalk.red;

  let line = color(`${icon} ${evalName} [${runNumber}/${totalRuns}]`);
  line += chalk.gray(` (${result.duration.toFixed(1)}s)`);

  if (result.error) {
    line += chalk.red(` - ${result.error.slice(0, 50)}${result.error.length > 50 ? '...' : ''}`);
  }

  return line;
}

/**
 * Create a progress indicator for running evals.
 */
export function createProgressDisplay(
  evalName: string,
  runNumber: number,
  totalRuns: number
): string {
  return chalk.blue(`Running ${evalName} [${runNumber}/${totalRuns}]...`);
}
