// frontend/src/utils/jwt.ts
// F-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH-SLICE-A (DT-SESSION-TENANT-ID-REQUIRED-ON-PUBLISH).
//
// 🔴 CAUSA-RAIZ DIAGNOSTICADA (2026-07-06, diagnose-first como o cartório mandou): JWT usa BASE64URL
// (RFC 7515 — alfabeto com '-' e '_', sem padding). O `atob()` de browser lança DOMException
// "Invalid character" nesses caracteres — e ~90% dos payloads reais (UUIDs+email+iat) os contêm.
// O padrão frágil `JSON.parse(atob(token.split('.')[1]))` estava em 10 call sites — TODA a cadeia de
// sessão (Login, Register, SessionProvider, client, social). Como a ÚNICA fonte de tenantId é a
// extração do JWT (por design), um token cujo payload encode com -/_ quebrava login/bootstrap/requests
// com TENANT_ID_REQUIRED; quando o localStorage já tinha o TENANT_KEY (salvo num login "sortudo"),
// tudo funcionava — até o storage limpar. Essa é a intermitência do bug.
//
// ESTE helper é o ÚNICO lugar autorizado a decodificar payload de JWT no frontend (guard
// audit-jwt-payload-decode-frontend morde `atob(` fora daqui). Ele NÃO valida assinatura (isso é do
// backend) — só decodifica o payload pra leitura de claims não-sensíveis (tenantId etc). Frontend
// nunca cria verdade: o backend re-valida o token em toda request.

/** Decodifica base64url (RFC 4648 §5) de forma segura pra atob: troca -/_ e repõe padding. */
function base64UrlToBase64(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) return base64 + '==';
  if (pad === 3) return base64 + '=';
  if (pad === 1) throw new Error('base64url inválido (comprimento impossível)');
  return base64;
}

/**
 * atob base64url-safe: aceita base64url OU base64 padrão. Use SEMPRE isto em vez de atob() cru para
 * qualquer dado vindo do backend (JWT payload, WebAuthn challenge — o backend usa toString('base64url')).
 */
export function atobBase64Url(input: string): string {
  return atob(base64UrlToBase64(input));
}

/**
 * Decodifica o PAYLOAD de um JWT (segmento 2), base64url-safe.
 * Lança Error com mensagem clara se o token for malformado — os callers já têm try/catch fail-closed.
 * Default `any` preserva a tipagem do padrão anterior (`JSON.parse` devolvia any) — este fix é
 * MECÂNICO (decodificação), não muda contratos de tipo dos 10 call sites.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function decodeJwtPayload<T = any>(token: string): T {
  const parts = token.split('.');
  if (parts.length < 2 || !parts[1]) {
    throw new Error('JWT malformado (sem segmento de payload)');
  }
  const json = atob(base64UrlToBase64(parts[1]));
  return JSON.parse(json) as T;
}
