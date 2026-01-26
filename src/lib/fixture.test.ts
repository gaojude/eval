import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import {
  discoverFixtures,
  validateFixtureFiles,
  validatePackageJson,
  loadFixture,
  loadAllFixtures,
  getFixtureFiles,
  readFixtureFiles,
  FixtureValidationError,
} from './fixture.js';

const TEST_DIR = '/tmp/eval-framework-test-fixtures';

function createTestFixture(name: string, files: Record<string, string>) {
  const fixturePath = join(TEST_DIR, name);
  mkdirSync(fixturePath, { recursive: true });

  for (const [filename, content] of Object.entries(files)) {
    const filePath = join(fixturePath, filename);
    const dir = join(filePath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, content);
  }

  return fixturePath;
}

describe('fixture discovery and validation', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('discoverFixtures', () => {
    it('discovers fixture directories', () => {
      createTestFixture('eval-1', { 'README.md': '# Test' });
      createTestFixture('eval-2', { 'README.md': '# Test' });

      const fixtures = discoverFixtures(TEST_DIR);
      expect(fixtures).toEqual(['eval-1', 'eval-2']);
    });

    it('ignores hidden directories', () => {
      createTestFixture('eval-1', { 'README.md': '# Test' });
      createTestFixture('.hidden', { 'README.md': '# Test' });

      const fixtures = discoverFixtures(TEST_DIR);
      expect(fixtures).toEqual(['eval-1']);
    });

    it('ignores files at root level', () => {
      createTestFixture('eval-1', { 'README.md': '# Test' });
      writeFileSync(join(TEST_DIR, 'some-file.txt'), 'content');

      const fixtures = discoverFixtures(TEST_DIR);
      expect(fixtures).toEqual(['eval-1']);
    });

    it('throws if directory does not exist', () => {
      expect(() => discoverFixtures('/non/existent/path')).toThrow('Evals directory not found');
    });

    it('returns sorted fixture names', () => {
      createTestFixture('z-eval', { 'README.md': '# Test' });
      createTestFixture('a-eval', { 'README.md': '# Test' });
      createTestFixture('m-eval', { 'README.md': '# Test' });

      const fixtures = discoverFixtures(TEST_DIR);
      expect(fixtures).toEqual(['a-eval', 'm-eval', 'z-eval']);
    });
  });

  describe('validateFixtureFiles', () => {
    it('returns empty array for valid fixture', () => {
      const path = createTestFixture('valid', {
        'PROMPT.md': '# Task',
        'EVAL.ts': 'test code',
        'package.json': '{}',
      });

      const missing = validateFixtureFiles(path);
      expect(missing).toEqual([]);
    });

    it('returns missing files', () => {
      const path = createTestFixture('incomplete', {
        'PROMPT.md': '# Task',
      });

      const missing = validateFixtureFiles(path);
      expect(missing).toContain('EVAL.ts');
      expect(missing).toContain('package.json');
      expect(missing).not.toContain('PROMPT.md');
    });
  });

  describe('validatePackageJson', () => {
    it('validates module type', () => {
      const path = createTestFixture('module', {
        'package.json': JSON.stringify({ name: 'test', type: 'module' }),
      });

      const result = validatePackageJson(path);
      expect(result.isModule).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects non-module package', () => {
      const path = createTestFixture('commonjs', {
        'package.json': JSON.stringify({ name: 'test' }),
      });

      const result = validatePackageJson(path);
      expect(result.isModule).toBe(false);
      expect(result.error).toContain('type');
    });

    it('rejects invalid JSON', () => {
      const path = createTestFixture('invalid-json', {
        'package.json': '{ invalid json }',
      });

      const result = validatePackageJson(path);
      expect(result.isModule).toBe(false);
      expect(result.error).toContain('not valid JSON');
    });
  });

  describe('loadFixture', () => {
    it('loads valid fixture', () => {
      createTestFixture('my-eval', {
        'PROMPT.md': 'Add a button',
        'EVAL.ts': 'test("button exists", () => {});',
        'package.json': JSON.stringify({ name: 'my-eval', type: 'module' }),
      });

      const fixture = loadFixture(TEST_DIR, 'my-eval');

      expect(fixture.name).toBe('my-eval');
      expect(fixture.prompt).toBe('Add a button');
      expect(fixture.isModule).toBe(true);
      expect(fixture.path).toContain('my-eval');
    });

    it('throws for non-existent fixture', () => {
      expect(() => loadFixture(TEST_DIR, 'non-existent')).toThrow(FixtureValidationError);
    });

    it('throws for missing required files', () => {
      createTestFixture('incomplete', {
        'PROMPT.md': 'Task',
      });

      expect(() => loadFixture(TEST_DIR, 'incomplete')).toThrow('Missing required files');
    });

    it('throws for invalid package.json', () => {
      createTestFixture('bad-pkg', {
        'PROMPT.md': 'Task',
        'EVAL.ts': 'test code',
        'package.json': JSON.stringify({ name: 'test' }), // Missing type: module
      });

      expect(() => loadFixture(TEST_DIR, 'bad-pkg')).toThrow('type');
    });
  });

  describe('loadAllFixtures', () => {
    it('loads all valid fixtures', () => {
      createTestFixture('eval-1', {
        'PROMPT.md': 'Task 1',
        'EVAL.ts': 'test 1',
        'package.json': JSON.stringify({ type: 'module' }),
      });
      createTestFixture('eval-2', {
        'PROMPT.md': 'Task 2',
        'EVAL.ts': 'test 2',
        'package.json': JSON.stringify({ type: 'module' }),
      });

      const { fixtures, errors } = loadAllFixtures(TEST_DIR);

      expect(fixtures).toHaveLength(2);
      expect(errors).toHaveLength(0);
      expect(fixtures.map((f) => f.name)).toEqual(['eval-1', 'eval-2']);
    });

    it('collects validation errors without throwing', () => {
      createTestFixture('valid', {
        'PROMPT.md': 'Task',
        'EVAL.ts': 'test',
        'package.json': JSON.stringify({ type: 'module' }),
      });
      createTestFixture('invalid', {
        'PROMPT.md': 'Task',
        // Missing EVAL.ts and package.json
      });

      const { fixtures, errors } = loadAllFixtures(TEST_DIR);

      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].name).toBe('valid');
      expect(errors).toHaveLength(1);
      expect(errors[0].fixtureName).toBe('invalid');
    });
  });

  describe('getFixtureFiles', () => {
    it('lists all files excluding defaults', () => {
      createTestFixture('full', {
        'PROMPT.md': 'Task',
        'EVAL.ts': 'test',
        'package.json': '{}',
        'src/App.tsx': 'app code',
        'src/utils/helper.ts': 'helper',
        'tsconfig.json': '{}',
      });

      const path = join(TEST_DIR, 'full');
      const files = getFixtureFiles(path);

      expect(files).toContain('src/App.tsx');
      expect(files).toContain('src/utils/helper.ts');
      expect(files).toContain('package.json');
      expect(files).toContain('tsconfig.json');
      expect(files).not.toContain('PROMPT.md');
      expect(files).not.toContain('EVAL.ts');
    });

    it('excludes node_modules', () => {
      createTestFixture('with-modules', {
        'package.json': '{}',
        'src/App.tsx': 'app',
        'node_modules/pkg/index.js': 'module code',
      });

      const path = join(TEST_DIR, 'with-modules');
      const files = getFixtureFiles(path);

      expect(files).not.toContain('node_modules/pkg/index.js');
      expect(files).toContain('src/App.tsx');
    });

    it('uses custom exclude patterns', () => {
      createTestFixture('custom', {
        'PROMPT.md': 'Task',
        'src/App.tsx': 'app',
        'dist/bundle.js': 'bundle',
      });

      const path = join(TEST_DIR, 'custom');
      const files = getFixtureFiles(path, ['dist']);

      expect(files).toContain('PROMPT.md');
      expect(files).toContain('src/App.tsx');
      expect(files).not.toContain('dist/bundle.js');
    });
  });

  describe('readFixtureFiles', () => {
    it('reads file contents into map', () => {
      createTestFixture('readable', {
        'PROMPT.md': 'Task',
        'EVAL.ts': 'test',
        'package.json': '{"name":"test"}',
        'src/index.ts': 'export const x = 1;',
      });

      const path = join(TEST_DIR, 'readable');
      const contents = readFixtureFiles(path);

      expect(contents.get('package.json')).toBe('{"name":"test"}');
      expect(contents.get('src/index.ts')).toBe('export const x = 1;');
      expect(contents.has('PROMPT.md')).toBe(false);
      expect(contents.has('EVAL.ts')).toBe(false);
    });
  });
});
