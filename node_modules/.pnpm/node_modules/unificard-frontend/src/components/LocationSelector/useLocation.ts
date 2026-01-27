// src/components/LocationSelector/useLocation.ts
// Hook para gerenciar estado e carregamento de localização

import { useState, useEffect } from 'react';
import {
  getCountries,
  getStatesByCountry,
  getCitiesByState,
  getNeighborhoodsByCity,
} from '../../api/location';
import type { LocationScope, LocationValue, LocationData, LocationLoading } from './types';

export function useLocation(scope: LocationScope, initialValue: LocationValue) {
  const [data, setData] = useState<LocationData>({
    countries: [],
    states: [],
    cities: [],
    neighborhoods: [],
  });

  const [loading, setLoading] = useState<LocationLoading>({
    countries: true,
    states: false,
    cities: false,
    neighborhoods: false,
  });

  const [error, setError] = useState<string | null>(null);

  // Carregar países ao montar
  useEffect(() => {
    const loadCountries = async () => {
      setLoading((prev) => ({ ...prev, countries: true }));
      setError(null);
      try {
        const countries = await getCountries();
        if (countries.length === 0) {
          setError('Nenhum país encontrado. Por favor, recarregue a página.');
          console.error('[Location] Lista de países vazia');
        }
        setData((prev) => ({
          ...prev,
          countries: countries.map((c) => ({ id: c.id, name: c.name })),
        }));
      } catch (err) {
        console.error('Erro ao carregar países:', err);
        setError('Erro ao carregar países. Por favor, recarregue a página.');
      } finally {
        setLoading((prev) => ({ ...prev, countries: false }));
      }
    };

    loadCountries();
  }, []);

  // Carregar estados quando país mudar (apenas se scope não for 'national')
  useEffect(() => {
    if (scope === 'national' || !initialValue.country_id) {
      setData((prev) => ({ ...prev, states: [], cities: [], neighborhoods: [] }));
      setLoading((prev) => ({ ...prev, states: false, cities: false, neighborhoods: false }));
      return;
    }

    // 🔴 CORREÇÃO: Sempre resetar estados, cidades e bairros ao mudar país
    setData((prev) => ({ ...prev, states: [], cities: [], neighborhoods: [] }));

    const loadStates = async () => {
      setLoading((prev) => ({ ...prev, states: true }));
      setError(null);
      try {
        const states = await getStatesByCountry(initialValue.country_id!);
        setData((prev) => ({
          ...prev,
          states: states.map((s) => ({ id: s.id, name: s.name })),
          // Resetar cidades e bairros ao mudar país
          cities: [],
          neighborhoods: [],
        }));
      } catch (err) {
        console.error('Erro ao carregar estados:', err);
        setError('Erro ao carregar estados');
        // Em caso de erro, garantir que estados estejam vazios
        setData((prev) => ({ ...prev, states: [], cities: [], neighborhoods: [] }));
      } finally {
        setLoading((prev) => ({ ...prev, states: false }));
      }
    };

    loadStates();
  }, [initialValue.country_id, scope]);

  // Carregar cidades quando estado mudar
  useEffect(() => {
    // Se não precisar de cidade ou não tiver estado selecionado, limpar
    if (scope === 'national' || scope === 'state' || !initialValue.state_id) {
      setData((prev) => ({ ...prev, cities: [], neighborhoods: [] }));
      setLoading((prev) => ({ ...prev, cities: false, neighborhoods: false }));
      return;
    }

    // 🔴 CORREÇÃO: Sempre resetar cidades imediatamente ao mudar estado
    // Isso garante que cidades antigas não fiquem visíveis enquanto carrega
    setData((prev) => ({ ...prev, cities: [], neighborhoods: [] }));
    setLoading((prev) => ({ ...prev, cities: true, neighborhoods: false }));

    const loadCities = async () => {
      setError(null);
      try {
        const cities = await getCitiesByState(initialValue.state_id!);
        
        // 🔴 VALIDAÇÃO: Verificar se a cidade selecionada pertence ao estado atual
        // Se não pertencer, será resetada pelo componente pai via onChange
        const validCities = cities.map((c) => ({ id: c.id, name: c.name }));
        
        setData((prev) => ({
          ...prev,
          cities: validCities,
          // Resetar bairros ao mudar estado
          neighborhoods: [],
        }));
      } catch (err) {
        console.error('Erro ao carregar cidades:', err);
        setError('Erro ao carregar cidades');
        // Em caso de erro, garantir que cidades estejam vazias
        setData((prev) => ({ ...prev, cities: [], neighborhoods: [] }));
      } finally {
        setLoading((prev) => ({ ...prev, cities: false }));
      }
    };

    loadCities();
  }, [initialValue.state_id, scope]);

  // Carregar bairros quando cidade mudar
  useEffect(() => {
    if (scope !== 'neighborhood' || !initialValue.city_id) {
      setData((prev) => ({ ...prev, neighborhoods: [] }));
      return;
    }

    const loadNeighborhoods = async () => {
      setLoading((prev) => ({ ...prev, neighborhoods: true }));
      setError(null);
      try {
        const neighborhoods = await getNeighborhoodsByCity(initialValue.city_id!);
        setData((prev) => ({
          ...prev,
          neighborhoods: neighborhoods.map((n) => ({ id: n.id, name: n.name })),
        }));
      } catch (err) {
        console.error('Erro ao carregar bairros:', err);
        setError('Erro ao carregar bairros');
      } finally {
        setLoading((prev) => ({ ...prev, neighborhoods: false }));
      }
    };

    loadNeighborhoods();
  }, [initialValue.city_id, scope]);

  return {
    data,
    loading,
    error,
  };
}

