import { z } from 'zod';
export declare const analyzeTextSchema: z.ZodObject<{
    text: z.ZodString;
    audioUrl: z.ZodOptional<z.ZodString>;
    context: z.ZodOptional<z.ZodObject<{
        location: z.ZodOptional<z.ZodObject<{
            latitude: z.ZodNumber;
            longitude: z.ZodNumber;
            cityId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            latitude: number;
            longitude: number;
            cityId?: string | undefined;
        }, {
            latitude: number;
            longitude: number;
            cityId?: string | undefined;
        }>>;
        previousIntent: z.ZodOptional<z.ZodEnum<["hire_service", "buy_product", "request_ride", "book_event", "schedule_service", "order_food", "delivery_pickup", "search_local", "post_content", "ask_question", "support"]>>;
        userId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        location?: {
            latitude: number;
            longitude: number;
            cityId?: string | undefined;
        } | undefined;
        userId?: string | undefined;
        previousIntent?: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support" | undefined;
    }, {
        location?: {
            latitude: number;
            longitude: number;
            cityId?: string | undefined;
        } | undefined;
        userId?: string | undefined;
        previousIntent?: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support" | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    text: string;
    context?: {
        location?: {
            latitude: number;
            longitude: number;
            cityId?: string | undefined;
        } | undefined;
        userId?: string | undefined;
        previousIntent?: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support" | undefined;
    } | undefined;
    audioUrl?: string | undefined;
}, {
    text: string;
    context?: {
        location?: {
            latitude: number;
            longitude: number;
            cityId?: string | undefined;
        } | undefined;
        userId?: string | undefined;
        previousIntent?: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support" | undefined;
    } | undefined;
    audioUrl?: string | undefined;
}>;
export declare const executeIntentSchema: z.ZodObject<{
    intent: z.ZodEnum<["hire_service", "buy_product", "request_ride", "book_event", "schedule_service", "order_food", "delivery_pickup", "search_local", "post_content", "ask_question", "support"]>;
    parameters: z.ZodRecord<z.ZodString, z.ZodAny>;
    targetModule: z.ZodOptional<z.ZodEnum<["work", "events", "rides", "marketplace", "commerce", "delivery", "identity", "categories", "orchestrator"]>>;
    userId: z.ZodString;
    tenantId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    userId: string;
    intent: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support";
    parameters: Record<string, any>;
    targetModule?: "work" | "rides" | "events" | "commerce" | "identity" | "categories" | "marketplace" | "delivery" | "orchestrator" | undefined;
}, {
    tenantId: string;
    userId: string;
    intent: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support";
    parameters: Record<string, any>;
    targetModule?: "work" | "rides" | "events" | "commerce" | "identity" | "categories" | "marketplace" | "delivery" | "orchestrator" | undefined;
}>;
export declare const intentAnalysisSchema: z.ZodObject<{
    intent: z.ZodEnum<["hire_service", "buy_product", "request_ride", "book_event", "schedule_service", "order_food", "delivery_pickup", "search_local", "post_content", "ask_question", "support"]>;
    confidence: z.ZodNumber;
    parameters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    reasoning: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    intent: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support";
    confidence: number;
    parameters?: Record<string, any> | undefined;
    reasoning?: string | undefined;
}, {
    intent: "schedule_service" | "order_food" | "request_ride" | "buy_product" | "book_event" | "hire_service" | "delivery_pickup" | "search_local" | "post_content" | "ask_question" | "support";
    confidence: number;
    parameters?: Record<string, any> | undefined;
    reasoning?: string | undefined;
}>;
export declare const categoryMatchSchema: z.ZodObject<{
    categoryId: z.ZodString;
    categoryName: z.ZodString;
    categoryPath: z.ZodArray<z.ZodString, "many">;
    relevance: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    categoryId: string;
    categoryName: string;
    categoryPath: string[];
    relevance: number;
}, {
    categoryId: string;
    categoryName: string;
    categoryPath: string[];
    relevance: number;
}>;
export declare const suggestedActionSchema: z.ZodObject<{
    action: z.ZodString;
    module: z.ZodEnum<["work", "events", "rides", "marketplace", "commerce", "delivery", "identity", "categories", "orchestrator"]>;
    endpoint: z.ZodOptional<z.ZodString>;
    payload: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
    description: z.ZodString;
}, "strip", z.ZodTypeAny, {
    module: "work" | "rides" | "events" | "commerce" | "identity" | "categories" | "marketplace" | "delivery" | "orchestrator";
    description: string;
    action: string;
    payload?: Record<string, any> | undefined;
    endpoint?: string | undefined;
}, {
    module: "work" | "rides" | "events" | "commerce" | "identity" | "categories" | "marketplace" | "delivery" | "orchestrator";
    description: string;
    action: string;
    payload?: Record<string, any> | undefined;
    endpoint?: string | undefined;
}>;
export declare const flowStepSchema: z.ZodObject<{
    step: z.ZodNumber;
    module: z.ZodEnum<["work", "events", "rides", "marketplace", "commerce", "delivery", "identity", "categories", "orchestrator"]>;
    action: z.ZodString;
    description: z.ZodString;
    required: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    module: "work" | "rides" | "events" | "commerce" | "identity" | "categories" | "marketplace" | "delivery" | "orchestrator";
    description: string;
    action: string;
    step: number;
    required?: boolean | undefined;
}, {
    module: "work" | "rides" | "events" | "commerce" | "identity" | "categories" | "marketplace" | "delivery" | "orchestrator";
    description: string;
    action: string;
    step: number;
    required?: boolean | undefined;
}>;
//# sourceMappingURL=orchestrator.schemas.d.ts.map