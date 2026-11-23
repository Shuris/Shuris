#!/usr/bin/env bash
# Prepara a toolchain Android usada pelo Broto sem depender do Google Maven / dl.google.com.
#  - aapt2, dx (dalvik-exchange), zipalign e apksigner vêm dos pacotes do Ubuntu/Debian.
#  - O android.jar (API 34, com resources.arsc) é extraído do android-all do Robolectric (Maven Central).
set -euo pipefail
MIRROR="${MAVEN_MIRROR:-https://maven-central.storage-download.googleapis.com/maven2}"
DEST="${BROTO_ANDROID_JAR_DIR:-/opt/android-stub}"
VER="14-robolectric-10818077"

if ! command -v aapt2 >/dev/null || ! command -v dalvik-exchange >/dev/null || ! command -v apksigner >/dev/null || ! command -v zipalign >/dev/null; then
  sudo_cmd=""; [ "$(id -u)" != "0" ] && sudo_cmd="sudo"
  $sudo_cmd apt-get update -qq
  DEBIAN_FRONTEND=noninteractive $sudo_cmd apt-get install -y -qq aapt apksigner zipalign dalvik-exchange zip unzip
fi

if [ ! -f "$DEST/android.jar" ]; then
  tmp="$(mktemp -d)"
  echo "Baixando android-all $VER ..."
  curl -fsSL -o "$tmp/all.jar" "$MIRROR/org/robolectric/android-all/$VER/android-all-$VER.jar"
  mkdir -p "$tmp/x" && (cd "$tmp/x" && unzip -q "$tmp/all.jar" 'android/*' 'dalvik/*' 'org/json/*' 'org/xmlpull/*' resources.arsc AndroidManifest.xml \
     && find . -name '*.uau' -delete && find ./android -name '*.xml' -delete)
  mkdir -p "$DEST" && (cd "$tmp/x" && zip -q -r "$DEST/android.jar" .)
  rm -rf "$tmp"
fi
echo "Toolchain pronta. android.jar em $DEST/android.jar"
