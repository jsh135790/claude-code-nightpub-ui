#!/usr/bin/env bash
# =============================================================================
# Claude Code Status Line — capsules with Nerd Font icons
#    model · effort    dir    git    ctx%    cost    vim
# Catppuccin Mocha by itself; with the nightpub-ui plugin, the NightPub
# palette chosen on its Look page. One jq call and one git call per draw;
# usage detail lives in the plugin's panel. Respects NO_COLOR.
# =============================================================================

set -u

INPUT=$(cat)

# ---------------------------------------------------------------------------
# 0. jq — prefer PATH, fall back to known install locations
# ---------------------------------------------------------------------------
JQ=""
if command -v jq >/dev/null 2>&1; then
  JQ="jq"
else
  for _cand in \
    "${HOME:-}/AppData/Local/Microsoft/WinGet/Links/jq.exe" \
    "/usr/bin/jq" "/usr/local/bin/jq" "/opt/homebrew/bin/jq"; do
    if [[ -x "$_cand" ]]; then JQ="$_cand"; break; fi
  done
fi

# ---------------------------------------------------------------------------
# 1. Every field in one jq pass, joined by the unit separator so empty
#    fields survive the read.
# ---------------------------------------------------------------------------
FIELDS=""
if [[ -n "$JQ" ]]; then
  FIELDS=$(printf '%s' "$INPUT" | "$JQ" -r '
    [ (.model.display_name // "" | sub("^Claude "; "") | sub(" ?\\(1M context\\)"; " 1M")),
      .effort.level,
      .thinking.enabled,
      (.cwd // .workspace.current_dir),
      (.worktree.branch // .workspace.git_worktree),
      .pr.number,
      .context_window.used_percentage,
      .cost.total_cost_usd,
      .vim.mode
    ] | map(if . == null then "" else tostring end) | join("\u001f")' 2>/dev/null)
fi
IFS=$'\x1f' read -r MODEL EFFORT THINKING CWD WT_BRANCH PR_NUM CTX COST VIM <<<"$FIELDS"

# ---------------------------------------------------------------------------
# 2. Git — branch, ahead/behind and dirty from one porcelain v2 status
# ---------------------------------------------------------------------------
BRANCH="" AHEAD=0 BEHIND=0 DIRTY=0
if [[ -n "$CWD" ]] && command -v git >/dev/null 2>&1; then
  GIT_OUT=$(git -C "$CWD" --no-optional-locks status --porcelain=v2 --branch 2>/dev/null) || GIT_OUT=""
  while IFS= read -r line; do
    case $line in
      '# branch.head '*) BRANCH=${line#'# branch.head '} ;;
      '# branch.ab '*)
        ab=${line#'# branch.ab '}
        AHEAD=${ab%% *}; AHEAD=${AHEAD#+}
        BEHIND=${ab##* }; BEHIND=${BEHIND#-} ;;
      '#'*) ;;
      ?*) DIRTY=1 ;;
    esac
  done <<<"$GIT_OUT"
fi
[[ -z "$BRANCH" ]] && BRANCH=$WT_BRANCH
[[ "$BRANCH" == "(detached)" ]] && BRANCH="detached"
(( ${#BRANCH} > 24 )) && BRANCH="${BRANCH:0:23}…"

# ---------------------------------------------------------------------------
# 3. Directory — last component, home shown as ~
# ---------------------------------------------------------------------------
DIR=""
if [[ -n "$CWD" ]]; then
  path=${CWD//\\//}
  path=${path%/}
  home=${USERPROFILE:-${HOME:-}}
  home=${home//\\//}
  if [[ -n "$home" && ( "${path,,}" == "${home,,}" || "${path,,}" == "/c${home:2}" ) ]]; then
    DIR="~"
  else
    DIR=${path##*/}
    [[ -z "$DIR" ]] && DIR=$path
  fi
fi

# ---------------------------------------------------------------------------
# 4. Numbers
# ---------------------------------------------------------------------------
CTX_INT=""
[[ -n "$CTX" ]] && printf -v CTX_INT '%.0f' "$CTX" 2>/dev/null
COST_FMT=""
[[ -n "$COST" ]] && printf -v COST_FMT '%.2f' "$COST" 2>/dev/null

# ---------------------------------------------------------------------------
# 5. Draw
# ---------------------------------------------------------------------------
I_MODEL=$'\xf3\xb0\x99\xb4' I_THINK=$'\xf3\xb0\xa7\x91' I_DIR=$'\xef\x81\xbc' I_GIT=$'\xee\x82\xa0' I_DIRTY=$'\xef\x91\x84' I_PR=$'\xef\x90\x87'
I_CTX=$'\xf3\xb0\x8d\x9b' I_COST=$'\xef\x85\x95' I_VIM=$'\xee\x98\xab'
CAP_L=$'\xee\x82\xb6' CAP_R=$'\xee\x82\xb4'

if [[ -n "${NO_COLOR:-}" ]]; then
  OUT=""
  add() { OUT+="${OUT:+ │ }$*"; }
  [[ -n "$MODEL" ]] && add "$MODEL${EFFORT:+ · $EFFORT}"
  [[ -n "$DIR" ]] && add "$DIR"
  [[ -n "$BRANCH" ]] && add "$BRANCH$( ((DIRTY)) && printf '*')"
  [[ -n "$CTX_INT" ]] && add "ctx $CTX_INT%"
  [[ -n "$COST_FMT" ]] && add "\$$COST_FMT"
  [[ -n "$VIM" ]] && add "$VIM"
  [[ -n "$OUT" ]] && printf '%s\n' "$OUT"
  exit 0
fi

E=$'\033'
# Catppuccin Mocha: every capsule its own colour, one ink on all of them
INK="30;30;46"          # base — text on a capsule
DIM_INK="69;71;90"      # surface1 — secondary text on a capsule
PLAIN_INK=$INK          # text on the directory and cost capsules
C_MODEL="203;166;247" C_DIR="137;180;250" C_GIT="166;227;161" C_COST="250;179;135" C_VIM="180;190;254"
C_OK="166;227;161" C_WARN="249;226;175" C_BAD="243;139;168"

# The palette chosen in the nightpub-ui plugin, which leaves it as one line in
# <config>/nightpub-ui/palette:
#     nightpub-ui/1 <id> <nine R;G;B colours> end
# the colours being: text on a capsule, secondary text, accent, plain capsule,
# text on a plain capsule, success, warning, danger, info. A line that reads
# any other way (`nightpub-ui/1 off end` among them), or no file, keeps the
# colours above. The line is only ever read as text, never run.
PALETTE_FILE=""
if [[ -n "${CLAUDE_CONFIG_DIR:-}" ]]; then
  PALETTE_FILE="$CLAUDE_CONFIG_DIR/nightpub-ui/palette"
else
  for _home in "${HOME:-}" "${USERPROFILE:-}"; do
    if [[ -n "$_home" && -r "$_home/.claude/nightpub-ui/palette" ]]; then
      PALETTE_FILE="$_home/.claude/nightpub-ui/palette"
      break
    fi
  done
fi
if [[ -n "$PALETTE_FILE" && -r "$PALETTE_FILE" ]]; then
  PALETTE_LINE=""
  IFS= read -r PALETTE_LINE <"$PALETTE_FILE" || true
  read -r -a P <<<"${PALETTE_LINE%$'\r'}"
  if [[ ${#P[@]} -eq 12 && "${P[0]}" == "nightpub-ui/1" && "${P[11]}" == "end" ]]; then
    RGB='^[0-9]{1,3};[0-9]{1,3};[0-9]{1,3}$'
    is_palette=1
    for _at in 2 3 4 5 6 7 8 9 10; do
      [[ "${P[_at]}" =~ $RGB ]] || is_palette=0
    done
    if (( is_palette )); then
      # fewer hues: the accent for the model, plain capsules for the directory and the cost
      INK=${P[2]} DIM_INK=${P[3]} C_MODEL=${P[4]}
      C_DIR=${P[5]} C_COST=${P[5]} PLAIN_INK=${P[6]}
      C_GIT=${P[7]} C_OK=${P[7]} C_WARN=${P[8]} C_BAD=${P[9]} C_VIM=${P[10]}
    fi
  fi
fi

OUT=""
# pill <bg rgb> <ink rgb> <icon> <bold text> [secondary text]
pill() {
  OUT+="${OUT:+ }${E}[38;2;${1}m${CAP_L}${E}[48;2;${1}m${E}[38;2;${2}m${3} ${E}[1m${4}${E}[22m"
  [[ -n "${5:-}" ]] && OUT+="${E}[38;2;${DIM_INK}m ${5}"
  OUT+="${E}[0m${E}[38;2;${1}m${CAP_R}${E}[0m"
}

if [[ -n "$MODEL" ]]; then
  extra=""
  [[ -n "$EFFORT" ]] && extra="· $EFFORT"
  [[ "$THINKING" == "true" ]] && extra+="${extra:+ }$I_THINK"
  pill "$C_MODEL" "$INK" "$I_MODEL" "$MODEL" "$extra"
fi

[[ -n "$DIR" ]] && pill "$C_DIR" "$PLAIN_INK" "$I_DIR" "$DIR"

if [[ -n "$BRANCH" ]]; then
  extra=""
  (( DIRTY )) && extra+="$I_DIRTY"
  (( AHEAD > 0 )) && extra+="${extra:+ }↑$AHEAD"
  (( BEHIND > 0 )) && extra+="${extra:+ }↓$BEHIND"
  [[ -n "$PR_NUM" ]] && extra+="${extra:+ }$I_PR $PR_NUM"
  pill "$C_GIT" "$INK" "$I_GIT" "$BRANCH" "$extra"
fi

if [[ -n "$CTX_INT" ]]; then
  ctx_bg=$C_OK
  (( CTX_INT >= 50 )) && ctx_bg=$C_WARN
  (( CTX_INT >= 80 )) && ctx_bg=$C_BAD
  pill "$ctx_bg" "$INK" "$I_CTX" "$CTX_INT%"
fi

[[ -n "$COST_FMT" ]] && pill "$C_COST" "$PLAIN_INK" "$I_COST" "$COST_FMT"
[[ -n "$VIM" ]] && pill "$C_VIM" "$INK" "$I_VIM" "$VIM"

[[ -n "$OUT" ]] && printf '%s\n' "$OUT"
exit 0
