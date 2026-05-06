#!/usr/bin/env node
/**
 * Use-Case Boundary: services de um domínio não podem importar services de outro.
 * Cross-domain deve ocorrer via eventos. Bloqueia no CI em caso de violação.
 * Considera apenas imports para a camada marketplace/services/ (não application/services/).
 * Uso: npm run marketplace:boundary (ou via marketplace:validate)
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(
  path.join(__dirname, "..", "backend", "src", "modules", "marketplace", "services")
);

function walk(dir) {
  let files = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);

    if (stat.isDirectory()) files = files.concat(walk(full));
    else if (full.endsWith(".ts")) files.push(full);
  }
  return files;
}

/** Inferir domínio do arquivo: marketplace-<domain>.service.ts */
function domainFromFilename(filePath) {
  const name = path.basename(filePath);
  const m = name.match(/^marketplace-([^.]+)\.service\.ts$/);
  return m ? m[1] : null;
}

/** Import path aponta para outro arquivo em marketplace/services/ (não application/services)? */
function isMarketplaceServiceImport(importPath) {
  const n = importPath.replace(/\\/g, "/");
  if (n.includes("application/services") || n.includes("domain/services")) return false;
  return (
    n.includes("marketplace/services/marketplace-") ||
    n.includes("/services/marketplace-") ||
    /^\.\/marketplace-[^.]+\.service/.test(n) ||
    /^\.\.\/marketplace-[^.]+\.service/.test(n)
  );
}

function targetDomainFromPath(importPath) {
  const m = importPath.match(/marketplace-([^.]+)\.service/);
  return m ? m[1] : null;
}

let failed = false;

for (const file of walk(ROOT)) {
  const ourDomain = domainFromFilename(file);
  if (!ourDomain) continue;

  const content = fs.readFileSync(file, "utf8");

  for (const line of content.split("\n")) {
    for (const m of line.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const importPath = m[1];
      if (!isMarketplaceServiceImport(importPath)) continue;

      const targetDomain = targetDomainFromPath(importPath);
      if (targetDomain && targetDomain !== ourDomain) {
        console.error(
          `❌ Use-Case boundary violated — ${ourDomain} service importing ${targetDomain} service`
        );
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);

console.log("✔ Use-Case boundary OK");
