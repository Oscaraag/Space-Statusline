# CLAUDE.md — space-statusline

Context and rules for working in this repo. Read alongside `SPEC.md`.

## What this project is

A tool for **Claude Code** that draws a synthwave status line ("Outrun Horizon")
that is **configurable through a CLI wizard**. Rendering runs in **bash** (fast, no
cold-start); the wizard is **Node + TypeScript** and edits a **JSON config**. See the
full architecture in `SPEC.md` (section 4).

The runtime (`runtime/statusline.sh`) reads its appearance from
`~/.config/space-statusline/config.json`, falling back to embedded defaults when the
config is missing or invalid.

## Working rules (inherited from the author's global config)

- **Language:** ALWAYS reply to the author in **Spanish**. Code comments in
  **English**. Technical explanations in Spanish.
- **Package manager:** ALWAYS use **`pnpm`**. Never `npm` or `yarn` (applies to
  install, run, add, remove, dlx, scripts).
- **TypeScript:** variable/function names in English; **complete type
  hints/annotations**; optimize for **readability**.
- **Workflow:** create a PLAN and get approval before coding. Run `lint`/`typecheck`
  after every significant change.
- **No commits or publishing without the author's explicit authorization.**
- **No dummy / placeholder / fake code:** everything must be functional and real.
- When unsure about an external library's API, verify the current syntax (web).
- Ask before assuming when something is unclear.

## Project-specific rules

- **Runtime performance:** the status line renders very often. Do NOT start Node in
  the render path. Keep bash + jq. Target < 50 ms. (SPEC §9 RNF1.)
- **Safety when integrating with Claude Code:** the installer only manages the
  `statusLine` key in `~/.claude/settings.json`, with a prior **backup** and a **safe
  merge** (preserving the rest of the JSON). It is **FORBIDDEN** to touch permission
  keys (`permissions`, `defaultMode`, `skipAutoPermissionPrompt`). (SPEC §5.5, §9 RNF3.)
- **Mandatory fallbacks:** without `jq`, without a Nerd Font, or without truecolor, the
  status line must degrade without breaking the terminal. (SPEC §9 RNF2.)
- The config lives at `~/.config/space-statusline/config.json` (XDG). The schema is
  validated with `zod`.

## CLI commands

`init` · `config` · `theme [name]` · `install` · `uninstall` · `preview` · `doctor`
(details in SPEC §5.3).
