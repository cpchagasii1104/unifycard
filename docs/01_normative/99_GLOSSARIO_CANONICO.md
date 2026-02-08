# 99 — GLOSSÁRIO CANÔNICO

## STATUS
CANÔNICO · VIGENTE · OBRIGATÓRIO

---

## FINALIDADE

Este glossário existe para **eliminar ambiguidade semântica**.

Ele:
- **não cria regras**
- **não substitui normas**
- **não interpreta decisões**

Serve apenas para **fixar significados oficiais**.

---

## REGRAS DE USO

- Todo termo aqui definido tem **significado único**
- Termos não listados **não possuem significado canônico**
- Nenhum termo pode ter múltiplas definições
- Em caso de conflito, prevalece o uso definido aqui

---

## TERMOS CANÔNICOS

### SSOT
Single Source of Truth.  
Fonte única, autorizada e obrigatória de um conceito.

---

### Actor
Entidade ontológica capaz de agir no sistema.  
Definido exclusivamente em `02_ACTORS_SSOT.md`.

---

### Identidade
Raiz ontológica que representa a pessoa real.  
Ancorada por `global_user_id`.  
Definida em `03_IDENTITY_CANONICA.md`.

---

### Usuário
Representação técnica/contextual de uma identidade.  
Não é ontologia. Não é identidade.

---

### Perfil
Projeção funcional de um Actor em um contexto.  
Descartável e mutável.

---

### Categoria
Unidade ontológica de classificação.  
Nunca decide, apenas classifica.  
Definida em `04_CATEGORIES_SSOT.md`.

---

### Contrato
Declaração normativa que autoriza uma ação.  
Sem contrato, a ação é proibida.

---

### Governança
Sistema de regras que controla a evolução do sistema.  
Definida em `06_GOVERNANCA_CANONICA.md`.

---

### Gate
Ponto formal e binário de decisão governada.  
Resultado possível: PASSA ou NÃO PASSA.

---

### Estado
Condição observável de uma entidade.  
Nunca é fonte primária de verdade se for derivado.

---

### Read Model
Projeção derivada, descartável e não autoritativa.  
Usada apenas para leitura.

---

### Fonte de Verdade
Local autorizado onde um dado é decidido.  
Se não é fonte, é leitura.

---

### Canônico
Aquilo que possui autoridade normativa.  
O oposto de histórico, auxiliar ou opcional.

---

## TERMOS PROIBIDOS (NÃO CANÔNICOS)

Os termos abaixo **não devem ser usados** como conceitos formais:

- “quase”
- “temporário” (sem Gate)
- “atalho”
- “exceção implícita”
- “vai ficar assim por enquanto”

---

## REGRA FINAL

Se um termo gerar dúvida:
→ ele **não está definido corretamente**  
→ deve ser adicionado ou corrigido aqui **via Gate**

---

FIM DO DOCUMENTO