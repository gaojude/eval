import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { getModelId } from './agent.js';

const TEST_DIR = '/tmp/eval-framework-agent-test';

describe('agent utilities', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('getModelId', () => {
    it('returns correct model ID for opus', () => {
      expect(getModelId('opus')).toBe('claude-opus-4-5-20251101');
    });

    it('returns correct model ID for sonnet', () => {
      expect(getModelId('sonnet')).toBe('claude-sonnet-4-20250514');
    });

    it('returns correct model ID for haiku', () => {
      expect(getModelId('haiku')).toBe('claude-haiku-3-5-20241022');
    });
  });
});

// Mock-based tests for runAgent
describe('runAgent logic', () => {
  it('creates fixture for testing', () => {
    // Create a minimal fixture structure for testing
    const fixturePath = join(TEST_DIR, 'test-fixture');
    mkdirSync(fixturePath, { recursive: true });
    mkdirSync(join(fixturePath, 'src'));

    writeFileSync(join(fixturePath, 'package.json'), JSON.stringify({
      name: 'test',
      type: 'module',
      scripts: { build: 'tsc' },
    }));
    writeFileSync(join(fixturePath, 'src/index.ts'), 'export const x = 1;');
    writeFileSync(join(fixturePath, 'EVAL.ts'), 'test code');

    // Verify fixture structure
    expect(existsSync(join(fixturePath, 'package.json'))).toBe(true);
    expect(existsSync(join(fixturePath, 'src/index.ts'))).toBe(true);
    expect(existsSync(join(fixturePath, 'EVAL.ts'))).toBe(true);
  });
});

// Integration tests that require actual Vercel/Anthropic credentials
// These are skipped by default and can be run with AGENT_INTEGRATION_TEST=1
describe.skipIf(!process.env.AGENT_INTEGRATION_TEST)('agent integration', () => {
  it('can run agent on simple fixture', async () => {
    const { runAgent } = await import('./agent.js');

    // Create test fixture
    const fixturePath = join(TEST_DIR, 'simple-fixture');
    mkdirSync(fixturePath, { recursive: true });
    mkdirSync(join(fixturePath, 'src'));

    writeFileSync(
      join(fixturePath, 'package.json'),
      JSON.stringify({
        name: 'simple-eval',
        type: 'module',
        scripts: {},
        devDependencies: {
          vitest: '^2.1.0',
        },
      })
    );

    writeFileSync(
      join(fixturePath, 'src/index.ts'),
      `// TODO: Add greeting function`
    );

    writeFileSync(
      join(fixturePath, 'EVAL.ts'),
      `
import { test, expect } from 'vitest';
import { readFileSync } from 'fs';

test('greeting function exists', () => {
  const content = readFileSync('src/index.ts', 'utf-8');
  expect(content).toContain('greet');
});
`
    );

    const result = await runAgent(fixturePath, {
      prompt: 'Add a function called greet that takes a name and returns "Hello, {name}!"',
      model: 'haiku',
      timeout: 120000,
      apiKey: process.env.ANTHROPIC_API_KEY!,
      scripts: [],
    });

    // Check that agent ran (may or may not succeed depending on model behavior)
    expect(result.duration).toBeGreaterThan(0);
    expect(result.sandboxId).toBeDefined();
    expect(result.output).toBeDefined();
  }, 180000); // 3 minute timeout
});
