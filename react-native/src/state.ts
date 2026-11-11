// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import {
  type FFmpegSessionCompleteCallback,
  type FFprobeSessionCompleteCallback,
  type LogCallback,
  LogRedirectionStrategy,
  type MediaInformationSessionCompleteCallback,
  type StatisticsCallback,
} from './types';

/** Callbacks and settings JS keeps per session id; native knows nothing of them. */
export const sessionCallbacks = {
  log: new Map<number, LogCallback>(),
  statistics: new Map<number, StatisticsCallback>(),
  ffmpegComplete: new Map<number, FFmpegSessionCompleteCallback>(),
  ffprobeComplete: new Map<number, FFprobeSessionCompleteCallback>(),
  mediaInformationComplete: new Map<
    number,
    MediaInformationSessionCompleteCallback
  >(),
  logRedirectionStrategy: new Map<number, LogRedirectionStrategy>(),
};

export const globalCallbacks: {
  log?: LogCallback;
  statistics?: StatisticsCallback;
  ffmpegComplete?: FFmpegSessionCompleteCallback;
  ffprobeComplete?: FFprobeSessionCompleteCallback;
  mediaInformationComplete?: MediaInformationSessionCompleteCallback;
} = {};

export const settings = {
  /** The level logs are filtered at; read from native on init. */
  logLevel: undefined as number | undefined,
  logRedirectionStrategy:
    LogRedirectionStrategy.PRINT_LOGS_WHEN_NO_CALLBACKS_DEFINED as LogRedirectionStrategy,
  /** Set once shutdown starts; callbacks are dropped and no new ones are kept. */
  shutdown: false,
};

/** Keeps `callback` for `sessionId`, unless it is missing or shutdown started. */
export const setSessionCallback = <Callback>(
  callbacks: Map<number, Callback>,
  sessionId: number,
  callback: Callback | undefined
) => {
  if (settings.shutdown || callback === undefined) return;
  callbacks.set(sessionId, callback);
};

/** Sets a global callback, unless shutdown started. */
export const setGlobalCallback = <Key extends keyof typeof globalCallbacks>(
  key: Key,
  callback: (typeof globalCallbacks)[Key]
) => {
  if (settings.shutdown) return;
  globalCallbacks[key] = callback;
};

export const deleteSession = (sessionId: number) => {
  for (const callbacks of Object.values(sessionCallbacks))
    callbacks.delete(sessionId);
};

export const deleteSessions = () => {
  for (const callbacks of Object.values(sessionCallbacks)) callbacks.clear();
};

export const beginShutdown = () => {
  settings.shutdown = true;
  deleteSessions();
  for (const key of Object.keys(globalCallbacks))
    delete globalCallbacks[key as keyof typeof globalCallbacks];
};

/** Calls `callback` if it is a function, reporting what it throws; returns whether it was one. */
export const notify = <T>(
  callback: ((value: T) => void) | undefined,
  value: T,
  name: string
) => {
  if (typeof callback !== 'function') return false;
  try {
    callback(value);
  } catch (error) {
    console.error(`[ffmpeg] the ${name} callback threw`, error);
  }
  return true;
};
