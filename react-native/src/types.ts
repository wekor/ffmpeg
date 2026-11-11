// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import type { Log } from './log';
import type {
  FFmpegSession,
  FFprobeSession,
  MediaInformationSession,
} from './session';
import type { Statistics } from './statistics';

/** When a session's logs are also printed to the console. */
export enum LogRedirectionStrategy {
  ALWAYS_PRINT_LOGS = 0,
  PRINT_LOGS_WHEN_NO_CALLBACKS_DEFINED = 1,
  PRINT_LOGS_WHEN_GLOBAL_CALLBACK_NOT_DEFINED = 2,
  PRINT_LOGS_WHEN_SESSION_CALLBACK_NOT_DEFINED = 3,
  NEVER_PRINT_LOGS = 4,
}

export enum SessionState {
  CREATED = 0,
  RUNNING = 1,
  FAILED = 2,
  COMPLETED = 3,
}

/** Signals FFmpeg can be told to ignore with `FFmpegKitConfig.ignoreSignal`. */
export enum Signal {
  SIGINT = 2,
  SIGQUIT = 3,
  SIGPIPE = 13,
  SIGTERM = 15,
  SIGXCPU = 24,
}

/** Receives each log line; runs on the JS thread. */
export type LogCallback = (log: Log) => void;

/** Receives each statistics update of an FFmpeg session. */
export type StatisticsCallback = (statistics: Statistics) => void;

export type FFmpegSessionCompleteCallback = (session: FFmpegSession) => void;

export type FFprobeSessionCompleteCallback = (session: FFprobeSession) => void;

export type MediaInformationSessionCompleteCallback = (
  session: MediaInformationSession
) => void;
