# REPORTING CORE — UnifiCard

Status: **Ativo**
Versão: **1.0**
Owner: **Core / Trust & Safety**
Escopo: **Sistema central de denúncias, triagem, auditoria e risco**

---

## 🎯 Objetivo

Centralizar denúncias de todo o ecossistema UnifiCard (grupos, prestadores, empresas, motoristas, posts, etc.)
em um único núcleo (core), permitindo:

- Auditoria unificada e rastreável
- Gestão de tickets com status e resposta ao denunciante
- Conexão com cidade/tenant e módulos de origem
- Detecção de padrões (luz amarela/vermelha) via motor de risco
- Evolução para IA de Trust & Safety

---

## 🧠 Princípio Central

> Denúncia não pertence ao módulo denunciado.  
> O módulo denunciado emite eventos para o Core de Denúncias.

Isso evita duplicação e garante visão completa do risco em toda a plataforma.

---

## 🧩 Conceitos e Termos

- **Reporter**: quem denuncia
- **Target**: entidade denunciada (grupo, usuário, empresa, serviço, etc.)
- **Module**: de onde a denúncia veio (ex: groups, marketplace, mobility)
- **Tenant/City**: território (cidade/tenant) onde ocorreu o fato
- **Case/Ticket**: denúncia acompanhável com status e histórico
- **Risk Score**: pontuação agregada para sinalização de risco

---

## ✅ Escopo do Core

O Core deve suportar denúncias para qualquer entidade do sistema, incluindo (não limitado a):

- Grupo
- Usuário (admin, criador, prestador)
- Empresa / estabelecimento
- Prestador de serviço (manicure, encanador, etc.)
- Motorista / mobilidade
- Conteúdo (post, comentário, mídia)
- Transação / cobrança (futuro)

---

## 🧱 Modelo Canônico (contrato)

### 1) Report (Denúncia / Ticket)

Campos mínimos obrigatórios:

- `report_id` (UUID)
- `reporter_user_id` (UUID) — quem denunciou
- `target_type` (ENUM) — tipo do alvo denunciado
- `target_id` (UUID/string) — id do alvo
- `module` (ENUM/string) — módulo de origem (ex: groups, marketplace, mobility, social, finance)
- `tenant_id` (UUID/string) — território/cidade
- `reason_code` (ENUM) — motivo (fraude, abuso, etc.)
- `description` (TEXT) — texto livre (opcional, mas recomendado)
- `status` (ENUM) — fluxo do ticket
- `severity` (ENUM) — severidade calculada ou definida
- `created_at`, `updated_at`, `resolved_at`

### ENUMs sugeridos

#### target_type
- `GROUP`
- `USER`
- `COMPANY`
- `PROVIDER`
- `DRIVER`
- `SERVICE`
- `POST`
- `COMMENT`
- `TRANSACTION` (futuro)

#### module
- `groups`
- `marketplace`
- `mobility`
- `social`
- `finance`
- `profiles`
- `other`

#### reason_code
- `FRAUD`
- `SCAM`
- `ABUSE`
- `HARASSMENT`
- `INAPPROPRIATE_CONTENT`
- `SPAM`
- `IMPERSONATION`
- `OTHER`

#### status (workflow)
- `OPEN`
- `UNDER_REVIEW`
- `RESOLVED`
- `DISMISSED`

#### severity
- `LOW`
- `MEDIUM`
- `HIGH`

---

## 🧭 Fluxo Operacional (MVP)

1. Usuário cria denúncia → `status=OPEN`
2. Sistema registra e vincula:
   - módulo (`module`)
   - cidade/tenant (`tenant_id`)
   - alvo (`target_type`, `target_id`)
3. Auditoria inicia análise → `status=UNDER_REVIEW`
4. Auditoria encerra:
   - `RESOLVED` (procedente)
   - `DISMISSED` (não procedente)
5. Sempre que encerrar, incluir:
   - resposta ao denunciante
   - justificativa interna (audit log)

---

## 👁️ Acompanhamento pelo Denunciante (produto)

Todo denunciante deve ter uma área:

- **Minhas Denúncias**
  - lista de reports
  - status atual
  - timeline (aberta → em análise → encerrada)
  - resposta final visível ao denunciante (quando encerrada)

A experiência deve ser semelhante a “tickets de suporte”.

---

## 🧾 Audit Trail (obrigatório)

Para cada mudança relevante em uma denúncia (status, severidade, ação tomada), registrar evento:

- `report_event_id`
- `report_id`
- `actor_type` (`SYSTEM` | `AUDITOR` | `USER`)
- `actor_id` (se aplicável)
- `event_type` (`STATUS_CHANGED`, `COMMENT_ADDED`, `ACTION_TAKEN`, etc.)
- `metadata` (JSON)
- `created_at`

---

## ⚠️ Motor de Risco (luz amarela/vermelha)

### Objetivo
Sinalizar risco por padrão agregado, sem aplicar punição automática no MVP.

### Risk Scoring Engine v1 (regras)
Calcular periodicamente (ou on-write) um score por alvo:

- Contagem de denúncias nos últimos 7/30 dias
- Peso por severidade
- Peso por procedência (RESOLVED > DISMISSED)
- Peso por diversidade de reporters (antifraude)

**Exemplo conceitual:**
- 1 denúncia: normal
- 2 denúncias em 7 dias: ⚠️ alerta
- 5 denúncias em 30 dias: 🚨 alto risco

### Ações no MVP
- Criar flags de risco para auditoria
- Priorizar fila manual
- Nunca bloquear automaticamente no MVP

### Evolução (v2 IA)
- clustering por similaridade de textos
- detecção de padrões cross-módulo
- correlação por tenant/cidade
- reputação de reporter (anti-abuso)

---

## 🔒 Políticas (anti-abuso)

- Rate limit de denúncias por usuário
- Evitar spam de denúncias:
  - limitar frequência
  - exigir descrição após X denúncias
- Score do denunciante (futuro):
  - denúncias procedentes aumentam credibilidade
  - denúncias abusivas reduzem prioridade

---

## 🔐 Privacidade e Segurança

- Denúncias não devem expor dados sensíveis do alvo ao denunciante
- Auditoria tem visibilidade ampliada com logs
- CPF / endereço / dados pessoais nunca aparecem no ticket público

---

## 🧱 Integração com Módulos

Módulos que podem ser denunciados devem:
- enviar `module`, `tenant_id`, `target_type`, `target_id`
- NÃO duplicar tabela/report interno

Exemplo:
- `groups` → target `GROUP` e/ou `USER` (criador/admin)
- `marketplace` → target `PROVIDER`/`SERVICE`/`COMPANY`
- `mobility` → target `DRIVER`

---

## ✅ Critérios de Aceite (core)

- Denúncia pode ser criada para múltiplos target_types
- Auditoria vê fila unificada com filtros por:
  - módulo
  - cidade/tenant
  - status
  - severidade
- Denunciante acompanha status e recebe resposta final
- Audit trail registrado
- Risk flags geradas (mesmo sem IA)

---

## 🔄 Governança de Mudança

Qualquer mudança neste core deve:
- manter compatibilidade do contrato
- evitar acoplamento com módulos específicos
- ser revisada por Trust & Safety / Core

---

## 🏁 Regra Final

> Qualquer feature que crie “denúncia própria do módulo”
> viola este core e deve ser rejeitada.
