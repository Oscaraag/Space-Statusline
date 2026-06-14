# KICKOFF — prompt para la sesión nueva

Abrí Claude Code en `~/personal/space-statusline` y pegá esto como primer mensaje:

---

```
Vamos a construir space-statusline. Ya está todo el contexto en este repo:

- Leé CLAUDE.md (reglas de trabajo y resumen).
- Leé SPEC.md completo (es el contrato: arquitectura, config schema, comandos,
  requisitos funcionales/no funcionales, roadmap por fases y Definition of Done).
- Inspeccioná runtime/statusline.sh para entender el render bash actual.

Resumen: es un status line synthwave para Claude Code, configurable por un wizard
CLI en Node + TypeScript (pnpm). El render queda en bash (rápido); el wizard edita
una config JSON en ~/.config/space-statusline/config.json que el bash lee en runtime.

Antes de codificar, armá un PLAN por fases (ver SPEC §11) y mostrámelo para aprobarlo.
No hagas commits ni publiques nada sin que yo lo autorice.

Empecemos por la Fase 0 (scaffold) una vez que apruebe el plan.
```

---

## Recordatorios para esa sesión

- **pnpm** siempre (nunca npm/yarn).
- El instalador NO debe tocar las claves de permisos de `~/.claude/settings.json`,
  solo `statusLine`, con backup y merge seguro.
- `gh` no está instalado en este entorno: la publicación a GitHub será un paso
  manual al final (instalar `gh` o crear el repo desde la web).
