# SPEC — space-statusline

> Especificación de producto e implementación. Pensada para que un agente en una
> sesión nueva pueda construir el proyecto sin re-derivar el contexto. Léela junto
> con `CLAUDE.md` (reglas y arranque) y `runtime/statusline.sh` (el estado base).

---

## 1. Resumen ejecutivo

`space-statusline` es una herramienta para **Claude Code** que dibuja un status line
con estética *space-synthwave* ("Outrun Horizon") y, sobre todo, lo hace
**totalmente personalizable mediante un wizard CLI interactivo**.

El usuario corre el wizard, elige tema / secciones / glifos / layout, y la
herramienta deja configurado el status line de Claude Code. No hay que editar bash
a mano.

El proyecto nace de un script bash ya funcional (`runtime/statusline.sh`) que hoy
tiene todos los valores hardcodeados. El objetivo es **parametrizarlo** y construir
el wizard que lo configura.

---

## 2. Origen y estado actual

- Existe un script bash funcional: `runtime/statusline.sh` (copiado tal cual del
  status line que ya usa el autor en `~/.claude/statusline.sh`).
- Dibuja 3 líneas: (1) directorio + git, (2) regla-horizonte con gradiente,
  (3) modelo + barra de contexto + costo + tokens + hora.
- Usa **truecolor 24-bit** y **glifos Nerd Font** (Cascadia Code NF).
- Hoy **todo está hardcodeado**: paleta, secciones, anchos, glifos, formato.
- Lee el JSON que Claude Code entrega por stdin (modelo, cwd, contexto, costo).

**El trabajo es:** mover esos valores hardcodeados a un archivo de configuración,
y construir el wizard Node/TS que genera y edita esa configuración.

---

## 3. Objetivo

1. Que el status line lea su apariencia desde una **config JSON** en runtime.
2. Un **wizard CLI** (Node + TypeScript) que crea/edita esa config de forma
   interactiva y agradable.
3. Integración automática con Claude Code (`settings.json`), reversible.
4. Publicable en **GitHub público** y distribuible vía `pnpm dlx` / instalación global.

---

## 4. Arquitectura

Decisión central: **el runtime sigue siendo bash; el wizard es Node/TS; el puente
es un archivo JSON.**

```
┌─────────────────────┐     escribe      ┌──────────────────────────────┐
│  Wizard CLI (Node)  │  ───────────────▶│  ~/.config/space-statusline/ │
│  @clack/prompts     │                   │      config.json             │
└─────────────────────┘                   └──────────────┬───────────────┘
          │ install                                       │ lee (jq)
          ▼                                                ▼
┌─────────────────────┐    ejecuta en     ┌──────────────────────────────┐
│ ~/.claude/          │   cada render     │  statusline.sh (bash + jq)    │
│ settings.json       │  ───────────────▶ │  dibuja según config          │
│ statusLine.command  │                   └──────────────────────────────┘
└─────────────────────┘
```

**Por qué bash en runtime y no Node:** Claude Code invoca el status line muy
seguido. Arrancar Node en cada render añade ~50-150 ms de cold-start; bash + jq es
casi instantáneo. La lógica de gradientes ya está resuelta en bash. Por eso el
wizard NO reimplementa el render: solo edita el JSON que el bash consume.

> Alternativa descartada: generar un `statusline.sh` distinto desde un template en
> cada cambio. Es más frágil (regenerar código) que leer config en runtime. Si el
> agente encuentra una razón fuerte para reconsiderarlo, debe documentarla y
> consultar antes de cambiar el enfoque.

---

## 5. Componentes

### 5.1 Runtime — `runtime/statusline.sh`

Refactor del script actual para que:

- Cargue `~/.config/space-statusline/config.json` (o `$SPACE_STATUSLINE_CONFIG`).
- Si no hay config, use **defaults embebidos** (el tema Outrun actual) — nunca
  debe romperse por falta de config.
- Parametrice desde la config: gradiente y paleta, secciones habilitadas y su
  orden, glifos, layout (1 línea vs multilínea, anchos, separador, formato de hora,
  uppercase on/off) y los umbrales de color del contexto.
- Mantenga los **fallbacks**: sin `jq` → línea mínima legible; sin Nerd Font →
  modo unicode (según config); sin truecolor → degradado a 256 colores
  (*nice-to-have*, no bloqueante).

### 5.2 Config — `~/.config/space-statusline/config.json`

Ruta XDG. Schema versionado (validar con **zod** en el lado Node). Borrador del
schema (el agente puede refinar nombres, pero este es el contrato base):

```jsonc
{
  "version": 1,
  "theme": {
    "preset": "outrun-horizon",            // nombre de preset o "custom"
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
    "repo": "", "branch": "", "clock": "", "model": "✦",
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

### 5.3 Wizard CLI

Binario `space-statusline`. Comandos:

| Comando | Qué hace |
|---|---|
| `init` | Wizard completo (primera vez) + opción de instalar en Claude Code. |
| `config` | Re-ejecuta el wizard para editar la config existente. |
| `theme [name]` | Cambio rápido de preset sin pasar por todo el wizard. |
| `install` | Conecta el status line a Claude Code (escribe `settings.json`). |
| `uninstall` | Quita la entrada `statusLine` y restaura backup. |
| `preview` | Renderiza con un input JSON mock para ver el resultado. |
| `doctor` | Verifica `jq`, `git`, soporte truecolor y Nerd Font. |

**Flujo del wizard (`@clack/prompts`):**

1. `intro()` con branding.
2. **Tema:** `select` de presets + opción "custom" → si custom, pedir color
   inicio/fin (hex, validados) y derivar la paleta.
3. **Secciones:** `multiselect` de habilitadas → luego definir el **orden** (un
   prompt de orden; clack no tiene drag, resolver con selección iterativa o un
   `text` ordenado validado).
4. **Glifos:** `select` `nerdfont | unicode`; modo avanzado opcional para
   personalizar glifos individuales.
5. **Layout:** multilínea vs 1 línea, anchos (horizonte, barra ctx), separador,
   formato de hora, uppercase on/off.
6. **Preview en vivo:** invocar `runtime/statusline.sh` con la config tentativa y
   un input mock, y mostrar el resultado real antes de confirmar.
7. `outro()` → escribir `config.json` → ofrecer `install`.

### 5.4 Temas / paletas (`src/themes.ts`)

Set de presets como objetos de paleta. Incluir al menos:
`outrun-horizon` (default actual), un `mono`/minimal, y 1-2 alternativos. Cada
preset define gradiente + colores. "custom" se deriva del gradiente que elija el
usuario.

### 5.5 Integración con Claude Code (`src/claude.ts`)

- Localizar `~/.claude/settings.json`.
- **Backup** antes de tocar (`settings.json.bak` con timestamp).
- **Merge seguro:** parsear el JSON, setear solo `statusLine` y reescribir
  preservando TODAS las demás claves. NUNCA sobrescribir el archivo entero.
- **PROHIBIDO** tocar claves de permisos (`permissions`, `defaultMode`,
  `skipAutoPermissionPrompt`, etc.). El instalador solo gestiona `statusLine`.
- Copiar `runtime/statusline.sh` a una ruta estable
  (`~/.config/space-statusline/statusline.sh`) y apuntar `settings.json` ahí, para
  que la ruta no dependa de dónde quedó instalado el paquete npm.
- `uninstall` quita `statusLine` y, si hay backup, lo ofrece.

---

## 6. Stack y dependencias

- **Runtime:** bash 4+, `jq`, `git` (ya presentes en el entorno del autor).
- **Wizard:** Node 24 + TypeScript, gestor **pnpm** (obligatorio — ver CLAUDE.md).
- Librerías sugeridas (verificar API vigente al instalar):
  - `@clack/prompts` — prompts interactivos.
  - `zod` — validación del schema de config.
  - `picocolors` — color en mensajes de la CLI.
- `package.json`: `type: module`, `bin` apuntando al entry compilado, scripts de
  `build`/`dev`/`lint`/`typecheck`.

---

## 7. Estructura propuesta del repo

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
│   ├── cli.ts          # entry: parseo de comandos
│   ├── wizard.ts       # flujo @clack/prompts
│   ├── config.ts       # schema zod, load/save, defaults, ruta XDG
│   ├── themes.ts       # presets de paletas
│   ├── claude.ts       # integración settings.json (merge seguro)
│   └── preview.ts      # invoca el bash con input mock
└── runtime/
    └── statusline.sh   # status line bash (lee config.json)
```

---

## 8. Requisitos funcionales

- **RF1** — El status line lee su apariencia desde `config.json`; sin config usa defaults.
- **RF2** — El wizard permite elegir tema (preset o gradiente custom).
- **RF3** — El wizard permite activar/desactivar y **reordenar** secciones.
- **RF4** — El wizard permite elegir modo de glifos (Nerd Font / Unicode) y
  personalizarlos.
- **RF5** — El wizard permite ajustar layout (líneas, anchos, separador, hora, uppercase).
- **RF6** — Preview en vivo del resultado real antes de guardar.
- **RF7** — `install`/`uninstall` conectan/desconectan de Claude Code de forma
  reversible y sin tocar permisos.
- **RF8** — `doctor` diagnostica el entorno (jq, git, truecolor, Nerd Font).

## 9. Requisitos no funcionales

- **RNF1 (performance)** — El render del status line NO debe arrancar Node. Target
  < 50 ms. Por eso el runtime es bash + jq.
- **RNF2 (robustez)** — Nunca romper la terminal: degradar con fallbacks ante
  ausencia de jq / Nerd Font / truecolor.
- **RNF3 (seguridad)** — El instalador solo gestiona `statusLine` en settings.json,
  con backup; jamás toca permisos ni otras claves.
- **RNF4 (legibilidad)** — Código TS legible, nombres en inglés, comentarios en
  inglés, type hints completos (ver CLAUDE.md).
- **RNF5 (portabilidad)** — Pensado para WSL2 / Linux / macOS con bash 4+.

## 10. Distribución / publicación

- Repo **GitHub público**.
- `gh` **no** está instalado en el entorno → la publicación se hace instalando
  `gh` o creando el repo desde la web + `git remote add`.
- Paquete npm: verificar disponibilidad del nombre `space-statusline` (o usar scope).
  Uso esperado: `pnpm dlx space-statusline init` o `pnpm add -g space-statusline`.
- LICENSE: por defecto MIT (confirmar con el autor).
- **La publicación es el paso final y manual; requiere confirmación explícita del
  autor (no commitear ni publicar sin autorización — ver CLAUDE.md).**

## 11. Roadmap de implementación (por fases)

> El agente debe presentar un PLAN y obtener aprobación antes de codificar
> (regla del autor). Sugerencia de fases:

- **Fase 0 — Scaffold:** `pnpm init`, tsconfig, estructura `src/`, deps base.
- **Fase 1 — Config:** schema zod, defaults, load/save, ruta XDG.
- **Fase 2 — Runtime:** refactor de `statusline.sh` para leer config.json.
- **Fase 3 — Wizard:** `init`/`config` con tema, secciones+orden, glifos, layout, preview.
- **Fase 4 — Claude Code:** `install`/`uninstall` con merge seguro de settings.json.
- **Fase 5 — Aux:** `doctor`, `preview`, `theme`.
- **Fase 6 — Empaquetado:** README real, LICENSE, package.json publish-ready.
- **Fase 7 — Publicación (manual):** repo GitHub público + push + npm. Requiere OK.

## 12. Definition of Done

- [ ] `pnpm install && pnpm build` sin errores; `lint` y `typecheck` limpios.
- [ ] `space-statusline init` configura desde cero y deja el status line funcionando.
- [ ] `space-statusline config` edita una config existente.
- [ ] Cambiar tema/secciones/glifos/layout se refleja en el render real.
- [ ] `install`/`uninstall` son reversibles y respetan el resto de settings.json.
- [ ] Fallbacks verificados (sin jq, sin Nerd Font).
- [ ] README con instalación y uso reales.

## 13. Decisiones tomadas / abiertas

**Tomadas (confirmadas con el autor):**
- Stack del wizard: **Node.js + TypeScript (pnpm)**.
- Alcance de personalización: **completo** (temas, secciones+orden, glifos, layout).
- Destino: **GitHub público**.
- Runtime: **bash** leyendo **config JSON** (XDG).

**A confirmar durante la implementación:**
- Nombre exacto del paquete npm (libre vs scoped) y si se publica a npm o solo GitHub.
- Licencia (default MIT).
- Presets de tema adicionales más allá de `outrun-horizon`.

## 14. Cómo arrancar (para el agente de la sesión nueva)

1. Abrí Claude Code en `~/personal/space-statusline`.
2. Leé `CLAUDE.md` y este `SPEC.md`.
3. Inspeccioná `runtime/statusline.sh` para entender el render actual.
4. Proponé un PLAN por fases (sección 11) y esperá aprobación del autor.
5. Implementá fase por fase, corriendo `lint`/`typecheck` tras cada cambio mayor.
6. No commitear ni publicar sin autorización explícita.
