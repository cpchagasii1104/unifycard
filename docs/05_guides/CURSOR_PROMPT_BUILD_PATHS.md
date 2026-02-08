# 🔧 CORREÇÃO DE BUILD — Paths @core/* não resolvidos

## 📋 PROBLEMA

O TypeScript compila os arquivos mas **NÃO converte** os paths customizados (`@core/*`, `@modules/*`, etc.) para caminhos relativos.

Exemplo no `dist/server.js`:
```javascript
require("@core/auth/auth.plugin")  // ❌ Node.js não entende isso
```

Deveria ser:
```javascript
require("./core/auth/auth.plugin")  // ✅ Caminho relativo funciona
```

---

## 🎯 SOLUÇÃO: Usar `tsc-alias`

### Passo 1: Instalar tsc-alias
```bash
cd backend
npm install -D tsc-alias
```

### Passo 2: Modificar tsconfig.json

Remover `"noEmit": true` para permitir que o TypeScript gere arquivos:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": "./src",
    "paths": {
      "@core/*": ["core/*"],
      "@plugins/*": ["plugins/*"],
      "@shared/*": ["shared/*"],
      "@modules/*": ["modules/*"]
    },
    "types": ["node", "jest"]
  },
  "include": ["src/**/*", "src/types/**/*.d.ts"],
  "exclude": [
    "node_modules",
    "dist",
    "**/*.test.ts",
    "**/*.spec.ts"
  ]
}
```

**Mudanças:**
- ❌ Removido: `"noEmit": true`
- A vírgula extra após `"types"` também deve ser removida

### Passo 3: Modificar package.json scripts

```json
{
  "scripts": {
    "dev": "ts-node-dev -r tsconfig-paths/register --respawn --transpile-only --exit-child --ignore-watch node_modules --no-notify src/server.ts",
    "build": "tsc && tsc-alias",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit"
  }
}
```

**Mudanças:**
- `"build"`: agora é `"tsc && tsc-alias"` (converte paths após compilar)
- `"typecheck"`: adicionado para checar tipos sem gerar arquivos

### Passo 4: Rebuild completo

```bash
# Limpar dist antigo
rm -rf dist

# Rebuild
npm run build

# Verificar se paths foram convertidos
grep -r "@core/" dist/server.js
# Deve retornar vazio (nenhum @core/ restante)

# Testar
npm run start
```

---

## 🔍 VERIFICAÇÃO

Após o build, verificar se `dist/server.js` tem caminhos relativos:

```bash
# Deve retornar VAZIO (sem matches)
grep "@core/" dist/server.js

# Deve mostrar caminhos como "./core/..."
grep "require.*core" dist/server.js | head -5
```

**Esperado:**
```javascript
require("./core/auth/auth.plugin")  // ✅ Correto
```

**Errado:**
```javascript
require("@core/auth/auth.plugin")   // ❌ Vai dar erro
```

---

## 📝 RESUMO DAS MUDANÇAS

| Arquivo | Mudança |
|---------|---------|
| `package.json` | `"build": "tsc && tsc-alias"` |
| `tsconfig.json` | Remover `"noEmit": true` e vírgula extra |
| Terminal | `npm install -D tsc-alias` |

---

## ⚠️ ALTERNATIVA (se tsc-alias não funcionar)

Se preferir não usar tsc-alias, pode usar tsconfig-paths no start:

```json
{
  "scripts": {
    "start": "node -r tsconfig-paths/register dist/server.js"
  }
}
```

**Mas precisa criar** um `tsconfig.prod.json` com paths apontando para dist:
```json
{
  "compilerOptions": {
    "baseUrl": "./dist",
    "paths": {
      "@core/*": ["core/*"],
      "@plugins/*": ["plugins/*"],
      "@shared/*": ["shared/*"],
      "@modules/*": ["modules/*"]
    }
  }
}
```

E modificar start:
```json
"start": "TS_NODE_PROJECT=tsconfig.prod.json node -r tsconfig-paths/register dist/server.js"
```

**Recomendação:** Use `tsc-alias`, é mais simples.

---

*Prompt gerado em 31/12/2025*
