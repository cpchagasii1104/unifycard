# Script de organização de documentação - Unificard
# Move arquivos da raiz para /docs seguindo estrutura padrão

$ErrorActionPreference = "Continue"

# Criar pasta _archive se não existir
$archivePath = "docs\_archive"
if (-not (Test-Path $archivePath)) {
    New-Item -ItemType Directory -Path $archivePath -Force | Out-Null
}

# Mapeamento de arquivos para destinos
$moves = @(
    @{Source="ANTI_PATTERNS.md"; Dest="docs\architecture\anti_patterns.md"},
    @{Source="ARQUIVOS_CRITICOS.md"; Dest="docs\architecture\arquivos_criticos.md"},
    @{Source="PADRAO_ARQUITETURAL_MODULOS.md"; Dest="docs\architecture\padrao_arquitetural_modulos.md"},
    @{Source="ENGINEERING_README.md"; Dest="docs\architecture\engineering_readme.md"},
    @{Source="RELATORIO_AUDITORIA.md"; Dest="docs\audit\relatorio_auditoria.md"},
    @{Source="BUILD_VALIDATION_REPORT.md"; Dest="docs\audit\build_validation_report.md"},
    @{Source="ESTABILIZACAO_TYPESCRIPT_RELATORIO_FINAL.md"; Dest="docs\audit\estabilizacao_typescript_relatorio_final.md"},
    @{Source="RELATORIO_CORRECOES_TYPESCRIPT.md"; Dest="docs\audit\relatorio_correcoes_typescript.md"},
    @{Source="DIAGNOSTICO_BACKEND_OFFLINE.md"; Dest="docs\audit\diagnostico_backend_offline.md"},
    @{Source="DIAGNOSTICO_EVENTOS_A.md"; Dest="docs\audit\diagnostico_eventos_a.md"},
    @{Source="DIAGNOSTICO_FINAL.md"; Dest="docs\audit\diagnostico_final.md"},
    @{Source="RELATORIO_BACKEND_CONNECTION.md"; Dest="docs\audit\relatorio_backend_connection.md"},
    @{Source="EVENT_CTA_AUDIT_REPORT.md"; Dest="docs\audit\event_cta_audit_report.md"},
    @{Source="SMOKE_TEST_CHECKLIST.md"; Dest="docs\checklist\smoke_test_checklist.md"},
    @{Source="SMOKE_TEST_ANALYSIS.md"; Dest="docs\checklist\smoke_test_analysis.md"},
    @{Source="SMOKE_TEST_READY.md"; Dest="docs\checklist\smoke_test_ready.md"},
    @{Source="SMOKE_TEST_RESULTS.md"; Dest="docs\checklist\smoke_test_results.md"},
    @{Source="GOLDEN_PATH_SMOKE_TEST.md"; Dest="docs\checklist\golden_path_smoke_test.md"},
    @{Source="GOLDEN_PATH.md"; Dest="docs\checklist\golden_path.md"},
    @{Source="VALIDACAO_AMBIENTE_FINAL.md"; Dest="docs\checklist\validacao_ambiente_final.md"},
    @{Source="VALIDACAO_FINAL_COMPLETA.md"; Dest="docs\checklist\validacao_final_completa.md"},
    @{Source="VALIDACAO_POS_IMPLEMENTACAO.md"; Dest="docs\checklist\validacao_pos_implementacao.md"},
    @{Source="RELATORIO_VALIDACAO_FINAL_EVENTOS.md"; Dest="docs\checklist\relatorio_validacao_final_eventos.md"},
    @{Source="GUIA_EXECUCAO_LOCAL.md"; Dest="docs\dev\guia_execucao_local.md"},
    @{Source="INICIAR_BACKEND.md"; Dest="docs\dev\iniciar_backend.md"},
    @{Source="CONFIGURAR_AUTO_START_WINDOWS.md"; Dest="docs\dev\configurar_auto_start_windows.md"},
    @{Source="CONFIGURAR_FRONTEND.md"; Dest="docs\dev\configurar_frontend.md"},
    @{Source="CONTRIBUTING.md"; Dest="docs\dev\contributing.md"},
    @{Source="INICIAR_AGORA.md"; Dest="docs\dev\iniciar_agora.md"},
    @{Source="LEIA_ME_PRIMEIRO.txt"; Dest="docs\dev\leia_me_primeiro.txt"},
    @{Source="LEIA_PRIMEIRO.md"; Dest="docs\dev\leia_primeiro.md"},
    @{Source="TESTE_DIRETO.md"; Dest="docs\dev\teste_direto.md"},
    @{Source="REGULAMENTO_EXECUCAO.md"; Dest="docs\dev\regulamento_execucao.md"},
    @{Source="README_AUTO_START.md"; Dest="docs\dev\readme_auto_start.md"},
    @{Source="INSTRUCOES_CURSOR_FINAL.md"; Dest="docs\prompts\instrucoes_cursor_final.md"},
    @{Source="GUIA_CORRECAO_CURSOR.md"; Dest="docs\prompts\guia_correcao_cursor.md"},
    @{Source="COMANDO_PARA_CURSOR.txt"; Dest="docs\prompts\comando_para_cursor.txt"},
    @{Source="EDGE_CASES_EVENTOS.md"; Dest="docs\decisions\edge_cases_eventos.md"},
    @{Source="ESTADO_ATUAL_MODULO_EVENTOS.md"; Dest="docs\decisions\estado_atual_modulo_eventos.md"},
    @{Source="IMPLEMENTACAO_IDENTITY_STATUS_GATE.md"; Dest="docs\decisions\implementacao_identity_status_gate.md"},
    @{Source="MAPEAMENTO_AUTENTICACAO_FASE3.md"; Dest="docs\decisions\mapeamento_autenticacao_fase3.md"},
    @{Source="PROPOSTA_STEP2_INTENCAO_FINAL.md"; Dest="docs\decisions\proposta_step2_intencao_final.md"},
    @{Source="SPEC_DASHBOARD_CONFIANCA.md"; Dest="docs\decisions\spec_dashboard_confianca.md"},
    @{Source="PROFILES.md"; Dest="docs\decisions\profiles.md"},
    @{Source="FLUXO_VISUAL_DINHEIRO.md"; Dest="docs\decisions\fluxo_visual_dinheiro.md"},
    @{Source="STATUS_ATUAL_PROJETO.md"; Dest="docs\decisions\status_atual_projeto.md"},
    @{Source="CHANGELOG_RECENTE.md"; Dest="docs\_archive\changelog_recente.md"},
    @{Source="PRIMEIRA_TAREFA_PLANEJAMENTO.md"; Dest="docs\_archive\primeira_tarefa_planejamento.md"},
    @{Source="RELATORIO_PASSO_3_3.md"; Dest="docs\_archive\relatorio_passo_3_3.md"},
    @{Source="RESUMO_CORRECOES_BOOTSTRAP.md"; Dest="docs\_archive\resumo_correcoes_bootstrap.md"},
    @{Source="RESUMO_CORRECOES_FINAIS.md"; Dest="docs\_archive\resumo_correcoes_finais.md"},
    @{Source="RESUMO_PARA_CONTINUIDADE.md"; Dest="docs\_archive\resumo_para_continuidade.md"},
    @{Source="RESUMO_SISTEMA_AUTO_START.md"; Dest="docs\_archive\resumo_sistema_auto_start.md"},
    @{Source="ERRO_CORRIGIDO.md"; Dest="docs\_archive\erro_corrigido.md"},
    @{Source="PROBLEMA_RESOLVIDO.md"; Dest="docs\_archive\problema_resolvido.md"},
    @{Source="SOLUCAO_RAPIDA.md"; Dest="docs\_archive\solucao_rapida.md"},
    @{Source="VEREDITO_APLICADO.md"; Dest="docs\_archive\veredito_aplicado.md"},
    @{Source="HIGIENE_REPOSITORIO_RELATORIO.md"; Dest="docs\_archive\higiene_repositorio_relatorio.md"},
    @{Source="GUIA_COMPARACAO_ZIP_CL AUDIA.md"; Dest="docs\_archive\guia_comparacao_zip_claudia.md"},
    @{Source="FLUXO_VISUAL_DINHEIRO (1).md"; Dest="docs\_archive\fluxo_visual_dinheiro_duplicado.md"},
    @{Source="RESUMO_PROBLEMA_BACKEND.txt"; Dest="docs\_archive\resumo_problema_backend.txt"}
)

$moved = @()
$errors = @()

foreach ($move in $moves) {
    $source = $move.Source
    $dest = $move.Dest
    if (Test-Path $source) {
        try {
            $destDir = Split-Path $dest -Parent
            if (-not (Test-Path $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Move-Item -Path $source -Destination $dest -Force
            $moved += @{Source=$source; Dest=$dest}
            Write-Host "OK: $source -> $dest" -ForegroundColor Green
        } catch {
            $errors += @{Source=$source; Error=$_.Exception.Message}
            Write-Host "ERRO: $source - $_" -ForegroundColor Red
        }
    }
}

$scriptsDir = "docs\dev\scripts"
if (-not (Test-Path $scriptsDir)) {
    New-Item -ItemType Directory -Path $scriptsDir -Force | Out-Null
}

Get-ChildItem -Filter "*.ps1" -File | Where-Object { $_.Name -ne "organize_docs.ps1" } | ForEach-Object {
    try {
        $dest = Join-Path $scriptsDir $_.Name.ToLower()
        Move-Item -Path $_.FullName -Destination $dest -Force
        $moved += @{Source=$_.Name; Dest=$dest}
        Write-Host "OK script: $($_.Name)" -ForegroundColor Green
    } catch {
        $errors += @{Source=$_.Name; Error=$_.Exception.Message}
    }
}

Get-ChildItem -Filter "*.bat" -File | ForEach-Object {
    try {
        $dest = Join-Path $scriptsDir $_.Name.ToLower()
        Move-Item -Path $_.FullName -Destination $dest -Force
        $moved += @{Source=$_.Name; Dest=$dest}
        Write-Host "OK batch: $($_.Name)" -ForegroundColor Green
    } catch {
        $errors += @{Source=$_.Name; Error=$_.Exception.Message}
    }
}

Get-ChildItem -Filter "*.log" -File | ForEach-Object {
    try {
        $dest = Join-Path $archivePath $_.Name.ToLower()
        Move-Item -Path $_.FullName -Destination $dest -Force
        $moved += @{Source=$_.Name; Dest=$dest}
        Write-Host "OK log: $($_.Name)" -ForegroundColor Green
    } catch {
        $errors += @{Source=$_.Name; Error=$_.Exception.Message}
    }
}

Get-ChildItem -Filter "*ts-errors.txt" -File | ForEach-Object {
    try {
        $dest = Join-Path $archivePath $_.Name.ToLower()
        Move-Item -Path $_.FullName -Destination $dest -Force
        $moved += @{Source=$_.Name; Dest=$dest}
        Write-Host "OK txt: $($_.Name)" -ForegroundColor Green
    } catch {
        $errors += @{Source=$_.Name; Error=$_.Exception.Message}
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "RELATORIO DE ORGANIZACAO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Arquivos movidos: $($moved.Count)" -ForegroundColor Green
Write-Host "Erros: $($errors.Count)" -ForegroundColor $(if ($errors.Count -eq 0) { "Green" } else { "Red" })
