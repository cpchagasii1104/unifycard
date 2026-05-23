# AUTHORITY ENFORCEMENT MODEL — UNIFICARD

Status: NORMATIVO · VIGENTE · COMPLEMENTAR
Tipo: MODELO DE ENFORCEMENT DE SOBERANIA
Escopo: GLOBAL

Subordinação:
- `CONSTITUICAO_UNIFICARD.md`
- `LEIS_OPERACIONAIS_UNIFICARD.md`
- `AUTHORITY_LAW.md`
- `SSOT_REGISTRY_UNIFICARD.md`
- `CORE_VS_MODULOS_CONTRACT.md`
- DECISION-0021 — Critério de Jurisdição do Core e Autoridade Soberana

---

## 1. FINALIDADE

Este documento transforma o princípio de soberania institucional em critérios operacionais verificáveis.

Ele existe para fazer a ponte entre:

- epistemologia arquitetural;
- autoridade normativa;
- SSOT por domínio;
- padrões detectáveis em código, schema e runtime;
- gates futuros de enforcement.

Este documento **não cria arquitetura nova**. Ele define como detectar, impedir ou sinalizar violação de autoridade já reconhecida.

---

## 2. DEFINIÇÕES FORMAIS

### 2.1 Soberania

Soberania é a autoridade legítima, reconhecida institucionalmente, sobre uma verdade compartilhada.

Uma verdade é soberana quando sua divergência entre módulos criaria realidade paralela.

### 2.2 Enforcement

Enforcement é o conjunto de mecanismos que impede, detecta ou sinaliza violação de soberania.

Enforcement pode ocorrer por:

- schema;
- foreign key;
- writer autorizado;
- porta oficial;
- gate;
- contrato;
- runtime guard;
- trigger;
- auditoria;
- falha fail-closed.

### 2.3 Core jurisdicional

Core jurisdicional é a autoridade sobre uma verdade compartilhada.

Core jurisdicional **não** é sinônimo de:

- diretório `/core`;
- import graph;
- rota registrada;
- tabela existente;
- `app.builder`;
- código usado por muitos módulos.

Pergunta obrigatória: **quem tem autoridade legítima sobre esta verdade?**

---

## 3. TAXONOMIA DE ESTRUTURAS

| Estrutura | Pode escrever? | Pode decidir? | Pode ser SSOT? | Regra |
|-----------|----------------|---------------|----------------|-------|
| SSOT soberano | Sim | Sim | Sim | Writer autorizado obrigatório |
| Cache | Sim | Não | Não | Reconstruível; não decide |
| Read model | Sim | Não | Não | Exposição/UX; não fonte primária |
| Projection | Sim | Não | Não | Derivada de SSOT explícito |
| Materialized view | Derivado | Não | Não | Não pode sobrescrever source |
| Snapshot | Congelado | Não | Não | Evidência temporal, não autoridade final |
| Mirror | Sincronizado | Não | Não | Deve preservar linhagem |
| Analytics copy | Sim | Não | Não | Métrica; não governa operação |
| Log | Append-only | Não | Não | Rastreabilidade, não decisão |

Qualquer estrutura derivada que passe a decidir comportamento de domínio sem retornar ao SSOT vira autoridade implícita e deve ser tratada como violação.

---

## 4. MODELO UNIVERSAL DE WRITER AUTORIZADO

Todo domínio soberano deve declarar:

- verdade governada;
- SSOT/tabela/estrutura canônica;
- writer autorizado;
- readers autorizados;
- portas oficiais;
- eventos oficiais;
- estruturas derivadas permitidas;
- estruturas proibidas;
- forma de enforcement atual;
- gate futuro desejado quando ainda não existir enforcement automático.

Sem writer autorizado declarado, nenhuma escrita pode ser tratada como legítima por conveniência de implementação.

---

## 5. CLASSES DE VIOLAÇÃO

| Classe | Exemplo | Gravidade | Definição |
|--------|---------|-----------|-----------|
| Shadow SSOT | `marketplace_balance` | Crítica | Nova fonte primária para verdade já soberana |
| Semantic Drift | `category_id` usado como identidade semântica | Alta | Semântica fora de CONCEPT/governança |
| Territorial Parallelism | `company.city_text`, `event_regions` | Alta | Território textual paralelo ao Location Core |
| Unauthorized Writer | módulo escrevendo `bank_ledger` | Crítica | Escrita fora do writer autorizado |
| Decision by Projection | read model decidindo negócio | Crítica | Derivado passa a governar estado |
| Authority Inversion | projection sobrescrevendo source | Crítica | Camada derivada vence SSOT |
| Hidden Canonicalization | módulo normaliza conceito próprio | Alta | Canonicalização local sem SSOT |
| Consent Bypass | operação usa dado sensível sem consentimento | Crítica | Workflow ignora autoridade de consentimento |
| Temporal Parallelism | agenda local por módulo | Alta | Tempo/disponibilidade fora da autoridade temporal |

---

## 6. HEURÍSTICAS DE DETECÇÃO

### 6.1 Possível SSOT paralelo

Sinalizar qualquer tabela, coluna, JSONB, service ou DTO que contenha termos como:

- `balance`, `saldo`, `wallet`, `ledger`;
- `city`, `state`, `region`, `address`, `location`, `cep`;
- `concept`, `category`, `semantic`;
- `availability`, `schedule`, `booking`, `calendar`;
- `consent`, `permission`, `authority`;
- `health`, `medical`, `condition`, `restriction`;
- `actor`, `identity`, `profile`.

Se a estrutura não tiver referência clara a SSOT, FK, porta oficial ou contrato normativo, abrir alerta arquitetural.

### 6.2 Possível decisão por derivado

Sinalizar quando cache, read model, snapshot, log ou analytics copy:

- define acesso;
- define preço;
- define saldo;
- define disponibilidade;
- define permissão;
- define identidade;
- atualiza estado canônico;
- alimenta transação irreversível.

### 6.3 Possível canonicalização escondida

Sinalizar normalização local de:

- status;
- categorias;
- localização;
- saúde;
- disponibilidade;
- dinheiro;
- identidade;
- consentimento;
- permissões.

Normalizar dado para UI é permitido. Normalizar para definir verdade compartilhada exige autoridade.

---

## 7. GATES FUTUROS DECLARADOS

| Gate futuro | Objetivo |
|-------------|----------|
| `validate-authority-writers` | Detectar writes ilegítimos fora do writer autorizado |
| `validate-shadow-ssot` | Detectar mini-core e SSOT paralelo |
| `validate-projection-authority` | Impedir decisão operacional por read model/projection |
| `validate-semantic-sovereignty` | Impedir semântica paralela fora de CONCEPT |
| `validate-location-authority` | Impedir território textual paralelo ao Location Core |
| `validate-ledger-authority` | Impedir saldo/ledger fora do Bank |
| `validate-consent-authority` | Impedir uso de dado sensível sem autoridade de consentimento |
| `validate-temporal-authority` | Impedir agenda/disponibilidade paralela |

Até existirem gates executáveis, qualquer achado dessas classes deve ser tratado como alerta institucional e não como detalhe cosmético.

---

## 8. PRECEDÊNCIA ENTRE SOBERANIAS

Quando múltiplas soberanias se cruzarem, aplica-se a autoridade mais restritiva ou mais específica sobre a verdade envolvida.

Regras iniciais:

- Consentimento vence operação de saúde.
- Authority vence produto, UI e projection.
- Ledger vence marketplace, checkout e relatórios.
- Availability vence booking, evento, consulta e serviço.
- Location vence nomes regionais livres em módulos.
- CONCEPT vence categorias locais e inferência por feature.
- Actor/Identity vence perfis, contas locais e aliases operacionais.

Exemplo:

Se `healthcare` quer marcar consulta, `availability` permite horário, `bank` permite pagamento, mas consentimento nega uso do dado sensível, a operação deve falhar fechada.

---

## 9. PUREZA TÉCNICA VS SOBERANIA

Core Purity e Sovereignty Enforcement medem coisas diferentes.

| Conceito | Mede | Limite |
|----------|------|--------|
| Core Purity | acoplamento técnico, imports, HTTP, SQL direto | Não prova autoridade correta |
| Sovereignty Enforcement | legitimidade epistemológica da fonte de verdade | Pode detectar violação mesmo sem import proibido |

`modules_import = 0` não implica arquitetura correta.

Pasta limpa pode esconder autoridade ilegítima.

Do mesmo modo, import proibido pode ser sinal de acoplamento físico sem provar, sozinho, violação de soberania. A auditoria deve separar os dois e registrar cada achado com sua natureza.

---

## 10. RELAÇÃO COM DECISION-0021

DECISION-0021 define a doutrina:

> Core = jurisdição sobre verdades compartilhadas.

Este documento define o primeiro modelo operacional para transformar essa doutrina em enforcement verificável.

Regra final:

> Nenhuma camada pode criar realidade paralela. Nenhuma estrutura derivada pode virar autoridade por acidente.

