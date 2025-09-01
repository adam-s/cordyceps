#!/bin/bash

# Set default values
EXTENSION_FOLDER="../dist"
USER_DIR="./chrome-user-0"

# Parse command-line arguments
for i in "$@"
do
case $i in
    --extension-folder=*)
    EXTENSION_FOLDER="${i#*=}"
    shift
    ;;
    --user-dir=*)
    USER_DIR="${i#*=}"
    shift
    ;;
    *)
    # unknown option
    ;;
esac
done

# Path to Chrome executable on macOS
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

# Check if Chrome executable exists
if [ ! -f "$CHROME_PATH" ]; then
    echo "Error: Google Chrome not found at $CHROME_PATH"
    exit 1
fi

echo "🚀 Launching Chrome..."
echo "   Extension: $EXTENSION_FOLDER"
echo "   User Dir:  $USER_DIR"

# Launch Chrome with specified options
"$CHROME_PATH" \
  --load-extension="$EXTENSION_FOLDER" \
  --disable-extensions-except="$EXTENSION_FOLDER" \
  --remote-debugging-port=9222 \
  --user-data-dir="$USER_DIR" \
  --no-default-browser-check \
  --no-first-run