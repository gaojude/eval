import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  collectLocalFiles,
  splitTestFiles,
  IGNORED_PATTERNS,
  TEST_FILE_PATTERNS,
  type SandboxFile,
} from './sandbox.js';

const TEST_DIR = '/tmp/eval-framework-sandbox-test';

describe('sandbox utilities', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('collectLocalFiles', () => {
    it('collects files from directory', async () => {
      writeFileSync(join(TEST_DIR, 'index.ts'), 'export const x = 1;');
      writeFileSync(join(TEST_DIR, 'utils.ts'), 'export const y = 2;');

      const files = await collectLocalFiles(TEST_DIR);

      expect(files).toHaveLength(2);
      expect(files.map((f) => f.path).sort()).toEqual(['index.ts', 'utils.ts']);
    });

    it('collects files from nested directories', async () => {
      mkdirSync(join(TEST_DIR, 'src'));
      writeFileSync(join(TEST_DIR, 'src/index.ts'), 'code');
      writeFileSync(join(TEST_DIR, 'package.json'), '{}');

      const files = await collectLocalFiles(TEST_DIR);

      expect(files.map((f) => f.path).sort()).toEqual(['package.json', 'src/index.ts']);
    });

    it('excludes default ignored patterns', async () => {
      writeFileSync(join(TEST_DIR, 'index.ts'), 'code');
      writeFileSync(join(TEST_DIR, '.DS_Store'), 'mac stuff');
      mkdirSync(join(TEST_DIR, 'node_modules'));
      writeFileSync(join(TEST_DIR, 'node_modules/pkg.js'), 'module');
      mkdirSync(join(TEST_DIR, '.git'));
      writeFileSync(join(TEST_DIR, '.git/config'), 'git config');

      const files = await collectLocalFiles(TEST_DIR);

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('index.ts');
    });

    it('excludes files with wildcard patterns', async () => {
      writeFileSync(join(TEST_DIR, 'index.ts'), 'code');
      writeFileSync(join(TEST_DIR, 'error.log'), 'log content');

      const files = await collectLocalFiles(TEST_DIR);

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('index.ts');
    });

    it('uses custom exclude patterns', async () => {
      writeFileSync(join(TEST_DIR, 'index.ts'), 'code');
      writeFileSync(join(TEST_DIR, 'index.test.ts'), 'test');
      mkdirSync(join(TEST_DIR, 'dist'));
      writeFileSync(join(TEST_DIR, 'dist/bundle.js'), 'bundle');

      const files = await collectLocalFiles(TEST_DIR, {
        excludePatterns: ['*.test.ts', 'dist'],
      });

      expect(files).toHaveLength(1);
      expect(files[0].path).toBe('index.ts');
    });

    it('uses include patterns when specified', async () => {
      writeFileSync(join(TEST_DIR, 'index.ts'), 'code');
      writeFileSync(join(TEST_DIR, 'readme.md'), 'readme');
      writeFileSync(join(TEST_DIR, 'config.json'), 'config');

      const files = await collectLocalFiles(TEST_DIR, {
        excludePatterns: [],
        includePatterns: ['*.ts', '*.json'],
      });

      expect(files.map((f) => f.path).sort()).toEqual(['config.json', 'index.ts']);
    });

    it('reads file content as Buffer', async () => {
      const content = 'export const test = "hello";';
      writeFileSync(join(TEST_DIR, 'file.ts'), content);

      const files = await collectLocalFiles(TEST_DIR);

      expect(files[0].content).toBeInstanceOf(Buffer);
      expect(files[0].content.toString('utf-8')).toBe(content);
    });
  });

  describe('splitTestFiles', () => {
    it('separates test files from workspace files', () => {
      const files: SandboxFile[] = [
        { path: 'src/App.tsx', content: 'app code' },
        { path: 'src/App.test.tsx', content: 'test code' },
        { path: 'src/utils.ts', content: 'utils' },
        { path: 'src/utils.test.ts', content: 'utils test' },
        { path: 'package.json', content: '{}' },
      ];

      const { workspaceFiles, testFiles } = splitTestFiles(files);

      expect(workspaceFiles.map((f) => f.path).sort()).toEqual([
        'package.json',
        'src/App.tsx',
        'src/utils.ts',
      ]);
      expect(testFiles.map((f) => f.path).sort()).toEqual([
        'src/App.test.tsx',
        'src/utils.test.ts',
      ]);
    });

    it('identifies EVAL.ts as test file', () => {
      const files: SandboxFile[] = [
        { path: 'EVAL.ts', content: 'eval tests' },
        { path: 'src/index.ts', content: 'code' },
      ];

      const { workspaceFiles, testFiles } = splitTestFiles(files);

      expect(workspaceFiles.map((f) => f.path)).toEqual(['src/index.ts']);
      expect(testFiles.map((f) => f.path)).toEqual(['EVAL.ts']);
    });

    it('handles nested test files', () => {
      const files: SandboxFile[] = [
        { path: 'src/components/Button.tsx', content: 'button' },
        { path: 'src/components/Button.test.tsx', content: 'button test' },
        { path: 'src/lib/__tests__/helper.test.ts', content: 'helper test' },
      ];

      const { workspaceFiles, testFiles } = splitTestFiles(files);

      expect(workspaceFiles).toHaveLength(1);
      expect(testFiles).toHaveLength(2);
    });

    it('returns empty arrays for empty input', () => {
      const { workspaceFiles, testFiles } = splitTestFiles([]);

      expect(workspaceFiles).toEqual([]);
      expect(testFiles).toEqual([]);
    });
  });

  describe('constants', () => {
    it('IGNORED_PATTERNS includes common ignores', () => {
      expect(IGNORED_PATTERNS).toContain('.git');
      expect(IGNORED_PATTERNS).toContain('node_modules');
      expect(IGNORED_PATTERNS).toContain('.DS_Store');
    });

    it('TEST_FILE_PATTERNS includes common test patterns', () => {
      expect(TEST_FILE_PATTERNS).toContain('*.test.tsx');
      expect(TEST_FILE_PATTERNS).toContain('*.test.ts');
      expect(TEST_FILE_PATTERNS).toContain('EVAL.ts');
    });
  });
});

// Integration tests that require actual Vercel credentials
// These are skipped by default and can be run with SANDBOX_INTEGRATION_TEST=1
describe.skipIf(!process.env.SANDBOX_INTEGRATION_TEST)('sandbox integration', () => {
  it('can create and stop a sandbox', async () => {
    const { SandboxManager } = await import('./sandbox.js');

    const sandbox = await SandboxManager.create({ timeout: 60000 });
    expect(sandbox.sandboxId).toBeDefined();

    const result = await sandbox.runCommand('echo', ['hello']);
    expect(result.stdout.trim()).toBe('hello');
    expect(result.exitCode).toBe(0);

    await sandbox.stop();
  });
});
