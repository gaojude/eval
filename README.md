# @judegao/eval

Test AI coding agents with real-world tasks in isolated sandboxes.

## Why?

You just spent 3 hours testing your agent manually. It works great! But then you:
- Update a system prompt → agent breaks on 20% of tasks
- Switch from Opus to Haiku → silent regression in complex tasks
- Add a new tool → existing tasks fail in unexpected ways

**This framework prevents that.** Run your agent against real tasks, measure pass rates, catch regressions automatically.

## Quick Start

**Requirements:** Node.js 18+

```bash
# Create a new eval project
npx @judegao/eval init my-evals
cd my-evals

# Install dependencies
npm install

# Add your API keys (see Environment Variables below)
cp .env.example .env
# Edit .env with your ANTHROPIC_API_KEY and VERCEL_TOKEN

# Run evals
npm run eval
```

**Expected output:**
```
Running add-greeting [1/1]...
✓ add-greeting [1/1] (42.3s)

Experiment Results
────────────────────────────────────────────────────────────
✓ add-greeting: 1/1 passed (100%)
  Mean duration: 42.3s

Overall: 1/1 passed (100%)
```

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Eval Project                       │
├─────────────────────────────────────────────────────────────┤
│  experiments/                                               │
│    default.ts          ← Experiment config (model, runs)    │
│                                                             │
│  evals/                                                     │
│    add-feature/                                             │
│      PROMPT.md         ← Task description for the agent     │
│      EVAL.ts           ← Test file (vitest) to verify work  │
│      package.json      ← Dependencies for this eval         │
│      src/              ← Starting code (agent modifies this)│
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vercel Sandbox (isolated VM)             │
├─────────────────────────────────────────────────────────────┤
│  1. Upload starting code (agent can't see EVAL.ts)          │
│  2. Run setup function (if configured)                      │
│  3. Install dependencies (npm install)                      │
│  4. Run Claude Code agent with PROMPT.md                    │
│  5. Agent modifies files to complete the task               │
│  6. Upload EVAL.ts (now), run tests + scripts               │
│  7. Report pass/fail                                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         Results                             │
├─────────────────────────────────────────────────────────────┤
│  add-feature: 8/10 passed (80%)                             │
│  fix-bug: 10/10 passed (100%)                               │
│  refactor: 6/10 passed (60%)                                │
│                                                             │
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
import { execSync } from 'child_process';

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
Dependencies needed for the eval. **Must have `"type": "module"`** (required):

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
  model: 'sonnet',
  runs: 5,
  earlyExit: false,
  scripts: ['build'],
  timeout: 300,
};

export default config;
```

### Configuration Defaults

| Option      | Default        | Description                                      |
|-------------|----------------|--------------------------------------------------|
| `agent`     | —              | **Required.** Only `'claude-code'` supported     |
| `model`     | `'opus'`       | Claude model: `'opus'`, `'sonnet'`, or `'haiku'` |
| `evals`     | `'*'`          | Run all evals, or filter with array/function     |
| `runs`      | `1`            | Number of times to run each eval                 |
| `earlyExit` | `true`         | Stop after first successful run                  |
| `scripts`   | `[]`           | npm scripts to run after agent (tests always run)|
| `timeout`   | `300`          | Seconds per run (5 minutes)                      |
| `setup`     | —              | Optional setup function (see below)              |

### Model Selection

| Model  | Best For                        | Cost (input/output per MTok) |
|--------|---------------------------------|------------------------------|
| `opus` | Complex tasks, highest quality  | $15 / $75                    |
| `sonnet`| Balanced performance and cost  | $3 / $15                     |
| `haiku`| Fast iteration, simple tasks    | $0.25 / $1.25                |

### Filtering Evals

```typescript
// Run all evals
evals: '*',

// Run specific evals
evals: ['add-feature', 'fix-bug'],

// Run evals matching a pattern
evals: (name) => name.startsWith('api-'),
```

### Setup Function

Run custom initialization before the agent starts:

```typescript
import type { ExperimentConfig } from '@judegao/eval';

const config: ExperimentConfig = {
  agent: 'claude-code',

  setup: async (sandbox) => {
    // Write environment files
    await sandbox.writeFiles({
      '.env': 'DATABASE_URL=postgres://localhost/test'
    });

    // Run setup commands
    await sandbox.runCommand('npm', ['run', 'seed']);

    // Read files if needed
    const pkg = await sandbox.readFile('package.json');
  },
};

export default config;
```

The `sandbox` object provides:
- `writeFiles(files)` - Write multiple files
- `runCommand(cmd, args)` - Run a command
- `readFile(path)` - Read a file
- `getWorkingDirectory()` - Get working directory path

## CLI Reference

### `agent-eval init <name>`

Create a new eval project with example fixtures.

```bash
npx @judegao/eval init my-evals
```

### `agent-eval run <config>`

Run an experiment.

```bash
agent-eval run experiments/default.ts
```

**Options:**
- `--dry` - Preview what would run without executing (no API calls, no cost)

```bash
agent-eval run experiments/default.ts --dry

# Output:
# Found 3 valid fixture(s), will run 3:
#   - add-feature
#   - fix-bug
#   - refactor
# Running 3 eval(s) x 5 run(s) = 15 total runs
# Model: sonnet, Timeout: 300s, Early Exit: false
# [DRY RUN] Would execute evals here
```

**Exit codes:**
- `0` - All evals passed (useful for CI/CD)
- `1` - One or more evals failed

### `agent-eval list`

List all available eval fixtures.

```bash
agent-eval list
```

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

### Interpreting Results

| Pass Rate | Meaning                                          |
|-----------|--------------------------------------------------|
| 100%      | Excellent! Agent is reliable for this task.      |
| 80-99%    | Good. Minor improvements possible.               |
| 50-79%    | Needs work. Review prompt or task complexity.    |
| < 50%     | Task too hard or prompt needs significant work.  |

### Debugging Failed Runs

Check `results/<experiment>/<timestamp>/<eval>/run-N/result.json`:

```json
{
  "status": "failed",
  "failedStep": "tests",
  "error": "Test failed: expected 'Logout' to be in navbar",
  "duration": 45.2,
  "testOutput": "...",
  "scriptResults": [...]
}
```

- `failedStep`: Where it failed — `setup`, `agent`, `scripts`, or `tests`
- `error`: Error message
- `testOutput`: Full vitest output
- `scriptResults`: Output from each npm script

## Cost Estimation

Costs depend on model choice and task complexity:

| Model  | Typical Task | 10-run Eval |
|--------|--------------|-------------|
| Haiku  | $0.10-0.50   | $1-5        |
| Sonnet | $0.50-2.00   | $5-20       |
| Opus   | $2.00-10.00  | $20-100     |

**Tips to reduce costs:**
- Use `--dry` to preview before running
- Use `earlyExit: true` during development
- Start with Haiku, upgrade only for complex tasks
- Filter to specific evals: `evals: ['one-eval']`

## Environment Variables

```bash
# Required: Anthropic API key for Claude
# Get yours at: https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-...

# Required: Vercel access (pick one)
# Create a token at: https://vercel.com/account/tokens
VERCEL_TOKEN=...        # Personal access token
# OR
VERCEL_OIDC_TOKEN=...   # OIDC token (for CI/CD pipelines)
```

## Troubleshooting

### "ANTHROPIC_API_KEY environment variable is required"
Create a `.env` file in your project root with your API key.

### "Evals directory not found"
Run `agent-eval` from your project root (where `evals/` exists).

### "package.json must have type: module"
Add `"type": "module"` to your eval's package.json.

### Tests pass locally but fail in sandbox
The agent doesn't see `EVAL.ts` or `PROMPT.md` — only your source files. Make sure your tests only reference files the agent can modify.

### "npm install failed"
Check that your eval's package.json has valid dependencies compatible with Node 20+.

## Best Practices

### Writing Good Prompts
- **Be specific:** "Add a blue logout button in the top-right corner" not "add a button"
- **List requirements:** Clear acceptance criteria
- **Mention context:** Reference existing files/functions the agent should use

### Writing Good Tests
- **Test behavior:** Check that logout works, not that specific code exists
- **Always test the build:** Include a compilation/build test
- **Keep tests fast:** Seconds, not minutes

### Organizing Evals
- **One task per eval:** Don't combine multiple features
- **Name clearly:** `add-auth-button` not `test-1`
- **Progressive complexity:** Start simple, add harder evals as agent improves

## License

MIT
