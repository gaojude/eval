import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  agentResultToEvalResult,
  createEvalSummary,
  createExperimentResults,
  saveResults,
  formatResultsTable,
  formatRunResult,
} from './results.js';
import type { AgentRunResult } from './agent.js';
import type { EvalRunResult, ResolvedExperimentConfig } from './types.js';

const TEST_DIR = '/tmp/eval-framework-results-test';

describe('results utilities', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('agentResultToEvalResult', () => {
    it('converts successful agent result', () => {
      const agentResult: AgentRunResult = {
        success: true,
        output: 'Agent output',
        duration: 45000, // 45 seconds in ms
        buildSuccess: true,
        lintSuccess: true,
        testSuccess: true,
        sandboxId: 'sandbox-123',
      };

      const evalResult = agentResultToEvalResult(agentResult);

      expect(evalResult.status).toBe('passed');
      expect(evalResult.duration).toBe(45); // Converted to seconds
      expect(evalResult.error).toBeUndefined();
      expect(evalResult.failedStep).toBeUndefined();
    });

    it('converts failed agent result', () => {
      const agentResult: AgentRunResult = {
        success: false,
        output: 'Agent output',
        duration: 30000,
        error: 'Claude Code exited with code 1',
        buildSuccess: true,
        testSuccess: false,
      };

      const evalResult = agentResultToEvalResult(agentResult);

      expect(evalResult.status).toBe('failed');
      expect(evalResult.error).toBe('Claude Code exited with code 1');
      expect(evalResult.failedStep).toBe('agent');
    });

    it('identifies setup failure', () => {
      const agentResult: AgentRunResult = {
        success: false,
        output: '',
        duration: 5000,
        error: 'npm install failed: ENOENT',
      };

      const evalResult = agentResultToEvalResult(agentResult);

      expect(evalResult.failedStep).toBe('setup');
    });

    it('identifies test failure', () => {
      const agentResult: AgentRunResult = {
        success: false,
        output: 'Agent output',
        duration: 60000,
        error: 'Tests failed',
        buildSuccess: true,
        lintSuccess: true,
        testSuccess: false,
      };

      const evalResult = agentResultToEvalResult(agentResult);

      expect(evalResult.failedStep).toBe('tests');
    });

    it('includes script results', () => {
      const agentResult: AgentRunResult = {
        success: true,
        output: 'output',
        duration: 10000,
        buildSuccess: true,
        buildOutput: 'Build succeeded',
        lintSuccess: false,
        lintOutput: 'Lint errors',
      };

      const evalResult = agentResultToEvalResult(agentResult);

      expect(evalResult.scriptResults).toHaveLength(2);
      expect(evalResult.scriptResults?.[0]).toEqual({
        name: 'build',
        success: true,
        output: 'Build succeeded',
      });
      expect(evalResult.scriptResults?.[1]).toEqual({
        name: 'lint',
        success: false,
        output: 'Lint errors',
      });
    });
  });

  describe('createEvalSummary', () => {
    it('creates summary from run results', () => {
      const runs: EvalRunResult[] = [
        { status: 'passed', duration: 10 },
        { status: 'passed', duration: 15 },
        { status: 'failed', duration: 8, error: 'Test failed' },
      ];

      const summary = createEvalSummary('my-eval', runs);

      expect(summary.name).toBe('my-eval');
      expect(summary.totalRuns).toBe(3);
      expect(summary.passedRuns).toBe(2);
      expect(summary.passRate).toBeCloseTo(66.67, 1);
      expect(summary.meanDuration).toBeCloseTo(11, 0);
      expect(summary.runs).toBe(runs);
    });

    it('handles empty runs', () => {
      const summary = createEvalSummary('empty-eval', []);

      expect(summary.totalRuns).toBe(0);
      expect(summary.passedRuns).toBe(0);
      expect(summary.passRate).toBe(0);
      expect(summary.meanDuration).toBe(0);
    });

    it('calculates 100% pass rate', () => {
      const runs: EvalRunResult[] = [
        { status: 'passed', duration: 10 },
        { status: 'passed', duration: 12 },
      ];

      const summary = createEvalSummary('perfect-eval', runs);

      expect(summary.passRate).toBe(100);
    });
  });

  describe('createExperimentResults', () => {
    it('creates experiment results with timestamps', () => {
      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'opus',
        evals: ['eval-1'],
        runs: 2,
        earlyExit: false,
        scripts: ['build'],
        timeout: 300,
      };

      const evals = [createEvalSummary('eval-1', [{ status: 'passed', duration: 10 }])];
      const startedAt = new Date('2024-01-26T12:00:00Z');
      const completedAt = new Date('2024-01-26T12:05:00Z');

      const results = createExperimentResults(config, evals, startedAt, completedAt);

      expect(results.startedAt).toBe('2024-01-26T12:00:00.000Z');
      expect(results.completedAt).toBe('2024-01-26T12:05:00.000Z');
      expect(results.config).toBe(config);
      expect(results.evals).toBe(evals);
    });
  });

  describe('saveResults', () => {
    it('saves results to disk', () => {
      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'opus',
        evals: ['eval-1'],
        runs: 1,
        earlyExit: true,
        scripts: [],
        timeout: 300,
      };

      const evals = [
        createEvalSummary('eval-1', [
          { status: 'passed', duration: 10 },
          { status: 'failed', duration: 8, error: 'Error' },
        ]),
      ];

      const results = createExperimentResults(
        config,
        evals,
        new Date('2024-01-26T12:00:00Z'),
        new Date('2024-01-26T12:01:00Z')
      );

      const outputDir = saveResults(results, {
        resultsDir: TEST_DIR,
        experimentName: 'test-experiment',
      });

      // Check experiment.json exists
      expect(existsSync(join(outputDir, 'experiment.json'))).toBe(true);

      // Check eval summary exists
      expect(existsSync(join(outputDir, 'eval-1', 'summary.json'))).toBe(true);

      // Check individual run results exist
      expect(existsSync(join(outputDir, 'eval-1', 'run-1', 'result.json'))).toBe(true);
      expect(existsSync(join(outputDir, 'eval-1', 'run-2', 'result.json'))).toBe(true);

      // Verify content
      const experimentJson = JSON.parse(
        readFileSync(join(outputDir, 'experiment.json'), 'utf-8')
      );
      expect(experimentJson.config.model).toBe('opus');

      const summaryJson = JSON.parse(
        readFileSync(join(outputDir, 'eval-1', 'summary.json'), 'utf-8')
      );
      expect(summaryJson.passedRuns).toBe(1);
    });
  });

  describe('formatResultsTable', () => {
    it('formats results as table', () => {
      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'opus',
        evals: ['eval-1', 'eval-2'],
        runs: 2,
        earlyExit: false,
        scripts: [],
        timeout: 300,
      };

      const evals = [
        createEvalSummary('eval-1', [
          { status: 'passed', duration: 10 },
          { status: 'passed', duration: 12 },
        ]),
        createEvalSummary('eval-2', [
          { status: 'passed', duration: 8 },
          { status: 'failed', duration: 15, error: 'Error' },
        ]),
      ];

      const results = createExperimentResults(
        config,
        evals,
        new Date('2024-01-26T12:00:00Z'),
        new Date('2024-01-26T12:01:00Z')
      );

      const table = formatResultsTable(results);

      expect(table).toContain('eval-1');
      expect(table).toContain('eval-2');
      expect(table).toContain('2/2 passed');
      expect(table).toContain('1/2 passed');
      expect(table).toContain('Overall');
    });
  });

  describe('formatRunResult', () => {
    it('formats passed result', () => {
      const result: EvalRunResult = { status: 'passed', duration: 45.2 };
      const formatted = formatRunResult('my-eval', 1, 5, result);

      expect(formatted).toContain('my-eval');
      expect(formatted).toContain('1/5');
      expect(formatted).toContain('45.2');
    });

    it('formats failed result with error', () => {
      const result: EvalRunResult = {
        status: 'failed',
        duration: 30.0,
        error: 'Test assertion failed: expected true to be false',
      };
      const formatted = formatRunResult('failing-eval', 3, 10, result);

      expect(formatted).toContain('failing-eval');
      expect(formatted).toContain('3/10');
      expect(formatted).toContain('Test assertion failed');
    });
  });
});
