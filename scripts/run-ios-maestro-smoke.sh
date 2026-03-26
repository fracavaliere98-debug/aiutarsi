#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SIMULATOR_NAME="${IOS_SMOKE_SIMULATOR:-iPhone 17}"
APP_ID="${MAESTRO_APP_ID:-com.aiutarsi.app}"
METRO_PORT="${RCT_METRO_PORT:-8081}"
METRO_LOG="${ROOT_DIR}/.expo/metro-smoke.log"

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

echo "Starting Expo dev server on port $METRO_PORT..."
npx expo start --dev-client --port "$METRO_PORT" --non-interactive >"$METRO_LOG" 2>&1 &
METRO_PID=$!

for _ in {1..30}; do
  if grep -q "Waiting on" "$METRO_LOG" 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "Building and installing app on simulator..."
npx expo run:ios --device "$SIMULATOR_UDID" --no-bundler

echo "Launching app..."
xcrun simctl launch "$SIMULATOR_UDID" "$APP_ID" >/dev/null 2>&1 || true

for flow in "${FLOWS[@]}"; do
  echo "Running Maestro flow: $flow"
  maestro test --device "$SIMULATOR_UDID" "$flow"
done

echo "Local iOS smoke tests passed."
