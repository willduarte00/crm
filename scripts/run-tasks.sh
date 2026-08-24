#!/usr/bin/env bash
#
# Executa as tasks da feature "Grupos e permissões" chamando o Claude Code CLI
# em modo não-interativo, uma task por sessão.
#
# O prompt de cada execução é o "Prompt mestre" + o prompt da task, extraídos
# dos blocos de código de docs/grupos-e-permissoes/PROMPT-IMPLEMENTACAO.md.
# Esse arquivo é a única fonte de verdade: editar lá muda o que o script envia.
#
# Uso:
#   ./scripts/run-tasks.sh --list           # mostra as tasks encontradas
#   ./scripts/run-tasks.sh --dry-run 1      # imprime o prompt sem executar
#   ./scripts/run-tasks.sh 1                # executa a TASK-1
#   ./scripts/run-tasks.sh 1-4              # executa TASK-1 a TASK-4, pausando entre elas
#   ./scripts/run-tasks.sh 5,6,7            # executa tasks específicas
#   ./scripts/run-tasks.sh --auto 1-4       # sem pausa entre tasks
#
# Opções:
#   --list                 Lista as tasks extraídas do arquivo de prompts e sai
#   --dry-run              Imprime o prompt montado, não executa
#   --auto                 Não pausa entre tasks (leia o aviso no README abaixo)
#   --yolo                 --permission-mode bypassPermissions (padrão: acceptEdits)
#   --model <alias>        Repassa para o CLI (ex.: opus, sonnet)
#   --effort <nível>       Repassa para o CLI (low, medium, high, xhigh, max)
#   --cli <comando>        Comando do agente (sobrescreve o do perfil)
#   --profile <nome>       Perfil de CLI: claude (padrão) ou custom
#
# Perfil "custom" — para apontar o script a outro agente de linha de comando.
# Configure por variável de ambiente:
#
#   TASKS_CLI            comando do agente (obrigatório)
#   TASKS_CLI_ARGS       argumentos fixos, separados por espaço (ex.: "run --headless")
#   TASKS_PROMPT_MODE    como o prompt é entregue: stdin (padrão) | arg | file
#   TASKS_PROMPT_FLAG    com mode=file, a flag que recebe o caminho (ex.: --prompt-file)
#
# Exemplo:
#   TASKS_CLI=meucli TASKS_CLI_ARGS="run --yes" TASKS_PROMPT_MODE=stdin \
#     ./scripts/run-tasks.sh --profile custom 1
#
# Saída: cada execução gera um log em .claude/task-runs/TASK-N-<timestamp>.log
#
# AVISO: --auto encadeia tasks sem revisão humana. A ordem 2 → 3 → 4 passa por um
# intervalo em que o projeto NÃO compila (User.role sai do schema antes de os usos
# serem removidos), então um gate de build entre tasks daria falso negativo. Sem
# revisão entre tasks, um erro na TASK-2 se propaga silenciosamente até a TASK-15.
# O padrão é pausar. Use --auto sabendo disso.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPTS_FILE="$ROOT/docs/grupos-e-permissoes/PROMPT-IMPLEMENTACAO.md"
LOG_DIR="$ROOT/.claude/task-runs"
TOTAL_TASKS=15

CLI=""
PROFILE="claude"
MODEL=""
EFFORT=""
PERMISSION_MODE="acceptEdits"
AUTO=0
DRY_RUN=0
LIST=0

die() { printf 'erro: %s\n' "$1" >&2; exit 1; }

# ---------------------------------------------------------------- argumentos

SELECTION=""
while [ $# -gt 0 ]; do
  case "$1" in
    --list)     LIST=1; shift ;;
    --dry-run)  DRY_RUN=1; shift ;;
    --auto)     AUTO=1; shift ;;
    --yolo)     PERMISSION_MODE="bypassPermissions"; shift ;;
    --model)    MODEL="${2:-}"; [ -n "$MODEL" ] || die "--model exige um valor"; shift 2 ;;
    --effort)   EFFORT="${2:-}"; [ -n "$EFFORT" ] || die "--effort exige um valor"; shift 2 ;;
    --cli)      CLI="${2:-}"; [ -n "$CLI" ] || die "--cli exige um valor"; shift 2 ;;
    -h|--help)  sed -n '2,40p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)         die "opção desconhecida: $1" ;;
    *)          SELECTION="$1"; shift ;;
  esac
done

[ -f "$PROMPTS_FILE" ] || die "arquivo de prompts não encontrado: $PROMPTS_FILE"
command -v "$CLI" >/dev/null 2>&1 || die "CLI não encontrado no PATH: $CLI"

# ------------------------------------------------------------------ extração
#
# Os prompts são os blocos cercados por ``` no arquivo, em ordem:
#   bloco 1      = Prompt mestre
#   blocos 2..16 = TASK-1 .. TASK-15

extract_block() {
  awk -v want="$1" '
    /^```$/ { inside = !inside; if (inside) n++; next }
    inside && n == want { print }
  ' "$PROMPTS_FILE"
}

count_blocks() {
  awk '/^```$/ { n++ } END { print int(n / 2) }' "$PROMPTS_FILE"
}

task_title() {
  awk -v want="$1" '/^## TASK-/ { n++; if (n == want) { sub(/^## /, ""); print; exit } }' "$PROMPTS_FILE"
}

BLOCKS="$(count_blocks)"
EXPECTED=$(( TOTAL_TASKS + 1 ))
if [ "$BLOCKS" -ne "$EXPECTED" ]; then
  die "esperava $EXPECTED blocos de prompt (mestre + $TOTAL_TASKS tasks), encontrei $BLOCKS.
     O arquivo de prompts foi editado de forma que o script não consegue mais separar os blocos.
     Rode com --list para inspecionar."
fi

MASTER="$(extract_block 1)"
[ -n "$MASTER" ] || die "prompt mestre veio vazio"

if [ "$LIST" -eq 1 ]; then
  printf 'Arquivo:  %s\n' "$PROMPTS_FILE"
  printf 'CLI:      %s\n' "$CLI"
  printf 'Blocos:   %s (1 mestre + %s tasks)\n\n' "$BLOCKS" "$TOTAL_TASKS"
  printf 'Prompt mestre: %s linhas\n\n' "$(printf '%s' "$MASTER" | wc -l | tr -d ' ')"
  # Sem alinhamento por largura fixa: printf conta bytes, e os acentos dos
  # títulos ocupam dois — a coluna sairia torta.
  for i in $(seq 1 "$TOTAL_TASKS"); do
    lines="$(extract_block $(( i + 1 )) | wc -l | tr -d ' ')"
    printf '  %2s. %s  (%s linhas)\n' "$i" "$(task_title "$i")" "$lines"
  done
  exit 0
fi

# ------------------------------------------------------------------- seleção

[ -n "$SELECTION" ] || die "informe as tasks: um número, um intervalo (1-4), uma lista (5,6,7) ou 'all'.
     Use --help para ver os exemplos."

parse_selection() {
  local sel="$1" part start end
  if [ "$sel" = "all" ]; then seq 1 "$TOTAL_TASKS"; return; fi
  # Com '%s' o último item sai sem newline e `read` o descarta ao devolver EOF.
  printf '%s\n' "$sel" | tr ',' '\n' | while IFS= read -r part; do
    [ -n "$part" ] || continue
    case "$part" in
      *-*)
        start="${part%%-*}"; end="${part##*-}"
        case "$start$end" in *[!0-9]*) die "intervalo inválido: $part" ;; esac
        [ "$start" -le "$end" ] || die "intervalo invertido: $part"
        seq "$start" "$end"
        ;;
      *)
        case "$part" in *[!0-9]*) die "task inválida: $part" ;; esac
        printf '%s\n' "$part"
        ;;
    esac
  done
}

TASKS="$(parse_selection "$SELECTION")" || exit 1
[ -n "$TASKS" ] || die "nenhuma task selecionada"

for n in $TASKS; do
  if [ "$n" -lt 1 ] || [ "$n" -gt "$TOTAL_TASKS" ]; then
    die "task fora do intervalo 1-$TOTAL_TASKS: $n"
  fi
done

# ------------------------------------------------------------------- execução

mkdir -p "$LOG_DIR"

CLI_ARGS=( -p --output-format text --permission-mode "$PERMISSION_MODE" )
[ -n "$MODEL" ]  && CLI_ARGS+=( --model "$MODEL" )
[ -n "$EFFORT" ] && CLI_ARGS+=( --effort "$EFFORT" )

printf '\n'
printf 'CLI:        %s %s\n' "$CLI" "${CLI_ARGS[*]}"
printf 'Diretório:  %s\n' "$ROOT"
printf 'Tasks:      %s\n' "$(printf '%s' "$TASKS" | tr '\n' ' ')"
printf 'Logs:       %s\n' "$LOG_DIR"
[ "$AUTO" -eq 1 ] && printf 'Modo:       automático (sem pausa entre tasks)\n'
printf '\n'

FAILED=""

for n in $TASKS; do
  title="$(task_title "$n")"
  prompt="$MASTER

---

$(extract_block $(( n + 1 )))"

  printf '========================================================================\n'
  printf '  %s\n' "${title:-TASK-$n}"
  printf '========================================================================\n\n'

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '%s\n\n' "$prompt"
    continue
  fi

  log="$LOG_DIR/TASK-$n-$(date +%Y%m%d-%H%M%S).log"
  started="$(date +%s)"

  # O prompt vai por stdin: evita qualquer problema de escape com aspas e acentos.
  printf '%s' "$prompt" | (cd "$ROOT" && "$CLI" "${CLI_ARGS[@]}") 2>&1 | tee "$log"
  status="${PIPESTATUS[1]}"

  elapsed=$(( $(date +%s) - started ))
  printf '\n------------------------------------------------------------------------\n'
  printf 'TASK-%s  saída=%s  tempo=%ss  log=%s\n' "$n" "$status" "$elapsed" "$log"

  if [ "$status" -ne 0 ]; then
    FAILED="$n"
    printf '\nTASK-%s falhou. As tasks seguintes NÃO serão executadas.\n' "$n"
    printf 'Para retomar essa sessão de forma interativa:\n\n'
    printf '  cd "%s" && claude --continue\n\n' "$ROOT"
    break
  fi

  printf '\n'

  # Última task da lista: não faz sentido pausar.
  last="$(printf '%s\n' "$TASKS" | tail -n 1)"
  [ "$n" = "$last" ] && continue

  if [ "$AUTO" -eq 0 ]; then
    printf 'Revise o que a TASK-%s alterou (git diff) antes de seguir.\n' "$n"
    printf 'Enter para continuar, q para parar: '
    read -r answer </dev/tty
    case "$answer" in
      q|Q) printf '\nInterrompido pelo usuário após a TASK-%s.\n' "$n"; break ;;
    esac
    printf '\n'
  fi
done

if [ -n "$FAILED" ]; then
  printf '\nEncerrado com falha na TASK-%s.\n' "$FAILED"
  exit 1
fi

printf '\nConcluído.\n'
