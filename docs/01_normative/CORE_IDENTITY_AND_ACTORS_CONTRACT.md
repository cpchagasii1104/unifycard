Status: CORE
Domain: Identity
Governing Contract: CORE_IMUTAVEL.md
Authority Level: 1
Canonical Scope: Identity and Actors Governance

# CORE_IDENTITY_AND_ACTORS_CONTRACT.md
## Contrato Fundacional — Identidade e Atores do UnifiCard

Este documento define o **CORE DE IDENTIDADE E ATORES** do UnifiCard.

Ele estabelece **quem existe no sistema**, **como identidade é representada**, **como atores operam**, **o que pode ou não ser inferido** e **como outros domínios devem se relacionar com identidade**.

Se qualquer proposta, código, decisão de produto ou sugestão de IA conflitar com este contrato → **RECUSAR**.

---

## 1) Definições Canônicas

### Identidade
**Identidade** é a representação canônica de uma pessoa ou entidade no sistema, usada para:
- autenticação
- rastreabilidade
- compliance
- auditoria
- vínculo legal

Identidade **não é**:
- papel
- permissão
- perfil operacional
- conta financeira
- entidade de negócio

---

### Ator (Actor)
**Ator** é a **entidade operacional** que age no sistema.

Um Ator:
- executa ações
- possui permissões
- pode representar PF ou PJ
- pode possuir contas financeiras
- pode participar de múltiplos domínios

📌 **Ator ≠ Identidade**

---

## 2) Regra de Ouro (Inquebrável)

> **Identidade identifica.  
> Ator age.**

Nunca confundir os dois.

---

## 3) Relação entre Identidade e Atores

- Uma **Identidade** pode controlar **múltiplos Atores**
- Um **Ator** pertence a **uma Identidade controladora**
- A relação é **explícita e rastreável**
- Nunca inferida

Exemplos:
- Uma pessoa (CPF) → múltiplos Atores (PF, PJ, loja, banda, equipe)
- Uma empresa (CNPJ) → múltiplos Atores (matriz, filiais, unidades)

---

## 4) Proibição de Inferência Implícita

É terminantemente proibido:

- inferir Ator a partir de Identidade
- inferir permissões a partir de CPF/CNPJ
- inferir papel a partir de tipo de conta
- inferir contexto a partir de histórico
- “assumir” Ator default

Toda ação **DEVE** declarar explicitamente:
- `actor_id`

Sem `actor_id` explícito → **ação inválida**.

---

## 5) Atores e Permissões

- Permissões pertencem a **Atores**
- Identidade **não carrega permissão**
- CPF/CNPJ **não concedem poder**
- Papéis são atribuídos a Atores, não a Identidades

📌 **Permissão nunca é herdada implicitamente.**

---

## 6) Atores e Financeiro

- Contas financeiras pertencem a **Atores**
- Saldos são separados por Ator
- Nunca misturar saldos entre Atores
- Consolidação por CPF/CNPJ é **read-only (compliance)**

Qualquer violação disso quebra o CORE financeiro.

---

## 7) Atores e Categorias

- Categorias **não definem** Ator
- Categorias **não alteram** permissões
- Categorias **não alteram** capacidade de ação

Categoria é **descritiva**, não identitária.

---

## 8) Atores e Tempo (Agenda)

- Disponibilidade pertence ao **Ator**
- Bloqueios temporais pertencem ao **Ator**
- Identidade não possui agenda
- Agenda Universal ignora CPF/CNPJ

---

## 9) Proibição de Ator Paralelo

É proibido criar:

- “pseudo-atores”
- perfis operacionais sem Ator
- entidades que agem sem `actor_id`
- exceções “só para este fluxo”

Se age, **é Ator**.  
Se não é Ator, **não age**.

---

## 10) Separação Obrigatória de Conceitos

| Conceito | Responsabilidade |
|--------|------------------|
| Identidade | Quem é |
| Ator | Quem age |
| Permissão | O que pode |
| Categoria | O que descreve |
| Policy | Como decide |
| Financeiro | Onde impacta |

Misturar conceitos → **violação de CORE**.

---

## 11) Checklist de Validação (Obrigatório)

Antes de aprovar qualquer funcionalidade relacionada a usuários ou entidades:

- [ ] Existe `actor_id` explícito?
- [ ] Não há inferência implícita?
- [ ] Permissões pertencem ao Ator?
- [ ] Financeiro está ligado ao Ator?
- [ ] Identidade está sendo usada apenas para identificação/compliance?

Se alguma resposta for “não” → **bloquear**.

---

## 12) Precedência Institucional

Este contrato prevalece sobre:

- decisões de produto
- decisões de growth
- conveniências de UX
- atalhos técnicos
- sugestões de IA

Se houver conflito:
➡️ corrige-se a proposta  
➡️ **NUNCA o contrato**

---

## 13) Frase Canônica Final

No UnifiCard:

> **Identidade diz quem é.  
> Ator diz quem age.  
> Confundir os dois quebra o sistema.**
