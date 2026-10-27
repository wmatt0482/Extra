#!/usr/bin/env bash
# Boots an iPhone simulator, installs the Debug build of ZeroIn and captures one
# screenshot per tab (dark mode, plus a light-mode Range shot) into ./screenshots.
# Usage: bash tools/simulator_screenshots.sh <derivedDataPath>   (run from zero-in/)
# The app is launched with -seedDemo so the screens have data, and -uiTab <tab>
# to open each tab (see ZeroIn/App/LaunchOptions.swift).
set -euo pipefail

DERIVED="${1:-build}"
BUNDLE_ID="com.wmatt.zeroin"
OUT="screenshots"

APP="$(find "$DERIVED/Build/Products" -type d -name 'ZeroIn.app' -path '*iphonesimulator*' | head -1)"
[[ -n "$APP" ]] || { echo "ZeroIn.app not found under $DERIVED/Build/Products"; exit 1; }
echo "app: $APP"

# Prefer a current iPhone; fall back to any available iPhone.
UDID="$(xcrun simctl list devices available -j | python3 -c '
import json, sys
devs = [d for runtime in json.load(sys.stdin)["devices"].values() for d in runtime if "iPhone" in d["name"]]
pref = ["iPhone 16 Pro", "iPhone 16", "iPhone 15 Pro", "iPhone 15"]
devs.sort(key=lambda d: pref.index(d["name"]) if d["name"] in pref else 99)
print(devs[0]["udid"] if devs else "")
')"
[[ -n "$UDID" ]] || { echo "no iPhone simulator available"; xcrun simctl list devices; exit 1; }
echo "simulator: $UDID"

xcrun simctl boot "$UDID" 2>/dev/null || true
xcrun simctl bootstatus "$UDID" -b
xcrun simctl status_bar "$UDID" override --time "9:41" --batteryLevel 100 --batteryState charged --cellularBars 4 --wifiBars 3
xcrun simctl install "$UDID" "$APP"
mkdir -p "$OUT"

capture() {  # capture <appearance> <tab> <file>
  xcrun simctl ui "$UDID" appearance "$1"
  xcrun simctl launch "$UDID" "$BUNDLE_ID" -seedDemo -uiTab "$2" >/dev/null
  sleep 5
  xcrun simctl io "$UDID" screenshot "$OUT/$3" >/dev/null
  xcrun simctl terminate "$UDID" "$BUNDLE_ID" || true
  echo "captured $OUT/$3"
}

capture dark range 01-range.png
capture dark library 02-library.png
capture dark ballistics 03-ballistics.png
capture dark settings 04-settings.png
capture light range 05-range-light.png

xcrun simctl shutdown "$UDID" || true
ls -la "$OUT"
