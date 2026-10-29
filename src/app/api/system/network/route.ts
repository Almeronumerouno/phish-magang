import { NextResponse } from "next/server";
import os from "node:os";

export const dynamic = "force-dynamic";

export async function GET() {
  const nets = os.networkInterfaces();
  const nonInternalIps: { interface: string; ip: string }[] = [];

  for (const name of Object.keys(nets)) {
    const netList = nets[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === "IPv4" && !net.internal && !net.address.startsWith("169.254.")) {
        nonInternalIps.push({ interface: name, ip: net.address });
      }
    }
  }

  const primaryLanIp = nonInternalIps[0]?.ip || "127.0.0.1";
  const listenerPort = process.env.PHISH_PORT ? parseInt(process.env.PHISH_PORT) : 8080;

  // Check if listener is actively responding on port 8080
  let isListenerActive = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 400);
    const res = await fetch(`http://127.0.0.1:${listenerPort}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.status === "ok") {
        isListenerActive = true;
      }
    }
  } catch {
    isListenerActive = false;
  }

  return NextResponse.json({
    lanIp: primaryLanIp,
    allIps: nonInternalIps,
    listenerPort,
    isListenerActive,
    presets: [
      {
        id: "local-listener",
        label: `Localhost (Port ${listenerPort})`,
        url: `http://127.0.0.1:${listenerPort}`,
        description: "Pengujian mandiri di laptop/komputer ini (Standar dev GoPhish).",
        isRecommended: true,
      },
      {
        id: "lan-listener",
        label: `LAN Network (Port ${listenerPort})`,
        url: `http://${primaryLanIp}:${listenerPort}`,
        description: "Untuk simulasi terbatas di jaringan Wi-Fi / kantor yang sama.",
        isRecommended: false,
      },
      {
        id: "public-tunnel",
        label: "Public Domain / Cloudflare Tunnel",
        url: "https://phish.yourdomain.com",
        description: "Bebas diakses target di mana saja (kuota 4G/5G, luar kantor, beda Wi-Fi).",
        isRecommended: false,
      },
      {
        id: "app-route",
        label: `Integrated App Route (/phish)`,
        url: `http://${primaryLanIp}:3000/phish`,
        description: "Menggunakan endpoint Next.js tanpa perlu listener terpisah.",
        isRecommended: false,
      },
    ],
  });
}
