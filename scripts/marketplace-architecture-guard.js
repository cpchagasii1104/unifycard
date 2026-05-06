#!/usr/bin/env node
/**
 * Marketplace Architecture Guard — CI script.
 * Falha o build se a facade/routes violarem as regras arquiteturais.
 * Ver: docs/02_decisions/MARKETPLACE_FACADE_EXTRACTION_PLAN_6_COMMITS.md
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODULE = path.join(ROOT, "backend/src/modules/marketplace");
const FACADE = path.join(MODULE, "marketplace.service.ts");
const ROUTES = path.join(MODULE, "marketplace.routes.ts");
const MAX_FACADE_LINES = 900;

let failed = false;

function fail(msg) {
  console.error("[Marketplace Architecture Guard] ❌", msg);
  failed = true;
}

const facadeContent = fs.existsSync(FACADE) ? fs.readFileSync(FACADE, "utf8") : "";
const routesContent = fs.existsSync(ROUTES) ? fs.readFileSync(ROUTES, "utf8") : "";

// Regex: from '.../domain/ ou require('.../domain/ (inclui alias)
const domainImportRe = /(from\s+['\"].*\/domain\/)|(require\s*\(\s*['\"].*\/domain\/)/m;

// 1. Facade não importa domain
if (facadeContent && domainImportRe.test(facadeContent)) {
  fail("Facade não pode importar domain/");
}

// 2. Facade não usa Map
if (facadeContent && (/\.get\(|\.set\(|\.delete\(|new Map\s*\(/m.test(facadeContent))) {
  fail("Facade não pode usar Map (.get/.set/.delete/new Map)");
}

// 3. Facade < 900 linhas
const facadeLines = facadeContent ? facadeContent.split("\n").length : 0;
if (facadeLines > MAX_FACADE_LINES) {
  fail(`Facade deve ter < ${MAX_FACADE_LINES} linhas (atual: ${facadeLines})`);
}

// 4. God Router: marketplace.routes.ts = agregador puro (sem handlers). routes/*.ts podem ter async (req, reply) desde que apenas deleguem ao service.
if (routesContent && /async\s*\(\s*req\s*,\s*reply\s*\)/.test(routesContent)) {
  fail("marketplace.routes.ts não pode conter handlers inline (mover para routes/*.routes.ts)");
}

// 5. Routes não importam domain (marketplace.routes.ts + routes/**/*.ts)
function routesCannotImportDomain() {
  const toCheck = [
    { path: ROUTES, content: routesContent },
    ...(fs.existsSync(path.join(MODULE, "routes"))
      ? fs.readdirSync(path.join(MODULE, "routes"))
          .filter((f) => f.endsWith(".ts"))
          .map((f) => {
            const fp = path.join(MODULE, "routes", f);
            return { path: fp, content: fs.readFileSync(fp, "utf8") };
          })
      : []),
  ];
  for (const { path: fp, content } of toCheck) {
    if (content && domainImportRe.test(content)) {
      fail(`Routes não podem importar domain: ${path.relative(ROOT, fp)}`);
    }
  }
}
routesCannotImportDomain();

// Regra implícita: cada arquivo em routes/ deve apenas registrar endpoints e delegar ao service (sem lógica de domínio). O guard garante ausência de import domain; lógica em handler fica para revisão.

// 6–9: aggregators sem Map, domain sem application, events .v1 — evolução futura (dependency-cruiser / lint).

if (failed) {
  process.exit(1);
}
console.log("[Marketplace Architecture Guard] ✅ Regras 1–5 OK (facade, routes agregador, routes sem domain)");
process.exit(0);
