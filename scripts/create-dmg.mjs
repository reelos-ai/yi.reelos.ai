import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const appPath = join(root, "dist", "mac-arm64", "周易宇宙观卦.app");
const output = join(root, "dist", `yijing-cosmos-${pkg.version}-macos-arm64.dmg`);
const staging = mkdtempSync(join(tmpdir(), "yijing-cosmos-dmg-"));

try {
  execFileSync("ditto", [appPath, join(staging, "周易宇宙观卦.app")], { stdio: "inherit" });
  symlinkSync("/Applications", join(staging, "Applications"));
  rmSync(output, { force: true });
  execFileSync("hdiutil", [
    "create", "-volname", "周易宇宙观卦", "-srcfolder", staging,
    "-ov", "-format", "UDZO", output,
  ], { stdio: "inherit" });
  console.log(`Created ${output}`);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
