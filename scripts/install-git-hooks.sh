#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT_DIR"
git config core.hooksPath .githooks

echo "Configured git hooks path to .githooks"
echo "pre-push will now run: npm run smoke:ios"
echo "Set SKIP_LOCAL_SMOKE=1 to bypass it temporarily."
