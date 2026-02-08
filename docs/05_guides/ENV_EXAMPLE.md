# EXEMPLO DE VARIÁVEIS DE AMBIENTE

## IMPORTANTE
- NUNCA commitar arquivo `.env` com valores reais
- Copiar este arquivo para `.env` e preencher valores reais
- Adicionar `.env` ao `.gitignore`

## FISCAL PROVIDER (SPRINT 53)

```bash
# Provider fiscal a ser usado: 'mock' ou 'sefaz'
FISCAL_PROVIDER=mock

# SEFAZ - Habilitar emissão real (false por padrão)
SEFAZ_ENABLED=false

# SEFAZ - Ambiente: 'homolog' ou 'prod'
SEFAZ_ENV=homolog

# SEFAZ - UF (ex: SP, RJ, MG)
SEFAZ_UF=SP

# SEFAZ - Timeout em milissegundos
SEFAZ_TIMEOUT_MS=30000

# SEFAZ - Endpoint (URL do webservice SEFAZ)
# Exemplo homologação: https://homologacao.nfe.sefaz.xx.gov.br/ws/NFeAutorizacao4
# Exemplo produção: https://nfe.sefaz.xx.gov.br/ws/NFeAutorizacao4
SEFAZ_ENDPOINT=

# SEFAZ - Caminho do certificado digital (arquivo .pfx ou .p12)
# IMPORTANTE: Não commitar certificado no repositório
# Exemplo: /path/to/certificado.pfx
SEFAZ_CERT_PATH=

# SEFAZ - Senha do certificado digital
# IMPORTANTE: Usar variável de ambiente, nunca hardcoded
SEFAZ_CERT_PASS=
```

## OUTRAS VARIÁVEIS (exemplos)

```bash
# DATABASE_URL=postgresql://user:pass@localhost:5432/unificard
# JWT_SECRET=your-secret-key-here
# PORT=3000
```







