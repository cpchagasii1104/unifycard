# Alerta — Drift `schema_migrations` vs schema real (baseline pendente)

**Status:** registrado — **não executar nesta fase**  
**Data:** 2026-03-17  
**Tipo:** manutenção operacional (não evolução estrutural)

## O que ocorreu

- Ao rodar `pnpm run migrate`, a cadeia parou em **`0030_payment_intents.sql`** com erro: relação **`payment_intents` já existe**.
- **Conclusão:** o estado do banco **≠** o histórico registrado em **`schema_migrations`** (ou equivalente). Há **drift**.

## Ação obrigatória — **próxima janela dedicada**

| Quando | O quê |
|--------|--------|
| **Não agora** | Não corrigir drift nesta janela. |
| **Não misturar** | Não acoplar baseline à fase de produto/evolução em curso. |
| **Janela futura** | Alinhar **`schema_migrations`** ao schema real (baseline / reconciliação de registros), com procedimento explícito e backup. |

Classificação: **manutenção de plataforma**, não feature nem mudança de domínio de negócio.

## O que **não** fazer até a janela

- Não “forçar” migrations sequenciais sem baseline.
- Não apagar tabelas existentes só para satisfazer ordem numérica.
- Não misturar este trabalho com **Prompt 53** (risco / identidade / comportamento).

## Transição de domínio (oficial)

- **Fase financeira (core + reconciliação + marcação 0055):** **encerrada oficialmente.**
- **Domínio atual:** saída de **infra financeira** como foco; entrada em **controle de comportamento + identidade** (próxima linha de trabalho, após confirmação operacional).

---

*Este arquivo existe para que o drift não seja esquecido e não seja “consertado às cegas” no meio de outra fase.*
