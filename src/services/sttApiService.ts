import { STT_API_ENDPOINT } from '@/src/config/apiConfig'; // You'll need to add STT_API_ENDPOINT to your apiConfig
import { makeApiRequest } from '@/src/utils/apiUtils';

interface SttApiResponse {
  transcript?: string;
  // Add other potential fields from your STT API response if needed
}

/**
 * Transcribes audio to text using the backend STT service.
 * @param audioFileUri The local URI of the audio file to transcribe.
 * @param mimeType The MIME type of the audio file (e.g., 'audio/wav', 'audio/mp4').
 * @returns A promise that resolves to the transcribed text string.
 */
export const transcribeAudioAPI = async (audioFileUri: string, mimeType: string = 'audio/mpeg'): Promise<string> => {
  if (!audioFileUri) {
    throw new Error("Audio file URI cannot be empty for transcription.");
  }
  if (!STT_API_ENDPOINT) {
    throw new Error("STT API endpoint is not configured.");
  }

  console.log(`STT API CALL: Transcribing audio from ${audioFileUri}`);

  const formData = new FormData();
  formData.append('audio_file', { // 'audio_file' is an example key; adjust to your API's needs
    uri: audioFileUri,
    name: `recording.${mimeType.split('/')[1] || 'mp3'}`, // e.g., recording.mp3
    type: mimeType,
  } as any); // Type assertion needed for FormData value with file-like object

  const requestOptions: RequestInit = {
    method: 'POST',
    body: formData,
    // Note: 'Content-Type': 'multipart/form-data' is usually set automatically by fetch for FormData
    // Add any other necessary headers, like an API key if required
  };

  try {
    const data = await makeApiRequest<SttApiResponse>(STT_API_ENDPOINT, requestOptions);
    if (typeof data?.transcript !== 'string') {
      throw new Error("Transcript not found or invalid in STT API response.");
    }
    return data.transcript;
  } catch (error) {
    console.error("[sttApiService] transcribeAudioAPI: Error transcribing audio:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};