import type { FastifyInstance } from 'fastify';
import type { UserContext } from './assistant.types';
interface ProcessVoiceInput {
    audioFile: Buffer;
    mimeType: string;
    userContext: UserContext;
    sessionId?: string;
    targetGlobalUserId?: string;
    targetCompanyId?: string;
}
interface ProcessVoiceResult {
    text: string;
    transcription: string;
    response: any;
}
declare class VoiceChannel {
    /**
     * Processa áudio de voz
     *
     * Pipeline:
     * 1. Validar acesso (plan gate)
     * 2. Transcrever áudio para texto (stub inicial)
     * 3. Processar texto via assistant normal
     * 4. Retornar resposta
     */
    processVoice(fastify: FastifyInstance, input: ProcessVoiceInput): Promise<ProcessVoiceResult>;
    /**
     * Transcreve áudio para texto (STUB INICIAL)
     *
     * Por enquanto retorna texto fixo para validar o pipeline
     * TODO: Integrar com:
     * - OpenAI Whisper API
     * - Google Cloud Speech-to-Text
     * - Outro provider de transcrição
     */
    private transcribeAudio;
}
export declare const voiceChannel: VoiceChannel;
export {};
//# sourceMappingURL=voice.channel.d.ts.map