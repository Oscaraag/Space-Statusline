// Theme presets. A preset defines only the color identity of the status line:
// the synthwave gradient (used for the horizon rule, the dir name and the
// context bar) plus the semantic palette. Everything else (sections, glyphs,
// layout, thresholds) lives in the config-level defaults in config.ts.

/** Gradient endpoints, as #RRGGBB hex strings. */
export interface GradientStops {
  start: string;
  end: string;
}

/** Semantic color slots, as #RRGGBB hex strings. */
export interface Palette {
  accent: string;
  magenta: string;
  cyan: string;
  green: string;
  amber: string;
  dim: string;
  ctxWarn: string;
  ctxDanger: string;
}

/** The color-only part of a theme that a preset provides. */
export interface ThemePalette {
  gradient: GradientStops;
  colors: Palette;
}

/** Names of the built-in presets (excludes the synthetic "custom"). */
export const PRESET_NAMES = ['outrun-horizon', 'sunset', 'vaporwave', 'mono'] as const;
export type PresetName = (typeof PRESET_NAMES)[number];

/** Built-in palettes. `outrun-horizon` is the default and matches the runtime. */
export const presets: Record<PresetName, ThemePalette> = {
  // The original synthwave look: violet → magenta horizon.
  'outrun-horizon': {
    gradient: { start: '#7A3CFF', end: '#FF6CF0' },
    colors: {
      accent: '#A96BFF',
      magenta: '#FF6CF0',
      cyan: '#4BE4E8',
      green: '#62E6B0',
      amber: '#FFB86B',
      dim: '#5C5180',
      ctxWarn: '#FFB86B',
      ctxDanger: '#FF5F8C',
    },
  },
  // Warm dusk: orange → hot pink.
  sunset: {
    gradient: { start: '#FF7A3C', end: '#FF3CA8' },
    colors: {
      accent: '#FFA552',
      magenta: '#FF5FA0',
      cyan: '#FFC27A',
      green: '#7BD88F',
      amber: '#FFB86B',
      dim: '#6B5560',
      ctxWarn: '#FFB86B',
      ctxDanger: '#FF4D6D',
    },
  },
  // Cool vaporwave: cyan → violet.
  vaporwave: {
    gradient: { start: '#2BD9FF', end: '#9A6BFF' },
    colors: {
      accent: '#6CC0FF',
      magenta: '#C77DFF',
      cyan: '#4BE4E8',
      green: '#5BE8C2',
      amber: '#8AB6FF',
      dim: '#46557F',
      ctxWarn: '#FFD27A',
      ctxDanger: '#FF6B9D',
    },
  },
  // Minimal monochrome: low-chroma greys with a single soft accent.
  mono: {
    gradient: { start: '#6E7488', end: '#C2C7D6' },
    colors: {
      accent: '#C2C7D6',
      magenta: '#AEB3C2',
      cyan: '#9AA0B3',
      green: '#A8B6A0',
      amber: '#C9BD93',
      dim: '#4A4E5A',
      ctxWarn: '#C9BD93',
      ctxDanger: '#D88A8A',
    },
  },
};
