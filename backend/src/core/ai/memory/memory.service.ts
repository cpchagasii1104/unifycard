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
  } catch (err) {
    // 🔴 AQUI SE PERDIA O HISTÓRICO INTEIRO, EM SILÊNCIO (corrigido 2026-08-05).
    //
    // O `existsSync` acima já trata "arquivo não existe" — devolver `[]` ali é correto. Logo este
    // `catch` só pega **arquivo CORROMPIDO**, e devolver `[]` aqui não significava "sem histórico":
    // significava "esqueci o histórico". A cadeia completa:
    //   loadMemory() → [] (corrompido)  →  addMessage acrescenta  →  saveMemory faz
    //   `writeFileSync` do array INTEIRO  →  o arquivo corrompido é SOBRESCRITO por uma mensagem.
    // Uma única leitura com falha apagava tudo. Sem erro, sem log, sem chance de recuperar.
    // Alcance real: `ai.routes.ts` chama `addMessage`/`getHistory` — não é caminho morto.
    //
    // Conserto que não escolhe entre dado e funcionalidade: PRESERVA o arquivo corrompido com
    // carimbo de tempo e segue com `[]`. O chat continua funcionando, o dado fica no disco para
    // quem quiser recuperar, e a falha vira VISÍVEL em vez de silenciosa.
    const carimbo = new Date().toISOString().replace(/[:.]/g, '-');
    const destino = `${MEMORY_FILE}.corrompido-${carimbo}`;
    try {
      fs.renameSync(MEMORY_FILE, destino);
      console.error(
        `[ai-memory] Arquivo de memória ILEGÍVEL. PRESERVADO em ${destino} — nada foi apagado. ` +
        `Seguindo com histórico vazio para não derrubar o chat. Erro: ` +
        `${err instanceof Error ? err.message : String(err)}`
      );
    } catch (errRename) {
      // Não conseguir preservar é PIOR que o problema original: a próxima gravação sobrescreve.
      // Aqui não há saída boa — então a falha PROPAGA, em vez de destruir o arquivo em silêncio.
      console.error(
        `[ai-memory] Arquivo ILEGÍVEL e NÃO foi possível preservá-lo (${String(errRename)}). ` +
        `Propagando o erro: continuar aqui sobrescreveria o arquivo original.`
      );
      throw err;
    }
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















