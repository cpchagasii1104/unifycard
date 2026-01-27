# 🚀 EXECUÇÃO FINAL — CURSOR AI

> **Status**: PRONTO PARA APLICAR
> **Data**: 28/12/2024
> **Missão**: Deixar eventos 100% funcional

---

## ⚠️ PRÉ-REQUISITO (EXECUTAR PRIMEIRO)

```bash
# No terminal, executar o SQL de correção:
psql $DATABASE_URL < HOTFIX_MIGRATION_070.sql

# Verificar sucesso:
psql $DATABASE_URL -c "SELECT column_name FROM information_schema.columns WHERE table_name = 'posts' AND column_name IN ('event_id', 'type', 'visibility');"

# Deve retornar 3 linhas. Se não retornar, NÃO PROSSEGUIR.
```

---

## 📁 ARQUIVOS PRONTOS PARA COPIAR

Os arquivos abaixo estão **prontos para uso**. Copiar para os destinos indicados:

### 1. intentionMapping.ts (NOVO)

```
ORIGEM:  CODIGO_PRONTO/wizard/intentionMapping.ts
DESTINO: frontend/src/components/events/wizard/intentionMapping.ts
AÇÃO:    Criar arquivo novo
```

### 2. Step2EventType.tsx (SUBSTITUIR)

```
ORIGEM:  CODIGO_PRONTO/wizard/Step2EventType.tsx
DESTINO: frontend/src/components/events/wizard/Step2EventType.tsx
AÇÃO:    Substituir arquivo existente
```

### 3. Step2EventType.css (SUBSTITUIR)

```
ORIGEM:  CODIGO_PRONTO/wizard/Step2EventType.css
DESTINO: frontend/src/components/events/wizard/Step2EventType.css
AÇÃO:    Substituir arquivo existente
```

### 4. EventosPage.tsx (SUBSTITUIR)

```
ORIGEM:  CODIGO_PRONTO/pages/EventosPage.tsx
DESTINO: frontend/src/pages/EventosPage.tsx
AÇÃO:    Substituir arquivo existente
```

---

## ✅ VERIFICAÇÃO PÓS-APLICAÇÃO

### Teste 1: Página /eventos carrega

```
1. Acessar http://localhost:5173/eventos
2. Verificar que NÃO aparece erro "coluna p.event_id não existe"
3. Verificar que lista de eventos carrega (mesmo se vazia)
```

### Teste 2: Botão criar redireciona

```
1. Na página /eventos, clicar em "+ Criar evento"
2. Verificar que redireciona para /events/create (wizard)
3. Verificar que NÃO abre modal inline
```

### Teste 3: Step 2 mostra intenções

```
1. No wizard, avançar para Step 2
2. Verificar título: "O que você quer que aconteça?"
3. Verificar que aparecem 8 cards (user) ou 6 cards (page)
4. Cards devem ser:
   - 🎭 Apresentar algo
   - 🤝 Reunir pessoas
   - 🎓 Ensinar algo
   - 🎉 Celebrar algo
   - 🏆 Competir / Desafiar
   - 🙏 Inspirar / Conectar
   - 🍽️ Experiência gastronômica
   - 📣 Promover / Divulgar
```

### Teste 4: Seleção funciona

```
1. Selecionar "🎭 Apresentar algo"
2. Clicar em "Próximo"
3. Verificar que avança para Step 3
4. (Debug) No console, verificar que event_type = 'cultural'
```

### Teste 5: Permissões de actor

```
1. Alternar para Page/Empresa
2. Voltar ao wizard Step 2
3. Verificar que "Reunir pessoas" e "Celebrar algo" NÃO aparecem
```

---

## 🔴 SE ALGO FALHAR

### Erro: "coluna p.event_id não existe"
→ Migration 070 não foi aplicada. Executar HOTFIX_MIGRATION_070.sql

### Erro: "intentionMapping not found"
→ Arquivo não foi criado. Copiar para o destino correto.

### Erro: Step 2 mostra tipos antigos (Cultural, Gastronômico...)
→ Step2EventType.tsx não foi substituído. Verificar arquivo.

### Erro: Modal ainda aparece em /eventos
→ EventosPage.tsx não foi substituído. Verificar arquivo.

---

## 📊 RESUMO DE MUDANÇAS

| Arquivo | Ação | Linhas |
|---------|------|--------|
| `intentionMapping.ts` | CRIAR | ~150 |
| `Step2EventType.tsx` | SUBSTITUIR | ~130 → ~130 |
| `Step2EventType.css` | SUBSTITUIR | ~103 → ~120 |
| `EventosPage.tsx` | SUBSTITUIR | ~384 → ~230 |

**Total**: ~250 linhas removidas (modal), ~150 linhas adicionadas (mapeamento)

---

## 🏁 CRITÉRIO DE CONCLUSÃO

A implementação está **COMPLETA** quando TODOS os testes passarem:

- [x] Migration 070 aplicada
- [ ] /eventos carrega sem erro
- [ ] Botão criar redireciona para wizard
- [ ] Step 2 mostra 8 intenções
- [ ] Seleção envia event_type correto
- [ ] Permissões de actor funcionam

---

*Instruções para execução pelo Cursor AI*
*Não modificar sem aprovação*
