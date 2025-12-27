// src/core/root-config/root-config.service.ts
import { RootConfigRepository } from './root-config.repository';
import { RootConfigModel } from './root-config.model';
import { worldService } from '../world/services/world.service';
import type { RootConfig, UpdateRootConfigInput } from './root-config.types';

class RootConfigService {
  private repository = new RootConfigRepository();

  /**
   * Busca a configuração-raiz atual
   */
  async getConfig(): Promise<RootConfig | null> {
    const row = await this.repository.find();
    return row ? RootConfigModel.fromRow(row) : null;
  }

  /**
   * Atualiza a configuração-raiz
   */
  async updateConfig(input: UpdateRootConfigInput): Promise<RootConfig> {
    // Validações de referências
    if (input.countryId) {
      const country = await worldService.getCountryById(input.countryId);
      if (!country) {
        throw new Error('País não encontrado');
      }
    }

    if (input.stateId) {
      const state = await worldService.getStateById(input.stateId);
      if (!state) {
        throw new Error('Estado não encontrado');
      }
      // Se stateId fornecido, garantir que countryId está correto
      if (input.countryId && state.countryId !== input.countryId) {
        throw new Error('Estado não pertence ao país especificado');
      }
    }

    if (input.cityId) {
      const city = await worldService.getCityById(input.cityId);
      if (!city) {
        throw new Error('Cidade não encontrada');
      }
      // Se cityId fornecido, garantir que stateId está correto
      if (input.stateId && city.stateId !== input.stateId) {
        throw new Error('Cidade não pertence ao estado especificado');
      }
      // Se não forneceu stateId mas forneceu cityId, buscar stateId da cidade
      if (!input.stateId) {
        input.stateId = city.stateId;
      }
    }

    const row = await this.repository.upsert(input);
    return RootConfigModel.fromRow(row);
  }

  /**
   * Define a região (país, estado, cidade)
   */
  async setRegion(countryId?: string | null, stateId?: string | null, cityId?: string | null): Promise<RootConfig> {
    const input: UpdateRootConfigInput = {
      countryId: countryId ?? null,
      stateId: stateId ?? null,
      cityId: cityId ?? null,
    };

    return this.updateConfig(input);
  }

  /**
   * Define o timezone
   */
  async setTimezone(timezone: string): Promise<RootConfig> {
    return this.updateConfig({ timezone });
  }

  /**
   * Define a moeda
   */
  async setCurrency(currency: string): Promise<RootConfig> {
    return this.updateConfig({ currency });
  }

  /**
   * Define os idiomas
   */
  async setLanguages(languages: string[]): Promise<RootConfig> {
    return this.updateConfig({ languages });
  }
}

export const rootConfigService = new RootConfigService();

