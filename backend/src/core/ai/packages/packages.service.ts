// backend/src/core/ai/packages/packages.service.ts
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import type { PackageProposeResponse, PackageInstallResponse } from './packages.types';

class PackagesService {
  private timeoutMs: number;
  private maxLogChars: number;
  private repoRoot: string;

  constructor() {
    this.timeoutMs = parseInt(process.env.AI_PNPM_TIMEOUT_MS || '120000', 10);
    this.maxLogChars = parseInt(process.env.AI_MAX_INSTALL_LOG_CHARS || '5000', 10);
    this.repoRoot = process.env.AI_ALLOWED_ROOT || path.resolve(process.cwd());
  }

  // Validar nome do pacote (segurança)
  private validatePackageName(packageName: string): void {
    // Regex segura: permite @scope/name ou name
    // Bloqueia: espaços, ;, &, |, <, >, `, $, comandos
    const safePattern = /^(@[a-z0-9-]+\/)?[a-z0-9-]+$/i;
    
    if (!safePattern.test(packageName)) {
      throw new Error('Nome do pacote inválido ou contém caracteres perigosos');
    }

    // Bloquear nomes suspeitos
    const blocked = ['rm', 'rmdir', 'del', 'delete', 'exec', 'eval', 'spawn', 'system'];
    const lowerName = packageName.toLowerCase();
    for (const blockedName of blocked) {
      if (lowerName.includes(blockedName)) {
        throw new Error('Nome do pacote bloqueado por segurança');
      }
    }
  }

  // Validar versão (opcional)
  private validateVersion(version?: string): void {
    if (!version) return;

    // Versão deve ser alfanumérica com pontos, hífens, sem caracteres especiais
    const versionPattern = /^[a-z0-9.-]+$/i;
    if (!versionPattern.test(version)) {
      throw new Error('Versão inválida');
    }
  }

  // Obter caminho do workspace
  private getWorkspacePath(workspace: 'backend' | 'frontend'): string {
    const workspacePath = path.join(this.repoRoot, workspace);
    
    if (!fs.existsSync(workspacePath)) {
      throw new Error(`Workspace ${workspace} não encontrado`);
    }

    const packageJsonPath = path.join(workspacePath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`package.json não encontrado em ${workspace}`);
    }

    return workspacePath;
  }

  // Propor instalação
  proposeInstall(
    workspace: 'backend' | 'frontend',
    packageName: string,
    version?: string,
    reason?: string
  ): PackageProposeResponse {
    // Validar nome do pacote
    this.validatePackageName(packageName);
    this.validateVersion(version);

    // Construir comando proposto
    const packageSpec = version ? `${packageName}@${version}` : packageName;
    const proposedCommand = `pnpm add ${packageSpec} --ignore-scripts`;

    // Determinar risk_level
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    if (packageName.startsWith('@types/') || packageName.includes('-types')) {
      riskLevel = 'low';
    } else if (packageName.includes('test') || packageName.includes('spec')) {
      riskLevel = 'low';
    } else if (workspace === 'backend' && packageName.includes('express') || packageName.includes('fastify')) {
      riskLevel = 'high';
    }

    const summary = `Instalar ${packageName}${version ? ` versão ${version}` : ''} em ${workspace}. ${reason || ''}`;

    return {
      summary,
      proposedCommand,
      risk_level: riskLevel,
    };
  }

  // Instalar pacote
  async installPackage(
    workspace: 'backend' | 'frontend',
    packageName: string,
    version?: string
  ): Promise<PackageInstallResponse> {
    const startTime = Date.now();

    try {
      // Validar nome do pacote
      this.validatePackageName(packageName);
      this.validateVersion(version);

      // Obter caminho do workspace
      const workspacePath = this.getWorkspacePath(workspace);

      // Construir argumentos do pnpm (sem shell)
      const packageSpec = version ? `${packageName}@${version}` : packageName;
      const args: string[] = ['add', packageSpec, '--ignore-scripts'];

      console.info(`[PACKAGES] Iniciando instalação - workspace: ${workspace}, package: ${packageName}${version ? `@${version}` : ''}`);

      // Executar pnpm via spawn (sem shell)
      return new Promise<PackageInstallResponse>((resolve, reject) => {
        const child = spawn('pnpm', args, {
          cwd: workspacePath,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: false,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
          stderr += data.toString();
        });

        // Timeout
        const timeoutId = setTimeout(() => {
          child.kill();
          reject(new Error(`Timeout: instalação cancelada após ${this.timeoutMs}ms`));
        }, this.timeoutMs);

        child.on('close', (code) => {
          clearTimeout(timeoutId);

          const duration = Date.now() - startTime;

          if (code !== 0) {
            const errorMsg = stderr || stdout || 'Instalação falhou';
            console.error(`[PACKAGES] Falha após ${duration}ms - código: ${code}, erro: ${errorMsg}`);
            reject(new Error(`Instalação falhou: ${errorMsg.substring(0, 200)}`));
            return;
          }

          // Truncar log se necessário
          let stdoutTail = stdout;
          if (stdout.length > this.maxLogChars) {
            stdoutTail = '... (log truncado) ...\n' + stdout.substring(stdout.length - this.maxLogChars);
          }

          console.info(`[PACKAGES] Instalação concluída em ${duration}ms - package: ${packageName}`);

          resolve({
            success: true,
            message: `Pacote ${packageName}${version ? `@${version}` : ''} instalado com sucesso em ${workspace}`,
            stdoutTail,
            installedAt: new Date().toISOString(),
          });
        });

        child.on('error', (error) => {
          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          console.error(`[PACKAGES] Erro após ${duration}ms: ${error.message}`);
          reject(new Error(`Erro ao executar pnpm: ${error.message}`));
        });
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[PACKAGES] Erro após ${duration}ms: ${error.message}`);
      throw error;
    }
  }
}

export const packagesService = new PackagesService();

