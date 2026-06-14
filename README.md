# space-statusline

A **space-synthwave** ("Outrun Horizon") status line for
[Claude Code](https://claude.com/claude-code), **configured through a CLI wizard**.

Rendering runs in **bash** (fast, no cold-start) · configuration is done in
**Node + TypeScript** · **24-bit truecolor** · **Nerd Font** glyphs with a Unicode
fallback.

## What it looks like

Three lines (in `multi` mode, the default):

1. Directory + git status (branch, new/modified files, ahead/behind).
2. A horizon rule with a synthwave gradient.
3. Model · context bar · cost · tokens · clock.

There is also a **single-line** mode (`single`).

## Requirements

- [Claude Code](https://claude.com/claude-code).
- `bash` 4+, `jq`, and `git` for rendering (the wizard needs Node ≥ 20).
- A **Nerd Font** (e.g. Cascadia Code NF) and a **truecolor** terminal for the full
  look. Fallbacks exist: without `jq` it drops to a minimal line; with Unicode glyphs
  no Nerd Font is needed; without truecolor it degrades to 256 colors.

## Installation

From npm:

```bash
pnpm dlx space-statusline init      # wizard + option to install into Claude Code
# or install globally:
pnpm add -g space-statusline && space-statusline init
```

From source:

```bash
git clone https://github.com/Oscaraag/Space-Statusline.git && cd Space-Statusline
pnpm install && pnpm build
node dist/cli.js init
```

The wizard writes the config and offers to **install itself into Claude Code** (it only
manages the `statusLine` key of `~/.claude/settings.json`, with a backup; it never
touches permission keys).

## Usage

| Command | What it does |
|---|---|
| `init` | Full wizard (theme, sections, glyphs, layout, preview) + option to install. |
| `config` | Re-runs the wizard to edit the existing config. |
| `theme <name>` | Quick preset switch: `outrun-horizon`, `sunset`, `vaporwave`, `mono`. |
| `install` | Connects the status line to Claude Code (safe merge of `settings.json`). |
| `uninstall` | Removes the `statusLine` entry (leaves a backup). |
| `preview` | Renders with sample input so you can see the result. |
| `doctor` | Checks `jq`, `git`, truecolor support, and Nerd Font. |

## Configuration

The config lives at `~/.config/space-statusline/config.json` (XDG path; overridable with
`$SPACE_STATUSLINE_CONFIG`). The schema is validated with `zod` and lets you tune:

- **Theme** — a preset or a custom gradient (start/end hex) plus the color palette.
- **Sections** — which to show (`dir`, `git`, `model`, `context`, `cost`, `tokens`,
  `clock`) and in what order.
- **Glyphs** — `nerdfont` or `unicode`, customizable.
- **Layout** — `multi`/`single`, separator, horizon and context-bar widths, uppercase,
  clock format (strftime).
- **Thresholds** — context percentages for the warn/danger colors.

The bash runtime reads that JSON on every render; if it is missing or invalid, it falls
back to embedded defaults.

## Themes

`outrun-horizon` (default, violet→magenta) · `sunset` (warm, orange→pink) ·
`vaporwave` (cool, cyan→violet) · `mono` (minimal, greys). Plus `custom` from the wizard.

## Recommended terminal (Windows Terminal)

To get the gradient and glyphs looking their best, use **CaskaydiaCove Nerd Font** and
the **Outrun Horizon** color scheme.

1. Add this scheme to Windows Terminal's `settings.json`, inside `"schemes"`:

```json
{
  "name": "Outrun Horizon",
  "background": "#0D0A17",
  "foreground": "#E7DEFB",
  "cursorColor": "#FF6CF0",
  "selectionBackground": "#7A3CFF",
  "black":   "#1A1622",
  "red":     "#FF5FB4",
  "green":   "#62E6B0",
  "yellow":  "#FFB86B",
  "blue":    "#A96BFF",
  "purple":  "#FF6CF0",
  "cyan":    "#4BE4E8",
  "white":   "#E7DEFB",
  "brightBlack":  "#5C5181",
  "brightRed":    "#FF7AC0",
  "brightGreen":  "#7DF5C4",
  "brightYellow": "#FFC98A",
  "brightBlue":   "#C08BFF",
  "brightPurple": "#FF8FF4",
  "brightCyan":   "#74EEF1",
  "brightWhite":  "#FFFFFF"
}
```

2. Apply it in `"defaults"` (affects every profile) or in a single profile:

```json
"defaults": {
  "colorScheme": "Outrun Horizon",
  "font": { "face": "CaskaydiaCove Nerd Font", "size": 11 },
  "opacity": 92,
  "useAcrylic": true
}
```

## How it works

Rendering stays in **bash + jq** because Claude Code invokes it very often and starting
Node on every render would add cold-start latency. The wizard (Node/TS) **does not
reimplement rendering**: it only edits the JSON config that bash consumes. That file is
the bridge between the two. The render targets < 50 ms.

## Development

```bash
pnpm install
pnpm build       # tsc -> dist/
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```

Run the runtime directly:

```bash
echo '{"model":{"display_name":"Opus 4.1"},"workspace":{"current_dir":"'"$PWD"'"},"context_window":{"used_percentage":58},"cost":{"total_cost_usd":1.24}}' | bash runtime/statusline.sh
```

## License

MIT — see [`LICENSE`](./LICENSE).
