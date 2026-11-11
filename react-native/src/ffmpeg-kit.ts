// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import { parseArguments } from './arguments';
import { FFmpegKitConfig } from './config';
import { init } from './init';
import { native } from './native';
import { FFmpegSession, toSessions } from './session';
import type {
  FFmpegSessionCompleteCallback,
  LogCallback,
  StatisticsCallback,
} from './types';

/** Runs FFmpeg commands. */
// biome-ignore lint/complexity/noStaticOnlyClass: the public API since FFmpegKit 4.
export class FFmpegKit {
  /** Runs a command, split with `FFmpegKitConfig.parseArguments`, and resolves once it ended. */
  static execute(command: string): Promise<FFmpegSession> {
    return FFmpegKit.executeWithArguments(parseArguments(command));
  }

  /** Runs a command given as arguments and resolves once it ended. */
  static async executeWithArguments(
    commandArguments: string[]
  ): Promise<FFmpegSession> {
    const session = await FFmpegSession.create(commandArguments);
    await FFmpegKitConfig.ffmpegExecute(session);
    return session;
  }

  /** Starts a command and resolves with its session; `completeCallback` reports the end. */
  static executeAsync(
    command: string,
    completeCallback?: FFmpegSessionCompleteCallback,
    logCallback?: LogCallback,
    statisticsCallback?: StatisticsCallback
  ): Promise<FFmpegSession> {
    return FFmpegKit.executeWithArgumentsAsync(
      parseArguments(command),
      completeCallback,
      logCallback,
      statisticsCallback
    );
  }

  /** Starts a command given as arguments and resolves with its session; `completeCallback` reports the end. */
  static async executeWithArgumentsAsync(
    commandArguments: string[],
    completeCallback?: FFmpegSessionCompleteCallback,
    logCallback?: LogCallback,
    statisticsCallback?: StatisticsCallback
  ): Promise<FFmpegSession> {
    const session = await FFmpegSession.create(
      commandArguments,
      completeCallback,
      logCallback,
      statisticsCallback
    );
    await FFmpegKitConfig.asyncFFmpegExecute(session);
    return session;
  }

  /** Cancels the session `sessionId`, or every running session when omitted. */
  static async cancel(sessionId?: number): Promise<void> {
    await init();
    return sessionId === undefined
      ? native.cancel()
      : native.cancelSession(sessionId);
  }

  /** The FFmpeg sessions in the history. */
  static async listSessions(): Promise<FFmpegSession[]> {
    await init();
    return toSessions(await native.getFFmpegSessions(), FFmpegSession);
  }
}
