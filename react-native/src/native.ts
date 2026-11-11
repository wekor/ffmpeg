// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import type { CodegenTypes } from 'react-native';
import type { MediaProperties } from './media-information';
import Native, {
  type LogEvent,
  type StatisticsEvent,
} from './NativeReactNativeFFmpeg';

export const native = Native;

/** The `type` of a `NativeSession`. */
export const SESSION_TYPE = {
  ffmpeg: 1,
  ffprobe: 2,
  mediaInformation: 3,
} as const;

/** A session as native sends it: `getSession`, `ffmpegSession` and the other session-returning calls. */
export type NativeSession = {
  sessionId: number;
  /** Milliseconds since the epoch. */
  createTime: number;
  /** Milliseconds since the epoch; 0 until the session starts. */
  startTime: number;
  command: string;
  type: (typeof SESSION_TYPE)[keyof typeof SESSION_TYPE];
  /** Media information sessions only, once FFprobe's output is parsed. */
  mediaInformation?: MediaProperties;
};

/** A log as `abstractSessionGetLogs` and the `onLog` event send it. */
export type NativeLog = LogEvent;

/** Statistics as `ffmpegSessionGetStatistics` and the `onStatistics` event send them. */
export type NativeStatistics = StatisticsEvent;

export const asNativeSession = (value: CodegenTypes.UnsafeObject) =>
  value as NativeSession;

export const asNativeLogs = (values: CodegenTypes.UnsafeObject[]) =>
  values as NativeLog[];

export const asNativeStatistics = (values: CodegenTypes.UnsafeObject[]) =>
  values as NativeStatistics[];

export const asMediaProperties = (value: CodegenTypes.UnsafeObject) =>
  value as MediaProperties;

/** A native time in milliseconds as a date; 0 or less means unset. */
export const dateOf = (time: number | null | undefined) =>
  time == null || time <= 0 ? undefined : new Date(time);
