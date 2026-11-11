// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.

/** The exit code of a finished session. */
export class ReturnCode {
  static readonly SUCCESS: number = 0;
  static readonly CANCEL: number = 255;

  readonly #value: number;

  constructor(value: number) {
    this.#value = value;
  }

  /** Whether `returnCode` is set and means success; `undefined` while the session runs. */
  static isSuccess(returnCode: ReturnCode | null | undefined): boolean {
    return returnCode?.getValue() === ReturnCode.SUCCESS;
  }

  /** Whether `returnCode` is set and means the session was cancelled. */
  static isCancel(returnCode: ReturnCode | null | undefined): boolean {
    return returnCode?.getValue() === ReturnCode.CANCEL;
  }

  getValue(): number {
    return this.#value;
  }

  isValueSuccess(): boolean {
    return this.#value === ReturnCode.SUCCESS;
  }

  isValueError(): boolean {
    return (
      this.#value !== ReturnCode.SUCCESS && this.#value !== ReturnCode.CANCEL
    );
  }

  isValueCancel(): boolean {
    return this.#value === ReturnCode.CANCEL;
  }

  toString(): string {
    return String(this.#value);
  }
}
