# ESCOPO — GATE DE NOMENCLATURA CANÔNICA

## RAIZ DE VARREDURA
backend/src

---

## ALLOWLIST — PASTAS
Somente as seguintes categorias são permitidas:

- **/dto/**
- **/dtos/**
- **/types/**
- **/interfaces/**
- **/enums/**
- **/mappers/**

Qualquer arquivo fora dessas pastas NÃO pode ser tocado.

---

## ALLOWLIST — TIPOS DE ARQUIVO
Somente arquivos com os seguintes padrões:

- *.dto.ts
- *.types.ts
- *.interface.ts
- *.enum.ts
- *Enum.ts
- *Mapper.ts
- *.map.ts

---

## EXCLUSÕES EXPLÍCITAS (PROIBIDO TOCAR)

- *.service.ts
- *.repository.ts
- *.controller.ts
- *.handler.ts
- *.usecase.ts
- **/jobs/**
- **/workers/**
- **/migrations/**
- **/sql/**
- **/seeds/**
- **/config/**
- **/infra/**
- Qualquer arquivo fora de backend/src

---

## REGRAS DE EXECUÇÃO (IMUTÁVEIS)

1. Execução inicial OBRIGATORIAMENTE em dry-run
2. Geração obrigatória de:
   - diff
   - log de alterações
   - contagem de arquivos afetados
3. Substituições apenas determinísticas (1 → 1)
4. Nenhuma criação de campo novo
5. Nenhuma renomeação de arquivo
6. Nenhuma alteração de lógica ou fluxo

---

## AUDITORIA E ROLLBACK

- Toda execução deve gerar log em docs/03_execution_log/
- Rollback deve ser possível via:
  - git
  - ou cópia prévia dos arquivos afetados

---

## CONDIÇÃO DE BLOQUEIO

Se qualquer arquivo fora deste escopo for modificado:
→ EXECUÇÃO INVALIDADA
→ Gate permanece ABERTO
→ Correção obrigatória antes de novo attempt
