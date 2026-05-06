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

function extractMethods(content) {
  const regex = /\n\s*(public\s+|private\s+|protected\s+)?(async\s+)?([a-zA-Z0-9_]+)\s*\(/g;
  const methods = new Set();

  let match;
  while ((match = regex.exec(content))) {
    const name = match[3];
    if (!IGNORED.has(name)) {
      methods.add(name);
    }
  }

  return [...methods];
}

function detectLargeMethods(content, minLines = 80) {
  const lines = content.split("\n");
  const large = [];
  let method = null;
  let start = 0;

  lines.forEach((line, i) => {
    const m = line.match(/^\s*(public|private|protected)?\s*(async)?\s*([a-zA-Z0-9_]+)\s*\(/);
    if (m) {
      if (method && !IGNORED.has(method)) {
        const size = i - start;
        if (size > minLines) {
          large.push({ name: method, lines: size });
        }
      }
      method = m[3];
      start = i;
    }
  });

  if (method && !IGNORED.has(method)) {
    const size = lines.length - start;
    if (size > minLines) {
      large.push({ name: method, lines: size });
    }
  }

  return large;
}

function getModuleFiles() {
  return fs
    .readdirSync(MODULE_DIR)
    .filter(
      (f) =>
        f.startsWith("marketplace-") &&
        f.endsWith(".service.ts") &&
        f !== "marketplace.service.ts"
    );
}

function run() {
  const facadeContent = fs.readFileSync(FACADE_FILE, "utf8");
  const facadeMethods = extractMethods(facadeContent).sort();

  const modules = getModuleFiles();

  const moduleMethods = {};

  for (const mod of modules) {
    const content = fs.readFileSync(path.join(MODULE_DIR, mod), "utf8");
    moduleMethods[mod] = extractMethods(content).sort();
  }

  console.log("\n=== METHODS IN FACADE ===\n");
  console.log(facadeMethods.join("\n"));

  console.log("\n=== LARGE METHODS IN FACADE (>80 lines) ===\n");
  const largeMethods = detectLargeMethods(facadeContent);
  if (largeMethods.length) {
    largeMethods.forEach((m) => console.log(`  ${m.name} (${m.lines} lines)`));
  } else {
    console.log("  (none)");
  }

  console.log("\n=== POSSIBLE DUPLICATIONS ===\n");

  for (const mod in moduleMethods) {
    const overlap = facadeMethods.filter((m) =>
      moduleMethods[mod].includes(m)
    );

    if (overlap.length) {
      console.log(`\nModule: ${mod}`);
      console.log("Possible delegation candidates:");
      overlap.sort();
      overlap.forEach((m) => console.log("  -", m));
    }
  }

  console.log("\n=== MODULE METHODS NOT USED BY FACADE ===\n");

  for (const mod in moduleMethods) {
    const unused = moduleMethods[mod].filter((m) => !facadeMethods.includes(m));

    if (unused.length) {
      console.log(`\nModule: ${mod}`);
      [...unused].sort().forEach((m) => console.log("  -", m));
    }
  }

  console.log("\nDone.\n");
}

run();
