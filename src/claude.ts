import { copyFileSync, chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { getConfigDir } from './config.js';
import { getRuntimeScriptPath } from './preview.js';

/**
 * Keys the installer must NEVER create, change, or remove. The merge only ever
 * touches `statusLine`; this list is asserted before/after as defense in depth
 * (SPEC §5.5, §9 RNF3).
 */
const PROTECTED_KEYS = ['permissions', 'defaultMode', 'skipAutoPermissionPrompt'] as const;

/** A minimal view of the settings we care about; all other keys pass through. */
interface ClaudeSettings {
  statusLine?: { type: string; command: string; padding?: number };
  [key: string]: unknown;
}

export function getClaudeDir(): string {
  return join(homedir(), '.claude');
}

export function getClaudeSettingsPath(): string {
  return join(getClaudeDir(), 'settings.json');
}

/** Stable location the runtime script is copied to, independent of the npm install dir. */
export function getInstalledScriptPath(): string {
  return join(getConfigDir(), 'statusline.sh');
}

interface InstallResult {
  settingsPath: string;
  scriptPath: string;
  backupPath: string | null;
}

interface UninstallResult {
  settingsPath: string;
  backupPath: string | null;
  hadStatusLine: boolean;
}

/** Parses settings.json, returning {} if it does not exist. Throws on invalid JSON. */
function readSettings(path: string): ClaudeSettings {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf8');
  if (raw.trim().length === 0) return {};
  try {
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    throw new Error(
      `${path} is not valid JSON. Refusing to touch it — fix or remove it first.`,
    );
  }
}

/** Snapshot of the protected keys, used to assert they are never modified. */
function snapshotProtected(settings: ClaudeSettings): string {
  const subset: Record<string, unknown> = {};
  for (const key of PROTECTED_KEYS) {
    if (key in settings) subset[key] = settings[key];
  }
  return JSON.stringify(subset);
}

/** Backs up an existing settings.json to a timestamped sibling. Returns its path. */
function backupSettings(path: string): string | null {
  if (!existsSync(path)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${path}.bak.${stamp}`;
  copyFileSync(path, backupPath);
  return backupPath;
}

/** Serializes and writes settings as pretty JSON with a trailing newline. */
function writeSettings(path: string, settings: ClaudeSettings): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

/**
 * Copies the runtime script to a stable path and points Claude Code's
 * `statusLine` at it, preserving every other settings key. Backs up first.
 */
export function install(): InstallResult {
  const scriptPath = getInstalledScriptPath();
  mkdirSync(dirname(scriptPath), { recursive: true });
  copyFileSync(getRuntimeScriptPath(), scriptPath);
  chmodSync(scriptPath, 0o755);

  const settingsPath = getClaudeSettingsPath();
  const settings = readSettings(settingsPath);
  const before = snapshotProtected(settings);

  const backupPath = backupSettings(settingsPath);

  // Touch ONLY statusLine; every other key is preserved by reference.
  settings.statusLine = { type: 'command', command: `bash ${scriptPath}` };

  assertProtectedUnchanged(before, settings, settingsPath);
  writeSettings(settingsPath, settings);

  return { settingsPath, scriptPath, backupPath };
}

/** Removes the `statusLine` key, preserving everything else. Backs up first. */
export function uninstall(): UninstallResult {
  const settingsPath = getClaudeSettingsPath();
  const settings = readSettings(settingsPath);
  const hadStatusLine = 'statusLine' in settings;
  const before = snapshotProtected(settings);

  if (!hadStatusLine) {
    return { settingsPath, backupPath: null, hadStatusLine: false };
  }

  const backupPath = backupSettings(settingsPath);
  delete settings.statusLine;

  assertProtectedUnchanged(before, settings, settingsPath);
  writeSettings(settingsPath, settings);

  return { settingsPath, backupPath, hadStatusLine: true };
}

/** Throws if any protected key changed between the snapshot and now. */
function assertProtectedUnchanged(before: string, settings: ClaudeSettings, path: string): void {
  if (snapshotProtected(settings) !== before) {
    throw new Error(`Aborted: a protected key would have changed in ${path}. No write performed.`);
  }
}
