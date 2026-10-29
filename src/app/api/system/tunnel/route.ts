import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const dynamic = "force-dynamic";

const STATE_FILE = path.join(process.cwd(), "src", "tunnel-state.json");
let managedProcess: any = null;

function readTunnelState() {
  if (!fs.existsSync(STATE_FILE)) return null;
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    const data = JSON.parse(raw);
    if (data.active && data.url) return data;
  } catch {}
  return null;
}

export async function GET() {
  const state = readTunnelState();
  if (state) {
    return NextResponse.json({
      active: true,
      url: state.url,
      startedAt: state.startedAt,
    });
  }
  return NextResponse.json({ active: false, url: null });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "start";

    if (action === "stop") {
      const state = readTunnelState();
      if (state?.pid) {
        try {
          process.kill(state.pid);
        } catch {}
      }
      if (managedProcess) {
        try {
          managedProcess.kill();
        } catch {}
        managedProcess = null;
      }
      if (fs.existsSync(STATE_FILE)) {
        try {
          fs.unlinkSync(STATE_FILE);
        } catch {}
      }
      return NextResponse.json({ active: false, url: null });
    }

    // Action: start tunnel
    const existing = readTunnelState();
    if (existing?.url) {
      return NextResponse.json({ active: true, url: existing.url });
    }

    // Spawn tunnel process
    const child = spawn("npx", ["--yes", "localtunnel", "--port", "8080"], {
      shell: true,
      detached: true,
      stdio: "pipe",
    });
    managedProcess = child;

    // Listen for URL output
    const tunnelUrl = await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => resolve(null), 8000);

      child.stdout?.on("data", (d) => {
        const text = d.toString();
        const match = text.match(/https?:\/\/[^\s]+/);
        if (match) {
          clearTimeout(timeout);
          const url = match[0].trim();
          const state = {
            active: true,
            url,
            pid: child.pid,
            startedAt: new Date().toISOString(),
          };
          try {
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
          } catch {}
          resolve(url);
        }
      });

      child.on("error", () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    if (tunnelUrl) {
      return NextResponse.json({ active: true, url: tunnelUrl });
    }

    return NextResponse.json(
      { active: false, error: "Timed out waiting for tunnel URL." },
      { status: 500 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to manage tunnel" }, { status: 500 });
  }
}
