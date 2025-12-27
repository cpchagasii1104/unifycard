// backend/src/core/ai/files/file-reader.service.ts
import * as fs from 'fs';
import * as path from 'path';

class FileReaderService {
  private allowedRoot: string;
  private maxFileChars: number;
  private blockedPaths: string[];

  constructor() {
    // Raiz permitida (default: raiz do projeto)
    this.allowedRoot = process.env.AI_ALLOWED_ROOT || path.resolve(process.cwd());
    this.maxFileChars = parseInt(process.env.AI_MAX_FILE_CHARS || '50000', 10);
    
    // Paths e extensões bloqueadas
    this.blockedPaths = [
      '.env',
      'node_modules',
      'dist',
      'build',
      'uploads',
      'logs',
      '.git',
      '.env.local',
      '.env.production',
      '.env.development',
    ];
  }

  // Normalizar e validar path
  private normalizePath(filePath: string): string {
    // Resolver path absoluto
    const resolvedPath = path.resolve(this.allowedRoot, filePath);
    
    // Garantir que está dentro da raiz permitida
    if (!resolvedPath.startsWith(path.resolve(this.allowedRoot))) {
      throw new Error('Path fora da raiz permitida');
    }

    return resolvedPath;
  }

  // Verificar se path está bloqueado
  private isBlocked(filePath: string): boolean {
    const normalized = filePath.toLowerCase();
    
    // Verificar se contém algum path bloqueado
    for (const blocked of this.blockedPaths) {
      if (normalized.includes(blocked.toLowerCase())) {
        return true;
      }
    }

    // Verificar extensão .env
    if (normalized.endsWith('.env') || normalized.includes('.env.')) {
      return true;
    }

    return false;
  }

  // Ler arquivo de forma segura
  readFile(filePath: string): { content: string; truncated: boolean } {
    try {
      // Normalizar path
      const normalizedPath = this.normalizePath(filePath);

      // Verificar se está bloqueado
      if (this.isBlocked(normalizedPath)) {
        throw new Error('Path bloqueado por segurança');
      }

      // Verificar se arquivo existe
      if (!fs.existsSync(normalizedPath)) {
        throw new Error('Arquivo não encontrado');
      }

      // Verificar se é arquivo (não diretório)
      const stats = fs.statSync(normalizedPath);
      if (!stats.isFile()) {
        throw new Error('Path não é um arquivo');
      }

      // Ler conteúdo
      const content = fs.readFileSync(normalizedPath, 'utf-8');

      // Truncar se exceder limite
      let truncated = false;
      let finalContent = content;
      
      if (content.length > this.maxFileChars) {
        finalContent = content.substring(0, this.maxFileChars);
        truncated = true;
      }

      return {
        content: finalContent,
        truncated,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error('Arquivo não encontrado');
      }
      if (error.code === 'EACCES') {
        throw new Error('Sem permissão para ler arquivo');
      }
      throw error;
    }
  }
}

export const fileReaderService = new FileReaderService();


