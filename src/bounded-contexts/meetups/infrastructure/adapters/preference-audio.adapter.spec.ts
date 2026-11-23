import { PreferenceAudioAdapter } from './preference-audio.adapter';

function wav(seconds: number): string {
  const dataLength = 16000 * 2 * seconds;
  const bytes = Buffer.alloc(44 + dataLength);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + dataLength, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(16000, 24);
  bytes.writeUInt32LE(32000, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(dataLength, 40);
  return bytes.toString('base64');
}
describe('Preference audio validation', () => {
  it('reads actual WAV metadata and accepts a short recording', async () => {
    const data = wav(1);
    await expect(
      new PreferenceAudioAdapter().validate({ data, mimeType: 'audio/wav' }),
    ).resolves.toEqual({ data, mimeType: 'audio/wav' });
  });
  it('rejects a 61-second recording even below the byte limit', async () => {
    await expect(
      new PreferenceAudioAdapter().validate({
        data: wav(61),
        mimeType: 'audio/wav',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
  it('rejects spoofed MIME and arbitrary binary before reaching Gemini', async () => {
    await expect(
      new PreferenceAudioAdapter().validate({
        data: wav(1),
        mimeType: 'audio/mp3',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      new PreferenceAudioAdapter().validate({
        data: Buffer.alloc(100).toString('base64'),
        mimeType: 'audio/wav',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
