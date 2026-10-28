# Prompt for a local Claude Code session on a Mac

Copy everything below the line into a Claude Code session started in a folder
of your choice on the Mac (`claude` in Terminal). Have the iPhone unlocked
and plugged in with a USB cable before you start.

---

I want the ZeroIn iPhone app from my repo running on the iPhone plugged into this Mac. Work through this end to end and tell me when it is on the phone.

**Context.** The repo is `wmatt0482/Extra` on GitHub, branch `claude/extra-v0`. The app lives in `zero-in/`: a SwiftUI iOS 17 app (`zero-in/ZeroIn.xcodeproj`, scheme `ZeroIn`, bundle id `com.wmatt.zeroin`) plus a local Swift package `zero-in/ZeroInCore` that holds the ballistics and group-analysis math with 86 unit tests. `zero-in/README.md` and `zero-in/SPEC.md` describe it. It already builds clean and passes its tests on GitHub Actions with Xcode 16.4 on an iOS simulator, so the code is known good; what has never happened is a run on a physical phone. The camera and photo-library usage strings are set in the project's build settings (generated Info.plist), so no plist editing is needed.

**Steps.**

1. Clone or update the repo: `git clone https://github.com/wmatt0482/Extra.git` (or `git pull` if it exists), then `git checkout claude/extra-v0`. Confirm Xcode 16 or newer is installed and selected (`xcodebuild -version`, `xcode-select -p`). If Xcode is missing, stop and tell me; it is a Mac App Store install I have to start myself.
2. Prove the toolchain on this machine first: `cd zero-in/ZeroInCore && swift test`. Expect 86 tests, 0 failures. Show me the summary line.
3. Find the connected phone: `xcrun devicectl list devices` (or `xcrun xctrace list devices`). If none shows, tell me to unlock the phone, tap Trust on the prompt, and check the cable. The phone also needs Developer Mode on: Settings → Privacy & Security → Developer Mode, then a reboot. Tell me to do that if the device shows as not developer-enabled.
4. Signing. Find my development team id: `security find-identity -v -p codesigning` lists my Apple Development certificates with the team in parentheses, or check Xcode → Settings → Accounts. If no Apple ID is signed into Xcode, tell me to add one under Xcode → Settings → Accounts (a free Apple ID is fine; builds then expire after 7 days). The committed bundle id `com.wmatt.zeroin` may collide with another team's registration; if signing complains, switch to `com.matthuber.zeroin`. Pass signing on the command line rather than editing the project file: `DEVELOPMENT_TEAM=<team id> PRODUCT_BUNDLE_IDENTIFIER=<bundle id> CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates`.
5. Build and install to the phone from `zero-in/`:

   ```bash
   xcodebuild -project ZeroIn.xcodeproj -scheme ZeroIn -configuration Debug \
     -destination 'id=<device udid>' -allowProvisioningUpdates \
     DEVELOPMENT_TEAM=<team id> PRODUCT_BUNDLE_IDENTIFIER=<bundle id> \
     -derivedDataPath build build
   xcrun devicectl device install app --device <device udid> build/Build/Products/Debug-iphoneos/ZeroIn.app
   xcrun devicectl device process launch --device <device udid> <bundle id>
   ```

   If `xcodebuild` fails on the committed project file, regenerate it (`brew install xcodegen && xcodegen generate` in `zero-in/`, the `project.yml` is the source of truth) and retry. If the phone refuses to launch the app, tell me to go to Settings → General → VPN & Device Management and trust the developer profile, then launch again.
6. If anything fails in the Swift code itself (a compile error on device that the simulator did not hit, a crash on launch), read the error, make the smallest fix in `zero-in/`, rebuild, and keep going. Do not rewrite `project.pbxproj` by hand, do not disable or skip tests, and do not commit my team id or any signing changes. Commit code fixes on the `claude/extra-v0` branch with a short message and push them; GitHub Actions will re-verify them.
7. Once it launches, tell me to open the Range tab, tap New session, then Add group, and choose "Use a sample target" on the Photo step. Then try the camera path with a real target. Report what you saw happen, what you changed, and anything still broken.

Keep me posted in short lines as you go, and ask only when you are genuinely blocked on something only I can do on the phone or in Xcode's account settings.
