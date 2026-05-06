Status: SUBORDINATED
Domain: UNKNOWN
Governing Contract: CORE_IMUTAVEL.md
# USER PROFILE CONTRACT — UnifiCard

**Status:** IMUTÁVEL • BLOQUEANTE • LEI DO SISTEMA

Este documento define o **contrato canônico do Perfil do Usuário** no UnifiCard.
Ele existe para **impedir o nascimento de um anticore informacional**.
Qualquer violação deste contrato é **erro arquitetural estrutural** e deve **falhar CI**.

---

## 1. Definição Canônica

> **O Perfil do Usuário é exclusivamente um READ MODEL DE VISUALIZAÇÃO.**

Ele existe para **apresentar informações agregadas ao humano**.
Ele **não é** fonte de verdade, **não decide**, **não classifica**, **não habilita**, **não bloqueia**.

---

## 2. Natureza do Perfil

- Tipo: **Read Model / Projeção**
- Consistência: **Eventual**
- Autoridade: **Nenhuma**
- Escrita: **Proibida fora do pipeline de projeção**

O Perfil **não possui soberania semântica** sobre nenhum dado que influencia o comportamento do sistema.

---

## 3. O que o Perfil PODE conter (permitido)

### 3.1 Dados puramente descritivos
- Nome público
- Avatar
- Bio textual
- Links públicos

### 3.2 Dados agregados de visualização
- Listas de habilidades (referências)
- Interesses declarados
- Histórico resumido (timeline visual)
- Métricas exibidas **sem efeito sistêmico**

### 3.3 Inferências observacionais (sem efeito)
- Sugestões
- Insights
- Rótulos informativos **não acionáveis**

> Toda inferência deve ser **explicitamente marcada como observacional**.

---

## 4. O que é EXPLICITAMENTE PROIBIDO no Perfil

O Perfil **NUNCA pode conter**:

- Flags de decisão
- Estados operacionais
- Permissões
- Limites
- Scores acionáveis
- Classificações confiáveis
- Categorias sem evento versionado

Exemplos **PROIBIDOS**:
- `is_premium`
- `risk_level`
- `trust_score`
- `can_post`
- `can_transact`
- `user_tier`

Se influencia comportamento → **não pertence ao perfil**.

---

## 5. Categorias — Regra Absoluta

Categorias **NÃO podem** existir no Perfil como verdade.

Se uma categoria:
- classifica usuário
- habilita/desabilita ações
- altera experiência de forma sistêmica

Ela **DEVE** existir como:
- Evento explícito
- Regra versionada
- Com data de início/fim

O Perfil pode **apenas exibir** o resultado.

Categoria sem evento = **MENTIRA HISTÓRICA**.

---

## 6. Passado e Auditoria

- O Perfil **não guarda passado canônico**
- O Perfil **pode ser descartado e reconstruído**
- O Perfil **não explica decisões**

Explicabilidade pertence a:
- Eventos
- Ledger
- Decision Logs

---

## 7. Boundary Rules (fronteiras obrigatórias)

### 7.1 Quem PODE ler o Perfil
- Frontend (UI)
- Serviços de renderização
- Sistemas de recomendação **observacionais**

### 7.2 Quem NUNCA pode ler o Perfil
- Write side
- Serviços de decisão
- Economia
- Permissões
- Policies

Qualquer import do Perfil em write side → **BLOQUEAR BUILD**.

---

## 8. Teste Ácido

Se o Perfil do Usuário ficar indisponível:

- ❌ Pagamentos NÃO param
- ❌ Autenticação NÃO falha
- ❌ Decisões NÃO quebram
- ✅ Apenas a experiência visual degrada

Se qualquer fluxo crítico quebrar → **Perfil virou Core** (erro grave).

---

## 9. Checklist de Auditoria Automática (CI)

CI deve falhar se:

- [ ] Write side importar Perfil
- [ ] Perfil for usado em condicionais de decisão
- [ ] Perfil contiver categoria sem evento
- [ ] Perfil influenciar comportamento
- [ ] Perfil for tratado como fonte de verdade

---

## 10. Regra Final (Lei do Sistema)

> "O Perfil do Usuário serve exclusivamente para visualização agregada ao humano
> e nunca para decisão, classificação, permissão, bloqueio ou substituição de fatos,
> políticas ou regras versionadas."

---

**Violação deste contrato não é bug funcional.**
**É falha arquitetural estrutural.**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- CORE_IMUTAVEL.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- IDENTITY_CORE_CONTRACT.md
<!-- AUTO-GENERATED-END -->