# SPEC — space-statusline

> Product and implementation specification. Written so an agent in a fresh session
> can build the project without re-deriving the context. Read it alongside
> `CLAUDE.md` (rules and onboarding) and `runtime/statusline.sh` (the base state).

---

## 1. Executive summary

`space-statusline` is a tool for **Claude Code** that draws a status line with a
*space-synthwave* aesthetic ("Outrun Horizon") and, above all, makes it **fully
customizable through an interactive CLI wizard**.

The user runs the wizard, picks theme / sections / glyphs / layout, and the tool
configures Claude Code's status line. No editing bash by hand.

The project grew out of an already-working bash script (`runtime/statusline.sh`) that
had everything hardcoded. The goal is to **parameterize it** and build the wizard that
configures it.

---

## 2. Origin and current state

- A working bash script exists: `runtime/statusline.sh` (copied as-is from the status
  line the author already used at `~/.claude/statusline.sh`).
- It draws 3 lines: (1) directory + git, (2) horizon rule with a gradient,
  (3) model + context bar + cost + tokens + clock.
- It uses **24-bit truecolor** and **Nerd Font** glyphs (Cascadia Code NF).
- Originally **everything was hardcoded**: palette, sections, widths, glyphs, format.
- It reads the JSON Claude Code provides over stdin (model, cwd, context, cost).

**The work is:** move those hardcoded values into a configuration file, and build the
Node/TS wizard that generates and edits that configuration.

---

## 3. Goal

1. The status line reads its appearance from a **JSON config** at runtime.
2. A **CLI wizard** (Node + TypeScript) that creates/edits that config interactively
   and pleasantly.
3. Automatic, reversible integration with Claude Code (`settings.json`).
4. Publishable on **public GitHub** and distributable via `pnpm dlx` / global install.

---

## 4. Architecture

Central decision: **the runtime stays bash; the wizard is Node/TS; the bridge is a
JSON file.**

```
┌─────────────────────┐     writes       ┌──────────────────────────────┐
│  CLI Wizard (Node)  │  ───────────────▶│  ~/.config/space-statusline/ │
│  @clack/prompts     │                   │      config.json             │
└─────────────────────┘                   └──────────────┬───────────────┘
          │ install                                       │ reads (jq)
          ▼                                                ▼
┌─────────────────────┐    runs on        ┌──────────────────────────────┐
│ ~/.claude/          │   every render    │  statusline.sh (bash + jq)    │
│ settings.json       │  ───────────────▶ │  draws according to config    │
│ statusLine.command  │                   └──────────────────────────────┘
└─────────────────────┘
```

**Why bash at runtime and not Node:** Claude Code invokes the status line very often.
Starting Node on every render adds ~50-150 ms of cold-start; bash + jq is nearly
instant. The gradient logic is already solved in bash. That is why the wizard does NOT
reimplement rendering: it only edits the JSON that bash consumes.

> Discarded alternative: generating a different `statusline.sh` from a template on
> every change. That is more fragile (regenerating code) than reading config at
> runtime. If the agent finds a strong reason to reconsider it, they should document it
> and ask before changing the approach.

---

## 5. Components

### 5.1 Runtime — `runtime/statusline.sh`

Refactor of the current script so that it:

- Loads `~/.config/space-statusline/config.json` (or `$SPACE_STATUSLINE_CONFIG`).
- If there is no config, uses **embedded defaults** (the current Outrun theme) — it
  must never break for lack of config.
- Parameterizes from the config: gradient and palette, enabled sections and their
  order, glyphs, layout (1 line vs multi-line, widths, separator, time format,
  uppercase on/off) and the context color thresholds.
- Keeps the **fallbacks**: no `jq` → minimal readable line; no Nerd Font → unicode mode
  (per config); no truecolor → degrade to 256 colors (*nice-to-have*, not blocking).

### 5.2 Config — `~/.config/space-statusline/config.json`

XDG path. Versioned schema (validated with **zod** on the Node side). Draft of the
schema (the agent may refine names, but this is the base contract):

```jsonc
{
  "version": 1,
  "theme": {
    "preset": "outrun-horizon",            // preset name or "custom"
    "gradient": { "start": "#7A3CFF", "end": "#FF6CF0" },
    "colors": {
      "accent":   "#A96BFF",
      "magenta":  "#FF6CF0",
      "cyan":     "#4BE4E8",
      "green":    "#62E6B0",
      "amber":    "#FFB86B",
      "dim":      "#5C5180",
      "ctxWarn":  "#FFB86B",
      "ctxDanger":"#FF5F8C"
    }
  },
  "sections": {
    "order":   ["dir", "git", "model", "context", "cost", "tokens", "clock"],
    "enabled": { "dir": true, "git": true, "model": true, "context": true,
                 "cost": true, "tokens": true, "clock": true }
  },
  "glyphs": {
    "mode": "nerdfont",                      // "nerdfont" | "unicode"
    "repo": "", "branch": "", "clock": "", "model": "✦",
    "added": "✚", "modified": "±", "ahead": "⇡", "behind": "⇣"
  },
  "layout": {
    "lines": "multi",                        // "multi" | "single"
    "separator": "░",
    "horizonWidth": 46,
    "ctxBarWidth": 14,
    "uppercase": true,
    "timeFormat": "%H:%M"
  },
  "thresholds": { "ctxWarn": 50, "ctxDanger": 80 }
}
```

### 5.3 CLI wizard

Binary `space-statusline`. Commands:

| Command | What it does |
|---|---|
| `init` | Full wizard (first time) + option to install into Claude Code. |
| `config` | Re-runs the wizard to edit the existing config. |
| `theme [name]` | Quick preset switch without going through the whole wizard. |
| `install` | Connects the status line to Claude Code (writes `settings.json`). |
| `uninstall` | Removes the `statusLine` entry and restores a backup. |
| `preview` | Renders with a mock JSON input to see the result. |
| `doctor` | Checks `jq`, `git`, truecolor support, and Nerd Font. |

**Wizard flow (`@clack/prompts`):**

1. `intro()` with branding.
2. **Theme:** `select` of presets + "custom" option → if custom, ask for start/end
   color (hex, validated) and derive the palette.
3. **Sections:** `multiselect` of enabled ones → then define the **order** (one order
   prompt; clack has no drag — solve with iterative selection or a validated ordered
   `text`).
4. **Glyphs:** `select` `nerdfont | unicode`; optional advanced mode to customize
   individual glyphs.
5. **Layout:** multi-line vs 1 line, widths (horizon, ctx bar), separator, time format,
   uppercase on/off.
6. **Live preview:** invoke `runtime/statusline.sh` with the tentative config and a mock
   input, and show the real result before confirming.
7. `outro()` → write `config.json` → offer to `install`.

### 5.4 Themes / palettes (`src/themes.ts`)

A set of presets as palette objects. Include at least:
`outrun-horizon` (current default), a `mono`/minimal, and 1-2 alternatives. Each preset
defines a gradient + colors. "custom" is derived from the gradient the user chooses.

### 5.5 Claude Code integration (`src/claude.ts`)

- Locate `~/.claude/settings.json`.
- **Backup** before touching it (`settings.json.bak` with timestamp).
- **Safe merge:** parse the JSON, set only `statusLine` and rewrite preserving ALL
  other keys. NEVER overwrite the whole file.
- It is **FORBIDDEN** to touch permission keys (`permissions`, `defaultMode`,
  `skipAutoPermissionPrompt`, etc.). The installer only manages `statusLine`.
- Copy `runtime/statusline.sh` to a stable path
  (`~/.config/space-statusline/statusline.sh`) and point `settings.json` there, so the
  path does not depend on where the npm package landed.
- `uninstall` removes `statusLine` and, if there is a backup, offers it.

---

## 6. Stack and dependencies

- **Runtime:** bash 4+, `jq`, `git` (already present in the author's environment).
- **Wizard:** Node 24 + TypeScript, package manager **pnpm** (mandatory — see CLAUDE.md).
- Suggested libraries (verify the current API on install):
  - `@clack/prompts` — interactive prompts.
  - `zod` — config schema validation.
  - `picocolors` — color in CLI messages.
- `package.json`: `type: module`, `bin` pointing to the compiled entry, scripts for
  `build`/`dev`/`lint`/`typecheck`.

---

## 7. Proposed repo structure

```
space-statusline/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── CLAUDE.md
├── SPEC.md
├── .gitignore
├── src/
│   ├── cli.ts          # entry: command parsing
│   ├── wizard.ts       # @clack/prompts flow
│   ├── config.ts       # zod schema, load/save, defaults, XDG path
│   ├── themes.ts       # palette presets
│   ├── claude.ts       # settings.json integration (safe merge)
│   └── preview.ts      # invokes the bash with mock input
└── runtime/
    └── statusline.sh   # bash status line (reads config.json)
```

---

## 8. Functional requirements

- **FR1** — The status line reads its appearance from `config.json`; without config it
  uses defaults.
- **FR2** — The wizard lets you choose a theme (preset or custom gradient).
- **FR3** — The wizard lets you enable/disable and **reorder** sections.
- **FR4** — The wizard lets you choose the glyph mode (Nerd Font / Unicode) and
  customize them.
- **FR5** — The wizard lets you adjust layout (lines, widths, separator, time,
  uppercase).
- **FR6** — Live preview of the real result before saving.
- **FR7** — `install`/`uninstall` connect/disconnect from Claude Code reversibly and
  without touching permissions.
- **FR8** — `doctor` diagnoses the environment (jq, git, truecolor, Nerd Font).

## 9. Non-functional requirements

- **NFR1 (performance)** — The status line render must NOT start Node. Target < 50 ms.
  That is why the runtime is bash + jq.
- **NFR2 (robustness)** — Never break the terminal: degrade with fallbacks when jq /
  Nerd Font / truecolor are missing.
- **NFR3 (security)** — The installer only manages `statusLine` in settings.json, with a
  backup; it never touches permissions or other keys.
- **NFR4 (readability)** — Readable TS code, names in English, comments in English,
  complete type hints (see CLAUDE.md).
- **NFR5 (portability)** — Designed for WSL2 / Linux / macOS with bash 4+.

## 10. Distribution / publishing

- **Public GitHub** repo.
- `gh` is **not** installed in the environment → publishing is done by installing `gh`
  or creating the repo from the web + `git remote add`.
- npm package: check availability of the name `space-statusline` (or use a scope).
  Expected usage: `pnpm dlx space-statusline init` or `pnpm add -g space-statusline`.
- LICENSE: MIT by default (confirm with the author).
- **Publishing is the final, manual step; it requires the author's explicit
  authorization (do not commit or publish without authorization — see CLAUDE.md).**

## 11. Implementation roadmap (by phases)

> The agent must present a PLAN and get approval before coding (author's rule).
> Suggested phases:

- **Phase 0 — Scaffold:** `pnpm init`, tsconfig, `src/` structure, base deps.
- **Phase 1 — Config:** zod schema, defaults, load/save, XDG path.
- **Phase 2 — Runtime:** refactor `statusline.sh` to read config.json.
- **Phase 3 — Wizard:** `init`/`config` with theme, sections+order, glyphs, layout,
  preview.
- **Phase 4 — Claude Code:** `install`/`uninstall` with a safe merge of settings.json.
- **Phase 5 — Aux:** `doctor`, `preview`, `theme`.
- **Phase 6 — Packaging:** real README, LICENSE, publish-ready package.json.
- **Phase 7 — Publishing (manual):** public GitHub repo + push + npm. Requires OK.

## 12. Definition of Done

- [ ] `pnpm install && pnpm build` with no errors; `lint` and `typecheck` clean.
- [ ] `space-statusline init` configures from scratch and leaves the status line working.
- [ ] `space-statusline config` edits an existing config.
- [ ] Changing theme/sections/glyphs/layout is reflected in the real render.
- [ ] `install`/`uninstall` are reversible and respect the rest of settings.json.
- [ ] Fallbacks verified (no jq, no Nerd Font).
- [ ] README with real installation and usage.

## 13. Decisions made / open

**Made (confirmed with the author):**
- Wizard stack: **Node.js + TypeScript (pnpm)**.
- Customization scope: **complete** (themes, sections+order, glyphs, layout).
- Target: **public GitHub**.
- Runtime: **bash** reading a **JSON config** (XDG).

**To confirm during implementation:**
- Exact npm package name (unscoped vs scoped) and whether it publishes to npm or only
  GitHub.
- License (default MIT).
- Additional theme presets beyond `outrun-horizon`.

## 14. How to start (for the fresh-session agent)

1. Open Claude Code in `~/personal/space-statusline`.
2. Read `CLAUDE.md` and this `SPEC.md`.
3. Inspect `runtime/statusline.sh` to understand the current render.
4. Propose a PLAN by phases (section 11) and wait for the author's approval.
5. Implement phase by phase, running `lint`/`typecheck` after each major change.
6. Do not commit or publish without explicit authorization.
