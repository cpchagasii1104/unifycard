#!/usr/bin/env bash
TENANT="fbe13b78-4516-493d-905a-363796aea1d1"

JOAO_USER="a733e66f-b8bd-4bd2-a888-bec820f55339"
JOAO_ACTOR="3198eb58-7478-4e29-bade-456f6ea5b217"
JOAO_PF_ACCT="bbfe4cf8-a398-4684-a276-5c35dc25a587"

MARIA_USER_RAW=$(curl -s -X POST http://localhost:3000/auth/login -H 'Content-Type: application/json' -H "x-tenant-id: $TENANT" -d '{"email":"maria.souza@teste.unificard.local","password":"dev12345"}' | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ console.log(JSON.parse(d).data.user.userId); });")
MARIA_USER="$MARIA_USER_RAW"
MARIA_ACTOR="2677a787-ea7c-498c-bce8-4aaa1bbd696e"
MARIA_ACCT="acf9d9f2-da65-4710-8edc-42c720217d65"

LUCIA_ACTOR="88b6ac4f-c4b1-40f8-8707-0f07c92d7c3d"
LUCIA_ACCT="187b3612-ad48-43d8-98e7-ab1cead85303"

VOLTAGEM_ACTOR="69be4114-8e65-4e2b-b200-db359d060cb7"
VOLTAGEM_ACCT="6047f445-69fc-44db-a73b-73e76c1fea26"

CLINICA_ACTOR="ad5a60b7-7ea1-4d79-a7f4-4c86438ea73a"
CLINICA_ACCT="6dcf640b-469b-40ff-a6fd-263cb4ab8951"

PEDRO_ACTOR="84d9302a-c3f9-4198-8793-a12ee750d6db"

login() {
  curl -s -X POST http://localhost:3000/auth/login -H "Content-Type: application/json" -H "x-tenant-id: $TENANT" -d "{\"email\":\"$1\",\"password\":\"dev12345\"}" \
    | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{console.log(JSON.parse(d).data.tokens.accessToken);}catch(e){console.error('LOGIN_FAIL');process.exit(1);}});"
}
ac() { echo "{\"actorId\":\"$1\",\"intent\":\"$2\",\"source\":\"smoke-p3\",\"scope\":\"tenant:$TENANT\"}"; }
balance() {
  curl -s "http://localhost:3000/bank/balance?actorId=$2" -H "Authorization: Bearer $1" -H "x-tenant-id: $TENANT" -H "x-action-context: $(ac $2 read_bank_state)" \
    | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ try{let x=JSON.parse(d); console.log(x.balanceCents ?? x.balance ?? 'NA');}catch(e){console.log('NA');}});"
}

JOAO_JWT=$(login joao.silva@teste.unificard.local)
MARIA_JWT=$(login maria.souza@teste.unificard.local)
LUCIA_JWT=$(login lucia.lopes@teste.unificard.local)

echo "=== Saldos antes de F1-F7 ==="
echo "  Joao PF:  $(balance "$JOAO_JWT" "$JOAO_ACTOR")"
echo "  Maria PF: $(balance "$MARIA_JWT" "$MARIA_ACTOR")"
echo "  Lucia PF: $(balance "$LUCIA_JWT" "$LUCIA_ACTOR")"
echo "  Voltagem: $(balance "$JOAO_JWT" "$VOLTAGEM_ACTOR")"
echo "  Clinica:  $(balance "$JOAO_JWT" "$CLINICA_ACTOR")"
echo ""

echo "=== F1: Maria -> Joao 10000 cents (P2P PF/PF) via /bank/p2p-transfer ==="
F1_EVENTID=$(node -e "console.log(require('crypto').randomUUID())")
F1_BODY="{\"toUserId\":\"$JOAO_USER\",\"amountCents\":10000,\"eventId\":\"$F1_EVENTID\"}"
F1_RESP=$(curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:3000/bank/p2p-transfer \
  -H "Authorization: Bearer $MARIA_JWT" -H "x-tenant-id: $TENANT" \
  -H "x-action-context: $(ac $MARIA_ACTOR p2p_transfer)" \
  -H "Content-Type: application/json" -d "$F1_BODY")
echo "$F1_RESP" | head -c 700; echo ""; echo ""

echo "=== F2: Joao PF -> Voltagem PJ via /bank/transactions/simple (esperado: erro/achado) ==="
F2_BODY="{\"eventId\":\"smoke-f2-joao-voltagem-50\",\"referenceType\":\"smoke_fase2\",\"fromAccountId\":\"$JOAO_PF_ACCT\",\"toAccountId\":\"$VOLTAGEM_ACCT\",\"amountCents\":5000,\"currency\":\"BRL\",\"transactionType\":\"transfer\",\"description\":\"F2 PF->PJ\",\"concept_id\":\"p2p-transfer\"}"
F2_RESP=$(curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:3000/bank/transactions/simple \
  -H "Authorization: Bearer $JOAO_JWT" -H "x-tenant-id: $TENANT" \
  -H "x-action-context: $(ac $JOAO_ACTOR p2p_transfer)" \
  -H "Content-Type: application/json" -d "$F2_BODY")
echo "$F2_RESP" | head -c 700; echo ""; echo ""

echo "=== F3: balance switch Joao 3-way (PF / Voltagem / Clinica) ==="
B_PF=$(balance "$JOAO_JWT" "$JOAO_ACTOR")
B_VOLT=$(balance "$JOAO_JWT" "$VOLTAGEM_ACTOR")
B_CLIN=$(balance "$JOAO_JWT" "$CLINICA_ACTOR")
echo "  Joao PF:  $B_PF"
echo "  Voltagem: $B_VOLT"
echo "  Clinica:  $B_CLIN"
[ "$B_PF" != "$B_VOLT" ] && [ "$B_VOLT" != "$B_CLIN" ] && [ "$B_PF" != "$B_CLIN" ] && echo "  PASS - 3 valores distintos" || echo "  FAIL - bleed"
echo ""

echo "=== F4: Lucia le balance de Voltagem (delegacao) ==="
curl -s -w "\nHTTP=%{http_code}\n" "http://localhost:3000/bank/balance?actorId=$VOLTAGEM_ACTOR" \
  -H "Authorization: Bearer $LUCIA_JWT" -H "x-tenant-id: $TENANT" \
  -H "x-action-context: $(ac $VOLTAGEM_ACTOR read_bank_state)" | head -c 400; echo ""; echo ""

echo "=== F4b: Lucia tenta ler balance de Clinica (SEM delegacao, esperado 403) ==="
curl -s -w "\nHTTP=%{http_code}\n" "http://localhost:3000/bank/balance?actorId=$CLINICA_ACTOR" \
  -H "Authorization: Bearer $LUCIA_JWT" -H "x-tenant-id: $TENANT" \
  -H "x-action-context: $(ac $CLINICA_ACTOR read_bank_state)" | head -c 400; echo ""; echo ""

echo "=== F5: Lucia tenta transferir DE Voltagem (esperado 403 - so view delegado) ==="
F5_BODY="{\"toUserId\":\"$JOAO_USER\",\"amountCents\":100,\"eventId\":\"$(node -e 'console.log(require("crypto").randomUUID())')\"}"
# /bank/p2p-transfer usa req.user.id como fromUser — Lucia tentaria mover DA conta Lucia, nao Voltagem.
# Para testar Lucia movendo DA Voltagem, precisamos /bank/transactions/simple
F5_BODY="{\"eventId\":\"smoke-f5-lucia-attempt-voltagem\",\"referenceType\":\"smoke_fase2\",\"fromAccountId\":\"$VOLTAGEM_ACCT\",\"toAccountId\":\"$LUCIA_ACCT\",\"amountCents\":100,\"currency\":\"BRL\",\"transactionType\":\"transfer\",\"description\":\"F5 attempt\",\"concept_id\":\"p2p-transfer\"}"
curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:3000/bank/transactions/simple \
  -H "Authorization: Bearer $LUCIA_JWT" -H "x-tenant-id: $TENANT" \
  -H "x-action-context: $(ac $VOLTAGEM_ACTOR p2p_transfer)" \
  -H "Content-Type: application/json" -d "$F5_BODY" | head -c 400; echo ""; echo ""

echo "=== F6: Maria -> Voltagem PJ (esperado: mesmo achado de F2) ==="
F6_BODY="{\"eventId\":\"smoke-f6-maria-voltagem-200\",\"referenceType\":\"smoke_fase2\",\"fromAccountId\":\"$MARIA_ACCT\",\"toAccountId\":\"$VOLTAGEM_ACCT\",\"amountCents\":20000,\"currency\":\"BRL\",\"transactionType\":\"transfer\",\"description\":\"F6\",\"concept_id\":\"p2p-transfer\"}"
curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:3000/bank/transactions/simple \
  -H "Authorization: Bearer $MARIA_JWT" -H "x-tenant-id: $TENANT" \
  -H "x-action-context: $(ac $MARIA_ACTOR p2p_transfer)" \
  -H "Content-Type: application/json" -d "$F6_BODY" | head -c 700; echo ""; echo ""

echo "=== F7: Voltagem -> Clinica (PJ/PJ MESMO DONO) - esperado 403 'fromAccountId must belong to user' ==="
F7_BODY="{\"eventId\":\"smoke-f7-voltagem-clinica-300\",\"referenceType\":\"smoke_fase2\",\"fromAccountId\":\"$VOLTAGEM_ACCT\",\"toAccountId\":\"$CLINICA_ACCT\",\"amountCents\":30000,\"currency\":\"BRL\",\"transactionType\":\"transfer\",\"description\":\"F7\",\"concept_id\":\"p2p-transfer\"}"
curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:3000/bank/transactions/simple \
  -H "Authorization: Bearer $JOAO_JWT" -H "x-tenant-id: $TENANT" \
  -H "x-action-context: $(ac $VOLTAGEM_ACTOR p2p_transfer)" \
  -H "Content-Type: application/json" -d "$F7_BODY" | head -c 700; echo ""; echo ""

echo "=== Saldos finais ==="
echo "  Joao PF:  $(balance "$JOAO_JWT" "$JOAO_ACTOR") (esperado 340000 = 330000 + 10000 de F1)"
echo "  Maria PF: $(balance "$MARIA_JWT" "$MARIA_ACTOR") (esperado 490000 = 500000 - 10000 de F1)"
echo "  Lucia PF: $(balance "$LUCIA_JWT" "$LUCIA_ACTOR") (esperado 200000)"
echo "  Voltagem: $(balance "$JOAO_JWT" "$VOLTAGEM_ACTOR") (esperado 1150000, intacto)"
echo "  Clinica:  $(balance "$JOAO_JWT" "$CLINICA_ACTOR") (esperado 700000, intacto)"
