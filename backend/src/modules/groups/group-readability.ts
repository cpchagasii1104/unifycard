// backend/src/modules/groups/group-readability.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CANÔNICO — regra ÚNICA de "quem pode LER este grupo"
// ║ NORMA:   docs/01_normative/CONTRATO_GRUPOS_V2.md §2.6 (não-membro não vê por padrão)
// ║ NÃO:     copiar esta lógica para dentro de uma rota nova
// ║ EM VEZ:  importar daqui — guard `audit-group-read-siblings-same-gate` exige
// ╚════════════════════════════════════════════════════════════════
//
// 🔴 POR QUE ESTE ARQUIVO EXISTE (2026-08-05, depois da auditoria da YALA).
//
// Em 2026-08-05 eu consertei a família "irmãos" dentro de `groups.routes.ts`: rotas da mesma casa
// lendo o mesmo recurso com gates diferentes. A auditoria independente mostrou que o conserto
// estava **no lugar errado** — a regra virou função LOCAL de um arquivo, e o guard passou a vigiar
// **um arquivo só**. Fora dele, o módulo tinha mais 3 rotas lendo grupo específico sem checagem
// escopada ao grupo (`closure-summary`, `state-history`, `insights`).
//
// **Regra que mora dentro de um arquivo não é regra do domínio: é hábito daquele arquivo.**
// Por isso ela sai daqui agora, e o guard passa a exigir o módulo inteiro.
//
// ⚠️ Permissão de TENANT não substitui isto. `fastify.requirePermission(['groups:read'])` prova
// acesso ao MÓDULO; não prova autoridade sobre AQUELE grupo. As duas coisas são necessárias.
import { groupsService } from './groups.service';

/**
 * 🔒 Membership do PRINCIPAL AUTENTICADO — a régua estrita, para o que o `CONTRATO_GRUPOS_V2` §2.6
 * fecha por padrão: *"não-membro não vê"*. Use onde houver informação econômica.
 */
export async function ehMembroDoGrupo(
  tenantId: string,
  userId: string,
  groupId: string
): Promise<boolean> {
  const members = await groupsService.getGroupMembers(tenantId, groupId);
  return members.some((m) => m.userId !== null && m.userId === userId);
}

/**
 * 🔒 Legibilidade: grupo SECRETO não é legível por não-membro; público e privado são.
 *
 * A regra sai do próprio módulo, não de invenção: `joinGroup` exige **convite** para secreto e
 * apenas **pedido de entrada** para privado — logo privado precisa ser encontrável (senão ninguém
 * pede entrada) e secreto não pode ser legível por quem está fora.
 *
 * 🔴 QUEM CHAMA DEVE RESPONDER 404, NÃO 403. Um 403 responde *"existe, mas você não pode"* — e isso
 * confirma a existência do grupo secreto para quem só chutou o id. Indistinguível de inexistente é
 * a única resposta que não vaza.
 */
export async function grupoLegivelPor(
  tenantId: string,
  userId: string,
  groupId: string,
  visibility: string | undefined
): Promise<boolean> {
  if (visibility !== 'secret') {
    return true;
  }
  return ehMembroDoGrupo(tenantId, userId, groupId);
}
