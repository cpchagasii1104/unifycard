interface EducationEntry {
    id: string;
    globalUserId: string;
    categoryId: string;
    categoryName: string;
    createdAt: Date;
    updatedAt: Date;
}
interface CompanyEntry {
    id: string;
    globalUserId: string;
    categoryId: string;
    categoryName: string;
    createdAt: Date;
    updatedAt: Date;
}
interface AddEducationInput {
    name: string;
}
interface AddCompanyInput {
    name: string;
}
declare class ProfileEducationCompaniesService {
    /**
     * Adiciona formação acadêmica ao perfil do usuário
     *
     * FLUXO OBRIGATÓRIO:
     * 1. Sanitizar input
     * 2. Rodar CategoryInputGateService.validate(context: 'education')
     * 3. Se DENY → retornar erro claro
     * 4. Se ALLOW → criar ou reutilizar categoria
     * 5. Criar vínculo com usuário
     * 6. Auditar decisão (via gate)
     */
    addEducation(tenantId: string, userId: string, input: AddEducationInput): Promise<EducationEntry>;
    /**
     * Adiciona empresa ao perfil do usuário
     *
     * FLUXO OBRIGATÓRIO:
     * 1. Sanitizar input
     * 2. Rodar CategoryInputGateService.validate(context: 'company')
     * 3. Se DENY → retornar erro claro
     * 4. Se ALLOW → criar ou reutilizar categoria
     * 5. Criar vínculo com usuário
     * 6. Auditar decisão (via gate)
     */
    addCompany(tenantId: string, userId: string, input: AddCompanyInput): Promise<CompanyEntry>;
    /**
     * Lista formações do usuário
     */
    listEducation(globalUserId: string): Promise<EducationEntry[]>;
    /**
     * Lista empresas do usuário
     */
    listCompanies(globalUserId: string): Promise<CompanyEntry[]>;
}
export declare const profileEducationCompaniesService: ProfileEducationCompaniesService;
export type { EducationEntry, CompanyEntry, AddEducationInput, AddCompanyInput };
//# sourceMappingURL=profile-education-companies.service.d.ts.map