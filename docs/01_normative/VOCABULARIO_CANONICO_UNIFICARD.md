# VOCABULARIO_CANONICO_UNIFICARD.md

Status: CANÔNICO · VIGENTE · NÃO INTERPRETÁVEL
Tipo: DOCUMENTO NORMATIVO
Escopo: GLOBAL
Subordinação:

* CONSTITUICAO_UNIFICARD.md
* LEIS_OPERACIONAIS_UNIFICARD.md
* SSOT_REGISTRY_UNIFICARD.md
* 18_DOMAIN_ONTOLOGY_UNIFICARD.md

---

## 1. FINALIDADE

Este documento define o **VOCABULÁRIO CANÔNICO OBRIGATÓRIO** do sistema UnifiCard.

Seu objetivo é:

* eliminar ambiguidade semântica
* garantir consistência entre módulos
* impedir variações arbitrárias de valores
* unificar backend, frontend, banco e eventos

Este documento:

* NÃO define comportamento
* NÃO define regras de negócio
* NÃO define lógica operacional

Ele define exclusivamente:

> **quais valores são válidos no sistema**

---

## 2. PRINCÍPIO FUNDAMENTAL

> **Nenhum valor fora deste documento pode existir no sistema.**

Aplicação obrigatória em:

* banco de dados
* APIs
* contracts
* eventos
* frontend
* integrações externas

Qualquer valor fora deste vocabulário:

→ DEVE ser rejeitado
→ NÃO pode ser persistido
→ NÃO pode ser transformado silenciosamente

---

## 3. NATUREZA CANÔNICA

O vocabulário canônico:

* pertence à camada **SEMÂNTICA**
* é governado por **CONCEPT** quando aplicável
* é complementar ao **SSOT_REGISTRY** — ver `SSOT_REGISTRY_UNIFICARD.md` (§**5.12** identidade semântica; §**5.16** authority / permissão)

Ele NÃO é:

* enum solto
* convenção de frontend
* validação local

---

## 4. REGRA DE SINCRONIZAÇÃO

O vocabulário deve existir em duas formas:

1. **Normativa (este documento)**
2. **Executável (@unificard/contracts)**

Regra obrigatória:

> divergência entre normativa e código = falha estrutural grave

---

## 5. ESTRUTURA

Cada domínio de vocabulário deve seguir o padrão:

* Nome do domínio
* Lista de valores permitidos
* Fonte executável
* Observações (quando necessário)

---

## 6. DOMÍNIOS CANÔNICOS

---

### 6.1 GENDER

Valores permitidos:

* male
* female
* non_binary
* other
* prefer_not_to_say

Fonte executável:
`packages/contracts/src/vocabulary/gender.ts` (pacote `@unificard/contracts`)

---

### 6.2 LANGUAGE

Valores permitidos (ISO 639-1):

* pt
* en
* es

Fonte executável:
`packages/contracts/src/vocabulary/language.ts` (pacote `@unificard/contracts`)

---

### 6.3 COUNTRY

Valores permitidos (ISO 3166-1 alpha-2):

* BR
* US
* AR

Fonte executável:
`packages/contracts/src/vocabulary/country.ts` (pacote `@unificard/contracts`)

---

### 6.4 CURRENCY

Valores permitidos (ISO 4217):

* BRL
* USD
* EUR

Fonte executável:
`packages/contracts/src/vocabulary/currency.ts` (pacote `@unificard/contracts`)

---

### 6.5 TIMEZONE

Valores permitidos (IANA):

* America/Sao_Paulo
* America/New_York
* Europe/Lisbon

Fonte executável:
`packages/contracts/src/vocabulary/timezone.ts` (pacote `@unificard/contracts`)

---

## 7. PROIBIÇÕES ABSOLUTAS

É proibido:

* criar novos valores fora deste documento
* aceitar valores livres (strings abertas)
* mapear valores automaticamente (ex: "brasil" → "BR")
* normalizar silenciosamente
* duplicar vocabulário em múltiplos lugares

---

## 8. RELAÇÃO COM OUTRAS CAMADAS

### 8.1 COM CONCEPT

Quando um vocabulário representar uma entidade semântica:

→ deve referenciar ou derivar de CONCEPT

---

### 8.2 COM SSOT

Vocabulário:

* NÃO é SSOT de dados
* é SSOT de **validação semântica**

---

### 8.3 COM FINANCEIRO

Campos como:

* currency

impactam diretamente:

* bank_ledger
* liquidação
* reconciliação

Erro de vocabulário → erro financeiro

---

### 8.4 COM AUTORIDADE

Vocabulário inválido pode bloquear:

* KYC
* elegibilidade
* permissões

---

## 9. VERSIONAMENTO DE VOCABULÁRIO

Os vocabulários canónicos têm **evolução versionada implicitamente**: cada alteração na lista fechada ou em `@unificard/contracts` corresponde a uma nova geração do contrato semântico.

### 9.1 Regras

* **Novos valores** podem ser acrescentados de forma **retrocompatível** (leitores antigos passam a aceitar um superset após deploy coordenado).
* **Valores existentes não podem ser removidos** sem:
  * migração explícita de dados (ou política de convivência documentada);
  * auditoria;
  * registo em `docs/ssot/FALSIFICATION_LOG.md` ou `docs/04_audit/FALSIFICATION_LOG.md`, conforme processo em vigor.
* **Valores depreciados** devem:
  * permanecer **válidos para leitura** e para validação de dados históricos;
  * ser **bloqueados para escrita** em novos fluxos quando a norma assim o declarar (transição explícita).
* **Eventos e registos históricos** não são reescritos por mudança de vocabulário; agregações e leitores devem tolerar valores de gerações anteriores ou mapear de forma explícita na norma/migração.

### 9.2 Sincronização obrigatória

Qualquer mudança de vocabulário exige atualização **simultânea** de:

1. este documento (e `07_NOMENCLATURA_CANONICA.md` quando o domínio estiver no glossário);
2. `SSOT_REGISTRY_UNIFICARD.md` §5.12 (e §5.11 quando aplicável), se alterar o papel de SSOT de validação semântica;
3. `@unificard/contracts` (`packages/contracts/src/vocabulary/`).

---

## 10. GOVERNANÇA

Alterações neste documento:

* exigem justificativa formal
* devem ser versionadas
* devem atualizar contracts simultaneamente

---

## 11. AUDITORIA

Este documento:

* é critério de validação em APIs
* é usado em auditoria de dados
* é base para validação de integridade

---

## 12. SUPREMACIA

Este documento prevalece sobre:

* decisões de frontend
* convenções locais
* inputs externos
* integrações

---

## FRASE FINAL

> **Se o sistema não fala a mesma língua, ele não é um sistema.**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 07_NOMENCLATURA_CANONICA.md
- 18_DOMAIN_ONTOLOGY_UNIFICARD.md
- CONSTITUICAO_UNIFICARD.md
- LEIS_OPERACIONAIS_UNIFICARD.md
- SSOT_REGISTRY_UNIFICARD.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- LEI_DE_COERENCIA_SISTEMICA_UNIFICARD.md
<!-- AUTO-GENERATED-END -->