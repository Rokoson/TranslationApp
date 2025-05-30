import { TTS_API_ENDPOINT } from '@/src/config/apiConfig';
import { makeApiRequest } from '@/src/utils/apiUtils'; // Import from new location
import { pcmToWavBase64 } from '@/src/utils/audioUtils';

// Define more specific types for the expected TTS API response structures
interface TtsResponseArray extends Array<number[] | number> {
  0: number[]; // pcmDataFloats
  1: number;   // sampleRate
}

interface TtsResponseObject {
  audio?: number[];
  audio_data?: number[];
  data?: number[];
  sample_rate?: number;
  rate?: number;
}

type TtsApiResponse = TtsResponseArray | TtsResponseObject;

export const speakYorubaTextAPI = async (text: string): Promise<string | null> => {
  if (!text.trim()) {
    throw new Error("Input text cannot be empty for text-to-speech.");
  }
  console.log(`TTS API CALL: Requesting speech for "${text}" from ${TTS_API_ENDPOINT}`);

  try {
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any necessary auth headers for your TTS API
      },
      body: JSON.stringify({
        text: text, // language: 'yo', // Yoruba language code
        // Add other parameters your TTS API might need (e.g., voice, speed)
      }),
    };

    const jsonData = await makeApiRequest<TtsApiResponse>(TTS_API_ENDPOINT, requestOptions);
    console.log("TTS API JSON Data received:", JSON.stringify(jsonData));

    let pcmDataFloats: number[] | undefined;
    let sampleRate: number | undefined;

    if (Array.isArray(jsonData) && jsonData.length === 2) {
      pcmDataFloats = jsonData[0] as number[];
      sampleRate = jsonData[1] as number;
    } else if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
      // jsonData is TtsResponseObject
      pcmDataFloats = jsonData.audio || jsonData.audio_data || jsonData.data;
      sampleRate = jsonData.sample_rate || jsonData.rate;
    }
    
    if (!pcmDataFloats || !Array.isArray(pcmDataFloats) || typeof sampleRate !== 'number') {
      console.error("Extracted audio data or sample rate is invalid/missing.", "pcmDataFloats type:", typeof pcmDataFloats, "sampleRate type:", typeof sampleRate);
      throw new Error(`Invalid or incomplete audio data structure received from API. Got pcmDataFloats (length ${pcmDataFloats?.length}) and sampleRate (${sampleRate})`);
    }
    return pcmToWavBase64(pcmDataFloats, sampleRate);
  } catch (error) {
    console.error("Error during TTS API call:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};