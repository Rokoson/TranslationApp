import { fromByteArray } from 'base64-js';

// --- WAV Encoding Helper Functions ---
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function floatTo16BitPCM(output: DataView, offset: number, input: number[]) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i])); // Clamp to -1 to 1
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // true for little-endian
  }
}

export function pcmToWavBase64(pcmDataFloats: number[], sampleRate: number, numChannels: number = 1, bitsPerSample: number = 16): string {
  const SAMPLES = pcmDataFloats.length;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = SAMPLES * blockAlign;
  const bufferSize = 44 + dataSize; // 44 bytes for WAV header

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true); // ChunkSize
  writeString(view, 8, 'WAVE');

  // FMT sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // Subchunk2Size
  floatTo16BitPCM(view, 44, pcmDataFloats);
  const base64Wav = fromByteArray(new Uint8Array(buffer));
  return `data:audio/wav;base64,${base64Wav}`;
}
// --- End WAV Encoding Helper Functions ---