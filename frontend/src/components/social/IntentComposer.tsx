// src/components/social/IntentComposer.tsx
// Composer inteligente: texto livre → classificação automática → preview → publicar
// Camada sobre PostComposer existente (modo manual como escape)

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import PostComposer from './PostComposer';
import './ActorContextInfo.css';
import OccupancyModelConfig from './OccupancyModelConfig';
import { classifyPostIntent, type OccupancyType } from '../../utils/intent-classifier';
import {
  analyzeIntent,
  continueConversation,
  executeAction,
  type AnalyzeIntentResponse,
  type ActorContext as APIActorContext,
} from '../../api/intent-orchestrator';
import './IntentComposer.css';

interface IntentComposerProps {
  onSubmit: (
    content: string,
    mediaIds: string[],
    actorId: string | null,
    intent?: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event',
    intentMetadata?: Record<string, any>,
    targeting?: Record<string, any>,
    cta?: {
      type: 'booking' | 'service' | 'payment';
      target_actor_id?: string;
      target_group_id?: string;
      price?: number;
      currency?: string;
    }
  ) => Promise<void>;
  placeholder?: string;
}

interface ClassifiedIntent {
  intent: 'personal' | 'friends' | 'booking' | 'service_offer' | 'product_offer' | 'project' | 'vote' | 'event';
  eventSubtype?: 'SHOW' | 'CINEMA' | 'ESPORTE' | 'BAR' | 'RESTAURANTE' | 'FEIRA' | 'WORKSHOP' | 'EXPOSICAO' | 'FESTIVAL' | 'BALADA';
  audience?: 'public' | 'friends' | 'company' | 'group';
  dateTime?: string; // ISO string
  price?: number;
  ctaType?: 'booking' | 'service' | 'payment';
  occupancyModel?: {
    type: OccupancyType;
    confidence: number;
    reasoning: string;
    requiresReservation?: boolean;
    reservationPrice?: number;
  };
  confidence: number;
}

export default function IntentComposer({ onSubmit, placeholder = 'Diga o que você quer que aconteça...' }: IntentComposerProps) {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [mode, setMode] = useState<'intent' | 'manual' | 'preview'>('intent'); // intent = modo inteligente, manual = PostComposer, preview = revisão
  const [textInput, setTextInput] = useState('');
  const [isClassifying, setIsClassifying] = useState(false);
  const [classifiedIntent, setClassifiedIntent] = useState<ClassifiedIntent | null>(null);
  const [previewData, setPreviewData] = useState<{
    content: string;
    intent: string;
    metadata: Record<string, any>;
    cta?: any;
    occupancyModel?: {
      type: OccupancyType;
      requiresReservation: boolean;
      reservationPrice?: number;
      config?: any;
    };
  } | null>(null);
  const [showOccupancyConfig, setShowOccupancyConfig] = useState(false);
  
  // Estados de conversação com backend
  const [useBackendAI] = useState(true); // Feature flag: usar backend ou local
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [backendAnalysis, setBackendAnalysis] = useState<AnalyzeIntentResponse | null>(null);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userResponse, setUserResponse] = useState('');
  
  // Estados de voz (reutilizando padrão das outras abas)
  const [isRecording, setIsRecording] = useState(false);
  const [_userPlan, setUserPlan] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [recognition, setRecognition] = useState<any | null>(null);
  const textInputRef = useRef<string>('');

  // Carregar features do usuário e inicializar Web Speech API
  useEffect(() => {
    // Carregar features do usuário (versão paga)
    (async () => {
      try {
        const { getUserPlan, getUserFeatures } = await import('../../config/features');
        const plan = await getUserPlan();
        const features = await getUserFeatures();
        setUserPlan(plan);
        setAiAssistEnabled(features.aiAssistEnabled);
      } catch (err) {
        console.error('Erro ao carregar features do usuário:', err);
        // Em caso de erro, assumir free (mais restritivo)
        setUserPlan('free');
        setAiAssistEnabled(false);
      }
    })();
    
    // FEATURE FLAG: Inicializar Web Speech API apenas se feature habilitada (versão paga)
    if (aiAssistEnabled && typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      const recognitionInstance = new SpeechRecognition();
      recognitionInstance.continuous = false;
      recognitionInstance.interimResults = false;
      recognitionInstance.lang = 'pt-BR';
      
      recognitionInstance.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTextInput(transcript);
        textInputRef.current = transcript;
        // A classificação será disparada automaticamente quando textInput mudar
      };
      
      recognitionInstance.onerror = (event: any) => {
        console.error('Erro no reconhecimento de voz:', event.error);
        setIsRecording(false);
      };
      
      recognitionInstance.onend = () => {
        setIsRecording(false);
      };
      
      setRecognition(recognitionInstance);
    } else {
      // Se feature não habilitada, não inicializar
      setRecognition(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiAssistEnabled]); // Recriar quando feature flag mudar

  // Classificar quando texto muda (debounce) - usar backend ou local
  useEffect(() => {
    if (mode !== 'intent' || !textInput.trim()) {
      setClassifiedIntent(null);
      setBackendAnalysis(null);
      return;
    }

    const timer = setTimeout(() => {
      if (useBackendAI && activeActor?.actor_id) {
        analyzeWithBackend(textInput);
      } else {
        classifyText(textInput);
      }
    }, 800); // Debounce de 800ms

    return () => clearTimeout(timer);
  }, [textInput, mode, useBackendAI, activeActor?.actor_id]);

  // Analisar com backend
  const analyzeWithBackend = async (text: string) => {
    if (!text.trim() || !activeActor?.actor_id) return;

    setIsAnalyzing(true);
    try {
      const actorContext: APIActorContext = {
        actorId: activeActor.actor_id,
        actorType: activeActor.actor_type,
        actorName: activeActor.display_name,
        isCompany: activeActor.actor_type === 'page',
        companyId: activeActor.actor_type === 'page' ? activeActor.actor_id : undefined,
      };

      const response = await analyzeIntent(
        text,
        actorContext,
        conversationHistory.map(m => ({ role: m.role, content: m.content }))
      );

      setBackendAnalysis(response);
      setAnalysisId(response.analysisId);
      
      // Adicionar mensagem do usuário ao histórico
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: text },
      ]);

      // Se houver mensagem do sistema, adicionar ao histórico
      if (response.nextMessage) {
        setConversationHistory(prev => [
          ...prev,
          { role: 'assistant', content: response.nextMessage || '' },
        ]);
      }
    } catch (err) {
      console.error('Erro ao analisar com backend:', err);
      // Fallback para classificação local
      classifyText(text);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Classificação local (fallback)
  const classifyText = async (text: string) => {
    if (!text.trim()) return;

    setIsClassifying(true);
    try {
      const result = await classifyPostIntent(text, activeActor?.actor_type || 'user');
      setClassifiedIntent(result);
    } catch (err) {
      console.error('Erro ao classificar intent:', err);
      setClassifiedIntent(null);
    } finally {
      setIsClassifying(false);
    }
  };

  // Responder pergunta do sistema
  const handleUserResponse = async () => {
    if (!userResponse.trim() || !analysisId || !activeActor?.actor_id) return;

    setIsAnalyzing(true);
    try {
      const actorContext: APIActorContext = {
        actorId: activeActor.actor_id,
        actorType: activeActor.actor_type,
        actorName: activeActor.display_name,
        isCompany: activeActor.actor_type === 'page',
        companyId: activeActor.actor_type === 'page' ? activeActor.actor_id : undefined,
      };

      const response = await continueConversation(
        analysisId,
        userResponse,
        actorContext
      );

      setBackendAnalysis({
        ...response,
        analysis: response.updatedAnalysis,
      });

      // Atualizar histórico
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: userResponse },
        { role: 'assistant', content: response.nextMessage },
      ]);

      setUserResponse('');

      // Se estiver pronto para criar, mostrar preview
      if (response.conversationState === 'ready_to_create' && response.updatedAnalysis.suggestedActions.length > 0) {
        preparePreviewFromBackend(response.updatedAnalysis);
      }
    } catch (err) {
      console.error('Erro ao continuar conversa:', err);
      alert('Erro ao processar resposta. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Preparar preview a partir da análise do backend
  const preparePreviewFromBackend = (analysis: AnalyzeIntentResponse['analysis']) => {
    const extracted = analysis.extractedData;
    
    setPreviewData({
      content: conversationHistory.filter(m => m.role === 'user').map(m => m.content).join(' '),
      intent: analysis.intentType,
      metadata: {
        event_subtype: extracted.eventSubtype,
        suggested_datetime: extracted.dateTime,
        occupancy_type: extracted.occupancyType,
        capacity: extracted.capacity,
        table_count: extracted.tableCount,
        seats_per_table: extracted.seatsPerTable,
        is_paid: extracted.isPaid,
        price: extracted.price,
        price_per_person: extracted.pricePerPerson,
        price_per_table: extracted.pricePerTable,
      },
      cta: extracted.ctaType && extracted.ctaPrice ? {
        type: extracted.ctaType,
        price: extracted.ctaPrice,
        currency: 'BRL',
      } : undefined,
      occupancyModel: extracted.occupancyType ? {
        type: extracted.occupancyType as OccupancyType,
        requiresReservation: extracted.isPaid || false,
        reservationPrice: extracted.pricePerPerson || extracted.pricePerTable || extracted.price,
      } : undefined,
    });

    setMode('preview');
  };

  // Executar ação automaticamente
  const handleExecuteAction = async () => {
    if (!analysisId || !backendAnalysis || !activeActor?.actor_id) return;

    // 🔴 REGRA: Se a ação for criar evento, redirecionar para Wizard
    const intentType = backendAnalysis.analysis.intentType;
    if (intentType === 'event') {
      const draftText = encodeURIComponent(
        conversationHistory.filter(m => m.role === 'user').map(m => m.content).join(' ')
      );
      navigate(`/events/new?draft=${draftText}&source=feed`);
      return;
    }

    const action = backendAnalysis.analysis.suggestedActions[0];
    if (!action || !action.canExecute) return;

    setIsAnalyzing(true);
    try {
      const actorContext: APIActorContext = {
        actorId: activeActor.actor_id,
        actorType: activeActor.actor_type,
        actorName: activeActor.display_name,
        isCompany: activeActor.actor_type === 'page',
        companyId: activeActor.actor_type === 'page' ? activeActor.actor_id : undefined,
      };

      const result = await executeAction(
        analysisId,
        action.action,
        actorContext
      );

      if (result.success) {
        // Criar post vinculado ao evento se necessário
        if (result.result?.eventId) {
          await onSubmit(
            conversationHistory.filter(m => m.role === 'user').map(m => m.content).join(' '),
            [],
            activeActor.actor_id,
            'event',
            {
              event_id: result.result.eventId,
              ...backendAnalysis.analysis.extractedData,
            },
            {},
            backendAnalysis.analysis.extractedData.ctaType ? {
              type: backendAnalysis.analysis.extractedData.ctaType as any,
              price: backendAnalysis.analysis.extractedData.ctaPrice,
              currency: 'BRL',
            } : undefined
          );
        }

        alert('✅ ' + (result.nextSteps?.[0] || 'Ação executada com sucesso!'));
        
        // Reset
        setTextInput('');
        setConversationHistory([]);
        setBackendAnalysis(null);
        setAnalysisId(null);
        setMode('intent');
      } else {
        alert('❌ Erro: ' + (result.error || 'Não foi possível executar a ação'));
      }
    } catch (err) {
      console.error('Erro ao executar ação:', err);
      alert('Erro ao executar ação. Tente novamente.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    if (!classifiedIntent || classifiedIntent.confidence < 0.5) {
      // Se confiança baixa, pedir confirmação ou ir para manual
      alert('Não consegui entender completamente. Deseja usar o modo manual?');
      setMode('manual');
      return;
    }

    // 🔴 REGRA: Eventos SEMPRE vão para o Wizard
    // O Feed é facilitador, não motor de criação
    if (classifiedIntent.intent === 'event') {
      // Passar texto como draft para pré-preencher título/descrição
      const draftText = encodeURIComponent(textInput.trim());
      navigate(`/events/new?draft=${draftText}&source=feed`);
      return;
    }

    // Preparar preview (apenas para posts que NÃO são eventos)
    const metadata: Record<string, any> = {};
    if (classifiedIntent.eventSubtype) {
      metadata.event_subtype = classifiedIntent.eventSubtype;
    }
    if (classifiedIntent.dateTime) {
      metadata.suggested_datetime = classifiedIntent.dateTime;
    }

    const cta = classifiedIntent.ctaType && classifiedIntent.price ? {
      type: classifiedIntent.ctaType,
      price: classifiedIntent.price,
      currency: 'BRL' as const,
    } : undefined;

    // occupancyModel não é usado para posts não-eventos
    const occupancyModel = undefined;

    setPreviewData({
      content: textInput,
      intent: classifiedIntent.intent,
      metadata,
      cta,
      occupancyModel,
    });

    setMode('preview');
  };

  const handlePreviewPublish = async () => {
    if (!previewData || !activeActor?.actor_id) return;

    // 🔴 REGRA: Eventos NUNCA são criados pelo IntentComposer
    // Se chegou aqui com intent 'event', redirecionar para Wizard
    if (previewData.intent === 'event') {
      const draftText = encodeURIComponent(previewData.content);
      navigate(`/events/new?draft=${draftText}&source=feed`);
      return;
    }

    try {
      // Incluir modelo de ocupação no metadata se for evento
      const metadata = { ...previewData.metadata };
      if (previewData.intent === 'event' && previewData.occupancyModel) {
        metadata.occupancy_model = {
          type: previewData.occupancyModel.type,
          requires_reservation: previewData.occupancyModel.requiresReservation,
          reservation_price: previewData.occupancyModel.reservationPrice,
          config: previewData.occupancyModel.config,
        };
      }

      await onSubmit(
        previewData.content,
        [],
        activeActor.actor_id, // Sempre usa activeActor
        previewData.intent as any,
        metadata,
        {},
        previewData.cta
      );

      // Reset
      setTextInput('');
      setClassifiedIntent(null);
      setPreviewData(null);
      setShowOccupancyConfig(false);
      setMode('intent');
    } catch (err) {
      console.error('Erro ao publicar:', err);
      alert('Erro ao publicar. Tente novamente.');
    }
  };

  const handlePreviewAdjust = () => {
    // Ir para modo manual com dados pré-preenchidos
    setMode('manual');
  };

  // Funções de gravação de voz
  const startRecording = () => {
    if (recognition && !isRecording) {
      try {
        recognition.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Erro ao iniciar gravação:', err);
        setIsRecording(false);
      }
    }
  };

  const stopRecording = () => {
    if (recognition && isRecording) {
      try {
        recognition.stop();
        setIsRecording(false);
      } catch (err) {
        console.error('Erro ao parar gravação:', err);
        setIsRecording(false);
      }
    }
  };

  // Modo Preview (obrigatório antes de publicar)
  if (mode === 'preview' && previewData) {
    return (
      <div className="intent-composer intent-composer-preview">
        <div className="preview-header">
          <h3>É isso mesmo?</h3>
          <p className="preview-subtitle">Revise antes de publicar</p>
        </div>

        <div className="preview-content">
          <div className="preview-section">
            <label>Conteúdo:</label>
            <div className="preview-text">{previewData.content}</div>
          </div>

          <div className="preview-section">
            <label>Tipo:</label>
            <div className="preview-badge">
              {previewData.intent === 'event' && previewData.metadata.event_subtype && (
                <span>🎉 Evento: {previewData.metadata.event_subtype}</span>
              )}
              {previewData.intent === 'booking' && <span>📅 Agendamento</span>}
              {previewData.intent === 'service_offer' && <span>💼 Oferta de Serviço</span>}
              {previewData.intent === 'product_offer' && <span>🛒 Venda de Produto</span>}
              {previewData.intent === 'personal' && <span>💬 Atualização Pessoal</span>}
              {previewData.intent === 'friends' && <span>👥 Para Amigos</span>}
            </div>
          </div>

          {previewData.metadata.suggested_datetime && (
            <div className="preview-section">
              <label>Data/Hora sugerida:</label>
              <div className="preview-text">
                {new Date(previewData.metadata.suggested_datetime).toLocaleString('pt-BR')}
              </div>
            </div>
          )}

          {previewData.cta && (
            <div className="preview-section">
              <label>Ação (CTA):</label>
              <div className="preview-badge">
                {previewData.cta.type === 'booking' && <span>📅 Agendar</span>}
                {previewData.cta.type === 'service' && <span>💼 Contratar</span>}
                {previewData.cta.type === 'payment' && (
                  <span>💳 Comprar - R$ {previewData.cta.price?.toFixed(2)}</span>
                )}
              </div>
            </div>
          )}

          {/* Modelo de Ocupação (se for evento) */}
          {previewData.intent === 'event' && (
            <div className="preview-section">
              <label>Como as pessoas participam:</label>
              {!showOccupancyConfig && previewData.occupancyModel ? (
                <div className="preview-occupancy-summary">
                  <div className="preview-badge">
                    {previewData.occupancyModel.type === 'TABLE' && <span>🪑 Por Mesa</span>}
                    {previewData.occupancyModel.type === 'PERSON' && <span>👥 Por Pessoa</span>}
                    {previewData.occupancyModel.type === 'SLOT' && <span>📅 Por Horário</span>}
                    {previewData.occupancyModel.type === 'HYBRID' && <span>🔄 Híbrido</span>}
                  </div>
                  {previewData.occupancyModel.requiresReservation && (
                    <div className="preview-occupancy-details">
                      <span>Reserva: {previewData.occupancyModel.reservationPrice ? `R$ ${previewData.occupancyModel.reservationPrice.toFixed(2)}` : 'Gratuita'}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowOccupancyConfig(true)}
                    className="btn-adjust-occupancy"
                  >
                    ✏️ Ajustar
                  </button>
                </div>
              ) : (
                <OccupancyModelConfig
                  suggestedModel={classifiedIntent?.occupancyModel ? {
                    type: classifiedIntent.occupancyModel.type,
                    confidence: classifiedIntent.occupancyModel.confidence,
                    reasoning: classifiedIntent.occupancyModel.reasoning,
                    requiresReservation: classifiedIntent.occupancyModel.requiresReservation,
                    reservationPrice: classifiedIntent.occupancyModel.reservationPrice,
                  } : undefined}
                  onConfirm={(model) => {
                    setPreviewData({
                      ...previewData,
                      occupancyModel: model,
                    });
                    setShowOccupancyConfig(false);
                  }}
                  onCancel={() => setShowOccupancyConfig(false)}
                />
              )}
            </div>
          )}
        </div>

        <div className="preview-actions">
          <button
            type="button"
            onClick={handlePreviewAdjust}
            className="btn-adjust"
          >
            ✏️ Ajustar
          </button>
          <button
            type="button"
            onClick={handlePreviewPublish}
            className="btn-publish"
          >
            ✅ Publicar
          </button>
        </div>
      </div>
    );
  }

  // Modo Manual (PostComposer completo)
  if (mode === 'manual') {
    return (
      <div className="intent-composer intent-composer-manual">
        <div className="manual-header">
          <button
            type="button"
            onClick={() => {
              setMode('intent');
              setTextInput('');
            }}
            className="btn-back-to-intent"
          >
            ← Voltar ao modo simples
          </button>
        </div>
        <PostComposer onSubmit={onSubmit} placeholder={placeholder} />
      </div>
    );
  }

  // Modo Intent (padrão - texto livre)
  return (
    <div id="intent-composer" className="intent-composer intent-composer-intent">
      {/* Contexto de Ator (informativo apenas) */}
      {activeActor && (
        <div className="actor-context-info">
          <div className="actor-context-display">
            {activeActor.avatar_url ? (
              <img 
                src={activeActor.avatar_url} 
                alt={activeActor.display_name} 
                className="actor-context-avatar"
              />
            ) : (
              <div className="actor-context-avatar-placeholder">
                {activeActor.actor_type === 'user' ? '👤' : activeActor.actor_type === 'page' ? '🏢' : '👥'}
              </div>
            )}
            <div className="actor-context-text">
              <span className="actor-context-label">Publicando como</span>
              <span className="actor-context-name">{activeActor.display_name}</span>
              {activeActor.actor_type === 'page' && activeActor.user_role && (
                <span className="actor-context-role">
                  {activeActor.user_role === 'owner' && '👑 Proprietário'}
                  {activeActor.user_role === 'director' && '💼 Diretor'}
                  {activeActor.user_role === 'manager' && '📋 Gerente'}
                  {activeActor.user_role === 'employee' && '👔 Funcionário'}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Histórico de conversa (se houver) */}
      {conversationHistory.length > 0 && (
        <div className="conversation-history">
          {conversationHistory.map((msg, idx) => (
            <div key={idx} className={`conversation-message ${msg.role}`}>
              <div className="message-content">{msg.content}</div>
            </div>
          ))}
        </div>
      )}

      {/*
        FIX (2026-07-04, achado de Clayton testando a Fatia 3): a caixa de texto livre NUNCA pode
        desaparecer enquanto o usuário digita. Antes, os painéis abaixo (collecting_info/
        ready_to_create) SUBSTITUÍAM a textarea assim que o backend respondia — se a análise
        (debounce 800ms) retornasse no meio da digitação, o resto do texto era perdido (foi
        escrever para uma caixa que já não existia mais). Agora os painéis são AUXILIARES,
        renderizados ACIMA da textarea (que segue §749 sempre montada em modo 'intent') — a
        sugestão da IA aparece, mas o usuário nunca perde o que estava escrevendo.
      */}
      {/* Modo: Coletando informações (perguntas) */}
      {backendAnalysis && backendAnalysis.conversationState === 'collecting_info' && (
        <div className="conversation-questions">
          <div className="assistant-message">
            <div className="message-content">{backendAnalysis.nextMessage}</div>
          </div>
          <div className="user-response-input">
            <input
              type="text"
              value={userResponse}
              onChange={(e) => setUserResponse(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleUserResponse();
                }
              }}
              placeholder="Digite sua resposta..."
              disabled={isAnalyzing}
              className="response-input"
            />
            <button
              type="button"
              onClick={handleUserResponse}
              disabled={!userResponse.trim() || isAnalyzing}
              className="btn-send-response"
            >
              {isAnalyzing ? '⏳' : '➤'}
            </button>
          </div>
        </div>
      )}

      {/* Modo: Pronto para criar */}
      {backendAnalysis && backendAnalysis.conversationState === 'ready_to_create' && (
        <div className="conversation-ready">
          <div className="assistant-message">
            <div className="message-content">
              {backendAnalysis.nextMessage || 'Perfeito! Posso criar isso para você.'}
            </div>
          </div>
          <div className="ready-actions">
            {backendAnalysis.analysis.suggestedActions.map((action) => (
              <button
                key={action.action}
                type="button"
                onClick={handleExecuteAction}
                disabled={isAnalyzing || !action.canExecute}
                className="btn-execute-action"
              >
                {isAnalyzing ? '⏳ Criando...' : `✅ ${action.actionLabel}`}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                preparePreviewFromBackend(backendAnalysis.analysis);
              }}
              className="btn-preview-first"
            >
              👁️ Ver Preview
            </button>
          </div>
        </div>
      )}

      {/* Campo de texto livre — SEMPRE montado em modo 'intent' (ver nota acima). Os painéis de
          conversa (collecting_info/ready_to_create) aparecem ACIMA, nunca no lugar dela. */}
      <div className="intent-input-wrapper">
        <div className="intent-textarea-container">
            <textarea
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                textInputRef.current = e.target.value;
              }}
              placeholder={placeholder}
              rows={4}
              className="intent-textarea"
              disabled={!activeActor?.actor_id || isAnalyzing}
            />
            {/* Botão de microfone */}
            <div className="intent-voice-actions">
              {/* FEATURE FLAG: Microfone apenas para usuários PRO/Enterprise */}
              {aiAssistEnabled && recognition && (
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`intent-mic-button ${isRecording ? 'recording' : ''}`}
                  title={isRecording ? 'Parar gravação' : 'Falar (Recurso PRO)'}
                  disabled={!activeActor?.actor_id || isAnalyzing}
                >
                  🎤
                </button>
              )}
              {!aiAssistEnabled && (
                <button
                  type="button"
                  className="intent-mic-button"
                  disabled
                  title="Recurso disponível apenas na versão PRO"
                  style={{ opacity: 0.5, cursor: 'not-allowed' }}
                >
                  🎤
                </button>
              )}
            </div>
        </div>

        {/* Indicador de classificação */}
        {(isClassifying || isAnalyzing) && (
          <div className="classifying-indicator">
            <span className="spinner"></span>
            <span>{isAnalyzing ? 'Analisando com IA...' : 'Analisando...'}</span>
          </div>
        )}

        {/* Preview de classificação local (fallback) */}
        {classifiedIntent && !isClassifying && !backendAnalysis && (
          <div className="classification-preview">
            <div className="classification-badge">
              {classifiedIntent.intent === 'event' && classifiedIntent.eventSubtype && (
                <span>🎉 Evento: {classifiedIntent.eventSubtype}</span>
              )}
              {classifiedIntent.intent === 'booking' && <span>📅 Agendamento</span>}
              {classifiedIntent.intent === 'service_offer' && <span>💼 Serviço</span>}
              {classifiedIntent.intent === 'product_offer' && <span>🛒 Produto</span>}
              {classifiedIntent.intent === 'personal' && <span>💬 Pessoal</span>}
              {classifiedIntent.confidence < 0.7 && (
                <span className="confidence-low"> (confiança baixa)</span>
              )}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="intent-actions">
          <button
            type="button"
            onClick={() => setMode('manual')}
            className="btn-manual-mode"
            title="Modo manual com todas as opções"
          >
            ⚙️ Modo Avançado
          </button>
          <button
            type="button"
            onClick={handleTextSubmit}
            disabled={!textInput.trim() || !activeActor?.actor_id || isClassifying || isAnalyzing}
            className="btn-continue"
          >
            {classifiedIntent && classifiedIntent.confidence >= 0.5 ? '✅ Continuar' : '📝 Continuar'}
          </button>
        </div>
      </div>
    </div>
  );
}

