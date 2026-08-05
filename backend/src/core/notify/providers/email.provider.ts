// backend/src/core/notify/providers/email.provider.ts
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — provider de e-mail SEM entrega real, e que NÃO finge ter entregue
// ║ NORMA:   "zero é afirmação; desconhecido é a verdade" · sucesso falso é pior que falha
// ║ NÃO:     NÃO devolver success:true sem provider real ter confirmado a entrega.
// ║ EM VEZ:  plugar SES/SendGrid aqui — a fila drena e `pending` vira `sent` sozinho.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ O QUE ESTE ARQUIVO FAZIA, E POR QUE ERA O PIOR TIPO DE DEFEITO (2026-08-04) ═══
// `sendEmail` dava um `console.log` e devolvia `{ success: true }`. O caller
// (`notify.service.ts:280`) lê esse `success` e marca a linha como **`sent`, com `sent_at = now()`**.
// O sistema registrava entrega de mensagem que nunca saiu — com carimbo de hora, que é justamente
// o que torna a mentira convincente para quem auditar depois.
//
// Clayton, ao levantar isto: *"enquanto o sistema estiver na minha máquina, ele não tem acesso a
// servidor pra disparar 'esqueci minha senha' / 'confirmar e-mail'. A gente tem que deixar pronto,
// que nem a questão do dinheiro."* — e a resposta é a mesma daquela: **o mecanismo é real, a última
// milha está pendente, e o ESTADO diz a verdade sobre si**. Servidor ausente é condição honesta,
// com a qual todo mundo sabe lidar. Sucesso falso não é.
//
// ═══ O QUE ACONTECE AGORA, SEM SERVIDOR ═══
// A mensagem VIRA LINHA em `notify_queue` (destinatário, assunto, payload, token — tudo lá) e o
// provider recusa dizendo por quê. A linha termina `failed` com `last_error` nomeado, nunca `sent`.
// Na máquina de Clayton a caixa de entrada é uma consulta: confirmar e-mail e recuperar senha ficam
// exercitáveis ponta a ponta lendo o token da linha, como um usuário leria do e-mail.
//
// ⚠️ `retryable: false` é deliberado. Falta de configuração não melhora tentando de novo — gastar
// 5 tentativas contra uma parede transforma um estado claro ("não configurado") em ruído ("falhou
// 5 vezes"), e é assim que causa-raiz vira mistério.

import { EmailDetails, ProviderResult } from '../notify.types';

export interface EmailProviderConfig {
  fromAddress: string;
  // futuro: apiKey, providerName etc
}

/** Ligado só quando existir provider de verdade. Ausente/qualquer-outro = desligado (fail-closed). */
export const EMAIL_PROVIDER_FLAG = 'EMAIL_PROVIDER_ENABLED';

export const EMAIL_NOT_CONFIGURED =
  'EMAIL_PROVIDER_NOT_CONFIGURED: nenhum provider de e-mail real está ligado, então NADA foi ' +
  'entregue. A mensagem está registrada em notify_queue (destinatário, assunto e payload) e pode ' +
  'ser lida de lá. Para entregar de verdade são DUAS coisas, não uma: (1) implementar o envio ' +
  'neste provider e ligar EMAIL_PROVIDER_ENABLED=true; (2) DAR PARTIDA no drenador da fila — ' +
  '`runNotifyWorkerOnce` existe e hoje tem ZERO callers, como todos os 8 workers deste ' +
  'repositório. Sem (2), a fila nunca esvazia sozinha mesmo com provider real.';

// 🔴 A SEGUNDA METADE, ESCRITA PORQUE EU QUASE A OMITI (2026-08-04).
// Ao materializar `notify_queue` eu declarei o pipeline funcionando — e a minha própria prova
// chamou `processPendingForTenant` À MÃO. `runNotifyWorkerOnce` tem zero callers. É a armadilha #2
// do fundamento de arquitetura ("presença de arquivo prova INTENÇÃO, nunca CAPACIDADE"), cometida
// por mim uma hora depois de escrever um guard contra ela em outro módulo.
//
// Medido: os 8 workers de `src/workers/` têm ZERO callers cada. Não é defeito desta fatia — é
// condição SISTÊMICA da camada de worker, e ligá-la é decisão de orquestração do dono, não conserto
// de módulo. Fica NOMEADA aqui para que ninguém plugue um provider achando que basta.

export class EmailProvider {
  constructor(private readonly config: EmailProviderConfig) {}

  async sendEmail(details: EmailDetails): Promise<ProviderResult> {
    // 🔴 FAIL-CLOSED. Enquanto não houver integração real, a única resposta verdadeira é "não
    // entreguei". Trocar isto por `success: true` de novo faz o sistema inteiro voltar a acreditar
    // que entregou — e deixa `audit-email-provider-no-false-success` vermelho.
    if (process.env[EMAIL_PROVIDER_FLAG] !== 'true') {
      console.warn('[EmailProvider] NÃO ENTREGUE (provider não configurado)', {
        from: this.config.fromAddress,
        to: details.to,
        subject: details.subject,
      });
      return { success: false, error: EMAIL_NOT_CONFIGURED, retryable: false };
    }

    // TODO: integrar provider real (SES/SendGrid/…). Só aqui pode nascer um `success: true`, e
    // apenas com confirmação do provider — nunca por chegar ao fim da função.
    return {
      success: false,
      error: 'EMAIL_PROVIDER_ENABLED=true mas nenhuma integração foi implementada neste provider.',
      retryable: false,
    };
  }
}
