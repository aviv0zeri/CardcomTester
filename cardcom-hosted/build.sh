#!/usr/bin/env bash
#
# Copy the iframe HTML and CSS into paste/ and refresh the local preview.
# Source of truth is iframe.body.html and checkout.css — nothing is rewritten.

set -euo pipefail
cd "$(dirname "$0")"

mkdir -p paste

cp checkout.css paste/checkout.full.css
cp iframe.body.html paste/iframe.body.html

python3 - <<'PY'
from pathlib import Path
body = Path("iframe.body.html").read_text(encoding="utf-8")
Path("iframe-preview.html").write_text(
    """<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cardcom iframe checkout</title>
<link rel="stylesheet" href="checkout.css">
</head>
<body>
""" + body + """
</body>
</html>
""",
    encoding="utf-8",
)
PY

echo "paste/iframe.body.html  ($(wc -c < paste/iframe.body.html | tr -d ' ') bytes)"
echo "paste/checkout.full.css ($(wc -c < paste/checkout.full.css | tr -d ' ') bytes)"
echo "iframe-preview.html"
