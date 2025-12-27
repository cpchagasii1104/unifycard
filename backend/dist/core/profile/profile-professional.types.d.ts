export type PricingType = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quote';
export type ServiceType = 'service' | 'product';
export interface PredefinedService {
    serviceId: string;
    name: string;
    description?: string;
    basePrice: number;
    discountPercentage?: number;
    finalPrice: number;
    isActive: boolean;
}
export interface ComboDiscountRule {
    ruleId: string;
    minServices: number;
    discountPercentage: number;
    description?: string;
    isActive: boolean;
}
export interface ProfessionalSkill {
    categoryId: string;
    categoryName: string;
    categoryPath: string[];
    skillLevel: number;
    yearsExperience: number;
    hourlyRate: number | null;
    pricingType: PricingType;
    serviceType: ServiceType;
    chargeVisit: boolean;
    visitPrice: number | null;
    predefinedServices?: PredefinedService[];
    comboDiscountRules?: ComboDiscountRule[];
    verified: boolean;
}
export interface EducationEntry {
    educationId: string;
    level: 'elementary' | 'high_school' | 'technical' | 'bachelor' | 'master' | 'phd' | 'other';
    institution: string;
    course?: string;
    field?: string;
    startDate?: string;
    endDate?: string;
    isCompleted: boolean;
    description?: string;
}
export interface ProfessionalProfile {
    globalUserId: string;
    skills: ProfessionalSkill[];
    education: EducationEntry[];
    bio: string | null;
    availability: AvailabilitySchedule | null;
}
export interface AvailabilitySchedule {
    [dayOfWeek: string]: string[];
}
export interface VacationPeriod {
    startDate: string;
    endDate: string;
    reason?: string;
}
export interface SpecificDateAvailability {
    date: string;
    timeSlots: string[];
}
export interface UpdateProfessionalProfileInput {
    skills?: Array<{
        categoryId: string;
        skillLevel?: number;
        yearsExperience?: number;
        hourlyRate?: number | null;
        pricingType?: PricingType;
        serviceType?: ServiceType;
        chargeVisit?: boolean;
        visitPrice?: number | null;
        predefinedServices?: Array<{
            serviceId?: string;
            name: string;
            description?: string;
            basePrice: number;
            discountPercentage?: number;
            isActive?: boolean;
        }>;
        comboDiscountRules?: Array<{
            ruleId?: string;
            minServices: number;
            discountPercentage: number;
            description?: string;
            isActive?: boolean;
        }>;
    }>;
    education?: Array<{
        educationId?: string;
        level: 'elementary' | 'high_school' | 'technical' | 'bachelor' | 'master' | 'phd' | 'other';
        institution: string;
        course?: string;
        field?: string;
        startDate?: string;
        endDate?: string | null;
        isCompleted: boolean;
        description?: string;
    }>;
    bio?: string | null;
    availability?: AvailabilitySchedule | null;
}
//# sourceMappingURL=profile-professional.types.d.ts.map