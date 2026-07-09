#!/usr/bin/env bash
# extra — one-command installer for macOS
#
#   curl -fsSL https://raw.githubusercontent.com/wmatt0482/Extra/claude/extra-v0/scripts/install-mac.sh | bash
#
# What it does: checks Node, clones/updates the repo to ~/extra, installs
# deps, asks for your Todoist token (once), builds, installs a launchd
# service so the app runs at http://localhost:3000 and survives reboots,
# then opens it. Re-running is safe — it updates in place.
#
# Uninstall:
#   launchctl bootout gui/$(id -u)/com.wmatt.extra 2>/dev/null
#   rm -f ~/Library/LaunchAgents/com.wmatt.extra.plist
#   rm -rf ~/extra ~/Applications/extra.app

set -euo pipefail

REPO="${EXTRA_REPO:-https://github.com/wmatt0482/Extra.git}"
BRANCH="${EXTRA_BRANCH:-claude/extra-v0}"
DIR="${EXTRA_DIR:-$HOME/extra}"
PORT="${EXTRA_PORT:-3000}"
LABEL="com.wmatt.extra"

say()  { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

IS_MAC=false
[ "$(uname -s)" = "Darwin" ] && IS_MAC=true

# ── 1. Node ────────────────────────────────────────────────────────────────
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  [ "$NODE_MAJOR" -ge 18 ] || fail "Node $NODE_MAJOR is too old (need 18+). Update via https://nodejs.org or 'brew upgrade node'."
  say "Node $(node -v) ✓"
elif $IS_MAC && command -v brew >/dev/null 2>&1; then
  say "Installing Node via Homebrew..."
  brew install node
else
  fail "Node.js not found. Install the LTS from https://nodejs.org then re-run this script."
fi

# ── 2. Get / update the code ───────────────────────────────────────────────
if [ -d "$DIR/.git" ]; then
  say "Updating existing install in $DIR..."
  git -C "$DIR" fetch origin "$BRANCH"
  git -C "$DIR" checkout "$BRANCH"
  git -C "$DIR" pull --ff-only origin "$BRANCH"
else
  say "Cloning to $DIR..."
  git clone --branch "$BRANCH" "$REPO" "$DIR"
fi

cd "$DIR"

# ── 3. Dependencies ────────────────────────────────────────────────────────
say "Installing dependencies..."
npm install --no-fund --no-audit

# ── 4. Todoist token ───────────────────────────────────────────────────────
if [ ! -f .env.local ] || ! grep -q '^TODOIST_API_TOKEN=.\+' .env.local; then
  TOKEN="${TODOIST_API_TOKEN:-}"
  if [ -z "$TOKEN" ]; then
    echo
    echo "  Get your token: Todoist → Settings → Integrations → Developer → API token"
    # `curl | bash` leaves stdin on the pipe — read from the terminal instead.
    printf '  Paste your Todoist API token: '
    read -r TOKEN < /dev/tty
    [ -n "$TOKEN" ] || fail "No token entered."
  fi
  {
    echo "TODOIST_API_TOKEN=$TOKEN"
    echo
    echo "# Microsoft Graph (optional) — see docs/GRAPH_SETUP.md"
    echo "MS_TENANT_ID="
    echo "MS_CLIENT_ID="
    echo "MS_REFRESH_TOKEN="
  } > .env.local
  say "Saved token to $DIR/.env.local"
else
  say "Existing .env.local kept ✓"
fi

# ── 5. Build ───────────────────────────────────────────────────────────────
say "Building..."
npm run build

# ── 6. Run at login via launchd (macOS only) ──────────────────────────────
if $IS_MAC; then
  PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  mkdir -p "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
  NPM_BIN="$(command -v npm)"
  # launchd jobs get a minimal PATH that lacks /usr/local/bin — and npm's
  # shebang is `#!/usr/bin/env node`, so without node's dir on PATH the job
  # crash-loops. Bake the real node dir into the job's PATH.
  NODE_DIR="$(dirname "$(command -v node)")"
  cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>cd "$DIR" &amp;&amp; export PATH="$NODE_DIR:/usr/local/bin:/usr/bin:/bin" &amp;&amp; PORT=$PORT exec "$NPM_BIN" start</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/extra.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/extra.log</string>
</dict>
</plist>
PLIST
  UID_N="$(id -u)"
  # Tear down any previous instance. bootout returns before the job is
  # actually gone; bootstrapping too early fails with "Input/output error"
  # (error 5), so wait for the label to disappear.
  launchctl bootout "gui/$UID_N/$LABEL" 2>/dev/null || true
  for _ in $(seq 1 10); do
    launchctl print "gui/$UID_N/$LABEL" >/dev/null 2>&1 || break
    sleep 1
  done
  # A leftover server (e.g. from a killed install) would keep holding the
  # port and make the health check below pass no matter what the new job
  # does. Clear it so a 200 can only come from the instance we start.
  ORPHANS="$( (lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true) )"
  if [ -n "$ORPHANS" ]; then
    say "Stopping orphaned process(es) still holding port $PORT..."
    kill $ORPHANS 2>/dev/null || true
    sleep 2
    kill -9 $( (lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true) ) 2>/dev/null || true
  fi
  # Clear a disabled flag left behind by an old `launchctl unload -w`
  # or a crash-looped job — a disabled label makes bootstrap fail.
  launchctl enable "gui/$UID_N/$LABEL" 2>/dev/null || true
  BOOTSTRAPPED=false
  for _ in $(seq 1 3); do
    if launchctl bootstrap "gui/$UID_N" "$PLIST" 2>/dev/null; then BOOTSTRAPPED=true; break; fi
    sleep 2
  done
  if ! $BOOTSTRAPPED; then
    say "bootstrap kept failing — falling back to legacy launchctl load"
    launchctl load -w "$PLIST" || fail "Could not load $LABEL. Inspect with: launchctl print gui/$UID_N/$LABEL"
  fi
  say "Installed background service ($LABEL) — starts at login, restarts if it dies."

  say "Waiting for the app to come up..."
  UP=false
  for _ in $(seq 1 30); do
    if curl -sf "http://localhost:$PORT" >/dev/null 2>&1; then UP=true; break; fi
    sleep 1
  done
  # The port was free before bootstrap, so a response means OUR instance —
  # but double-check the listener is a descendant of the launchd job to
  # rule out something else grabbing the port in the meantime.
  MANAGED=false
  if $UP; then
    JOB_PID="$( (launchctl print "gui/$UID_N/$LABEL" 2>/dev/null || true) | awk '$1=="pid"{print $3; exit}')"
    P="$( (lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true) | head -n 1)"
    while [ -n "$P" ] && [ "$P" != "0" ] && [ "$P" != "1" ]; do
      if [ "$P" = "$JOB_PID" ]; then MANAGED=true; break; fi
      P="$( (ps -o ppid= -p "$P" 2>/dev/null || true) | tr -d ' ')"
    done
  fi
  if $UP && ! $MANAGED; then
    echo
    printf '\033[1;31m✗ Port %s answers, but not from the %s service — another instance is in the way.\033[0m\n' "$PORT" "$LABEL"
    echo "   Find it with: lsof -nP -iTCP:$PORT -sTCP:LISTEN"
    echo "   Kill it, then restart the service: launchctl kickstart -k gui/\$(id -u)/$LABEL"
    exit 1
  fi
  if ! $UP; then
    echo
    printf '\033[1;31m✗ The background service did not come up within 30s.\033[0m\n'
    echo "   Last log lines (~/Library/Logs/extra.log):"
    tail -n 8 "$HOME/Library/Logs/extra.log" 2>/dev/null | sed 's/^/   | /' || true
    echo "   Inspect with: launchctl print gui/\$(id -u)/$LABEL"
    echo "   Restart it with: launchctl kickstart -k gui/\$(id -u)/$LABEL"
    exit 1
  fi

  # ── 7. Build the native macOS app (Electron) ─────────────────────────────
  # Wraps the local server in a real .app: own Dock icon, own window, no
  # browser. Built locally so it needs no Apple code-signing. If anything
  # here fails (network, arch), the web app is already running as a fallback.
  say "Building the native app (downloads Electron once, ~1-2 min)..."
  APP_OK=false
  APPS_DIR="$HOME/Applications"
  ARCH="x64"; [ "$(uname -m)" = "arm64" ] && ARCH="arm64"
  if ( cd "$DIR/desktop" \
        && npm install --no-fund --no-audit \
        && rm -rf "$DIR/desktop/dist" \
        && npx --yes @electron/packager . extra \
             --platform=darwin --arch="$ARCH" \
             --app-bundle-id=com.wmatt.extra.app \
             --out "$DIR/desktop/dist" --overwrite ); then
    mkdir -p "$APPS_DIR"
    rm -rf "$APPS_DIR/extra.app"
    if cp -R "$DIR/desktop/dist/extra-darwin-$ARCH/extra.app" "$APPS_DIR/extra.app"; then
      # Strip any quarantine flag so Gatekeeper opens it without a warning.
      xattr -dr com.apple.quarantine "$APPS_DIR/extra.app" 2>/dev/null || true
      APP_OK=true
    fi
  fi

  echo
  if $APP_OK; then
    open "$APPS_DIR/extra.app" || true      # launch it
    open -R "$APPS_DIR/extra.app" || true   # AND reveal it in Finder so it's findable
    printf '\033[1;32m════════════════════════════════════════════════════════\033[0m\n'
    printf '\033[1;32m ✓ extra.app is installed and opening now.\033[0m\n'
    printf '\033[1;32m════════════════════════════════════════════════════════\033[0m\n'
    echo "   Location: $APPS_DIR/extra.app"
    echo "   A Finder window just opened with it selected. Drag its icon to"
    echo "   your Dock to keep it. Or find it anytime with Spotlight (Cmd-Space,"
    echo "   type 'extra'). Note: this is ~/Applications, not the main /Applications."
    echo "   (Background service keeps data live; logs: ~/Library/Logs/extra.log)"
  else
    open "http://localhost:$PORT" || true
    printf '\033[1;33m▸ Native app build did not complete — the web app is running at http://localhost:%s instead.\033[0m\n' "$PORT"
    echo "   The Electron build step failed (often a network hiccup downloading Electron)."
    echo "   Just re-run this installer to retry — the rest is already set up."
  fi
else
  say "Non-macOS host detected — skipping launchd. Start manually with: cd $DIR && npm start"
fi
