# Exceções Institucionais Declaradas

**SPRINT 30**: Documentação explícita de exceções ao modelo institucional padrão.

Este documento lista pontos no código onde regras gerais não se aplicam, fluxos pulam etapas, permissões especiais existem, ou comportamentos são condicionais "fora do padrão".

## Regra de Ouro

**Cada exceção é explícita e declarada. Exceções não devem ser implícitas ou invisíveis.**

---

## Escopo de Decisão (SPRINT 32)

**Decisões relacionadas a exceções institucionais devem declarar seu escopo em: `INSTITUTIONAL_DECISION_SCOPE.md`**

---

## 1. Modo Piloto (PILOT_MODE)

- **Local**: Múltiplos arquivos (frontend e backend)
- **Motivo**: Permitir funcionalidades de observação e leitura institucional apenas em modo piloto
- **Contexto**: Sistema em fase de piloto controlado
- **Tipo**: Estrutural
- **Observação**: Exceção explícita, não modelo geral. Funcionalidades de piloto não devem estar disponíveis em produção normal.

**Arquivos principais**:
- `frontend/src/config/pilot.ts`
- `backend/src/core/pilot/pilot-events.service.ts`
- `backend/src/core/pilot/pilot-invites.service.ts`
- `backend/src/core/pilot/institutional-memory.service.ts`
- `backend/src/core/auth/auth.service.ts` (verificação de convite)

---

## 2. DEV MODE - Override de Plano (VITE_DEV_PLAN / DEV_PLAN)

- **Local**: 
  - `frontend/src/config/features.ts`
  - `backend/src/core/plan/plan-gate.service.ts`
- **Motivo**: Permitir testar features de planos PRO/ENTERPRISE em desenvolvimento
- **Contexto**: Ambiente de desenvolvimento local
- **Tipo**: Temporária
- **Observação**: Exceção explícita, não modelo geral. Não deve estar ativa em produção.

---

## 3. Admin Override - Verificação de Empresa

- **Local**: `backend/src/core/companies/companies.routes.ts` (linha ~600)
- **Motivo**: Permitir que admins marquem empresas como VERIFIED sem passar pelo fluxo normal de validação
- **Contexto**: Necessidade operacional de override manual
- **Tipo**: Estrutural
- **Observação**: Exceção explícita, não modelo geral. Apenas admins podem fazer override.

---

## 4. Owner/Admin Bypass - Permissões de Grupo

- **Local**: `backend/src/modules/groups/groups.routes.ts` (linha ~100)
- **Motivo**: Owner e admin de grupo têm permissões implícitas que bypassam RBAC
- **Contexto**: Regra de negócio específica para grupos
- **Tipo**: Estrutural
- **Observação**: Exceção explícita, não modelo geral. Owner/admin tem bypass de RBAC apenas para seu próprio grupo.

---

## 5. Test Override Users

- **Local**: `backend/src/config/testOverrideUsers.ts` (se existir) ou similar
- **Motivo**: Permitir acesso total ao sistema para usuários específicos de teste
- **Contexto**: Testes e desenvolvimento
- **Tipo**: Temporária
- **Observação**: Exceção explícita, não modelo geral. Apenas para usuários específicos identificados por user_id.

---

## 6. Governance Admin IDs

- **Local**: `backend/src/core/unifybank/regional-fund-governance.service.ts` (linha ~1127)
- **Motivo**: Permitir acesso especial a governança de fundo regional para admins específicos
- **Contexto**: Governança de fundo regional requer acesso especial
- **Tipo**: Estrutural
- **Observação**: Exceção explícita, não modelo geral. Apenas IDs listados em GOVERNANCE_ADMIN_IDS têm acesso.

---

## 7. Tenant Plugin - DEV Exception

- **Local**: `backend/src/plugins/tenant.plugin.ts` (linha ~24)
- **Motivo**: Permitir requisições sem tenant-id em desenvolvimento, redirecionando para frontend
- **Contexto**: Desenvolvimento local onde requisições diretas do browser são comuns
- **Tipo**: Temporária
- **Observação**: Exceção explícita, não modelo geral. Apenas em NODE_ENV !== 'production'.

---

## 8. Observation Mode

- **Local**: 
  - `frontend/src/components/ObservationModeBanner.tsx`
  - `backend/src/core/config/observation-mode.service.ts`
- **Motivo**: Permitir modo de observação que bloqueia certas operações
- **Contexto**: Sistema em modo de observação para análise
- **Tipo**: Estrutural
- **Observação**: Exceção explícita, não modelo geral. Modo de observação altera comportamento normal do sistema.

---

## 9. PJ PROVISIONAL - Restrições Especiais

- **Local**: `backend/src/modules/social/reputation.service.ts` (linha ~285)
- **Motivo**: Empresas PROVISIONAL têm restrições especiais (não podem postar, votar, criar projetos)
- **Contexto**: Regra de negócio específica para status PROVISIONAL
- **Tipo**: Estrutural
- **Observação**: Exceção explícita, não modelo geral. Status PROVISIONAL tem regras diferentes do padrão.

---

## 10. Verificação de Convite em Modo Piloto

- **Local**: `backend/src/core/auth/auth.service.ts` (linha ~193, ~382)
- **Motivo**: Em modo piloto, registro de usuário requer convite válido
- **Contexto**: Sistema em fase de piloto fechado
- **Tipo**: Estrutural (condicional ao PILOT_MODE)
- **Observação**: Exceção explícita, não modelo geral. Apenas quando PILOT_MODE=true.

---

## Notas Importantes

1. **Não é refatoração**: Este documento não indica que exceções devem ser removidas ou padronizadas. Apenas documenta onde existem.

2. **Não é validação automática**: Este documento serve como guia humano, não como restrição técnica.

3. **Evolução permitida**: O sistema continua evoluível. Este documento previne criação de exceções implícitas, não evolução consciente.

4. **Exceções conscientes**: Se um desenvolvedor precisar criar uma nova exceção, deve documentá-la explicitamente neste documento.

5. **Novas exceções**: Novas exceções institucionais devem ser adicionadas a este documento quando criadas.

