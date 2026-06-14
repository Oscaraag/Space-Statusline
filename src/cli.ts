#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pc from 'picocolors';
import * as p from '@clack/prompts';
import { getConfigPath, getDefaults, saveConfig, tryLoadConfig } from './config.js';
import { PRESET_NAMES, presets, type PresetName } from './themes.js';
import { runWizard } from './wizard.js';
import { install, uninstall } from './claude.js';
import { renderPreview } from './preview.js';
import { runDoctor } from './doctor.js';

/** A subcommand handler. Receives the argv tail after the command name. */
type Command = (args: string[]) => Promise<void> | void;

/** Reads this package's version from package.json (one level above dist/). */
function readVersion(): string {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version: string };
  return pkg.version;
}

/** `init`: run the full wizard from scratch (pre-filled if a config exists). */
async function runInit(): Promise<void> {
  const existing = tryLoadConfig();
  const config = await runWizard(existing);
  if (!config) return;
  const path = getConfigPath();
  saveConfig(config, path);

  const wantsInstall = await p.confirm({ message: 'Install into Claude Code now?', initialValue: true });
  if (p.isCancel(wantsInstall) || !wantsInstall) {
    p.outro(`${pc.green('Saved')} ${pc.dim(path)}\n  Run ${pc.cyan('space-statusline install')} when you're ready.`);
    return;
  }
  const result = install();
  p.outro(
    `${pc.green('Installed.')} ${pc.dim(result.settingsPath)}` +
      (result.backupPath ? `\n  Backup: ${pc.dim(result.backupPath)}` : ''),
  );
}

/** `install`: connect the status line to Claude Code (safe merge of settings.json). */
function runInstall(): void {
  const result = install();
  console.log(pc.green('Installed.'));
  console.log(`  Script:   ${pc.dim(result.scriptPath)}`);
  console.log(`  Settings: ${pc.dim(result.settingsPath)}`);
  if (result.backupPath) console.log(`  Backup:   ${pc.dim(result.backupPath)}`);
}

/** `uninstall`: remove the statusLine entry, preserving everything else. */
function runUninstall(): void {
  const result = uninstall();
  if (!result.hadStatusLine) {
    console.log(pc.yellow('No statusLine entry found — nothing to remove.'));
    return;
  }
  console.log(pc.green('Uninstalled the statusLine entry.'));
  if (result.backupPath) {
    console.log(`  A backup of your previous settings is at ${pc.dim(result.backupPath)}`);
  }
}

/** `config`: edit an existing config (errors if there is none yet). */
async function runConfig(): Promise<void> {
  const existing = tryLoadConfig();
  if (!existing) {
    console.error(pc.yellow(`No config found at ${getConfigPath()}.`));
    console.error(`Run ${pc.cyan('space-statusline init')} first.`);
    process.exitCode = 1;
    return;
  }
  const config = await runWizard(existing);
  if (!config) return;
  const path = getConfigPath();
  saveConfig(config, path);
  p.outro(`${pc.green('Saved')} ${pc.dim(path)}`);
}

/** `theme [name]`: quickly switch to a preset without the full wizard. */
function runTheme(args: string[]): void {
  const name = args[0];
  const valid = PRESET_NAMES as readonly string[];
  if (!name || !valid.includes(name)) {
    console.error(name ? pc.red(`Unknown theme: ${name}`) : pc.yellow('Usage: space-statusline theme <name>'));
    console.error(`Available: ${PRESET_NAMES.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  const config = tryLoadConfig() ?? getDefaults();
  const preset = name as PresetName;
  config.theme = { preset, ...presets[preset] };
  const path = getConfigPath();
  saveConfig(config, path);
  console.log(`${pc.green('Theme set to')} ${pc.magenta(name)} ${pc.dim('— ' + path)}`);
}

/** `preview`: render the current config (or defaults) with mock input. */
function runPreview(): void {
  const config = tryLoadConfig() ?? undefined;
  process.stdout.write(renderPreview(config));
  process.stdout.write('\n');
}

const commands: Record<string, Command> = {
  init: runInit,
  config: runConfig,
  theme: runTheme,
  install: runInstall,
  uninstall: runUninstall,
  preview: runPreview,
  doctor: runDoctor,
};

function printHelp(): void {
  const title = pc.magenta(pc.bold('space-statusline'));
  console.log(`
${title} — synthwave status line for Claude Code

${pc.bold('Usage:')} space-statusline <command> [options]

${pc.bold('Commands:')}
  ${pc.cyan('init')}        Run the full wizard and optionally install into Claude Code
  ${pc.cyan('config')}      Re-run the wizard to edit the existing config
  ${pc.cyan('theme')} ${pc.dim('[name]')}  Quickly switch to a preset theme
  ${pc.cyan('install')}     Connect the status line to Claude Code (settings.json)
  ${pc.cyan('uninstall')}   Remove the status line entry and offer to restore a backup
  ${pc.cyan('preview')}     Render with mock input to preview the result
  ${pc.cyan('doctor')}      Check the environment (jq, git, truecolor, Nerd Font)

${pc.bold('Options:')}
  -h, --help     Show this help
  -v, --version  Show the version
`);
}

async function main(): Promise<void> {
  const [, , command, ...rest] = process.argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }
  if (command === 'version' || command === '--version' || command === '-v') {
    console.log(readVersion());
    return;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(pc.red(`Unknown command: ${command}`));
    printHelp();
    process.exitCode = 1;
    return;
  }

  await handler(rest);
}

main().catch((error: unknown) => {
  console.error(pc.red(error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
