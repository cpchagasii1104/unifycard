# 📋 CHECKLIST TÉCNICO DE IMPLEMENTAÇÃO — CONTRATO DE EVENTOS v1

**Derivado de:** CONTRATO_EVENTOS_V1.md  
**Status:** ATIVO  
**Versão:** 1.0  
**Data:** 28/12/2025

---

## 🎯 OBJETIVO

Garantir implementação correta do sistema de eventos conforme CONTRATO DE EVENTOS v1, seguindo ordem linear e checkpoints obrigatórios.

---

## ⚠️ REGRAS ABSOLUTAS

1. ✅ Siga o checklist exatamente na ordem
2. ✅ Não pule fases
3. ✅ Não improvise
4. ✅ Cada fase só avança após checkpoint OK
5. ✅ Sempre salvar arquivos
6. ✅ Ao final de cada fase, listar:
   - Arquivos criados
   - Arquivos modificados
   - O que foi feito
   - O que NÃO foi feito propositalmente

---

## 📦 FASE 0 — PRÉ-REQUISITOS

**Objetivo:** Validar que o ambiente está pronto para implementação do sistema de eventos.

### ✅ 0.1 — Ambiente de Desenvolvimento

- [ ] **Node.js instalado e funcionando**
  - [ ] Versão: Node.js 18+ ou 20+
  - [ ] Comando: `node --version`
  - [ ] Comando: `npm --version`

- [ ] **Dependências instaladas**
  - [ ] Backend: `backend/node_modules` existe
  - [ ] Frontend: `frontend/node_modules` existe
  - [ ] Contracts: `packages/contracts/node_modules` existe
  - [ ] Raiz: `node_modules` existe (se aplicável)

- [ ] **Build de Contracts funcionando**
  - [ ] Comando: `npm run build:contracts` (ou equivalente)
  - [ ] Critério: Build completa sem erros
  - [ ] Verificar: `packages/contracts/dist/` contém arquivos compilados

### ✅ 0.2 — Banco de Dados

- [ ] **PostgreSQL rodando**
  - [ ] Serviço ativo
  - [ ] Conexão testada
  - [ ] Variáveis de ambiente configuradas (`.env`)

- [ ] **Migrations executadas**
  - [ ] Todas as migrations aplicadas
  - [ ] Tabela `events` existe (se aplicável)
  - [ ] Tabela `cultural_events` existe (se aplicável)
  - [ ] Tabelas do CORE existem (identity, economy, feed, actors)

### ✅ 0.3 — Backend

- [ ] **Backend compila sem erros**
  - [ ] Comando: `cd backend && npm run build` (ou `tsc`)
  - [ ] Critério: Nenhum erro de TypeScript
  - [ ] Warnings são aceitáveis, erros não

- [ ] **Backend inicia corretamente**
  - [ ] Comando: `cd backend && npm run dev` (ou equivalente)
  - [ ] Health check: `GET http://localhost:3000/health` retorna 200
  - [ ] Logs sem erros críticos

- [ ] **Módulos do CORE ativos**
  - [ ] Identity: `/api/identity/*` ou equivalente
  - [ ] Economy: `/api/economy/*` ou `/api/unifybank/*`
  - [ ] Feed: `/api/feed/*` ou `/api/social/feed`
  - [ ] Actors: `/api/actors/*` ou equivalente

### ✅ 0.4 — Frontend

- [ ] **Frontend compila sem erros**
  - [ ] Comando: `cd frontend && npm run build` (ou `npm run dev`)
  - [ ] Critério: Nenhum erro de TypeScript/compilação
  - [ ] Warnings são aceitáveis, erros não

- [ ] **Frontend acessível**
  - [ ] URL: `http://localhost:5173` (ou porta configurada)
  - [ ] Página carrega sem erros no console
  - [ ] Login funciona (se aplicável)

### ✅ 0.5 — Integração Backend-Frontend

- [ ] **API Base URL configurada**
  - [ ] Frontend `.env` ou `vite.config.ts` aponta para backend correto
  - [ ] Teste: Frontend consegue fazer requisições ao backend
  - [ ] CORS configurado (se necessário)

- [ ] **Contracts sincronizados**
  - [ ] Frontend importa de `@unificard/contracts`
  - [ ] Tipos TypeScript estão corretos
  - [ ] Build de contracts executado antes de build do frontend

### ✅ 0.6 — Validação do CONTRATO DE EVENTOS

- [ ] **CONTRATO_EVENTOS_V1.md lido e compreendido**
  - [ ] Princípios fundamentais entendidos
  - [ ] Regras arquiteturais conhecidas
  - [ ] Taxonomia de `event_type` conhecida

- [ ] **Estado atual do sistema mapeado**
  - [ ] Sistema atual de eventos identificado
  - [ ] Gaps conhecidos documentados
  - [ ] Compatibilidade com legado entendida

---

## ✅ CHECKPOINT FASE 0

**Critério de aprovação:**
- ✅ Todos os itens acima marcados como concluídos
- ✅ Backend rodando e acessível
- ✅ Frontend rodando e acessível
- ✅ Banco de dados migrado
- ✅ Contracts compilados
- ✅ CONTRATO DE EVENTOS compreendido

**Se algum item falhar:**
- ❌ Documentar o problema
- ❌ Não avançar para Fase 1
- ❌ Resolver o problema antes de continuar

---

## 📝 PRÓXIMAS FASES

- **FASE 1:** [A ser definida após Fase 0]
- **FASE 2:** [A ser definida após Fase 1]
- ...

---

## 📌 NOTAS

- Este checklist é **obrigatório** antes de qualquer implementação
- Cada fase deve ser **completamente validada** antes de avançar
- Problemas encontrados devem ser **documentados** antes de prosseguir






