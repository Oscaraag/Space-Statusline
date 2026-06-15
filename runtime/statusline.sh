#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
#  OUTRUN HORIZON · status line para Claude Code
#  Estilo space-synthwave · truecolor 24-bit · Nerd Font (Cascadia Code NF)
#  Requiere: jq, git y bash 3.2+ (compatible con el bash 3.2 de macOS y bash 4+)
#  Pensado para WSL2 / Linux / macOS
#
#  Config-driven: lee su apariencia desde
#    $SPACE_STATUSLINE_CONFIG  o  ${XDG_CONFIG_HOME:-~/.config}/space-statusline/config.json
#  Sin config (o config inválida) usa los defaults embebidos (look Outrun).
#
#  Probar sin Claude Code:
#    echo '{"model":{"display_name":"Opus 4.1"},"workspace":{"current_dir":"'"$PWD"'"},"context_window":{"used_percentage":58},"cost":{"total_cost_usd":1.24}}' | bash runtime/statusline.sh
# ════════════════════════════════════════════════════════════════

input=$(cat)

# ── Fallback RNF2: sin jq → línea mínima, sin color, nunca rompe ─
if ! command -v jq >/dev/null 2>&1; then
  m=$(printf '%s' "$input" | grep -oE '"display_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/')
  d=$(printf '%s' "$input" | grep -oE '"current_dir"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed -E 's/.*"([^"]*)"$/\1/')
  p=$(printf '%s' "$input" | grep -oE '"used_percentage"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+$')
  printf '%s · %s · %s%%' "$(basename "${d:-$PWD}")" "${m:-Claude}" "${p:-0}"
  exit 0
fi

# ── Resolución de la config (XDG) ───────────────────────────────
CONFIG_PATH="${SPACE_STATUSLINE_CONFIG:-${XDG_CONFIG_HOME:-$HOME/.config}/space-statusline/config.json}"

# Defaults embebidos (espejo de getDefaults() en src/config.ts). Glifos y
# separador como escapes \u para mantener el script ASCII-puro; jq los expande.
DEFAULTS='{
  "theme": {
    "gradient": { "start": "#7A3CFF", "end": "#FF6CF0" },
    "colors": {
      "accent": "#A96BFF", "magenta": "#FF6CF0", "cyan": "#4BE4E8",
      "green": "#62E6B0", "amber": "#FFB86B", "dim": "#5C5180",
      "ctxWarn": "#FFB86B", "ctxDanger": "#FF5F8C"
    }
  },
  "sections": {
    "order": ["dir","git","model","context","cost","tokens","clock"],
    "enabled": { "dir": true, "git": true, "model": true, "context": true,
                 "cost": true, "tokens": true, "clock": true }
  },
  "glyphs": {
    "mode": "nerdfont",
    "repo": "\uf07b", "branch": "\ue0a0", "clock": "\uf017", "model": "\u2726",
    "added": "\u271a", "modified": "\u00b1", "ahead": "\u21e1", "behind": "\u21e3"
  },
  "layout": {
    "lines": "multi", "separator": "\u2591", "horizonWidth": 54,
    "ctxBarWidth": 14, "uppercase": true, "timeFormat": "%H:%M"
  },
  "thresholds": { "ctxWarn": 50, "ctxDanger": 80 }
}'

# Lee la config del usuario (si existe). Si no es JSON válido, el primer jq
# falla y reintentamos con defaults — nunca rompe.
US=$'\x1f'
usercfg='{}'
[[ -r "$CONFIG_PATH" ]] && usercfg=$(cat "$CONFIG_PATH" 2>/dev/null)
[[ -z "$usercfg" ]] && usercfg='{}'

# ── Una sola pasada de jq ────────────────────────────────────────
# deep-merge (defaults*user) + parseo del stdin de Claude Code. Emite 4
# líneas US-joined: escalares de config, orden, habilitadas, datos del stdin.
read_all(){
  jq -r --argjson def "$DEFAULTS" --argjson usr "$1" '
    ($def * $usr) as $c
    | ([ $c.theme.gradient.start, $c.theme.gradient.end,
         $c.theme.colors.accent, $c.theme.colors.magenta, $c.theme.colors.cyan,
         $c.theme.colors.green, $c.theme.colors.amber, $c.theme.colors.dim,
         $c.theme.colors.ctxWarn, $c.theme.colors.ctxDanger,
         ($c.thresholds.ctxWarn|tostring), ($c.thresholds.ctxDanger|tostring),
         ($c.layout.horizonWidth|tostring), ($c.layout.ctxBarWidth|tostring),
         $c.layout.separator, $c.layout.timeFormat,
         ($c.layout.uppercase|tostring), $c.layout.lines,
         $c.glyphs.mode, $c.glyphs.repo, $c.glyphs.branch, $c.glyphs.clock,
         $c.glyphs.model, $c.glyphs.added, $c.glyphs.modified,
         $c.glyphs.ahead, $c.glyphs.behind
       ] | join("")),
      ($c.sections.order | join("")),
      ($c.sections.enabled | to_entries | map(select(.value).key) | join("")),
      ([ (.model.display_name // "Claude"),
         (.workspace.current_dir // .cwd // ""),
         ((.context_window.used_percentage // 0)|floor|tostring),
         ((.cost.total_cost_usd // 0)|tostring),
         ((.context_window.total_input_tokens // 0)|tostring),
         ((.context_window.total_output_tokens // 0)|tostring)
       ] | join(""))
  ' <<<"$input" 2>/dev/null
}

cfg=$(read_all "$usercfg")
[[ -z "$cfg" ]] && cfg=$(read_all '{}')

# Split into lines without `mapfile` (a bash 4 builtin; macOS ships bash 3.2).
CFG_LINES=()
while IFS= read -r _line; do CFG_LINES+=("$_line"); done <<<"$cfg"
IFS="$US" read -r \
  GS GE C_ACCENT C_MAG C_CYAN C_GREEN C_AMBER C_DIM C_CTXW C_CTXD \
  T_WARN T_DANGER HORIZON_W CTXBAR_W SEPARATOR TIME_FMT UPPER LINES_MODE \
  G_MODE G_REPO G_BR G_CLK G_MDL G_ADD G_MOD G_AH G_BH \
  <<<"${CFG_LINES[0]}"
IFS="$US" read -ra ORDER   <<<"${CFG_LINES[1]:-}"
IFS="$US" read -ra ENABLED <<<"${CFG_LINES[2]:-}"
IFS="$US" read -r MODEL CWD PCT COST TIN TOUT <<<"${CFG_LINES[3]:-}"
: "${G_MODE:=nerdfont}"
: "${MODEL:=Claude}"; : "${PCT:=0}"; : "${COST:=0}"; : "${TIN:=0}"; : "${TOUT:=0}"
TOK=$(( TIN + TOUT ))

# ── Capacidades: truecolor (degradar a 256 si COLORTERM lo niega) ─
TRUECOLOR=1
case "${COLORTERM:-}" in
  truecolor|24bit|"") TRUECOLOR=1 ;;
  *) TRUECOLOR=0 ;;
esac

# ── Helpers de color ─────────────────────────────────────────────
RESET=$'\033[0m'
BOLD=$'\033[1m'

# Print an SGR foreground escape for an RGB triple (24-bit, or the xterm-256
# color cube when truecolor is unavailable). Prints inline — no subshell.
fg(){
  if (( TRUECOLOR )); then printf '\033[38;2;%d;%d;%dm' "$1" "$2" "$3"
  else printf '\033[38;5;%dm' "$(( 16 + 36*($1*5/255) + 6*($2*5/255) + ($3*5/255) ))"; fi
}
# Same, but assign the escape into a variable via printf -v (avoids the $() fork).
mkfg(){
  if (( TRUECOLOR )); then printf -v "$1" '\033[38;2;%d;%d;%dm' "$2" "$3" "$4"
  else printf -v "$1" '\033[38;5;%dm' "$(( 16 + 36*($2*5/255) + 6*($3*5/255) + ($4*5/255) ))"; fi
}

# Parse #RRGGBB into R G B globals; falls back to $2 $3 $4 on a bad value.
hex2rgb(){
  local h=${1#\#}
  if [[ $h =~ ^[0-9A-Fa-f]{6}$ ]]; then
    R=$(( 16#${h:0:2} )); G=$(( 16#${h:2:2} )); B=$(( 16#${h:4:2} ))
  else
    R=${2:-255}; G=${3:-255}; B=${4:-255}
  fi
}

# ── Gradiente: endpoints desde la config ─────────────────────────
hex2rgb "$GS" 122 60 255;  GS_R=$R GS_G=$G GS_B=$B
hex2rgb "$GE" 255 108 240; GE_R=$R GE_G=$G GE_B=$B

lerp(){ # $1 = t (0..1000) -> define R G B sobre el gradiente
  R=$(( GS_R + (GE_R-GS_R)*$1/1000 ))
  G=$(( GS_G + (GE_G-GS_G)*$1/1000 ))
  B=$(( GS_B + (GE_B-GS_B)*$1/1000 ))
}

# Texto con gradiente, carácter a carácter.
grad(){
  local s=$1 n=${#1} i t
  (( n==0 )) && return
  for (( i=0; i<n; i++ )); do
    t=$(( n>1 ? i*1000/(n-1) : 0 )); lerp "$t"
    fg "$R" "$G" "$B"; printf '%s' "${s:i:1}"
  done
  printf '%s' "$RESET"
}

# Regla-horizonte: gradiente + desvanecido en los extremos.
horizon(){
  local w=${1:-46} i t d f m=$(( (${1:-46}-1)/2 ))
  for (( i=0; i<w; i++ )); do
    t=$(( w>1 ? i*1000/(w-1) : 0 )); lerp "$t"
    d=$(( i>m ? i-m : m-i ))
    f=$(( 100 - d*38/(m>0?m:1) ))
    fg $(( R*f/100 )) $(( G*f/100 )) $(( B*f/100 )); printf '─'
  done
  printf '%s' "$RESET"
}

# Barra de contexto: medios-bloques (sub-resolución) + gradiente.
ctxbar(){
  local pct=$1 w=${2:-14} parts=("" "▏" "▎" "▍" "▌" "▋" "▊" "▉") i cell t
  local eighths=$(( pct*w*8/100 ))
  for (( i=0; i<w; i++ )); do
    t=$(( w>1 ? i*1000/(w-1) : 0 )); lerp "$t"
    cell=$(( eighths - i*8 ))
    if   (( cell >= 8 )); then fg "$R" "$G" "$B"; printf '█'
    elif (( cell >  0 )); then fg "$R" "$G" "$B"; printf '%s' "${parts[cell]}"
    else                       printf '%s░' "$TRACK"
    fi
  done
  printf '%s' "$RESET"
}

fmtk(){ local n=$1; (( n>=1000 )) && printf '%d.%dk' $(( n/1000 )) $(( (n%1000)/100 )) || printf '%d' "$n"; }

# ── Capability shims: fast path on bash 4+, fallbacks on bash 3.2 (macOS) ─
# Uppercase a variable in place when layout.uppercase is on. The `${v^^}`
# operator is bash 4+, so older bash falls back to tr (a fork, but macOS-only).
if (( BASH_VERSINFO[0] >= 4 )); then
  upcase(){ [[ $UPPER == true ]] || return 0; local v=${!1}; printf -v "$1" '%s' "${v^^}"; }
else
  upcase(){ [[ $UPPER == true ]] || return 0; local v; v=$(printf '%s' "${!1}" | tr '[:lower:]' '[:upper:]'); printf -v "$1" '%s' "$v"; }
fi
# Current time formatted with TIME_FMT. printf's `%()T` is bash 4.2+, so older
# bash falls back to date(1).
if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 2) )); then
  now(){ printf "%(${TIME_FMT})T" -1; }
else
  now(){ local t; t=$(date +"$TIME_FMT"); printf '%s' "$t"; }
fi

# ── Paleta (desde la config) ─────────────────────────────────────
hex2rgb "$C_ACCENT" 169 107 255; mkfg PUR  "$R" "$G" "$B"
hex2rgb "$C_MAG"    255 108 240; mkfg MAG  "$R" "$G" "$B"
hex2rgb "$C_CYAN"    75 228 232; mkfg CYAN "$R" "$G" "$B"
hex2rgb "$C_GREEN"   98 230 176; mkfg GRN  "$R" "$G" "$B"
hex2rgb "$C_AMBER"  255 184 107; mkfg AMB  "$R" "$G" "$B"
hex2rgb "$C_DIM"     92  81 128; mkfg DIM  "$R" "$G" "$B"; DIM_R=$R DIM_G=$G DIM_B=$B
hex2rgb "$C_CTXW"   255 184 107; mkfg CTXW "$R" "$G" "$B"
hex2rgb "$C_CTXD"   255  95 140; mkfg CTXD "$R" "$G" "$B"
# Empty context-bar track: a dimmer shade of `dim`.
mkfg TRACK $(( DIM_R*63/100 )) $(( DIM_G*63/100 )) $(( DIM_B*63/100 ))
SEP="  ${DIM}${SEPARATOR}${RESET}  "

# Color del % de contexto según umbrales.
if   (( PCT >= T_DANGER )); then PC=$CTXD
elif (( PCT >= T_WARN   )); then PC=$CTXW
else                             PC=$GRN
fi

# ── Carpeta / repo ───────────────────────────────────────────────
NAME=${CWD%/}; NAME=${NAME##*/}; [ -z "$NAME" ] && NAME="~"
upcase NAME
upcase MODEL

# ── Datos de git ────────────────────────────────────────────────
GIT=0; BRANCH=""; NEWC=0; MODC=0; AHEAD=0; BEHIND=0
if git -C "$CWD" rev-parse --is-inside-work-tree &>/dev/null; then
  GIT=1
  BRANCH=$(git -C "$CWD" branch --show-current 2>/dev/null)
  [ -z "$BRANCH" ] && BRANCH=$(git -C "$CWD" rev-parse --short HEAD 2>/dev/null)
  st=$(git -C "$CWD" status --porcelain 2>/dev/null)
  if [ -n "$st" ]; then
    NEWC=$(grep -c '^??' <<<"$st")
    MODC=$(( $(grep -c . <<<"$st") - NEWC ))
  fi
  ab=$(git -C "$CWD" rev-list --left-right --count '@{u}...HEAD' 2>/dev/null)
  if [ -n "$ab" ]; then BEHIND=${ab%%[[:space:]]*}; AHEAD=${ab##*[[:space:]]}; fi
  upcase BRANCH
fi

# ── Fragmentos por sección ───────────────────────────────────────
sec_dir(){ printf '%s%s %s' "$PUR" "$G_REPO" "${RESET}${BOLD}"; grad "$NAME"; }
sec_git(){
  (( GIT )) || return
  printf '%s%s %s%s' "$MAG" "$G_BR" "$BRANCH" "$RESET"
  local g=""
  (( NEWC   > 0 )) && g+=" ${AMB}${G_ADD}${NEWC}${RESET}"
  (( MODC   > 0 )) && g+=" ${CYAN}${G_MOD}${MODC}${RESET}"
  (( AHEAD  > 0 )) && g+=" ${GRN}${G_AH}${AHEAD}${RESET}"
  (( BEHIND > 0 )) && g+=" ${AMB}${G_BH}${BEHIND}${RESET}"
  [ -n "$g" ] && printf '  %s' "${g# }"
}
sec_model(){   printf '%s%s %s%s' "${PUR}${BOLD}" "$G_MDL" "$MODEL" "$RESET"; }
sec_context(){ printf '%sCTX%s ' "$DIM" "$RESET"; ctxbar "$PCT" "$CTXBAR_W"; printf ' %s%s%%%s' "$PC" "$PCT" "$RESET"; }
sec_cost(){    printf '%s$%.2f%s' "$GRN" "$COST" "$RESET"; }
sec_tokens(){  printf '%s' "$DIM"; fmtk "$TOK"; printf '%s' "$RESET"; }
sec_clock(){   printf '%s%s ' "$CYAN" "$G_CLK"; now; printf '%s' "$RESET"; }

render_section(){
  case "$1" in
    dir)     sec_dir ;;
    git)     sec_git ;;
    model)   sec_model ;;
    context) sec_context ;;
    cost)    sec_cost ;;
    tokens)  sec_tokens ;;
    clock)   sec_clock ;;
  esac
}

# Print the given sections (by name) joined with the separator, directly to
# stdout — no per-section subshell.
print_group(){
  local first=1 s
  for s in "$@"; do
    (( first )) || printf '%s' "$SEP"
    first=0
    render_section "$s"
  done
}

# ── Ensamblado según order/enabled + layout ──────────────────────
# Membership set as a delimited string (bash 3.2 has no associative arrays).
EN_SET="|"; for s in "${ENABLED[@]}"; do EN_SET+="$s|"; done

# Sections to render, in order; git collapses to nothing when not a repo.
# loc = location group (line 1), met = metrics group (line 3) for multiline.
visible=(); loc=(); met=()
for s in "${ORDER[@]}"; do
  [[ $EN_SET == *"|$s|"* ]] || continue
  [[ $s == git && $GIT -eq 0 ]] && continue
  visible+=("$s")
  case "$s" in
    dir|git) loc+=("$s") ;;
    *)       met+=("$s") ;;
  esac
done

if [[ $LINES_MODE == single ]]; then
  print_group "${visible[@]}"
else
  if (( ${#loc[@]} )); then print_group "${loc[@]}"; printf '\n'; fi
  horizon "$HORIZON_W"; printf '\n'
  print_group "${met[@]}"
fi
