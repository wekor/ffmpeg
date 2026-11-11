// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.

/** FFmpeg's log levels, `AV_LOG_*` in `libavutil/log.h`. */
// biome-ignore lint/complexity/noStaticOnlyClass: the public API since FFmpegKit 4.
export class Level {
  /** Output FFmpeg wrote to stderr; always redirected. */
  static readonly AV_LOG_STDERR: number = -16;
  /** Print no output. */
  static readonly AV_LOG_QUIET: number = -8;
  /** Something went really wrong and the process will crash now. */
  static readonly AV_LOG_PANIC: number = 0;
  /** Something went wrong and recovery is not possible. */
  static readonly AV_LOG_FATAL: number = 8;
  /** Something went wrong and cannot losslessly be recovered. */
  static readonly AV_LOG_ERROR: number = 16;
  /** Something looks wrong and may or may not lead to problems. */
  static readonly AV_LOG_WARNING: number = 24;
  /** Standard information. */
  static readonly AV_LOG_INFO: number = 32;
  /** Detailed information. */
  static readonly AV_LOG_VERBOSE: number = 40;
  /** Stuff only useful for libav* developers. */
  static readonly AV_LOG_DEBUG: number = 48;
  /** Extremely verbose debugging. */
  static readonly AV_LOG_TRACE: number = 56;

  /** The level's name, such as `INFO`; empty for `AV_LOG_QUIET` and unknown levels. */
  static levelToString(level: number): string {
    switch (level) {
      case Level.AV_LOG_TRACE:
        return 'TRACE';
      case Level.AV_LOG_DEBUG:
        return 'DEBUG';
      case Level.AV_LOG_VERBOSE:
        return 'VERBOSE';
      case Level.AV_LOG_INFO:
        return 'INFO';
      case Level.AV_LOG_WARNING:
        return 'WARNING';
      case Level.AV_LOG_ERROR:
        return 'ERROR';
      case Level.AV_LOG_FATAL:
        return 'FATAL';
      case Level.AV_LOG_PANIC:
        return 'PANIC';
      case Level.AV_LOG_STDERR:
        return 'STDERR';
      default:
        return '';
    }
  }
}

/** A line FFmpeg or FFprobe printed while a session ran. */
export class Log {
  readonly #sessionId: number;
  readonly #level: number;
  readonly #message: string;

  constructor(sessionId: number, level: number, message: string) {
    this.#sessionId = sessionId;
    this.#level = level;
    this.#message = message;
  }

  getSessionId(): number {
    return this.#sessionId;
  }

  /** One of the `Level` values. */
  getLevel(): number {
    return this.#level;
  }

  getMessage(): string {
    return this.#message;
  }
}
