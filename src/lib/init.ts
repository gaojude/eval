/**
 * Project initialization - create new eval projects.
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';

/**
 * Options for initializing a new project.
 */
export interface InitOptions {
  /** Project name */
  name: string;
  /** Target directory (defaults to current working directory) */
  targetDir?: string;
}

/**
 * Template file definitions.
 */
interface TemplateFile {
  path: string;
  content: string;
}

/**
 * Get the package.json template.
 */
function getPackageJson(projectName: string): string {
  return JSON.stringify(
    {
      name: projectName,
      version: '0.0.1',
      private: true,
      type: 'module',
      scripts: {
        eval: 'npx agent-eval run experiments/default.ts',
        'eval:list': 'npx agent-eval list',
      },
      devDependencies: {
        '@judegao/eval': '^0.1.0',
        typescript: '^5.6.0',
      },
    },
    null,
    2
  );
}

/**
 * Get the .env.example template.
 */
function getEnvExample(): string {
  return `# Required - Anthropic API key for Claude
ANTHROPIC_API_KEY=sk-ant-...

# Required - Vercel token for sandbox access
VERCEL_TOKEN=your-vercel-token

# Or use OIDC token if your organization uses that
# VERCEL_OIDC_TOKEN=your-oidc-token
`;
}

/**
 * Get the .gitignore template.
 */
function getGitignore(): string {
  return `node_modules/
dist/
.env
.env.local
results/
*.log
.DS_Store
`;
}

/**
 * Get the default experiment configuration template.
 */
function getDefaultExperiment(): string {
  return `import type { ExperimentConfig } from '@judegao/eval';

const config: ExperimentConfig = {
  // Which AI agent to use (currently only 'claude-code' supported)
  agent: 'claude-code',

  // Which model to use: 'opus', 'sonnet', or 'haiku'
  model: 'haiku',

  // How many times to run each eval (for measuring reliability)
  runs: 1,

  // Stop after first success? Set to false for reliability measurement
  earlyExit: true,

  // npm scripts that must pass after agent finishes
  scripts: ['build'],

  // Maximum time in seconds for agent to complete
  timeout: 300,
};

export default config;
`;
}

/**
 * Get the example eval fixture PROMPT.md.
 */
function getExamplePrompt(): string {
  return `Add a greeting message below the heading that says "Welcome, user!"

Requirements:
- Add a paragraph element below the h1
- The text should be exactly "Welcome, user!"
- Keep the existing heading unchanged
`;
}

/**
 * Get the example eval fixture EVAL.ts.
 */
function getExampleEval(): string {
  return `import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { test, expect } from 'vitest';

test('greeting message exists in source', () => {
  const content = readFileSync('src/App.tsx', 'utf-8');
  expect(content).toContain('Welcome, user!');
});

test('app still builds', () => {
  // This throws if the build fails
  execSync('npm run build', { stdio: 'pipe' });
});
`;
}

/**
 * Get the example eval fixture package.json.
 */
function getExamplePackageJson(): string {
  return JSON.stringify(
    {
      name: 'add-greeting',
      type: 'module',
      scripts: {
        build: 'tsc',
      },
      dependencies: {
        react: '^18.0.0',
      },
      devDependencies: {
        '@types/react': '^18.0.0',
        typescript: '^5.0.0',
        vitest: '^2.1.0',
      },
    },
    null,
    2
  );
}

/**
 * Get the example eval fixture tsconfig.json.
 */
function getExampleTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2020',
        module: 'ESNext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        strict: true,
        outDir: 'dist',
        skipLibCheck: true,
      },
      include: ['src'],
    },
    null,
    2
  );
}

/**
 * Get the example eval fixture App.tsx.
 */
function getExampleApp(): string {
  return `export function App() {
  return (
    <div>
      <h1>Hello World</h1>
      {/* TODO: Add greeting message here */}
    </div>
  );
}

export default App;
`;
}

/**
 * Get all template files for a new project.
 */
function getTemplateFiles(projectName: string): TemplateFile[] {
  return [
    { path: 'package.json', content: getPackageJson(projectName) },
    { path: '.env.example', content: getEnvExample() },
    { path: '.gitignore', content: getGitignore() },
    { path: 'experiments/default.ts', content: getDefaultExperiment() },
    { path: 'evals/add-greeting/PROMPT.md', content: getExamplePrompt() },
    { path: 'evals/add-greeting/EVAL.ts', content: getExampleEval() },
    { path: 'evals/add-greeting/package.json', content: getExamplePackageJson() },
    { path: 'evals/add-greeting/tsconfig.json', content: getExampleTsconfig() },
    { path: 'evals/add-greeting/src/App.tsx', content: getExampleApp() },
  ];
}

/**
 * Initialize a new eval project.
 */
export function initProject(options: InitOptions): string {
  const targetDir = options.targetDir ?? process.cwd();
  const projectDir = join(targetDir, options.name);

  // Check if directory already exists
  if (existsSync(projectDir)) {
    throw new Error(`Directory already exists: ${projectDir}`);
  }

  // Create project directory
  mkdirSync(projectDir, { recursive: true });

  // Write all template files
  const files = getTemplateFiles(options.name);
  for (const file of files) {
    const filePath = join(projectDir, file.path);
    const fileDir = dirname(filePath);

    // Create parent directories
    mkdirSync(fileDir, { recursive: true });

    // Write file
    writeFileSync(filePath, file.content);
  }

  return projectDir;
}

/**
 * Get instructions for after project creation.
 */
export function getPostInitInstructions(projectDir: string, projectName: string): string {
  return `
Project created at: ${projectDir}

Next steps:
  1. cd ${projectName}
  2. npm install
  3. Copy .env.example to .env and add your API keys
  4. npm run eval

For more information, see the documentation at:
  https://github.com/gaojude/eval
`;
}
