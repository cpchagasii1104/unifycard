// src/modules/votes/votes.types.ts
// Tipos centralizados do módulo de votações (fonte única)
//
// Nota: CreateVoteInput aqui é do contexto "votações standalone" (API /votes).
// O módulo groups tem seu próprio CreateVoteInput em groups/votes.types.ts
// (contrato diferente: closesAt, regras de grupo). Não unificar sem motivo.

export interface CreateVoteInput {
  title: string;
  description?: string;
  options: string[];
  startsAt?: string;
  endsAt?: string;
}