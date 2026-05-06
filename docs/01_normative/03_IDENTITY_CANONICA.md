# 03 — IDENTIDADE CANÔNICA

## STATUS
CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## 1. PRINCÍPIO FUNDAMENTAL

O sistema UnifiCard reconhece **uma única identidade canônica por pessoa física real**.

Identidade é **ontológica, persistente e indivisível**.

A identidade:
- **define quem a pessoa é**
- **NUNCA define poder**
- **NUNCA autoriza ações**
- **NUNCA decide permissões**

Toda ação, vínculo, perfil ou representação
deriva **obrigatoriamente** de uma identidade,
mas **nunca é decidida por ela**.

---

## 2. IDENTIDADE CANÔNICA

A identidade canônica do sistema é representada por:

- **global_user_id**

O `global_user_id`:
- representa a pessoa física real (CPF)
- é único no sistema
- é global
- não depende de tenant
- não depende de contexto
- não pode ser duplicado

Se não existe `global_user_id`,
**não existe pessoa no sistema**.

---

## 3. IDENTIDADE ≠ ACTOR

- Identidade define **quem a pessoa é**
- Actor define **como alguém age no sistema**

Uma identidade pode:
- ancorar um ou mais Actors
- ocupar Actors diferentes ao longo do tempo
- operar em múltiplos contextos

Um Actor:
- nunca substitui a identidade
- nunca redefine identidade
- nunca cria identidade

Misturar identidade com Actor é **violação estrutural grave**.

---

## 4. IDENTIDADE ≠ USUÁRIO ≠ PERFIL

- **Usuário** é uma representação técnica e contextual
- **Perfil** é uma projeção funcional
- **Identidade** é a raiz ontológica

Usuários e perfis:
- podem existir ou não
- podem mudar
- podem ser descartados

Identidade:
- é permanente
- é histórica
- nunca é descartada

---

## 5. UNICIDADE GLOBAL

É proibido:

- múltiplas identidades para a mesma pessoa
- identidade por tenant
- identidade por aplicação
- identidade inferida de e-mail, login ou sessão

Qualquer tentativa de duplicação
é violação estrutural do sistema.

---

## 6. VÍNCULOS E CONTEXTOS

A identidade:
- pode estar vinculada a múltiplos tenants
- pode ocupar diferentes Actors
- pode assumir diferentes papéis operacionais

Esses vínculos:
- **não criam novas identidades**
- **não alteram a identidade**
- **não concedem poder automaticamente**

---

## 7. ESCOPO DA IDENTIDADE (LIMITAÇÃO EXPLÍCITA)

Este documento define **exclusivamente identidade**.

Ele **NÃO define**:
- autoridade
- permissão
- delegação
- poder de decisão
- responsabilidade operacional

Esses conceitos pertencem
ao eixo **AUTORIDADE** e estão definidos em:

**docs/01_normative/08_AUTORIDADE_CANONICA.md**

---

## 8. REGRA DE RESOLUÇÃO DE IDENTIDADE (TENANT-SCOPED)

Embora a identidade seja **global e única**,  
qualquer **resolução técnica de identidade** no sistema é **OBRIGATORIAMENTE contextualizada por tenant**.

### Regra canônica:

> **Nenhuma decisão de perfil, dado pessoal ou regra funcional
> pode ser tomada sem o contexto explícito de `tenant_id`.**

A resolução técnica válida é:

(global_user_id, tenant_id) → user_id


Consequências obrigatórias:
- `global_user_id` **NÃO possui autoridade isolada**
- `global_user_id` **NÃO pode ser usado sozinho** para decisões de perfil
- Toda lógica de perfil **DEVE receber `tenant_id` explicitamente**
- Inferir tenant é **proibido**
- Resolver identidade “pelo primeiro resultado” é **proibido**

Se o `tenant_id` não estiver disponível:
→ **a decisão é inválida por definição**

---

## 9. AUTORIDADE DO SSOT DE IDENTIDADE

Este documento é a **única fonte de verdade** sobre:

- o que é identidade
- como identidade é definida
- como identidade se relaciona com Actors
- como identidade pode ser resolvida tecnicamente

Nenhum contrato, serviço, API ou módulo pode:
- redefinir identidade
- criar identidade alternativa
- relativizar unicidade
- usar identidade como critério de permissão
- decidir perfil sem `tenant_id`

---

## 10. LEITURA E DECISÃO

- Identidade **não é inferida**
- Identidade **não é calculada**
- Identidade **não é usada para decidir autoridade**
- Identidade **não é corrigida por conveniência**
- Identidade **não decide perfil sem contexto de tenant**

Se um dado conflita com a identidade canônica:
→ o dado está errado por definição.

---

## 11. EVOLUÇÃO DA IDENTIDADE

Qualquer mudança neste modelo:
- exige Gate formal
- exige atualização explícita deste documento
- não pode ser feita via código

Se não está aqui,
**não existe**.

---

## 12. REGRA FINAL

Se houver dúvida sobre:
- quem é a pessoa
- qual identidade vale
- qual vínculo é legítimo

a resposta correta é:

→ **consultar o `global_user_id`**

E então:
→ **consultar o Actor e o eixo de Autoridade**  
para saber **o que pode ou não ser feito**,  
**sempre no contexto explícito de um tenant**.

---

FIM DO DOCUMENTO

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 08_AUTORIDADE_CANONICA.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- 99_GLOSSARIO_CANONICO.md
<!-- AUTO-GENERATED-END -->