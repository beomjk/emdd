#!/usr/bin/env bash
# CI Verification: ensure types.generated.ts is in sync with graph-schema.yaml
# Usage: bash scripts/ci-check-sync.sh
set -euo pipefail

echo "Regenerating types.generated.ts from graph-schema.yaml..."
npm run gen:schema

if ! git diff --exit-code src/graph/types.generated.ts >/dev/null 2>&1; then
  echo "ERROR: src/graph/types.generated.ts is out of sync with graph-schema.yaml"
  echo "Run 'npm run gen:schema' and commit the result."
  git diff --stat src/graph/types.generated.ts
  exit 1
fi

echo "OK: types.generated.ts is in sync."
