import { expect, test } from 'bun:test';
import { MediaInformation } from '../media-information';

const information = new MediaInformation({
  format: {
    filename: '/a.mp4',
    format_name: 'mov,mp4',
    duration: '12.500000',
    size: '1024',
    tags: { title: 'A' },
  },
  streams: [
    { index: 0, codec_type: 'video', width: 1920, height: 1080 },
    { index: 1, codec_type: 'audio', sample_rate: '48000' },
  ],
  chapters: [{ id: 0, start: 0, end_time: '5.000000' }],
});

test('reads format properties', () => {
  expect(information.getFilename()).toBe('/a.mp4');
  expect(information.getDuration()).toBe('12.500000');
  expect(information.getNumberFormatProperty('duration')).toBe(12.5);
  expect(information.getTags()).toEqual({ title: 'A' });
  expect(information.getBitrate()).toBeUndefined();
});

test('reads streams and chapters', () => {
  const [video, audio] = information.getStreams();
  expect(video?.getType()).toBe('video');
  expect(video?.getWidth()).toBe(1920);
  expect(audio?.getSampleRate()).toBe('48000');
  expect(audio?.getWidth()).toBeUndefined();
  expect(information.getChapters()[0]?.getEndTime()).toBe('5.000000');
});

test('tolerates missing sections', () => {
  const empty = new MediaInformation({});
  expect(empty.getStreams()).toEqual([]);
  expect(empty.getFormatProperties()).toBeUndefined();
  expect(empty.getFilename()).toBeUndefined();
});
