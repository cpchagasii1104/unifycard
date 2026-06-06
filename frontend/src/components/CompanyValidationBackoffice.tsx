// frontend/src/components/CompanyValidationBackoffice.tsx
// F-PJ-KYB-DOCUMENTS-CANONICAL-FLOW (DECISION-0087): backoffice documental legado NEUTRALIZADO.
//
// Este backoffice lia `company_documents` (tabela FANTASMA — inexistente no schema vivo) via os endpoints
// legados `GET /companies/admin/documents/pending` e `PATCH /companies/admin/documents/:id/status`, agora
// tombstonados (501). Ele também carregava o anti-padrão "aprovar documento = empresa validada" (já vedado
// por DECISION-0089/0090: verificação PJ deriva só de fiscal_identities.kyb_status, com writer KYB auditado).
//
// O SSOT documental KYB é `fiscal_identity_documents` (DECISION-0087), com fluxo canônico ADMIN já vivo em
// `/identity/pj/kyb/*` (submit/list/review + gate de docs mínimos para aprovar KYB). A UI de revisão admin
// sobre o SSOT depende do PROVIDER DE STORAGE (download protegido do file_reference opaco) — fatia própria
// (DT-PJ-DOCUMENT-STORAGE-PROVIDER-MISSING). Até lá, esta tela apenas explica o estado canônico, sem
// chamar endpoints legados nem fingir revisão.

import './CompanyValidationBackoffice.css';

export default function CompanyValidationBackoffice() {
  return (
    <div className="validation-backoffice">
      <div className="backoffice-header">
        <h2>📋 Validação de Documentos (KYB)</h2>
      </div>

      <div className="empty-state">
        <p>
          O backoffice documental legado foi <strong>desativado</strong>. Ele operava sobre um substrato
          fantasma (<code>company_documents</code>), que não existe no banco.
        </p>
        <p>
          O substrato canônico de documentos KYB é <strong><code>fiscal_identity_documents</code></strong>{' '}
          (DECISION-0087), ancorado na identidade fiscal da empresa. O fluxo canônico de revisão (admin) já
          existe em <code>/identity/pj/kyb/*</code> (envio, listagem e aprovação/rejeição auditadas), e a
          aprovação de KYB exige documentos mínimos aceitos — aprovar um documento <em>não</em> verifica a
          empresa por si só.
        </p>
        <p>
          A interface de revisão sobre o SSOT depende do <strong>provider de storage</strong> (download
          protegido do documento), que é uma fatia própria ainda pendente. Esta tela será reconstruída sobre
          o fluxo canônico quando o storage estiver disponível.
        </p>
      </div>
    </div>
  );
}
