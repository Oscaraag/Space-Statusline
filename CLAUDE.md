# CLAUDE.md — space-statusline

Contexto y reglas para trabajar en este repo. Leer junto con `SPEC.md`.

## Qué es este proyecto

Una herramienta para **Claude Code** que dibuja un status line synthwave
("Outrun Horizon") **configurable mediante un wizard CLI**. El render corre en
**bash** (rápido, sin cold-start); el wizard es **Node + TypeScript** y edita una
**config JSON**. Ver arquitectura completa en `SPEC.md` (sección 4).

Estado actual: existe `runtime/statusline.sh` funcional pero con todo hardcodeado.
El trabajo es parametrizarlo y construir el wizard que lo configura.

## Punto de entrada para implementar

1. Leer `SPEC.md` completo (es el contrato).
2. Inspeccionar `runtime/statusline.sh`.
3. Proponer un PLAN por fases (SPEC §11) y **obtener aprobación antes de codificar**.
4. Implementar fase por fase.

## Reglas de trabajo (heredadas de la config global del autor)

- **Idioma:** responder al autor SIEMPRE en **español**. Comentarios de código en
  **inglés**. Explicaciones técnicas en español.
- **Gestor de paquetes:** usar SIEMPRE **`pnpm`**. Nunca `npm` ni `yarn` (aplica a
  install, run, add, remove, dlx, scripts).
- **TypeScript:** nombres de variables/funciones en inglés; **type hints/anotaciones
  completas**; optimizar para **legibilidad**.
- **Flujo:** crear un PLAN y obtener aprobación antes de codificar. Correr
  `lint`/`typecheck` tras cada cambio significativo.
- **Sin commits ni publicación sin autorización explícita del autor.**
- **Nada de código dummy / placeholder / ficticio:** todo debe ser funcional y real.
- Ante dudas sobre APIs de librerías externas, verificar la sintaxis vigente (web).
- Preguntar antes de asumir cuando algo no esté claro.

## Reglas específicas de este proyecto

- **Performance del runtime:** el status line se renderiza muy seguido. NO arrancar
  Node en el render. Mantener bash + jq. Target < 50 ms. (SPEC §9 RNF1.)
- **Seguridad al integrar con Claude Code:** el instalador solo gestiona la clave
  `statusLine` en `~/.claude/settings.json`, con **backup** previo y **merge seguro**
  (preservar el resto del JSON). **PROHIBIDO** tocar claves de permisos
  (`permissions`, `defaultMode`, `skipAutoPermissionPrompt`). (SPEC §5.5, §9 RNF3.)
- **Fallbacks obligatorios:** sin `jq`, sin Nerd Font o sin truecolor, el status
  line debe degradar sin romper la terminal. (SPEC §9 RNF2.)
- La config vive en `~/.config/space-statusline/config.json` (XDG). El schema se
  valida con `zod`.

## Comandos esperados de la CLI

`init` · `config` · `theme [name]` · `install` · `uninstall` · `preview` · `doctor`
(detalle en SPEC §5.3).
