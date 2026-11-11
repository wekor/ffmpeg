// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import { Level, Log } from './log';
import { type NativeLog, type NativeStatistics, native } from './native';
import {
  deleteSession,
  globalCallbacks,
  notify,
  sessionCallbacks,
  settings,
} from './state';
import { Statistics } from './statistics';
import { LogRedirectionStrategy } from './types';
import { VERSION } from './version';

let subscribed = false;
let initialized = false;
let initializing: Promise<void> | undefined;
let completeHandler: (sessionId: number) => void = () => {};

/** Sets what runs when a session ends. `session.ts` provides it, so this module needs no session classes. */
export const setCompleteHandler = (handler: (sessionId: number) => void) => {
  completeHandler = handler;
};

/**
 * Subscribes to native events, enables redirection and reads the native log level, once. Concurrent calls share
 * one attempt; a failed attempt is retried by the next call.
 */
export const init = (printLoadConfirmation = true): Promise<void> => {
  if (initialized) return Promise.resolve();
  initializing ??= initialize(printLoadConfirmation).then(
    () => {
      initialized = true;
    },
    (error: unknown) => {
      initializing = undefined;
      throw error;
    }
  );
  return initializing;
};

const initialize = async (printLoadConfirmation: boolean) => {
  if (!subscribed) {
    native.onLog(onLog);
    native.onStatistics(onStatistics);
    native.onComplete(({ sessionId }) => completeHandler(sessionId));
    native.onSessionDeleted(({ sessionId }) => {
      if (!settings.shutdown) deleteSession(sessionId);
    });
    subscribed = true;
  }
  await native.enableRedirection();
  try {
    settings.logLevel = await native.getLogLevel();
  } catch (error) {
    console.error('[ffmpeg] reading the native log level failed', error);
  }
  if (printLoadConfirmation) await native.printLoadConfirmation(VERSION);
};

/** Whether a log is printed, given the strategy and which callbacks received it. */
export const shouldPrint = (
  strategy: LogRedirectionStrategy,
  sessionCallbackDefined: boolean,
  globalCallbackDefined: boolean
) => {
  switch (strategy) {
    case LogRedirectionStrategy.NEVER_PRINT_LOGS:
      return false;
    case LogRedirectionStrategy.PRINT_LOGS_WHEN_GLOBAL_CALLBACK_NOT_DEFINED:
      return !globalCallbackDefined;
    case LogRedirectionStrategy.PRINT_LOGS_WHEN_SESSION_CALLBACK_NOT_DEFINED:
      return !sessionCallbackDefined;
    case LogRedirectionStrategy.PRINT_LOGS_WHEN_NO_CALLBACKS_DEFINED:
      return !sessionCallbackDefined && !globalCallbackDefined;
    default:
      return true;
  }
};

/** Whether a log at `level` passes the active level; `AV_LOG_STDERR` always does. */
export const isLogged = (level: number, activeLevel: number | undefined) =>
  activeLevel === undefined ||
  !(
    (activeLevel === Level.AV_LOG_QUIET && level !== Level.AV_LOG_STDERR) ||
    level > activeLevel
  );

const onLog = (event: NativeLog) => {
  const { sessionId, level, message } = event;
  if (settings.shutdown || !isLogged(level, settings.logLevel)) return;
  const log = logOf(event);
  const strategy =
    sessionCallbacks.logRedirectionStrategy.get(sessionId) ??
    settings.logRedirectionStrategy;
  const sessionCallbackDefined = notify(
    sessionCallbacks.log.get(sessionId),
    log,
    'session log'
  );
  const globalCallbackDefined = notify(globalCallbacks.log, log, 'global log');
  if (settings.shutdown || level === Level.AV_LOG_QUIET) return;
  if (shouldPrint(strategy, sessionCallbackDefined, globalCallbackDefined))
    console.log(message);
};

const onStatistics = (event: NativeStatistics) => {
  if (settings.shutdown) return;
  const statistics = statisticsOf(event);
  notify(
    sessionCallbacks.statistics.get(event.sessionId),
    statistics,
    'session statistics'
  );
  notify(globalCallbacks.statistics, statistics, 'global statistics');
};

export const logOf = ({ sessionId, level, message }: NativeLog) =>
  new Log(sessionId, level, message);

export const statisticsOf = (event: NativeStatistics) =>
  new Statistics(
    event.sessionId,
    event.videoFrameNumber,
    event.videoFps,
    event.videoQuality,
    event.size,
    event.time,
    event.bitrate,
    event.speed
  );
