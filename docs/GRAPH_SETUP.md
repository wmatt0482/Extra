# Microsoft Graph setup — drafts in your real Outlook Drafts folder

With these three env vars set, extra's **To Outlook Drafts** button creates a
properly threaded reply draft in your mailbox (visible in Outlook desktop,
web, and mobile). Creating a draft never sends anything.

One-time setup, ~15 minutes. You need to be able to register an app in your
Microsoft 365 tenant (or have your admin do steps 1–3).

## 1. Register the app

[Azure portal](https://portal.azure.com) → **Microsoft Entra ID** →
**App registrations** → **New registration**:

- Name: `extra`
- Supported account types: **Accounts in this organizational directory only**
- Redirect URI: leave empty

Note the **Application (client) ID** and **Directory (tenant) ID** from the
Overview page.

## 2. Allow device-code sign-in

In the app registration → **Authentication** → set
**Allow public client flows** to **Yes** → Save.

(This lets the helper script sign you in without a client secret — no secret
to store or rotate.)

## 3. Grant the permission

**API permissions** → **Add a permission** → **Microsoft Graph** →
**Delegated** → check `Mail.ReadWrite` → Add.

`offline_access` and `User.Read` are requested at sign-in automatically. If
your tenant requires admin consent, ask the admin to click **Grant admin
consent** on this page.

## 4. Get your refresh token

```bash
MS_TENANT_ID=<tenant-id> MS_CLIENT_ID=<client-id> node scripts/get-graph-token.mjs
```

The script prints a code and a URL — sign in as yourself, then it prints your
`MS_REFRESH_TOKEN`.

## 5. Configure extra

Add to `.env.local` (or your Vercel env):

```
MS_TENANT_ID=...
MS_CLIENT_ID=...
MS_REFRESH_TOKEN=...
```

Restart the app. The **To Outlook Drafts** button now appears on every
ready-to-send card.

## Security notes

- The refresh token grants read/write access to your mailbox (not send —
  `Mail.Send` is deliberately NOT requested). Treat it like a password.
- Tokens expire if unused for long periods or when your org rotates policy;
  re-run step 4 if the button starts failing with a 4xx.
- Revoke anytime: Entra ID → the `extra` app registration → delete, or
  myaccount.microsoft.com → Apps → revoke.
