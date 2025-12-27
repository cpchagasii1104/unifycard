# Auditoria e Limpeza de Categorias Profissionais

## Objetivo

Garantir que a árvore PROFISSIONAL contenha APENAS profissões válidas, reconhecidas pelo mercado de trabalho.

## Definição Canônica de Profissão

Uma profissão é uma atividade econômica lícita, exercida por pessoa física ou jurídica, com possibilidade de prestação de serviço, vínculo empregatício ou regulamentação formal (ex: CBO, conselhos, sindicatos, mercado PJ/CLT).

## Scripts Disponíveis

### 1. Auditoria (`audit-professional-categories-invalid.js`)

Identifica categorias inválidas sem removê-las.

**Uso:**
```bash
cd backend
node scripts/audit-professional-categories-invalid.js
```

**Saída:**
- Lista de categorias inválidas por tipo
- Estatísticas de validação
- SQL gerado para remoção (em `docs/dev/sql/remove-invalid-professional-categories.sql`)

### 2. Limpeza (`cleanup-invalid-professional-categories.js`)

Remove (arquiva) categorias inválidas encontradas.

**Uso:**
```bash
cd backend
node scripts/cleanup-invalid-professional-categories.js
```

**Atenção:** Este script arquiva categorias permanentemente. Execute apenas após revisar a auditoria.

## Regras de Validação

### Categorias Bloqueadas (BLOCK)

1. **Conteúdo sexual explícito:**
   - punheteiro, prostituta, acompanhante sexual, etc.

2. **Crimes ou atividades ilegais:**
   - ladrão, traficante, golpista, hacker criminoso, etc.

3. **Discurso de ódio, preconceito ou violência:**
   - nazista, terrorista, etc.

4. **Termos genéricos que NÃO são profissão:**
   - futebol, música, arte, comida, academia
   - **Exceção:** Versões qualificadas são permitidas:
     - ✅ "Jogador de Futebol"
     - ✅ "Músico"
     - ✅ "Ator"
     - ❌ "Futebol" (genérico)

### Categorias Condicionais (REVIEW)

Termos ambíguos que requerem revisão humana:
- coach, influencer, youtuber, streamer
- empreendedor, consultor, freelancer

## Política de Admissão

A política de admissão é aplicada **ANTES** de criar a hierarquia (`ensureCompleteHierarchy`).

**Fluxo:**
1. `suggestCategoryPath` - IA classifica o termo
2. **Política de Admissão** - Valida se pode criar
3. Se `BLOCK` → Erro (não cria nada)
4. Se `REVIEW` → Cria com status `pending_review` (sem hierarquia)
5. Se `ALLOW` → Cria hierarquia completa

## Exemplos de Validação

| Termo | Contexto | Resultado | Motivo |
|-------|----------|-----------|--------|
| "Punheteiro" | professional | ❌ BLOCK | Conteúdo sexual |
| "Ladrão" | professional | ❌ BLOCK | Crime |
| "Futebol" | professional | ❌ BLOCK | Termo genérico |
| "Jogador de Futebol" | professional | ✅ ALLOW | Profissão qualificada |
| "Dentista" | professional | ✅ ALLOW | Profissão reconhecida |
| "Zelador" | professional | ✅ ALLOW | Profissão reconhecida |
| "Coach" | professional | ⚠️ REVIEW | Termo ambíguo |
| "Futebol" | interest | ✅ ALLOW | Permitido como interesse |

## Critério de Done

- ✅ A árvore profissional contém apenas profissões válidas
- ✅ "Punheteiro", "Ladrão", "Futebol" NÃO podem ser criados no contexto profissional
- ✅ "Jogador de Futebol", "Dentista", "Zelador" funcionam
- ✅ IA rejeita entradas inválidas antes de criar grupo/subgrupo
- ✅ Política aplicada antes de `ensureCompleteHierarchy`















