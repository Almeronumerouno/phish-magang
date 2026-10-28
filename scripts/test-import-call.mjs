import { createHmac } from "node:crypto";

const SESSION_SECRET = "04942c68cc80d9cfd52870a58726e4909bdbe9427ceafdc0540a3f703cce76c6";
const expiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
const payload = `1.${expiry}`;
const sig = createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
const token = `${payload}.${sig}`;

const rawMime = [
  "Subject: Urgent Account Notice",
  "Content-Type: text/html; charset=utf-8",
  "",
  '<html><body>Click <a href="https://legit-phish.target.com/portal">here</a> to reset.</body></html>',
].join("\r\n");

async function main() {
  const res = await fetch("http://127.0.0.1:3000/api/import/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `rts_session=${token}`,
    },
    body: JSON.stringify({ content: rawMime, convert_links: true }),
  });
  console.log("Status:", res.status);
  const data = await res.json();
  console.log("Data:", data);
}

main().catch(console.error);
