<#
.SYNOPSIS
Executa as tasks da feature "Grupos e permissões" chamando um agente de CLI em modo
não-interativo, uma task por sessão. Padrão: agy (Antigravity CLI). Equivalente
PowerShell de scripts/run-tasks.sh.

.DESCRIPTION
O prompt de cada execução é o "Prompt mestre" + o prompt da task, extraídos dos blocos
de código de docs/grupos-e-permissoes/PROMPT-IMPLEMENTACAO.md. Esse arquivo é a única
fonte de verdade: editar lá muda o que o script envia.

Cada agente nomeia seus próprios flags de forma diferente. O básico (-p,
--output-format, --model, --effort) é igual entre agy e claude; o resto depende do
binário escolhido em -Cli. Um -Cli desconhecido ainda roda, só sem --mode /
--permission-mode nem -Yolo mapeados — use -ExtraArgs para completar.

AVISO: -Auto encadeia tasks sem revisão humana. A ordem 2 -> 3 -> 4 passa por um
intervalo em que o projeto NÃO compila (User.role sai do schema antes de os usos serem
removidos), então um gate de build entre tasks daria falso negativo. Sem revisão entre
tasks, um erro na TASK-2 se propaga silenciosamente até a TASK-15. O padrão é pausar.

.PARAMETER Selection
Um número (7), um intervalo (1-4), uma lista (5,6,7) ou 'all'.

.PARAMETER Cli
Agente a chamar: agy (padrão) ou claude. Outro binário ainda funciona, com flags
reduzidos.

.PARAMETER Timeout
Quanto o CLI espera pela resposta antes de desistir (padrao: 45m). O agy usa 5m por
padrao, curto demais para uma task inteira: ele sai com erro mesmo com o agente ainda
trabalhando. So agy (--print-timeout).

.PARAMETER Project
Só agy: --project <id>, para apontar a um workspace específico.

.PARAMETER ExtraArgs
Argumentos extras repassados ao CLI depois dos flags conhecidos, ex.:
-ExtraArgs '--add-dir','../lib'

.EXAMPLE
.\scripts\run-tasks.ps1 -List
.EXAMPLE
.\scripts\run-tasks.ps1 -DryRun 1
.EXAMPLE
.\scripts\run-tasks.ps1 1-4
.EXAMPLE
.\scripts\run-tasks.ps1 -Auto 5,6,7   # gemini-3.1-pro-high e o padrao
.EXAMPLE
.\scripts\run-tasks.ps1 -Cli claude 1
#>

[CmdletBinding()]
param(
    # Array para que `5,9` funcione sem aspas — o PowerShell já o entrega como
    # duas strings, enquanto `1-4` e `all` chegam como uma só.
    [Parameter(Position = 0)]
    [string[]] $Selection,

    [switch] $List,
    [switch] $DryRun,
    [switch] $Auto,
    [switch] $Yolo,
    [string] $Model = 'gemini-3.1-pro-high',
    [string] $Effort = '',
    [string] $Timeout = '45m',
    [string] $Cli = 'agy',
    [string] $Project,
    [string[]] $ExtraArgs = @()
)

$ErrorActionPreference = 'Stop'

# O agy herda o PATH desta janela. Numa janela normal do PowerShell nao ha grep, sed
# nem afins, e o agente os chama na verificacao final ("procure sobras de role"):
# o comando falha com 'executable file not found' e a sessao inteira termina em ERROR
# mesmo com o trabalho ja concluido. O Git for Windows traz esses binarios; anexamos
# ao FINAL do PATH para preencher a lacuna sem sombrear os equivalentes do Windows
# (find, sort), que tem comportamento diferente dos do Git.
if (-not (Get-Command grep -ErrorAction SilentlyContinue)) {
    $gitBins = @(
        (Join-Path $env:ProgramFiles 'Git\usr\bin'),
        (Join-Path ${env:ProgramFiles(x86)} 'Git\usr\bin'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Git\usr\bin')
    )
    foreach ($candidate in $gitBins) {
        if ($candidate -and (Test-Path (Join-Path $candidate 'grep.exe'))) {
            $env:PATH = "$env:PATH;$candidate"
            Write-Host "PATH:       + $candidate (para grep/sed)" -ForegroundColor DarkGray
            break
        }
    }
}

# Mantenha igual ao valor padrão de -Model no bloco param acima.
$defaultModel = 'gemini-3.1-pro-high'

$root        = Split-Path -Parent $PSScriptRoot
$promptsFile = Join-Path $root 'docs\grupos-e-permissoes\PROMPT-IMPLEMENTACAO.md'
$logDir      = Join-Path $root '.claude\task-runs'
$totalTasks  = 15

# O prompt tem acentos: sem isto o PowerShell 5.1 os corrompe ao entregar ao processo.
# (Este arquivo é salvo em UTF-8 com BOM pelo mesmo motivo: sem o BOM, o PowerShell 5.1
# lê o próprio script como ANSI e mangla os literais acentuados.)
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

function Fail([string] $message) {
    Write-Host "erro: $message" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $promptsFile)) { Fail "arquivo de prompts não encontrado: $promptsFile" }
if (-not (Get-Command $Cli -ErrorAction SilentlyContinue)) {
    Fail ("CLI não encontrado no PATH: $Cli`n" +
          "     Instalado? Confira com: Get-Command $Cli`n" +
          "     Para usar outro agente: .\scripts\run-tasks.ps1 -Cli claude ...")
}

# ------------------------------------------------------------------- extração
#
# Os prompts são os blocos cercados por ``` no arquivo, em ordem:
#   bloco 0      = Prompt mestre
#   blocos 1..15 = TASK-1 .. TASK-15

$lines  = Get-Content -Path $promptsFile -Encoding UTF8
$blocks = New-Object System.Collections.ArrayList
$titles = New-Object System.Collections.ArrayList
$inside = $false
$buffer = $null

foreach ($line in $lines) {
    if ($line -eq '```') {
        if ($inside) {
            [void] $blocks.Add(($buffer -join "`n"))
            $inside = $false
        } else {
            $buffer = New-Object System.Collections.ArrayList
            $inside = $true
        }
        continue
    }
    if ($inside) {
        [void] $buffer.Add($line)
    } elseif ($line -match '^## (TASK-.+)$') {
        [void] $titles.Add($Matches[1])
    }
}

$expected = $totalTasks + 1
if ($blocks.Count -ne $expected) {
    Fail ("esperava $expected blocos de prompt (mestre + $totalTasks tasks), encontrei $($blocks.Count).`n" +
          "     O arquivo de prompts foi editado de forma que o script não consegue mais separar os blocos.`n" +
          "     Rode com -List para inspecionar.")
}

$master = $blocks[0]
if ([string]::IsNullOrWhiteSpace($master)) { Fail 'prompt mestre veio vazio' }

if ($List) {
    Write-Host "Arquivo:  $promptsFile"
    Write-Host "CLI:      $Cli"
    Write-Host "Blocos:   $($blocks.Count) (1 mestre + $totalTasks tasks)"
    Write-Host ''
    Write-Host "Prompt mestre: $(($master -split "`n").Count) linhas"
    Write-Host ''
    for ($i = 1; $i -le $totalTasks; $i++) {
        $count = ($blocks[$i] -split "`n").Count
        Write-Host ("  {0,2}. {1}  ({2} linhas)" -f $i, $titles[$i - 1], $count)
    }
    exit 0
}

# -------------------------------------------------------------------- seleção

$selectionText = ($Selection -join ',')
if ([string]::IsNullOrWhiteSpace($selectionText)) {
    Fail ("informe as tasks: um número, um intervalo (1-4), uma lista (5,6,7) ou 'all'.`n" +
          "     Use Get-Help .\scripts\run-tasks.ps1 para ver os exemplos.")
}

function Resolve-Selection([string] $value) {
    if ($value -eq 'all') { return 1..$totalTasks }

    $result = New-Object System.Collections.ArrayList
    foreach ($part in ($value -split ',')) {
        $part = $part.Trim()
        if ($part -eq '') { continue }

        if ($part -match '^(\d+)-(\d+)$') {
            $start = [int] $Matches[1]
            $end   = [int] $Matches[2]
            if ($start -gt $end) { Fail "intervalo invertido: $part" }
            foreach ($n in $start..$end) { [void] $result.Add($n) }
        } elseif ($part -match '^\d+$') {
            [void] $result.Add([int] $part)
        } else {
            Fail "task inválida: $part"
        }
    }
    return $result
}

$tasks = Resolve-Selection $selectionText
if ($tasks.Count -eq 0) { Fail 'nenhuma task selecionada' }

foreach ($n in $tasks) {
    if ($n -lt 1 -or $n -gt $totalTasks) { Fail "task fora do intervalo 1-${totalTasks}: $n" }
}

# ------------------------------------------------------------------- execução

if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }

# Cada agente nomeia seus próprios flags de forma diferente. O básico é igual
# entre agy e claude; o resto depende do binário.
#
# O prompt vai por stdin, sem -p. Dois motivos: o agy trata -p como flag de
# valor (o token seguinte vira o prompt, mesmo que pareça outra flag), e o
# PowerShell 5.1 não escapa aspas duplas ao repassar argumento a binário
# nativo — o prompt tem aspas no meio e seria partido em vários argumentos.

# O modelo padrão é um nome do catálogo do agy; em outro CLI ele seria rejeitado.
# Um -Model explícito continua valendo para qualquer CLI.
if ($Cli -notmatch '^agy(\.exe)?$' -and $Model -eq $defaultModel) { $Model = '' }

# Com --output-format text o agy só imprime no fim: numa task de 20min a tela fica
# muda e não há como distinguir "trabalhando" de "travado". O stream-json emite um
# evento por ferramenta chamada, que o laço de execução abaixo renderiza ao vivo.
# Só o agy tem esse formato de evento; nos demais CLIs seguimos com texto.
$streaming = $Cli -match '^agy(\.exe)?$'
$cliArgs = if ($streaming) { @('--output-format', 'stream-json') } else { @('--output-format', 'text') }
if ($Model)  { $cliArgs += @('--model', $Model) }
if ($Effort) { $cliArgs += @('--effort', $Effort) }

$resumeHint = "$Cli --continue"

switch -Regex ($Cli) {
    '^agy(\.exe)?$' {
        $cliArgs += @('--mode', 'accept-edits')
        # Sem isto o agy desiste de esperar em 5m (padrao de --print-timeout) e sai
        # com erro, mesmo com o agente ainda trabalhando — o trabalho ja feito fica
        # no disco, mas o script marca a task como falha.
        if ($Timeout) { $cliArgs += @('--print-timeout', $Timeout) }
        if ($Yolo) { $cliArgs += '--dangerously-skip-permissions' }
        if ($Project) { $cliArgs += @('--project', $Project) }
        $resumeHint = 'agy --continue'
    }
    '^claude$' {
        # Aqui -p é booleano de verdade: liga o modo print, e o prompt segue por stdin.
        $cliArgs += '-p'
        if ($Yolo) {
            $cliArgs += @('--permission-mode', 'bypassPermissions')
        } else {
            $cliArgs += @('--permission-mode', 'acceptEdits')
        }
        if ($Project) { Write-Host 'aviso: -Project ignorado (não existe em claude)' -ForegroundColor Yellow }
        $resumeHint = 'claude --continue'
    }
    default {
        $cliArgs += '-p'
        Write-Host "aviso: CLI `"$Cli`" não reconhecido — enviando só -p/--output-format/--model/--effort." -ForegroundColor Yellow
        Write-Host '       Passe flags específicos via -ExtraArgs.' -ForegroundColor Yellow
    }
}

if ($ExtraArgs.Count -gt 0) { $cliArgs += $ExtraArgs }

Write-Host ''
Write-Host "CLI:        $Cli $($cliArgs -join ' ')   (prompt por stdin)"
Write-Host "Diretório:  $root"
Write-Host "Tasks:      $($tasks -join ' ')"
Write-Host "Logs:       $logDir"
if ($Auto) { Write-Host 'Modo:       automático (sem pausa entre tasks)' }
Write-Host ''

$failed   = $null
$lastTask = $tasks[-1]
$previous = Get-Location

try {
    Set-Location $root

    foreach ($n in $tasks) {
        $title  = $titles[$n - 1]
        $prompt = "$master`n`n---`n`n$($blocks[$n])"

        Write-Host '========================================================================'
        Write-Host "  $title"
        Write-Host '========================================================================'
        Write-Host ''

        if ($DryRun) {
            # Write-Output (não Write-Host) para que `-DryRun 1 > prompt.txt` funcione.
            Write-Output $prompt
            Write-Output ''
            continue
        }

        $stamp   = Get-Date -Format 'yyyyMMdd-HHmmss'
        $log     = Join-Path $logDir "TASK-$n-$stamp.log"
        $raw     = Join-Path $logDir "TASK-$n-$stamp.jsonl"
        $started = Get-Date

        # Dois arquivos: .log com o que aparece na tela, .jsonl com o stream cru
        # (parâmetros de cada ferramenta, tokens) para quando algo der errado.
        # Tee-Object serviria para o .log, mas no PS 5.1 ele grava UTF-16LE e não
        # aceita -Encoding (o parâmetro só existe no PS 6+). StreamWriter dá UTF-8.
        $utf8    = New-Object System.Text.UTF8Encoding $false
        $writer  = New-Object System.IO.StreamWriter($log, $false, $utf8)
        # Sem AutoFlush o .log fica vazio ate a task terminar - inutil para
        # acompanhar de outra janela, que e justamente quando se quer ler.
        $writer.AutoFlush = $true
        $rawOut  = $null
        if ($streaming) { $rawOut = New-Object System.IO.StreamWriter($raw, $false, $utf8); $rawOut.AutoFlush = $true }
        $lastAt  = Get-Date

        function Show-Line([string] $text, [string] $color) {
            if ($color) { Write-Host $text -ForegroundColor $color } else { Write-Host $text }
            $writer.WriteLine($text)
        }

        try {
            # Prompt por stdin — ver o comentário na montagem de $cliArgs.
            $prompt | & $Cli @cliArgs | ForEach-Object {
                $line = [string] $_

                if (-not $streaming) {
                    Show-Line $line ''
                    return
                }

                $rawOut.WriteLine($line)

                $ev = $null
                try { $ev = $line | ConvertFrom-Json } catch { }
                if ($null -eq $ev) { if ($line) { Show-Line $line '' }; return }

                $now  = Get-Date
                $t    = '{0:mm\:ss}' -f ($now - $started)
                # Um silêncio longo é o modelo pensando: mostre-o em vez de sumir.
                $gap  = [int] ($now - $lastAt).TotalSeconds
                if ($gap -ge 60) { Show-Line ("[$t]   ({0}s pensando)" -f $gap) 'DarkGray' }
                $lastAt = $now

                switch ($ev.event) {
                    'init' {
                        Show-Line "[$t] sessao iniciada - $($ev.init.model)" 'DarkGray'
                    }
                    'step_update' {
                        $su = $ev.step_update
                        if ($su.step_type -eq 'tool' -and $su.state -eq 'ACTIVE') {
                            $arg = ''
                            if ($su.tool_info -and $su.tool_info.parameters) {
                                $first = $su.tool_info.parameters.PSObject.Properties | Select-Object -First 1
                                if ($first) { $arg = ([string] $first.Value) -replace '\s+', ' ' }
                                if ($arg.Length -gt 70) { $arg = '...' + $arg.Substring($arg.Length - 67) }
                            }
                            Show-Line "[$t] $($su.tool_name) $arg" 'Cyan'
                        }
                        elseif ($su.step_type -eq 'agent_response' -and $su.text_delta) {
                            Show-Line ($su.text_delta.TrimEnd()) ''
                        }
                    }
                    'result' {
                        $r = $ev.result
                        Show-Line ("[$t] {0} - {1}s, {2} turnos, {3} tokens" -f `
                            $r.status, [int] $r.duration_seconds, $r.num_turns, $r.usage.total_tokens) 'DarkGray'
                    }
                }
            }
            $status = $LASTEXITCODE
        } finally {
            $writer.Dispose()
            if ($rawOut) { $rawOut.Dispose() }
        }

        $elapsed = [int] ((Get-Date) - $started).TotalSeconds
        Write-Host ''
        Write-Host '------------------------------------------------------------------------'
        Write-Host "TASK-$n  saída=$status  tempo=${elapsed}s  log=$log"

        if ($status -ne 0) {
            $failed = $n
            Write-Host ''
            Write-Host "TASK-$n falhou. As tasks seguintes NÃO serão executadas." -ForegroundColor Red
            Write-Host 'Para retomar essa sessão de forma interativa:'
            Write-Host ''
            Write-Host "  cd `"$root`"; $resumeHint"
            Write-Host ''
            break
        }

        Write-Host ''

        if ($n -eq $lastTask) { continue }

        if (-not $Auto) {
            Write-Host "Revise o que a TASK-$n alterou (git diff) antes de seguir."
            $answer = Read-Host 'Enter para continuar, q para parar'
            if ($answer -eq 'q' -or $answer -eq 'Q') {
                Write-Host ''
                Write-Host "Interrompido pelo usuário após a TASK-$n."
                break
            }
            Write-Host ''
        }
    }
} finally {
    Set-Location $previous
}

if ($null -ne $failed) {
    Write-Host ''
    Write-Host "Encerrado com falha na TASK-$failed." -ForegroundColor Red
    exit 1
}

Write-Host ''
Write-Host 'Concluído.'
