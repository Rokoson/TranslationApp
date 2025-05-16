import { TTS_API_ENDPOINT } from '../config/apiConfig';
import { pcmToWavBase64 } from '../utils/audioUtils';

export const speakYorubaTextAPI = async (text: string): Promise<string | null> => {
  if (!text.trim()) {
    return "No text to speak.";
  }
  console.log(`TTS API CALL: Requesting speech for "${text}" from ${TTS_API_ENDPOINT}`);

  try {
    const response = await fetch(TTS_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any necessary auth headers for your TTS API
      },
      body: JSON.stringify({
        text: text,
        //language: 'yo', // Yoruba language code
        // Add other parameters your TTS API might need (e.g., voice, speed)
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("TTS API Error Response:", errorData);
      throw new Error(`TTS API request failed: ${response.status} - ${response.statusText}`);
    }

    const jsonData = await response.json();
    console.log("TTS API JSON Data received:", JSON.stringify(jsonData));

    let pcmDataFloats: number[] | undefined;
    let sampleRate: number | undefined;

    if (Array.isArray(jsonData) && jsonData.length === 2) {
      pcmDataFloats = jsonData[0] as number[];
      sampleRate = jsonData[1] as number;
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      pcmDataFloats = (jsonData as any).audio || (jsonData as any).audio_data || (jsonData as any).data;
      sampleRate = (jsonData as any).sample_rate || (jsonData as any).rate;
    }
    
    if (!pcmDataFloats || !Array.isArray(pcmDataFloats) || typeof sampleRate !== 'number') {
      console.error("Extracted audio data or sample rate is invalid/missing.", "pcmDataFloats type:", typeof pcmDataFloats, "sampleRate type:", typeof sampleRate);
      throw new Error(`Invalid or incomplete audio data structure received from API. Got pcmDataFloats (length ${pcmDataFloats?.length}) and sampleRate (${sampleRate})`);
    }
    return pcmToWavBase64(pcmDataFloats, sampleRate);
  } catch (error) {
    console.error("Error during TTS API call:", error);
    return `Error getting speech: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};