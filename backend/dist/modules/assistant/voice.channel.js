"use strict";
// src/modules/assistant/voice.channel.ts
//
// Canal de voz para o assistant
// Recebe áudio, converte para texto (stub inicial), e processa via assistant normal
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceChannel = void 0;
const assistant_service_1 = require("./assistant.service");
const plan_gate_service_1 = require("@core/plan/plan-gate.service");
class VoiceChannel {
    /**
     * Processa áudio de voz
     *
     * Pipeline:
     * 1. Validar acesso (plan gate)
     * 2. Transcrever áudio para texto (stub inicial)
     * 3. Processar texto via assistant normal
     * 4. Retornar resposta
     */
    async processVoice(fastify, input) {
        const { audioFile, mimeType, userContext, sessionId, targetGlobalUserId, targetCompanyId } = input;
        // 1. Validar acesso via plan gate
        await plan_gate_service_1.planGateService.validateFeatureAccess(userContext.tenantId, userContext.globalUserId, 'voice');
        // 2. Transcrever áudio para texto (STUB INICIAL)
        // Por enquanto, retorna texto fixo
        // TODO: Integrar com Whisper/Google Speech-to-Text quando necessário
        const transcription = await this.transcribeAudio(audioFile, mimeType);
        // 3. Processar texto via assistant normal
        const messageInput = {
            text: transcription,
            channel: 'voice',
            sessionId,
            targetGlobalUserId,
            targetCompanyId,
        };
        const response = await assistant_service_1.assistantService.sendMessage(fastify, userContext, messageInput);
        return {
            text: response.lastMessage.content,
            transcription,
            response,
        };
    }
    /**
     * Transcreve áudio para texto (STUB INICIAL)
     *
     * Por enquanto retorna texto fixo para validar o pipeline
     * TODO: Integrar com:
     * - OpenAI Whisper API
     * - Google Cloud Speech-to-Text
     * - Outro provider de transcrição
     */
    async transcribeAudio(audioFile, mimeType) {
        // STUB: Retorna texto fixo para validar pipeline
        // Em produção, aqui seria a integração com o provider de transcrição
        console.log({
            audioSize: audioFile.length,
            mimeType,
            'assistant.channel': 'voice',
            'assistant.action': 'transcription_stub',
        }, 'Transcrição de áudio (stub)');
        return 'transcription_stub: Este é um texto de exemplo retornado pelo stub de transcrição. Em produção, este texto viria da transcrição real do áudio.';
    }
}
exports.voiceChannel = new VoiceChannel();
//# sourceMappingURL=voice.channel.js.map