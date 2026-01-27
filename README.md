# @judegao/eval

Test AI coding agents with real-world tasks in isolated sandboxes.

## Why?

AI coding agents are hard to evaluate. Unit tests don't capture real-world performance. Manual testing doesn't scale. You need a way to:

- Run agents against realistic coding tasks
- Measure pass rates across multiple attempts
- Catch regressions when you change prompts or models
- Compare different models objectively

This framework runs your agent in isolated Vercel sandboxes, gives it a task, and checks if the result passes your test suite.

## Quick Start

```bash
# Create a new eval project
npx @judegao/eval init my-evals
cd my-evals

# Install dependencies
npm install

# Add your API keys
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and VERCEL_TOKEN

# Run evals
npm run eval
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Eval Project                        │
├─────────────────────────────────────────────────────────────┤
│  experiments/                                                │
│    default.ts          ← Experiment config (model, runs)    │
│                                                              │
│  evals/                                                      │
│    add-feature/                                              │
│      PROMPT.md         ← Task description for the agent     │
│      EVAL.ts           ← Test file (vitest) to verify work  │
│      package.json      ← Dependencies for this eval         │
│      src/              ← Starting code (agent modifies this)│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Sandbox (isolated)                 │
├─────────────────────────────────────────────────────────────┤
│  1. Upload starting code (without EVAL.ts)                  │
│  2. Run Claude Code agent with PROMPT.md                    │
│  3. Agent modifies files to complete the task               │
│  4. Upload EVAL.ts and run tests                            │
│  5. Report pass/fail                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Results                              │
├─────────────────────────────────────────────────────────────┤
│  add-feature: 8/10 passed (80%)                             │
│  fix-bug: 10/10 passed (100%)                               │
│  refactor: 6/10 passed (60%)                                │
│                                                              │
│  Overall: 24/30 passed (80%)                                │
└─────────────────────────────────────────────────────────────┘
```

## Creating Evals

Each eval is a folder with:

### PROMPT.md
The task description given to the agent:

```markdown
Add a logout button to the navbar.

Requirements:
- Add a "Logout" button in the top-right corner
- Clicking it should call the `logout()` function from auth.ts
- Button should only appear when user is logged in
```

### EVAL.ts
A vitest test file that verifies the agent's work:

```typescript
import { test, expect } from 'vitest';
import { readFileSync } from 'fs';

test('logout button exists', () => {
  const navbar = readFileSync('src/components/Navbar.tsx', 'utf-8');
  expect(navbar).toContain('Logout');
  expect(navbar).toContain('logout()');
});

test('app still builds', () => {
  execSync('npm run build', { stdio: 'pipe' });
});
```

### package.json
Dependencies needed for the eval (must have `"type": "module"`):

```json
{
  "name": "add-logout-button",
  "type": "module",
  "scripts": { "build": "tsc" },
  "dependencies": { "react": "^18.0.0" }
}
```

### src/
The starting codebase that the agent will modify.

## Experiment Configuration

Create `experiments/default.ts`:

```typescript
import type { ExperimentConfig } from '@judegao/eval';

const config: ExperimentConfig = {
  agent: 'claude-code',

  // Model: 'opus' | 'sonnet' | 'haiku'
  model: 'sonnet',

  // Run each eval 10 times to measure reliability
  runs: 10,

  // Stop after first success (for faster iteration)
  earlyExit: false,

  // Scripts that must pass after agent finishes
  scripts: ['build', 'lint'],

  // Timeout per run in seconds
  timeout: 300,

  // Filter which evals to run
  evals: '*',  // or ['specific-eval'] or (name) => name.startsWith('api-')
};

export default config;
```

## CLI Reference

```bash
# Create new project
agent-eval init <project-name>

# Run evals
agent-eval run experiments/default.ts

# List available evals
agent-eval list
```

### Options

**`--dry`** - Preview what would run without actually executing. Use this to verify your setup before spending API credits:

```bash
agent-eval run experiments/default.ts --dry

# Output:
# Found 3 valid fixture(s), will run 3:
#   - add-feature
#   - fix-bug
#   - refactor
# Running 3 eval(s) x 10 run(s) = 30 total runs
# Model: sonnet, Timeout: 300s
# [DRY RUN] Would execute evals here
```

### Conventions

- Evals live in `evals/`
- Results are saved to `results/`

## Results

Results are saved to `results/<experiment>/<timestamp>/`:

```
results/
  default/
    2024-01-27T10-30-00Z/
      experiment.json      ← Full results with config
      add-feature/
        summary.json       ← Pass rate, mean duration
        run-1/
          result.json      ← Individual run details
        run-2/
          result.json
```

## Environment Variables

```bash
# Required: Anthropic API key for Claude
ANTHROPIC_API_KEY=sk-ant-...

# Required: Vercel access (one of these)
VERCEL_TOKEN=...
VERCEL_OIDC_TOKEN=...
```

## License

MIT
