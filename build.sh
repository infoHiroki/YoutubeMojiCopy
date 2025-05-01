#!/usr/bin/env bash
# パッケージ作成スクリプト
# 使用: chmod +x build.sh && ./build.sh

set -e
PACKAGE_NAME="YoutubeMojiCopy"
# manifest.json から version を取得
VERSION=$(grep -E '"version"\s*:' manifest.json | sed -E 's/.*"([0-9]+\.[0-9]+(\.[0-9]+)?)".*/\1/')
OUTFILE="${PACKAGE_NAME}_v${VERSION}.zip"

echo "Packaging ${PACKAGE_NAME} version ${VERSION} into ${OUTFILE}..."
# 既存ファイル削除
rm -f "$OUTFILE"

# 含めるファイル一覧
FILES=(
  manifest.json
  popup.html
  popup.js
  options.html
  options.js
  promptManager.js
  defaultPrompts.json
  style.css
  privacy-policy.html
  README.md
  LICENSE
  PRIVACY.md
  icons
)

zip -r "$OUTFILE" "${FILES[@]}"
echo "Created package: $OUTFILE"