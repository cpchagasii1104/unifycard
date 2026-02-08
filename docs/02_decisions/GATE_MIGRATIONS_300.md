# Gate de Migration — 300_add_actor_rbac_functions

## Escopo
Avaliar e aprovar a migration de RBAC V2 baseada em `actor_id`,
conforme definido em `RBAC_V2_CONTRACT.md`.

A migration introduz funções de verificação de permissão e role
com interface exclusivamente por `actor_id`, mantendo o mapeamento
interno actor → user como detalhe transitório de implementação.

---

## Artefato sob avaliação
- `backend/migrations/300_add_actor_rbac_functions.sql`

---

## Natureza da mudança
- Introdução de funções de RBAC com interface por `actor_id`
- Uso explícito de `SECURITY DEFINER` para encapsular acesso a tabelas sensíveis
- Fixação de schema explícito (`public`) para evitar ambiguidade de `search_path`
- Nenhuma alteração de schema
- Nenhuma modificação em dados existentes

---

## Riscos avaliados
- **Acoplamento transitório actor → user**
  - Conhecido, documentado e aceito como etapa intermediária
  - Compatível com o contrato atual de RBAC V2
- **Exposição indevida de dados**
  - Mitigada pelo uso de `SECURITY DEFINER`
  - Evita concessão direta de SELECT em tabelas de RBAC
- **Dependência de índices existentes**
  - Verificada como presente no schema atual
  - Considerada aceitável para o volume esperado de chamadas RBAC

---

## Auditoria técnica
- Funções são puras (retornam boolean)
- Não possuem efeitos colaterais
- Não alteram estado
- Interface está alinhada com o contrato canônico de autoridade
- Implementação consistente com o Gate de Authority previamente fechado

---

## Decisão
**APROVADO**

A migration está tecnicamente correta, alinhada ao contrato de RBAC V2
e segura para execução em ambientes controlados.

A remoção definitiva da dependência de `user_id` permanece
explicitamente fora do escopo desta migration e deverá ser tratada
em Gate futuro específico.

---

## Próximos passos
- Execução da migration em ambiente alvo conforme pipeline padrão
- Monitoramento de performance de chamadas RBAC
- Planejamento de Gate futuro para eliminação total de `user_id` do modelo de autoridade
