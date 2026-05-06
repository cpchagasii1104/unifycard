const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FACADE = path.join(
  ROOT,
  "backend/src/modules/marketplace/marketplace.service.ts"
);

// Baseline (state at start of instrumented refactor)
const BASELINE_MAPS = 52;
const BASELINE_HEAVY = 46;
const BASELINE_LINES = 12117;
const TARGET_LINES = 3000;

function run(cmd) {
  try {
    return execSync(cmd, {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
  } catch (e) {
    return (e.stdout || "") + (e.stderr || "");
  }
}

function parseState(out) {
  const m = out.match(/Total Maps:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseDelegation(out) {
  const m = out.match(/Heavy logic methods:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseDup(out) {
  let largeCount = 0;
  let dupCount = 0;
  const lines = out.split("\n");
  let inLarge = false;
  let inDup = false;

  for (const line of lines) {
    if (line.includes("=== LARGE METHODS IN FACADE")) {
      inLarge = true;
      inDup = false;
      continue;
    }
    if (line.includes("=== POSSIBLE DUPLICATIONS")) {
      inLarge = false;
      inDup = true;
      continue;
    }
    if (line.includes("===") && (inLarge || inDup)) {
      inLarge = false;
      inDup = false;
    }
    if (inLarge && /^\s+\w+.*\(\d+\s+lines\)/.test(line)) {
      largeCount++;
    }
    if (inDup && /^\s+-\s+\w+/.test(line)) {
      dupCount++;
    }
  }

  return { largeCount, dupCount };
}

function progressBar(percent, width = 20) {
  const filled = Math.round((percent / 100) * width);
  const empty = width - filled;
  return "[" + "=".repeat(filled) + " ".repeat(empty) + "]";
}

console.log("\n");
console.log("  MARKETPLACE REFACTOR STATUS");
console.log("  " + "─".repeat(42));
console.log("");

const stateOut = run("node scripts/detect-marketplace-state.js");
const delegationOut = run("node scripts/detect-marketplace-delegation.js");
const dupOut = run("node scripts/detect-marketplace-duplication.js");

const mapsCount = parseState(stateOut);
const notDelegatedCount = parseDelegation(delegationOut);
const { largeCount, dupCount } = parseDup(dupOut);

let totalLines = 0;
try {
  totalLines = fs.readFileSync(FACADE, "utf8").split("\n").length;
} catch (_) {}

const pMaps = Math.max(
  0,
  Math.min(100, ((BASELINE_MAPS - mapsCount) / BASELINE_MAPS) * 100)
);
const pHeavy = Math.max(
  0,
  Math.min(100, ((BASELINE_HEAVY - notDelegatedCount) / BASELINE_HEAVY) * 100)
);
const pLines =
  BASELINE_LINES <= TARGET_LINES || totalLines <= TARGET_LINES
    ? 100
    : Math.max(
        0,
        Math.min(
          100,
          ((BASELINE_LINES - totalLines) / (BASELINE_LINES - TARGET_LINES)) * 100
        )
      );

const overall = Math.round((pMaps + pHeavy + pLines) / 3);
const bar = progressBar(overall);

console.log("  Refactor progress: " + bar + " " + overall + "%");
console.log("    Maps: " + Math.round(pMaps) + "% | Heavy logic: " + Math.round(pHeavy) + "% | Lines: " + Math.round(pLines) + "%");
console.log("");
console.log("  Maps in facade:              " + mapsCount);
console.log("  Heavy logic methods:         " + notDelegatedCount);
console.log("  Possible duplications:     " + dupCount);
console.log("  Large methods (>80 lines):  " + largeCount);
console.log("  Facade lines:                " + totalLines);
console.log("");
console.log("  Run individual detectors for details:");
console.log("    npm run detect:marketplace-dup");
console.log("    npm run detect:marketplace-state");
console.log("    npm run detect:marketplace-delegation");
console.log("");
