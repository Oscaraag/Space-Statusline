import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { PRESET_NAMES, presets, type PresetName } from './themes.js';

// ── Schema (mirrors SPEC §5.2) ──────────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const hexColor = z.string().regex(HEX_COLOR, 'Expected a hex color like #RRGGBB');

/** The renderable sections, in their canonical (default) order. */
export const SECTION_KEYS = ['dir', 'git', 'model', 'context', 'cost', 'tokens', 'clock'] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
const sectionKey = z.enum(SECTION_KEYS);

// A theme's `preset` is a built-in name or the synthetic "custom".
const presetOrCustom = [...PRESET_NAMES, 'custom'] as const;

const themeSchema = z.strictObject({
  preset: z.enum(presetOrCustom),
  gradient: z.strictObject({ start: hexColor, end: hexColor }),
  colors: z.strictObject({
    accent: hexColor,
    magenta: hexColor,
    cyan: hexColor,
    green: hexColor,
    amber: hexColor,
    dim: hexColor,
    ctxWarn: hexColor,
    ctxDanger: hexColor,
  }),
});

const sectionsSchema = z.strictObject({
  // `order` is a full permutation of SECTION_KEYS; `enabled` gates visibility.
  // Keeping order total keeps the bash assembler simple.
  order: z
    .array(sectionKey)
    .refine(
      (order) => order.length === SECTION_KEYS.length && new Set(order).size === order.length,
      'order must list each section exactly once',
    ),
  enabled: z.strictObject({
    dir: z.boolean(),
    git: z.boolean(),
    model: z.boolean(),
    context: z.boolean(),
    cost: z.boolean(),
    tokens: z.boolean(),
    clock: z.boolean(),
  }),
});

const glyphsSchema = z.strictObject({
  mode: z.enum(['nerdfont', 'unicode']),
  repo: z.string(),
  branch: z.string(),
  clock: z.string(),
  model: z.string(),
  added: z.string(),
  modified: z.string(),
  ahead: z.string(),
  behind: z.string(),
});

const layoutSchema = z.strictObject({
  lines: z.enum(['multi', 'single']),
  separator: z.string().min(1),
  // Capped: the gradient renders char-by-char, so very wide values hurt the
  // < 50ms render budget (SPEC §9 RNF1).
  horizonWidth: z.int().min(1).max(120),
  ctxBarWidth: z.int().min(1).max(60),
  uppercase: z.boolean(),
  timeFormat: z.string().min(1),
});

const thresholdsSchema = z
  .strictObject({
    ctxWarn: z.int().min(0).max(100),
    ctxDanger: z.int().min(0).max(100),
  })
  .refine((t) => t.ctxDanger >= t.ctxWarn, 'ctxDanger must be >= ctxWarn');

export const configSchema = z.strictObject({
  version: z.literal(1),
  theme: themeSchema,
  sections: sectionsSchema,
  glyphs: glyphsSchema,
  layout: layoutSchema,
  thresholds: thresholdsSchema,
});

export type Config = z.infer<typeof configSchema>;

// ── Defaults (must stay in sync with the embedded defaults in the bash) ──────

export const DEFAULT_PRESET: PresetName = 'outrun-horizon';

/**
 * Nerd Font glyphs (Cascadia Code NF / CaskaydiaCove). The original runtime had
 * lost the repo/branch/clock codepoints (rendered empty); these restore them.
 */
export const NERDFONT_GLYPHS: Config['glyphs'] = {
  mode: 'nerdfont',
  repo: '\u{f07b}', // nf-fa-folder
  branch: '\u{e0a0}', // powerline git branch
  clock: '\u{f017}', // nf-fa-clock_o
  model: '\u{2726}', // ✦
  added: '\u{271a}', // ✚
  modified: '\u{00b1}', // ±
  ahead: '\u{21e1}', // ⇡
  behind: '\u{21e3}', // ⇣
};

/** Plain-Unicode glyphs for terminals without a Nerd Font. */
export const UNICODE_GLYPHS: Config['glyphs'] = {
  mode: 'unicode',
  repo: '\u{25b0}', // ▰
  branch: '\u{2387}', // ⎇
  clock: '\u{25f7}', // ◷
  model: '\u{2726}', // ✦
  added: '\u{271a}', // ✚
  modified: '\u{00b1}', // ±
  ahead: '\u{21e1}', // ⇡
  behind: '\u{21e3}', // ⇣
};

/** A complete, valid default config (the Outrun Horizon look). */
export function getDefaults(): Config {
  return {
    version: 1,
    theme: { preset: DEFAULT_PRESET, ...presets[DEFAULT_PRESET] },
    sections: {
      order: [...SECTION_KEYS],
      enabled: {
        dir: true,
        git: true,
        model: true,
        context: true,
        cost: true,
        tokens: true,
        clock: true,
      },
    },
    glyphs: { ...NERDFONT_GLYPHS },
    layout: {
      lines: 'multi',
      separator: '░', // ░
      horizonWidth: 54,
      ctxBarWidth: 14,
      uppercase: true,
      timeFormat: '%H:%M',
    },
    thresholds: { ctxWarn: 50, ctxDanger: 80 },
  };
}

// ── Paths (XDG) ──────────────────────────────────────────────────────────────

/** Directory that holds config.json and the installed statusline.sh copy. */
export function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, 'space-statusline');
}

/** Resolved config path, honoring the $SPACE_STATUSLINE_CONFIG override. */
export function getConfigPath(): string {
  const override = process.env.SPACE_STATUSLINE_CONFIG;
  if (override && override.length > 0) return override;
  return join(getConfigDir(), 'config.json');
}

// ── Load / save ──────────────────────────────────────────────────────────────

/** Reads and validates the config at `path`. Throws on missing/invalid. */
export function loadConfig(path: string = getConfigPath()): Config {
  const raw = readFileSync(path, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid config at ${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Like loadConfig but returns null when the file does not exist. */
export function tryLoadConfig(path: string = getConfigPath()): Config | null {
  if (!existsSync(path)) return null;
  return loadConfig(path);
}

/** Validates and writes the config as pretty JSON, creating the dir as needed. */
export function saveConfig(config: Config, path: string = getConfigPath()): void {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Refusing to save invalid config:\n${z.prettifyError(result.error)}`);
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(result.data, null, 2) + '\n', 'utf8');
}
