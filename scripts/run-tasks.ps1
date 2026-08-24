<#
.SYNOPSIS
Executa as tasks da feature "Grupos e permissões" chamando o Claude Code CLI em modo
não-interativo, uma task por sessão. Equivalente PowerShell de scripts/run-tasks.sh.

.DESCRIPTION
O prompt de cada execução é o "Prompt mestre" + o prompt da task, extraídos dos blocos
de código de docs/grupos-e-permissoes/PROMPT-IMPLEMENTACAO.md. Esse arquivo é a única
fonte de verdade: editar lá muda o que o script envia.

AVISO: -Auto encadeia tasks sem revisão humana. A ordem 2 -> 3 -> 4 passa por um
intervalo em que o projeto NÃO compila (User.role sai do schema antes de os usos serem
removidos), então um gate de build entre tasks daria falso negativo. Sem revisão entre
tasks, um erro na TASK-2 se propaga silenciosamente até a TASK-15. O padrão é pausar.

.PARAMETER Selection
Um número (7), um intervalo (1-4), uma lista (5,6,7) ou 'all'.

.EXAMPLE
.\scripts\run-tasks.ps1 -List
.EXAMPLE
.\scripts\run-tasks.ps1 -DryRun 1
.EXAMPLE
.\scripts\run-tasks.ps1 1-4
.EXAMPLE
.\scripts\run-tasks.ps1 -Auto -Model opus 5,6,7
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
    [string] $Model,
    [string] $Effort,
    [string] $Cli = 'claude'
)

$ErrorActionPreference = 'Stop'

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
if (-not (Get-Command $Cli -ErrorAction SilentlyContinue)) { Fail "CLI não encontrado no PATH: $Cli" }

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

$permissionMode = 'acceptEdits'
if ($Yolo) { $permissionMode = 'bypassPermissions' }

$cliArgs = @('-p', '--output-format', 'text', '--permission-mode', $permissionMode)
if ($Model)  { $cliArgs += @('--model', $Model) }
if ($Effort) { $cliArgs += @('--effort', $Effort) }

Write-Host ''
Write-Host "CLI:        $Cli $($cliArgs -join ' ')"
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

        $log     = Join-Path $logDir ("TASK-$n-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        $started = Get-Date

        # O prompt vai por stdin: evita problemas de escape com aspas, quebras de linha e acentos.
        $prompt | & $Cli @cliArgs | Tee-Object -FilePath $log
        $status = $LASTEXITCODE

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
            Write-Host "  cd `"$root`"; claude --continue"
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
