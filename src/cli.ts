#!/usr/bin/env node

/**
 * CLI entry point for the eval framework.
 */

import { Command } from 'commander';
import { config as dotenvConfig } from 'dotenv';
import { resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
import chalk from 'chalk';
import { loadConfig, resolveEvalNames } from './lib/config.js';
import { loadAllFixtures } from './lib/fixture.js';
import { runExperiment } from './lib/runner.js';
import { initProject, getPostInitInstructions } from './lib/init.js';

// Load environment variables
dotenvConfig();

const program = new Command();

program
  .name('agent-eval')
  .description('Framework for testing AI coding agents in isolated sandboxes')
  .version('0.1.0');

/**
 * init command - Create a new eval project
 */
program
  .command('init')
  .argument('<name>', 'Name of the project to create')
  .description('Create a new eval project with example fixtures')
  .action(async (name: string) => {
    try {
      console.log(chalk.blue(`Creating new eval project: ${name}`));

      const projectDir = initProject({
        name,
        targetDir: process.cwd(),
      });

      console.log(chalk.green('Project created successfully!'));
      console.log(getPostInitInstructions(projectDir, name));
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      } else {
        console.error(chalk.red('An unknown error occurred'));
      }
      process.exit(1);
    }
  });

/**
 * run command - Run experiments
 */
program
  .command('run')
  .argument('<config>', 'Path to experiment configuration file')
  .option('--dry', 'Preview what would run without executing')
  .description('Run an experiment')
  .action(async (configPath: string, options) => {
    try {
      const absoluteConfigPath = resolve(process.cwd(), configPath);

      if (!existsSync(absoluteConfigPath)) {
        console.error(chalk.red(`Config file not found: ${absoluteConfigPath}`));
        process.exit(1);
      }

      console.log(chalk.blue(`Loading config from ${configPath}...`));
      const config = await loadConfig(absoluteConfigPath);

      // Discover evals
      const evalsDir = resolve(process.cwd(), 'evals');
      if (!existsSync(evalsDir)) {
        console.error(chalk.red(`Evals directory not found: ${evalsDir}`));
        process.exit(1);
      }

      console.log(chalk.blue(`Discovering evals in ${evalsDir}...`));
      const { fixtures, errors } = loadAllFixtures(evalsDir);

      if (errors.length > 0) {
        console.log(chalk.yellow(`\nWarning: ${errors.length} invalid fixture(s):`));
        for (const error of errors) {
          console.log(chalk.yellow(`  - ${error.fixtureName}: ${error.message}`));
        }
      }

      if (fixtures.length === 0) {
        console.error(chalk.red('No valid eval fixtures found'));
        process.exit(1);
      }

      // Resolve which evals to run
      const availableNames = fixtures.map((f) => f.name);
      const evalNames = resolveEvalNames(config.evals, availableNames);

      if (evalNames.length === 0) {
        console.error(chalk.red('No evals matched the filter'));
        process.exit(1);
      }

      console.log(chalk.green(`\nFound ${fixtures.length} valid fixture(s), will run ${evalNames.length}:`));
      for (const name of evalNames) {
        console.log(chalk.green(`  - ${name}`));
      }

      console.log(chalk.blue(`\nRunning ${evalNames.length} eval(s) x ${config.runs} run(s) = ${evalNames.length * config.runs} total runs`));
      console.log(chalk.blue(`Model: ${config.model}, Timeout: ${config.timeout}s, Early Exit: ${config.earlyExit}`));

      if (options.dry) {
        console.log(chalk.yellow('\n[DRY RUN] Would execute evals here'));
        return;
      }

      // Check for required API key
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.error(chalk.red('ANTHROPIC_API_KEY environment variable is required'));
        process.exit(1);
      }

      // Filter fixtures to only the ones we want to run
      const selectedFixtures = fixtures.filter((f) => evalNames.includes(f.name));

      // Get experiment name from config file
      const experimentName = basename(configPath, '.ts').replace(/\.js$/, '');
      const resultsDir = resolve(process.cwd(), 'results');

      console.log(chalk.blue('\nStarting experiment...'));

      // Run the experiment
      const results = await runExperiment({
        config,
        fixtures: selectedFixtures,
        apiKey,
        resultsDir,
        experimentName,
        onProgress: (msg) => console.log(msg),
      });

      // Exit with appropriate code
      const allPassed = results.evals.every((e) => e.passedRuns === e.totalRuns);
      process.exit(allPassed ? 0 : 1);
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      } else {
        console.error(chalk.red('An unknown error occurred'));
      }
      process.exit(1);
    }
  });

/**
 * list command - List available evals
 */
program
  .command('list')
  .description('List available eval fixtures')
  .action(async () => {
    try {
      const evalsDir = resolve(process.cwd(), 'evals');

      if (!existsSync(evalsDir)) {
        console.error(chalk.red(`Evals directory not found: ${evalsDir}`));
        process.exit(1);
      }

      const { fixtures, errors } = loadAllFixtures(evalsDir);

      if (fixtures.length > 0) {
        console.log(chalk.green(`\nValid eval fixtures (${fixtures.length}):`));
        for (const fixture of fixtures) {
          const promptPreview = fixture.prompt.slice(0, 60).replace(/\n/g, ' ');
          console.log(chalk.green(`  ${fixture.name}`));
          console.log(chalk.gray(`    ${promptPreview}${fixture.prompt.length > 60 ? '...' : ''}`));
        }
      }

      if (errors.length > 0) {
        console.log(chalk.yellow(`\nInvalid fixtures (${errors.length}):`));
        for (const error of errors) {
          console.log(chalk.yellow(`  ${error.fixtureName}: ${error.message}`));
        }
      }

      if (fixtures.length === 0 && errors.length === 0) {
        console.log(chalk.gray('No eval fixtures found'));
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`Error: ${error.message}`));
      }
      process.exit(1);
    }
  });

program.parse();
