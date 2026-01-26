/**
 * End-to-end integration tests for the eval framework.
 *
 * These tests require valid Vercel and Anthropic credentials.
 * Run with: INTEGRATION_TEST=1 npm test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { initProject } from './lib/init.js';
import { loadFixture, loadAllFixtures } from './lib/fixture.js';
import { runSingleEval } from './lib/runner.js';
import { loadConfig } from './lib/config.js';

const TEST_DIR = '/tmp/eval-framework-integration-test';
const hasCredentials =
  process.env.ANTHROPIC_API_KEY && (process.env.VERCEL_TOKEN || process.env.VERCEL_OIDC_TOKEN);

describe.skipIf(!process.env.INTEGRATION_TEST)('integration tests', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('project initialization', () => {
    it('creates a complete project structure', () => {
      const projectDir = initProject({
        name: 'test-project',
        targetDir: TEST_DIR,
      });

      // Verify structure
      expect(existsSync(join(projectDir, 'package.json'))).toBe(true);
      expect(existsSync(join(projectDir, 'experiments/default.ts'))).toBe(true);
      expect(existsSync(join(projectDir, 'evals/add-greeting/PROMPT.md'))).toBe(true);
      expect(existsSync(join(projectDir, 'evals/add-greeting/EVAL.ts'))).toBe(true);
      expect(existsSync(join(projectDir, 'evals/add-greeting/package.json'))).toBe(true);

      // Verify package.json is valid
      const pkg = JSON.parse(readFileSync(join(projectDir, 'package.json'), 'utf-8'));
      expect(pkg.name).toBe('test-project');
      expect(pkg.type).toBe('module');
    });

    it('can load fixtures from generated project', () => {
      const projectDir = join(TEST_DIR, 'test-project');
      const evalsDir = join(projectDir, 'evals');

      const { fixtures, errors } = loadAllFixtures(evalsDir);

      expect(fixtures).toHaveLength(1);
      expect(errors).toHaveLength(0);
      expect(fixtures[0].name).toBe('add-greeting');
    });

    it('can load experiment config from generated project', async () => {
      const projectDir = join(TEST_DIR, 'test-project');
      const configPath = join(projectDir, 'experiments/default.ts');

      const config = await loadConfig(configPath);

      expect(config.agent).toBe('claude-code');
      expect(config.model).toBe('haiku');
    });
  });

  describe.skipIf(!hasCredentials)('sandbox execution', () => {
    it('can run a simple eval with Claude', async () => {
      // Create a simple test fixture
      const fixtureDir = join(TEST_DIR, 'simple-eval');
      mkdirSync(join(fixtureDir, 'src'), { recursive: true });

      writeFileSync(
        join(fixtureDir, 'PROMPT.md'),
        'Add a function called greet that returns "Hello!"'
      );
      writeFileSync(
        join(fixtureDir, 'EVAL.ts'),
        `
import { test, expect } from 'vitest';
import { readFileSync } from 'fs';

test('greet exists', () => {
  const content = readFileSync('src/index.ts', 'utf-8');
  expect(content).toContain('greet');
});
`
      );
      writeFileSync(
        join(fixtureDir, 'package.json'),
        JSON.stringify({
          name: 'simple-eval',
          type: 'module',
          scripts: { build: 'tsc' },
          devDependencies: { typescript: '^5.0.0', vitest: '^2.1.0' },
        })
      );
      writeFileSync(
        join(fixtureDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'bundler',
            outDir: 'dist',
          },
          include: ['src'],
        })
      );
      writeFileSync(join(fixtureDir, 'src/index.ts'), '// TODO: implement');

      const fixture = loadFixture(TEST_DIR, 'simple-eval');

      const result = await runSingleEval(fixture, {
        model: 'haiku',
        timeout: 120,
        apiKey: process.env.ANTHROPIC_API_KEY!,
        scripts: ['build'],
      });

      // The eval should have run (success or failure depends on agent behavior)
      expect(result.duration).toBeGreaterThan(0);
    }, 300000); // 5 minute timeout
  });

  describe('CLI commands', () => {
    it('can list evals via CLI', () => {
      const projectDir = join(TEST_DIR, 'test-project');
      const result = execSync(`npx tsx ${process.cwd()}/src/cli.ts list --evals-dir ${projectDir}/evals`, {
        encoding: 'utf-8',
      });

      expect(result).toContain('add-greeting');
    });

    it('can dry run experiment via CLI', () => {
      const projectDir = join(TEST_DIR, 'test-project');
      const result = execSync(
        `npx tsx ${process.cwd()}/src/cli.ts run ${projectDir}/experiments/default.ts --dry --evals-dir ../evals`,
        { encoding: 'utf-8' }
      );

      expect(result).toContain('DRY RUN');
      expect(result).toContain('add-greeting');
    });
  });
});
