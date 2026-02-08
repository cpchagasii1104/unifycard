PROMPT 29 — Governança de Serviços Sensíveis (Regras Reforçadas)

OBJETIVO
Criar um regime especial de governança para serviços que envolvem
risco físico, saúde, segurança, acesso residencial ou dados sensíveis.

Sem julgamento humano.
Sem exceção manual.
Sem "jeitinho".

PRINCÍPIO CENTRAL
Quanto maior o risco do serviço, maior a exigência objetiva de execução correta.

SERVIÇOS CONSIDERADOS SENSÍVEIS (exemplos)
- Saúde (clínica, odontologia, enfermagem, exames)
- Segurança (vigilância, portaria, monitoramento)
- Acesso residencial (manutenção interna, elétrica, hidráulica)
- Serviços com dados sensíveis (TI local, redes, câmeras)
- Transporte humano ou escolar

CLASSIFICAÇÃO
ServiceSensitivityLevel:
- normal
- sensitive
- critical

A classificação é feita:
- Pelo ServiceTemplate
- Nunca pelo prestador individual
- Nunca alterável manualmente

CONTRATO CANÔNICO
SensitiveServiceGovernance.contract.ts

Campos principais:
- service_template_id
- sensitivity_level
- required_trust_level
- required_documents
- required_history_thresholds
- extra_sla_rules
- penalty_rules

EXIGÊNCIAS OBJETIVAS (por nível)

1) TRUST
- sensitive → Trust >= L2
- critical → Trust >= L3

2) DOCUMENTAÇÃO
- Documentos obrigatórios por categoria
  (ex: conselho profissional, alvará, curso, certificação)
- Documentos versionados e com validade
- Sem documento válido → não recebe dispatch

3) HISTÓRICO MÍNIMO
- Nº mínimo de serviços concluídos
- SLA mínimo histórico
- Taxa mínima de aceite
- Sem histórico → só pode atuar com supervisão (empresa)

4) SLA REFORÇADO
- Janela de resposta menor
- Tolerância zero a atraso crítico
- Violação pesa mais no Trust e prioridade

5) PAGAMENTO
- Escrow obrigatório
- Confirmação dupla padrão
- Disputa com prioridade de resolução

REGRAS DE MATCHING
- Serviços sensíveis ignoram prestadores fora do threshold
- Prioridade baseada em:
  - histórico específico daquele tipo de serviço
  - não apenas score geral

PENALIDADES
- Violação em serviço sensível pesa mais que serviço normal
- Reincidência gera:
  - bloqueio temporário do tipo de serviço
  - downgrade progressivo de Trust
- Nunca banimento automático global

VISIBILIDADE
- Prestador vê exatamente quais requisitos faltam
- Empresa vê status de habilitação
- Usuário final NÃO vê detalhes internos
- Sistema nunca expõe falhas individualmente

O QUE NÃO É
- Não é avaliação subjetiva
- Não é ranking especial
- Não é aprovação manual
- Não é "selo" de marketing

RESULTADO PRÁTICO
- Serviços de risco operam com padrão institucional
- Usuário confia sem precisar "escolher"
- Bons prestadores ganham acesso real
- Maus padrões se auto-excluem pelo próprio histórico

Segurança nasce de regra, não de opinião.

