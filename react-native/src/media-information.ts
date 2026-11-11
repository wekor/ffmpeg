// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.

/** A JSON object from FFprobe's output. */
export type MediaProperties = Record<string, unknown>;

const isRecord = (value: unknown): value is MediaProperties =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** `value` as a string; numbers are converted, anything else is `undefined`. */
const asString = (value: unknown) =>
  typeof value === 'string'
    ? value
    : typeof value === 'number'
      ? String(value)
      : undefined;

/** `value` as a number; numeric strings are parsed, anything else is `undefined`. */
const asNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isNaN(number) ? undefined : number;
};

/** FFprobe's `tags`, which map names to strings. */
const asTags = (value: unknown) =>
  isRecord(value) ? (value as Record<string, string>) : undefined;

/** Media information FFprobe extracted: the `format`, `streams` and `chapters` of its JSON output. */
export class MediaInformation {
  static readonly KEY_FORMAT_PROPERTIES: string = 'format';
  static readonly KEY_FILENAME: string = 'filename';
  static readonly KEY_FORMAT: string = 'format_name';
  static readonly KEY_FORMAT_LONG: string = 'format_long_name';
  static readonly KEY_START_TIME: string = 'start_time';
  static readonly KEY_DURATION: string = 'duration';
  static readonly KEY_SIZE: string = 'size';
  static readonly KEY_BIT_RATE: string = 'bit_rate';
  static readonly KEY_TAGS: string = 'tags';

  readonly #allProperties: MediaProperties;

  constructor(properties: MediaProperties) {
    this.#allProperties = properties;
  }

  getFilename(): string | undefined {
    return this.getStringFormatProperty(MediaInformation.KEY_FILENAME);
  }

  getFormat(): string | undefined {
    return this.getStringFormatProperty(MediaInformation.KEY_FORMAT);
  }

  getLongFormat(): string | undefined {
    return this.getStringFormatProperty(MediaInformation.KEY_FORMAT_LONG);
  }

  /** Duration in seconds, as FFprobe prints it (`"12.345000"`). */
  getDuration(): string | undefined {
    return this.getStringFormatProperty(MediaInformation.KEY_DURATION);
  }

  getStartTime(): string | undefined {
    return this.getStringFormatProperty(MediaInformation.KEY_START_TIME);
  }

  /** Size in bytes. */
  getSize(): string | undefined {
    return this.getStringFormatProperty(MediaInformation.KEY_SIZE);
  }

  getBitrate(): string | undefined {
    return this.getStringFormatProperty(MediaInformation.KEY_BIT_RATE);
  }

  getTags(): Record<string, string> | undefined {
    return asTags(this.getFormatProperty(MediaInformation.KEY_TAGS));
  }

  getStreams(): StreamInformation[] {
    const streams = this.#allProperties.streams;
    return Array.isArray(streams)
      ? streams.filter(isRecord).map((stream) => new StreamInformation(stream))
      : [];
  }

  getChapters(): Chapter[] {
    const chapters = this.#allProperties.chapters;
    return Array.isArray(chapters)
      ? chapters.filter(isRecord).map((chapter) => new Chapter(chapter))
      : [];
  }

  /** A top-level property as a string. */
  getStringProperty(key: string): string | undefined {
    return asString(this.#allProperties[key]);
  }

  /** A top-level property as a number. */
  getNumberProperty(key: string): number | undefined {
    return asNumber(this.#allProperties[key]);
  }

  getProperty(key: string): unknown {
    return this.#allProperties[key];
  }

  /** A `format` property as a string. */
  getStringFormatProperty(key: string): string | undefined {
    return asString(this.getFormatProperties()?.[key]);
  }

  /** A `format` property as a number. */
  getNumberFormatProperty(key: string): number | undefined {
    return asNumber(this.getFormatProperties()?.[key]);
  }

  getFormatProperty(key: string): unknown {
    return this.getFormatProperties()?.[key];
  }

  getFormatProperties(): MediaProperties | undefined {
    const format = this.#allProperties[MediaInformation.KEY_FORMAT_PROPERTIES];
    return isRecord(format) ? format : undefined;
  }

  getAllProperties(): MediaProperties {
    return this.#allProperties;
  }
}

/** One stream of a media file. */
export class StreamInformation {
  static readonly KEY_INDEX: string = 'index';
  static readonly KEY_TYPE: string = 'codec_type';
  static readonly KEY_CODEC: string = 'codec_name';
  static readonly KEY_CODEC_LONG: string = 'codec_long_name';
  static readonly KEY_FORMAT: string = 'pix_fmt';
  static readonly KEY_WIDTH: string = 'width';
  static readonly KEY_HEIGHT: string = 'height';
  static readonly KEY_BIT_RATE: string = 'bit_rate';
  static readonly KEY_SAMPLE_RATE: string = 'sample_rate';
  static readonly KEY_SAMPLE_FORMAT: string = 'sample_fmt';
  static readonly KEY_CHANNEL_LAYOUT: string = 'channel_layout';
  static readonly KEY_SAMPLE_ASPECT_RATIO: string = 'sample_aspect_ratio';
  static readonly KEY_DISPLAY_ASPECT_RATIO: string = 'display_aspect_ratio';
  static readonly KEY_AVERAGE_FRAME_RATE: string = 'avg_frame_rate';
  static readonly KEY_REAL_FRAME_RATE: string = 'r_frame_rate';
  static readonly KEY_TIME_BASE: string = 'time_base';
  static readonly KEY_CODEC_TIME_BASE: string = 'codec_time_base';
  static readonly KEY_TAGS: string = 'tags';

  readonly #allProperties: MediaProperties;

  constructor(properties: MediaProperties) {
    this.#allProperties = properties;
  }

  getIndex(): number | undefined {
    return this.getNumberProperty(StreamInformation.KEY_INDEX);
  }

  /** `video`, `audio`, `subtitle`, `data` or `attachment`. */
  getType(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_TYPE);
  }

  getCodec(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_CODEC);
  }

  getCodecLong(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_CODEC_LONG);
  }

  /** The pixel format. */
  getFormat(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_FORMAT);
  }

  getWidth(): number | undefined {
    return this.getNumberProperty(StreamInformation.KEY_WIDTH);
  }

  getHeight(): number | undefined {
    return this.getNumberProperty(StreamInformation.KEY_HEIGHT);
  }

  getBitrate(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_BIT_RATE);
  }

  getSampleRate(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_SAMPLE_RATE);
  }

  getSampleFormat(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_SAMPLE_FORMAT);
  }

  getChannelLayout(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_CHANNEL_LAYOUT);
  }

  getSampleAspectRatio(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_SAMPLE_ASPECT_RATIO);
  }

  getDisplayAspectRatio(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_DISPLAY_ASPECT_RATIO);
  }

  getAverageFrameRate(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_AVERAGE_FRAME_RATE);
  }

  getRealFrameRate(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_REAL_FRAME_RATE);
  }

  getTimeBase(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_TIME_BASE);
  }

  getCodecTimeBase(): string | undefined {
    return this.getStringProperty(StreamInformation.KEY_CODEC_TIME_BASE);
  }

  getTags(): Record<string, string> | undefined {
    return asTags(this.getProperty(StreamInformation.KEY_TAGS));
  }

  getStringProperty(key: string): string | undefined {
    return asString(this.#allProperties[key]);
  }

  getNumberProperty(key: string): number | undefined {
    return asNumber(this.#allProperties[key]);
  }

  getProperty(key: string): unknown {
    return this.#allProperties[key];
  }

  getAllProperties(): MediaProperties {
    return this.#allProperties;
  }
}

/** One chapter of a media file. */
export class Chapter {
  static readonly KEY_ID: string = 'id';
  static readonly KEY_TIME_BASE: string = 'time_base';
  static readonly KEY_START: string = 'start';
  static readonly KEY_START_TIME: string = 'start_time';
  static readonly KEY_END: string = 'end';
  static readonly KEY_END_TIME: string = 'end_time';
  static readonly KEY_TAGS: string = 'tags';

  readonly #allProperties: MediaProperties;

  constructor(properties: MediaProperties) {
    this.#allProperties = properties;
  }

  getId(): number | undefined {
    return this.getNumberProperty(Chapter.KEY_ID);
  }

  getTimeBase(): string | undefined {
    return this.getStringProperty(Chapter.KEY_TIME_BASE);
  }

  /** Start in `time_base` units. */
  getStart(): number | undefined {
    return this.getNumberProperty(Chapter.KEY_START);
  }

  /** Start in seconds. */
  getStartTime(): string | undefined {
    return this.getStringProperty(Chapter.KEY_START_TIME);
  }

  /** End in `time_base` units. */
  getEnd(): number | undefined {
    return this.getNumberProperty(Chapter.KEY_END);
  }

  /** End in seconds. */
  getEndTime(): string | undefined {
    return this.getStringProperty(Chapter.KEY_END_TIME);
  }

  getTags(): Record<string, string> | undefined {
    return asTags(this.getProperty(Chapter.KEY_TAGS));
  }

  getStringProperty(key: string): string | undefined {
    return asString(this.#allProperties[key]);
  }

  getNumberProperty(key: string): number | undefined {
    return asNumber(this.#allProperties[key]);
  }

  getProperty(key: string): unknown {
    return this.#allProperties[key];
  }

  getAllProperties(): MediaProperties {
    return this.#allProperties;
  }
}
