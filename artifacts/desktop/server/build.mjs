import { build } from "esbuild";
import { rm, mkdir, cp } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const distDir = path.join(__dirname, "dist");
await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

console.log("[server-build] Bundling server...");

await build({
  entryPoints: [path.join(__dirname, "src/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(distDir, "server.cjs"),
  // Externalize native modules and @libsql binaries
  external: [
    "*.node",
    "@libsql/linux-x64-gnu",
    "@libsql/linux-arm64-gnu",
    "@libsql/darwin-x64",
    "@libsql/darwin-arm64",
    "@libsql/win32-x64-msvc",
    "node-pty",
  ],
  target: "node20",
  logLevel: "info",
  // Mark these packages as external to avoid bundling issues with NAPI
  packages: "bundle",
});

console.log("[server-build] Copying native module binaries...");

const nativeDir = path.join(distDir, "node_modules");
await mkdir(nativeDir, { recursive: true });

// Copy @libsql platform binary
const libsqlPlatforms = [
  "@libsql/linux-x64-gnu",
  "@libsql/linux-arm64-gnu",
  "@libsql/darwin-x64",
  "@libsql/darwin-arm64",
];

for (const pkg of libsqlPlatforms) {
  try {
    const pkgPath = require.resolve(`${pkg}/package.json`);
    const pkgDir = path.dirname(pkgPath);
    const destDir = path.join(nativeDir, pkg.split("/")[0], pkg.split("/")[1]);
    await mkdir(destDir, { recursive: true });
    await cp(pkgDir, destDir, { recursive: true, force: true });
    console.log(`[server-build] Copied ${pkg}`);
  } catch {
    // Not available for this platform, skip
  }
}

// Copy node-pty if available
try {
  const ptySrcPath = require.resolve("node-pty/package.json");
  const ptySrcDir = path.dirname(ptySrcPath);
  const ptyDestDir = path.join(nativeDir, "node-pty");
  await mkdir(ptyDestDir, { recursive: true });
  await cp(ptySrcDir, ptyDestDir, { recursive: true, force: true });
  console.log("[server-build] Copied node-pty");
} catch {
  console.warn("[server-build] node-pty not available, terminal will be disabled");
}

console.log("[server-build] Done! Output: dist/server.cjs");
