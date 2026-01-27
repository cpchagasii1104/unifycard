# REPORTING DATA MODEL — UnifiCard

Status: **Ativo**
Versão: **1.0**
Escopo: **Modelo de dados do Core de Denúncias**

---

## 🎯 Objetivo

Definir o **modelo de dados canônico** do Core de Denúncias (Reporting Core),
incluindo tabelas, enums, índices e decisões arquiteturais,
servindo como contrato entre produto, backend e auditoria.

---

## 🧱 Princípios de Modelagem

- Core desacoplado de módulos
- Multi-tenant por design
- Auditável por padrão
- Preparado para IA e análise de risco
- Sem FKs diretas para entidades de domínio

---

## 🧩 Tabela: `reports`

Armazena denúncias/tickets criados por usuários.

### Campos

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID (PK) | Identificador da denúncia |
| reporter_user_id | UUID | Usuário que denunciou |
| target_type | ENUM | Tipo do alvo denunciado |
| target_id | TEXT | ID do alvo |
| module | TEXT | Módulo de origem |
| tenant_id | UUID | Cidade / território |
| reason_code | ENUM | Motivo da denúncia |
| description | TEXT | Descrição opcional |
| status | ENUM | Status do ticket |
| severity | ENUM | Severidade |
| risk_score | INTEGER | Score agregado |
| created_at | TIMESTAMP | Criação |
| updated_at | TIMESTAMP | Atualização |
| resolved_at | TIMESTAMP | Encerramento |

---

## 🧩 Tabela: `report_events`

Audit trail de todas as ações relevantes.

| Campo | Tipo |
|---|---|
| id | UUID (PK) |
| report_id | UUID (FK lógico) |
| actor_type | ENUM |
| actor_id | UUID |
| event_type | TEXT |
| metadata | JSONB |
| created_at | TIMESTAMP |

---

## 🧩 Tabela: `risk_flags`

Sinalização de risco agregada por alvo.

| Campo | Tipo |
|---|---|
| id | UUID (PK) |
| target_type | ENUM |
| target_id | TEXT |
| module | TEXT |
| tenant_id | UUID |
| risk_level | ENUM |
| risk_score | INTEGER |
| last_evaluated_at | TIMESTAMP |
| created_at | TIMESTAMP |

---

## 🔤 ENUMs Canônicos

### report_target_type
- GROUP
- USER
- COMPANY
- PROVIDER
- DRIVER
- SERVICE
- POST
- COMMENT
- TRANSACTION

### report_reason_code
- FRAUD
- SCAM
- ABUSE
- HARASSMENT
- INAPPROPRIATE_CONTENT
- SPAM
- IMPERSONATION
- OTHER

### report_status
- OPEN
- UNDER_REVIEW
- RESOLVED
- DISMISSED

### report_severity
- LOW
- MEDIUM
- HIGH

### report_actor_type
- SYSTEM
- AUDITOR
- USER

### risk_level
- GREEN
- YELLOW
- RED

---

## 📈 Índices Obrigatórios

- reports(target_type, target_id)
- reports(module)
- reports(tenant_id)
- reports(status)
- reports(created_at)
- risk_flags(target_type, target_id, module, tenant_id) UNIQUE

---

## ⚠️ Decisões Importantes

- `target_id` é TEXT para evitar acoplamento com módulos
- Core não conhece schemas externos
- Audit trail é obrigatório
- Nenhuma denúncia gera punição automática no MVP

---

## 🏁 Regra Final

> Qualquer alteração estrutural no Core de Denúncias
> deve atualizar este documento antes de alterar o código.
