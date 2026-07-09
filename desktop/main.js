// extra — native macOS shell.
//
// The heavy lifting (Next.js server, Todoist calls) runs as the launchd
// background service on localhost. This Electron app is the native window
// around it: real Dock icon, its own process in Cmd-Tab, native menu, no
// browser. If the server isn't up when the app launches, we kick the
// launchd service and wait for it.

const { app, BrowserWindow, Menu, shell } = require("electron");
const { spawn } = require("child_process");
const http = require("http");

const PORT = process.env.EXTRA_PORT || 3000;
const APP_URL = `http://localhost:${PORT}`;
const SERVICE = "com.wmatt.extra";

function ping() {
  return new Promise((resolve) => {
    const req = http.get(APP_URL, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureServer() {
  if (await ping()) return true;
  // Nudge the launchd service (installed by scripts/install-mac.sh).
  try {
    spawn("launchctl", ["kickstart", `gui/${process.getuid()}/${SERVICE}`], {
      stdio: "ignore",
    }).on("error", () => {});
  } catch {}
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    if (await ping()) return true;
  }
  return false;
}

const OFFLINE_HTML = `data:text/html,${encodeURIComponent(`
<html><body style="background:#0d1117;color:#e6edf3;font-family:-apple-system,sans-serif;
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center">
<div><h2>extra couldn't reach its background service</h2>
<p style="color:#8b949e">Open Terminal and run:</p>
<pre style="color:#d29922">launchctl kickstart -k gui/$(id -u)/com.wmatt.extra</pre>
<p style="color:#8b949e">then reopen extra. Logs: ~/Library/Logs/extra.log</p></div>
</body></html>`)}`;

let win;
async function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 860,
    minWidth: 380,
    minHeight: 500,
    title: "extra",
    backgroundColor: "#0d1117",
    titleBarStyle: "hiddenInset",
    show: false,
    webPreferences: { contextIsolation: true },
  });

  win.once("ready-to-show", () => win.show());

  // Outlook / Todoist links open in the default browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  const up = await ensureServer();
  win.loadURL(up ? APP_URL : OFFLINE_HTML);
}

function buildMenu() {
  const template = [
    { role: "appMenu" },
    {
      label: "View",
      submenu: [
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => win?.reload(),
        },
        {
          label: "Triage",
          accelerator: "CmdOrCtrl+1",
          click: () => win?.loadURL(APP_URL),
        },
        {
          label: "Metrics",
          accelerator: "CmdOrCtrl+2",
          click: () => win?.loadURL(`${APP_URL}/metrics`),
        },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "editMenu" }, // gives Cmd-C/V so the Copy buttons work
    { role: "windowMenu" },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
