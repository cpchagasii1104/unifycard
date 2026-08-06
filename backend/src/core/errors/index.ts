// src/core/errors/index.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  🪦 TOMBSTONE — barril MORTO, zero importadores (medido 2026-08-06)
// ║ NORMA:   CLAUDE.md §3 "duas verdades divergem em silêncio" · GO Clayton 2026-08-06
// ║ NÃO:     NÃO importar daqui, NÃO reanimar, NÃO acrescentar export
// ║ EM VEZ:  `@core/errors` (o ARQUIVO `src/core/errors.ts`) — AppError e subclasses
// ╚════════════════════════════════════════════════════════════════
//
// ═══ AS DUAS CASAS, E POR QUE ESTA MORREU ═══
// Existem `src/core/errors.ts` (ARQUIVO) e `src/core/errors/` (PASTA). Em Node/TS o **arquivo vence
// a pasta**: todo `from '@core/errors'` resolve para `errors.ts`. Este barril, portanto, **nunca é
// alcançado** — medido: **zero importadores** em `src/`.
//
// 🔴 E ele não era inofensivo. Ele redefinia os MESMOS NOMES com OUTRA SEMÂNTICA:
//
//     aqui (morto):        export const BadRequestError = (msg) => HttpError.badRequest(msg)   ← FUNÇÃO
//     lá (vivo):           export class  BadRequestError extends AppError                       ← CLASSE
//
// Quem acreditasse neste arquivo escreveria `new BadRequestError(...)` e receberia
// `TypeError: BadRequestError is not a constructor` — ou, pior, chamaria sem `new` no lugar vivo e
// receberia um erro que não é `instanceof AppError`, escapando de todo `catch` tipado do sistema.
// **É a doença das duas verdades em miniatura, no lugar mais irônico possível: a casa dos erros.**
//
// ═══ POR QUE TOMBSTONE E NÃO DELETE ═══
// `CLAUDE.md §5`: deleção de módulo pré-existente exige autorização explícita do dono. O GO de
// 2026-08-06 foi *"convergir para uma casa, deixar tombstone na outra"* — tombstone é o que está
// autorizado, e é o suficiente: o barril já não é alcançável, e o que fazia dano era a CRENÇA de
// que ele valia. Este cabeçalho mata a crença.
//
// ⚠️ A PASTA **NÃO** morre — ela tem conteúdo EXCLUSIVO e VIVO, importado por caminho explícito:
//     `@core/errors/http-error`            → HttpError (66 sítios usam a pasta por caminho direto)
//     `@core/errors/error-codes`           → ErrorCode
//     `@core/errors/postgres-schema-error` → describePostgresSchemaError
// 📌 **Correção de uma afirmação minha do mesmo dia:** eu classifiquei isto como *"convergir para
// uma casa"* e chamei de tarefa barata. **Medido, era falso nas duas metades** — convergir custaria
// 213 sítios de import, e a pasta não é duplicata: tem coisa que o arquivo não tem. O que era
// barato — e é o que resolve — é matar o BARRIL que redefine nomes. `referência não é alcance`
// aplicada ao meu próprio diagnóstico.

export {};
