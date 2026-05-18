// frontend/src/components/company/tabs/CompanyInventoryTab.tsx
// PASSO 5 do trilho Codex — aba contextual de estoque no dashboard da empresa.
// Reusa MarketplaceInventory com prop actorId (drill-down loja).
// Princípios DECISION-0043: §3 (compositor, reusa serviço existente) + §8 (reorganiza superfície sem migrar soberania).

import { useSession } from '../../../contexts/SessionProvider';
import MarketplaceInventory from '../../marketplace/MarketplaceInventory';
import type { Company } from '../../../api/companies';
import './CompanyTabs.css';

interface CompanyInventoryTabProps {
  company: Company;
  companyId: string;
}

export default function CompanyInventoryTab({ company: _company, companyId }: CompanyInventoryTabProps) {
  const { actors } = useSession();

  // Resolve o actor da empresa: actor_type='page' com company_id batendo no companyId atual.
  // Backend já envia AvailableActor.company_id (cf. api/social.ts:38 + DECISION-0043 pending).
  const companyActor = actors.find(
    (a) => a.actor_type === 'page' && a.company_id === companyId
  );

  if (!companyActor) {
    return (
      <div className="company-tab-content" style={{ padding: '2rem', textAlign: 'center' }}>
        <p>
          Estoque por loja não disponível: actor da empresa não encontrado entre os actors
          disponíveis na sessão.
        </p>
        <p style={{ fontSize: '0.9em', color: '#666', marginTop: '0.5rem' }}>
          Para acessar o saldo desta unidade operacional, é necessário ter o actor 'page' da
          empresa entre os actors da sua sessão. Visão consolidada (matriz) continua disponível
          em <code>/marketplace?tab=inventory</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="company-tab-content">
      <MarketplaceInventory actorId={companyActor.actor_id} />
    </div>
  );
}
