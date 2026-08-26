#!/usr/bin/env bash
# Build the React tester and copy preview/template files Vite does not bundle.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/cardcom-tester/dist"

cd "$ROOT/cardcom-tester"
npm run build

rm -rf "$DIST/cardcom-preview" "$DIST/templates" "$DIST/cardcom-hosted" "$DIST/Images"
cp -R "$ROOT/cardcom-preview" "$DIST/cardcom-preview"
mkdir -p "$DIST/templates"
cp -R "$ROOT/templates/cardcom" "$DIST/templates/cardcom"
mkdir -p "$DIST/cardcom-hosted/templates"
cp -R "$ROOT/cardcom-hosted/templates/." "$DIST/cardcom-hosted/templates/"
mkdir -p "$DIST/Images/Bit"
cp -R "$ROOT/cardcom-preview/assets/." "$DIST/Images/Bit/"
rm -rf "$DIST/competition-template"
cp -R "$ROOT/competition-template" "$DIST/competition-template"
