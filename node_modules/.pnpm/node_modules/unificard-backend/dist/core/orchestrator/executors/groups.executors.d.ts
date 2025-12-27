/**
 * Executores para eventos de grupos
 * Salva contexto no Memory e envia para AI Kernel
 */
export declare function handleGroupCreated(event: any): Promise<void>;
export declare function handleGroupMemberJoined(event: any): Promise<void>;
export declare function handleGroupMemberLeft(event: any): Promise<void>;
export declare function handleGroupFundReceived(event: any): Promise<void>;
export declare function registerGroupEventHandlers(): void;
//# sourceMappingURL=groups.executors.d.ts.map