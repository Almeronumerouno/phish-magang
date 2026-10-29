import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATE_FILE = path.join(__dirname, "..", "src", "tunnel-state.json");

console.log("Starting Public Tunnel for port 8080...");
const child = spawn("npx", ["--yes", "localtunnel", "--port", "8080"], { shell: true });

child.stdout.on("data", (data) => {
  const text = data.toString();
  const match = text.match(/https?:\/\/[^\s]+/);
  if (match) {
    const url = match[0].trim();
    const state = { active: true, url, pid: child.pid, startedAt: new Date().toISOString() };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`\n==================================================`);
    console.log(`🌐 Public Tunnel Online: ${url}`);
    console.log(`Saved to ${STATE_FILE}`);
    console.log(`==================================================\n`);
  } else {
    console.log(text.trim());
  }
});

child.stderr.on("data", (data) => {
  console.error(data.toString());
});

function cleanup() {
  if (fs.existsSync(STATE_FILE)) {
    try { fs.unlinkSync(STATE_FILE); } catch {}
  }
  try { child.kill(); } catch {}
  process.exit();
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);
