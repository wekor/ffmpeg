// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import { parseArguments } from './arguments';
import { FFmpegKitConfig } from './config';
import { init } from './init';
import { MediaInformation } from './media-information';
import { asMediaProperties, native } from './native';
import {
  FFprobeSession,
  loadMediaInformation,
  MediaInformationSession,
  toSessions,
} from './session';
import type {
  FFprobeSessionCompleteCallback,
  LogCallback,
  MediaInformationSessionCompleteCallback,
} from './types';

/** The FFprobe arguments that print what `MediaInformation` reads. */
const mediaInformationArguments = (path: string) => [
  '-v',
  'error',
  '-hide_banner',
  '-print_format',
  'json',
  '-show_format',
  '-show_streams',
  '-show_chapters',
  '-i',
  path,
];

/** Runs FFprobe commands and extracts media information. */
// biome-ignore lint/complexity/noStaticOnlyClass: the public API since FFmpegKit 4.
export class FFprobeKit {
  /** Runs a command, split with `FFmpegKitConfig.parseArguments`, and resolves once it ended. */
  static execute(command: string): Promise<FFprobeSession> {
    return FFprobeKit.executeWithArguments(parseArguments(command));
  }

  /** Runs a command given as arguments and resolves once it ended. */
  static async executeWithArguments(
    commandArguments: string[]
  ): Promise<FFprobeSession> {
    const session = await FFprobeSession.create(commandArguments);
    await FFmpegKitConfig.ffprobeExecute(session);
    return session;
  }

  /** Starts a command and resolves with its session; `completeCallback` reports the end. */
  static executeAsync(
    command: string,
    completeCallback?: FFprobeSessionCompleteCallback,
    logCallback?: LogCallback
  ): Promise<FFprobeSession> {
    return FFprobeKit.executeWithArgumentsAsync(
      parseArguments(command),
      completeCallback,
      logCallback
    );
  }

  /** Starts a command given as arguments and resolves with its session; `completeCallback` reports the end. */
  static async executeWithArgumentsAsync(
    commandArguments: string[],
    completeCallback?: FFprobeSessionCompleteCallback,
    logCallback?: LogCallback
  ): Promise<FFprobeSession> {
    const session = await FFprobeSession.create(
      commandArguments,
      completeCallback,
      logCallback
    );
    await FFmpegKitConfig.asyncFFprobeExecute(session);
    return session;
  }

  /**
   * Extracts the media information of a file or url; resolves once done. `waitTimeout` bounds the wait for logs
   * in transit, in milliseconds.
   */
  static getMediaInformation(
    path: string,
    waitTimeout?: number
  ): Promise<MediaInformationSession> {
    return FFprobeKit.getMediaInformationFromCommandArguments(
      mediaInformationArguments(path),
      waitTimeout
    );
  }

  /** Extracts media information with a custom FFprobe command that prints JSON. */
  static getMediaInformationFromCommand(
    command: string,
    waitTimeout?: number
  ): Promise<MediaInformationSession> {
    return FFprobeKit.getMediaInformationFromCommandArguments(
      parseArguments(command),
      waitTimeout
    );
  }

  /** Extracts media information with custom FFprobe arguments that print JSON. */
  static async getMediaInformationFromCommandArguments(
    commandArguments: string[],
    waitTimeout?: number
  ): Promise<MediaInformationSession> {
    const session = await MediaInformationSession.create(commandArguments);
    await FFmpegKitConfig.getMediaInformationExecute(session, waitTimeout);
    await loadMediaInformation(session);
    return session;
  }

  /**
   * Starts extracting the media information of a file or url and resolves with the session;
   * `completeCallback` receives it with the media information once done.
   */
  static getMediaInformationAsync(
    path: string,
    completeCallback?: MediaInformationSessionCompleteCallback,
    logCallback?: LogCallback,
    waitTimeout?: number
  ): Promise<MediaInformationSession> {
    return FFprobeKit.getMediaInformationFromCommandArgumentsAsync(
      mediaInformationArguments(path),
      completeCallback,
      logCallback,
      waitTimeout
    );
  }

  /** Starts extracting media information with a custom FFprobe command that prints JSON. */
  static getMediaInformationFromCommandAsync(
    command: string,
    completeCallback?: MediaInformationSessionCompleteCallback,
    logCallback?: LogCallback,
    waitTimeout?: number
  ): Promise<MediaInformationSession> {
    return FFprobeKit.getMediaInformationFromCommandArgumentsAsync(
      parseArguments(command),
      completeCallback,
      logCallback,
      waitTimeout
    );
  }

  /** Starts extracting media information with custom FFprobe arguments that print JSON. */
  static async getMediaInformationFromCommandArgumentsAsync(
    commandArguments: string[],
    completeCallback?: MediaInformationSessionCompleteCallback,
    logCallback?: LogCallback,
    waitTimeout?: number
  ): Promise<MediaInformationSession> {
    const session = await MediaInformationSession.create(
      commandArguments,
      completeCallback,
      logCallback
    );
    await FFmpegKitConfig.asyncGetMediaInformationExecute(session, waitTimeout);
    await loadMediaInformation(session);
    return session;
  }

  /** The FFprobe sessions in the history. */
  static async listFFprobeSessions(): Promise<FFprobeSession[]> {
    await init();
    return toSessions(await native.getFFprobeSessions(), FFprobeSession);
  }

  /** The media information sessions in the history. */
  static async listMediaInformationSessions(): Promise<
    MediaInformationSession[]
  > {
    await init();
    return toSessions(
      await native.getMediaInformationSessions(),
      MediaInformationSession
    );
  }
}

/** Parses FFprobe's JSON output. */
// biome-ignore lint/complexity/noStaticOnlyClass: the public API since FFmpegKit 4.
export class MediaInformationJsonParser {
  /** `undefined` if the output cannot be parsed. */
  static async from(
    ffprobeJsonOutput: string
  ): Promise<MediaInformation | undefined> {
    await init();
    const properties =
      await native.mediaInformationJsonParserFrom(ffprobeJsonOutput);
    return properties == null
      ? undefined
      : new MediaInformation(asMediaProperties(properties));
  }

  /** Rejects if the output cannot be parsed. */
  static async fromWithError(
    ffprobeJsonOutput: string
  ): Promise<MediaInformation> {
    await init();
    const properties =
      await native.mediaInformationJsonParserFromWithError(ffprobeJsonOutput);
    return new MediaInformation(asMediaProperties(properties));
  }
}
