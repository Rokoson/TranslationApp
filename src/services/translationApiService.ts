import { TRANSLATE_API_ENDPOINT } from '@/src/config/apiConfig';
import { makeApiRequest } from '@/src/utils/apiUtils'; // Import from new location

export const translateToYorubaAPI = async (text: string): Promise<string> => {
  if (!text.trim()) {
    // Throw an error for invalid input
    throw new Error("Input text cannot be empty for translation.");
  }
  console.log(`API CALL: Translating "${text}" to Yoruba using ${TRANSLATE_API_ENDPOINT}`);

  try {
    const requestOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any other necessary headers here, like an API key if required
        // 'Authorization': 'Bearer YOUR_API_KEY',
      },
      body: JSON.stringify({
        text: text,        // The text to translate
        source_lang: 'EN', // Source language
        target_lang: 'YO', // Target language (Yoruba)
      }),
    };

    // Assuming TRANSLATE_API_ENDPOINT is a full URL
    const data = await makeApiRequest<{ translated_text?: string }>(TRANSLATE_API_ENDPOINT, requestOptions);
    const translatedText = data?.translated_text;
    if (typeof translatedText !== 'string') { // Check if it's a string, could be empty which is valid
      throw new Error(`Translated text not found or invalid in API response for "${text}".`);
    }
    return translatedText;
  } catch (error) {
    console.error("Error during translation API call:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};