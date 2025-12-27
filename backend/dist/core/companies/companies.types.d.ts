import { CompanyStatus, CompanyUserRole } from '@unificard/contracts';
export interface Company {
    companyId: string;
    globalUserId: string;
    cnpj: string;
    companyName: string;
    tradeName?: string;
    registrationDate?: string;
    address: CompanyAddress;
    contact: CompanyContact;
    activity: CompanyActivity;
    revenueData?: Record<string, any>;
    status: 'active' | 'inactive' | 'suspended' | 'closed';
    companyStatus: CompanyStatus;
    isVerified: boolean;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface CompanyAddress {
    cep?: string;
    address?: string;
    addressNumber?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    country?: string;
}
export interface CompanyContact {
    phone?: string;
    email?: string;
    website?: string;
}
export interface CompanyActivity {
    mainActivityCode?: string;
    mainActivityDescription?: string;
    secondaryActivities?: Array<{
        code: string;
        description: string;
    }>;
}
export interface CompanyUser {
    companyUserId: string;
    companyId: string;
    globalUserId: string;
    role: CompanyUserRole;
    roleDescription?: string;
    permissions: CompanyPermissions;
    isActive: boolean;
    isPrimary: boolean;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface CompanyPermissions {
    canManageCompany: boolean;
    canManageFinancial: boolean;
    canManageEmployees: boolean;
    canViewReports: boolean;
    canManageServices: boolean;
}
export interface CreateCompanyInput {
    cnpj: string;
    companyName?: string;
    tradeName?: string;
    address?: Partial<CompanyAddress>;
    contact?: Partial<CompanyContact>;
    activity?: Partial<CompanyActivity>;
    role: CompanyUserRole;
    roleDescription?: string;
    permissions?: Partial<CompanyPermissions>;
    isPrimary?: boolean;
    fetchFromRevenue?: boolean;
}
export interface UpdateCompanyInput {
    cnpj?: string;
    companyName?: string;
    tradeName?: string;
    registrationDate?: string;
    address?: Partial<CompanyAddress>;
    contact?: Partial<CompanyContact>;
    activity?: Partial<CompanyActivity>;
    status?: 'active' | 'inactive' | 'suspended' | 'closed';
    companyStatus?: CompanyStatus;
    metadata?: Record<string, any>;
}
export interface UpdateCompanyUserInput {
    role?: CompanyUserRole;
    roleDescription?: string;
    permissions?: Partial<CompanyPermissions>;
    isActive?: boolean;
    isPrimary?: boolean;
}
export interface RevenueFederalData {
    cnpj: string;
    razao_social: string;
    nome_fantasia?: string;
    data_abertura?: string;
    situacao_cadastral?: string;
    tipo_logradouro?: string;
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    telefone?: string;
    email?: string;
    capital_social?: string;
    porte?: string;
    natureza_juridica?: string;
    atividade_principal?: Array<{
        code: string;
        text: string;
    }>;
    atividades_secundarias?: Array<{
        code: string;
        text: string;
    }>;
    qsa?: Array<{
        nome: string;
        qual: string;
        pais_origem?: string;
        nome_rep_legal?: string;
        qual_rep_legal?: string;
    }>;
}
//# sourceMappingURL=companies.types.d.ts.map