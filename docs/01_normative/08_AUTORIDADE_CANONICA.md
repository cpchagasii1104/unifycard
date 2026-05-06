# AUTORIDADE CANÔNICA

Eixo: AUTORIDADE · PODER · RESPONSABILIDADE  
Status: ATIVO (NORMA ESTRUTURAL)  
Tipo: NORMA CANÔNICA (SUBORDINADA)  
Subordinação: `AUTHORITY_LAW.md`  
Última atualização: 2026-02-08

---

## 1. FINALIDADE

Este documento define, de forma **canônica, normativa e operacional**,
como **autoridade é exercida, delegada, revogada e auditada** no sistema.

Ele **NÃO cria lei nova**.  
Ele **IMPLEMENTA e OPERACIONALIZA** a `AUTHORITY_LAW.md`.

Nenhuma execução, permissão, decisão de poder ou escopo
pode contrariar a **Lei de Autoridade**.

Em caso de conflito:
> **Prevalece sempre a `AUTHORITY_LAW.md`.**

---

## 2. PRINCÍPIO-MÃE

> **Autoridade é sempre delegada.  
> Responsabilidade é sempre rastreável.**

O sistema:
- não confia em pessoas
- não confia em empresas
- não confia em sessões
- não confia em identificadores soltos

O sistema confia **exclusivamente** em:
- vínculos documentados
- delegações explícitas
- histórico imutável
- identidade canônica rastreável até CPF

---

## 3. ENTIDADES CANÔNICAS

### 3.1 Pessoa Física (CPF)

A Pessoa Física é a **âncora moral, jurídica, econômica e histórica** do sistema.

Características:
- possui CPF
- identidade única e permanente
- pode ser restringida via ATL
- pode ser colocada em quarentena ou banida
- carrega histórico vitalício de atuação

A Pessoa Física:
- **NÃO recebe permissões diretamente**
- **NÃO executa ações**
- **NÃO ocupa escopo operacional**

Toda responsabilização **termina no CPF**.

---

### 3.2 Empresa (CNPJ)

A Empresa é a **persona jurídica organizacional**.

Características:
- possui CNPJ válido
- existe apenas enquanto tiver Âncora Legal ativa
- não executa ações diretamente

A Empresa:
- **não age**
- **não clica**
- **não decide**

Toda ação ocorre **em nome da empresa**,
por meio de um Actor legitimamente delegado.

---

### 3.3 Actor (Representação Operacional)

O Actor é a **ÚNICA entidade que executa ações** no sistema.

Características:
- representa um CNPJ **ou** diretamente um CPF
- possui escopo, intenção e limites claros
- é temporário por definição

Regras absolutas:
- ❌ Actor **NUNCA** existe sem CPF responsável
- ❌ Actor **NUNCA** é anônimo
- ❌ Actor **NUNCA** é soberano
- ❌ Actor **NUNCA** herda autoridade
- ✅ Actor **SEMPRE** atua por delegação válida

---

## 4. REGRA FUNDAMENTAL (ANTI-FRAUDE)

> **Um Actor pode existir sem CNPJ.  
> Um Actor NUNCA pode existir sem CPF.**

Todo Actor deve possuir:
- pelo menos **UM CPF âncora responsável**
- delegação explícita válida
- histórico completo de criação, uso e revogação

Actor “genérico”, “temporário sem vínculo”
ou “solto no sistema” é **violação estrutural grave**.

---

## 5. ÂNCORA LEGAL

### 5.1 Definição

Âncora Legal é a Pessoa Física (CPF) com
**poder jurídico, econômico e documental** sobre uma entidade.

Exemplos:
- sócios
- administradores legais
- representantes contratuais

---

### 5.2 Regras de Âncora

- Toda Empresa deve possuir **ao menos UMA âncora ativa**
- Sem âncora ativa:
  - a empresa entra em estado suspenso
  - nenhum Actor pode atuar
- Âncora removida → revogação automática de Actors

---

## 6. CRIAÇÃO E DELEGAÇÃO DE ACTORS

### 6.1 Quem pode criar Actors

Somente:
- Âncoras Legais
- Delegados explícitos por Âncoras

Regra dura:
> **Ninguém pode delegar mais poder do que possui.**

ATL, quarentena ou bloqueio do CPF
**impedem criação e delegação automaticamente**.

---

### 6.2 Delegação

Delegação:
- é sempre temporária
- possui escopo, tempo e narrativa
- **NÃO transfere autoridade**
- **NÃO isenta responsabilidade**

Toda delegação registra:
- CPF delegador
- CPF ocupante
- Actor
- escopo
- período
- origem da autoridade

---

## 7. VÍNCULO TEMPORÁRIO (OCUPAÇÃO)

Relação correta:

Pessoa (CPF)  
→ ocupa temporariamente  
→ Actor  
→ representa  
→ Empresa (CNPJ ou CPF)

Fim do vínculo implica:
- fim do poder
- fim do acesso
- preservação integral do histórico

---

## 8. REVOGAÇÃO AUTOMÁTICA (SEGURANÇA)

O sistema **DEVE revogar imediatamente** Actors quando:
- vínculo CPF ↔ Empresa termina
- Âncora Legal expira, é removida ou entra em ATL restritivo
- Empresa é suspensa ou invalidada
- CPF entra em quarentena (ATL3) ou banimento (ATL4)
- há ordem judicial ou bloqueio sistêmico

Revogação:
- é automática
- não negociável
- não reversível sem nova delegação válida

---

## 9. HISTÓRICO E RESPONSABILIZAÇÃO

Regra canônica:

> **Autoridade expira.  
> Histórico nunca expira.**

O sistema preserva:
- quem criou o Actor
- quem delegou
- quem ocupou
- o que foi feito
- quando foi feito
- em nome de quem foi feito

Não existe:
- reset de histórico
- troca de usuário para apagar rastro
- saída limpa

---

## 10. AUTORIDADE, IDENTIDADE E DECISÃO

### 10.1 Fonte Canônica

A única base canônica de identidade operacional é:
- `users.user_id`
- `users.tenant_id`
- `users.global_user_id`

Esses identificadores:
- **NÃO criam autoridade**
- **APENAS rastreiam atuação**

Autoridade é sempre resolvida pela Lei + Delegação válida.

---

### 10.2 Descontinuação de `user_identity_links`

A tabela `user_identity_links`:
- ❌ não é fonte de autoridade
- ❌ não define escopo
- ❌ não participa de decisões de permissão
- ❌ não pode ser usada em JOIN decisório

Uso em produção = **violação estrutural grave**.

---

## 11. RELAÇÃO COM ACTIONCONTEXT E RBAC

- **ActionContext** declara:
  - qual Actor está agindo
  - em qual contexto
  - com qual intenção

- **RBAC** decide:
  - se aquele Actor pode executar aquela ação

RBAC:
- **NUNCA cria autoridade**
- **APENAS aplica permissões delegadas**

CPF:
- **NUNCA decide permissão**
- **SEMPRE responde historicamente**

---

## 12. GUARDA (REFERÊNCIA OPERACIONAL)

Quando existir guarda (conforme `AUTHORITY_LAW.md`):
- há responsável econômico único
- há teto e prazo explícitos
- não existe guarda em cadeia
- violação gera ATL imediato

Este documento **NÃO define guarda**,
apenas aplica suas consequências operacionais.

---

## 13. CONFORMIDADE

O sistema só é considerado conforme se:
- não existir Actor sem CPF
- não existir poder sem delegação explícita
- toda ação rastrear até CPF
- ATL, quarentena e bloqueios forem respeitados
- não existir uso de estruturas proibidas

---

## 14. PROIBIÇÕES ABSOLUTAS

É proibido:
- Actor sem CPF responsável
- Delegação implícita ou inferida
- Autoridade baseada em role, status ou flag
- Exceção de autoridade via produto ou tenant
- Apagar ou mascarar histórico
- Contornar ATL, quarentena ou guarda

Violação consciente é falha estrutural.

---

FIM DA NORMA DE AUTORIDADE CANÔNICA

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- AUTHORITY_LAW.md

### Referenciado por
- 00_INDEX.md
- 00_SUMARIO.md
- 02_ACTORS_SSOT.md
- 03_IDENTITY_CANONICA.md
- 06_GOVERNANCA_CANONICA.md
- AUTHORITY_PRECEDENCE.md
- AUTHORITY_RECOVERY.md
<!-- AUTO-GENERATED-END -->