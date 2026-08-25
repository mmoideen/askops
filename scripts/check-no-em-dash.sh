#!/usr/bin/env bash
# Operating rule: no em dashes (U+2014) or en dashes (U+2013) anywhere in the
# repository. Enforced in CI so the rule cannot silently regress. The pattern
# is built from UTF-8 byte escapes so this script itself contains neither
# character.
set -euo pipefail

pattern=$(printf '\xe2\x80\x94\|\xe2\x80\x93')

matches=$(grep -rn "$pattern" . \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude-dir=.next \
  --exclude-dir=coverage \
  --exclude-dir=playwright-report \
  --exclude-dir=test-results \
  --exclude-dir=eval-results \
  --exclude=package-lock.json \
  2>/dev/null || true)

if [ -n "$matches" ]; then
  echo "Em or en dashes found. The operating rules forbid them:"
  echo "$matches"
  exit 1
fi

echo "No em or en dashes found."
