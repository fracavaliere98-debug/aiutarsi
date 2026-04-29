#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIMULATOR_NAME="${IOS_SMOKE_SIMULATOR:-iPhone 17}"
METRO_PORT="${RCT_METRO_PORT:-8081}"
METRO_LOG="${ROOT_DIR}/.expo/metro-smoke.log"
APP_SCHEME="${IOS_SMOKE_APP_SCHEME:-aiutarsiapp}"
DEV_CLIENT_URL="${IOS_SMOKE_DEV_CLIENT_URL:-${APP_SCHEME}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${METRO_PORT}}"

export PATH="/opt/homebrew/opt/openjdk/bin:/Users/francescocavaliere/.maestro/bin:$PATH"

FLOWS=(
  "maestro/flows/login.yaml"
  "maestro/flows/community_activity_posts.yaml"
  "maestro/flows/enroll_activity.yaml"
)

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

cleanup() {
  if [[ -n "${METRO_PID:-}" ]] && kill -0 "$METRO_PID" >/dev/null 2>&1; then
    kill "$METRO_PID" >/dev/null 2>&1 || true
    wait "$METRO_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

require_command npm
require_command npx
require_command xcodebuild
require_command xcrun
require_command maestro
require_command java
require_command pod

mkdir -p "${ROOT_DIR}/.expo"

cd "$ROOT_DIR"

if [[ ! -d ios ]]; then
  echo "iOS project missing. Running Expo prebuild..."
  npx expo prebuild --platform ios --no-install
fi

if [[ ! -d ios/Pods ]]; then
  echo "Pods missing. Running pod install..."
  (
    cd ios
    pod install
  )
fi

detect_app_id() {
  if [[ -n "${MAESTRO_APP_ID:-}" ]]; then
    echo "$MAESTRO_APP_ID"
    return
  fi

  grep -m1 "PRODUCT_BUNDLE_IDENTIFIER" ios/AiutarSi.xcodeproj/project.pbxproj \
    | sed -E 's/.*PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/\1/'
}

APP_ID="$(detect_app_id)"

if [[ -z "$APP_ID" ]]; then
  echo "Unable to detect PRODUCT_BUNDLE_IDENTIFIER for AiutarSi. Set MAESTRO_APP_ID explicitly." >&2
  exit 1
fi

find_simulator_udid() {
  local target_name="$1"
  xcrun simctl list devices available \
    | awk -v target="$target_name" '
        $0 ~ target " \\(" && $0 !~ /unavailable/ {
          match($0, /\(([A-F0-9-]+)\)/)
          if (RSTART > 0) {
            print substr($0, RSTART + 1, RLENGTH - 2)
            exit
          }
        }
      '
}

SIMULATOR_UDID="$(find_simulator_udid "$SIMULATOR_NAME")"

if [[ -z "$SIMULATOR_UDID" ]]; then
  echo "Simulator \"$SIMULATOR_NAME\" not available. Install an iOS simulator runtime in Xcode or set IOS_SMOKE_SIMULATOR." >&2
  exit 1
fi

echo "Booting simulator: $SIMULATOR_NAME ($SIMULATOR_UDID)"
open -a Simulator >/dev/null 2>&1 || true
xcrun simctl boot "$SIMULATOR_UDID" >/dev/null 2>&1 || true
xcrun simctl bootstatus "$SIMULATOR_UDID" -b

echo "Resetting installed app state..."
xcrun simctl uninstall "$SIMULATOR_UDID" "$APP_ID" >/dev/null 2>&1 || true

echo "Starting Expo dev server on port $METRO_PORT..."
npx expo start --dev-client --clear --port "$METRO_PORT" --non-interactive >"$METRO_LOG" 2>&1 &
METRO_PID=$!

for _ in {1..30}; do
  if grep -q "Waiting on" "$METRO_LOG" 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "Building and installing app on simulator..."
npx expo run:ios --device "$SIMULATOR_UDID" --no-bundler

APP_PATH="$(find "$HOME/Library/Developer/Xcode/DerivedData" -path "*/Build/Products/Debug-iphonesimulator/AiutarSi.app" -type d -print0 \
  | xargs -0 ls -td \
  | head -n 1)"

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Unable to find built AiutarSi.app in DerivedData." >&2
  exit 1
fi

echo "Launching app..."
xcrun simctl launch "$SIMULATOR_UDID" "$APP_ID" >/dev/null 2>&1 || true
xcrun simctl openurl "$SIMULATOR_UDID" "$DEV_CLIENT_URL" >/dev/null 2>&1 || true
sleep 3

for flow in "${FLOWS[@]}"; do
  echo "Resetting app state for flow: $flow"
  xcrun simctl terminate "$SIMULATOR_UDID" "$APP_ID" >/dev/null 2>&1 || true
  xcrun simctl uninstall "$SIMULATOR_UDID" "$APP_ID" >/dev/null 2>&1 || true
  xcrun simctl install "$SIMULATOR_UDID" "$APP_PATH"
  xcrun simctl openurl "$SIMULATOR_UDID" "$DEV_CLIENT_URL" >/dev/null 2>&1 || true
  sleep 2
  echo "Running Maestro flow: $flow"
  maestro test --device "$SIMULATOR_UDID" -e APP_ID="$APP_ID" "$flow"
done

echo "Local iOS smoke tests passed."
