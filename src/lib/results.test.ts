import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  agentResultToEvalRunData,
  createEvalSummary,
  createExperimentResults,
  saveResults,
  formatResultsTable,
  formatRunResult,
} from './results.js';
import type { AgentRunResult } from './agent.js';
import type { EvalRunResult, EvalRunData, ResolvedExperimentConfig } from './types.js';

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

  describe('agentResultToEvalRunData', () => {
    it('converts successful agent result', () => {
      const agentResult: AgentRunResult = {
        success: true,
        output: 'Agent output',
        transcript: '{"role":"assistant","content":"Hello"}',
        duration: 45000, // 45 seconds in ms
        buildSuccess: true,
        lintSuccess: true,
        testSuccess: true,
        sandboxId: 'sandbox-123',
      };

      const runData = agentResultToEvalRunData(agentResult);

      expect(runData.result.status).toBe('passed');
      expect(runData.result.duration).toBe(45); // Converted to seconds
      expect(runData.result.error).toBeUndefined();
      expect(runData.result.failedStep).toBeUndefined();
      expect(runData.transcript).toBe('{"role":"assistant","content":"Hello"}');
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

      const runData = agentResultToEvalRunData(agentResult);

      expect(runData.result.status).toBe('failed');
      expect(runData.result.error).toBe('Claude Code exited with code 1');
      expect(runData.result.failedStep).toBe('agent');
    });

    it('identifies setup failure', () => {
      const agentResult: AgentRunResult = {
        success: false,
        output: '',
        duration: 5000,
        error: 'npm install failed: ENOENT',
      };

      const runData = agentResultToEvalRunData(agentResult);

      expect(runData.result.failedStep).toBe('setup');
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

      const runData = agentResultToEvalRunData(agentResult);

      expect(runData.result.failedStep).toBe('tests');
    });

    it('handles missing transcript', () => {
      const agentResult: AgentRunResult = {
        success: true,
        output: 'output',
        duration: 10000,
      };

      const runData = agentResultToEvalRunData(agentResult);

      expect(runData.transcript).toBeUndefined();
    });
  });

  describe('createEvalSummary', () => {
    it('creates summary from run data', () => {
      const runData: EvalRunData[] = [
        { result: { status: 'passed', duration: 10 }, transcript: 'transcript1' },
        { result: { status: 'passed', duration: 15 }, transcript: 'transcript2' },
        { result: { status: 'failed', duration: 8, error: 'Test failed' } },
      ];

      const summary = createEvalSummary('my-eval', runData);

      expect(summary.name).toBe('my-eval');
      expect(summary.totalRuns).toBe(3);
      expect(summary.passedRuns).toBe(2);
      expect(summary.passRate).toBeCloseTo(66.67, 1);
      expect(summary.meanDuration).toBeCloseTo(11, 0);
      expect(summary.runs).toBe(runData);
    });

    it('handles empty runs', () => {
      const summary = createEvalSummary('empty-eval', []);

      expect(summary.totalRuns).toBe(0);
      expect(summary.passedRuns).toBe(0);
      expect(summary.passRate).toBe(0);
      expect(summary.meanDuration).toBe(0);
    });

    it('calculates 100% pass rate', () => {
      const runData: EvalRunData[] = [
        { result: { status: 'passed', duration: 10 } },
        { result: { status: 'passed', duration: 12 } },
      ];

      const summary = createEvalSummary('perfect-eval', runData);

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

      const evals = [createEvalSummary('eval-1', [{ result: { status: 'passed', duration: 10 } }])];
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
    it('saves results to disk with correct structure', () => {
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
          {
            result: { status: 'passed', duration: 10 },
            transcript: '{"role":"assistant"}',
            outputContent: { tests: 'Test output here', build: 'Build output here' },
          },
          { result: { status: 'failed', duration: 8, error: 'Error' } },
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

      // Check transcript.jsonl exists for run with transcript
      expect(existsSync(join(outputDir, 'eval-1', 'run-1', 'transcript.jsonl'))).toBe(true);
      // No transcript for run-2
      expect(existsSync(join(outputDir, 'eval-1', 'run-2', 'transcript.jsonl'))).toBe(false);

      // Check outputs/ directory exists and contains script output files
      expect(existsSync(join(outputDir, 'eval-1', 'run-1', 'outputs'))).toBe(true);
      expect(existsSync(join(outputDir, 'eval-1', 'run-1', 'outputs', 'tests.txt'))).toBe(true);
      expect(existsSync(join(outputDir, 'eval-1', 'run-1', 'outputs', 'build.txt'))).toBe(true);

      // Verify output file content
      const testsOutput = readFileSync(
        join(outputDir, 'eval-1', 'run-1', 'outputs', 'tests.txt'),
        'utf-8'
      );
      expect(testsOutput).toBe('Test output here');

      const buildOutput = readFileSync(
        join(outputDir, 'eval-1', 'run-1', 'outputs', 'build.txt'),
        'utf-8'
      );
      expect(buildOutput).toBe('Build output here');

      // Verify experiment.json content
      const experimentJson = JSON.parse(
        readFileSync(join(outputDir, 'experiment.json'), 'utf-8')
      );
      expect(experimentJson.config.model).toBe('opus');

      // Verify summary.json format (per design: totalRuns, passedRuns, passRate as string, meanDuration)
      const summaryJson = JSON.parse(
        readFileSync(join(outputDir, 'eval-1', 'summary.json'), 'utf-8')
      );
      expect(summaryJson.totalRuns).toBe(2);
      expect(summaryJson.passedRuns).toBe(1);
      expect(summaryJson.passRate).toBe('50%');
      expect(summaryJson.meanDuration).toBe(9);
      // Should NOT have name or runs array in the file
      expect(summaryJson.name).toBeUndefined();
      expect(summaryJson.runs).toBeUndefined();

      // Verify result.json format with paths
      const resultJson = JSON.parse(
        readFileSync(join(outputDir, 'eval-1', 'run-1', 'result.json'), 'utf-8')
      );
      expect(resultJson.status).toBe('passed');
      expect(resultJson.duration).toBe(10);
      // Should have paths to transcript and outputs
      expect(resultJson.transcriptPath).toBe('./transcript.jsonl');
      expect(resultJson.outputPaths).toEqual({
        tests: './outputs/tests.txt',
        build: './outputs/build.txt',
      });
      // Should NOT have raw content
      expect(resultJson.transcript).toBeUndefined();
      expect(resultJson.outputContent).toBeUndefined();

      // Verify transcript.jsonl content
      const transcriptContent = readFileSync(
        join(outputDir, 'eval-1', 'run-1', 'transcript.jsonl'),
        'utf-8'
      );
      expect(transcriptContent).toBe('{"role":"assistant"}');
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
          { result: { status: 'passed', duration: 10 } },
          { result: { status: 'passed', duration: 12 } },
        ]),
        createEvalSummary('eval-2', [
          { result: { status: 'passed', duration: 8 } },
          { result: { status: 'failed', duration: 15, error: 'Error' } },
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
