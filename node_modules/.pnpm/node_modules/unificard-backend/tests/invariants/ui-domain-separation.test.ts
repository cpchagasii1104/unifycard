// backend/tests/invariants/ui-domain-separation.test.ts
// GATE 4 — SEPARAÇÃO CANÔNICA UI × DOMÍNIO
// Teste estático que verifica se código backend referencia abas de perfil

import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GATE 4 — Separação Canônica UI × Domínio', () => {
  const backendSrcDir = path.join(__dirname, '../../src');
  const profileTabs = ['personal', 'professional', 'interests', 'learning', 'health', 'education', 'legal', 'agenda'];
  const violations: string[] = [];

  const scanDirectory = (dir: string): void => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Ignorar node_modules e dist
        if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '__tests__') {
          scanDirectory(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // Ignorar arquivos de teste
        if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          // Verificar se código backend referencia abas de perfil como domínios canônicos
          for (const tab of profileTabs) {
            // Padrões proibidos: uso de abas de perfil em lógica de domínio
            const patterns = [
              new RegExp(`['"]${tab}['"]\\s*[:=]`, 'i'), // Atribuição de aba
              new RegExp(`tab\\s*[=:]\\s*['"]${tab}['"]`, 'i'), // Atribuição de tab
              new RegExp(`activeTab\\s*[=:]\\s*['"]${tab}['"]`, 'i'), // Atribuição de activeTab
              new RegExp(`case\\s+['"]${tab}['"]`, 'i'), // Switch case com aba
              new RegExp(`if\\s*\\([^)]*['"]${tab}['"]`, 'i'), // If com aba
            ];

            for (const pattern of patterns) {
              if (pattern.test(content)) {
                violations.push(`${fullPath}: Referência a aba de perfil "${tab}" em código de domínio`);
                break;
              }
            }
          }
        }
      }
    }
  };

  it('deve não ter código backend que trate abas de perfil como domínios canônicos', () => {
    scanDirectory(backendSrcDir);

    if (violations.length > 0) {
      console.error('❌ Violações encontradas:');
      violations.forEach(v => console.error(`  ${v}`));
    }

    expect(violations.length).toBe(0);
  });
});

