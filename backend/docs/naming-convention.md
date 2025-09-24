📄 DOCUMENTO OFICIAL: Padrão de Nomenclatura e Estrutura — Projeto UnifyCard
1️⃣ Banco de Dados (PostgreSQL)
✅ Nomes de tabelas, enums e colunas:

minúsculo

snake_case

Exemplo:

Tabela: user_profile

Coluna: user_id

✅ Sem CamelCase ou maiúsculas.

2️⃣ Backend (Node.js, Express, Sequelize)
✅ Pastas e arquivos ➜ kebab-case (minúsculo com hífens).
✅ Nomes SEMPRE em inglês.
✅ Sem camelCase, PascalCase, snake_case (exceto no banco).

Tipo de Arquivo	Exemplo
Model	user.js
Controller	user-controller.js
Service	user-service.js
Repository	user-repository.js
Route	user-routes.js
Schema	signup-schema.js
Validator	cpf-validator.js
DTO	user-dto.js
Event	user-created-event.js
Middleware	auth-middleware.js
Util	date-util.js, email-util.js
Test	user-controller.test.js
Configuração	config.js, env.js
Documentação	readme.md, naming-convention.md

✅ Pastas:

modules/user/

modules/user/controllers/

modules/user/services/

etc.

✅ Exemplo real:

swift
Copiar
Editar
/backend/modules/user/controllers/signup-controller.js
/backend/modules/user/services/user-service.js
/backend/modules/user/models/user.js
3️⃣ Frontend (React, Webpack, etc.)
✅ Pastas e arquivos:

kebab-case para tudo.

Componentes, páginas, serviços, contextos etc.

Tipo de Arquivo	Exemplo
Página	signup-page.jsx, dashboard-page.jsx
Componente	user-profile-card.jsx
Serviço	auth-service.js
Contexto	auth-context.js
Hook	use-auth.js
Estilo	signup-page.module.css
Teste	signup-page.test.js

✅ Pastas:

modules/user/pages/

modules/user/components/

modules/user/services/

etc.

4️⃣ Regra principal e inegociável a partir de agora
✅ Arquivos e pastas em inglês
✅ kebab-case sempre (nenhum CamelCase, PascalCase ou snake_case no nome de arquivos/pastas)
✅ Maiúsculas só dentro do código (ex.: classes)
✅ Banco em snake_case (padrão PostgreSQL)

5️⃣ Onde salvar este documento
Este documento deve estar salvo como:

bash
Copiar
Editar
/backend/docs/naming-convention.md
e deve ser a referência oficial para qualquer decisão de nomes daqui para frente.

6️⃣ Compromisso
NUNCA criaremos um nome de arquivo, pasta ou entidade que não siga este padrão.
NUNCA permitiremos que alguém (nem eu, nem outra IA, nem um dev externo) fuja desse padrão.
SEMPRE voltaremos a este documento antes de nomear ou renomear qualquer coisa.

💡 Se quiser, posso já criar esse arquivo diretamente para você (naming-convention.md) no caminho certo.
👉 Quer que eu já gere o arquivo real agora?

🚀 Esse documento é a fundação do projeto – daqui pra frente, não tem desculpas ou improvisos. 🚀


✅ CHECKLIST DE REVISÃO PARA NOVOS MÓDULOS E TABELAS (BANCO DE DADOS)
1. NOMENCLATURA E PADRÃO
 Tabela, colunas e enums estão em snake_case, minúsculo, e em inglês?

 PK com UUID (uuid/gen_random_uuid()).

 Campos obrigatórios têm NOT NULL definido.

2. LISTAS FECHADAS vs. ABERTAS
 ENUM apenas para listas fechadas (ex: status, role, tipo de conta).

 Lookup Table (tabela auxiliar) para listas abertas/expansíveis (ex: tags, interesses, condições de produto).

3. RELACIONAMENTOS E INTEGRIDADE
 Todas as FKs estão com ON DELETE correto (CASCADE/SET NULL)?

 Índices em todos os campos de FK críticos e para busca recorrente.

 Campos genéricos (ex: reference_id, reference_type) estão documentados.

4. AUDITORIA E RASTREAMENTO
 Tabela tem triggers para INSERT/UPDATE/DELETE quando alteração de dados críticos?

 Logs de auditoria têm linked_entity_type e linked_entity_id bem definidos.

5. CAMPOS SENSÍVEIS E PRIVACIDADE
 Campos sensíveis (CPF, RG, CNH, Passaporte, etc) estão em BYTEA e protegidos por extensão de criptografia?

 Não há dados sensíveis em campos TEXT sem proteção.

 Campos de consentimento (consent_at) estão presentes, quando aplicável.

6. PERFORMANCE E ESCALABILIDADE
 Índices criados para status, datas, e colunas mais usadas em WHERE/ORDER.

 Tabela de alto volume preparada para particionamento por data ou status (se necessário).

 Materialized views para consultas pesadas ou analytics.

7. EXTENSIBILIDADE
 Campos metadata JSONB adicionados quando há potencial para extensões futuras.

 Campos created_at, updated_at, deleted_at (soft delete) presentes.

 Campos multi-idioma adicionados onde houver exposição internacional.

8. DOCUMENTAÇÃO E TESTES
 Todas as alterações estão documentadas no naming-convention.md e changelog do módulo.

 Testes de constraints, triggers e performance rodados após alterações estruturais.

DICA: Antes de rodar migrações em produção, sempre valide com uma auditoria automática:

Verifique ausência de campos NULL onde não deveriam existir.

Confirme unicidade e integridade referencial em massa.

Rode testes de inserção, deleção e update para triggers/auditoria.

Como usar
Use este checklist antes de cada push de migração no banco.

Marque cada item e corrija antes de liberar.

Pode ser adaptado em scripts de validação automatizada (ex: migration lint).