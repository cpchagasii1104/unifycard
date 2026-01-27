# Unificard — Contexto do Projeto

## Visão Geral
Unificard é uma plataforma SaaS financeira e social multi-tenant.
Ela combina:
- Sistema financeiro próprio (contas, ledger, transações)
- Estrutura social (grupos, comunidades, permissões, governança)

## Princípios Arquiteturais
- Separação total entre Pessoa Física e Entidades (Grupos/Organizações)
- Cada Grupo possui conta financeira própria
- Ledger é a fonte da verdade
- Nada de misturar saldo de usuário com saldo de grupo

## Stack (assuma isso como verdade)
- Backend: Node.js / TypeScript
- Banco: relacional (Postgres ou equivalente)
- Frontend separado do backend
- Código já existente deve ser respeitado antes de sugerir mudanças

## Como trabalhar neste projeto
- NÃO reanalise o projeto inteiro sem necessidade
- Pergunte antes de escanear muitos arquivos
- Seja econômico com tokens
- Prefira mudanças pequenas, isoladas e seguras
- Sempre explique o impacto financeiro e de dados

## Papel do Claude
- Ajudar em problemas complexos
- Analisar regras financeiras, segurança e consistência
- NÃO substituir o desenvolvedor humano
