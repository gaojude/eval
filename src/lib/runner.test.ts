import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { runExperiment } from './runner.js';
import type { ResolvedExperimentConfig, EvalFixture } from './types.js';
import type { Agent } from './agents/types.js';
import * as agentsIndex from './agents/index.js';

const TEST_DIR = '/tmp/eval-framework-runner-test';

describe('runExperiment', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
    vi.restoreAllMocks();
  });

  describe('early exit behavior', () => {
    it('stops after first successful run when earlyExit is true', async () => {
      // Create a mock agent that always succeeds
      const mockAgent: Agent = {
        name: 'mock-agent',
        displayName: 'Mock Agent',
        getApiKeyEnvVar: () => 'MOCK_API_KEY',
        getDefaultModel: () => 'mock-model',
        run: vi.fn().mockResolvedValue({
          success: true,
          output: 'Agent output',
          duration: 1000,
          testResult: { success: true, output: 'Test passed' },
          scriptsResults: {},
        }),
      };

      // Spy on getAgent to return our mock
      vi.spyOn(agentsIndex, 'getAgent').mockReturnValue(mockAgent);

      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'sonnet',
        evals: ['test-eval'],
        runs: 5,
        earlyExit: true,
        scripts: [],
        timeout: 300,
      };

      const fixtures: EvalFixture[] = [
        {
          name: 'test-eval',
          path: '/fake/path',
          prompt: 'Test prompt',
          isModule: true,
        },
      ];

      const results = await runExperiment({
        config,
        fixtures,
        apiKey: 'test-key',
        resultsDir: TEST_DIR,
        experimentName: 'test-experiment',
      });

      // Should only run once since first run passed
      expect(mockAgent.run).toHaveBeenCalledTimes(1);
      expect(results.evals[0].totalRuns).toBe(1);
      expect(results.evals[0].passedRuns).toBe(1);
    });

    it('continues running when earlyExit is true but runs fail', async () => {
      // Create a mock agent that always fails
      const mockAgent: Agent = {
        name: 'mock-agent',
        displayName: 'Mock Agent',
        getApiKeyEnvVar: () => 'MOCK_API_KEY',
        getDefaultModel: () => 'mock-model',
        run: vi.fn().mockResolvedValue({
          success: false,
          output: 'Agent output',
          duration: 1000,
          error: 'Test failed',
          testResult: { success: false, output: 'Test failed' },
          scriptsResults: {},
        }),
      };

      vi.spyOn(agentsIndex, 'getAgent').mockReturnValue(mockAgent);

      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'sonnet',
        evals: ['test-eval'],
        runs: 3,
        earlyExit: true,
        scripts: [],
        timeout: 300,
      };

      const fixtures: EvalFixture[] = [
        {
          name: 'test-eval',
          path: '/fake/path',
          prompt: 'Test prompt',
          isModule: true,
        },
      ];

      const results = await runExperiment({
        config,
        fixtures,
        apiKey: 'test-key',
        resultsDir: TEST_DIR,
        experimentName: 'test-experiment',
      });

      // Should run all 3 times since all runs failed
      expect(mockAgent.run).toHaveBeenCalledTimes(3);
      expect(results.evals[0].totalRuns).toBe(3);
      expect(results.evals[0].passedRuns).toBe(0);
    });

    it('runs all configured runs when earlyExit is false', async () => {
      // Create a mock agent that always succeeds
      const mockAgent: Agent = {
        name: 'mock-agent',
        displayName: 'Mock Agent',
        getApiKeyEnvVar: () => 'MOCK_API_KEY',
        getDefaultModel: () => 'mock-model',
        run: vi.fn().mockResolvedValue({
          success: true,
          output: 'Agent output',
          duration: 1000,
          testResult: { success: true, output: 'Test passed' },
          scriptsResults: {},
        }),
      };

      vi.spyOn(agentsIndex, 'getAgent').mockReturnValue(mockAgent);

      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'sonnet',
        evals: ['test-eval'],
        runs: 4,
        earlyExit: false,
        scripts: [],
        timeout: 300,
      };

      const fixtures: EvalFixture[] = [
        {
          name: 'test-eval',
          path: '/fake/path',
          prompt: 'Test prompt',
          isModule: true,
        },
      ];

      const results = await runExperiment({
        config,
        fixtures,
        apiKey: 'test-key',
        resultsDir: TEST_DIR,
        experimentName: 'test-experiment',
      });

      // Should run all 4 times even though all runs passed
      expect(mockAgent.run).toHaveBeenCalledTimes(4);
      expect(results.evals[0].totalRuns).toBe(4);
      expect(results.evals[0].passedRuns).toBe(4);
    });

    it('exits early on second run when first fails but second passes', async () => {
      let callCount = 0;
      
      // Create a mock agent that fails first, then succeeds
      const mockAgent: Agent = {
        name: 'mock-agent',
        displayName: 'Mock Agent',
        getApiKeyEnvVar: () => 'MOCK_API_KEY',
        getDefaultModel: () => 'mock-model',
        run: vi.fn().mockImplementation(async () => {
          callCount++;
          const success = callCount > 1; // Fail first, succeed after
          
          return {
            success,
            output: 'Agent output',
            duration: 1000,
            error: success ? undefined : 'Test failed',
            testResult: { success, output: success ? 'Test passed' : 'Test failed' },
            scriptsResults: {},
          };
        }),
      };

      vi.spyOn(agentsIndex, 'getAgent').mockReturnValue(mockAgent);

      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'sonnet',
        evals: ['test-eval'],
        runs: 5,
        earlyExit: true,
        scripts: [],
        timeout: 300,
      };

      const fixtures: EvalFixture[] = [
        {
          name: 'test-eval',
          path: '/fake/path',
          prompt: 'Test prompt',
          isModule: true,
        },
      ];

      const results = await runExperiment({
        config,
        fixtures,
        apiKey: 'test-key',
        resultsDir: TEST_DIR,
        experimentName: 'test-experiment',
      });

      // Should run twice: first fails, second passes and exits
      expect(mockAgent.run).toHaveBeenCalledTimes(2);
      expect(results.evals[0].totalRuns).toBe(2);
      expect(results.evals[0].passedRuns).toBe(1);
    });
  });

  describe('multiple fixtures', () => {
    it('runs all fixtures with early exit behavior per fixture', async () => {
      let eval2Calls = 0;

      const mockAgent: Agent = {
        name: 'mock-agent',
        displayName: 'Mock Agent',
        getApiKeyEnvVar: () => 'MOCK_API_KEY',
        getDefaultModel: () => 'mock-model',
        run: vi.fn().mockImplementation(async (fixturePath) => {
          // eval-1 succeeds on first try, eval-2 succeeds on second try
          if (fixturePath.includes('eval-1')) {
            return {
              success: true,
              output: 'Agent output',
              duration: 1000,
              testResult: { success: true, output: 'Test passed' },
              scriptsResults: {},
            };
          } else {
            eval2Calls++;
            const success = eval2Calls > 1;
            return {
              success,
              output: 'Agent output',
              duration: 1000,
              error: success ? undefined : 'Test failed',
              testResult: { success, output: success ? 'Test passed' : 'Test failed' },
              scriptsResults: {},
            };
          }
        }),
      };

      vi.spyOn(agentsIndex, 'getAgent').mockReturnValue(mockAgent);

      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'sonnet',
        evals: ['eval-1', 'eval-2'],
        runs: 5,
        earlyExit: true,
        scripts: [],
        timeout: 300,
      };

      const fixtures: EvalFixture[] = [
        {
          name: 'eval-1',
          path: '/fake/path/eval-1',
          prompt: 'Test prompt 1',
          isModule: true,
        },
        {
          name: 'eval-2',
          path: '/fake/path/eval-2',
          prompt: 'Test prompt 2',
          isModule: true,
        },
      ];

      const results = await runExperiment({
        config,
        fixtures,
        apiKey: 'test-key',
        resultsDir: TEST_DIR,
        experimentName: 'test-experiment',
      });

      // eval-1 should run once (passed first time)
      expect(results.evals[0].totalRuns).toBe(1);
      expect(results.evals[0].passedRuns).toBe(1);

      // eval-2 should run twice (failed first, passed second)
      expect(results.evals[1].totalRuns).toBe(2);
      expect(results.evals[1].passedRuns).toBe(1);
    });
  });

  describe('agent options', () => {
    it('passes correct options to agent.run', async () => {
      const mockAgent: Agent = {
        name: 'mock-agent',
        displayName: 'Mock Agent',
        getApiKeyEnvVar: () => 'MOCK_API_KEY',
        getDefaultModel: () => 'mock-model',
        run: vi.fn().mockResolvedValue({
          success: true,
          output: 'Agent output',
          duration: 1000,
          testResult: { success: true, output: 'Test passed' },
          scriptsResults: {},
        }),
      };

      vi.spyOn(agentsIndex, 'getAgent').mockReturnValue(mockAgent);

      const mockSetup = vi.fn();
      const config: ResolvedExperimentConfig = {
        agent: 'claude-code',
        model: 'opus',
        evals: ['test-eval'],
        runs: 1,
        earlyExit: true,
        scripts: ['build', 'lint'],
        timeout: 600,
        setup: mockSetup,
      };

      const fixtures: EvalFixture[] = [
        {
          name: 'test-eval',
          path: '/fake/path',
          prompt: 'Test prompt for agent',
          isModule: true,
        },
      ];

      await runExperiment({
        config,
        fixtures,
        apiKey: 'my-api-key',
        resultsDir: TEST_DIR,
        experimentName: 'test-experiment',
      });

      expect(mockAgent.run).toHaveBeenCalledWith('/fake/path', {
        prompt: 'Test prompt for agent',
        model: 'opus',
        timeout: 600000, // Should be converted to milliseconds
        apiKey: 'my-api-key',
        setup: mockSetup,
        scripts: ['build', 'lint'],
      });
    });
  });
});
