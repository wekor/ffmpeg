# @wekor/react-native-ffmpeg

FFmpeg and FFprobe for React Native, built on [FFmpegKitNext](https://github.com/arthenica/ffmpeg-kit-next).

```ts
import { FFmpegKit, FFprobeKit, ReturnCode } from '@wekor/react-native-ffmpeg';

const session = await FFmpegKit.execute(`-i ${input} -c:v mpeg4 ${output}`);
if (ReturnCode.isSuccess(await session.getReturnCode())) {
  const info = (await FFprobeKit.getMediaInformation(output)).getMediaInformation();
  console.log(info?.getDuration());
}
```

## Requirements

| React Native | iOS | Android | Expo |
| --- | --- | --- | --- |
| 0.80+, New Architecture | 15.1+ | 7.0+ (API 24), 16 KB page sizes | Development builds. Not Expo Go. |

Every 64-bit Android library is linked for 16 KB pages, as Google Play requires; the build that publishes the
binaries fails otherwise.

## Installation

```sh
npm i @wekor/react-native-ffmpeg
```

The FFmpeg binaries are downloaded during the native build:

- **iOS**: `pod install` downloads the xcframeworks from this repository's GitHub release into the package.
- **Android**: Gradle resolves `com.github.wekor:ffmpeg` from JitPack. Expo's Android template already lists
  JitPack. In a project without it, add `maven { url 'https://www.jitpack.io' }` to `allprojects.repositories`
  in `android/build.gradle`.

## What's included

FFmpeg 9 with dav1d, fontconfig, freetype, fribidi, kvazaar, lame, libass, libiconv, libilbc, libtheora,
libvorbis, libvpx, libwebp, libxml2, opencore-amr, openssl, opus, shine, snappy, soxr, speex, twolame,
vo-amrwbenc and zimg; Android's MediaCodec, and iOS's AudioToolbox, VideoToolbox and AVFoundation.

No GPL libraries: there is no x264, x265, xvidcore, vid.stab or rubberband. Encode H.264 and HEVC with the
platform's hardware encoders (`h264_mediacodec`, `h264_videotoolbox`, ...).

## API

The FFmpegKit API: `FFmpegKit`, `FFprobeKit`, `FFmpegKitConfig`, sessions, `ReturnCode`, `MediaInformation`,
logs and statistics. Code written for `ffmpeg-kit-react-native` or this package's 6.x releases keeps working.

## Binaries

`.github/workflows/native.yml` builds the binaries from FFmpegKitNext's sources on GitHub Actions and attaches
them to a release (`native-v<version>`). `package.json` pins that release in `ffmpegKit.release`, with the iOS
archive's SHA-256 in `ffmpegKit.iosSha256`. To move to a new FFmpegKitNext version, run the workflow with its
tag and update both fields.

## License

LGPL-3.0, like FFmpeg and FFmpegKit. Apps may link it dynamically, as both platforms do here, and must credit
FFmpeg. Some codecs are covered by patents in some countries; see
[FFmpegKitNext's notes on patents](https://github.com/arthenica/ffmpeg-kit-next/wiki/Patents).
