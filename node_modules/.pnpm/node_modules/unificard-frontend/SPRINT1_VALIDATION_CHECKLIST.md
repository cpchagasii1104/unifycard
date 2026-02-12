# SPRINT 1 — Home Contextual + Seletor "Atuando como"
## Checklist de Validação Manual

**Data:** 2026-01-XX  
**Status:** Validação Manual Obrigatória

---

## ✅ VALIDAÇÕES OBRIGATÓRIAS

### 1. Trocar actor muda saldo
- [ ] Selecionar Pessoa Física → verificar saldo
- [ ] Selecionar Empresa → verificar saldo (pode ser diferente ou null)
- [ ] Trocar de volta para PF → saldo deve voltar ao valor original
- [ ] **Resultado esperado:** Saldo reflete o actor ativo

### 2. PF não vê dados de empresa sem permissão
- [ ] Logar como PF sem empresas
- [ ] Verificar que card "Empresas" mostra "Você ainda não tem empresas cadastradas"
- [ ] Verificar que não há dados de empresa na Home
- [ ] **Resultado esperado:** PF sem empresas não vê dados de empresa

### 3. Colaborador vê menos que owner
- [ ] Logar como owner de empresa → verificar cards e dados
- [ ] Logar como colaborador (staff) da mesma empresa → verificar cards e dados
- [ ] Comparar: colaborador deve ver menos opções/CTAs
- [ ] **Resultado esperado:** Permissões refletidas na UI

### 4. Home nunca mostra ação inválida
- [ ] Verificar que cards só aparecem quando fazem sentido
- [ ] Verificar que CTAs não levam a ações bloqueadas
- [ ] Verificar que estados vazios são claros
- [ ] **Resultado esperado:** Nenhuma ação inválida visível

### 5. Contexto ativo sempre visível
- [ ] Verificar header mostra "Atuando como: [Nome]"
- [ ] Verificar Home mostra "Atuando como: [Nome] ([Tipo])"
- [ ] Trocar actor → verificar que ambos atualizam
- [ ] **Resultado esperado:** Contexto sempre claro

### 6. Header envia x-acting-actor-id
- [ ] Abrir DevTools → Network
- [ ] Fazer qualquer request mutável (POST/PUT/DELETE)
- [ ] Verificar header `x-acting-actor-id` está presente
- [ ] Verificar valor corresponde ao actor selecionado
- [ ] **Resultado esperado:** Header sempre enviado

### 7. Loading states funcionam
- [ ] Recarregar página → verificar skeletons aparecem
- [ ] Trocar actor → verificar loading durante transição
- [ ] **Resultado esperado:** Sem tela branca, feedback visual claro

### 8. Estados vazios são claros
- [ ] Sem empresas → "Você ainda não tem empresas cadastradas"
- [ ] Sem grupos → "Você ainda não participa de grupos"
- [ ] Sem transações → "Nenhuma transação encontrada"
- [ ] **Resultado esperado:** Mensagens claras, não genéricas

### 9. Cards dinâmicos aparecem corretamente
- [ ] PF sem empresas → card Empresas com CTA "Criar empresa"
- [ ] PF com empresas → card Empresas com contagem e CTA "Gerenciar"
- [ ] Actor sem saldo → card UnifyBank não aparece
- [ ] Actor com saldo → card UnifyBank aparece com valor
- [ ] **Resultado esperado:** Cards contextuais, sem genéricos

### 10. Invalidação de queries ao trocar actor
- [ ] Abrir Home com actor A → verificar dados
- [ ] Trocar para actor B → verificar dados recarregam
- [ ] Verificar que dados antigos não aparecem misturados
- [ ] **Resultado esperado:** Dados sempre sincronizados com actor ativo

---

## 🚨 PROBLEMAS CONHECIDOS / LIMITAÇÕES

- Eventos: API ainda não implementada (card não aparece)
- Serviços: API ainda não implementada (card não aparece)
- Grupos: Card sempre aparece (mesmo sem grupos)

---

## 📝 NOTAS DE VALIDAÇÃO

**Validador:** _________________  
**Data:** _________________  
**Observações:**

---

## ✅ CRITÉRIO DE APROVAÇÃO

- [ ] Todas as validações acima passaram
- [ ] Nenhum erro no console (exceto warnings esperados)
- [ ] Nenhuma ação inválida visível na UI
- [ ] Contexto sempre claro para o usuário
- [ ] Sistema pronto para Sprint 2 (Painel da Empresa)







