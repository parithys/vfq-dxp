#!/usr/bin/env bash
# Convenience wrapper for a new incoming BRSD: extract all four diagram
# types via Claude, then render all four for that BRSD.
#
# Usage: ./scripts/new-brsd.sh /path/to/New_BRSD.xlsx
#
# This is the only command needed for the "upcoming documents" case. It
# shells out to `claude` in non-interactive mode to run each /extract-*
# command in turn (they must run sequentially — each is a separate Claude
# invocation, not scriptable in pure Node since only extraction touches an
# LLM), then calls render-all.js (zero-AI, pure Node) for that BRSD.
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 /path/to/New_BRSD.xlsx" >&2
  exit 1
fi

BRSD_PATH="$1"
if [ ! -f "$BRSD_PATH" ]; then
  echo "No such file: $BRSD_PATH" >&2
  exit 1
fi
BRSD_PATH="$(cd "$(dirname "$BRSD_PATH")" && pwd)/$(basename "$BRSD_PATH")"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SLUG="$(node "$SCRIPT_DIR/slugify.js" "$BRSD_PATH")"
echo "== BRSD: $BRSD_PATH"
echo "== slug: $SLUG"

if ! command -v claude >/dev/null 2>&1; then
  echo "error: 'claude' CLI not found on PATH — cannot run /extract-* commands." >&2
  echo "Run the four /extract-* slash commands manually inside a Claude Code session instead:" >&2
  echo "  /extract-bpmn-swimlane $BRSD_PATH" >&2
  echo "  /extract-journey $BRSD_PATH" >&2
  echo "  /extract-process-flow $BRSD_PATH" >&2
  echo "  /extract-userflow $BRSD_PATH" >&2
  exit 1
fi

for cmd in extract-bpmn-swimlane extract-journey extract-process-flow extract-userflow; do
  echo "== running /$cmd $BRSD_PATH"
  claude -p "/$cmd $BRSD_PATH"
done

echo "== rendering all four outputs for $SLUG"
node "$SCRIPT_DIR/render-all.js" --brsd "$SLUG"

echo "== done: output/$SLUG/$SLUG-{bpmn-swimlane,journey,process-flow,userflow}.html"
