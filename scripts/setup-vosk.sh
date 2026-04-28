#!/bin/bash
# Czech Model (approx for Slovak)
# URL: https://alphacephei.com/vosk/models/vosk-model-small-cs-0.4-rhasspy.zip
MODEL_URL="https://alphacephei.com/vosk/models/vosk-model-small-cs-0.4-rhasspy.zip"
TARGET_DIR="android/app/src/main/assets/vosk-model-cs"
ZIP_FILE="model.zip"

echo "Setup Vosk Model (Czech for SK)..."
mkdir -p android/app/src/main/assets

# Cleanup old models
rm -rf android/app/src/main/assets/vosk-model-en
rm -rf android/app/src/main/assets/vosk-model-en.zip
rm -rf $TARGET_DIR

# Download
echo "Downloading..."
wget --user-agent="Mozilla/5.0" -O $ZIP_FILE $MODEL_URL

# Unzip
unzip -o $ZIP_FILE -d android/app/src/main/assets/

# Rename/Move
# The zip likely contains 'vosk-model-small-cs-0.4-rhasspy' folder
UNZIPPED_DIR=$(find android/app/src/main/assets -maxdepth 1 -type d -name "vosk-model-small-cs-*" | head -n 1)

if [ -z "$UNZIPPED_DIR" ]; then
  echo "Error: Unzipped directory not found"
  ls -la android/app/src/main/assets/
  exit 1
fi

mv "$UNZIPPED_DIR" $TARGET_DIR

# CRITICAL FIX: Add UUID file
echo "1.0.0" > $TARGET_DIR/uuid

rm $ZIP_FILE
echo "Model Setup Complete: $TARGET_DIR (with uuid)"
