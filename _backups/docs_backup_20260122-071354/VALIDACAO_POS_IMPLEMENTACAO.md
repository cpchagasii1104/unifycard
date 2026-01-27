# ✅ VALIDAÇÃO PÓS-IMPLEMENTAÇÃO — EVENTOS

> **Executar APÓS aplicar migration 070 e copiar arquivos**
> **Data**: ___________
> **Responsável**: ___________

---

## PRÉ-REQUISITO

```sql
-- Deve retornar 3 linhas
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name IN ('event_id', 'type', 'visibility');
```

- [ ] Retornou 3 linhas → Prosseguir
- [ ] Não retornou → PARAR e executar HOTFIX_MIGRATION_070.sql

---

## TESTE 1: Página /eventos carrega

| Passo | Ação | Resultado Esperado | ✓/✗ |
|-------|------|-------------------|-----|
| 1.1 | Acessar `/eventos` | Página carrega sem erro | |
| 1.2 | Verificar console | Sem erro "coluna p.event_id" | |
| 1.3 | Lista de eventos | Renderiza (mesmo se vazia) | |

---

## TESTE 2: Botão criar redireciona para wizard

| Passo | Ação | Resultado Esperado | ✓/✗ |
|-------|------|-------------------|-----|
| 2.1 | Clicar "+ Criar evento" | Redireciona para `/events/create` | |
| 2.2 | Verificar | NÃO abre modal inline | |
| 2.3 | URL | Deve ser `/events/create` ou `/events/new` | |

---

## TESTE 3: Step 2 mostra intenções

| Passo | Ação | Resultado Esperado | ✓/✗ |
|-------|------|-------------------|-----|
| 3.1 | Avançar para Step 2 | Título: "O que você quer que aconteça?" | |
| 3.2 | Contar cards | 8 cards visíveis (se user) | |
| 3.3 | Verificar cards | 🎭🤝🎓🎉🏆🙏🍽️📣 presentes | |

---

## TESTE 4: Seleção de intenção funciona

| Passo | Ação | Resultado Esperado | ✓/✗ |
|-------|------|-------------------|-----|
| 4.1 | Clicar "🎭 Apresentar algo" | Card fica selecionado | |
| 4.2 | Clicar "Próximo" | Avança para Step 3 | |
| 4.3 | (Dev) Console/Network | event_type = 'cultural' | |

---

## TESTE 5: Permissões de actor

| Passo | Ação | Resultado Esperado | ✓/✗ |
|-------|------|-------------------|-----|
| 5.1 | Logar como Pessoa Física | — | |
| 5.2 | Ir para Step 2 | 8 cards visíveis | |
| 5.3 | Alternar para Page/Empresa | — | |
| 5.4 | Ir para Step 2 | 6 cards (sem 🤝 e 🎉) | |

---

## TESTE 6: Criação completa (fluxo happy path)

| Passo | Ação | Resultado Esperado | ✓/✗ |
|-------|------|-------------------|-----|
| 6.1 | Step 1: Actor | Actor detectado automaticamente | |
| 6.2 | Step 2: Intenção | Selecionar qualquer uma | |
| 6.3 | Step 3: Contexto | Preencher título, data, local | |
| 6.4 | Step 4: Economia | Escolher gratuito ou preço | |
| 6.5 | Step 5: Revisão | Ver resumo completo | |
| 6.6 | Publicar | Evento criado com sucesso | |

---

## TESTE 7: Unificação feed ↔ /eventos

| Passo | Ação | Resultado Esperado | ✓/✗ |
|-------|------|-------------------|-----|
| 7.1 | Criar evento via wizard | Sucesso | |
| 7.2 | Ir para `/social` (feed) | Evento aparece no feed | |
| 7.3 | Ir para `/eventos` | Mesmo evento aparece | |

---

## RESULTADO FINAL

| Teste | Status |
|-------|--------|
| 1. Página carrega | |
| 2. Botão redireciona | |
| 3. Step 2 intenções | |
| 4. Seleção funciona | |
| 5. Permissões actor | |
| 6. Fluxo completo | |
| 7. Unificação | |

### Veredito

- [ ] **APROVADO** — Todos os testes passaram
- [ ] **REPROVADO** — Falhas identificadas (listar abaixo)

### Falhas (se houver)

```
Teste X.X:
- Comportamento esperado:
- Comportamento real:
- Screenshot/Log:
```

---

## ASSINATURA

```
Validado por: _______________
Data: _______________
Ambiente: [ ] Local [ ] Staging [ ] Produção
```

---

*Checklist criado em 28/12/2024*
*Referência: PROPOSTA_STEP2_INTENCAO_FINAL.md*
