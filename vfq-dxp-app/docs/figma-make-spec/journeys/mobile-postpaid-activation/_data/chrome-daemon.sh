#!/usr/bin/env bash
# Starts the chrome-headless-shell daemon the capture-*.mjs scripts attach to
# over CDP. The sandboxed shell this was authored in cannot let Playwright's
# own chromium.launch() manage the browser process (it fails with
# "kill EPERM" when Playwright tries to reap it) - but a browser started and
# left running independently, then attached to via chromium.connectOverCDP(),
# works. --single-process --no-zygote avoid Chrome's normal GPU/network
# subprocesses entirely, which is what the sandbox was killing.
set -euo pipefail
cd "$(dirname "$0")"
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/.playwright-browsers"
CHROME_BIN="$(pwd)/.playwright-browsers/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell"

"$CHROME_BIN" \
  --headless --no-sandbox --single-process --no-zygote \
  --disable-gpu --in-process-gpu --disable-software-rasterizer \
  --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 \
  --user-data-dir=/tmp/chrome-profile-mpa-capture \
  > /tmp/chrome_daemon_mpa.log 2>&1 &
disown
echo "chrome-headless-shell daemon started on http://127.0.0.1:9333 (pid $!)"
