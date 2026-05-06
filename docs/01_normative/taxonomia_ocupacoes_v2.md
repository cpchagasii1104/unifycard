# Taxonomia Canônica de Ocupações — UnifiCard
> **Versão 2.2** | 22 Categorias | ~1.242 Ocupações  
> Formato: `domain: servicos` | `parent_n1: [categoria]`  
> Revisada em 2026-03-28 (v2.0) · **v2.1** Beleza & Estética + N1 `beleza-estetica` (migration 0099) · **v2.2** assistência domiciliar, jardinagem, limpeza + `seguranca-eventos` (migration 0100)  
>
> **SSOT semântico:** `public.concepts` + pipeline `create_category_from_concept`. Este ficheiro é **input editorial**; dataset operacional: `backend/data/profissoes.validated.yaml` (gerado por `validate:profissoes-taxonomy`).

---

## 📋 Registro de Alterações (v1 → v2)

### 🔴 Typos corrigidos
| Slug original | Slug corrigido | Categoria |
|---|---|---|
| `pedagogco` | `pedagogo` | educacao |
| `lanteneiro` | `lanterneiro` | automotivo-mecanica |
| `mecanico-helicepteros` | `mecanico-helicopteros` | automotivo-mecanica |
| `cientista-materials` | `cientista-materiais` | ciencias-pesquisa |

### 🔴 Slug inválido removido
| Slug | Motivo |
|---|---|
| `engenheiro-materiais-2` | Sufixo `-2` inválido — duplicata de `engenheiro-materiais` dentro de industria-manufatura |

### 🟠 Duplicatas cross-categoria resolvidas (SSOT)
| Slug | Mantido em | Removido de | Critério |
|---|---|---|---|
| `fotografo-eventos` | `criativo-design` | `turismo-hospitalidade` | Profissional, não contexto de evento |
| `garcom-eventos` | `gastronomia` | `turismo-hospitalidade` | Ocupação, não contexto |
| `bartender-eventos` | `gastronomia` | `turismo-hospitalidade` | Idem |
| `eletricista-industrial` | `industria-manufatura` | `construcao-imoveis` | Contexto industrial é dominante |
| `mecanico-industrial` | `industria-manufatura` | `automotivo-mecanica` | Contexto industrial é dominante |
| `engenheiro-producao` | `industria-manufatura` | `operacoes-logistica` | Formação de engenharia, não ops |
| `psicologo-organizacional` | `rh-gestao-pessoas` | `saude` | Contexto dominante é RH/org |
| `compliance-officer` | `juridico` | `financas-contabilidade` | Mantido `compliance-financeiro` em financas |
| `nutricionista-gastronomia` | `gastronomia` | `saude` | Mantido `nutricionista-clinica` em saude |
| `especialista-seo-tecnico` | `tecnologia` | `marketing-comunicacao` | Perfil técnico/dev, não marketing |

### 🟡 Slugs semânticos ajustados
| Slug original | Slug corrigido | Motivo |
|---|---|---|
| `agronomo` | *(removido)* | Idêntico a `engenheiro-agronomo` (mesmo registro CFA/CREA) |
| `pulverizador-agricola` | `operador-pulverizador-agricola` | Pulverizador é equipamento, não ocupação |
| `manejo-florestal` | *(removido)* | Atividade, não ocupação — sem CBO direto |
| `extrativista` | `extrativista-florestal` | Muito genérico sem qualificador |
| `rocador` | `rocador-agricola` | Padronizar com qualificador de contexto |

### 🟢 Adições por lacuna identificada
| Slug novo | Categoria | Justificativa |
|---|---|---|
| `agente-autonomo-investimento` | financas-contabilidade | Regulamentado pela CVM (Instrução 497) |
| `tabeliao` | juridico | Cartório — central no sistema jurídico BR |
| `registrador-imoveis` | juridico | Cartório de registro de imóveis |
| `escrivao` | juridico | Cartório e delegacias |
| `tecnico-optica` | saude | Regulamentado pelo CFO |
| `acupunturista` | saude | Reconhecido pelo CFM (Resolução 1.455/95) |
| `musicoterapeuta` | saude | Regulamentado (Lei 13.012/2014) |
| `closer` | vendas-atendimento | Papel consolidado em inside sales BR |
| `sdr` | vendas-atendimento | Sales Development Rep — padrão de mercado |
| `especialista-cipa` | rh-gestao-pessoas | CIPA obrigatória por NR-5 |
| `produtor-musical` | criativo-design | Área criativa relevante, mercado BR expressivo |
| `especialista-privacidade-ti` | tecnologia | Versão técnica do DPO, diferente do jurídico |

### 💇 v2.1 — Beleza & Estética (lacuna salão / imagem pessoal)
| Item | Detalhe |
|---|---|
| Novo `parent_n1` | `beleza-estetica` (N1 sob N0 operacional `profissoes`; migration **0099**) |
| Distinção | `esteticista-automotivo` permanece em **automotivo-mecanica**; `consultor-beleza` permanece em **vendas-atendimento** (comercial) |
| Novos slugs | Ver secção **Beleza & Estética** abaixo (28 ocupações) |

### 🏠 v2.2 — Assistência domiciliar, jardinagem urbana, limpeza profissional + segurança de eventos
| Item | Detalhe |
|---|---|
| Novos `parent_n1` | `assistencia-domiciliar`, `jardinagem-manutencao`, `limpeza-servicos` (migration **0100**) |
| `assistencia-domiciliar` | **Não clínico** — não confundir com enfermagem, auxiliar de enfermagem ou registros CFM/COFEN; foco em cuidado/apoio no lar e acompanhamento não técnico |
| `jardinagem-manutencao` | Áreas verdes **urbanas** / condomínios — **não** agronegócio nem obra civil |
| `limpeza-servicos` | Facilities e serviços de limpeza — **não** gastronomia (`auxiliar-limpeza-cozinha` permanece em gastronomia) |
| `seguranca-defesa` | **+1** slug canônico `seguranca-eventos` (bares, shows, eventos) — sem slugs redundantes tipo `vigilante-eventos` |

---

## 🎨 Criativo & Design
`parent_n1: criativo-design` — **52 ocupações**

```
├── designer-grafico
├── designer-ux
├── designer-ui
├── designer-produto
├── designer-industrial
├── designer-moda
├── designer-interiores
├── designer-joias
├── designer-embalagens
├── designer-motion
├── ilustrador
├── ilustrador-cientifico
├── ilustrador-infantil
├── ilustrador-moda
├── ilustrador-tecnico
├── fotografo
├── fotografo-retrato
├── fotografo-eventos            ← SSOT: mantido aqui, removido de turismo
├── fotografo-produto
├── fotografo-arquitetura
├── fotografo-esportivo
├── fotografo-aereo
├── fotografo-natureza
├── fotografo-jornalismo
├── diretor-arte
├── diretor-criativo
├── diretor-fotografia
├── video-maker
├── editor-video
├── editor-audio
├── colorista
├── finalizador-video
├── animador-2d
├── animador-3d
├── animador-motion
├── storyboard-artist
├── concept-artist
├── tipografo
├── caligrafo
├── artista-grafite
├── tatuador
├── body-piercer
├── escultor
├── ceramista
├── vidraceiro-artistico
├── artesao
├── artesao-tecido
├── artesao-couro
├── artesao-madeira
├── artesao-joias
├── artesao-ceramica
└── produtor-musical             ← NOVO
```

---

## 🏗️ Construção & Imóveis
`parent_n1: construcao-imoveis` — **87 ocupações**

```
├── arquiteto
├── arquiteto-paisagista
├── arquiteto-urbanista
├── arquiteto-sustentavel
├── arquiteto-restauro
├── engenheiro-civil
├── engenheiro-estrutural
├── engenheiro-geotecnico
├── engenheiro-hidraulico
├── engenheiro-saneamento
├── engenheiro-eletrico
├── mestre-obras
├── mestre-pedreiro
├── mestre-armacao
├── mestre-acabamento
├── pedreiro
├── pedreiro-assentador
├── pedreiro-rebocador
├── pedreiro-concreto
├── servente-pedreiro
├── eletricista
├── eletricista-predial
├── eletricista-automacao           ← eletricista-industrial movido p/ industria
├── eletricista-alta-tensao
├── eletricista-solar
├── encanador
├── encanador-hidraulico
├── encanador-gas
├── encanador-industrial
├── bombeiro-hidraulico
├── pintor
├── pintor-predial
├── pintor-industrial
├── pintor-decorativo
├── pintor-textura
├── pintor-grafiato
├── gesseiro
├── gesseiro-decorativo
├── gesseiro-sanca
├── marceneiro
├── marceneiro-moveis
├── marceneiro-cozinha
├── marceneiro-planejados
├── carpinteiro
├── carpinteiro-obra
├── carpinteiro-formas
├── serralheiro
├── serralheiro-aluminio
├── serralheiro-ferro
├── serralheiro-inox
├── soldador
├── soldador-mig
├── soldador-tig
├── soldador-oxiacetileno
├── soldador-arco-eletrico
├── vidraceiro
├── vidraceiro-automotivo
├── vidraceiro-box
├── vidraceiro-temperado
├── ceramista-revestimento
├── azulejista
├── piso-laminado
├── piso-vinilico
├── piso-madeira
├── instalador-forro
├── instalador-drywall
├── instalador-ar-condicionado
├── instalador-ar-split
├── instalador-ar-central
├── tecnico-refrigeracao
├── impermeabilizador
├── isolador-termico
├── isolador-acustico
├── topografo
├── agrimensor
├── georreferenciamento
├── corretor-imoveis
├── corretor-comercial
├── corretor-residencial
├── corretor-luxo
├── avaliador-imoveis
├── avaliador-pericial
├── gestor-obras
├── gestor-projetos-construcao
├── coordenador-obra
├── fiscal-obra
└── seguranca-trabalho-construcao
```

---

## 💰 Finanças & Contabilidade
`parent_n1: financas-contabilidade` — **79 ocupações**

```
├── contador
├── contador-empresarial
├── contador-tributario
├── contador-societario
├── contador-fiscal
├── contador-custos
├── contador-erp
├── contador-internacional
├── auditor
├── auditor-interno
├── auditor-externo
├── auditor-fiscal
├── auditor-tributario
├── auditor-operacional
├── perito-contabil
├── perito-judicial-contabil
├── analista-financeiro
├── analista-financeiro-pleno
├── analista-financeiro-senior
├── analista-financeiro-tesouraria
├── analista-financeiro-orcamento
├── analista-financeiro-projetos
├── analista-financeiro-fusoes
├── analista-credito
├── analista-credito-pessoa-fisica
├── analista-credito-pessoa-juridica
├── analista-credito-rural
├── analista-risco
├── analista-risco-credito
├── analista-risco-mercado
├── analista-risco-operacional
├── analista-risco-compliance
├── analista-custos
├── analista-controladoria
├── analista-orcamento
├── analista-tesouraria
├── analista-fp-a
├── planejador-financeiro
├── planejador-financeiro-pessoal
├── planejador-financeiro-empresarial
├── planejador-financeiro-previdencia
├── planejador-financeiro-tributario
├── gestor-investimentos
├── gestor-investimentos-renda-fixa
├── gestor-investimentos-renda-variavel
├── gestor-investimentos-multimercado
├── gestor-investimentos-fundos
├── gestor-investimentos-previdencia
├── assessor-investimentos
├── assessor-investimentos-pf
├── assessor-investimentos-pj
├── assessor-investimentos-private
├── agente-autonomo-investimento    ← NOVO (CVM 497)
├── trader
├── trader-day-trade
├── trader-swing-trade
├── trader-forex
├── trader-opcoes
├── economista
├── economista-mercado
├── economista-setor-publico
├── economista-internacional
├── economista-ambiental
├── atuario
├── atuario-seguros
├── atuario-previdencia
├── atuario-saude
├── controller
├── controller-geral
├── controller-operacional
├── controller-tributario
├── controller-internacional
├── tesoureiro
├── tesoureiro-empresarial
├── tesoureiro-bancario
├── compliance-financeiro           ← compliance-officer movido p/ juridico (SSOT)
├── compliance-tributario
└── compliance-lgpd
```

---

## 📢 Marketing & Comunicação
`parent_n1: marketing-comunicacao` — **80 ocupações**

```
├── gerente-marketing
├── gerente-marketing-digital
├── gerente-marketing-produto
├── gerente-marketing-marca
├── gerente-marketing-conteudo
├── gerente-marketing-performance
├── gerente-marketing-b2b
├── gerente-marketing-b2c
├── diretor-marketing
├── vp-marketing
├── cmo
├── especialista-seo
├── especialista-seo-conteudo
├── especialista-seo-local
├── especialista-seo-ecommerce      ← especialista-seo-tecnico movido p/ tecnologia
├── especialista-sem
├── especialista-google-ads
├── especialista-facebook-ads
├── especialista-linkedin-ads
├── especialista-tiktok-ads
├── especialista-midia-paga
├── especialista-midia-programatica
├── especialista-midia-offline
├── especialista-midia-tv
├── especialista-midia-radio
├── especialista-midia-outdoor
├── growth-hacker
├── growth-manager
├── growth-analyst
├── analista-crm
├── especialista-crm-salesforce
├── especialista-crm-hubspot
├── especialista-email-marketing
├── especialista-automacao-marketing
├── especialista-marketing-afiliados
├── especialista-influencer-marketing
├── especialista-branding
├── especialista-identidade-visual
├── especialista-posicionamento-marca
├── especialista-rebranding
├── gerente-produto-digital
├── gerente-produto-saas
├── gerente-produto-mobile
├── gerente-produto-fintech
├── analista-dados-marketing
├── analista-bi-marketing
├── cientista-dados-marketing
├── redator
├── redator-seo
├── redator-copy
├── redator-conteudo
├── redator-tecnico
├── redator-publicitario
├── copywriter
├── copywriter-vendas
├── copywriter-lancamentos
├── copywriter-email
├── copywriter-anuncios
├── copywriter-paginas-venda
├── social-media-manager
├── social-media-analyst
├── social-media-planner
├── community-manager
├── produtor-conteudo
├── produtor-conteudo-video
├── produtor-conteudo-podcast
├── produtor-conteudo-blog
├── jornalista
├── jornalista-reporter
├── jornalista-editor
├── jornalista-colunista
├── jornalista-tv
├── relacoes-publicas
├── assessoria-imprensa
├── comunicacao-corporativa
├── comunicacao-interna
├── influenciador-digital
├── criador-conteudo
├── streamer
└── youtuber
```

---

## 💻 Tecnologia & TI
`parent_n1: tecnologia` — **138 ocupações**

```
├── desenvolvedor-backend
├── desenvolvedor-backend-java
├── desenvolvedor-backend-python
├── desenvolvedor-backend-nodejs
├── desenvolvedor-backend-go
├── desenvolvedor-backend-rust
├── desenvolvedor-backend-csharp
├── desenvolvedor-backend-php
├── desenvolvedor-backend-ruby
├── desenvolvedor-backend-scala
├── desenvolvedor-frontend
├── desenvolvedor-frontend-react
├── desenvolvedor-frontend-vue
├── desenvolvedor-frontend-angular
├── desenvolvedor-frontend-svelte
├── desenvolvedor-frontend-nextjs
├── desenvolvedor-fullstack
├── desenvolvedor-fullstack-javascript
├── desenvolvedor-fullstack-python
├── desenvolvedor-mobile
├── desenvolvedor-mobile-ios
├── desenvolvedor-mobile-android
├── desenvolvedor-mobile-flutter
├── desenvolvedor-mobile-react-native
├── desenvolvedor-mobile-kotlin
├── desenvolvedor-mobile-swift
├── desenvolvedor-jogos
├── desenvolvedor-jogos-unity
├── desenvolvedor-jogos-unreal
├── desenvolvedor-embedded
├── desenvolvedor-iot
├── desenvolvedor-blockchain
├── desenvolvedor-web3
├── desenvolvedor-smart-contracts
├── engenheiro-dados
├── engenheiro-dados-pipeline
├── engenheiro-dados-plataforma
├── engenheiro-dados-real-time
├── engenheiro-dados-cloud
├── engenheiro-machine-learning
├── engenheiro-ia
├── engenheiro-ia-generativa
├── engenheiro-nlp
├── engenheiro-visao-computacional
├── cientista-dados
├── cientista-dados-estatistico
├── cientista-dados-negocios
├── cientista-dados-pesquisa
├── analista-dados
├── analista-dados-bi
├── analista-dados-negocios
├── analista-dados-produto
├── analista-bi
├── analista-bi-powerbi
├── analista-bi-tableau
├── analista-bi-qlik
├── arquiteto-software
├── arquiteto-solucoes
├── arquiteto-cloud
├── arquiteto-dados
├── arquiteto-seguranca
├── arquiteto-empresarial
├── arquiteto-infraestrutura
├── devops-engineer
├── devops-aws
├── devops-azure
├── devops-gcp
├── devops-kubernetes
├── devops-terraform
├── devops-ci-cd
├── sre-engineer
├── platform-engineer
├── analista-seguranca
├── analista-seguranca-ofensiva
├── analista-seguranca-defensiva
├── analista-seguranca-grc
├── pentester
├── ethical-hacker
├── especialista-forense-digital
├── engenheiro-seguranca
├── engenheiro-seguranca-aplicacao
├── engenheiro-seguranca-cloud
├── engenheiro-seguranca-rede
├── dba
├── dba-oracle
├── dba-sql-server
├── dba-postgresql
├── dba-mysql
├── dba-mongodb
├── dba-nosql
├── administrador-sistemas
├── administrador-linux
├── administrador-windows
├── administrador-redes
├── administrador-redes-cisco
├── administrador-cloud
├── administrador-aws
├── administrador-azure
├── suporte-tecnico
├── suporte-tecnico-n1
├── suporte-tecnico-n2
├── suporte-tecnico-n3
├── analista-sistemas
├── analista-sistemas-erp
├── analista-sistemas-crm
├── analista-requisitos
├── analista-negocios-ti
├── scrum-master
├── product-owner
├── agile-coach
├── gerente-projetos-ti
├── gerente-produto-ti
├── gerente-engenharia
├── cto
├── vp-engenharia
├── diretor-ti
├── ux-designer
├── ui-designer
├── ux-researcher
├── ux-writer
├── product-designer
├── interaction-designer
├── service-designer
├── qa-engineer
├── qa-engineer-manual
├── qa-engineer-automacao
├── qa-engineer-performance
├── qa-engineer-seguranca
├── test-lead
├── test-manager
├── especialista-acessibilidade
├── especialista-performance-web
├── especialista-seo-tecnico        ← movido de marketing (SSOT: perfil dev)
├── especialista-privacidade-ti     ← NOVO (versão tech do DPO)
├── tecnico-informatica
├── tecnico-hardware
└── tecnico-cabeamento
```

---

## ⚕️ Saúde & Medicina
`parent_n1: saude` — **113 ocupações**

```
├── medico-clinico-geral
├── medico-cardiologista
├── medico-cirurgiao-cardiovascular
├── medico-dermatologista
├── medico-endocrinologista
├── medico-gastroenterologista
├── medico-geriatra
├── medico-ginecologista
├── medico-obstetra
├── medico-hematologista
├── medico-infectologista
├── medico-nefrologista
├── medico-neurologista
├── medico-neurocirurgiao
├── medico-oftalmologista
├── medico-oncologista
├── medico-ortopedista
├── medico-otorrinolaringologista
├── medico-pediatra
├── medico-neonatologista
├── medico-pneumologista
├── medico-psiquiatra
├── medico-radiologista
├── medico-reumatologista
├── medico-urologista
├── medico-cirurgiao-geral
├── medico-cirurgiao-plastico
├── medico-cirurgiao-toracico
├── medico-cirurgiao-vascular
├── medico-anestesiologista
├── medico-patologista
├── medico-medicina-nuclear
├── medico-medicina-esportiva
├── medico-medicina-trabalho
├── medico-medicina-familia
├── medico-urgencia-emergencia
├── medico-intensivista
├── medico-geneticista
├── medico-alergista-imunologista
├── dentista
├── dentista-ortodontista
├── dentista-endodontista
├── dentista-periodontista
├── dentista-protesista
├── dentista-implantodontista
├── dentista-cirurgiao
├── dentista-odontopediatra
├── enfermeiro
├── enfermeiro-urgencia-emergencia
├── enfermeiro-uti
├── enfermeiro-centro-cirurgico
├── enfermeiro-oncologia
├── enfermeiro-pediatria
├── enfermeiro-saude-coletiva
├── enfermeiro-administracao
├── tecnico-enfermagem
├── auxiliar-enfermagem
├── fisioterapeuta
├── fisioterapeuta-ortopedica
├── fisioterapeuta-neurologica
├── fisioterapeuta-respiratoria
├── fisioterapeuta-desportiva
├── fisioterapeuta-geriatrica
├── fisioterapeuta-pediatrica
├── fisioterapeuta-urologica
├── fisioterapeuta-oncologica
├── terapeuta-ocupacional
├── terapeuta-ocupacional-pediatria
├── terapeuta-ocupacional-saude-mental
├── terapeuta-ocupacional-ergonomia
├── psicologo
├── psicologo-clinico
├── psicologo-hospitalar
├── psicologo-educacional           ← psicologo-organizacional movido p/ rh (SSOT)
├── psicologo-forense
├── psicologo-neuropsicologia
├── psicologo-psicoterapia
├── psicologo-analise-comportamento
├── nutricionista
├── nutricionista-clinica
├── nutricionista-esportiva
├── nutricionista-empresarial
├── nutricionista-pediatria
├── fonoaudiologo                   ← nutricionista-gastronomia movido p/ gastronomia (SSOT)
├── fonoaudiologo-pediatria
├── fonoaudiologo-geriatria
├── fonoaudiologo-neurologia
├── fonoaudiologo-audiologia
├── farmaceutico
├── farmaceutico-clinico
├── farmaceutico-hospitalar
├── farmaceutico-industrial
├── farmaceutico-analises
├── farmaceutico-toxico
├── biomedico
├── biomedico-analises
├── biomedico-imagem
├── biomedico-hemoterapia
├── veterinario
├── veterinario-clinico
├── veterinario-cirurgiao
├── veterinario-patologia
├── veterinario-saude-publica
├── veterinario-producao-animal
├── agente-saude
├── tecnico-saude-bucal
├── tecnico-radiologia
├── tecnico-patologia
├── tecnico-hemoterapia
├── tecnico-optica                  ← NOVO (regulamentado CFO)
├── acupunturista                   ← NOVO (Resolução CFM 1.455/95)
└── musicoterapeuta                 ← NOVO (Lei 13.012/2014)
```

---

## ⚖️ Jurídico & Compliance
`parent_n1: juridico` — **72 ocupações**

```
├── advogado
├── advogado-civil
├── advogado-consumidor
├── advogado-contratos
├── advogado-empresarial
├── advogado-societario
├── advogado-fusoes-aquisicoes
├── advogado-startups
├── advogado-tributarista
├── advogado-trabalhista
├── advogado-previdenciario
├── advogado-penalista
├── advogado-criminalista
├── advogado-constitucional
├── advogado-administrativo
├── advogado-ambiental
├── advogado-internacional
├── advogado-arbitragem
├── advogado-propriedade-intelectual
├── advogado-tecnologia
├── advogado-lgpd
├── advogado-saude
├── advogado-imobiliario
├── advogado-familia
├── advogado-sucessoes
├── advogado-bancario
├── advogado-seguros
├── advogado-licitacoes
├── advogado-regulatorio
├── juiz
├── juiz-estadual
├── juiz-federal
├── juiz-trabalho
├── juiz-militar
├── juiz-eleitoral
├── promotor
├── promotor-justica-estadual
├── promotor-justica-federal
├── promotor-justica-trabalho
├── promotor-justica-militar
├── defensor-publico
├── defensor-publico-estadual
├── defensor-publico-federal
├── analista-juridico
├── analista-juridico-contratos
├── analista-juridico-tributario
├── analista-juridico-trabalhista
├── paralegal
├── assistente-juridico
├── mediador
├── conciliador
├── arbitro
├── perito-judicial
├── perito-contabil-judicial
├── perito-medico-judicial
├── perito-engenharia-judicial
├── compliance-officer              ← SSOT: centralizado aqui
├── compliance-specialist
├── compliance-analyst
├── compliance-gestor
├── dpd-privacidade
├── dpo-data-protection-officer
├── especialista-lgpd
├── especialista-privacidade-dados
├── consultor-regulatorio
├── consultor-tributario
├── consultor-trabalhista
├── escriturario-judiciario
├── oficial-justica
├── oficial-justica-avaliante
├── tabeliao                        ← NOVO
├── registrador-imoveis             ← NOVO
└── escrivao                        ← NOVO
```

---

## 🎓 Educação
`parent_n1: educacao` — **72 ocupações**

```
├── professor-ensino-fundamental
├── professor-ensino-fundamental-anos-iniciais
├── professor-ensino-fundamental-anos-finais
├── professor-ensino-medio
├── professor-ensino-medio-matematica
├── professor-ensino-medio-portugues
├── professor-ensino-medio-ciencias
├── professor-ensino-medio-historia
├── professor-ensino-medio-geografia
├── professor-ensino-medio-fisica
├── professor-ensino-medio-quimica
├── professor-ensino-medio-biologia
├── professor-ensino-medio-filosofia
├── professor-ensino-medio-sociologia
├── professor-ensino-medio-artes
├── professor-ensino-medio-ingles
├── professor-ensino-medio-espanhol
├── professor-universitario
├── professor-universitario-graduacao
├── professor-universitario-pos-graduacao
├── professor-universitario-pesquisa
├── professor-universitario-extensao
├── instrutor-tecnico
├── instrutor-tecnico-senai
├── instrutor-tecnico-senac
├── instrutor-tecnico-informatica
├── instrutor-tecnico-mecanica
├── instrutor-tecnico-eletrica
├── instrutor-tecnico-administracao
├── instrutor-tecnico-seguranca-trabalho
├── instrutor-treinamento
├── instrutor-treinamento-corporativo
├── instrutor-treinamento-vendas
├── instrutor-treinamento-lideranca
├── instrutor-treinamento-tecnico
├── pedagogo                        ← corrigido (era pedagogco)
├── coordenador-pedagogico
├── coordenador-pedagogico-ensino-fundamental
├── coordenador-pedagogico-ensino-medio
├── orientador-educacional
├── orientador-vocacional
├── psicopedagogo
├── psicopedagogo-clinico
├── psicopedagogo-escolar
├── educador-especial
├── educador-especial-autismo
├── educador-especial-deficiencia-intelectual
├── educador-especial-deficiencia-fisica
├── educador-especial-surdos
├── educador-especial-cegos
├── professor-eja
├── professor-educacao-jovens-adultos
├── professor-educacao-profissional
├── professor-libras
├── professor-educacao-fisica
├── professor-musica
├── professor-artes
├── professor-teatro
├── professor-danca
├── tutor-online
├── tutor-presencial
├── mentor
├── mentor-empresarial
├── mentor-carreira
├── mentor-academico
├── curador-conteudo-educacional
├── designer-instrucional
├── especialista-elearning
├── gestor-educacional
├── diretor-escolar
├── vice-diretor-escolar
└── secretario-escolar
```

---

## ⚙️ Operações & Logística
`parent_n1: operacoes-logistica` — **75 ocupações**

```
├── gerente-operacoes
├── gerente-operacoes-industria
├── gerente-operacoes-servicos
├── gerente-operacoes-logistica
├── gerente-operacoes-supply-chain
├── diretor-operacoes
├── coo-chief-operating-officer
├── analista-logistica
├── analista-logistica-transporte
├── analista-logistica-armazenagem
├── analista-logistica-distribuicao
├── analista-logistica-internacional
├── analista-logistica-reversa
├── analista-logistica-sustentavel
├── analista-suprimentos
├── analista-compras
├── analista-compras-diretas
├── analista-compras-indiretas
├── analista-compras-internacionais
├── comprador
├── comprador-negociador
├── comprador-tecnico
├── comprador-servicos
├── gestor-suprimentos
├── gestor-suprimentos-estrategico
├── gestor-suprimentos-operacional
├── coordenador-estoque
├── coordenador-armazem
├── coordenador-distribuicao
├── planejador-demanda
├── planejador-demanda-senior
├── planejador-demanda-junior
├── planejador-producao
├── planejador-materiais
├── planejador-mrp
├── analista-pcp
├── analista-pcp-producao
├── analista-pcp-capacidade
├── gerente-armazem
├── gerente-distribuicao
├── gerente-supply-chain
├── supervisor-armazem
├── supervisor-expedicao
├── supervisor-recebimento
├── motorista-entrega
├── motorista-caminhao
├── motorista-carreta
├── motorista-van
├── motorista-moto
├── motorista-aplicativo
├── operador-logistica
├── operador-movimentacao
├── operador-empilhadeira
├── operador-transpaleteira
├── operador-picking
├── operador-packing
├── despachante-aduaneiro
├── despachante-importacao
├── despachante-exportacao
├── analista-qualidade
├── analista-qualidade-produto
├── analista-qualidade-processo
├── analista-qualidade-fornecedor
├── tecnico-seguranca-trabalho
├── tecnico-seguranca-trabalho-junior
├── tecnico-seguranca-trabalho-senior
├── engenheiro-seguranca-trabalho
├── especialista-lean
├── especialista-lean-manufacturing
├── especialista-lean-six-sigma
├── especialista-kaizen
├── engenheiro-producao-industrial     ← engenheiro-producao movido p/ industria (SSOT)
├── engenheiro-producao-metalurgica
├── engenheiro-producao-textil
└── engenheiro-producao-alimentos
```

---

## 🍽️ Gastronomia
`parent_n1: gastronomia` — **68 ocupações**

```
├── chef-cozinha
├── chef-cozinha-executivo
├── chef-cozinha-cozinheiro-chefe
├── chef-cozinha-pastry
├── chef-cozinha-confeitaria
├── chef-cozinha-panificacao
├── chef-cozinha-carnes
├── chef-cozinha-peixes
├── chef-cozinha-massas
├── chef-cozinha-japonesa
├── chef-cozinha-italiana
├── chef-cozinha-francesa
├── chef-cozinha-brasileira
├── chef-cozinha-vegetariana
├── chef-cozinha-vegana
├── chef-cozinha-molecular
├── sous-chef
├── auxiliar-cozinha
├── cozinheiro
├── cozinheiro-linha-quente
├── cozinheiro-linha-fria
├── cozinheiro-grill
├── cozinheiro-fritadeira
├── confeiteiro
├── confeiteiro-bolos
├── confeiteiro-doces
├── confeiteiro-chocolataria
├── padeiro
├── padeiro-paes
├── padeiro-doceria
├── padeiro-confeitaria
├── pizzaiolo
├── pizzaiolo-forno-lenha
├── pizzaiolo-massa
├── churrasqueiro
├── churrasqueiro-profissional
├── churrasqueiro-gaucho
├── sommelier
├── sommelier-vinhos
├── sommelier-cervejas
├── sommelier-destilados
├── barista
├── barista-especialista
├── barista-latte-art
├── bartender
├── bartender-mixologista
├── bartender-flair
├── bartender-eventos               ← SSOT: mantido aqui, removido de turismo
├── garcom
├── garcom-salao
├── garcom-eventos                  ← SSOT: mantido aqui, removido de turismo
├── garcom-barman
├── garcom-copeiro
├── maitre
├── nutricionista-culinaria
├── nutricionista-gastronomia       ← SSOT: mantido aqui, removido de saude
├── food-stylist
├── food-stylist-fotografia
├── food-stylist-publicidade
├── gestor-restaurante
├── gestor-restaurante-operacoes
├── gestor-restaurante-marketing
├── gestor-restaurante-financeiro
├── gerente-delivery
├── gerente-delivery-operacoes
├── gerente-delivery-logistica
├── auxiliar-limpeza-cozinha
├── lavador-loucas
└── estoquista-alimentos
```

---

## ✈️ Turismo & Hospitalidade
`parent_n1: turismo-hospitalidade` — **57 ocupações**

```
├── guia-turistico
├── guia-turistico-local
├── guia-turistico-nacional
├── guia-turistico-internacional
├── guia-turistico-aventura
├── guia-turistico-cultural
├── guia-turistico-ecologico
├── guia-turistico-historico
├── agente-viagens
├── agente-viagens-corporativo
├── agente-viagens-lazer
├── agente-viagens-internacional
├── agente-viagens-cruzeiros
├── recepcionista-hotel
├── recepcionista-hotel-diurno
├── recepcionista-hotel-noturno
├── recepcionista-hotel-bilingue
├── recepcionista-hotel-luxo
├── gerente-hotel
├── gerente-hotel-operacoes
├── gerente-hotel-vendas
├── gerente-hotel-marketing
├── gerente-hotel-rh
├── gerente-hotel-financeiro
├── gerente-geral-hotel
├── comissario-bordo
├── comissario-bordo-nacional
├── comissario-bordo-internacional
├── comissario-bordo-chefe
├── organizador-eventos
├── organizador-eventos-corporativos
├── organizador-eventos-sociais
├── organizador-eventos-esportivos
├── organizador-eventos-culturais
├── cerimonialista
├── cerimonialista-casamentos
├── cerimonialista-corporativo
├── wedding-planner
├── wedding-planner-luxo
├── wedding-planner-destination
├── concierge
├── concierge-hotel
├── concierge-residencial
├── concierge-corporativo
├── gerente-ecoturismo
├── guia-ecoturismo
├── coordenador-ecoturismo
├── fotografo-casamentos            ← fotografo-eventos movido p/ criativo (SSOT)
├── fotografo-corporativo
├── fotografo-festas
├── dj
├── dj-eventos
├── dj-festas
├── dj-radio
├── produtor-eventos
├── produtor-eventos-musicais
├── produtor-eventos-corporativos
└── produtor-eventos-esportivos
```

---

## 🔬 Ciências & Pesquisa
`parent_n1: ciencias-pesquisa` — **34 ocupações**

```
├── pesquisador-cientifico
├── pesquisador-academico
├── pesquisador-mercado
├── pesquisador-social
├── pesquisador-economico
├── cientista-fisica
├── cientista-quimica
├── cientista-biologia
├── cientista-ambiental
├── cientista-computacao
├── cientista-cognicao
├── cientista-neurociencia
├── cientista-materiais             ← corrigido (era cientista-materials)
├── cientista-astronomia
├── cientista-geologia
├── cientista-oceanografia
├── cientista-meteorologia
├── cientista-biotecnologia
├── cientista-genetica
├── cientista-farmacologia
├── cientista-toxico
├── laboratorista
├── tecnico-laboratorio-clinico
├── tecnico-laboratorio-pesquisa
├── tecnico-laboratorio-industrial
├── analista-laboratorio
├── pesquisador-desenvolvimento-rd
├── engenheiro-pesquisa
├── estatistico
├── matematico
├── bioestatistico
├── metodologista-pesquisa
├── curador-cientifico
└── divulgador-cientifico
```

---

## 🚗 Automotivo & Mecânica
`parent_n1: automotivo-mecanica` — **42 ocupações**

```
├── mecanico-automoveis
├── mecanico-motos
├── mecanico-maquinas-pesadas
├── mecanico-agricola
├── mecanico-aeronaves
├── mecanico-helicopteros           ← corrigido (era mecanico-helicepteros)
├── mecanico-naval
├── mecanico-refrigeracao
├── eletricista-automotivo
├── eletronico-automotivo
├── injetor-eletronico
├── lanterneiro                     ← corrigido (era lanteneiro); lanterneiro-pintor removido (redundante)
├── pintor-automotivo
├── funileiro
├── funileiro-lataria
├── funileiro-martelinho-ouro
├── preparador-automotivo
├── polidor-automotivo
├── vitrificador-pintura
├── tecnico-diagnostico-automotivo
├── tecnico-injecao-eletronica
├── tecnico-cambio-automatico
├── tecnico-direcao-hidraulica
├── tecnico-ar-condicionado-automotivo
├── tecnico-som-automotivo
├── tecnico-alarme-automotivo
├── tecnico-inspecao-veicular
├── tecnico-vistoria-sinistrada
├── serralheiro-automotivo
├── tapeceiro-automotivo
├── instalador-insulfilm
├── instalador-acessorios-automotivos
├── preparador-motos
├── customizador-motos
├── mecanico-bicicletas
├── tecnico-equipamentos-pesados
├── operador-patio-veiculos
├── lavador-automotivo
├── esteticista-automotivo
├── vendedor-pecas-automotivas
├── consultor-automotivo
└── gerente-oficina-mecanica
         ← mecanico-industrial removido (SSOT: industria-manufatura)
```

---

## 💇 Beleza & Estética
`parent_n1: beleza-estetica` — **28 ocupações**

```
├── manicure
├── pedicure
├── cabeleireiro
├── barbeiro
├── maquiador
├── visagista
├── designer-sobrancelhas
├── designer-cilios
├── designer-unhas
├── esteticista
├── esteticista-facial
├── esteticista-corporal
├── depilador
├── depilador-laser
├── colorista-capilar
├── trancista
├── escovista
├── auxiliar-salao-beleza
├── quimico-capilar
├── micropigmentador
├── podologo
├── massagista-estetica
├── bronzeador
├── extensionista-unhas
├── especialista-alisamento
├── especialista-progressiva
├── gerente-salao-beleza
├── recepcionista-salao-beleza
└── lavador-cabeleireiro
```

---

## 🏠 Assistência domiciliar (não clínica)
`parent_n1: assistencia-domiciliar` — **4 ocupações**

```
├── cuidador-idosos
├── baba-infantil
├── cuidador-infantil
└── acompanhante-domiciliar
```

> **Nota v2.2:** perfis de **apoio e cuidado no domicílio**, sem ato clínico. Enfermeiro, técnico e auxiliar de enfermagem permanecem em **Saúde & Medicina** (SSOT).

---

## 🌿 Jardinagem & manutenção de áreas verdes
`parent_n1: jardinagem-manutencao` — **4 ocupações**

```
├── jardineiro
├── cortador-grama
├── podador-arvores
└── operador-rocadeira
```

> **Nota v2.2:** contexto **urbano / residencial / condomínio**. Não usar para lavoura ou pecuária (`agronegocio-rural`).

---

## 🧹 Limpeza & facilities
`parent_n1: limpeza-servicos` — **5 ocupações**

```
├── diarista
├── limpeza-pos-obra
├── limpeza-predial
├── limpeza-caixa-dagua
└── limpeza-vidros-altura
```

> **Nota v2.2:** limpeza predial, pós-obra e serviços especializados. Limpeza **em cozinha** de restaurante permanece em **Gastronomia**.

---

## 🌾 Agronegócio & Rural
`parent_n1: agronegocio-rural` — **52 ocupações**

```
├── engenheiro-agronomo             ← agronomo removido (redundante com este)
├── zootecnista
├── engenheiro-florestal
├── engenheiro-pesca
├── engenheiro-ambiental-rural
├── tecnico-agricola
├── tecnico-agropecuario
├── tecnico-florestal
├── produtor-rural
├── produtor-rural-graos
├── produtor-rural-cafe
├── produtor-rural-cana
├── produtor-rural-frutas
├── produtor-rural-hortifruti
├── produtor-rural-pecuaria
├── produtor-rural-leite
├── produtor-rural-aves
├── produtor-rural-suinos
├── produtor-rural-bovinos
├── gerente-fazenda
├── gerente-rural
├── administrador-rural
├── consultor-agricola
├── consultor-pecuario
├── extensionista-rural
├── tratorista
├── operador-colheitadeira
├── operador-pulverizador-agricola  ← corrigido (era pulverizador-agricola)
├── operador-plantadeira
├── adubador
├── classificador-graos
├── inseminador
├── tosquiador
├── trabalhador-rural
├── trabalhador-rural-cafe
├── trabalhador-rural-cana
├── capinador
├── rocador-agricola                ← corrigido (era rocador)
├── irrigador
├── operador-irrigacao
├── silvicultor
├── extrativista-florestal          ← corrigido (era extrativista, muito genérico)
├── seringueiro
├── coletor-castanha
├── pescador
├── aquicultor
├── maricultor
├── criador-peixes-ornamentais
├── responsavel-tecnico-agricola
├── fiscal-agropecuario
├── defensor-agropecuario
         ← manejo-florestal removido (atividade, não ocupação)
```

---

## 🏭 Indústria & Manufatura
`parent_n1: industria-manufatura` — **69 ocupações**

```
├── operador-maquinas-industriais
├── operador-torno-cnc
├── operador-fresadora
├── operador-centro-usinagem
├── torneiro-mecanico
├── fresador
├── ajustador-mecanico
├── ferramenteiro
├── moldador
├── fundidor
├── siderurgico
├── metalurgico
├── metalurgico-siderurgia
├── metalurgico-fundicao
├── metalurgico-laminacao
├── metalurgico-forjaria
├── operador-forno-industrial
├── operador-laminador
├── operador-tingimento
├── operador-acabamento-textil
├── costureiro-industrial
├── operador-tear
├── operador-tricotadeira
├── operador-corte-industrial
├── modelista-industrial
├── quimico-industrial
├── operador-reator-quimico
├── operador-distribuicao-quimica
├── controlador-processos
├── operador-caldeira
├── operador-utilidades-industriais
├── tecnico-processos-industriais
├── tecnico-manufatura
├── tecnico-planejamento-controle-producao
├── tecnico-automacao-industrial
├── eletricista-industrial          ← SSOT: centralizado aqui, removido de construcao
├── mecanico-industrial             ← SSOT: centralizado aqui, removido de automotivo
├── mecanico-manutencao
├── tecnico-eletroeletronica
├── tecnico-mecatronica
├── tecnico-mecanica
├── tecnico-quimica
├── tecnico-textil
├── tecnico-ceramica
├── tecnico-vidro
├── tecnico-plasticos
├── tecnico-papel-celulose
├── tecnico-couro
├── tecnico-borracha
├── tecnico-mineracao
├── tecnico-metalurgia
├── engenheiro-producao             ← SSOT: centralizado aqui, removido de operacoes
├── engenheiro-manufatura
├── engenheiro-materiais
├── engenheiro-metalurgico
├── engenheiro-textil
├── engenheiro-quimico
├── engenheiro-bioprocessos
├── engenheiro-papel-celulose
├── engenheiro-ceramica
├── engenheiro-plasticos
├── engenheiro-minas
├── gerente-fabrica
├── gerente-producao
├── gerente-manutencao-industrial
├── gerente-qualidade-industrial
├── supervisor-producao
├── supervisor-turno-fabrica
         ← engenheiro-materiais-2 removido (slug inválido, era duplicata)
```

---

## 🛡️ Segurança & Defesa
`parent_n1: seguranca-defesa` — **32 ocupações**

```
├── policial-militar
├── policial-civil
├── policial-federal
├── policial-rodoviario-federal
├── policial-ferroviario-federal
├── bombeiro-militar
├── bombeiro-civil
├── guarda-municipal
├── agente-penitenciario
├── agente-seguranca-penitenciaria
├── vigilante
├── vigilante-armado
├── seguranca-eventos
├── seguranca-patrimonial
├── seguranca-pessoal
├── bodyguard
├── escolta-armada
├── agente-seguranca-aeroportuaria
├── fiscal-fronteira
├── analista-seguranca-patrimonial
├── gerente-seguranca-patrimonial
├── supervisor-seguranca
├── perito-criminal
├── investigador
├── detetive-particular
├── analista-inteligencia
├── agente-inteligencia
├── militar-exercito
├── militar-marinha
├── militar-aeronautica
├── oficial-forcas-armadas
└── praca-forcas-armadas
```

---

## 🤝 Vendas & Atendimento
`parent_n1: vendas-atendimento` — **42 ocupações**

```
├── vendedor-interno
├── vendedor-externo
├── vendedor-loja
├── vendedor-consultivo
├── vendedor-especializado
├── vendedor-tecnico
├── representante-comercial
├── representante-tecnico-comercial
├── promotor-vendas
├── promotor-merchandising
├── consultor-vendas
├── consultor-tecnico-vendas
├── consultor-moda
├── consultor-beleza
├── consultor-decoracao
├── gerente-vendas
├── gerente-vendas-externas
├── gerente-vendas-internas
├── gerente-negocios
├── coordenador-vendas
├── supervisor-vendas
├── closer                          ← NOVO (inside sales BR)
├── sdr                             ← NOVO (Sales Development Rep)
├── atendente
├── atendente-loja
├── atendente-sac
├── recepcionista
├── recepcionista-clinica
├── recepcionista-corporativo
├── telemarketing-ativo
├── telemarketing-receptivo
├── operador-call-center
├── supervisor-call-center
├── caixa
├── caixa-loja
├── caixa-supermercado
├── balconista
├── balconista-farmacia
├── balconista-lojas
├── demonstrador-produtos
├── captador-clientes
└── prospeccao-vendas
```

---

## 🏢 RH & Gestão de Pessoas
`parent_n1: rh-gestao-pessoas` — **38 ocupações**

```
├── analista-rh
├── analista-rh-generalist
├── analista-recrutamento-selecao
├── analista-treinamento-desenvolvimento
├── analista-cargos-salarios
├── analista-beneficios
├── analista-departamento-pessoal
├── analista-engajamento
├── analista-clima-organizacional
├── analista-desenvolvimento-organizacional
├── analista-employer-branding
├── analista-diversidade-inclusao
├── gerente-rh
├── gerente-recrutamento-selecao
├── gerente-treinamento-desenvolvimento
├── gerente-compensacoes-beneficios
├── gerente-dp
├── coordenador-rh
├── coordenador-recrutamento
├── coordenador-treinamento
├── business-partner-rh
├── hrbp
├── especialista-rh
├── especialista-legislacao-trabalhista
├── especialista-seguranca-trabalho-rh
├── especialista-cipa               ← NOVO (NR-5 obrigatória)
├── gestor-desempenho
├── gestor-succession-planning
├── gestor-talentos
├── psicologo-organizacional        ← SSOT: movido de saude p/ aqui
├── psicologo-selecao
├── consultor-rh
├── consultor-organizacional
├── assistente-rh
├── auxiliar-rh
├── estagiario-rh
├── diretor-rh
└── chro-chief-human-resources-officer
```

---

## 📊 Resumo Final

| # | Categoria | `parent_n1` | v1 | v2 | v2.1 | Notas |
|---|---|---|---|---|---|---|
| 1 | 🎨 Criativo & Design | `criativo-design` | 50 | 52 | 52 | |
| 2 | 🏗️ Construção & Imóveis | `construcao-imoveis` | 90 | 87 | 87 | |
| 3 | 💰 Finanças & Contabilidade | `financas-contabilidade` | 80 | 79 | 79 | |
| 4 | 📢 Marketing & Comunicação | `marketing-comunicacao` | 85 | 80 | 80 | |
| 5 | 💻 Tecnologia & TI | `tecnologia` | 145 | 138 | 138 | |
| 6 | ⚕️ Saúde & Medicina | `saude` | 115 | 113 | 113 | |
| 7 | ⚖️ Jurídico & Compliance | `juridico` | 68 | 72 | 72 | |
| 8 | 🎓 Educação | `educacao` | 72 | 72 | 72 | |
| 9 | ⚙️ Operações & Logística | `operacoes-logistica` | 78 | 75 | 75 | |
| 10 | 🍽️ Gastronomia | `gastronomia` | 68 | 68 | 68 | |
| 11 | ✈️ Turismo & Hospitalidade | `turismo-hospitalidade` | 62 | 57 | 57 | |
| 12 | 🔬 Ciências & Pesquisa | `ciencias-pesquisa` | 35 | 34 | 34 | |
| 13 | 🚗 Automotivo & Mecânica | `automotivo-mecanica` | 45 | 42 | 42 | |
| 14 | 💇 Beleza & Estética | `beleza-estetica` | — | — | **28** | **v2.1** + migration **0099** |
| 15 | 🏠 Assistência domiciliar | `assistencia-domiciliar` | — | — | **4** | **v2.2** + migration **0100** (não clínico) |
| 16 | 🌿 Jardinagem & áreas verdes | `jardinagem-manutencao` | — | — | **4** | **v2.2** + migration **0100** |
| 17 | 🧹 Limpeza & facilities | `limpeza-servicos` | — | — | **5** | **v2.2** + migration **0100** |
| 18 | 🌾 Agronegócio & Rural | `agronegocio-rural` | 55 | 52 | 52 | |
| 19 | 🏭 Indústria & Manufatura | `industria-manufatura` | 65 | 69 | 69 | |
| 20 | 🛡️ Segurança & Defesa | `seguranca-defesa` | 30 | 31 | **32** | **v2.2** +1 `seguranca-eventos` |
| 21 | 🤝 Vendas & Atendimento | `vendas-atendimento` | 40 | 42 | 42 | |
| 22 | 🏢 RH & Gestão de Pessoas | `rh-gestao-pessoas` | 35 | 38 | 38 | |
| — | **TOTAL** | — | **~1.256** | **~1.201** | **~1.242** | v2.2 = v2.1 +14 (3 N1 + 13 N2 novos + `seguranca-eventos`) |

> **v2:** redução líquida ~55 (duplicatas SSOT, remoções, adições pontuais). **v2.1:** +28 em `beleza-estetica`. **v2.2:** +13 N2 nos três N1 novos + `seguranca-eventos` em `seguranca-defesa` (14 ocupações).

---

## 🔗 Referencias
<!-- AUTO-GENERATED-START -->
### Referencia
_nenhuma referência explícita_

### Referenciado por
- 00_INDEX.md
<!-- AUTO-GENERATED-END -->