# space-statusline

Un status line **space-synthwave** ("Outrun Horizon") para
[Claude Code](https://claude.com/claude-code), **configurable mediante un wizard CLI**.

El render corre en **bash** (rápido, sin cold-start) · la configuración se hace en
**Node + TypeScript** · **truecolor 24-bit** · glifos **Nerd Font** con fallback Unicode.

## Cómo se ve

Tres líneas (en modo `multi`, el default):

1. Directorio + estado de git (rama, archivos nuevos/modificados, ahead/behind).
2. Regla-horizonte con gradiente synthwave.
3. Modelo · barra de contexto · costo · tokens · hora.

También hay un modo de **una sola línea** (`single`).

## Requisitos

- [Claude Code](https://claude.com/claude-code).
- `bash` 4+, `jq` y `git` para el render (el wizard necesita Node ≥ 20).
- Una **Nerd Font** (p. ej. Cascadia Code NF) y una terminal con **truecolor** para la
  estética completa. Hay fallbacks: sin `jq` cae a una línea mínima; con glifos
  Unicode no hace falta Nerd Font; sin truecolor degrada a 256 colores.

## Instalación

Una vez publicado en npm:

```bash
pnpm dlx space-statusline init      # wizard + opción de instalar en Claude Code
# o instalación global:
pnpm add -g space-statusline && space-statusline init
```

Desde el código (mientras tanto):

```bash
git clone <repo> && cd space-statusline
pnpm install && pnpm build
node dist/cli.js init
```

El wizard escribe la config y ofrece **instalarse en Claude Code** (gestiona solo la
clave `statusLine` de `~/.claude/settings.json`, con backup; nunca toca permisos).

## Uso

| Comando | Qué hace |
|---|---|
| `init` | Wizard completo (tema, secciones, glifos, layout, preview) + opción de instalar. |
| `config` | Re-ejecuta el wizard para editar la config existente. |
| `theme <name>` | Cambio rápido de preset: `outrun-horizon`, `sunset`, `vaporwave`, `mono`. |
| `install` | Conecta el status line a Claude Code (merge seguro de `settings.json`). |
| `uninstall` | Quita la entrada `statusLine` (deja un backup). |
| `preview` | Renderiza con un input de ejemplo para ver el resultado. |
| `doctor` | Verifica `jq`, `git`, soporte truecolor y Nerd Font. |

## Configuración

La config vive en `~/.config/space-statusline/config.json` (ruta XDG; se puede
sobrescribir con `$SPACE_STATUSLINE_CONFIG`). El schema se valida con `zod` y permite
ajustar:

- **Tema** — preset o gradiente custom (start/end en hex) + paleta de colores.
- **Secciones** — cuáles mostrar (`dir`, `git`, `model`, `context`, `cost`, `tokens`,
  `clock`) y en qué orden.
- **Glifos** — `nerdfont` o `unicode`, personalizables.
- **Layout** — `multi`/`single`, separador, ancho del horizonte y de la barra de
  contexto, uppercase, formato de hora (strftime).
- **Umbrales** — porcentajes de contexto para los colores de aviso/peligro.

El bash lee ese JSON en cada render; si falta o es inválido, usa defaults embebidos.

## Temas

`outrun-horizon` (default, violeta→magenta) · `sunset` (cálido, naranja→rosa) ·
`vaporwave` (frío, cian→violeta) · `mono` (minimal, grises). Más `custom` desde el
wizard.

## Terminal recomendada (Windows Terminal)

Para que el gradiente y los glifos se vean como en la captura, usá
**CaskaydiaCove Nerd Font** y el esquema de color **Outrun Horizon**.

1. Agregá este esquema en `settings.json` de Windows Terminal, dentro de `"schemes"`:

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

2. Aplicalo en `"defaults"` (afecta a todos los perfiles) o en un perfil puntual:

```json
"defaults": {
  "colorScheme": "Outrun Horizon",
  "font": { "face": "CaskaydiaCove Nerd Font", "size": 11 },
  "opacity": 92,
  "useAcrylic": true
}
```

## Cómo funciona

El render se mantiene en **bash + jq** porque Claude Code lo invoca muy seguido y
arrancar Node en cada render añadiría cold-start. El wizard (Node/TS) **no
reimplementa el render**: solo edita la config JSON que el bash consume. El puente
entre ambos es ese archivo. El render apunta a < 50 ms.

## Desarrollo

```bash
pnpm install
pnpm build       # tsc -> dist/
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint
```

Probar el runtime directamente:

```bash
echo '{"model":{"display_name":"Opus 4.1"},"workspace":{"current_dir":"'"$PWD"'"},"context_window":{"used_percentage":58},"cost":{"total_cost_usd":1.24}}' | bash runtime/statusline.sh
```

## Licencia

MIT — ver [`LICENSE`](./LICENSE).
