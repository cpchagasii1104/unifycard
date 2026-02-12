# AUTHORITY ANNEX — TEST OF BREAK (FALSIFICATION)

Status: CANÔNICO · CONSTITUCIONAL · OBRIGATÓRIO  
Versão: 1.0  
Escopo: GLOBAL  
Documento subordinado a: `AUTHORITY_LAW.md`  
Precedência: MÁXIMA (acima de código, produto, banco e operação)

---

## 1. FINALIDADE

Este anexo define o **TESTE CONSTITUCIONAL DE FALSIFICAÇÃO** do sistema.

Seu objetivo é:
- impedir regressão estrutural
- eliminar “jeitinho”, exceção informal ou interpretação criativa
- fornecer base objetiva para auditoria contínua

O sistema **só é considerado válido** se TODOS os cenários abaixo forem impossíveis
ou explicitamente bloqueados por artigo constitucional.

---

## 2. PRINCÍPIO FUNDAMENTAL

> **Se um cenário listado aqui funcionar, a Lei foi violada.**

Não existe:
- “exceção operacional”
- “caso especial”
- “urgência de negócio”

---

## 3. CENÁRIOS DE QUEBRA (20)

Cada cenário descreve:
- **Tentativa maliciosa realista**
- **Artigo constitucional que impede**

---

### 1. Fragmentar valores para burlar teto
**Ataque:** dividir uma transação grande em várias pequenas.  
**Bloqueio:** `AUTHORITY_ANNEX_EVASION.md` §4.1 + Art. 7 (tentativa = violação).

---

### 2. Usar IA para executar milhares de micro-ações
**Ataque:** escalar “baixo risco” via automação.  
**Bloqueio:** Art. 11 (rate limit + blast radius).

---

### 3. Criar CNPJ “limpo” após incidente
**Ataque:** criar nova empresa para continuar operando.  
**Bloqueio:** Art. 9 (herança de ATL por associação).

---

### 4. Alternar entre CNPJs para diluir risco
**Ataque:** rotação de personas.  
**Bloqueio:** `AUTHORITY_ANNEX_EVASION.md` §4.2.

---

### 5. Delegar para terceiro e negar responsabilidade
**Ataque:** “não fui eu, foi o delegado”.  
**Bloqueio:** Art. 1.3 + Art. 10 (delegação não isenta).

---

### 6. Criar cadeia de guarda (A → B → C)
**Ataque:** diluir autoria por intermediação.  
**Bloqueio:** Art. 10 (guarda em cadeia proibida).

---

### 7. Executar ação irreversível via job/cron
**Ataque:** automação silenciosa.  
**Bloqueio:** Art. 12 + `AUTHORITY_ANNEX_IRREVERSIBLE_ACTIONS.md`.

---

### 8. Apagar logs para ocultar fraude
**Ataque:** deleção de evidência.  
**Bloqueio:** Anexo de Ações Irreversíveis §3.3.

---

### 9. Fechar disputa automaticamente
**Ataque:** encerrar direito de contestação.  
**Bloqueio:** Anexo de Ações Irreversíveis §3.4.

---

### 10. Alterar KYC aprovado sem trilha
**Ataque:** rebaixar verificação.  
**Bloqueio:** Anexo de Ações Irreversíveis §3.5.

---

### 11. Operar financeiramente sem KYC mínimo
**Ataque:** CPF descartável.  
**Bloqueio:** Art. 4 (KYC mínimo obrigatório).

---

### 12. Operar durante quarentena com exceção
**Ataque:** “só dessa vez”.  
**Bloqueio:** Art. 8 (quarentena sem exceção).

---

### 13. Criar delegação durante restrição
**Ataque:** espalhar poder antes do bloqueio.  
**Bloqueio:** Art. 8 + Art. 1.3.

---

### 14. Simular desconhecimento (“não sabia”)
**Ataque:** engenharia social.  
**Bloqueio:** Art. 2 + Anexo de Evasão §6.

---

### 15. Usar entidade pré-existente como laranja
**Ataque:** lavar reputação.  
**Bloqueio:** Art. 9 (regime assistido + flag).

---

### 16. Executar ação irreversível “reversível na prática”
**Ataque:** fingir rollback.  
**Bloqueio:** Art. 12 (irreversibilidade constitucional).

---

### 17. Operar fora do contexto-base
**Ataque:** usar “chapéu errado”.  
**Bloqueio:** Art. 1.2 + Art. 7 (contexto inválido).

---

### 18. Manter sistema em limbo decisório
**Ataque:** atrasar confirmação indefinidamente.  
**Bloqueio:** Art. 6 (SLA constitucional).

---

### 19. Usar produto/feature flag para aliviar trava
**Ataque:** override por configuração.  
**Bloqueio:** Art. 5.3 (ATL não-configurável).

---

### 20. Reativar estrutura proibida “temporariamente”
**Ataque:** exceção técnica.  
**Bloqueio:** Art. 15 (invalidação automática).

---

## 4. REGRA DE PASSAGEM

O sistema **PASSA** neste anexo somente se:
- todos os cenários forem bloqueados
- não existir workaround legítimo
- não existir exceção operacional

---

## 5. ANTI-REGRESSÃO

1. Este anexo deve ser reavaliado:
   - a cada mudança normativa
   - a cada mudança estrutural
2. Novo vetor identificado:
   - exige novo cenário
   - exige referência a artigo

---

## 6. SUPREMACIA DO ANEXO

Este anexo prevalece sobre:
- roadmap
- crescimento
- metas comerciais
- decisões emergenciais

---

FIM DO ANEXO — TEST OF BREAK
