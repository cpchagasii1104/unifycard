// backend/src/core/ai/memory/memory.service.ts
import * as fs from 'fs';
import * as path from 'path';
import type { ChatMessage, ChatHistory } from './memory.types';

const MEMORY_FILE = path.join(process.cwd(), 'backend', 'data', 'ai-memory.json');

// Garantir que o diretório existe
const ensureDataDir = () => {
  const dataDir = path.dirname(MEMORY_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
};

// Carregar memória do arquivo
const loadMemory = (): ChatHistory[] => {
  ensureDataDir();
  if (!fs.existsSync(MEMORY_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(MEMORY_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
};

// Salvar memória no arquivo
const saveMemory = (memory: ChatHistory[]) => {
  ensureDataDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf-8');
};

class MemoryService {
  // Adicionar mensagem ao histórico
  addMessage(userId: string, tenantId: string, mode: string, role: 'user' | 'assistant', content: string): void {
    const memory = loadMemory();
    const key = `${userId}-${tenantId}-${mode}`;
    
    let history = memory.find((h) => `${h.userId}-${h.tenantId}-${h.mode}` === key);
    
    if (!history) {
      history = {
        userId,
        tenantId,
        mode,
        messages: [],
      };
      memory.push(history);
    }
    
    history.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
    
    saveMemory(memory);
  }

  // Obter histórico do modo atual
  getHistory(userId: string, tenantId: string, mode: string): ChatMessage[] {
    const memory = loadMemory();
    const key = `${userId}-${tenantId}-${mode}`;
    
    const history = memory.find((h) => `${h.userId}-${h.tenantId}-${h.mode}` === key);
    return history?.messages || [];
  }

  // Limpar histórico (opcional)
  clearHistory(userId: string, tenantId: string, mode: string): void {
    const memory = loadMemory();
    const key = `${userId}-${tenantId}-${mode}`;
    
    const index = memory.findIndex((h) => `${h.userId}-${h.tenantId}-${h.mode}` === key);
    if (index !== -1) {
      memory.splice(index, 1);
      saveMemory(memory);
    }
  }
}

export const memoryService = new MemoryService();


