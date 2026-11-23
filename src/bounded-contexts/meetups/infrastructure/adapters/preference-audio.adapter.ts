import { Injectable } from '@nestjs/common';
import type { PreferenceAudioPort } from '../../application/ports/preference-audio.port';
import { MeetupError } from '../../domain/errors/meetup.error';

@Injectable()
export class PreferenceAudioAdapter implements PreferenceAudioPort {
  async validate(audio: { data: string; mimeType: string }) {
    const fail = (): never => {
      throw new MeetupError(
        'INVALID_INPUT',
        'Audio must be a supported, valid recording of at most 60 seconds and 2 MB',
      );
    };
    if (
      !audio.data ||
      audio.data.length > 2_800_000 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        audio.data,
      )
    )
      fail();
    const bytes = Buffer.from(audio.data, 'base64');
    if (bytes.length > 2_000_000 || bytes.length < 16) fail();
    const aliases: Record<string, string[]> = {
      'audio/wav': ['audio/wav', 'audio/x-wav', 'audio/vnd.wave'],
      'audio/mp3': ['audio/mpeg'],
      'audio/mpeg': ['audio/mpeg'],
      'audio/ogg': ['audio/ogg', 'audio/opus'],
      'audio/webm': ['audio/webm', 'video/webm'],
      'audio/flac': ['audio/flac', 'audio/x-flac'],
      'audio/aac': ['audio/aac'],
      'audio/m4a': ['audio/mp4', 'audio/x-m4a'],
    };
    try {
      const { fileTypeFromBuffer } = await import('file-type');
      const detected = await fileTypeFromBuffer(bytes);
      if (!detected || !aliases[audio.mimeType]?.includes(detected.mime))
        fail();
      const { parseBuffer, TrackType } = await import('music-metadata');
      const metadata = await parseBuffer(
        bytes,
        { mimeType: detected!.mime, size: bytes.length },
        { duration: true, skipCovers: true },
      );
      const duration = metadata.format.duration;
      if (
        metadata.format.trackInfo.some(
          (track) => track.type === TrackType.video,
        )
      )
        fail();
      if (
        detected!.mime === 'video/webm' &&
        !metadata.format.trackInfo.some(
          (track) => track.type === TrackType.audio,
        )
      )
        fail();
      if (
        typeof duration !== 'number' ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 60 ||
        !metadata.format.sampleRate ||
        !metadata.format.numberOfChannels
      )
        fail();
      return audio;
    } catch {
      return fail();
    }
  }
}
