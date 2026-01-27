import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');
const CLI_PATH = resolve(PROJECT_ROOT, 'src/cli.ts');

const TEST_DIR = '/tmp/eval-framework-cli-test';

function runCli(args: string[], cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(`npx tsx ${CLI_PATH} ${args.join(' ')}`, {
      cwd: cwd ?? PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { stdout, stderr: '', exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout?.toString() ?? '',
      stderr: error.stderr?.toString() ?? '',
      exitCode: error.status ?? 1,
    };
  }
}

describe('CLI', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('help', () => {
    it('shows help with --help flag', () => {
      const result = runCli(['--help']);
      expect(result.stdout).toContain('eval');
      expect(result.stdout).toContain('init');
      expect(result.stdout).toContain('run');
      expect(result.stdout).toContain('list');
    });

    it('shows version with --version flag', () => {
      const result = runCli(['--version']);
      expect(result.stdout).toContain('0.1.6');
    });
  });

  describe('list command', () => {
    it('shows error when evals directory does not exist', () => {
      // Run from a directory without evals/
      const emptyDir = join(TEST_DIR, 'empty');
      mkdirSync(emptyDir);
      const result = runCli(['list'], emptyDir);
      expect(result.stderr).toContain('not found');
      expect(result.exitCode).toBe(1);
    });

    it('lists valid fixtures', () => {
      // Create project with evals directory
      const projectDir = join(TEST_DIR, 'project');
      mkdirSync(projectDir);
      const evalsDir = join(projectDir, 'evals');
      mkdirSync(evalsDir);

      // Create a valid fixture
      const fixture1 = join(evalsDir, 'add-button');
      mkdirSync(fixture1);
      writeFileSync(join(fixture1, 'PROMPT.md'), 'Add a button to the page');
      writeFileSync(join(fixture1, 'EVAL.ts'), 'test code');
      writeFileSync(join(fixture1, 'package.json'), JSON.stringify({ type: 'module' }));

      const result = runCli(['list'], projectDir);
      expect(result.stdout).toContain('add-button');
      expect(result.stdout).toContain('Add a button');
      expect(result.exitCode).toBe(0);
    });

    it('shows invalid fixtures as warnings', () => {
      // Create project with evals directory
      const projectDir = join(TEST_DIR, 'project2');
      mkdirSync(projectDir);
      const evalsDir = join(projectDir, 'evals');
      mkdirSync(evalsDir);

      // Create an invalid fixture (missing EVAL.ts)
      const fixture = join(evalsDir, 'incomplete');
      mkdirSync(fixture);
      writeFileSync(join(fixture, 'PROMPT.md'), 'Task');
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({ type: 'module' }));

      const result = runCli(['list'], projectDir);
      expect(result.stdout).toContain('Invalid');
      expect(result.stdout).toContain('incomplete');
    });
  });

  describe('run command', () => {
    it('shows error when config file does not exist', () => {
      const result = runCli(['run', '/non/existent/config.ts']);
      expect(result.stderr).toContain('not found');
      expect(result.exitCode).toBe(1);
    });

    it('runs with valid config and evals (dry run)', () => {
      // Create project structure
      const projectDir = join(TEST_DIR, 'project');
      mkdirSync(projectDir);

      // Create config file
      const configContent = `export default { agent: 'claude-code' };`;
      writeFileSync(join(projectDir, 'experiment.ts'), configContent);

      // Create evals directory with valid fixture
      const evalsDir = join(projectDir, 'evals');
      mkdirSync(evalsDir);
      const fixture = join(evalsDir, 'my-eval');
      mkdirSync(fixture);
      writeFileSync(join(fixture, 'PROMPT.md'), 'Test task');
      writeFileSync(join(fixture, 'EVAL.ts'), 'test code');
      writeFileSync(join(fixture, 'package.json'), JSON.stringify({ type: 'module' }));

      const result = runCli(['run', 'experiment.ts', '--dry'], projectDir);
      expect(result.stdout).toContain('my-eval');
      expect(result.stdout).toContain('DRY RUN');
      expect(result.exitCode).toBe(0);
    });

    it('shows error when no valid fixtures found', () => {
      const projectDir = join(TEST_DIR, 'empty-project');
      mkdirSync(projectDir);

      const configContent = `export default { agent: 'claude-code' };`;
      writeFileSync(join(projectDir, 'experiment.ts'), configContent);

      const evalsDir = join(projectDir, 'evals');
      mkdirSync(evalsDir);

      const result = runCli(['run', 'experiment.ts'], projectDir);
      expect(result.stderr).toContain('No valid eval fixtures');
      expect(result.exitCode).toBe(1);
    });

    it('validates config file', () => {
      const projectDir = join(TEST_DIR, 'bad-config');
      mkdirSync(projectDir);

      // Create invalid config (missing agent)
      const configContent = `export default { model: 'opus' };`;
      writeFileSync(join(projectDir, 'experiment.ts'), configContent);

      const evalsDir = join(projectDir, 'evals');
      mkdirSync(evalsDir);

      const result = runCli(['run', 'experiment.ts'], projectDir);
      expect(result.stderr).toContain('Error');
      expect(result.exitCode).toBe(1);
    });
  });
});
