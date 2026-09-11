#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/dist/AdScope.app"
CONTENTS_DIR="$APP_DIR/Contents"

if [[ ! -x "$ROOT_DIR/node_modules/.bin/next" ]]; then
  echo "Missing node_modules. Run npm install in $ROOT_DIR first." >&2
  exit 1
fi

rm -rf "$APP_DIR"
mkdir -p "$CONTENTS_DIR/MacOS" "$CONTENTS_DIR/Resources"

swiftc -O \
  -parse-as-library \
  "$ROOT_DIR/MacApp/MetaAdsScraperApp.swift" \
  -o "$CONTENTS_DIR/MacOS/AdScope" \
  -framework SwiftUI \
  -framework WebKit

cp "$ROOT_DIR/MacApp/Info.plist" "$CONTENTS_DIR/Info.plist"

ICONSET_DIR="$CONTENTS_DIR/Resources/AppIcon.iconset"
mkdir -p "$ICONSET_DIR"
for size in 16 32 128 256 512; do
  sips -s format png -z "$size" "$size" "$ROOT_DIR/MacApp/AppIcon.svg" --out "$ICONSET_DIR/icon_${size}x${size}.png" >/dev/null
  doubled=$((size * 2))
  sips -s format png -z "$doubled" "$doubled" "$ROOT_DIR/MacApp/AppIcon.svg" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil --convert icns --output "$CONTENTS_DIR/Resources/AppIcon.icns" "$ICONSET_DIR"

chmod +x "$CONTENTS_DIR/MacOS/AdScope"

echo "$APP_DIR"
