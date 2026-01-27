// frontend/src/components/company/tabs/CompanyActivitiesTab.tsx
// CONTINUOUS PRODUCTION: Aba Atividades - SPRINT 3
// Timeline Institucional unificada e auditável

import { useSession } from '../../../contexts/SessionProvider';
import TimelineInstitucional from '../../timeline/TimelineInstitucional';
import type { Company } from '../../../api/companies';
import './CompanyTabs.css';

interface CompanyActivitiesTabProps {
  company: Company;
  companyId: string;
}

export default function CompanyActivitiesTab({ company, companyId }: CompanyActivitiesTabProps) {
  const { activeActor } = useSession();

  // Usar actorId da empresa se disponível, senão usar activeActor
  const actorId = activeActor?.actor_id;

  return (
    <div className="company-tab-content">
      <div className="activities-header">
        <h3>Timeline Institucional</h3>
        <p className="activities-subtitle">
          Histórico cronológico de ações realizadas em nome desta empresa
        </p>
      </div>

      <TimelineInstitucional
        actorId={actorId}
        companyId={companyId}
        limit={50}
        showContext={true}
      />
    </div>
  );
}







