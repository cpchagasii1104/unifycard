export declare function buildOccupationalClassificationPrompt(userInput: string, context: 'professional' | 'interest' | 'lifestyle' | 'education' | 'learning'): string;
export interface OccupationalClassificationResult {
    decision: 'approved' | 'rejected';
    confidence: number;
    reason: string;
    classification: {
        group: string | null;
        subgroup: string | null;
        item: string | null;
    };
}
//# sourceMappingURL=occupational-classification.prompt.d.ts.map