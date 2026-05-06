const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FACADE = path.join(
  ROOT,
  "backend/src/modules/marketplace/marketplace.service.ts"
);

const content = fs.readFileSync(FACADE, "utf8");
const lines = content.split("\n");

const IGNORED = new Set([
  "constructor",
  "if",
  "for",
  "while",
  "switch",
  "return",
  "catch",
  "map",
  "filter",
  "reduce",
]);

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

const stats = {};
Object.keys(domains).forEach((d) => (stats[d] = { lines: 0 }));
stats.Other = { lines: 0 };

const methodRegex =
  /^\s*(public|private|protected)?\s*(async)?\s*([a-zA-Z0-9_]+)\s*\(/;

let currentMethod = null;
let start = 0;

function classify(methodName, size) {
  for (const [domain, regex] of Object.entries(domains)) {
    if (regex.test(methodName)) {
      stats[domain].lines += size;
      return;
    }
  }

  stats.Other.lines += size;
}

for (let i = 0; i < lines.length; i++) {
  const match = lines[i].match(methodRegex);

  if (match) {
    const methodName = match[3];
    if (IGNORED.has(methodName)) continue;

    if (currentMethod) {
      const size = i - start;
      classify(currentMethod, size);
    }

    currentMethod = methodName;
    start = i;
  }
}

if (currentMethod) {
  classify(currentMethod, lines.length - start);
}

const total = lines.length;

console.log("\nMARKETPLACE DOMAIN MAP (METHOD CLUSTERS)\n");
console.log("──────────────────────────────");

Object.entries(stats)
  .sort((a, b) => b[1].lines - a[1].lines)
  .forEach(([domain, data]) => {
    const percent = ((data.lines / total) * 100).toFixed(1);
    console.log(
      `${domain.padEnd(12)} ${String(data.lines).padStart(6)} lines   ${percent}%`
    );
  });

console.log("\nTotal lines:", total);
console.log("");
