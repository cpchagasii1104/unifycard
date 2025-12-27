// src/core/world/services/world.service.ts
import { CountryRepository } from '../repositories/country.repository';
import { StateRepository } from '../repositories/state.repository';
import { CityRepository } from '../repositories/city.repository';
import { CountryModel } from '../models/country.model';
import { StateModel } from '../models/state.model';
import { CityModel } from '../models/city.model';
import type { Country, State, City, CityFullPath } from '../world.types';

class WorldService {
  private countryRepo = new CountryRepository();
  private stateRepo = new StateRepository();
  private cityRepo = new CityRepository();

  /**
   * Lista todos os países
   */
  async getCountries(): Promise<Country[]> {
    const rows = await this.countryRepo.findAll();
    return CountryModel.fromRows(rows);
  }

  /**
   * Busca país por ID
   */
  async getCountryById(countryId: string): Promise<Country | null> {
    const row = await this.countryRepo.findById(countryId);
    return row ? CountryModel.fromRow(row) : null;
  }

  /**
   * Busca país por código ISO
   */
  async getCountryByCode(code: string): Promise<Country | null> {
    const row = await this.countryRepo.findByCode(code);
    return row ? CountryModel.fromRow(row) : null;
  }

  /**
   * Lista todos os estados de um país
   */
  async getStatesByCountry(countryId: string): Promise<State[]> {
    const rows = await this.stateRepo.findByCountryId(countryId);
    return StateModel.fromRows(rows);
  }

  /**
   * Busca estado por ID
   */
  async getStateById(stateId: string): Promise<State | null> {
    const row = await this.stateRepo.findById(stateId);
    return row ? StateModel.fromRow(row) : null;
  }

  /**
   * Lista todas as cidades de um estado
   */
  async getCitiesByState(stateId: string): Promise<City[]> {
    const rows = await this.cityRepo.findByStateId(stateId);
    return CityModel.fromRows(rows);
  }

  /**
   * Busca cidade por ID
   */
  async getCityById(cityId: string): Promise<City | null> {
    const row = await this.cityRepo.findById(cityId);
    return row ? CityModel.fromRow(row) : null;
  }

  /**
   * Busca cidades por termo
   */
  async searchCities(
    term: string,
    options?: {
      countryId?: string;
      stateId?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<City[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const rows = await this.cityRepo.search(
      term,
      options?.countryId,
      options?.stateId,
      limit,
      offset
    );
    return CityModel.fromRows(rows);
  }

  /**
   * Busca caminho completo de uma cidade (cidade → estado → país)
   */
  async getCityFullPath(cityId: string): Promise<CityFullPath | null> {
    const city = await this.getCityById(cityId);
    if (!city) {
      return null;
    }

    const state = await this.getStateById(city.stateId);
    if (!state) {
      return null;
    }

    const country = await this.getCountryById(state.countryId);
    if (!country) {
      return null;
    }

    return {
      city: {
        cityId: city.cityId,
        name: city.name,
        nameEn: city.nameEn,
      },
      state: {
        stateId: state.stateId,
        name: state.name,
        nameEn: state.nameEn,
        code: state.code,
      },
      country: {
        countryId: country.countryId,
        name: country.name,
        nameEn: country.nameEn,
        code: country.code,
      },
    };
  }
}

export const worldService = new WorldService();

