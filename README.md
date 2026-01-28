# @judegao/eval

Test AI coding agents on your framework. Measure what actually works.

## Why?

You're building a frontend framework and want AI agents to work well with it. But how do you know if:
- Your documentation helps agents write correct code?
- Adding an MCP server improves agent success rates?
- Sonnet performs as well as Opus for your use cases?
- Your latest API changes broke agent compatibility?

**This framework gives you answers.** Run controlled experiments, measure pass rates, compare techniques.

## Quick Start

```bash
# Create a new eval project
npx @judegao/eval init my-framework-evals
cd my-framework-evals

# Install dependencies
npm install

# Add your API keys
cp .env.example .env
# Edit .env with your AI_GATEWAY_API_KEY and VERCEL_TOKEN

# Preview what will run (no API calls, no cost)
npx agent-eval cc --dry

# Run the evals
npx agent-eval cc
```

## A/B Testing AI Techniques

The real power is comparing different approaches. Create multiple experiment configs:

### Control: Baseline Agent

```typescript
// experiments/control.ts
import type { ExperimentConfig } from '@judegao/eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/claude-code',
  model: 'opus',
  runs: 10,        // Multiple runs for statistical significance
  earlyExit: false, // Run all attempts to measure reliability
};

export default config;
```

### Treatment: Agent with MCP Server

```typescript
// experiments/with-mcp.ts
import type { ExperimentConfig } from '@judegao/eval';

const config: ExperimentConfig = {
  agent: 'vercel-ai-gateway/claude-code',
  model: 'opus',
  runs: 10,
  earlyExit: false,

  setup: async (sandbox) => {
    // Install your framework's MCP server
    await sandbox.runCommand('npm', ['install', '-g', '@myframework/mcp-server']);

    // Configure Claude to use it
    await sandbox.writeFiles({
      '.claude/settings.json': JSON.stringify({
        mcpServers: {
          myframework: { command: 'myframework-mcp' }
        }
      })
    });
  },
};

export default config;
```

### Run Both & Compare

```bash
# Preview first
npx agent-eval control --dry
npx agent-eval with-mcp --dry

# Run experiments
npx agent-eval control
npx agent-eval with-mcp
```

**Compare results:**
```
Control (baseline):     7/10 passed (70%)
With MCP:              9/10 passed (90%)
```

## Creating Evals for Your Framework

Each eval tests one specific task an agent should be able to do with your framework.

### Example: Testing Component Creation

```
evals/
  create-button-component/
    PROMPT.md           # Task for the agent
    EVAL.ts             # Tests to verify success
    package.json        # Your framework as a dependency
    src/                # Starter code
```

**PROMPT.md** - What you want the agent to do:
```markdown
Create a Button component using MyFramework.

Requirements:
- Export a Button component from src/components/Button.tsx
- Accept `label` and `onClick` props
- Use the framework's styling system for hover states
```

**EVAL.ts** - How you verify it worked:
```typescript
import { test, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

test('Button component exists', () => {
  expect(existsSync('src/components/Button.tsx')).toBe(true);
});

test('has required props', () => {
  const content = readFileSync('src/components/Button.tsx', 'utf-8');
  expect(content).toContain('label');
  expect(content).toContain('onClick');
});

test('project builds', () => {
  execSync('npm run build', { stdio: 'pipe' });
});
```

**package.json** - Include your framework:
```json
{
  "name": "create-button-component",
  "type": "module",
  "scripts": { "build": "tsc" },
  "dependencies": {
    "myframework": "^2.0.0"
  }
}
```

## Experiment Ideas

| Experiment | Control | Treatment |
|------------|---------|-----------|
| MCP impact | No MCP | With MCP server |
| Model comparison | Haiku | Sonnet / Opus |
| Documentation | Minimal docs | Rich examples |
| System prompt | Default | Framework-specific |
| Tool availability | Read/write only | + custom tools |

## Configuration Reference

### Agent Selection

Choose your agent and authentication method:

```typescript
// Vercel AI Gateway (recommended - unified billing & observability)
agent: 'vercel-ai-gateway/claude-code'  // or 'vercel-ai-gateway/codex'

// Direct API (uses provider keys directly)
agent: 'claude-code'  // requires ANTHROPIC_API_KEY
agent: 'codex'        // requires OPENAI_API_KEY
```

See the Environment Variables section below for setup instructions.

### Full Configuration

```typescript
import type { ExperimentConfig } from '@judegao/eval';

const config: ExperimentConfig = {
  // Required: which agent and authentication to use
  agent: 'vercel-ai-gateway/claude-code',

  // Model to use (defaults: 'opus' for claude-code, 'openai/gpt-5.2-codex' for codex)
  model: 'opus',

  // How many times to run each eval
  runs: 10,

  // Stop after first success? (false for reliability measurement)
  earlyExit: false,

  // npm scripts that must pass after agent finishes
  scripts: ['build', 'lint'],

  // Timeout per run in seconds
  timeout: 300,

  // Filter which evals to run
  evals: '*',                              // all
  evals: ['specific-eval'],                // by name
  evals: (name) => name.startsWith('api-'), // by function

  // Setup function for environment configuration
  setup: async (sandbox) => {
    await sandbox.writeFiles({ '.env': 'API_KEY=test' });
    await sandbox.runCommand('npm', ['run', 'setup']);
  },
};

export default config;
```

## CLI Commands

### `init <name>`

Create a new eval project:
```bash
npx @judegao/eval init my-evals
```

### `<experiment>`

Run an experiment:
```bash
npx agent-eval cc
```

**Dry run** - preview without executing (no API calls, no cost):
```bash
npx agent-eval cc --dry

# Output:
# Found 5 valid fixture(s), will run 5:
#   - create-button
#   - add-routing
#   - setup-state
#   - ...
# Running 5 eval(s) x 10 run(s) = 50 total runs
# Agent: claude-code, Model: opus, Timeout: 300s
# [DRY RUN] Would execute evals here
```

## Results

Results are saved to `results/<experiment>/<timestamp>/`:

```
results/
  with-mcp/
    2026-01-27T10-30-00Z/
      experiment.json       # Config and summary
      create-button/
        summary.json        # { totalRuns: 10, passedRuns: 9, passRate: "90%" }
        run-1/
          result.json       # Individual run result
          transcript.jsonl  # Agent conversation
          outputs/          # Test/script output
```

### Analyzing Results

```bash
# Quick comparison
cat results/control/*/experiment.json | jq '.evals[] | {name, passRate}'
cat results/with-mcp/*/experiment.json | jq '.evals[] | {name, passRate}'
```

| Pass Rate | Interpretation |
|-----------|----------------|
| 90-100%   | Agent handles this reliably |
| 70-89%    | Usually works, room for improvement |
| 50-69%    | Unreliable, needs investigation |
| < 50%     | Task too hard or prompt needs work |

## Environment Variables

### Vercel AI Gateway (Recommended)

The default authentication method uses Vercel AI Gateway for unified billing and observability:

```bash
# Required: Vercel AI Gateway API key
# Get yours at: https://vercel.com/dashboard -> AI Gateway
AI_GATEWAY_API_KEY=your-ai-gateway-api-key

# Required: Vercel sandbox access (for running agent code)
# Create at: https://vercel.com/account/tokens
VERCEL_TOKEN=...
# OR (for CI/CD pipelines)
VERCEL_OIDC_TOKEN=...
```

Benefits:
- Single API key for Claude Code, Codex, and 200+ other models
- Unified billing - one invoice instead of multiple provider accounts
- Observability - request traces and spend tracking in Vercel dashboard
- Automatic fallbacks - resilience when providers have issues

### Direct API Keys (Alternative)

You can also use provider API keys directly by removing the `vercel-ai-gateway/` prefix:

```bash
# For agent: 'claude-code'
ANTHROPIC_API_KEY=sk-ant-...

# For agent: 'codex'
OPENAI_API_KEY=sk-proj-...

# Still required for sandbox
VERCEL_TOKEN=...  # or VERCEL_OIDC_TOKEN
```

## Tips

**Start with `--dry`**: Always preview before running to verify your config and avoid unexpected costs.

**Use multiple runs**: Single runs don't tell you reliability. Use `runs: 10` and `earlyExit: false` for meaningful data.

**Isolate variables**: Change one thing at a time between experiments. Don't compare "Opus with MCP" to "Haiku without MCP".

**Test incrementally**: Start with simple tasks, add complexity as you learn what works.

## License

MIT
