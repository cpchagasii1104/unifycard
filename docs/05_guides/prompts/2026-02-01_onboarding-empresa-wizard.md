Subject: PROMPT 26 — Onboarding de Empresa em Múltiplos Passos (Wizard Estrutural)

PROMPT 26 — Onboarding de Empresa em Múltiplos Passos (Wizard Estrutural)

OBJETIVO
Transformar o cadastro de empresa em um processo de nascimento econômico completo, conectando dados legais, modelo de negócio e infraestrutura operacional desde o primeiro momento.

PRINCÍPIO CENTRAL
Empresa não "se cadastra".
Ela nasce pronta ou não nasce.

Nada de cadastro raso. Nada de "configurar depois".
O onboarding já define o que a empresa é, como opera e quais módulos do sistema fazem sentido para ela.

---

ESTRUTURA DO WIZARD

PASSO 1 — DADOS LEGAIS E DOCUMENTAÇÃO (KYC EMPRESARIAL)

Campos obrigatórios:

* CNPJ
* Razão Social
* Nome Fantasia
* Endereço completo (CEP, rua, número, cidade, UF)

Uploads obrigatórios:

* Cartão CNPJ (Receita Federal)
* Contrato Social ou Última Alteração (PDF)
* Comprovante de Endereço da Empresa
* Documentos dos Sócios (CPF + RG ou CNH)

Regras:

* Upload versionado (histórico preservado)
* Status do onboarding: draft → pending_validation → validated
* Empresa pode operar com restrições enquanto documentos não validados
* Nenhum documento pode ser alterado sem gerar nova versão

---

PASSO 2 — MODELO DE NEGÓCIO E CATEGORIZAÇÃO

Definições obrigatórias:

* Tipo de empresa:

  * Comércio
  * Prestação de serviços
  * Híbrida
  * Indústria
* Categorias principais e secundárias
* Área de atuação:

  * Loja física
  * Loja virtual
  * Atendimento em campo
* Região de atuação (cidade / bairros)

Definições operacionais:

* Possui múltiplos profissionais? (sim/não)
* Quantidade estimada de agendas / recursos
* Atuação local ou regional

Regras:

* Categoria define templates, serviços e regras futuras
* Nada é criado ainda, apenas declarado
* Tudo fica registrado no onboarding

---

PASSO 3 — INFRAESTRUTURA E MÓDULOS

Seleção de módulos:

* Marketplace (produtos / serviços)
* Agenda de serviços
* Dispatch automático
* Orçamento assistido
* Pagamentos:

  * UnifiCard
  * Gateway externo
* PDV físico
* Loja virtual

Configurações iniciais:

* Importar templates canônicos por categoria (sim/não)
* Tipo de produto:

  * Industrializado
  * Produção própria
  * Ambos
* Tipo de serviço:

  * Preço fixo
  * Orçamento obrigatório
  * Ambos

Regras:

* Seleção ativa apenas módulos compatíveis com o modelo de negócio
* Nada de ativar o que não faz sentido
* Plano sugerido automaticamente (não obrigatório)

---

PASSO 4 — REVISÃO E ATIVAÇÃO

Resumo exibido:

* Dados legais informados
* Documentos anexados
* Categorias escolhidas
* Módulos que serão ativados
* Restrições iniciais (se houver)

Ações finais:

* Confirmar criação da empresa
* Gerar ator econômico
* Conectar automaticamente:

  * Trust inicial
  * Fundo regional
  * Marketplace
  * Pagamentos
  * Templates selecionados

Evento gerado:

* company_onboarded (auditável)

---

REGRAS DE GOVERNANÇA

* Nenhuma empresa ativa sem passar pelo wizard
* Documentação não validada limita operações sensíveis
* Tudo auditável e versionado
* Sem decisões manuais escondidas
* Onboarding não é formulário, é contrato inicial com o sistema

---

RESULTADO FINAL

Ao finalizar o PROMPT 26:

* A empresa já nasce conectada ao ecossistema
* Categorias, serviços e produtos fazem sentido desde o início
* Não existe "empresa vazia"
* O sistema entende o negócio antes do primeiro clique operacional

Esse prompt fecha o buraco entre "criar empresa" e "empresa operável".

FIM DO PROMPT 26

