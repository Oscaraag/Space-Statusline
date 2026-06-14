import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';

/**
 * Absolute path to the bundled runtime script. `runtime/` ships next to `dist/`,
 * so from dist/preview.js it is one level up.
 */
export function getRuntimeScriptPath(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'runtime', 'statusline.sh');
}

/** A representative mock of the JSON Claude Code feeds the status line on stdin. */
export function buildMockInput(): string {
  return JSON.stringify({
    model: { display_name: 'Opus 4.1' },
    workspace: { current_dir: process.cwd() },
    context_window: { used_percentage: 58, total_input_tokens: 12000, total_output_tokens: 3400 },
    cost: { total_cost_usd: 1.24 },
  });
}

/**
 * Renders the status line with the given config (or embedded defaults when
 * omitted) by invoking the real bash runtime with a mock stdin payload.
 * Returns the raw ANSI output so callers can print it verbatim.
 */
export function renderPreview(config?: Config, mockInput: string = buildMockInput()): string {
  const env: NodeJS.ProcessEnv = { ...process.env };

  if (config) {
    const dir = mkdtempSync(join(tmpdir(), 'space-statusline-'));
    const configPath = join(dir, 'config.json');
    writeFileSync(configPath, JSON.stringify(config), 'utf8');
    env.SPACE_STATUSLINE_CONFIG = configPath;
  } else {
    // Force the embedded defaults by pointing at a path that does not exist.
    env.SPACE_STATUSLINE_CONFIG = '/nonexistent';
  }

  const result = spawnSync('bash', [getRuntimeScriptPath()], {
    input: mockInput,
    env,
    encoding: 'utf8',
  });
  return result.stdout ?? '';
}
