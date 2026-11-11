// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import { init } from './init';
import { native } from './native';

/** The native architecture. */
// biome-ignore lint/complexity/noStaticOnlyClass: the public API since FFmpegKit 4.
export class ArchDetect {
  /** The architecture the native library was built for, such as `arm64-v8a`. */
  static async getArch(): Promise<string> {
    await init();
    return native.getArch();
  }
}

/** The native FFmpegKit package. */
// biome-ignore lint/complexity/noStaticOnlyClass: the public API since FFmpegKit 4.
export class Packages {
  /** The package name, such as `full-gpl`. */
  static async getPackageName(): Promise<string> {
    await init();
    return native.getPackageName();
  }

  /** The external libraries FFmpeg was built with. */
  static async getExternalLibraries(): Promise<string[]> {
    await init();
    return native.getExternalLibraries();
  }
}
