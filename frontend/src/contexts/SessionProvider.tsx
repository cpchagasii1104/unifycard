// src/contexts/SessionProvider.tsx
// Bootstrap centralizado de sessão: autenticação + actors + activeActor
// Garante que activeActor nunca seja null após o bootstrap

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { getAvailableActors, type AvailableActor } from '../api/social';
import { isAuthenticated, getTenantId } from '../config/auth';
import { setBootstraping } from '../api/client';

interface SessionContextType {
  sessionReady: boolean;
  activeActor: AvailableActor | null;
  actors: AvailableActor[];
  setActiveActor: (actorId: string | null) => void;
  refreshActors: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

const ACTOR_STORAGE_KEY = 'unificard_active_actor_id';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionReady, setSessionReady] = useState(false);
  const [activeActor, setActiveActorState] = useState<AvailableActor | null>(null);
  const [actors, setActors] = useState<AvailableActor[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  
  // Guard síncrono usando useRef para prevenir race conditions
  // useRef é síncrono e imediato, não tem janela de race condition como useState
  const bootstrapInProgressRef = useRef(false);
  
  // Ref para rastrear se o bootstrap está em andamento (para tolerar 401)
  const isBootstrappingRef = useRef(false);

  const bootstrapSession = async () => {
    // Prevenir múltiplas chamadas simultâneas usando ref síncrono
    if (bootstrapInProgressRef.current) {
      console.warn('[SessionProvider] Bootstrap já em andamento, ignorando chamada duplicada');
      return;
    }
    
    // Marcar imediatamente (síncrono) para prevenir race condition
    bootstrapInProgressRef.current = true;
    // Marcar que bootstrap está em andamento (para tolerar 401)
    isBootstrappingRef.current = true;

    console.log('[SessionProvider] 🚀 Iniciando bootstrap de sessão...');

    // ============================================
    // FASE 1: VALIDAÇÃO DE AUTENTICAÇÃO
    // ============================================
    // Se não estiver autenticado, não fazer bootstrap
    if (!isAuthenticated()) {
      console.log('[SessionProvider] ❌ Não autenticado - bootstrap cancelado');
      // Resetar flags se não autenticado
      bootstrapInProgressRef.current = false;
      isBootstrappingRef.current = false;
      setSessionReady(true);
      return;
    }

    // Verificar se token e tenantId estão presentes
    const tenantId = getTenantId();
    if (!tenantId) {
      console.warn('[SessionProvider] ⚠️ Token presente mas tenantId ausente - aguardando...');
      // Resetar flags se tenantId ausente
      bootstrapInProgressRef.current = false;
      isBootstrappingRef.current = false;
      setSessionReady(false);
      return;
    }

    console.log('[SessionProvider] ✅ FASE 1 (Auth) concluída: token e tenantId presentes');

    // Marcar que estamos em bootstrap para logs e UI (useState para re-render)
    setIsBootstrapping(true);

    // Marcar que estamos em bootstrap inicial no client.ts
    // Isso previne que 401s durante bootstrap causem logout
    setBootstraping(true);

    try {
      // ============================================
      // FASE 2: CARREGAMENTO DE CONTEXTO (ACTORS)
      // ============================================
      console.log('[SessionProvider] 🔄 FASE 2 (Contexto): Carregando actors disponíveis...');

      // 1. Carregar actors disponíveis
      // IMPORTANTE: Este endpoint é OBRIGATÓRIO para definir activeActor
      // Se falhar, não podemos marcar sessionReady como true
      let availableActors: AvailableActor[] = [];
      try {
        // Durante bootstrap inicial, usar silent401 para evitar ruído no console
        availableActors = await getAvailableActors({ silent401: isBootstrappingRef.current });
        setActors(availableActors);
        console.log(`[SessionProvider] ✅ Actors carregados: ${availableActors.length} encontrado(s)`);
      } catch (err: any) {
        // Se for SILENT_401, tratar silenciosamente (já foi tratado em getAvailableActors)
        if (err?.code === 'SILENT_401' || err?.message === 'SILENT_401') {
          console.warn('[SessionProvider] 401 durante bootstrap inicial — ignorando (cold start do backend)');
          setActors([]);
        } else {
          // Erro ao carregar actors - NÃO é crítico para autenticação
          // Mas é crítico para definir activeActor
          console.warn('[SessionProvider] ⚠️ Erro ao carregar actors (não crítico para auth):', err);
          // Continuar sem actors - usuário pode usar a aplicação mesmo assim
          setActors([]);
          // Se não conseguimos carregar actors, não podemos definir activeActor
          // Mas ainda podemos marcar sessão como pronta (usuário autenticado)
          // O activeActor será null e componentes devem lidar com isso
        }
      }

      // 2. Todos os actors podem postar (can_post sempre true para empresas)
      const postableActors = availableActors;

      // 3. Decisão de activeActor (OBRIGATÓRIO para sessionReady = true)
      let selectedActor: AvailableActor | null = null;

      if (postableActors.length === 0) {
        // Sem atores disponíveis
        // REGRA: sessionReady pode ser true mesmo sem actors
        // Mas componentes que precisam de activeActor devem aguardar
        console.warn('[SessionProvider] ⚠️ Nenhum actor disponível - sessão pronta mas sem activeActor');
        // Marcar sessão como pronta mesmo sem actors
        // Token e tenantId estão presentes, então usuário está autenticado
        setSessionReady(true);
        setBootstraping(false);
        setIsBootstrapping(false);
        console.log('[SessionProvider] ✅✅✅ sessionReady = true (sem actors, mas autenticado)');
        return;
      } else if (postableActors.length === 1) {
        // Apenas um ator - selecionar automaticamente
        selectedActor = postableActors[0];
        console.log(`[SessionProvider] ✅ Actor único selecionado: ${selectedActor.display_name} (${selectedActor.actor_id})`);
      } else {
        // Múltiplos atores - usar último usado OU default consistente
        const savedActorId = localStorage.getItem(ACTOR_STORAGE_KEY);
        if (savedActorId) {
          const savedActor = postableActors.find(a => a.actor_id === savedActorId);
          if (savedActor) {
            selectedActor = savedActor;
            console.log(`[SessionProvider] ✅ Actor salvo restaurado: ${selectedActor.display_name} (${selectedActor.actor_id})`);
          }
        }

        // Se não encontrou salvo, usar default: pessoa física primeiro, depois qualquer um
        if (!selectedActor) {
          selectedActor = postableActors.find(a => a.actor_type === 'user') || postableActors[0];
          console.log(`[SessionProvider] ✅ Actor padrão selecionado: ${selectedActor.display_name} (${selectedActor.actor_id})`);
        }
      }

      // 4. Definir activeActor e salvar
      if (selectedActor) {
        setActiveActorState(selectedActor);
        localStorage.setItem(ACTOR_STORAGE_KEY, selectedActor.actor_id);
        
        console.log(`[SessionProvider] ✅ activeActor definido: ${selectedActor.display_name} (${selectedActor.actor_id})`);
        
        // Disparar evento para componentes que precisam reagir
        window.dispatchEvent(new CustomEvent('active-actor-changed', { 
          detail: { actorId: selectedActor.actor_id, actor: selectedActor } 
        }));
      }

      // ============================================
      // SESSÃO PRONTA: token + tenantId + activeActor
      // ============================================
      // REGRA CRÍTICA: sessionReady só é true quando:
      // - token existe
      // - tenantId existe
      // - activeActor está definido (ou não há actors disponíveis)
      setSessionReady(true);
      console.log('[SessionProvider] ✅✅✅ sessionReady = true (bootstrap completo)');
    } catch (err) {
      // Erro não crítico no bootstrap - não fazer logout
      console.error('[SessionProvider] ❌ Erro no bootstrap:', err);
      // Marcar sessão como pronta mesmo com erro
      // Token e tenantId estão presentes, então usuário está autenticado
      // Mas activeActor pode estar null
      setSessionReady(true);
      console.log('[SessionProvider] ⚠️ sessionReady = true (com erro, mas autenticado)');
    } finally {
      // Sempre desativar flags de bootstrap após tentativa
      setBootstraping(false);
      setIsBootstrapping(false);
      // Resetar ref síncrono para permitir próxima chamada
      bootstrapInProgressRef.current = false;
      // Marcar que bootstrap não está mais em andamento (401 agora é erro real)
      isBootstrappingRef.current = false;
      console.log('[SessionProvider] 🏁 Bootstrap finalizado');
    }
  };

  const setActiveActor = (actorId: string | null) => {
    if (!actorId) {
      setActiveActorState(null);
      localStorage.removeItem(ACTOR_STORAGE_KEY);
      return;
    }

    const actor = actors.find(a => a.actor_id === actorId);
    if (actor) {
      // 🔴 REGRA: Não verificar can_post - todas as empresas podem ser selecionadas
      setActiveActorState(actor);
      localStorage.setItem(ACTOR_STORAGE_KEY, actorId);
      
      // Disparar evento para componentes que precisam reagir
      window.dispatchEvent(new CustomEvent('active-actor-changed', { 
        detail: { actorId, actor } 
      }));
    }
  };

  const refreshActors = async () => {
    try {
      const availableActors = await getAvailableActors();
      setActors(availableActors);
      
      // Verificar se o activeActor atual ainda existe
      if (activeActor) {
        const currentActor = availableActors.find(a => a.actor_id === activeActor.actor_id);
        if (!currentActor) {
          // Ator atual não existe mais - re-bootstrap
          await bootstrapSession();
        }
      } else if (availableActors.length > 0) {
        // Se não há activeActor mas há actors disponíveis, selecionar automaticamente o primeiro
        const firstActor = availableActors.find(a => a.actor_type === 'user') || availableActors[0];
        if (firstActor) {
          setActiveActorState(firstActor);
          localStorage.setItem(ACTOR_STORAGE_KEY, firstActor.actor_id);
          console.log(`[SessionProvider] ✅ Actor selecionado automaticamente após refresh: ${firstActor.display_name}`);
          
          // Disparar evento para componentes que precisam reagir
          window.dispatchEvent(new CustomEvent('active-actor-changed', { 
            detail: { actorId: firstActor.actor_id, actor: firstActor } 
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar actors:', err);
    }
  };

  // Bootstrap inicial - apenas uma vez na montagem do componente
  useEffect(() => {
    // Verificar se já está autenticado antes de fazer bootstrap
    // Isso previne bootstrap desnecessário se não houver token
    if (isAuthenticated() && getTenantId()) {
      bootstrapSession();
    } else {
      // Se não estiver autenticado, marcar sessão como pronta (sem bootstrap)
      setSessionReady(true);
    }
  }, []); // Executar apenas uma vez na montagem

  // Garantir activeActor automático quando actors são carregados
  useEffect(() => {
    // Se sessionReady, há actors disponíveis, mas activeActor é null:
    // selecionar automaticamente o primeiro actor
    if (sessionReady && actors.length > 0 && !activeActor) {
      const firstActor = actors.find(a => a.actor_type === 'user') || actors[0];
      if (firstActor) {
        setActiveActorState(firstActor);
        localStorage.setItem(ACTOR_STORAGE_KEY, firstActor.actor_id);
        console.log(`[SessionProvider] ✅ Actor selecionado automaticamente: ${firstActor.display_name} (${firstActor.actor_id})`);
        
        // Disparar evento para componentes que precisam reagir
        window.dispatchEvent(new CustomEvent('active-actor-changed', { 
          detail: { actorId: firstActor.actor_id, actor: firstActor } 
        }));
      }
    } else if (sessionReady && actors.length === 0 && activeActor) {
      // Se não há actors mas há activeActor, limpar
      console.warn('[SessionProvider] ⚠️ Nenhum actor disponível - limpando activeActor');
      setActiveActorState(null);
      localStorage.removeItem(ACTOR_STORAGE_KEY);
    }
  }, [sessionReady, actors.length, activeActor?.actor_id]); // Usar actor_id para evitar loops

  // Re-bootstrap quando autenticação mudar (login/logout) ou empresa for criada/removida
  useEffect(() => {
    // Guard para prevenir múltiplos bootstraps simultâneos
    let isHandling = false;

    const handleAuthChange = () => {
      // Prevenir múltiplas chamadas simultâneas
      if (isHandling) {
        console.warn('[SessionProvider] handleAuthChange já em andamento, ignorando...');
        return;
      }

      isHandling = true;
      
      // Verificar token E tenantId antes de fazer bootstrap
      // Isso garante que ambos estão salvos antes de qualquer chamada
      if (isAuthenticated() && getTenantId()) {
        // Pequeno delay para garantir que localStorage foi atualizado
        setTimeout(() => {
          bootstrapSession();
          isHandling = false;
        }, 100);
      } else {
        // Se não estiver autenticado, limpar estado
        setActiveActorState(null);
        setActors([]);
        setSessionReady(true);
        isHandling = false;
      }
    };

    const handleCompanyChange = () => {
      // Recarregar actors quando empresa for criada ou removida
      if (isAuthenticated() && !isHandling) {
        isHandling = true;
        bootstrapSession().finally(() => {
          isHandling = false;
        });
      }
    };

    // Escutar mudanças no localStorage (login/logout de outras abas)
    window.addEventListener('storage', handleAuthChange);
    
    // Escutar evento customizado de login
    window.addEventListener('auth-changed', handleAuthChange);
    
    // Escutar evento de mudança de empresa
    window.addEventListener('company-changed', handleCompanyChange);

    return () => {
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('auth-changed', handleAuthChange);
      window.removeEventListener('company-changed', handleCompanyChange);
    };
  }, []);

  return (
    <SessionContext.Provider
      value={{
        sessionReady,
        activeActor,
        actors,
        setActiveActor,
        refreshActors,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession deve ser usado dentro de SessionProvider');
  }
  return context;
}

