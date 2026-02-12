// backend/tests/unit/bank-account.service.test.ts
// SPRINT 1: FUNDAÇÃO DO UNIFY BANK
// Testes unitários para BankAccountService

import { bankAccountService } from '../../src/modules/bank/bank-account.service';
import { bankAccountRepository } from '../../src/modules/bank/bank-account.repository';
import { bankLedgerRepository } from '../../src/modules/bank/bank-ledger.repository';
import { v4 as uuidv4 } from 'uuid';

// Mock dos repositories
jest.mock('../../src/modules/bank/bank-account.repository');
jest.mock('../../src/modules/bank/bank-ledger.repository');

describe('BankAccountService - Unit Tests', () => {
  const mockTenantId = uuidv4();
  const mockAccountId = uuidv4();
  const mockOwnerId = uuidv4();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAccountById', () => {
    it('should return account with balance calculated from ledger', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        ownerId: mockOwnerId,
        ownerType: 'user' as const,
        currency: 'BRL' as const,
        cachedBalance: 50,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBalance = {
        accountId: mockAccountId,
        balance: 100, // Diferente do cached
        totalCredits: 150,
        totalDebits: 50,
        entryCount: 5,
        lastEntryAt: new Date(),
      };

      (bankAccountRepository.getAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (bankLedgerRepository.calculateBalance as jest.Mock).mockResolvedValue(mockBalance);
      (bankAccountRepository.updateCachedBalance as jest.Mock).mockResolvedValue(undefined);

      const result = await bankAccountService.getAccountById(mockTenantId, mockAccountId);

      expect(result).toBeDefined();
      expect(result!.cachedBalance).toBe(100); // Atualizado do ledger
      expect(bankLedgerRepository.calculateBalance).toHaveBeenCalledWith(mockTenantId, mockAccountId);
      expect(bankAccountRepository.updateCachedBalance).toHaveBeenCalledWith(
        mockTenantId,
        mockAccountId,
        100
      );
    });

    it('should return null if account does not exist', async () => {
      (bankAccountRepository.getAccountById as jest.Mock).mockResolvedValue(null);

      const result = await bankAccountService.getAccountById(mockTenantId, mockAccountId);

      expect(result).toBeNull();
      expect(bankLedgerRepository.calculateBalance).not.toHaveBeenCalled();
    });
  });

  describe('getOrCreateAccount', () => {
    it('should return existing account if found', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        ownerId: mockOwnerId,
        ownerType: 'user' as const,
        currency: 'BRL' as const,
        cachedBalance: 0,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBalance = {
        accountId: mockAccountId,
        balance: 0,
        totalCredits: 0,
        totalDebits: 0,
        entryCount: 0,
        lastEntryAt: null,
      };

      (bankAccountRepository.getAccountByOwner as jest.Mock).mockResolvedValue(mockAccount);
      (bankLedgerRepository.calculateBalance as jest.Mock).mockResolvedValue(mockBalance);

      const result = await bankAccountService.getOrCreateAccount(mockTenantId, {
        ownerId: mockOwnerId,
        ownerType: 'user',
        currency: 'BRL',
      });

      expect(result).toEqual(mockAccount);
      expect(bankAccountRepository.createAccount).not.toHaveBeenCalled();
    });

    it('should create new account if not found', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        ownerId: mockOwnerId,
        ownerType: 'user' as const,
        currency: 'BRL' as const,
        cachedBalance: 0,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (bankAccountRepository.getAccountByOwner as jest.Mock).mockResolvedValue(null);
      (bankAccountRepository.createAccount as jest.Mock).mockResolvedValue(mockAccount);

      const result = await bankAccountService.getOrCreateAccount(mockTenantId, {
        ownerId: mockOwnerId,
        ownerType: 'user',
        currency: 'BRL',
      });

      expect(result).toEqual(mockAccount);
      expect(bankAccountRepository.createAccount).toHaveBeenCalledWith(mockTenantId, {
        ownerId: mockOwnerId,
        ownerType: 'user',
        currency: 'BRL',
      });
    });
  });

  describe('validateBalance', () => {
    it('should return isValid=true when balances match', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        ownerId: mockOwnerId,
        ownerType: 'user' as const,
        currency: 'BRL' as const,
        cachedBalance: 100,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBalance = {
        accountId: mockAccountId,
        balance: 100,
        totalCredits: 150,
        totalDebits: 50,
        entryCount: 3,
        lastEntryAt: new Date(),
      };

      (bankAccountRepository.getAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (bankLedgerRepository.calculateBalance as jest.Mock).mockResolvedValue(mockBalance);

      const result = await bankAccountService.validateBalance(mockTenantId, mockAccountId);

      expect(result.isValid).toBe(true);
      expect(result.difference).toBeLessThan(0.01);
    });

    it('should return isValid=false when balances differ', async () => {
      const mockAccount = {
        accountId: mockAccountId,
        tenantId: mockTenantId,
        ownerId: mockOwnerId,
        ownerType: 'user' as const,
        currency: 'BRL' as const,
        cachedBalance: 50,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockBalance = {
        accountId: mockAccountId,
        balance: 100,
        totalCredits: 150,
        totalDebits: 50,
        entryCount: 3,
        lastEntryAt: new Date(),
      };

      (bankAccountRepository.getAccountById as jest.Mock).mockResolvedValue(mockAccount);
      (bankLedgerRepository.calculateBalance as jest.Mock).mockResolvedValue(mockBalance);

      const result = await bankAccountService.validateBalance(mockTenantId, mockAccountId);

      expect(result.isValid).toBe(false);
      expect(result.difference).toBe(50);
    });
  });
});







