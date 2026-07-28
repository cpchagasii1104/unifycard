// src/admin/EconomicPoliciesPage.tsx
// F-ECONOMIC-POLICY-ADMIN-FRONT — FATIA 3: a tela admin de política econômica (Clayton: "ajustar
// split percentages by CITY and CATEGORY"). Backend (Fatias 0/1/2) já completo e selado:
//   - GET  /economy/admin/policies                lista policies + linhas do tenant (Fatia 1)
//   - POST /economy/admin/policies                publica NOVA VERSÃO (Fatia 2 — NUNCA edita)
//   - POST /economy/admin/policies/:id/activate   ÚNICA transição de status: draft→active
// Seletores territoriais (country_id/state_id/city_id) são FKs GOVERNADAS (Location Core,
// Fatia 0) — NUNCA texto livre. category_id é FK opcional para categories(category_id).
//
// 🔴 STOP-IF-SURPRISED resolvido no MAP desta fatia: NÃO existe endpoint de listagem de
// categorias de escopo 'global'/marketplace alcançável via HTTP (/categories/tree e
// /categories/search exigem `context` de um vocabulário fechado gated por tenant_contexts —
// CATEGORY_CONTEXT_VALUES em backend/src/core/categories/categories.schemas.ts — e NENHUM desses
// 9 valores é "categoria de produto/marketplace"). O valor 'company' é o mais próximo
// semanticamente disponível (categorização de negócio/vertical) e É alcançável — usado aqui via
// getCategoryTree('company'). category_id é OPCIONAL na policy (nullable) — se a árvore 'company'
// vier vazia para o tenant (ex.: contexto sem permissão de leitura concedida), o seletor de
// categoria fica desabilitado com nota "em breve" em vez de free-text ou lista hardcoded.
//
// CIDADE é resolvida via cascata GOVERNADA country→state→city (api/location.ts,
// getCountries/getStatesByCountry/getCitiesByState) — a mesma fonte do Location Core usada pelo
// resolver de CEP em outros fluxos. A cascata garante coerência hierárquica POR CONSTRUÇÃO (o
// picker de cidade só lista cidades do estado escolhido), então nunca dispara a FK composta 400
// do backend nesta tela.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { showToast } from '../components/common/Toast';
import { getCountries, getStatesByCountry, getCitiesByState, type Country, type State, type City } from '../api/location';
import { getCategoryTree, type CategoryTree } from '../api/categories';
import {
  listEconomicPolicies,
  createEconomicPolicyVersion,
  activateEconomicPolicy,
  getRegionalFundVocabulary,
  type EconomicPolicy,
  type EconomicPolicyLine,
  type EconomicPolicyLineType,
  type EconomicPolicyDestinationType,
  type EconomicPolicyAppliesToWritable,
  type RegionalOriginBasis,
  type RegionalFundLevel,
  type RegionalFundVocabulary,
  type EconomicPolicyType,
  type PolicyLineRequestBody,
  type CreatePolicyVersionRequestBody,
} from '../api/economic-policies';
import './EconomicPoliciesPage.css';

// ── Vocabulário físico (espelha o CHECK do Postgres + write-validation.ts do backend) ──────────
const POLICY_TYPES: { value: EconomicPolicyType; label: string }[] = [
  { value: 'COMMISSION_SPLIT', label: 'Split de comissão' },
  { value: 'ACCESS_PASS', label: 'Passe de acesso' },
  { value: 'HYBRID', label: 'Híbrido (split + passe)' },
  { value: 'ZERO_FEE', label: 'Isento (100% revenue_share)' },
  { value: 'CONTRACTUAL', label: 'Contratual (manual)' },
];

const LINE_TYPES: { value: EconomicPolicyLineType; label: string }[] = [
  { value: 'revenue_share', label: 'Repasse ao prestador (revenue_share)' },
  { value: 'platform_fee', label: 'Taxa da plataforma (platform_fee)' },
  { value: 'regional_fund', label: 'Fundo regional (regional_fund)' },
  { value: 'reserve', label: 'Reserva (reserve)' },
  { value: 'referral', label: 'Indicação (referral)' },
  { value: 'group_allocation', label: 'Alocação de grupo (group_allocation)' },
  { value: 'channel_commission', label: 'Comissão de canal (channel_commission)' },
  { value: 'custom', label: 'Customizado (custom)' },
];

const DESTINATION_TYPES: { value: EconomicPolicyDestinationType; label: string }[] = [
  { value: 'receiver_actor', label: 'Actor recebedor' },
  { value: 'actor_wallet', label: 'Carteira do actor' },
  { value: 'platform_fees', label: 'Taxas da plataforma' },
  { value: 'platform_revenue', label: 'Receita da plataforma' },
  { value: 'regional_fund', label: 'Fundo regional' },
  { value: 'risk_reserve', label: 'Reserva de risco' },
  { value: 'referrer_actor_wallet', label: 'Carteira do indicador' },
  { value: 'group_wallet', label: 'Carteira do grupo' },
  { value: 'channel_actor_wallet', label: 'Carteira do canal' },
  { value: 'escrow_payments', label: 'Escrow de pagamentos' },
  { value: 'custom', label: 'Customizado' },
];

const APPLIES_TO: { value: EconomicPolicyAppliesToWritable; label: string }[] = [
  { value: 'gross_transaction', label: 'Sobre o valor bruto da transação' },
  { value: 'commission_gross', label: 'Sobre a comissão bruta' },
  { value: 'commission_distributable', label: 'Sobre a comissão distribuível' },
];

// ╔═ ORIENTAÇÃO CANÔNICA ══════════════════════════════════════════
// ║ STATUS:  CONTIDO
// ║ NORMA:   backend/src/modules/economy/policy-engine/economic-policy.types.ts (REGIONAL_*_RESOLVABLE_MVP, guard-policiada)
// ║ NÃO:     usar os 7/5 valores abaixo como OPÇÕES do seletor — são só texto de rótulo (pt-BR)
// ║ EM VEZ:  seletor filtra por regionalVocab (GET /economy/admin/regional-fund-vocabulary)
// ╚════════════════════════════════════════════════════════════════
//
// Os dois arrays abaixo são DICIONÁRIOS DE RÓTULO (pt-BR), não a lista de opções oferecidas — eles
// cobrem os 7/5 valores FÍSICOS (para rotular histórico antigo, caso alguma linha rara já tenha um
// basis/level hoje não resolvível) mas o formulário NUNCA itera sobre eles diretamente para montar
// as opções de um <select>; ele itera sobre `regionalVocab` (estado carregado do backend via
// getRegionalFundVocabulary — ver useEffect abaixo), e usa labelFor(REGIONAL_ORIGIN_BASIS_LABELS, …)
// só para traduzir o value já filtrado em texto legível.
const REGIONAL_ORIGIN_BASIS_LABELS: { value: RegionalOriginBasis; label: string }[] = [
  { value: 'payer_identity_residence', label: 'Residência de identidade do pagador' },
  { value: 'receiver_identity_residence', label: 'Residência de identidade do recebedor' },
  { value: 'receiver_company_operational', label: 'Operação da empresa recebedora' },
  { value: 'receiver_company_hq', label: 'Sede da empresa recebedora' },
  { value: 'service_location', label: 'Local do serviço' },
  { value: 'transaction_location', label: 'Local da transação' },
  { value: 'explicit_economic_region', label: 'Região econômica explícita' },
];

const REGIONAL_LEVEL_LABELS: { value: RegionalFundLevel; label: string }[] = [
  { value: 'planet', label: 'Planeta' },
  { value: 'country', label: 'País' },
  { value: 'state', label: 'Estado' },
  { value: 'city', label: 'Cidade' },
  { value: 'neighborhood', label: 'Bairro' },
];

function labelFor<T extends string>(list: { value: T; label: string }[], value: T | null | undefined): string {
  if (!value) return '—';
  return list.find((i) => i.value === value)?.label ?? value;
}

function statusBadgeClass(status: string): string {
  if (status === 'active') return 'econ-badge econ-badge--active';
  if (status === 'draft') return 'econ-badge econ-badge--draft';
  return 'econ-badge econ-badge--deprecated';
}

function statusLabel(status: string): string {
  if (status === 'active') return 'Ativa';
  if (status === 'draft') return 'Rascunho';
  return 'Descontinuada';
}

function formatBps(bps: number | null): string {
  if (bps === null) return '—';
  return `${bps} bps = ${(bps / 100).toFixed(2).replace(/\.00$/, '')}%`;
}

/**
 * Traduz o erro lançado por apiFetch (client.ts) em uma mensagem amigável pt-BR. apiFetch já
 * lança um Error para toda resposta não-2xx; a maioria das mensagens de domínio desta rota já
 * nasce pt-BR no backend (prefixo "economic_policy:" — write-validation.ts / translatePolicyWriteError),
 * então essas são exibidas como estão. Casos sem esse prefixo (403 de requireRole, texto técnico
 * em inglês; 401 de sessão) recebem tradução explícita — nunca mostrar erro cru ao usuário.
 */
function friendlyErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? '');
  if (message.startsWith('economic_policy:')) return message;
  if (/Requires one of roles|Permission denied|Capability denied/i.test(message)) {
    return 'Acesso restrito a administradores.';
  }
  if (/Sessão expirada|Não autenticado/i.test(message)) {
    return 'Sessão expirada. Faça login novamente.';
  }
  if (!message || message.startsWith('HTTP ')) {
    return 'Erro inesperado ao comunicar com o servidor. Tente novamente.';
  }
  return message;
}

// ── Linha do formulário (estado local — bps é a fonte de verdade; percentual é só exibição) ────
interface LineDraft {
  key: string; // chave React local, não vai pro wire
  lineType: EconomicPolicyLineType;
  destinationType: EconomicPolicyDestinationType;
  destinationKey: string;
  valueMode: 'bps' | 'fixed';
  bps: number | null; // inteiro, 0..10000
  fixedAmountCents: number | null;
  appliesTo: EconomicPolicyAppliesToWritable;
  regionalOriginBasis: RegionalOriginBasis | '';
  regionalLevel: RegionalFundLevel | '';
  priority: number;
}

function emptyLine(): LineDraft {
  return {
    key: `line-${Math.random().toString(36).slice(2)}`,
    lineType: 'revenue_share',
    destinationType: 'receiver_actor',
    destinationKey: '',
    valueMode: 'bps',
    bps: null,
    fixedAmountCents: null,
    appliesTo: 'gross_transaction',
    regionalOriginBasis: '',
    regionalLevel: '',
    priority: 0,
  };
}

function lineFromExisting(line: EconomicPolicyLine): LineDraft {
  return {
    key: `line-${line.id}`,
    lineType: line.lineType,
    destinationType: line.destinationType,
    destinationKey: line.destinationKey ?? '',
    valueMode: line.fixedAmountCents !== null ? 'fixed' : 'bps',
    bps: line.bps,
    fixedAmountCents: line.fixedAmountCents,
    // appliesTo herdado pode ser um legado read-only (gross|net); nova versão exige base gravável —
    // cai no default gravável em vez de propagar um valor que o backend rejeitaria.
    appliesTo:
      line.appliesTo === 'gross_transaction' ||
      line.appliesTo === 'commission_gross' ||
      line.appliesTo === 'commission_distributable'
        ? line.appliesTo
        : 'gross_transaction',
    regionalOriginBasis: line.regionalOriginBasis ?? '',
    regionalLevel: line.regionalLevel ?? '',
    priority: line.priority ?? 0,
  };
}

interface FormDraft {
  policyCode: string;
  policyType: EconomicPolicyType;
  moduleContext: string;
  vertical: string;
  actorType: string;
  serviceType: string;
  pricingModel: string;
  settlementFlow: string;
  countryId: string;
  stateId: string;
  cityId: string;
  categoryId: string;
  channel: string;
  campaignId: string;
  priority: number;
  effectiveFrom: string; // yyyy-mm-dd
  effectiveUntil: string; // yyyy-mm-dd ou ''
  changeReason: string;
  lines: LineDraft[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(): FormDraft {
  return {
    policyCode: '',
    policyType: 'COMMISSION_SPLIT',
    moduleContext: '',
    vertical: '',
    actorType: '',
    serviceType: '',
    pricingModel: '',
    settlementFlow: '',
    countryId: '',
    stateId: '',
    cityId: '',
    categoryId: '',
    channel: '',
    campaignId: '',
    priority: 0,
    effectiveFrom: todayIso(),
    effectiveUntil: '',
    changeReason: '',
    lines: [emptyLine()],
  };
}

/** Prefill a partir de uma policy existente — NUNCA edita; é só ponto de partida da NOVA versão. */
function formFromPolicy(policy: EconomicPolicy): FormDraft {
  return {
    policyCode: policy.policyCode,
    policyType: policy.policyType,
    moduleContext: policy.moduleContext,
    vertical: policy.vertical ?? '',
    actorType: policy.actorType ?? '',
    serviceType: policy.serviceType ?? '',
    pricingModel: policy.pricingModel ?? '',
    settlementFlow: policy.settlementFlow ?? '',
    countryId: policy.countryId ?? '',
    stateId: policy.stateId ?? '',
    cityId: policy.cityId ?? '',
    categoryId: policy.categoryId ?? '',
    channel: policy.channel ?? '',
    campaignId: policy.campaignId ?? '',
    priority: policy.priority ?? 0,
    effectiveFrom: todayIso(),
    effectiveUntil: '',
    changeReason: '', // NUNCA herda justificativa — cada versão exige a sua (Artigo XI)
    lines: policy.lines.length > 0 ? policy.lines.map(lineFromExisting) : [emptyLine()],
  };
}

function flattenCategories(tree: CategoryTree[], depth = 0, out: { id: string; label: string }[] = []) {
  for (const node of tree) {
    out.push({ id: node.categoryId, label: `${'—'.repeat(depth)} ${node.name}`.trim() });
    if (node.children && node.children.length > 0) {
      flattenCategories(node.children, depth + 1, out);
    }
  }
  return out;
}

export default function EconomicPoliciesPage() {
  const [policies, setPolicies] = useState<EconomicPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyActivateId, setBusyActivateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Picker de território (cascata governada país→estado→cidade)
  const [countries, setCountries] = useState<Country[]>([]);
  const [statesByCountry, setStatesByCountry] = useState<Record<string, State[]>>({});
  const [citiesByState, setCitiesByState] = useState<Record<string, City[]>>({});
  const [territoryLoading, setTerritoryLoading] = useState(false);

  // Picker de categoria (context='company' — ver nota STOP-IF-SURPRISED no topo do arquivo)
  const [categoryOptions, setCategoryOptions] = useState<{ id: string; label: string }[]>([]);
  const [categoryPickerBlocked, setCategoryPickerBlocked] = useState(false);

  // Vocabulário RESOLVÍVEL de regional_fund (basis/level) — SEMPRE server-driven (GET
  // /economy/admin/regional-fund-vocabulary), NUNCA uma lista própria desta tela (ver ORIENTAÇÃO
  // CANÔNICA acima). null enquanto carrega; o seletor fica desabilitado até chegar.
  const [regionalVocab, setRegionalVocab] = useState<RegionalFundVocabulary | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormDraft>(emptyForm());

  // Legibilidade do painel (Task 2, 2026-07-27): `deprecated` é histórico não-acionável (ex.:
  // fixtures E2E `*_e2e_*`) — escondido por padrão para Clayton achar as poucas policies reais;
  // toggle revela de volta (leitura, nunca deleção — nenhuma linha é tocada).
  const [showDeprecated, setShowDeprecated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listEconomicPolicies({ includeDeprecated: showDeprecated });
      setPolicies(data);
    } catch (err) {
      setLoadError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [showDeprecated]);

  useEffect(() => { void load(); }, [load]);

  // Países — carregados uma vez (base do picker de território)
  useEffect(() => {
    void (async () => {
      const list = await getCountries();
      setCountries(list);
    })();
  }, []);

  // Vocabulário RESOLVÍVEL de regional_fund — carregado uma vez do backend (fonte única; ver
  // ORIENTAÇÃO CANÔNICA acima). Falha silenciosa deixa regionalVocab null — o seletor fica
  // desabilitado em vez de cair para uma lista local inventada.
  useEffect(() => {
    void (async () => {
      try {
        const vocab = await getRegionalFundVocabulary();
        setRegionalVocab(vocab);
      } catch {
        setRegionalVocab(null);
      }
    })();
  }, []);

  // Categorias governadas (context='company') — ver nota STOP-IF-SURPRISED no topo do arquivo.
  useEffect(() => {
    void (async () => {
      try {
        const tree = await getCategoryTree('company');
        if (!tree || tree.length === 0) {
          setCategoryPickerBlocked(true);
          setCategoryOptions([]);
          return;
        }
        setCategoryOptions(flattenCategories(tree));
      } catch {
        setCategoryPickerBlocked(true);
        setCategoryOptions([]);
      }
    })();
  }, []);

  // Resolução de labels território/categoria para a LISTA (histórico) — sob demanda, com cache.
  useEffect(() => {
    void (async () => {
      const countryIds = new Set<string>();
      const stateIds = new Set<string>();
      for (const p of policies) {
        if (p.countryId) countryIds.add(p.countryId);
        if (p.stateId) stateIds.add(p.stateId);
      }
      for (const countryId of countryIds) {
        if (statesByCountry[countryId]) continue;
        const list = await getStatesByCountry(countryId);
        setStatesByCountry((prev) => ({ ...prev, [countryId]: list }));
      }
      for (const stateId of stateIds) {
        if (citiesByState[stateId]) continue;
        const list = await getCitiesByState(stateId);
        setCitiesByState((prev) => ({ ...prev, [stateId]: list }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policies]);

  const countryLabel = useCallback(
    (id: string | null) => (id ? countries.find((c) => c.id === id)?.name ?? id : null),
    [countries]
  );
  const stateLabel = useCallback(
    (countryId: string | null, id: string | null) => {
      if (!id) return null;
      const list = countryId ? statesByCountry[countryId] : undefined;
      return list?.find((s) => s.id === id)?.name ?? id;
    },
    [statesByCountry]
  );
  const cityLabel = useCallback(
    (stateId: string | null, id: string | null) => {
      if (!id) return null;
      const list = stateId ? citiesByState[stateId] : undefined;
      return list?.find((c) => c.id === id)?.name ?? id;
    },
    [citiesByState]
  );
  const categoryLabel = useCallback(
    (id: string | null) => (id ? categoryOptions.find((c) => c.id === id)?.label.trim() ?? id : null),
    [categoryOptions]
  );

  // Picker de território dentro do FORM (cascata) — carrega estados/cidades sob demanda.
  const formStates = form.countryId ? statesByCountry[form.countryId] ?? [] : [];
  const formCities = form.stateId ? citiesByState[form.stateId] ?? [] : [];

  const onFormCountryChange = async (countryId: string) => {
    setForm((f) => ({ ...f, countryId, stateId: '', cityId: '' }));
    if (countryId && !statesByCountry[countryId]) {
      setTerritoryLoading(true);
      const list = await getStatesByCountry(countryId);
      setStatesByCountry((prev) => ({ ...prev, [countryId]: list }));
      setTerritoryLoading(false);
    }
  };
  const onFormStateChange = async (stateId: string) => {
    setForm((f) => ({ ...f, stateId, cityId: '' }));
    if (stateId && !citiesByState[stateId]) {
      setTerritoryLoading(true);
      const list = await getCitiesByState(stateId);
      setCitiesByState((prev) => ({ ...prev, [stateId]: list }));
      setTerritoryLoading(false);
    }
  };

  // ── Soma ao vivo (fonte de verdade: bps inteiro, igual ao backend) ──────────────────────────
  const bpsLines = form.lines.filter((l) => l.valueMode === 'bps' && l.bps !== null);
  const bpsSum = bpsLines.reduce((acc, l) => acc + (l.bps ?? 0), 0);
  const hasAnyLine = form.lines.length > 0;
  const hasRevenueShareAmongBps = bpsLines.some((l) => l.lineType === 'revenue_share');
  const sumOk = bpsLines.length === 0 || (bpsSum === 10000 && hasRevenueShareAmongBps);
  const everyLineHasValue = form.lines.every(
    (l) => (l.valueMode === 'bps' ? l.bps !== null : l.fixedAmountCents !== null)
  );
  // Espelha EXATAMENTE assertLineShapeValid (economic-policy-write-validation.ts:234-246): toda
  // linha regional_fund exige regionalLevel; e exige regionalOriginBasis SE não houver
  // destinationKey. O backend continua a autoridade (fail-closed no 400); isto só evita a viagem
  // ao servidor para descobrir o mesmo erro.
  const invalidRegionalFundLines = form.lines.filter(
    (l) =>
      l.lineType === 'regional_fund' &&
      (!l.regionalLevel || (!l.destinationKey.trim() && !l.regionalOriginBasis))
  );
  const everyRegionalFundLineValid = invalidRegionalFundLines.length === 0;

  const canSubmit =
    hasAnyLine &&
    everyLineHasValue &&
    sumOk &&
    everyRegionalFundLineValid &&
    form.policyCode.trim().length > 0 &&
    form.moduleContext.trim().length > 0 &&
    form.effectiveFrom.trim().length > 0 &&
    form.changeReason.trim().length > 0 &&
    !submitting;

  const updateLine = (key: string, patch: Partial<LineDraft>) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    }));
  };
  const addLine = () => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }));
  const removeLine = (key: string) =>
    setForm((f) => ({ ...f, lines: f.lines.length > 1 ? f.lines.filter((l) => l.key !== key) : f.lines }));

  const openNewPolicyForm = () => {
    setForm(emptyForm());
    setShowForm(true);
  };
  const openNewVersionForm = (policy: EconomicPolicy) => {
    setForm(formFromPolicy(policy));
    setShowForm(true);
  };
  const closeForm = () => setShowForm(false);

  const submitForm = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const lines: PolicyLineRequestBody[] = form.lines.map((l) => ({
        lineType: l.lineType,
        destinationType: l.destinationType,
        destinationKey: l.destinationKey.trim() || null,
        regionalOriginBasis: l.lineType === 'regional_fund' && l.regionalOriginBasis ? l.regionalOriginBasis : null,
        regionalLevel: l.lineType === 'regional_fund' && l.regionalLevel ? l.regionalLevel : null,
        bps: l.valueMode === 'bps' ? l.bps : null,
        fixedAmountCents: l.valueMode === 'fixed' ? l.fixedAmountCents : null,
        appliesTo: l.appliesTo,
        priority: l.priority,
      }));

      const body: CreatePolicyVersionRequestBody = {
        policyCode: form.policyCode.trim(),
        policyType: form.policyType,
        moduleContext: form.moduleContext.trim(),
        vertical: form.vertical.trim() || null,
        actorType: form.actorType.trim() || null,
        serviceType: form.serviceType.trim() || null,
        pricingModel: form.pricingModel.trim() || null,
        settlementFlow: form.settlementFlow.trim() || null,
        countryId: form.countryId || null,
        stateId: form.stateId || null,
        cityId: form.cityId || null,
        categoryId: form.categoryId || null,
        channel: form.channel.trim() || null,
        campaignId: form.campaignId.trim() || null,
        priority: form.priority,
        effectiveFrom: new Date(`${form.effectiveFrom}T00:00:00Z`).toISOString(),
        effectiveUntil: form.effectiveUntil
          ? new Date(`${form.effectiveUntil}T00:00:00Z`).toISOString()
          : null,
        changeReason: form.changeReason.trim(),
        lines,
      };

      await createEconomicPolicyVersion(body);
      showToast('Nova versão publicada como rascunho (draft).', 'success');
      setShowForm(false);
      await load();
    } catch (err) {
      showToast(friendlyErrorMessage(err), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const activate = async (policy: EconomicPolicy) => {
    setBusyActivateId(policy.id);
    try {
      await activateEconomicPolicy(policy.id);
      showToast(`Policy ${policy.policyCode} v${policy.version} ativada.`, 'success');
      await load();
    } catch (err) {
      showToast(friendlyErrorMessage(err), 'error');
    } finally {
      setBusyActivateId(null);
    }
  };

  // Agrupa por policyCode; cada grupo ordenado por versão desc (histórico constitucional visível).
  const groups = useMemo(() => {
    const byCode = new Map<string, EconomicPolicy[]>();
    for (const p of policies) {
      const list = byCode.get(p.policyCode) ?? [];
      list.push(p);
      byCode.set(p.policyCode, list);
    }
    for (const list of byCode.values()) list.sort((a, b) => b.version - a.version);
    return Array.from(byCode.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [policies]);

  return (
    <div className="econ-policies">
      <header className="econ-policies__head">
        <h1>Políticas econômicas (split)</h1>
        <p>
          Cada linha abaixo é uma <strong>VERSÃO</strong> publicada de uma regra de split — o
          histórico completo é a trilha de auditoria constitucional (Artigo XI). Não existe edição:
          toda mudança é uma nova versão, e só uma versão <code>draft</code> pode ser ativada. O
          admin configura a REGRA; o Bank executa o dinheiro.
        </p>
        <button className="econ-btn econ-btn--primary" onClick={openNewPolicyForm}>
          + Publicar nova policy / versão
        </button>
        <label className="econ-toggle-deprecated">
          <input
            type="checkbox"
            checked={showDeprecated}
            onChange={(e) => setShowDeprecated(e.target.checked)}
          />
          Mostrar versões <code>deprecated</code> (histórico)
        </label>
      </header>

      {loading && <p className="econ-muted">Carregando políticas…</p>}
      {loadError && <p className="econ-error">{loadError}</p>}

      {!loading && !loadError && groups.length === 0 && (
        <p className="econ-muted">Nenhuma economic policy publicada ainda neste tenant.</p>
      )}

      <div className="econ-groups">
        {groups.map(([policyCode, versions]) => (
          <section key={policyCode} className="econ-group">
            <h2 className="econ-group__title">{policyCode}</h2>
            <ul className="econ-version-list">
              {versions.map((policy) => (
                <li key={policy.id} className="econ-version-card">
                  <div className="econ-version-card__head">
                    <span className={statusBadgeClass(policy.status)}>{statusLabel(policy.status)}</span>
                    <span className="econ-version-tag">v{policy.version}</span>
                    <span className="econ-version-module">{policy.moduleContext}</span>
                    <span className="econ-version-type">{labelFor(POLICY_TYPES, policy.policyType)}</span>
                    {policy.status === 'draft' && (
                      <button
                        className="econ-btn econ-btn--activate"
                        disabled={busyActivateId === policy.id}
                        onClick={() => void activate(policy)}
                      >
                        {busyActivateId === policy.id ? 'Ativando…' : 'Ativar'}
                      </button>
                    )}
                    <button className="econ-btn econ-btn--ghost" onClick={() => openNewVersionForm(policy)}>
                      Publicar nova versão a partir desta
                    </button>
                  </div>

                  <div className="econ-version-card__selectors">
                    <span>País: {countryLabel(policy.countryId) ?? 'qualquer'}</span>
                    <span>Estado: {stateLabel(policy.countryId, policy.stateId) ?? 'qualquer'}</span>
                    <span>Cidade: {cityLabel(policy.stateId, policy.cityId) ?? 'qualquer'}</span>
                    <span>Categoria: {categoryLabel(policy.categoryId) ?? 'qualquer'}</span>
                  </div>

                  <table className="econ-lines-table">
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Destino</th>
                        <th>Base</th>
                        <th>Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {policy.lines.map((line) => (
                        <tr key={line.id}>
                          <td>{labelFor(LINE_TYPES, line.lineType)}</td>
                          <td>{labelFor(DESTINATION_TYPES, line.destinationType)}</td>
                          <td>{line.appliesTo}</td>
                          <td>
                            {line.bps !== null
                              ? formatBps(line.bps)
                              : line.fixedAmountCents !== null
                                ? `R$ ${(line.fixedAmountCents / 100).toFixed(2)} fixo`
                                : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="econ-version-card__footer">
                    <p className="econ-change-reason">
                      <strong>Justificativa:</strong> {policy.changeReason || '(sem justificativa registrada — versão pré-Fatia 2)'}
                    </p>
                    <p className="econ-meta">
                      Autor (actor): <code>{policy.createdByActorId ?? '—'}</code> · publicada em{' '}
                      {new Date(policy.createdAt).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {showForm && (
        <div className="econ-modal-backdrop" onClick={closeForm}>
          <div className="econ-modal" onClick={(e) => e.stopPropagation()}>
            <div className="econ-modal__head">
              <h2>Publicar nova versão de policy</h2>
              <p className="econ-muted">
                Isto cria uma <strong>versão nova</strong> — nunca edita uma policy existente. Ela
                nasce como <code>draft</code>; ative-a depois na lista quando estiver pronta.
              </p>
              <button className="econ-btn econ-btn--ghost" onClick={closeForm}>Fechar</button>
            </div>

            <div className="econ-form-grid">
              <label className="econ-field">
                <span>Código da policy *</span>
                <input
                  type="text"
                  value={form.policyCode}
                  onChange={(e) => setForm((f) => ({ ...f, policyCode: e.target.value }))}
                  placeholder="ex.: service_booking_default_split"
                />
              </label>

              <label className="econ-field">
                <span>Tipo de policy *</span>
                <select
                  value={form.policyType}
                  onChange={(e) => setForm((f) => ({ ...f, policyType: e.target.value as EconomicPolicyType }))}
                >
                  {POLICY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className="econ-field">
                <span>Módulo (module_context) *</span>
                <input
                  type="text"
                  value={form.moduleContext}
                  onChange={(e) => setForm((f) => ({ ...f, moduleContext: e.target.value }))}
                  placeholder="ex.: service_execution, marketplace_payment"
                />
              </label>

              <label className="econ-field">
                <span>Canal (channel)</span>
                <input
                  type="text"
                  value={form.channel}
                  onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value }))}
                  placeholder="opcional"
                />
              </label>

              <label className="econ-field">
                <span>País (opcional — vazio = qualquer)</span>
                <select value={form.countryId} onChange={(e) => void onFormCountryChange(e.target.value)}>
                  <option value="">— qualquer país —</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="econ-field">
                <span>Estado (opcional)</span>
                <select
                  value={form.stateId}
                  onChange={(e) => void onFormStateChange(e.target.value)}
                  disabled={!form.countryId}
                >
                  <option value="">— qualquer estado —</option>
                  {formStates.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>

              <label className="econ-field">
                <span>Cidade (opcional)</span>
                <select
                  value={form.cityId}
                  onChange={(e) => setForm((f) => ({ ...f, cityId: e.target.value }))}
                  disabled={!form.stateId}
                >
                  <option value="">— qualquer cidade —</option>
                  {formCities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              {territoryLoading && <span className="econ-muted econ-field-hint">Carregando território governado…</span>}

              <label className="econ-field">
                <span>Categoria (opcional)</span>
                {categoryPickerBlocked ? (
                  <>
                    <select disabled>
                      <option>Em breve — sem categorias 'company' disponíveis para este tenant</option>
                    </select>
                  </>
                ) : (
                  <select
                    value={form.categoryId}
                    onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                  >
                    <option value="">— qualquer categoria —</option>
                    {categoryOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                )}
              </label>

              <label className="econ-field">
                <span>Vigência a partir de *</span>
                <input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                />
              </label>

              <label className="econ-field">
                <span>Vigência até (opcional)</span>
                <input
                  type="date"
                  value={form.effectiveUntil}
                  onChange={(e) => setForm((f) => ({ ...f, effectiveUntil: e.target.value }))}
                />
              </label>

              <label className="econ-field">
                <span>Prioridade (specificity manual, default 0)</span>
                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>

            <details className="econ-advanced">
              <summary>Seletores avançados (opcionais)</summary>
              <div className="econ-form-grid">
                <label className="econ-field">
                  <span>Vertical</span>
                  <input type="text" value={form.vertical} onChange={(e) => setForm((f) => ({ ...f, vertical: e.target.value }))} />
                </label>
                <label className="econ-field">
                  <span>Tipo de actor (actor_type)</span>
                  <input type="text" value={form.actorType} onChange={(e) => setForm((f) => ({ ...f, actorType: e.target.value }))} />
                </label>
                <label className="econ-field">
                  <span>Tipo de serviço (service_type)</span>
                  <input type="text" value={form.serviceType} onChange={(e) => setForm((f) => ({ ...f, serviceType: e.target.value }))} />
                </label>
                <label className="econ-field">
                  <span>Modelo de precificação (pricing_model)</span>
                  <input type="text" value={form.pricingModel} onChange={(e) => setForm((f) => ({ ...f, pricingModel: e.target.value }))} />
                </label>
                <label className="econ-field">
                  <span>Fluxo de liquidação (settlement_flow)</span>
                  <input type="text" value={form.settlementFlow} onChange={(e) => setForm((f) => ({ ...f, settlementFlow: e.target.value }))} />
                </label>
                <label className="econ-field">
                  <span>Campanha (campaign_id)</span>
                  <input type="text" value={form.campaignId} onChange={(e) => setForm((f) => ({ ...f, campaignId: e.target.value }))} />
                </label>
              </div>
            </details>

            <h3 className="econ-lines-title">Linhas de split</h3>
            <div className="econ-lines-editor">
              {form.lines.map((line, idx) => (
                <div key={line.key} className="econ-line-row">
                  <div className="econ-line-row__grid">
                    <label className="econ-field">
                      <span>Tipo de linha</span>
                      <select
                        value={line.lineType}
                        onChange={(e) => updateLine(line.key, { lineType: e.target.value as EconomicPolicyLineType })}
                      >
                        {LINE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="econ-field">
                      <span>Destino</span>
                      <select
                        value={line.destinationType}
                        onChange={(e) => updateLine(line.key, { destinationType: e.target.value as EconomicPolicyDestinationType })}
                      >
                        {DESTINATION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="econ-field">
                      <span>Base de cálculo</span>
                      <select
                        value={line.appliesTo}
                        onChange={(e) => updateLine(line.key, { appliesTo: e.target.value as EconomicPolicyAppliesToWritable })}
                      >
                        {APPLIES_TO.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>

                    <label className="econ-field">
                      <span>Modo de valor</span>
                      <select
                        value={line.valueMode}
                        onChange={(e) =>
                          updateLine(line.key, {
                            valueMode: e.target.value as 'bps' | 'fixed',
                            bps: e.target.value === 'bps' ? line.bps : null,
                            fixedAmountCents: e.target.value === 'fixed' ? line.fixedAmountCents : null,
                          })
                        }
                      >
                        <option value="bps">Percentual</option>
                        <option value="fixed">Valor fixo (R$)</option>
                      </select>
                    </label>

                    {line.valueMode === 'bps' ? (
                      <label className="econ-field">
                        <span>Percentual (%)</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          value={line.bps === null ? '' : (line.bps / 100).toString()}
                          onChange={(e) => {
                            const v = e.target.value;
                            const bps = v === '' ? null : Math.round(parseFloat(v) * 100);
                            updateLine(line.key, { bps: Number.isFinite(bps as number) ? bps : null });
                          }}
                        />
                      </label>
                    ) : (
                      <label className="econ-field">
                        <span>Valor fixo (R$)</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={line.fixedAmountCents === null ? '' : (line.fixedAmountCents / 100).toString()}
                          onChange={(e) => {
                            const v = e.target.value;
                            const cents = v === '' ? null : Math.round(parseFloat(v) * 100);
                            updateLine(line.key, { fixedAmountCents: Number.isFinite(cents as number) ? cents : null });
                          }}
                        />
                      </label>
                    )}

                    <label className="econ-field">
                      <span>Chave de destino (opcional)</span>
                      <input
                        type="text"
                        value={line.destinationKey}
                        onChange={(e) => updateLine(line.key, { destinationKey: e.target.value })}
                        placeholder="ex.: id fixo do destino, se aplicável"
                      />
                    </label>

                    {line.lineType === 'regional_fund' && (
                      <>
                        <label className="econ-field">
                          <span>Nível regional *</span>
                          <select
                            value={line.regionalLevel}
                            onChange={(e) => updateLine(line.key, { regionalLevel: e.target.value as RegionalFundLevel })}
                            disabled={!regionalVocab}
                          >
                            <option value="">— selecione —</option>
                            {(regionalVocab?.regionalFundLevelResolvable ?? []).map((value) => (
                              <option key={value} value={value}>{labelFor(REGIONAL_LEVEL_LABELS, value)}</option>
                            ))}
                          </select>
                          {!regionalVocab && (
                            <span className="econ-muted econ-field-hint">Carregando níveis resolvíveis…</span>
                          )}
                        </label>
                        <label className="econ-field">
                          <span>Origem regional (se sem chave de destino) *</span>
                          <select
                            value={line.regionalOriginBasis}
                            onChange={(e) => updateLine(line.key, { regionalOriginBasis: e.target.value as RegionalOriginBasis })}
                            disabled={!regionalVocab}
                          >
                            <option value="">— selecione —</option>
                            {(regionalVocab?.regionalOriginBasisResolvable ?? []).map((value) => (
                              <option key={value} value={value}>{labelFor(REGIONAL_ORIGIN_BASIS_LABELS, value)}</option>
                            ))}
                          </select>
                          {!regionalVocab && (
                            <span className="econ-muted econ-field-hint">Carregando origens resolvíveis…</span>
                          )}
                        </label>
                      </>
                    )}
                  </div>
                  <button
                    className="econ-btn econ-btn--danger"
                    onClick={() => removeLine(line.key)}
                    disabled={form.lines.length <= 1}
                    title={form.lines.length <= 1 ? 'Ao menos uma linha é obrigatória' : 'Remover linha'}
                  >
                    Remover linha {idx + 1}
                  </button>
                </div>
              ))}
              <button className="econ-btn econ-btn--ghost" onClick={addLine}>+ Adicionar linha</button>
            </div>

            <div className={`econ-sum-indicator ${sumOk ? 'econ-sum-indicator--ok' : 'econ-sum-indicator--bad'}`}>
              {bpsLines.length === 0
                ? 'Nenhuma linha percentual nesta versão (só valores fixos).'
                : sumOk
                  ? `Total: ${(bpsSum / 100).toFixed(2)}% ✓`
                  : bpsSum !== 10000
                    ? `Total: ${(bpsSum / 100).toFixed(2)}% ✗ — precisa fechar exatamente 100%`
                    : 'Falta uma linha revenue_share entre as linhas percentuais ✗'}
            </div>

            {!everyRegionalFundLineValid && (
              <div className="econ-sum-indicator econ-sum-indicator--bad">
                {`Linha(s) regional_fund incompleta(s) (#${invalidRegionalFundLines
                  .map((l) => form.lines.indexOf(l) + 1)
                  .join(', #')}) — nível regional é sempre obrigatório; origem regional é obrigatória quando não há chave de destino ✗`}
              </div>
            )}

            <label className="econ-field econ-field--wide">
              <span>Justificativa da mudança (change_reason) * — obrigatória, vira histórico permanente</span>
              <textarea
                value={form.changeReason}
                onChange={(e) => setForm((f) => ({ ...f, changeReason: e.target.value }))}
                placeholder="Por que esta regra está mudando? Esta justificativa fica pública no histórico da policy (Artigo XI)."
                rows={3}
              />
            </label>

            <div className="econ-modal__actions">
              <button className="econ-btn econ-btn--ghost" onClick={closeForm}>Cancelar</button>
              <button
                className="econ-btn econ-btn--primary"
                disabled={!canSubmit}
                onClick={() => void submitForm()}
              >
                {submitting ? 'Publicando…' : 'Publicar nova versão (draft)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
