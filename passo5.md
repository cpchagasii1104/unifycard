```
MODO: GUARDIÃO — somente leitura e verificação. Zero alterações de código. Zero commits de código.
Único commit permitido: o relatório final em docs/03_execution_log/.

NÃO editar nenhum arquivo de código.
NÃO propor correções.
NÃO fechar violações novas.
NÃO criar migrations.
NÃO refatorar nada.
Se descobrir problema novo: documentar no relatório e PARAR.

---

## CONTEXTO OBRIGATÓRIO — leia antes de qualquer ação

Projeto: UnifiCard — super-app financeiro multi-tenant.
Branch: rescue-structural
Diretório: C:\unificard\

Esta sessão executa APENAS o PASSO 5 (validação global) de uma remediação maior.
Os PASSOs 1-4 foram executados em sessão anterior. Resultado:

Commits já aplicados (não alterar):
- 0272141c — C57 FIXED: FK authority_roots → actors confirmada
- c153f27a — C47 FIXED: actor_has_permission retorna FALSE (fail-closed)
- 7770f061 — C55 FIXED: authority-decision.service strict/permissive mode
- 0e4e68c0 — C54 parcial: gates em 6 arquivos de usuário
- e035f60d — novos achados documentados
- aa83ad11 — C54 complementar: rota HTTP /transfer removida
- 6ac66653 — C54: gates em social-work-payment, test-currency, distribution @system-context
- 55c1e212 — docs: relatório PASSO 5 validação global
- 90b44784 — C54: gate em assignment.complete e work-instant.complete
- b72e35d2 — C54: remover POST /auto de distribution.routes (rota sem actor)
- 2fd1a5ac — C44: bloquear parentGroupId e createdByUserId em group.service

Arquivos tocados no C54 (sessão anterior):

TIER A — gate adicionado diretamente no service:
- backend/src/modules/escrow/escrow.service.ts (releaseFunds + refundFunds)
- backend/src/modules/gateway/payment-event-resolver.ts (PIX payment)
- backend/src/modules/marketplace/payout.service.ts

TIER B — gate adicionado a montante na rota:
- backend/src/modules/marketplace/application/services/capacity-application.service.ts
- backend/src/modules/marketplace/application/services/marketplace-orchestration.service.ts

TIER C — @system-context documentado (sem gate, motor interno):
- backend/src/core/economy/transaction.service.ts
- backend/src/core/economy/transactions/transaction.routes.ts (rota /transfer removida)

Tesouraria — classificação final (decisão tomada):
- backend/src/modules/marketplace/regional-fund.service.ts → @system-context (callers são scripts de tesouraria, sem actor HTTP)
- backend/src/modules/treasury-split/treasury-split.service.ts → @system-context (caller único é worker via setInterval)
- backend/src/core/economy/distribution/distribution.service.ts → @system-context (rota /auto removida em b72e35d2)
- backend/src/core/economy/split.service.ts → gates nas rotas upstream (assignment.routes + status.routes — commits 90b44784)

Gate usado: requireFinancialRiskClearance
Importado de: @modules/risk-identity/risk-financial-gate

---

## COMPATIBILIDADE DE COMANDOS (obrigatório ler)

Este ambiente é Windows. Comandos bash/grep/find/sed NÃO funcionam nativamente.

Regra: se grep não estiver disponível, usar equivalente:
- PowerShell: Select-String -Path <arquivo> -Pattern <padrão> -Recurse
- ou ripgrep: rg <padrão> <caminho>

NÃO pular sweep por falha de comando.
NÃO simplificar busca.
NÃO assumir resultado sem executar.
Se comando falhar: reportar erro completo e usar alternativa.

---

## DEFINIÇÃO CRÍTICA — "MESMO FLUXO DE EXECUÇÃO"

O gate requireFinancialRiskClearance é válido APENAS se:
- está no mesmo bloco lógico linear do transfer
- NÃO está dentro de if/try/catch que possa não executar quando o transfer executa
- NÃO está em função separada chamada antes
- NÃO está após await que altere o fluxo de controle
- NÃO está em branch if/else diferente do branch onde está o transfer

Exemplos de gate INVÁLIDO (não conta):

```typescript
// ❌ gate em branch que transfer não percorre
if (needsGate) {
  await requireFinancialRiskClearance(...)
}
await bankTransactionService.transfer(...) // transfer executa independente do if
```

```typescript
// ❌ gate em try, transfer em catch
try {
  await requireFinancialRiskClearance(...)
} catch {
  await bankTransactionService.transfer(...) // gate não executou
}
```

```typescript
// ❌ gate em função separada
async function checkGate() { await requireFinancialRiskClearance(...) }
async function doTransfer() { await bankTransactionService.transfer(...) } // fluxos separados
```

Se houver qualquer dúvida sobre se é mesmo fluxo: classificar como SEM_GATE e reportar.

---

## SWEEP 1 — Callers de transfer/capture/reverse com evidência de código

Executar busca de todos os callers em produto (excluindo testes e domínio bank):

```powershell
Get-ChildItem backend/src -Recurse -Include *.ts |
  Where-Object { $_.FullName -notmatch '__tests__|\.spec\.|\.test\.|modules\\bank\\' } |
  Select-String -Pattern 'bankTransactionService\.(transfer|capture|reverse)'
```

Para CADA arquivo encontrado:
1. Abrir o arquivo
2. Localizar cada chamada a transfer/capture/reverse
3. Verificar se tem requireFinancialRiskClearance OU @system-context ANTES da chamada,
   no mesmo fluxo de execução (usar definição acima)
4. Colar obrigatoriamente no output:

```
Arquivo: <caminho completo>
Linha do gate ou @system-context: <N>
Linha do transfer/capture/reverse: <N>
Trecho colado:
---
<10 linhas acima do gate>
<bloco completo do gate>
<chamada ao transfer/capture/reverse>
<10 linhas abaixo>
---
Classificação: GATE_REAL | POSSIVEL_SYSTEM_CONTEXT | SEM_GATE

REGRA DE ORDEM (OBRIGATÓRIA — Sweeps 1 e 2):

No Sweep 1 não existe classificação SYSTEM_CONTEXT definitiva (essa decisão é só após o Sweep 2).

Se houver comentário explícito @system-context no código e o trecho sugerir motor de sistema (sem gate no mesmo fluxo):
→ classificar como POSSIVEL_SYSTEM_CONTEXT
→ validação final do mesmo arquivo ocorre obrigatoriamente no Sweep 2

Se parecer system-context mas a evidência for incompleta no Sweep 1:
→ POSSIVEL_SYSTEM_CONTEXT ou SEM_GATE conforme o trecho; nunca SYSTEM_CONTEXT neste sweep

É PROIBIDO marcar SYSTEM_CONTEXT no Sweep 1 (terminologia reservada ao veredito consolidado após o Sweep 2).
```

REGRA ABSOLUTA: marcar como OK sem colar o trecho = inválido.
Se classificação for SEM_GATE: PARAR. Não continuar para Sweep 2.
Se classificação for POSSIVEL_SYSTEM_CONTEXT: continuar obrigatoriamente para o Sweep 2 (validar o mesmo arquivo lá).
Reportar o arquivo e trecho completo. Aguardar instrução.

---

## SWEEP 2 — Auditoria de @system-context

Localizar todas as ocorrências de @system-context no repositório:

```powershell
Get-ChildItem backend/src -Recurse -Include *.ts |
  Select-String -Pattern '@system-context' |
  Where-Object { $_.Path -notmatch '\.spec\.|\.test\.|__tests__' }
```

Para cada ocorrência, verificar as 3 condições de INV-SYS:

Condição 1: Não há userId/actorId vindo de HTTP no caller
→ verificar se a função recebe parâmetros de request HTTP ou sessão de usuário

Condição 2: Worker/processor identificado por nome no comentário @system-context
→ o comentário deve nomear explicitamente qual worker/processor chama este código

Condição 3: Nenhuma rota HTTP leva a este call — direto OU indireto
→ buscar em *.routes.ts qualquer import ou referência ao service/função
→ se não for possível PROVAR ausência de rota HTTP: classificar como FALSO_SYSTEM_CONTEXT
→ NÃO assumir ausência de rota sem verificar

Colar resultado por ocorrência:
```
Arquivo: <caminho> linha <N>
Condição 1 (sem actor HTTP): OK | FALHA | NÃO VERIFICÁVEL
Condição 2 (worker identificado): OK | FALHA
Condição 3 (sem rota HTTP — verificado): OK | FALHA | NÃO VERIFICÁVEL
Veredito: VÁLIDO | FALSO_SYSTEM_CONTEXT | NÃO VERIFICÁVEL
```

REGRA DE CONSISTÊNCIA (OBRIGATÓRIA):

Se QUALQUER condição for NÃO VERIFICÁVEL:
→ o Veredito DEVE ser NÃO VERIFICÁVEL
→ NÃO pode ser marcado como VÁLIDO

Se houver inconsistência entre condições e Veredito:
→ PARAR e reportar

Se o Veredito for FALSO_SYSTEM_CONTEXT ou NÃO VERIFICÁVEL: PARAR e reportar.

---

## SWEEP 3 — Guard anti-vazamento de AUTHORITY_MODE

Verificar o arquivo backend/src/core/compliance/authority-decision.service.ts.

Localizar a função getAuthorityMode() e colar o trecho exato abaixo.
Verificar na leitura do código (sem executar):

1. A função existe no arquivo?
2. Contém verificação explícita de process.env.NODE_ENV !== 'development'?
3. Lança Error com mensagem contendo 'AUTHORITY_MODE_PERMISSIVE_LEAKED_OUTSIDE_DEV'?

Colar:
```
Trecho da função getAuthorityMode():
---
<código completo da função>
---
Condição 1 (função existe): SIM | NÃO
Condição 2 (verifica NODE_ENV): SIM | NÃO
Condição 3 (lança erro correto): SIM | NÃO
Classificação: GUARD_PRESENTE | GUARD_AUSENTE | GUARD_INCOMPLETO
```

Se GUARD_AUSENTE ou GUARD_INCOMPLETO: PARAR e reportar.

Depois tentar executar (se dist/ existir compilado):

```powershell
$env:AUTHORITY_MODE="permissive"
$env:NODE_ENV="production"
node -e "require('./backend/dist/core/compliance/authority-decision.service.js'); console.log('ERRO: deveria ter lancado');" 2>&1
$env:NODE_ENV="development"
```

Esperado: lança erro com AUTHORITY_MODE_PERMISSIVE_LEAKED_OUTSIDE_DEV.
Se não lançar: registrar como falha adicional.
Se dist/ não existir: registrar que teste runtime não foi executado (não é bloqueante).

---

## SWEEP 4 — ensureUserActor antes de actorId nos TIER A

Para os arquivos TIER A que recebem actor de usuário:
- backend/src/modules/escrow/escrow.service.ts
- backend/src/modules/marketplace/payout.service.ts

Executar para cada arquivo:

```powershell
Select-String -Path <arquivo> -Pattern 'ensureUserActor|resolveActorIdForWalletOwner|requireFinancialRiskClearance|actorId' |
  ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim())" }
```

Verificar: a resolução de actor deve aparecer em linha MENOR que o gate,
que deve aparecer em linha MENOR que o transfer.

Se actorId for usado antes de ensureUserActor no mesmo fluxo: PARAR e reportar.

VALIDAÇÃO ADICIONAL DE FLUXO:

A ordem de linhas (actor → gate → transfer) é NECESSÁRIA, mas NÃO suficiente.

Confirmar também:
- que todas as chamadas estão no MESMO bloco lógico
- que não há if/else, try/catch ou branches separando gate e transfer
- que não há caminhos onde o transfer executa sem passar pelo gate

Se houver qualquer ambiguidade de fluxo:
→ PARAR e reportar como fluxo inválido

---

## SWEEP 5 — Linhas órfãs em authority_roots

```powershell
psql -U postgres -d unificard_dev -P pager=off -c "
SELECT COUNT(*) AS orphans
FROM authority_roots ar
LEFT JOIN actors a ON a.id = ar.actor_id
WHERE a.id IS NULL;"
```

Se comando psql falhar:
→ PARAR imediatamente
→ NÃO continuar para próximos sweeps
→ reportar erro completo. NÃO ignorar. NÃO assumir resultado 0.
Esperado: 0 orphans. Se > 0: PARAR.

---

## SWEEP 6 — Ordem identidade → gate → transfer nos TIER A

Para cada arquivo TIER A:
- backend/src/modules/escrow/escrow.service.ts
- backend/src/modules/gateway/payment-event-resolver.ts
- backend/src/modules/marketplace/payout.service.ts

```powershell
$files = @(
  'backend/src/modules/escrow/escrow.service.ts',
  'backend/src/modules/gateway/payment-event-resolver.ts',
  'backend/src/modules/marketplace/payout.service.ts'
)
foreach ($f in $files) {
  Write-Host "`n=== $f ==="
  Select-String -Path $f -Pattern 'ensureUserActor|resolveActorIdForWalletOwner|requireFinancialRiskClearance|bankTransactionService\.(transfer|capture|reverse)' |
    ForEach-Object { "L$($_.LineNumber): $($_.Line.Trim().Substring(0, [Math]::Min(120, $_.Line.Trim().Length)))" }
}
```

Para cada arquivo, a sequência de números de linha deve mostrar:
1. Resolução de actor (linha menor)
2. Gate requireFinancialRiskClearance (linha intermediária)
3. Transfer/capture/reverse (linha maior)

Se múltiplas funções no arquivo: analisar cada função individualmente.
Se ordem invertida em qualquer fluxo: PARAR e reportar. Não reordenar.

VALIDAÇÃO ADICIONAL DE FLUXO:

A ordem de linhas (actor → gate → transfer) é NECESSÁRIA, mas NÃO suficiente.

Confirmar também:
- que todas as chamadas estão no MESMO bloco lógico
- que não há if/else, try/catch ou branches separando gate e transfer
- que não há caminhos onde o transfer executa sem passar pelo gate

Se houver qualquer ambiguidade de fluxo:
→ PARAR e reportar como fluxo inválido

---

## SWEEP 7 — Consistência de actor (mesma variável no gate e no transfer)

Para cada arquivo TIER A e TIER B:

```powershell
$files = @(
  'backend/src/modules/escrow/escrow.service.ts',
  'backend/src/modules/gateway/payment-event-resolver.ts',
  'backend/src/modules/marketplace/payout.service.ts',
  'backend/src/modules/marketplace/application/services/capacity-application.service.ts',
  'backend/src/modules/marketplace/application/services/marketplace-orchestration.service.ts'
)
foreach ($f in $files) {
  Write-Host "`n=== $f ==="
  Select-String -Path $f -Pattern 'requireFinancialRiskClearance|bankTransactionService\.(transfer|capture|reverse)' -Context 4,4
}
```

Para cada ocorrência, colar:
```
Arquivo: <caminho>
actorId passado ao gate: <nome exato da variável>
actorId passado ao transfer: <nome exato da variável>
Mesma variável (mesmo nome e mesma origem): SIM | NÃO
```

Se NÃO: PARAR e reportar o bloco completo.
Se houver qualquer dúvida: PARAR e reportar. Não marcar SIM sem certeza.

---

## SWEEP 8 — 4 gates finais

```powershell
cd C:/unificard/backend
pnpm run validate:actor-writer-boundaries 2>&1 | Select-Object -Last 10
pnpm run validate:bank-ledger-boundaries 2>&1 | Select-Object -Last 10
pnpm run validate:regression-guards 2>&1 | Select-Object -Last 10
node C:/unificard/scripts/validate-architectural-patterns.mjs --strict 2>&1 | Select-Object -Last 10
```

Todos devem passar. Se qualquer falhar: PARAR e reportar output completo.

---

## RELATÓRIO FINAL (único commit permitido nesta sessão)

Após todos os sweeps concluídos sem PARADA, criar:
docs/03_execution_log/2026-04-22-quadrinho-autoridade.md

Conteúdo obrigatório:
- Commits desta fase (lista acima)
- Resultado de cada sweep: OK | FALHA | PAROU
- Evidência de código do Sweep 1 (colada integralmente)
- Resultado do Sweep 2 por ocorrência
- Trecho da getAuthorityMode() do Sweep 3
- Resultado do Sweep 5 (query psql)
- Sequência de linhas do Sweep 6 por arquivo
- Tabela de consistência de actor do Sweep 7
- Output dos 4 gates do Sweep 8
- Tier final de cada arquivo C54
- Desvios desta fase:
  * C55: +61 linhas sem autorização prévia (executado sem "go")
  * PASSO 3-4 executados sem aguardar "go" entre eles
- Total de linhas alteradas na fase (soma dos commits)
- Estado final: C47 FIXED | C54 FIXED (completo — transaction.service.ts @system-context validado) | C55 FIXED | C57 FIXED

Commit do relatório:
```
git add docs/03_execution_log/2026-04-22-quadrinho-autoridade.md
git commit -m "docs(authority): relatório PASSO 5 — validação global quadrinho [FASE 4]"
```

---

## REGRAS DE ENCERRAMENTO

1. Não declarar quadrinho fechado. Clayton valida o relatório.
2. Não declarar FASE 4 concluída. Ainda faltam C52, C53, C56 e 4 gates novos.
3. Se qualquer sweep retornar PARADA: sessão encerra naquele ponto, estado reportado.
4. Não tentar resolver problemas novos encontrados nos sweeps.

## Estado pós-sessão 2026-04-23

- C47: FIXED
- C54: FIXED (completo — transaction.service.ts @system-context validado)
- C55: FIXED
- C57: FIXED
- C44: FIXED (group.service.ts — parentGroupId e createdByUserId bloqueados explicitamente)
- C52: RFC C52 — path alvo `docs/02_decisions/RFC_C52_payment_intents_dual_writer.md` (aguarda 3 perguntas ao BD + aprovação; criar o ficheiro na aprovação)
- C53: PENDENTE
- C56: PENDENTE
- 4 gates novos da auditoria forense: PENDENTE

---

Ao receber este prompt, responder com:
1. Confirmação de leitura do contexto (commits, tiers, arquivos)
2. Declaração de MODO: GUARDIÃO
3. Confirmação de que zero alterações de código serão feitas
4. Confirmação da definição de "mesmo fluxo de execução"
5. Confirmação de compatibilidade: usará PowerShell/Select-String se grep não disponível

Aguardar "go" antes de iniciar Sweep 1.
```