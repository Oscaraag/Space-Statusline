import * as p from '@clack/prompts';
import pc from 'picocolors';
import {
  type Config,
  type SectionKey,
  SECTION_KEYS,
  NERDFONT_GLYPHS,
  UNICODE_GLYPHS,
  getDefaults,
  configSchema,
} from './config.js';
import { PRESET_NAMES, presets, type PresetName } from './themes.js';
import { renderPreview } from './preview.js';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Aborts the wizard cleanly if the user cancels a prompt (Ctrl-C / Esc). */
function requireValue<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Wizard cancelled — no changes were made.');
    process.exit(0);
  }
  return value;
}

/** Human-readable label for each section, shown in the multiselect. */
const SECTION_LABELS: Record<SectionKey, string> = {
  dir: 'Directory name',
  git: 'Git branch & status',
  model: 'Model name',
  context: 'Context usage bar',
  cost: 'Session cost',
  tokens: 'Token count',
  clock: 'Clock',
};

/**
 * Runs the interactive wizard. `existing` pre-fills answers when editing an
 * existing config; pass null for a from-scratch run. Returns the validated
 * config, or null if the user chose not to save at the preview step.
 */
export async function runWizard(existing: Config | null): Promise<Config | null> {
  const base = existing ?? getDefaults();

  p.intro(pc.magenta(pc.bold('space-statusline')) + pc.dim('  ·  synthwave status line'));

  // ── 1. Theme ───────────────────────────────────────────────────────────────
  const presetChoice = requireValue(
    await p.select<PresetName | 'custom'>({
      message: 'Theme',
      initialValue: base.theme.preset,
      options: [
        ...PRESET_NAMES.map((name) => ({
          value: name,
          label: name,
          hint: name === 'outrun-horizon' ? 'default' : undefined,
        })),
        { value: 'custom' as const, label: 'custom', hint: 'pick your own gradient' },
      ],
    }),
  );

  let theme: Config['theme'];
  if (presetChoice === 'custom') {
    const start = requireValue(
      await p.text({
        message: 'Gradient start color (hex)',
        placeholder: '#7A3CFF',
        initialValue: base.theme.gradient.start,
        validate: (v) => (HEX_COLOR.test(v ?? '') ? undefined : 'Use a hex color like #7A3CFF'),
      }),
    );
    const end = requireValue(
      await p.text({
        message: 'Gradient end color (hex)',
        placeholder: '#FF6CF0',
        initialValue: base.theme.gradient.end,
        validate: (v) => (HEX_COLOR.test(v ?? '') ? undefined : 'Use a hex color like #FF6CF0'),
      }),
    );
    // Derive a palette: gradient endpoints drive accent/magenta, the rest keeps
    // the proven Outrun semantic colors so git/context stay legible.
    const fallback = presets['outrun-horizon'].colors;
    theme = {
      preset: 'custom',
      gradient: { start, end },
      colors: { ...fallback, accent: start, magenta: end },
    };
  } else {
    theme = { preset: presetChoice, ...presets[presetChoice] };
  }

  // ── 2. Sections: which are enabled, then their order ─────────────────────────
  const enabledList = requireValue(
    await p.multiselect<SectionKey>({
      message: 'Sections to show',
      options: SECTION_KEYS.map((key) => ({ value: key, label: SECTION_LABELS[key] })),
      initialValues: SECTION_KEYS.filter((k) => base.sections.enabled[k]),
      required: true,
    }),
  );

  const orderInput = requireValue(
    await p.text({
      message: 'Section order (comma-separated, all sections)',
      placeholder: SECTION_KEYS.join(', '),
      initialValue: base.sections.order.join(', '),
      validate: (v) => {
        const items = (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
        const valid = new Set<string>(SECTION_KEYS);
        if (items.length !== SECTION_KEYS.length) return `List all ${SECTION_KEYS.length} sections exactly once`;
        if (new Set(items).size !== items.length) return 'No duplicates allowed';
        for (const it of items) if (!valid.has(it)) return `Unknown section: ${it}`;
        return undefined;
      },
    }),
  );
  const order = orderInput.split(',').map((s) => s.trim()).filter(Boolean) as SectionKey[];
  const enabledSet = new Set(enabledList);
  const enabled = Object.fromEntries(
    SECTION_KEYS.map((k) => [k, enabledSet.has(k)]),
  ) as Config['sections']['enabled'];

  // ── 3. Glyphs ────────────────────────────────────────────────────────────────
  const glyphMode = requireValue(
    await p.select<'nerdfont' | 'unicode'>({
      message: 'Glyph set',
      initialValue: base.glyphs.mode,
      options: [
        { value: 'nerdfont', label: 'Nerd Font', hint: 'needs a patched font (e.g. Cascadia Code NF)' },
        { value: 'unicode', label: 'Unicode', hint: 'works without a Nerd Font' },
      ],
    }),
  );
  let glyphs: Config['glyphs'] = glyphMode === 'nerdfont' ? { ...NERDFONT_GLYPHS } : { ...UNICODE_GLYPHS };

  const customizeGlyphs = requireValue(
    await p.confirm({ message: 'Customize individual glyphs?', initialValue: false }),
  );
  if (customizeGlyphs) {
    const keys: Array<keyof Pick<Config['glyphs'], 'repo' | 'branch' | 'clock' | 'model'>> = [
      'repo',
      'branch',
      'clock',
      'model',
    ];
    for (const key of keys) {
      const value = requireValue(
        await p.text({
          message: `Glyph for ${key}`,
          initialValue: glyphs[key],
        }),
      );
      glyphs = { ...glyphs, [key]: value };
    }
  }

  // ── 4. Layout ──────────────────────────────────────────────────────────────
  const lines = requireValue(
    await p.select<'multi' | 'single'>({
      message: 'Layout',
      initialValue: base.layout.lines,
      options: [
        { value: 'multi', label: 'Multi-line', hint: 'directory · horizon · metrics' },
        { value: 'single', label: 'Single line' },
      ],
    }),
  );
  const separator = requireValue(
    await p.text({
      message: 'Section separator',
      initialValue: base.layout.separator,
      validate: (v) => ((v ?? '').length >= 1 ? undefined : 'Separator cannot be empty'),
    }),
  );
  const horizonWidth = requireValue(
    await p.text({
      message: 'Horizon width (1–120)',
      initialValue: String(base.layout.horizonWidth),
      validate: (v) => validateInt(v ?? '', 1, 120),
    }),
  );
  const ctxBarWidth = requireValue(
    await p.text({
      message: 'Context bar width (1–60)',
      initialValue: String(base.layout.ctxBarWidth),
      validate: (v) => validateInt(v ?? '', 1, 60),
    }),
  );
  const uppercase = requireValue(
    await p.confirm({ message: 'Uppercase labels?', initialValue: base.layout.uppercase }),
  );
  const timeFormat = requireValue(
    await p.text({
      message: 'Clock format (strftime)',
      initialValue: base.layout.timeFormat,
      validate: (v) => ((v ?? '').length >= 1 ? undefined : 'Format cannot be empty'),
    }),
  );

  const layout: Config['layout'] = {
    lines,
    separator,
    horizonWidth: Number(horizonWidth),
    ctxBarWidth: Number(ctxBarWidth),
    uppercase,
    timeFormat,
  };

  // ── Assemble & validate ──────────────────────────────────────────────────────
  const candidate: Config = {
    version: 1,
    theme,
    sections: { order, enabled },
    glyphs,
    layout,
    thresholds: base.thresholds,
  };

  const parsed = configSchema.safeParse(candidate);
  if (!parsed.success) {
    p.cancel('Internal error: built an invalid config. Please report this.');
    process.exit(1);
  }
  const config = parsed.data;

  // ── 5. Live preview + confirm ────────────────────────────────────────────────
  p.note(renderPreview(config), 'Preview');

  const save = requireValue(
    await p.confirm({ message: 'Save this configuration?', initialValue: true }),
  );
  if (!save) {
    p.outro(pc.dim('Nothing saved.'));
    return null;
  }

  return config;
}

/** Validator: an integer within [min, max]. Returns an error string or undefined. */
function validateInt(value: string, min: number, max: number): string | undefined {
  const n = Number(value);
  if (!Number.isInteger(n)) return 'Enter a whole number';
  if (n < min || n > max) return `Must be between ${min} and ${max}`;
  return undefined;
}
