// backend/src/core/ai/patch/patch.service.ts
import { fileReaderService } from '../files/file-reader.service';
import type { PatchProposalResponse } from './patch.types';

class PatchService {
  private maxDiffChars: number;

  constructor() {
    this.maxDiffChars = parseInt(process.env.AI_MAX_DIFF_CHARS || '100000', 10);
  }

  // Gerar diff no formato unified diff
  private generateUnifiedDiff(
    originalContent: string,
    newContent: string,
    filePath: string
  ): string {
    const lines = originalContent.split('\n');
    const newLines = newContent.split('\n');
    
    let diff = `--- a/${filePath}\n+++ b/${filePath}\n@@ -1,${lines.length} +1,${newLines.length} @@\n`;
    
    // Comparação simples linha por linha (mock)
    // Em produção, usar biblioteca de diff real
    const maxLen = Math.max(lines.length, newLines.length);
    
    for (let i = 0; i < maxLen; i++) {
      const oldLine = lines[i];
      const newLine = newLines[i];
      
      if (oldLine === undefined) {
        diff += `+${newLine}\n`;
      } else if (newLine === undefined) {
        diff += `-${oldLine}\n`;
      } else if (oldLine !== newLine) {
        diff += `-${oldLine}\n`;
        diff += `+${newLine}\n`;
      } else {
        diff += ` ${oldLine}\n`;
      }
    }
    
    return diff;
  }

  // Gerar patch baseado em instruções (mock - em produção usar LLM)
  private generatePatchedContent(originalContent: string, instructions: string): string {
    // Mock: adiciona comentário no início do arquivo
    // Em produção, isso seria gerado por um LLM
    const comment = `// Modificação sugerida: ${instructions}\n`;
    return comment + originalContent;
  }

  // Gerar proposta de patch
  async generatePatch(filePath: string, instructions: string): Promise<PatchProposalResponse> {
    try {
      // Ler arquivo original (com todas as validações de segurança)
      const fileResult = fileReaderService.readFile(filePath);
      const originalContent = fileResult.content;

      // Gerar conteúdo modificado (mock - em produção usar LLM)
      const newContent = this.generatePatchedContent(originalContent, instructions);

      // Gerar diff
      let diff = this.generateUnifiedDiff(originalContent, newContent, filePath);

      // Truncar diff se exceder limite
      let truncated = false;
      if (diff.length > this.maxDiffChars) {
        diff = diff.substring(0, this.maxDiffChars) + '\n... (diff truncado)';
        truncated = true;
      }

      // Determinar risk_level baseado no tipo de mudança
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (filePath.includes('.ts') || filePath.includes('.tsx')) {
        riskLevel = 'high';
      } else if (filePath.includes('.json') || filePath.includes('.md')) {
        riskLevel = 'low';
      } else {
        riskLevel = 'medium';
      }

      const summary = `Patch proposto para ${filePath}. ${truncated ? 'Diff truncado devido ao tamanho.' : ''}`;

      return {
        diff,
        summary,
        risk_level: riskLevel,
      };
    } catch (error: any) {
      throw new Error(`Erro ao gerar patch: ${error.message}`);
    }
  }
}

export const patchService = new PatchService();


