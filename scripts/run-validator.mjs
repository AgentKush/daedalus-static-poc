// Iterates public/data/mods.json. For each mod with an EXMODZ download URL,
// downloads it (CORS-safe rewrite to raw.githubusercontent.com when applicable
// since this runs server-side, but really we just need a working fetch URL),
// invokes _validator/validate_modinfo.py against the local file, parses its
// output, aggregates into public/data/validation.json.
//
// Layout written to validation.json:
// {
//   "checked_at": "...",
//   "checked": <n>,
//   "passed": <n>,
//   "warnings_only": <n>,
//   "errors": <n>,
//   "mods": {
//     "<author-slug>--<name-slug>": {
//       "status": "ok" | "warnings" | "errors",
//       "issues": [{ "severity": "error" | "warning", "message": "..." }, ...]
//     }, ...
//   }
// }

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";

const MODS = JSON.parse(fs.readFileSync("public/data/mods.json", "utf8"));
const FILTER = (process.env.MODS_FILTER || "").toLowerCase();
const TMP = fs.mkdtempSync(path.join(tmpdir(), "daedalus-validate-"));
const VALIDATOR = path.resolve("_validator/validate_modinfo.py");

if (!fs.existsSync(VALIDATOR)) {
  console.error(`[validate] validator not found at ${VALIDATOR}`);
  process.exit(1);
}

function slug(s) {
  return (s || "").toString().toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function corsSafeUrl(url) {
  if (!url) return url;
  let m = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:raw|blob)\/(.+)$/);
  if (m) return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}`;
  return url;
}

async function downloadTo(url, destPath) {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  fs.writeFileSync(destPath, buf);
}

function runValidator(localPath) {
  // The validator exits 0 (clean), 1 (errors), 2 (warnings). It prints human-readable
  // output. We capture stdout and parse for "ERROR:" / "WARNING:" lines.
  let stdout = "", code = 0;
  try {
    stdout = execFileSync("python3", [VALIDATOR, localPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    code = e.status || 1;
    stdout = (e.stdout || "").toString() + (e.stderr || "").toString();
  }
  const issues = [];
  for (const line of stdout.split("\n")) {
    const m = line.match(/^\s*(ERROR|WARNING):\s*(.+)$/i);
    if (m) issues.push({ severity: m[1].toLowerCase() === "error" ? "error" : "warning", message: m[2].trim() });
  }
  let status = "ok";
  if (issues.some(i => i.severity === "error")) status = "errors";
  else if (issues.length) status = "warnings";
  return { status, issues, exit_code: code };
}

const out = {
  checked_at: new Date().toISOString(),
  checked: 0, passed: 0, warnings_only: 0, errors: 0,
  mods: {}
};

// Lightweight standalone-PAK validator. The upstream validator only inspects
// PAKs when they're packaged inside an EXMODZ. For mods that ship a bare .pak,
// run these structural checks ourselves.
function validateStandalonePak(buf, originalUrl) {
  const issues = [];
  const filename = (originalUrl.split("/").pop() || "").split("?")[0];
  // 1. Naming convention: Icarus loads only files ending _P.pak
  if (!/_P\.pak$/i.test(filename)) {
    issues.push({ severity: "warning", message: `PAK filename "${filename}" doesn't end with _P.pak — Icarus's PAK loader may not pick it up.` });
  }
  // 2. File-size sanity
  if (buf.length === 0) {
    issues.push({ severity: "error", message: "PAK file is 0 bytes (download empty or broken)." });
  } else if (buf.length < 1024) {
    issues.push({ severity: "warning", message: `PAK file is only ${buf.length} bytes — suspiciously small for a real Unreal pak.` });
  }
  // 3. Unreal Pak magic-number check. UE pak files end with a footer including
  //    one of these magic ints (little-endian) at a known offset from the end:
  //      0x5A6F12E1 — UE Pak v1-v9
  //    The footer is variable-length depending on version, but the magic always
  //    appears in the last ~256 bytes. We just scan for it.
  const tail = buf.subarray(Math.max(0, buf.length - 256));
  const PAK_MAGIC = Buffer.from([0xE1, 0x12, 0x6F, 0x5A]); // little-endian 0x5A6F12E1
  if (!tail.includes(PAK_MAGIC)) {
    issues.push({ severity: "error", message: "PAK file doesn't contain the Unreal Pak magic number (0x5A6F12E1). May not be a valid PAK." });
  }
  let status = "ok";
  if (issues.some(i => i.severity === "error")) status = "errors";
  else if (issues.length) status = "warnings";
  return { status, issues, exit_code: 0 };
}

let count = 0;
for (const m of MODS) {
  if (FILTER && !`${m.name} ${m.author}`.toLowerCase().includes(FILTER)) continue;
  // Prefer EXMODZ (full validator). Fall back to PAK (lightweight check).
  const exmodzUrl = m.files && (m.files.exmodz || m.files.exmod);
  const pakUrl = m.files && m.files.pak;
  if (!exmodzUrl && !pakUrl) continue;
  count++;
  const key = `${slug(m.author)}--${slug(m.name)}`;
  process.stdout.write(`[${count}] ${m.name} (${m.author}) … `);
  let result = null;
  try {
    if (exmodzUrl) {
      // Full upstream validator path
      const localPath = path.join(TMP, `${key}.exmodz`);
      try {
        await downloadTo(corsSafeUrl(exmodzUrl), localPath);
        result = runValidator(localPath);
      } finally {
        try { fs.unlinkSync(localPath); } catch {}
      }
    } else {
      // Standalone PAK — lightweight checks (filename, size, magic number)
      const r = await fetch(corsSafeUrl(pakUrl), { redirect: "follow" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const buf = Buffer.from(await r.arrayBuffer());
      result = validateStandalonePak(buf, pakUrl);
    }
    out.mods[key] = result;
    out.checked++;
    if (result.status === "ok") out.passed++;
    else if (result.status === "warnings") out.warnings_only++;
    else out.errors++;
    console.log(result.status, "(" + result.issues.length + " issues)" + (exmodzUrl ? "" : " [pak-only]"));
  } catch (e) {
    out.mods[key] = { status: "errors", issues: [{ severity: "error", message: `download/run failed: ${e.message}` }], exit_code: -1 };
    out.checked++;
    out.errors++;
    console.log(`failed: ${e.message}`);
  }
}

fs.writeFileSync("public/data/validation.json", JSON.stringify(out, null, 2));
console.log(`\n[validate] ${out.checked} mods checked: ${out.passed} clean, ${out.warnings_only} warnings, ${out.errors} errors`);
console.log(`[validate] wrote public/data/validation.json`);
