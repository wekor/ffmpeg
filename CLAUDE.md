# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FFmpegKit is a multi-platform wrapper library for FFmpeg/FFprobe supporting Android, iOS, macOS, tvOS, Linux, Flutter, and React Native. This is a community fork focused on Android 16KB page size compatibility (API 35+). The original project has been retired.

## Build Commands

Each platform has a top-level build script. All must be run from the repo root.

**Android** (requires `ANDROID_SDK_ROOT` and `ANDROID_NDK_ROOT` env vars):
```bash
./android.sh                           # default build
./android.sh --enable-x264 --enable-x265  # with specific libraries
./android.sh --lts                     # LTS build variant
./android.sh --full                    # all non-GPL libraries
```

**Apple platforms** (requires Xcode with xcrun/xcodebuild):
```bash
./ios.sh                               # iOS
./macos.sh                             # macOS
./tvos.sh                              # tvOS
./apple.sh                             # combined XCFramework
```

**Linux:**
```bash
./linux.sh
```

All scripts accept `--enable-<library>` flags for 50+ external libraries, `--disable-<arch>` to skip architectures, and `--lts` for LTS builds. Build logs go to `build.log` in the repo root.

There is no project-wide test suite in this repo. Testing is done via the separate [ffmpeg-kit-test](https://github.com/arthenica/ffmpeg-kit-test) repository.

## Architecture

### Build System (scripts/)
The core build orchestration is shell-based:
- `scripts/variable.sh` — architecture indexes (13 archs), library indexes (92 libraries), and build constants
- `scripts/source.sh` — external library source URLs and versions
- `scripts/function.sh` — shared build functions (~66KB, the largest file)
- `scripts/function-{android,ios,macos,tvos,linux}.sh` — platform-specific build functions
- `scripts/main-{android,ios,macos,tvos,linux}.sh` — platform build entry points called by top-level scripts

### Platform Wrapper Libraries
Each platform has its own wrapper API providing identical functionality in the platform's native language:
- `android/` — Java API + JNI bindings (`android/ffmpeg-kit-android-lib/src/main/java/com/arthenica/ffmpegkit/`)
- `apple/src/` — Objective-C API for iOS/macOS/tvOS
- `linux/src/` — C++ API
- `flutter/` — Dart API with `flutter/`, `flutter_platform_interface/`
- `react-native/` — TypeScript API with platform-specific bridges in `react-native/android/` and `react-native/ios/`

### Build Artifacts & Tooling
- `tools/patch/` — patches applied to external libraries during build
- `tools/android/build.gradle` / `build.lts.gradle` — Gradle templates copied during Android builds
- `tools/source/` — source management scripts
- `tools/docs/` — documentation build tools

### Packages
8 package variants: `min`, `min-gpl`, `https`, `https-gpl`, `audio`, `video`, `full`, `full-gpl`. GPL variants include x264/x265/xvidcore/vid.stab. Package choice affects licensing (LGPL 3.0 default, GPL 3.0 with GPL libraries).

## Key Conventions

- The API must be unified across all platforms — a feature added to one platform should be added to all (unless platform-specific).
- PRs go against development branches (`development`, `development-react-native`, `development-flutter`), not `main`/`master`.
- FFmpegKit does not modify original FFmpeg source code; it wraps it.
- The Android fork specifically targets NDK r23/r25 CI builds that support 16KB page sizes.
