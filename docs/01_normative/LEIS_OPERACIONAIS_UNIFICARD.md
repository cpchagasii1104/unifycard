# ═══════════════════════════════════════════════════════════════════════════
# SEÇÃO II — LEIS OPERACIONAIS
# ═══════════════════════════════════════════════════════════════════════════

> Leis entram em vigor conforme indicado. Lei 2 é especial.

## Lei 1: Sequência Obrigatória

```
Genesis → Backend → Frontend → Declaração
```

**Não inverter. Não pular. Não paralelizar.**

---

## Lei 2: Forward-Only

**⚠️ ATIVAÇÃO ESPECIAL: Somente após tag `GENESIS_CONSTITUCIONAL_v1`**

Antes da tag:
- Migrations do Genesis podem ser ajustadas
- Correções permitidas durante fases 0-3

Após a tag:
- Nenhuma migration do Genesis pode ser alterada
- Correções apenas via novas migrations (0006+)
- Qualquer edição em 0001-0005 = VIOLAÇÃO CONSTITUCIONAL

---

## Lei 3: Falha Deve Falhar

**PROIBIDO em migrations constitucionais:**
- CREATE TABLE IF NOT EXISTS
- ADD COLUMN IF NOT EXISTS (para colunas estruturais)
- ON CONFLICT DO NOTHING (sem justificativa)
- DO $$ EXCEPTION WHEN duplicate_object

**EXCEÇÕES CONTROLADAS:**

| Artefato | Permitido | Motivo |
|----------|-----------|--------|
| CREATE INDEX IF NOT EXISTS | ✅ | Índices são idempotentes |
| DROP TRIGGER IF EXISTS + CREATE TRIGGER | ✅ | Triggers são substituíveis |
| CREATE OR REPLACE FUNCTION | ✅ | Functions são substituíveis |
| CREATE OR REPLACE VIEW | ✅ | Views são substituíveis |

---

## Lei 4: Estrutura Prevalece

- NOT NULL permanece NOT NULL (só remove FK)
- ENUM não pode ser reduzido
- Trigger não pode chamar função inexistente

---

## Lei 5: SSOT Absoluto

- UnifyBank é única fonte de verdade financeira
- **Nenhum ledger paralelo**
- **Nenhum split fora do bank_splits**
- **Nenhum saldo fora do bank_ledger**

---

## Lei 6: Rastreabilidade Total

- Cada fase gera commit isolado
- Cada fase gera tag
- **Nenhum arquivo pode ser editado em múltiplas fases**
- Hash antes/depois de cada edição

---

## REGRA DE AMBIENTE (CRÍTICA)

> **OBRIGATÓRIO:** Execução de migrations somente em ambiente recriado do zero.

```powershell
# SEMPRE antes de rodar migrations
dropdb -h localhost -U postgres unificard_dev
createdb -h localhost -U postgres -E UTF8 unificard_dev
```

**Execução fora de ambiente recriado = VIOLAÇÃO**

---

