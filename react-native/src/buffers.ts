// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.
import { init } from './init';
import { native } from './native';

/** The number of bytes `base64` decodes to. */
export const base64ByteLength = (base64: string) => {
  if (!base64) return 0;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return (base64.length / 4) * 3 - padding;
};

/** Bytes FFmpeg reads from memory through an `ffkit-inbuf:` url. */
export class FFmpegKitInputBuffer {
  readonly #url: string;
  readonly #size: number;

  /** @internal Use `fromBase64`. */
  constructor(url: string, size: number) {
    this.#url = url;
    this.#size = size;
  }

  /** Copies base64 bytes to native memory. `extension` (such as `mp4`) helps FFmpeg detect the format. */
  static async fromBase64(
    base64Data: string,
    extension?: string
  ): Promise<FFmpegKitInputBuffer> {
    await init();
    const url = await native.inputBufferFromByteArray(
      base64Data,
      extension ?? null
    );
    return new FFmpegKitInputBuffer(url, base64ByteLength(base64Data));
  }

  /** The url to pass as an FFmpeg input. */
  getUrl(): string {
    return this.#url;
  }

  /** Size in bytes. */
  getSize(): number {
    return this.#size;
  }

  /** Frees the native memory; the url stops working. */
  close(): Promise<void> {
    return native.inputBufferClose(this.#url);
  }
}

/** Native memory FFmpeg writes to through an `ffkit-outbuf:` url. */
export class FFmpegKitOutputBuffer {
  readonly #url: string;

  /** @internal Use `create`. */
  constructor(url: string) {
    this.#url = url;
  }

  /** Allocates an output buffer; capacities are in bytes, native defaults when omitted. */
  static async create(
    extension?: string,
    initialCapacity?: number,
    maxCapacity?: number
  ): Promise<FFmpegKitOutputBuffer> {
    await init();
    const url = await native.outputBufferCreate(
      extension ?? null,
      initialCapacity ?? null,
      maxCapacity ?? null
    );
    return new FFmpegKitOutputBuffer(url);
  }

  /** The url to pass as an FFmpeg output. */
  getUrl(): string {
    return this.#url;
  }

  /** Bytes written so far. */
  getSize(): Promise<number> {
    return native.outputBufferGetSize(this.#url);
  }

  /** The bytes written, base64-encoded. */
  toBase64(): Promise<string> {
    return native.outputBufferToByteArray(this.#url);
  }

  /** Frees the native memory; the url stops working. */
  close(): Promise<void> {
    return native.outputBufferClose(this.#url);
  }
}

/** A stream JS writes and FFmpeg reads through an `ffkit-stream-in:` url, while a session runs. */
export class FFmpegKitStreamInput {
  readonly #url: string;

  /** @internal Use `create`. */
  constructor(url: string) {
    this.#url = url;
  }

  /** Creates a stream; `capacity` bounds the bytes buffered natively. */
  static async create(
    extension?: string,
    capacity?: number
  ): Promise<FFmpegKitStreamInput> {
    await init();
    const url = await native.streamInputCreate(
      extension ?? null,
      capacity ?? null
    );
    return new FFmpegKitStreamInput(url);
  }

  /** The url to pass as an FFmpeg input. */
  getUrl(): string {
    return this.#url;
  }

  /** Writes base64 bytes, waiting up to `timeoutMs` for space; resolves with the bytes written. */
  write(base64Data: string, timeoutMs?: number): Promise<number> {
    return native.streamInputWrite(this.#url, base64Data, timeoutMs ?? null);
  }

  /** Ends the input; FFmpeg reads end of stream once the buffer is drained. */
  closeInput(): Promise<void> {
    return native.streamInputCloseInput(this.#url);
  }

  /** Releases the stream; the url stops working. */
  close(): Promise<void> {
    return native.streamInputClose(this.#url);
  }
}

/** A stream FFmpeg writes and JS reads through an `ffkit-stream-out:` url, while a session runs. */
export class FFmpegKitStreamOutput {
  readonly #url: string;

  /** @internal Use `create`. */
  constructor(url: string) {
    this.#url = url;
  }

  /** Creates a stream; `capacity` bounds the bytes buffered natively. */
  static async create(
    extension?: string,
    capacity?: number
  ): Promise<FFmpegKitStreamOutput> {
    await init();
    const url = await native.streamOutputCreate(
      extension ?? null,
      capacity ?? null
    );
    return new FFmpegKitStreamOutput(url);
  }

  /** The url to pass as an FFmpeg output. */
  getUrl(): string {
    return this.#url;
  }

  /**
   * Reads up to `maxBytes`, waiting up to `timeoutMs` for data; resolves with base64 bytes, an empty string at
   * end of stream.
   */
  read(maxBytes: number, timeoutMs?: number): Promise<string> {
    return native.streamOutputRead(this.#url, maxBytes, timeoutMs ?? null);
  }

  /** Releases the stream; the url stops working. */
  close(): Promise<void> {
    return native.streamOutputClose(this.#url);
  }
}
