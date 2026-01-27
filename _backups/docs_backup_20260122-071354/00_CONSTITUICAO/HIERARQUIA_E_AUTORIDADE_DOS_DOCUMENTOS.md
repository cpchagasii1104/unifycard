# HIERARQUIA E AUTORIDADE DOS DOCUMENTOS — UNIFICARD

## OBJETIVO
Eliminar ambiguidade institucional.

Este documento define, de forma inquestionável:
- qual documento tem autoridade sobre qual;
- o que fazer quando dois textos parecem dizer coisas diferentes.

Vinculante para:
- todas as IAs (Guardiã, Executora, Gestora de Docs),
- todos os desenvolvedores,
- qualquer decisão arquitetural, funcional ou institucional.

---

## PRINCÍPIO FUNDAMENTAL

❗ Nenhum documento de nível inferior pode:
- contradizer,
- reinterpretar,
- flexibilizar,
- ou criar conceito paralelo

a um documento de nível superior.

Se isso ocorrer → BLOQUEAR a ação até corrigir os documentos.

---

## NÍVEIS DE AUTORIDADE (do mais forte para o mais fraco)

---

## 🟥 NÍVEL 1 — CORE E CONTRATOS (BINDING / LEI DO SISTEMA)

Autoridade máxima. Nada pode violar, contornar ou reinterpretar.

Se uma solicitação conflitar com qualquer item aqui → RECUSAR.

Documentos deste nível (devem existir na pasta treinamento):

- CORE_IMUTAVEL.md
- AGENDA_UNIVERSAL_CONTRACT.md
- IDENTITY_CORE_CONTRACT.md
- DECISION_CORE_CONTRACT.md
- Category_System_Contract_UnifiCard.md
- Decision_Safety_and_Containment_Contract.md
- Database_Canonical_Truth_Contract.md
- OBSERVABILIDADE_CONSTITUCIONAL.md
- CORE_VS_MODULOS_CONTRACT.md
- MATRIZ_FONTES_DE_VERDADE.md

Regras absolutas:
- o sistema não decide, não infere, não improvisa
- categorias nunca decidem comportamento
- banco é estado, não verdade
- auditoria é append-only
- tempo/data/disponibilidade pertencem exclusivamente à Agenda Universal
- identidade/actor/permissões pertencem exclusivamente ao sistema de Actors
- decisão/autorização pertencem exclusivamente ao authorization.service

---

## 🟧 NÍVEL 2 — GOVERNANÇA E GUARDRAILS (BINDING / LIMITES)

Definem limites e proibições. Não criam exceções ao Nível 1.

- GOVERNANCA_E_VISAO_CANONICA_UNIFICARD.md
- ARCHITECTURAL_GUARDRAILS.md
- CURSOR_GUARDRAILS.md

---

## 🟦 NÍVEL 3 — ROLES DE IA (COMPORTAMENTO)

Definem como cada IA deve agir (sem criar regras novas):

- ROLE_GUARDIA.md
- ROLE_EXECUTORA.md
- ROLE_GESTORA_DOCS.md

Se um role conflitar com níveis superiores → o role está errado.

---

## 🟩 NÍVEL 4 — CHECKLISTS E OPERAÇÃO (GATE)

Guias operacionais. Nunca sobrepõem Core/Contratos.

- CHECK_DUPLICIDADE_OBRIGATORIO.md
- CHECKLIST_CANONICO_PRE_IMPLEMENTACAO.md (se existir; se não existir, não referenciar)
- MODULARIDADE_E_UPSELL.md

📌 Regra:
- CHECK_DUPLICIDADE_OBRIGATORIO.md é o checkpoint zero.
- Nenhuma IA pode pular esse gate.

---

## REGRA DE RESOLUÇÃO DE CONFLITOS

1) Conflito entre documentos → vence o nível mais alto.  
2) Conflito no mesmo nível → BLOQUEAR e corrigir docs.  
3) README/índices desatualizados → corrigir docs antes de mexer em código.

---

## REGRA ANTI–CORE PARALELO (CRÍTICA)

É proibido criar mecanismos paralelos quando tocar:

- tempo, data, agenda, disponibilidade → AGENDA_UNIVERSAL_CONTRACT.md
- identidade / actor / permissões → IDENTITY_CORE_CONTRACT.md
- decisão / autorização → DECISION_CORE_CONTRACT.md
- fonte de verdade do banco → Database_Canonical_Truth_Contract.md
- decisão / automação → Decision_Safety_and_Containment_Contract.md
- observabilidade → OBSERVABILIDADE_CONSTITUCIONAL.md

📌 Regra explícita:
> “Se algo toca tempo, data, agenda ou disponibilidade, assume-se Agenda Universal até prova canônica em contrário.”

Sem autorização explícita → BLOQUEAR.

---

## CONCLUSÃO CANÔNICA

No UnifiCard:
- documentos não competem
- níveis não se misturam
- exceções não existem
- duplicação é erro institucional

Na dúvida → recusar e corrigir os documentos primeiro.
