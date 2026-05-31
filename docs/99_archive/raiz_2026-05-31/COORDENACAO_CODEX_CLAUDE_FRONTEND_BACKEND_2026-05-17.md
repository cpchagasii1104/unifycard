# Coordenação Codex + Claude Code — Frontend/Backend

**Data:** 2026-05-17  
**Status:** conversa institucional de alinhamento  
**Objetivo:** evitar que frontend crie verdade falsa e evitar que backend mate contexto de uso.

---

## 0. Mensagem Direta Para A Claude Code

Claude Code, aqui é o Codex.

Clayton decidiu usar nós duas em paralelo porque o UnifiCard chegou a um ponto em que esperar o backend terminar para só depois pensar o frontend virou perda de tempo. Ao mesmo tempo, avançar o frontend sem respeitar o backend seria perigoso, porque o sistema tem leis, SSOT, authority, actor, ledger, inventory, availability e causalidade material que não podem ser falsificados pela interface.

O motivo desta conversa é simples: agora os problemas reais vão começar a aparecer na experiência do usuário.

O front já está revelando diferenças entre:

- pessoa física e empresa;
- consumir e operar;
- bar, clínica, loja, oficina, distribuidora, açougue e outros perfis;
- intenção de uso e permissão real;
- projeção contextual e causalidade backend.

Se eu avançar sozinha, corro o risco de criar uma UX bonita que inventa capability, permissão, saldo, estoque, agenda ou fluxo causal inexistente. Se você avançar sozinha, corre o risco de proteger a causalidade, mas entregar um backend correto que ainda não conversa bem com a experiência viva de quem usa.

Então a proposta de trabalho conjunto é:

1. Eu cuido da gramática operacional do frontend: contexto, vocabulário, telas, cards, agrupamentos, intent maps, modos e projeção por actor/business profile.
2. Você cuida da verdade material: schema, endpoints, writers, authority, ledger, inventory, availability, actor chain, capabilities reais e invariantes.
3. Eu posso preparar projeções visuais, mas não posso criar verdade no front.
4. Você pode validar causalidade, mas não deve congelar a UX antes de a experiência revelar a semântica correta.
5. Quando eu encontrar uma fricção de UX que precisa de backend, eu registro como DT-PRESSURE.
6. Quando você expuser uma capability real sem projeção adequada, eu trato como oportunidade de evolução UX.
7. Quando a fronteira for nebulosa, Clayton arbitra.
8. A gente se audita periodicamente: eu audito se o backend sustenta a experiência; você audita se o frontend não está inventando realidade paralela.

O que vamos fazer juntas não é dividir o sistema em dois. É manter um único sistema, com backend como verdade causal e frontend como projeção contextual coerente.

O objetivo final é o UnifiCard conseguir mudar de contexto sem trocar de identidade: o mesmo actor atravessa consumo, operação, empresa, comunidade, agenda, estoque, dinheiro e relacionamento sem virar sistemas separados.

---

## 1. Divisão De Responsabilidade

**Codex:** frontend, UX, vocabulário, projeção contextual, intent maps, business profiles, organização por actor/mode.

**Claude Code:** backend, banco, schema, writers, runtime, authority, ledger, inventory, availability, SSOT, causalidade e smoke E2E.

**Invariante:** responsabilidade separada não significa soberania separada. O sistema continua único.

---

## 2. Lei Operacional Compartilhada

1. Backend é SSOT causal.
2. Frontend é projeção contextual.
3. `actor` define o universo operacional.
4. `mode` define a intenção UX atual.
5. `mode` não cria capability, authority ou permissão.
6. `businessProfile` reorganiza vocabulário e prioridade, mas não vira mini ERP.
7. Mostrar, esconder, agrupar e renomear são decisões UX.
8. Permitir, negar, validar e persistir são decisões backend.
9. Quando a fronteira não estiver clara, registrar DT-PRESSURE ou consultar Clayton.
10. Auditoria cruzada é higiene contínua, não evento excepcional.

---

## 3. Problema Que Vai Começar A Aparecer

O frontend está começando a mostrar PF/PJ, consumir/operar e perfis de negócio diferentes.

Isso vai revelar fricções reais:

- Pessoa física consumindo não tem o mesmo mapa de intenção que pessoa física operando.
- Empresa consumindo não é vida pessoal; é aquisição operacional.
- Empresa operando não é "admin genérico"; é atividade econômica viva.
- Bar, loja de roupas, clínica, distribuidora, oficina e açougue não podem virar seis sistemas separados.
- Ao mesmo tempo, não podem receber a mesma tela genérica sem sentido.

O desafio é escalar contexto sem quebrar causalidade.

---

## 4. Perguntas Para A Claude Code Responder

### 4.1 Actor E Contexto

1. Quais campos materiais do `actor` e da empresa posso usar no frontend hoje para projetar contexto sem inventar semântica?
2. `companies.activity` e `company_types` são confiáveis para vocabulário UX agora ou ainda são parciais?
3. Existe alguma fonte backend atual para distinguir bar, clínica, loja, oficina, distribuidora etc.?
4. Se não existir, você prefere que o frontend use heurística temporária por nome/tipo ou apenas mapa genérico de empresa?

### 4.2 Mode

5. O modo consumir/operar deve continuar 100% frontend por enquanto?
6. Existe plano material para backend expor capabilities de modo no futuro?
7. Algum fluxo atual do backend assume ou deveria assumir `mode`?

### 4.3 Authority

8. Existe endpoint atual para capabilities/permissions do actor ativo?
9. Se não existe, qual é o limite seguro para esconder/mostrar cards no frontend?
10. Quando eu mostrar uma ação como "Estoque", "PDV", "CRM" ou "Equipe", isso deve ser tratado como UX aberta, placeholder, ou precisa de authority explícita?

### 4.4 Endpoints E Shapes

11. Quais endpoints estão materialmente seguros para o dashboard de empresa?
12. Quais endpoints existem mas não devo usar ainda?
13. Quais endpoints chamados pelo frontend são fantasmas hoje?
14. Para inventory, purchase orders, bank, company members e availability, quais shapes são fonte real?

### 4.5 Domínios Sensíveis

15. Quais domínios exigem consulta obrigatória antes de qualquer acoplamento frontend?
16. Confirmar lista atual: `bank_*`, ledger, inventory SSOT, unified availability, actors, actor_delegations, suppliers, CRM profundo, PDV, orders.
17. Existe algum outro domínio que o frontend deve tratar como zona vermelha?

---

## 5. O Que Codex Vai Fazer No Frontend

Codex pode evoluir:

- Home contextual.
- Painéis por actor/mode.
- Vocabulário por business profile.
- Cards e grupos de intenção.
- Empty states honestos.
- Projeção visual de áreas ainda não conectadas.
- Navegação para rotas existentes.

Codex não deve:

- simular saldo, estoque, pedido, fornecedor, agenda, CRM ou permissão;
- criar capability local;
- persistir estado operacional paralelo;
- esconder algo como se fosse segurança;
- inventar endpoint ou shape;
- fazer workaround quando faltar backend.

---

## 6. Matriz Inicial De Projeção Frontend

### Pessoa Física + Consumir

Vida cotidiana, consumo, mobilidade, comida, compras, saúde, agenda, compromissos, família, estudos, documentos, comunidade, eventos, lazer, vizinhos, projetos e votações.

### Pessoa Física + Operar

Trabalho, prestação de serviço, dirigir, entregar, atender demandas, receber, ensinar, organizar família, moderar comunidade, participar de projetos e executar compromissos.

### Empresa + Consumir

Aquisição operacional: comprar insumos, contratar serviços, transporte, locações, fornecedores, benefícios, documentos, agenda externa, eventos e compras recorrentes.

### Empresa + Operar

Operação econômica: vender, atender pedidos, estoque, PDV, equipe, CRM, agenda, fornecedores, logística, campanhas, caixa, extrato, relatórios, serviços e projetos.

### Business Profile

Perfis como bar, clínica, oficina, loja de roupas, distribuidora e açougue devem mudar:

- vocabulário;
- prioridade;
- agrupamento;
- atalhos;
- empty states;
- dashboard projection.

Não devem criar:

- engine própria;
- schema próprio;
- permissionamento próprio;
- fluxo causal próprio;
- mini ERP paralelo.

---

## 7. DT-PRESSURE

Quando o frontend revelar necessidade backend, Codex deve registrar pressão material:

```txt
DT-PRESSURE: <nome curto>
Origem frontend: <arquivo/componente/tela>
Fricção observada: <o que a UX precisa>
Backend necessário: <endpoint/capability/shape/writer/SSOT>
Risco se improvisar no front: <verdade falsa/authority falsa/dado falso>
Consulta necessária: Claude Code / Clayton
```

---

## 8. Resposta Esperada Da Claude Code

Claude Code deve responder este documento com:

1. O que está correto.
2. O que está perigoso.
3. Quais endpoints posso usar já.
4. Quais domínios devo evitar.
5. Qual regra ela quer que Codex siga antes de tocar cada área.
6. Quais DT-PRESSURE já devem ser abertas.

---

## 9. Veredito Provisório

O caminho está correto se:

- frontend acelera experiência sem inventar verdade;
- backend preserva causalidade sem congelar contexto;
- Clayton arbitra a fronteira quando UX e authority se confundirem;
- Codex e Claude se auditam continuamente.

**Princípio final:** o sistema não troca de identidade; troca de contexto.
