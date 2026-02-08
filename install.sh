#!/bin/bash
# j — BBS-style menu CLI installer
# Usage: curl -sL https://raw.githubusercontent.com/codazoda/j/main/install.sh | bash

set -e

REPO="codazoda/j"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"

SHARE_DIR="$HOME/.local/share/j"
mkdir -p "$SHARE_DIR"

echo "Installing j..."

# Download files
for file in j.js menus.json; do
  echo "  Downloading $file..."
  curl -sL "$BASE_URL/$file" -o "$SHARE_DIR/$file"
done

# Run the built-in installer
node "$SHARE_DIR/j.js" --install-only

echo ""
echo "Done! Restart your shell or run:"
echo "  source $SHARE_DIR/j.sh"
