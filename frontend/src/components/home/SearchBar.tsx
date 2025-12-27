// src/components/home/SearchBar.tsx
// Barra de busca com autocomplete - preparada para evolução com IA
// Usa APPS_REGISTRY como fonte única de verdade

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActiveActor } from '../../contexts/ActiveActorContext';
import { searchAppsByName, getAppsForContext, mapActorTypeToContext } from '../../config/appsRegistry';
import { detectIntent } from '../../utils/intentDetection';
import './SearchBar.css';

// Tipos para Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SearchSuggestion {
  id: string;
  label: string;
  route: string;
  type: 'app';
  icon: string;
}

export default function SearchBar() {
  const navigate = useNavigate();
  const { activeActor } = useActiveActor();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Gerar sugestões baseadas na query usando APPS_REGISTRY
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // Filtrar apps pelo contexto ativo
    const context = activeActor ? mapActorTypeToContext(activeActor.actor_type) : 'pf';
    const availableApps = getAppsForContext(context);
    
    // Buscar apps por nome
    const matchingApps = searchAppsByName(query);
    
    // Filtrar apenas apps disponíveis para o contexto atual
    const filteredApps = matchingApps.filter((app) =>
      availableApps.some((available) => available.id === app.id)
    );

    // Converter para SearchSuggestion
    const results: SearchSuggestion[] = filteredApps.map((app) => ({
      id: app.id,
      label: app.name,
      route: app.status === 'wip' ? `/em-desenvolvimento?feature=${app.id}` : app.route,
      type: 'app',
      icon: app.icon,
    }));

    // Ordenar alfabeticamente
    results.sort((a, b) => a.label.localeCompare(b.label));

    setSuggestions(results.slice(0, 8)); // Limitar a 8 sugestões
    setIsOpen(results.length > 0);
    setSelectedIndex(-1);
  }, [query, activeActor]);

  // Função helper para processar resultado do microfone
  const processVoiceResult = (transcript: string) => {
    const context = activeActor ? mapActorTypeToContext(activeActor.actor_type) : 'pf';
    const availableApps = getAppsForContext(context);
    const matchingApps = searchAppsByName(transcript);
    const filteredApps = matchingApps.filter((app) =>
      availableApps.some((available) => available.id === app.id)
    );
    
    if (filteredApps.length > 0) {
      // Navegar para primeiro match
      const app = filteredApps[0];
      const route = app.status === 'wip' 
        ? `/em-desenvolvimento?feature=${app.id}` 
        : app.route;
      navigate(route);
      setQuery('');
    } else {
      // Usar detecção de intenção
      const availableRoutes = availableApps.map(app => ({ 
        name: app.name, 
        route: app.status === 'wip' ? `/em-desenvolvimento?feature=${app.id}` : app.route 
      }));
      const intent = detectIntent(transcript.trim(), availableRoutes);
      
      if (intent.type === 'navigation' && intent.route) {
        navigate(intent.route);
      } else {
        navigate(`/search?q=${encodeURIComponent(transcript.trim())}`);
      }
      setQuery('');
    }
  };

  // Inicializar Web Speech API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'pt-BR';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          const transcript = event.results[0][0].transcript;
          setQuery(transcript);
          setIsListening(false);
          
          // Executar lógica de submit após reconhecer
          setTimeout(() => {
            processVoiceResult(transcript);
          }, 100);
        };

        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.warn('Erro no reconhecimento de voz:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [activeActor, navigate]);

  // Fechar sugestões ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleInputFocus = () => {
    if (suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    navigate(suggestion.route);
    setQuery('');
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      // Selecionar sugestão destacada
      handleSelectSuggestion(suggestions[selectedIndex]);
    } else if (suggestions.length > 0) {
      // Selecionar primeira sugestão
      handleSelectSuggestion(suggestions[0]);
    } else if (query.trim()) {
      // Usar detecção de intenção com apps disponíveis
      const context = activeActor ? mapActorTypeToContext(activeActor.actor_type) : 'pf';
      const availableApps = getAppsForContext(context);
      const availableRoutes = availableApps.map(app => ({ 
        name: app.name, 
        route: app.status === 'wip' ? `/em-desenvolvimento?feature=${app.id}` : app.route 
      }));
      const intent = detectIntent(query.trim(), availableRoutes);
      
      if (intent.type === 'navigation' && intent.route) {
        navigate(intent.route);
      } else {
        // Navegar para busca global
        navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      }
      
      setQuery('');
      setIsOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
      alert('Reconhecimento de voz não disponível no seu navegador.');
      return;
    }

    if (isListening) {
      // Parar escuta
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      // Iniciar escuta
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.warn('Erro ao iniciar reconhecimento de voz:', err);
        setIsListening(false);
      }
    }
  };

  return (
    <div className="search-bar-container">
      <form className="search-bar" onSubmit={handleSubmit}>
        <div className="search-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="Buscar aplicativo..."
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-label="Buscar aplicativo ou ação"
          />
          <button
            type="button"
            className={`search-mic-button ${isListening ? 'listening' : ''}`}
            onClick={handleMicClick}
            aria-label={isListening ? 'Parar escuta' : 'Iniciar busca por voz'}
            title={isListening ? 'Parar escuta' : 'Busca por voz'}
          >
            <span className="mic-icon">{isListening ? '🔴' : '🎤'}</span>
          </button>
        </div>
      </form>

      {isOpen && suggestions.length > 0 && (
        <div ref={suggestionsRef} className="search-suggestions">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              className={`search-suggestion-item ${
                index === selectedIndex ? 'selected' : ''
              }`}
              onClick={() => handleSelectSuggestion(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="suggestion-icon">
                {suggestion.icon || (suggestion.type === 'app' ? '📱' : '⚡')}
              </span>
              <span className="suggestion-label">{suggestion.label}</span>
              <span className="suggestion-type">
                {suggestion.type === 'app' ? 'App' : 'Ação'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

