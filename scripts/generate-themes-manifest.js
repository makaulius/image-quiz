const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const themesDir = path.join(projectRoot, "public", "assets", "themes");
const outFile = path.join(themesDir, "manifest.json");

const exts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const collator = new Intl.Collator("lt", { sensitivity: "base" });

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function generateManifest() {
  const themes = {};

  for (const entry of fs.readdirSync(themesDir)) {
    if (entry.startsWith(".")) continue;

    const dirPath = path.join(themesDir, entry);
    if (!isDirectory(dirPath)) continue;

    const files = fs
      .readdirSync(dirPath)
      .filter((file) => {
        if (file.startsWith(".")) return false;
        const ext = path.extname(file).toLowerCase();
        return exts.has(ext);
      })
      .sort((a, b) => collator.compare(a, b));

    themes[entry] = files;
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    themes,
  };
}

function main() {
  const manifest = generateManifest();
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`Wrote ${outFile}`);
}

main();
