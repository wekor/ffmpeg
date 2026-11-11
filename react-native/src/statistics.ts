// Derived from FFmpegKit's React Native wrapper (FFmpegKitNext 9.0.2), LGPL-3.0.

/** Progress of a running FFmpeg session. */
export class Statistics {
  #sessionId: number;
  #videoFrameNumber: number;
  #videoFps: number;
  #videoQuality: number;
  #size: number;
  #time: number;
  #bitrate: number;
  #speed: number;

  constructor(
    sessionId: number,
    videoFrameNumber: number,
    videoFps: number,
    videoQuality: number,
    size: number,
    time: number,
    bitrate: number,
    speed: number
  ) {
    this.#sessionId = sessionId;
    this.#videoFrameNumber = videoFrameNumber;
    this.#videoFps = videoFps;
    this.#videoQuality = videoQuality;
    this.#size = size;
    this.#time = time;
    this.#bitrate = bitrate;
    this.#speed = speed;
  }

  getSessionId(): number {
    return this.#sessionId;
  }

  setSessionId(sessionId: number): void {
    this.#sessionId = sessionId;
  }

  getVideoFrameNumber(): number {
    return this.#videoFrameNumber;
  }

  setVideoFrameNumber(videoFrameNumber: number): void {
    this.#videoFrameNumber = videoFrameNumber;
  }

  getVideoFps(): number {
    return this.#videoFps;
  }

  setVideoFps(videoFps: number): void {
    this.#videoFps = videoFps;
  }

  getVideoQuality(): number {
    return this.#videoQuality;
  }

  setVideoQuality(videoQuality: number): void {
    this.#videoQuality = videoQuality;
  }

  /** Output size in bytes. */
  getSize(): number {
    return this.#size;
  }

  setSize(size: number): void {
    this.#size = size;
  }

  /** Processed time in milliseconds. */
  getTime(): number {
    return this.#time;
  }

  setTime(time: number): void {
    this.#time = time;
  }

  /** Output bitrate in kbit/s. */
  getBitrate(): number {
    return this.#bitrate;
  }

  setBitrate(bitrate: number): void {
    this.#bitrate = bitrate;
  }

  getSpeed(): number {
    return this.#speed;
  }

  setSpeed(speed: number): void {
    this.#speed = speed;
  }
}
