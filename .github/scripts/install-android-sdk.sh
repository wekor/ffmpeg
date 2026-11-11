#!/usr/bin/env bash
# Installs the Android SDK packages and NDK named by the ANDROID_* variables of native.yml on a GitHub Ubuntu runner,
# and exports ANDROID_SDK_ROOT, ANDROID_HOME and ANDROID_NDK_ROOT for the following steps.
set -euo pipefail

sdk_root="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
sdk_manager="${sdk_root}/cmdline-tools/latest/bin/sdkmanager"
yes 2>/dev/null | "${sdk_manager}" --licenses > /dev/null || true
"${sdk_manager}" --install \
  "platform-tools" \
  "platforms;android-${ANDROID_PLATFORM_VERSION}" \
  "build-tools;${ANDROID_BUILD_TOOLS_VERSION}" \
  "ndk;${ANDROID_NDK_VERSION}" \
  "cmake;${ANDROID_CMAKE_VERSION}"
{
  echo "ANDROID_SDK_ROOT=${sdk_root}"
  echo "ANDROID_HOME=${sdk_root}"
  echo "ANDROID_NDK_ROOT=${sdk_root}/ndk/${ANDROID_NDK_VERSION}"
} >> "$GITHUB_ENV"
