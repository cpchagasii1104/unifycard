# Checklist Arquitetural — Frontend

**Versão:** 1.0  
**Status:** Obrigatório  
**Aplicação:** Todos os componentes React

---

## 1. ARQUITETURA DE COMPONENTES

### 1.1 Orquestradores
- [ ] Componentes com mais de 200 linhas devem ser orquestradores
- [ ] Orquestradores não contêm JSX complexo
- [ ] Orquestradores não contêm lógica de domínio
- [ ] Orquestradores apenas compõem subcomponentes e hooks
- [ ] Orquestradores gerenciam apenas handlers de alto nível

### 1.2 Separação de Responsabilidades
- [ ] JSX nunca contém lógica de cálculo
- [ ] JSX nunca contém validação
- [ ] JSX nunca contém chamadas de API
- [ ] Hooks nunca retornam JSX
- [ ] Forms nunca têm estado interno próprio

---

## 2. GERENCIAMENTO DE ESTADO

### 2.1 Estado Local
- [ ] Todo `useState` deve estar em hook dedicado (`use[Component]State.ts`)
- [ ] Orquestradores não têm `useState` de domínio específico
- [ ] Flags de UI não misturam com dados de domínio
- [ ] Estado de erro é local ao componente que o gera

### 2.2 Hooks de Estado
- [ ] `use[Component]State.ts` contém APENAS `useState` e setters
- [ ] `use[Component]State.ts` não contém `useEffect`
- [ ] `use[Component]State.ts` não contém chamadas de API
- [ ] `use[Component]State.ts` não contém lógica de cálculo

---

## 3. HOOKS CUSTOMIZADOS

### 3.1 Separação de Hooks
- [ ] Hooks de estado (`use[Component]State.ts`) separados de hooks de lógica (`use[Component]Logic.ts`)
- [ ] Hooks de lógica contêm APENAS funções puras
- [ ] Hooks de lógica não contêm `useState` ou `useEffect`
- [ ] Hooks de dados (`use[Component]Data.ts`) contêm APENAS chamadas de API e transformações

### 3.2 Regras de Hooks
- [ ] Nenhum hook retorna JSX
- [ ] Nenhum hook tem efeito colateral implícito
- [ ] Nenhum hook mistura estado + lógica + API
- [ ] Hooks seguem convenção de nomenclatura: `use[Component][Responsibility].ts`

---

## 4. COMPONENTES DE FORMULÁRIO

### 4.1 Profile[Component]Form.tsx
- [ ] Recebe TODOS os dados via props
- [ ] Recebe TODOS os handlers via props
- [ ] Não tem `useState` próprio
- [ ] Não tem `useEffect` próprio
- [ ] Não faz chamadas de API
- [ ] Não contém lógica de cálculo
- [ ] Não contém validação inline

### 4.2 JSX
- [ ] JSX é declarativo
- [ ] Cálculos são feitos antes do return
- [ ] Validações são feitas em handlers externos
- [ ] Callbacks são passados via props
- [ ] Zero lógica condicional complexa no JSX

---

## 5. TIPOS E INTERFACES

### 5.1 Tipos Públicos
- [ ] Tipos exportados nunca mudam de assinatura
- [ ] Tipos públicos são imutáveis entre versões
- [ ] Tipos de props nunca são inferidos implicitamente

### 5.2 Tipos Locais
- [ ] Tipos locais não vazam para outros módulos
- [ ] Tipos internos não são exportados sem necessidade
- [ ] Nenhuma inferência "esperta" de tipos

---

## 6. IMPORTS E DEPENDÊNCIAS

### 6.1 Imports
- [ ] Zero imports não utilizados
- [ ] Zero dependências circulares
- [ ] Imports de CSS apenas no componente que o usa
- [ ] Imports de tipos apenas quando necessário

### 6.2 Estrutura de Imports
- [ ] Imports de React primeiro
- [ ] Imports de APIs segundo
- [ ] Imports de hooks terceiro
- [ ] Imports de componentes quarto
- [ ] Imports de CSS último

---

## 7. PROIBIÇÕES ABSOLUTAS

### 7.1 Durante Refatoração
- [ ] NÃO alterar comportamento existente
- [ ] NÃO corrigir bugs fora do escopo
- [ ] NÃO criar abstrações sem ordem explícita
- [ ] NÃO otimizar antes de estabilizar
- [ ] NÃO renomear variáveis sem necessidade
- [ ] NÃO alterar mensagens de erro
- [ ] NÃO alterar classes CSS
- [ ] NÃO remover logs existentes

### 7.2 Durante Desenvolvimento
- [ ] NÃO misturar responsabilidades em um arquivo
- [ ] NÃO esconder lógica em JSX
- [ ] NÃO introduzir estado implícito
- [ ] NÃO depender de "bom senso" para funcionar
- [ ] NÃO criar hooks genéricos sem necessidade explícita

---

## 8. ESTRUTURA DE ARQUIVOS

### 8.1 Convenção de Nomenclatura
- [ ] Componente orquestrador: `[Component].tsx`
- [ ] Hook de estado: `use[Component]State.ts`
- [ ] Hook de lógica: `use[Component]Logic.ts`
- [ ] Hook de dados: `use[Component]Data.ts`
- [ ] Componente de formulário: `[Component]Form.tsx`

### 8.2 Organização
- [ ] Hooks em `hooks/`
- [ ] Componentes em `components/`
- [ ] Forms em `components/` (mesmo diretório do orquestrador)
- [ ] CSS junto ao componente que o usa

---

## 9. VALIDAÇÃO DE PR

### 9.1 Checklist Obrigatório
- [ ] Arquivo não mistura responsabilidades
- [ ] JSX não contém lógica
- [ ] Estado não está no lugar errado
- [ ] Hooks seguem separação de responsabilidades
- [ ] Imports estão corretos
- [ ] Tipos estão corretos
- [ ] Nenhuma proibição absoluta foi violada

### 9.2 Critério de Rejeição
Um PR é REJEITADO se:
- Misturar responsabilidades
- Esconder lógica em JSX
- Introduzir estado implícito
- Depender de "bom senso" para funcionar
- Violar qualquer proibição absoluta

---

## 10. REFATORAÇÃO ESTRUTURAL

### 10.1 Quando Refatorar
- [ ] Componente excede 200 linhas
- [ ] Componente mistura 3+ responsabilidades
- [ ] Componente tem lógica complexa no JSX
- [ ] Componente tem múltiplos `useState` não relacionados

### 10.2 Processo de Refatoração
- [ ] Extrair estado para `use[Component]State.ts`
- [ ] Extrair lógica para `use[Component]Logic.ts`
- [ ] Extrair dados para `use[Component]Data.ts` (se aplicável)
- [ ] Extrair JSX para `[Component]Form.tsx`
- [ ] Manter orquestrador apenas com composição
- [ ] Validar que comportamento permanece idêntico

---

**Este checklist é obrigatório para todos os componentes React do projeto.**  
**Violações resultam em rejeição de PR.**

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->