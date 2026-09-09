#!/usr/bin/env bash
# Convenience wrapper for a new incoming BRSD: correct the workbook (add
# New Req ID / Updated Requirement Statement / Updated Acceptance Criteria
# columns in place, if not already present), extract the shared
# bpmn-swimlane.model.json, then render BOTH diagram types from it
# (bpmn-swimlane and process-flow — see README.md).
#
# Usage: ./scripts/new-brsd.sh /path/to/New_BRSD.xlsx
#
# This is the only command needed for the "upcoming documents" case. It
# shells out to `claude` in non-interactive mode to run /extract-bpmn-swimlane
# (which performs the workbook correction step first, then extraction — not
# scriptable in pure Node since both touch an LLM), then calls render-all.js
# (zero-AI, pure Node) for that BRSD, which renders every registered
# diagram type from that one extracted file.
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
  echo "error: 'claude' CLI not found on PATH — cannot run /extract-bpmn-swimlane." >&2
  echo "Run the slash command manually inside a Claude Code session instead:" >&2
  echo "  /extract-bpmn-swimlane $BRSD_PATH" >&2
  exit 1
fi

echo "== running /extract-bpmn-swimlane $BRSD_PATH (corrects the workbook in place, if needed, then extracts)"
claude -p "/extract-bpmn-swimlane $BRSD_PATH"

echo "== rendering output for $SLUG"
node "$SCRIPT_DIR/render-all.js" --brsd "$SLUG"

echo "== done: output/$SLUG/$SLUG-bpmn-swimlane.html"
echo "==       output/$SLUG/$SLUG-process-flow.html"
