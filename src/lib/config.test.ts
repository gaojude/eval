import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  resolveConfig,
  resolveEvalNames,
  CONFIG_DEFAULTS,
} from './config.js';

describe('validateConfig', () => {
  it('accepts valid minimal config', () => {
    const config = { agent: 'claude-code' };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('accepts valid full config', () => {
    const config = {
      agent: 'claude-code',
      model: 'opus',
      evals: ['eval-1', 'eval-2'],
      runs: 5,
      earlyExit: false,
      scripts: ['build', 'lint'],
      timeout: 600,
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('accepts string evals filter', () => {
    const config = { agent: 'claude-code', evals: 'my-eval' };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('accepts function evals filter', () => {
    const config = {
      agent: 'claude-code',
      evals: (name: string) => name.startsWith('auth-'),
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('rejects invalid agent', () => {
    const config = { agent: 'invalid-agent' };
    expect(() => validateConfig(config)).toThrow('Invalid experiment configuration');
  });

  it('accepts any model string', () => {
    // Model can be any string - allows custom/future models
    const config = { agent: 'claude-code', model: 'custom-model-v1' };
    const validated = validateConfig(config);
    expect(validated.model).toBe('custom-model-v1');
  });

  it('rejects non-positive runs', () => {
    const config = { agent: 'claude-code', runs: 0 };
    expect(() => validateConfig(config)).toThrow('Invalid experiment configuration');
  });

  it('rejects negative runs', () => {
    const config = { agent: 'claude-code', runs: -1 };
    expect(() => validateConfig(config)).toThrow('Invalid experiment configuration');
  });

  it('rejects non-positive timeout', () => {
    const config = { agent: 'claude-code', timeout: 0 };
    expect(() => validateConfig(config)).toThrow('Invalid experiment configuration');
  });

  it('rejects missing agent', () => {
    const config = { model: 'opus' };
    expect(() => validateConfig(config)).toThrow('Invalid experiment configuration');
  });
});

describe('resolveConfig', () => {
  it('applies defaults for minimal config', () => {
    const config = { agent: 'claude-code' as const };
    const resolved = resolveConfig(config);

    expect(resolved.agent).toBe('claude-code');
    // Default model comes from the agent, not CONFIG_DEFAULTS
    expect(resolved.model).toBe('sonnet');
    expect(resolved.runs).toBe(CONFIG_DEFAULTS.runs);
    expect(resolved.earlyExit).toBe(CONFIG_DEFAULTS.earlyExit);
    expect(resolved.scripts).toEqual(CONFIG_DEFAULTS.scripts);
    expect(resolved.timeout).toBe(CONFIG_DEFAULTS.timeout);
    expect(resolved.evals).toBe('*');
  });

  it('preserves provided values', () => {
    const config = {
      agent: 'claude-code' as const,
      model: 'haiku' as const,
      evals: ['eval-1'],
      runs: 10,
      earlyExit: false,
      scripts: ['test'],
      timeout: 120,
    };
    const resolved = resolveConfig(config);

    expect(resolved.model).toBe('haiku');
    expect(resolved.evals).toEqual(['eval-1']);
    expect(resolved.runs).toBe(10);
    expect(resolved.earlyExit).toBe(false);
    expect(resolved.scripts).toEqual(['test']);
    expect(resolved.timeout).toBe(120);
  });

  it('preserves setup function', () => {
    const setup = async () => {};
    const config = { agent: 'claude-code' as const, setup };
    const resolved = resolveConfig(config);

    expect(resolved.setup).toBe(setup);
  });
});

describe('resolveEvalNames', () => {
  const availableEvals = ['auth-login', 'auth-logout', 'ui-button', 'api-endpoint'];

  it('returns all evals for "*" filter', () => {
    const result = resolveEvalNames('*', availableEvals);
    expect(result).toEqual(availableEvals);
  });

  it('returns single eval for string filter', () => {
    const result = resolveEvalNames('auth-login', availableEvals);
    expect(result).toEqual(['auth-login']);
  });

  it('returns multiple evals for array filter', () => {
    const result = resolveEvalNames(['auth-login', 'ui-button'], availableEvals);
    expect(result).toEqual(['auth-login', 'ui-button']);
  });

  it('filters evals with function', () => {
    const result = resolveEvalNames((name) => name.startsWith('auth-'), availableEvals);
    expect(result).toEqual(['auth-login', 'auth-logout']);
  });

  it('throws for non-existent single eval', () => {
    expect(() => resolveEvalNames('non-existent', availableEvals)).toThrow(
      'Eval "non-existent" not found'
    );
  });

  it('throws for non-existent eval in array', () => {
    expect(() => resolveEvalNames(['auth-login', 'non-existent'], availableEvals)).toThrow(
      'Evals not found: non-existent'
    );
  });

  it('returns empty array when function matches nothing', () => {
    const result = resolveEvalNames((name) => name.startsWith('xyz-'), availableEvals);
    expect(result).toEqual([]);
  });
});
