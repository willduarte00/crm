#!/usr/bin/env bash
#
# Executa as tasks da feature "Grupos e permissões" chamando um agente de CLI
# em modo não-interativo, uma task por sessão. Padrão: agy (Antigravity CLI).
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
#   ./scripts/run-tasks.sh --auto 5-9       # sem pausa entre tasks
#   ./scripts/run-tasks.sh --cli claude 1   # usa o Claude Code CLI em vez do agy
#
# Opções:
#   --list                 Lista as tasks extraídas do arquivo de prompts e sai
#   --dry-run              Imprime o prompt montado, não executa
#   --auto                 Não pausa entre tasks (leia o AVISO abaixo)
#   --yolo                 Pula a confirmação de permissão de ferramenta
#                             agy:    --dangerously-skip-permissions
#                             claude: --permission-mode bypassPermissions
#   --model <nome>         Repassado ao CLI (padrão: gemini-3.1-pro-high — nos
#                           modelos gemini o nível de esforço já vem embutido
#                           no nome, ex.: gemini-3.1-pro-low; --effort com um
#                           modelo gemini é erro)
#   --effort <nível>       Repassado ao CLI (low, medium, high — só faz sentido
#                           com modelos que aceitam --effort separado, ex.
#                           claude; vazio por padrão)
#   --timeout <dur>        Quanto o CLI espera pela resposta antes de desistir
#                           (padrão: 45m). O agy usa 5m por padrão, curto demais
#                           para uma task inteira. Só agy: --print-timeout.
#   --cli <comando>        Agente a chamar: agy (padrão) ou claude. Um binário
#                           desconhecido ainda funciona, só sem --mode/--permission-mode
#                           nem --yolo mapeados — passe os flags certos via
#                           TASKS_CLI_EXTRA_ARGS.
#   --project <id>         Só agy: --project <id>, para workspace específico
#
# Variável de ambiente:
#   TASKS_CLI_EXTRA_ARGS   Argumentos extras, separados por espaço, anexados
#                          depois dos flags conhecidos (ex.: "--add-dir ../lib")
#
# Saída: cada execução gera um log em .claude/task-runs/TASK-N-<timestamp>.log
#
# AVISO: --auto encadeia tasks sem revisão humana. A ordem 2 → 3 → 4 passa por um
# intervalo em que o projeto NÃO compila (User.role sai do schema antes de os usos
# serem removidos), então um gate de build entre tasks daria falso negativo. Sem
# revisão entre tasks, um erro na TASK-2 se propaga silenciosamente até a TASK-15.
# O padrão é pausar. Use --auto sabendo disso — e nunca nas tasks 1-4 ou 11-14.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPTS_FILE="$ROOT/docs/grupos-e-permissoes/PROMPT-IMPLEMENTACAO.md"
LOG_DIR="$ROOT/.claude/task-runs"
TOTAL_TASKS=15

CLI="agy"
DEFAULT_MODEL="gemini-3.1-pro-high"
MODEL="$DEFAULT_MODEL"
EFFORT=""
PRINT_TIMEOUT="45m"
PROJECT=""
YOLO=0
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
    --yolo)     YOLO=1; shift ;;
    --model)    MODEL="${2:-}"; [ -n "$MODEL" ] || die "--model exige um valor"; shift 2 ;;
    --effort)   EFFORT="${2:-}"; [ -n "$EFFORT" ] || die "--effort exige um valor"; shift 2 ;;
    --timeout)  PRINT_TIMEOUT="${2:-}"; [ -n "$PRINT_TIMEOUT" ] || die "--timeout exige um valor"; shift 2 ;;
    --cli)      CLI="${2:-}"; [ -n "$CLI" ] || die "--cli exige um valor"; shift 2 ;;
    --project)  PROJECT="${2:-}"; [ -n "$PROJECT" ] || die "--project exige um valor"; shift 2 ;;
    -h|--help)  sed -n '2,52p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*)         die "opção desconhecida: $1" ;;
    *)          SELECTION="$1"; shift ;;
  esac
done

[ -f "$PROMPTS_FILE" ] || die "arquivo de prompts não encontrado: $PROMPTS_FILE"
command -v "$CLI" >/dev/null 2>&1 || die "CLI não encontrado no PATH: $CLI
     Instalado? Confira com: command -v $CLI
     Para usar outro agente: ./scripts/run-tasks.sh --cli claude ..."

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

# O agy herda o PATH deste shell. Sem grep/sed o agente falha na verificacao final
# ("procure sobras de role") com 'executable file not found', e a sessao inteira
# termina em ERROR mesmo com o trabalho ja concluido. Anexa ao FINAL para preencher
# a lacuna sem sombrear os equivalentes do Windows (find, sort), que diferem.
if ! command -v grep >/dev/null 2>&1; then
  for candidate in "/c/Program Files/Git/usr/bin" "/c/Program Files (x86)/Git/usr/bin" "$LOCALAPPDATA/Programs/Git/usr/bin"; do
    if [ -x "$candidate/grep.exe" ]; then
      PATH="$PATH:$candidate"; export PATH
      printf 'PATH:       + %s (para grep/sed)
' "$candidate"
      break
    fi
  done
fi

mkdir -p "$LOG_DIR"

# Cada agente nomeia seus próprios flags de forma diferente. O básico
# (--output-format, --model, --effort) é igual entre agy e claude; o resto
# depende do binário. Um --cli desconhecido ainda roda, só sem --mode /
# --permission-mode nem --yolo mapeados — use TASKS_CLI_EXTRA_ARGS para isso.
#
# O prompt vai por stdin, sem -p: o agy trata -p como flag de valor (o token
# seguinte vira o prompt, mesmo que pareça outra flag — era por isso que
# "-p --output-format text" fazia o agy tomar "--output-format" como prompt).
# Por stdin nada disso importa, e o prompt com aspas e acentos passa intacto.
CLI_BASENAME="$(basename -- "$CLI")"

# O modelo padrão é um nome do catálogo do agy; em outro CLI ele seria rejeitado.
# Um --model explícito continua valendo para qualquer CLI.
case "$CLI_BASENAME" in
  agy|agy.exe) ;;
  *) [ "$MODEL" = "$DEFAULT_MODEL" ] && MODEL="" ;;
esac

# Com --output-format text o agy so imprime no fim: numa task de 20min a tela fica
# muda e nao ha como distinguir "trabalhando" de "travado". O stream-json emite um
# evento por ferramenta chamada, que render_stream() mostra ao vivo.
# So o agy tem esse formato de evento; nos demais CLIs seguimos com texto.
STREAMING=0
case "$CLI_BASENAME" in agy|agy.exe) command -v python >/dev/null 2>&1 && STREAMING=1 ;; esac

if [ "$STREAMING" -eq 1 ]; then
  CLI_ARGS=( --output-format stream-json )
else
  CLI_ARGS=( --output-format text )
fi
[ -n "$MODEL" ]  && CLI_ARGS+=( --model "$MODEL" )
[ -n "$EFFORT" ] && CLI_ARGS+=( --effort "$EFFORT" )

case "$CLI_BASENAME" in
  agy|agy.exe)
    CLI_ARGS+=( --mode accept-edits )
    # Sem isto o agy desiste de esperar em 5m (padrão de --print-timeout) e sai com
    # erro, mesmo com o agente ainda trabalhando — o trabalho já feito fica no disco,
    # mas o script marca a task como falha.
    [ -n "$PRINT_TIMEOUT" ] && CLI_ARGS+=( --print-timeout "$PRINT_TIMEOUT" )
    [ "$YOLO" -eq 1 ] && CLI_ARGS+=( --dangerously-skip-permissions )
    [ -n "$PROJECT" ] && CLI_ARGS+=( --project "$PROJECT" )
    RESUME_HINT="agy --continue"
    ;;
  claude)
    # Aqui -p é booleano de verdade: liga o modo print e o prompt segue vindo por stdin.
    CLI_ARGS+=( -p )
    if [ "$YOLO" -eq 1 ]; then
      CLI_ARGS+=( --permission-mode bypassPermissions )
    else
      CLI_ARGS+=( --permission-mode acceptEdits )
    fi
    [ -n "$PROJECT" ] && printf 'aviso: --project ignorado (não existe em claude)\n' >&2
    RESUME_HINT="claude --continue"
    ;;
  *)
    CLI_ARGS+=( -p )
    printf 'aviso: CLI "%s" não reconhecido — enviando só -p/--output-format/--model/--effort.\n' "$CLI" >&2
    printf '       Passe flags específicos via TASKS_CLI_EXTRA_ARGS.\n' >&2
    RESUME_HINT="$CLI --continue"
    ;;
esac

if [ -n "${TASKS_CLI_EXTRA_ARGS:-}" ]; then
  # shellcheck disable=SC2206  # split intencional por espaço
  CLI_ARGS+=( ${TASKS_CLI_EXTRA_ARGS} )
fi

# Traduz o NDJSON do agy em linhas legiveis, mantendo o stream cru no .jsonl.
render_stream() {
  python -u -c "
import sys, json, time
raw = open(sys.argv[1], 'w', encoding='utf-8')
t0 = last = time.time()

def out(line):
    print(line, flush=True)

for line in sys.stdin:
    line = line.rstrip()
    if not line:
        continue
    raw.write(line + chr(10)); raw.flush()
    try:
        ev = json.loads(line)
    except ValueError:
        out(line); continue

    now = time.time()
    t = time.strftime('%M:%S', time.gmtime(now - t0))
    gap = int(now - last)
    if gap >= 60:
        out('[%s]   (%ds pensando)' % (t, gap))
    last = now

    kind = ev.get('event')
    if kind == 'init':
        out('[%s] sessao iniciada - %s' % (t, ev['init'].get('model', '?')))
    elif kind == 'step_update':
        su = ev['step_update']
        if su.get('step_type') == 'tool' and su.get('state') == 'ACTIVE':
            params = (su.get('tool_info') or {}).get('parameters') or {}
            arg = ''
            if params:
                arg = ' '.join(str(list(params.values())[0]).split())
                if len(arg) > 70:
                    arg = '...' + arg[-67:]
            out('[%s] %s %s' % (t, su.get('tool_name', '?'), arg))
        elif su.get('step_type') == 'agent_response' and su.get('text_delta'):
            out(su['text_delta'].rstrip())
    elif kind == 'result':
        r = ev['result']
        out('[%s] %s - %ds, %s turnos, %s tokens' % (
            t, r.get('status'), int(r.get('duration_seconds', 0)),
            r.get('num_turns'), (r.get('usage') or {}).get('total_tokens')))
raw.close()
" "$1"
}

printf '\n'
printf 'CLI:        %s %s   (prompt por stdin)\n' "$CLI" "${CLI_ARGS[*]}"
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

  stamp="$(date +%Y%m%d-%H%M%S)"
  log="$LOG_DIR/TASK-$n-$stamp.log"
  raw="$LOG_DIR/TASK-$n-$stamp.jsonl"
  started="$(date +%s)"

  # Prompt por stdin — ver o comentário acima, na montagem de CLI_ARGS.
  if [ "$STREAMING" -eq 1 ]; then
    printf '%s' "$prompt" | (cd "$ROOT" && "$CLI" "${CLI_ARGS[@]}") 2>&1 \
      | render_stream "$raw" | tee "$log"
  else
    printf '%s' "$prompt" | (cd "$ROOT" && "$CLI" "${CLI_ARGS[@]}") 2>&1 | tee "$log"
  fi
  status="${PIPESTATUS[1]}"

  elapsed=$(( $(date +%s) - started ))
  printf '\n------------------------------------------------------------------------\n'
  printf 'TASK-%s  saída=%s  tempo=%ss  log=%s\n' "$n" "$status" "$elapsed" "$log"

  if [ "$status" -ne 0 ]; then
    FAILED="$n"
    printf '\nTASK-%s falhou. As tasks seguintes NÃO serão executadas.\n' "$n"
    printf 'Para retomar essa sessão de forma interativa:\n\n'
    printf '  cd "%s" && %s\n\n' "$ROOT" "$RESUME_HINT"
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
