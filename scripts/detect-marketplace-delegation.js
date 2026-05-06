const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MODULE_DIR = path.join(ROOT, "backend/src/modules/marketplace");
const FACADE_FILE = path.join(MODULE_DIR, "marketplace.service.ts");

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

const MIN_LINES = 20;

const content = fs.readFileSync(FACADE_FILE, "utf8");

const lines = content.split("\n");

const methodRegex = /^\s*(public|private|protected)?\s*(async\s+)?([a-zA-Z0-9_]+)\s*\(/;

const methods = [];
let current = null;
let start = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const match = line.match(methodRegex);

  if (match) {
    if (current && !IGNORED.has(current)) {
      const size = i - start;
      methods.push({
        name: current,
        lines: size,
        body: lines.slice(start, i).join("\n"),
      });
    }

    current = match[3];
    start = i;
  }
}

if (current && !IGNORED.has(current)) {
  methods.push({
    name: current,
    lines: lines.length - start,
    body: lines.slice(start).join("\n"),
  });
}

function isDelegation(body) {
  const normalized = body.replace(/\s+/g, " ");

  const delegationPatterns = [
    /return this\.[a-zA-Z0-9_]+Module\./,
    /return this\.[a-zA-Z0-9_]+Service\./,
    /await this\.[a-zA-Z0-9_]+Module\./,
    /await this\.[a-zA-Z0-9_]+Service\./,
  ];

  return delegationPatterns.some((p) => p.test(normalized));
}

console.log("\n=== HEAVY LOGIC METHODS (>= " + MIN_LINES + " lines, not delegation) ===\n");

const heavyLogic = methods.filter(
  (m) => m.lines >= MIN_LINES && !isDelegation(m.body)
);

heavyLogic.forEach((m) => {
  console.log(`  ${m.name} (${m.lines} lines)`);
});

console.log("\nTotal methods analyzed:", methods.length);
console.log("Heavy logic methods:", heavyLogic.length, "\n");
