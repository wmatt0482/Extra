#!/usr/bin/env node
// Device-code sign-in helper: prints the MS_REFRESH_TOKEN for .env.local.
// Usage: MS_TENANT_ID=... MS_CLIENT_ID=... node scripts/get-graph-token.mjs

const tenant = process.env.MS_TENANT_ID;
const client = process.env.MS_CLIENT_ID;
if (!tenant || !client) {
  console.error("Set MS_TENANT_ID and MS_CLIENT_ID first — see docs/GRAPH_SETUP.md");
  process.exit(1);
}

const SCOPE = "https://graph.microsoft.com/Mail.ReadWrite offline_access";
const base = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;

const dc = await (
  await fetch(`${base}/devicecode`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client, scope: SCOPE }),
  })
).json();

if (!dc.device_code) {
  console.error("Device-code request failed:", dc);
  process.exit(1);
}

console.log(`\n${dc.message}\n`); // "go to https://microsoft.com/devicelogin and enter CODE"

for (;;) {
  await new Promise((r) => setTimeout(r, (dc.interval ?? 5) * 1000));
  const res = await fetch(`${base}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      client_id: client,
      device_code: dc.device_code,
    }),
  });
  const json = await res.json();
  if (json.error === "authorization_pending") continue;
  if (json.error) {
    console.error("Sign-in failed:", json.error_description ?? json.error);
    process.exit(1);
  }
  console.log("Signed in. Add this to .env.local:\n");
  console.log(`MS_REFRESH_TOKEN=${json.refresh_token}\n`);
  process.exit(0);
}
