const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODULE_DIR = path.join(ROOT, "backend/src/modules/marketplace");
const FACADE = path.join(MODULE_DIR, "marketplace.service.ts");

const content = fs.readFileSync(FACADE, "utf8");

const mapRegex = /private\s+([a-zA-Z0-9_]+)\s*:\s*Map<([^>]+)>/g;

const domains = {
  Economic: /economic|sustainability|costProfile/i,
  Company: /company|onboarding|activation/i,
  Terminal: /terminal|paymentTerminal/i,
  Templates: /template/i,
  Catalog: /catalog|category|product|store/i,
  Services: /serviceBooking|serviceOrder|serviceRequest/i,
  Dispatch: /dispatch|providerOnline|preReservation/i,
  Operations: /visit|quote/i,
  Revenue: /revenue|financial/i,
  Capacity: /capacity|resource/i,
  Vouchers: /voucher/i,
  Industry: /industry|hub/i,
  SLA: /sla|reputation|dispute/i,
};

const modules = {
  Economic: "MarketplaceEconomicModule",
  Company: "MarketplaceCompanyModule",
  Terminal: "MarketplaceTerminalModule",
  Templates: "MarketplaceTemplatesService",
  Catalog: "MarketplaceCatalogModule",
  Services: "MarketplaceServicesModule",
  Dispatch: "MarketplaceDispatchService",
  Operations: "MarketplaceOperationsModule",
  Revenue: "MarketplaceRevenueModule",
  Capacity: "MarketplaceCapacityService",
  Vouchers: "MarketplaceVouchersService",
  Industry: "MarketplaceIndustryModule",
  SLA: "MarketplaceSlaModule",
};

/** Module display name → filename (e.g. MarketplaceEconomicModule → marketplace-economic.service.ts) */
function moduleNameToFile(moduleName) {
  if (moduleName === "??") return null;
  const mid = moduleName
    .replace(/^Marketplace/, "")
    .replace(/(Module|Service)$/, "");
  const kebab = mid.replace(/([A-Z])/g, (c) => "-" + c.toLowerCase()).replace(/^-/, "");
  return `marketplace-${kebab}.service.ts`;
}

/** Check if mapName exists as private state in the module file */
function isMapInModule(moduleName, mapName) {
  const file = moduleNameToFile(moduleName);
  if (!file) return false;
  const filePath = path.join(MODULE_DIR, file);
  const subPath = path.join(MODULE_DIR, "sub-services", file.replace("marketplace-", "").replace(".service.ts", ""), file);
  let moduleContent = "";
  try {
    moduleContent = fs.readFileSync(filePath, "utf8");
  } catch (_) {
    try {
      moduleContent = fs.readFileSync(subPath, "utf8");
    } catch (_) {
      return false;
    }
  }
  const regex = new RegExp(`private\\s+(?:readonly\\s+)?(?:\\w+\\s+)?${mapName}\\s*:\\s*Map<`);
  return regex.test(moduleContent);
}

/** Collect all Map names from a file content */
function getMapNamesFromContent(text) {
  const re = /private\s+(?:readonly\s+)?([a-zA-Z0-9_]+)\s*:\s*Map</g;
  const names = [];
  let m;
  while ((m = re.exec(text))) names.push(m[1]);
  return names;
}

/** List marketplace-*.service.ts files (root and sub-services) */
function getModuleFilePaths() {
  const list = [];
  try {
    const root = fs.readdirSync(MODULE_DIR);
    for (const f of root) {
      if (f.startsWith("marketplace-") && f.endsWith(".service.ts") && f !== "marketplace.service.ts") {
        list.push(path.join(MODULE_DIR, f));
      }
    }
  } catch (_) {}
  try {
    const sub = path.join(MODULE_DIR, "sub-services");
    const dirs = fs.readdirSync(sub);
    for (const d of dirs) {
      const full = path.join(sub, d);
      if (!fs.statSync(full).isDirectory()) continue;
      const files = fs.readdirSync(full);
      for (const f of files) {
        if (f.startsWith("marketplace-") && f.endsWith(".service.ts")) {
          list.push(path.join(full, f));
        }
      }
    }
  } catch (_) {}
  return list;
}

/** Filename (e.g. marketplace-sla.service.ts) → module display name */
const fileToModule = {};
for (const moduleName of Object.values(modules)) {
  const f = moduleNameToFile(moduleName);
  if (f) fileToModule[f] = moduleName;
}

const entries = [];
const ambiguous = [];
let match;

while ((match = mapRegex.exec(content))) {
  const mapName = match[1];

  const matchingDomains = [];
  for (const [domain, regex] of Object.entries(domains)) {
    if (regex.test(mapName)) matchingDomains.push(domain);
  }

  if (matchingDomains.length > 1) {
    ambiguous.push({ mapName, domains: matchingDomains });
  }

  const domainFound = matchingDomains.length > 0 ? matchingDomains[0] : "Unknown";
  const moduleName = modules[domainFound] || "??";
  const inModule = moduleName !== "??" && isMapInModule(moduleName, mapName);
  const status = inModule ? "DUPLICATED" : "PENDING";

  entries.push({ mapName, moduleName, status });
}

// Group by module
const byModule = {};
for (const { mapName, moduleName, status } of entries) {
  if (!byModule[moduleName]) byModule[moduleName] = [];
  byModule[moduleName].push({ mapName, status });
}

// Sort modules: ?? and Unknown last, then alphabetically
const moduleOrder = Object.keys(byModule).sort((a, b) => {
  if (a === "??") return 1;
  if (b === "??") return -1;
  return a.localeCompare(b);
});

// Migrated: Maps that exist only in module files (not in facade)
const facadeMapNames = new Set(entries.map((e) => e.mapName));
const migratedByModule = {};
for (const filePath of getModuleFilePaths()) {
  const basename = path.basename(filePath);
  const moduleName = fileToModule[basename];
  if (!moduleName) continue;
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const mapName of getMapNamesFromContent(text)) {
      if (!facadeMapNames.has(mapName)) {
        if (!migratedByModule[moduleName]) migratedByModule[moduleName] = [];
        migratedByModule[moduleName].push(mapName);
      }
    }
  } catch (_) {}
}

console.log("\nEXTRACTION QUEUE (MAP → MODULE → STATUS)\n");
console.log("  PENDING    = only in facade (needs extraction)");
console.log("  DUPLICATED = in facade and in module (cleanup: remove from facade)");
console.log("──────────────────────────────────────────────");

for (const moduleName of moduleOrder) {
  const items = byModule[moduleName];
  console.log("\n" + moduleName);
  for (const { mapName, status } of items) {
    console.log("  - " + mapName + " (" + status + ")");
  }
}

if (ambiguous.length > 0) {
  console.log("\n\nAMBIGUOUS (multiple domains match same Map)\n");
  console.log("──────────────────────────────────────────────");
  for (const { mapName, domains } of ambiguous) {
    console.log("  " + mapName + " → [" + domains.join(", ") + "]");
  }
}

if (Object.keys(migratedByModule).length > 0) {
  console.log("\n\nMIGRATED (only in module, not in facade)\n");
  console.log("──────────────────────────────────────────────");
  const migratedOrder = Object.keys(migratedByModule).sort((a, b) => a.localeCompare(b));
  for (const moduleName of migratedOrder) {
    console.log("\n" + moduleName);
    for (const mapName of migratedByModule[moduleName]) {
      console.log("  - " + mapName);
    }
  }
}

console.log("\n");
