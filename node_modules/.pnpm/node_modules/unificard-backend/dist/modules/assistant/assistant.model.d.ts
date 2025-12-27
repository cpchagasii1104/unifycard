import type { AssistantMessage, AssistantSuggestedAction, AssistantConversation, AssistantChannel, AssistantTargetType } from './assistant.types';
import type { CareMessage, CareSession } from '../care/care.types';
import type { SocialAction } from '../social-actions/social-actions.types';
export declare class AssistantModel {
    /**
     * Converte CareMessage para AssistantMessage
     */
    static fromCareMessage(message: CareMessage): AssistantMessage;
    /**
     * Converte array de CareMessage para AssistantMessage[]
     */
    static fromCareMessages(messages: CareMessage[]): AssistantMessage[];
    /**
     * Converte SocialAction para AssistantSuggestedAction
     */
    static fromSocialAction(action: SocialAction): AssistantSuggestedAction;
    /**
     * Converte array de SocialAction para AssistantSuggestedAction[]
     */
    static fromSocialActions(actions: SocialAction[]): AssistantSuggestedAction[];
    /**
     * Monta AssistantConversation a partir de CareSession e mensagens
     */
    static buildConversation(session: CareSession, messages: CareMessage[], actions: SocialAction[], channel?: AssistantChannel, targetType?: AssistantTargetType): AssistantConversation;
}
//# sourceMappingURL=assistant.model.d.ts.map