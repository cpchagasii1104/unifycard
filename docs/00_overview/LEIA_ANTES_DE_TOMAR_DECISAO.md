# LEIA ANTES DE TOMAR QUALQUER DECISÃO

## Status
ATIVO • OBRIGATÓRIO • PONTO DE ENTRADA

Se você chegou até aqui para:
- mudar código
- criar feature
- ajustar arquitetura
- usar IA
- “só fazer uma coisa rápida”

**PARE.**  
Leia este documento primeiro.

---

## 1. PRINCÍPIO FUNDAMENTAL

O UnifiCard é um sistema governado.

Nada é feito por:
- intuição
- pressa
- “parece simples”
- sugestão de IA

Tudo segue **documento canônico + decisão explícita**.

---

## 2. HIERARQUIA DE AUTORIDADE (NÃO QUEBRE)

Antes de agir, saiba quem manda:

1. `docs/01_normative/`  
   → LEI (o que pode / não pode)

2. `docs/02_decisions/`  
   → DECISÕES JÁ TOMADAS

3. `docs/03_technical/`  
   → COMO EXECUTAR

4. `docs/04_guides/`  
   → COMO OPERAR (humanos e IA)

5. Código  
   → IMPLEMENTAÇÃO

Se dois documentos entram em conflito:
👉 **o nível mais alto vence**  
👉 **ninguém decide “no meio”**

---

## 3. ANTES DE FAZER QUALQUER COISA, RESPONDA

Se você NÃO consegue responder “sim” para todas:

- Existe uma regra canônica que permite isso?
- Existe uma decisão registrada?
- O escopo está explícito?
- Sei exatamente quais arquivos posso tocar?
- Sei quais arquivos NÃO posso tocar?

👉 Se alguma resposta for “não” → **NÃO EXECUTE**.

---

## 4. USO DE IA (ATENÇÃO)

IA **não decide** nada neste projeto.

Antes de usar IA:
- Leia `REGRA_CANONICA_USO_DE_IA.md`
- Use SOMENTE prompts canônicos
- Declare o modo (execução, auditoria ou hardening)

Se a IA:
- inventar solução
- ampliar escopo
- “melhorar” algo sem ordem

👉 **pare imediatamente**.

---

## 5. DOCUMENTOS QUE VOCÊ DEVE CONHECER

Leitura mínima obrigatória:

- `REGRA_CANONICA_USO_DE_IA.md`
- `REGRA_CANONICA_CRIACAO_DE_CONTEXT.md`
- `REGRA_CANONICA_DOMAIN_METADATA.md`
- `SSOT_Categorias_UnifiCard.md`
- `PROMPT_CANONICO_EXECUCAO_CURSOR.md`
- `PROMPT_CANONICO_AUDITORIA.md`
- `PROMPT_CANONICO_HARDENING.md`

Sem isso, você **não entende o sistema**.

---

## 6. ERROS CLÁSSICOS (NÃO COMETA)

- Criar context novo “porque ficou mais fácil”
- Inferir domain silenciosamente
- Refatorar “aproveitando a mudança”
- Tratar auditoria como execução
- Tratar hardening como inovação
- Confiar em IA sem guarda institucional

Esses erros já quebraram sistemas maiores que este.

---

## 7. REGRA DE PARADA

Se algo parecer:
- confuso
- ambíguo
- contraditório
- “rápido demais”

👉 **PARAR é o comportamento correto**.

Decisão vem antes de execução.

---

## 8. REGRA FINAL

> Governança primeiro.  
> Execução depois.  
> Escala por último.

Quem ignora isso cria dívida invisível.

Fim.
