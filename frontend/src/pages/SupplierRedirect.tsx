// frontend/src/pages/SupplierRedirect.tsx
//
// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO — terminal de redirecionamento, não é página
// ║ NORMA:   `DESENHO_PAGINA_DO_ACTOR` §2.4 — UMA página para todo actor (a casca universal)
// ║ NÃO:     NÃO reintroduzir uma página de fornecedor separada.
// ║ EM VEZ:  `ActorPage` (`/profile/:id`) — abas e ações vêm do contrato server-driven.
// ╚════════════════════════════════════════════════════════════════
//
// ═══ POR QUE ISTO EXISTE (2026-08-04) ═══
// Eu criei `/fornecedores/:providerActorId` como página própria. Era a SEXTA superfície de
// "página de vendedor" do repositório (ActorPage · VitrineProfilePage · MarketplaceStorePage ·
// CompanyDashboardPage · ProviderServiceHubPage · esta), contra a cláusula anti-página-paralela
// que o próprio `ActorPage` declara: *"CONVERGÊNCIA (anti-página-paralela, Lei §2): absorve
// SocialProfilePage e SocialCompanyPage"* e *"adicionar vertical = registrar bloco aqui, NUNCA
// página nova"*.
//
// Clayton viu o risco antes de mim: *"você precisa definir como vai ser o padrão de páginas, ou
// ver se já tem algum, para no MVP a gente não ter uma infinidade de páginas para corrigir"*. Tem
// padrão, é selado, e eu tinha acabado de violá-lo.
//
// O que valia da página era o FLUXO de pedido — virou `QuoteRequestDialog`, in-page, disponível
// para QUALQUER actor. A rota continua respondendo (links já compartilhados não morrem), mas leva
// à casca universal, que serve PF, empresa, grupo e banda igualmente.

import { Navigate, useParams } from 'react-router-dom';

export default function SupplierRedirect() {
  const { providerActorId } = useParams<{ providerActorId: string }>();
  // `replace`: a página absorvida não deve ficar no histórico do navegador — voltar tem de sair
  // daqui, não retornar a um endereço que não é mais uma tela.
  return <Navigate to={providerActorId ? `/profile/${providerActorId}` : '/meus-eventos'} replace />;
}
