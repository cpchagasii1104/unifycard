# AUTHORITY RECOVERY — SSOT UnifiCard

Status: RECOMENDADO · NORMATIVO  
Tipo: DOCUMENTO DE BLINDAGEM / GOVERNANÇA  
Escopo: GLOBAL  
Subordinação:
- `AUTHORITY_LAW.md`
- `08_AUTORIDADE_CANONICA.md`
- `AUTHORITY_PRECEDENCE.md`

Dependências diretas:
- `GATES.md` (define quando recovery é acionado)
- `FALSIFICATION_LOG.md` (toda recovery gera entrada obrigatória)

Seu objetivo é:
- garantir previsibilidade regulatória
- assegurar proporcionalidade jurídica
- impedir arbitrariedade operacional
- evitar tanto impunidade quanto punição perpétua informal

Este documento é referência para:
- reguladores
- jurídico
- auditoria externa
- governança interna

---

## 2. PRINCÍPIO FUNDAMENTAL

> **Autoridade pode ser restringida ou removida.  
> Confiança só é recuperada por prova objetiva e tempo.**

Não existe:
- reset automático
- anistia tácita
- recuperação por conveniência
- negociação informal de restrição

---

## 3. NÍVEIS DE ATL E ELEGIBILIDADE À RECUPERAÇÃO

| ATL | Estado | Elegível à Recuperação |
|----:|--------|------------------------|
| ATL0 | Normal | Não aplicável |
| ATL1 | Observado | Sim |
| ATL2 | Restrito | Sim |
| ATL3 | Quarentena | Sim (com critérios reforçados) |
| ATL4 | Banimento | **Não**, salvo decisão normativa |

---

## 4. PRAZOS MÍNIMOS CONSTITUCIONAIS

A recuperação **NUNCA** pode ocorrer antes do prazo mínimo abaixo:

| ATL Atual | Prazo Mínimo sem Incidentes |
|---------:|-----------------------------|
| ATL1 | 30 dias |
| ATL2 | 90 dias |
| ATL3 | 180 dias |
| ATL4 | Não aplicável |

O prazo:
- conta a partir do **último incidente confirmado**
- reinicia automaticamente em caso de novo incidente
- não pode ser reduzido por produto, operador ou urgência

---

## 5. EVIDÊNCIAS ACEITAS PARA RECUPERAÇÃO

A recuperação exige **evidência cumulativa**, nunca isolada.

### 5.1 Evidências Obrigatórias

- ausência total de novos incidentes no período
- cumprimento integral das restrições impostas
- histórico auditável sem lacunas
- cooperação ativa com auditorias ou investigações

---

### 5.2 Evidências Complementares (quando aplicável)

- correção documentada de falhas estruturais
- remoção de estruturas proibidas
- encerramento de entidades associadas de risco
- reforço de controles internos
- atualização ou elevação de KYC

---

### 5.3 Evidências Não Aceitas

São **explicitamente rejeitadas**:
- alegação de boa-fé
- justificativa econômica
- mudança de narrativa
- pressão comercial
- impacto financeiro negativo
- “foi um erro pontual” sem prova estrutural

---

## 6. PROCESSO FORMAL DE RECUPERAÇÃO

1. **Elegibilidade automática**
   - sistema verifica prazo mínimo e ausência de incidentes

2. **Solicitação formal**
   - iniciada pelo ator humano ou representante legal
   - registrada e auditável

3. **Análise pela Risk Authority**
   - valida evidências
   - verifica ausência de evasão
   - avalia risco residual

4. **Decisão soberana**
   - aprovar recuperação parcial ou total
   - manter nível atual
   - impor condições adicionais

Toda decisão:
- é registrada
- é motivada
- é auditável

---

## 7. MODALIDADES DE RECUPERAÇÃO

### 7.1 Recuperação Parcial

- redução de ATL em **um nível por ciclo**
- sujeita a monitoramento reforçado
- reversível em caso de reincidência

---

### 7.2 Recuperação Total

- retorno a ATL0
- somente após cumprimento completo de todos os critérios
- histórico de incidentes **não é apagado**

---

## 8. CASOS DE RECUPERAÇÃO IMPOSSÍVEL

A recuperação é **permanentemente vedada** quando houver:

- fraude sistêmica comprovada
- reincidência grave em evasão
- uso de laranjas ou cadeias organizacionais
- manipulação deliberada de evidência
- violação consciente da Lei de Autoridade
- decisão normativa explícita de banimento

Nestes casos, ATL4 é definitivo.

---

## 9. RELAÇÃO COM GUARDA, KYC E IA

- Recuperação de ATL **não remove automaticamente**:
  - restrições de guarda
  - exigências de KYC
  - limites de IA
- Cada camada possui critérios próprios
- Prevalece sempre a **camada mais restritiva**

---

## 10. AUDITORIA E TRANSPARÊNCIA

- Todo processo de recuperação é auditável
- Decisões podem ser revisadas apenas por:
  - erro material comprovado
  - decisão normativa superior
- Não existe revisão informal

---

## 11. SUPREMACIA E ANTI-REGRESSÃO

Este documento:
- impede negociação ad hoc
- bloqueia recuperação silenciosa
- serve como base para defesa regulatória

Qualquer tentativa de contorno:
→ registra incidente adicional
→ reinicia prazo
→ pode gerar ATL superior

---

FIM DO AUTHORITY RECOVERY

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
- 08_AUTORIDADE_CANONICA.md
- AUTHORITY_LAW.md
- AUTHORITY_PRECEDENCE.md
- FALSIFICATION_LOG.md
- GATES.md

### Referenciado por
- 00_INDEX.md
- AUTHORITY_PRECEDENCE.md
- GATES.md
<!-- AUTO-GENERATED-END -->