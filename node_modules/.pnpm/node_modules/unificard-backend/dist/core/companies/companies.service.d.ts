import type { Company, CompanyUser, CreateCompanyInput, UpdateCompanyInput, UpdateCompanyUserInput, RevenueFederalData } from './companies.types';
declare class CompaniesService {
    /**
     * Busca dados do CNPJ na Receita Federal (API pública)
     * 🔴 NUNCA lança erro bloqueante - sempre retorna null em caso de falha
     */
    fetchCNPJFromRevenue(cnpj: string): Promise<RevenueFederalData | null>;
    /**
     * Valida CNPJ - APENAS formato básico (14 dígitos)
     * 🔴 NÃO valida dígitos verificadores - permite cadastro mesmo com CNPJ não validado
     */
    validateCNPJFormat(cnpj: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * Valida CNPJ completo (com dígitos verificadores) - usado apenas para validação final
     */
    validateCNPJ(cnpj: string): {
        valid: boolean;
        error?: string;
    };
    /**
     * Formata CNPJ (XX.XXX.XXX/XXXX-XX)
     */
    formatCNPJ(cnpj: string): string;
    /**
     * Cria uma nova empresa
     * 🔴 SEMPRE salva, mesmo sem dados da Receita Federal
     */
    createCompany(globalUserId: string, input: CreateCompanyInput): Promise<{
        company: Company;
        companyUser: CompanyUser;
    }>;
    /**
     * Busca empresa por ID
     */
    getCompanyById(companyId: string, globalUserId: string): Promise<Company | null>;
    /**
     * Lista todas as empresas do usuário
     */
    listCompanies(globalUserId: string): Promise<Array<Company & {
        userRole: CompanyUser;
    }>>;
    /**
     * Atualiza empresa
     * 🔴 Bloqueia edição de CNPJ se company_status = 'validated'
     */
    updateCompany(companyId: string, globalUserId: string, input: UpdateCompanyInput): Promise<Company>;
    /**
     * Busca relacionamento usuário-empresa por ID
     */
    getCompanyUserById(companyUserId: string, globalUserId: string): Promise<CompanyUser | null>;
    /**
     * Atualiza relacionamento usuário-empresa
     */
    updateCompanyUser(companyUserId: string, globalUserId: string, input: UpdateCompanyUserInput): Promise<CompanyUser>;
    /**
     * Remove empresa (soft delete)
     * 🔴 PROTEÇÃO: Não permite excluir se houver documento ou transação associada
     */
    deleteCompany(companyId: string, globalUserId: string): Promise<boolean>;
    /**
     * Upload documento da empresa (PDF)
     * 🔴 SEGURANÇA: Valida MIME type + extensão, renomeia com UUID, registra auditoria
     */
    uploadCompanyDocument(companyId: string, globalUserId: string, file: {
        filename: string;
        filepath: string;
        mimetype: string;
        size: number;
    }, documentType?: string, userIp?: string): Promise<{
        documentId: string;
        companyStatus: string;
    }>;
    /**
     * Lista documentos da empresa
     */
    listCompanyDocuments(companyId: string, globalUserId: string): Promise<Array<{
        documentId: string;
        documentType: string;
        fileName: string;
        filePath: string;
        fileSize: number;
        mimeType: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>>;
    /**
     * Lista documentos pendentes (ADMIN - todos os documentos pendentes)
     */
    listPendingDocuments(): Promise<Array<{
        documentId: string;
        companyId: string;
        globalUserId: string;
        companyName: string;
        companyCnpj: string;
        documentType: string;
        fileName: string;
        filePath: string;
        fileSize: number;
        mimeType: string;
        status: string;
        createdAt: Date;
        updatedAt: Date;
    }>>;
    /**
     * Aprova ou rejeita documento (ADMIN)
     */
    updateDocumentStatus(documentId: string, status: 'approved' | 'rejected', rejectedReason?: string, adminUserId?: string): Promise<{
        documentId: string;
        companyStatus: string;
    }>;
}
export declare const companiesService: CompaniesService;
export {};
//# sourceMappingURL=companies.service.d.ts.map