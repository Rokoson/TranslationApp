import { TRANSLATE_API_ENDPOINT } from '../config/apiConfig';

export const translateToYorubaAPI = async (text: string): Promise<string> => {
  if (!text.trim()) {
    return "";
  }
  console.log(`API CALL: Translating "${text}" to Yoruba using ${TRANSLATE_API_ENDPOINT}`);

  try {
    const response = await fetch(TRANSLATE_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any other necessary headers here, like an API key if required
        // 'Authorization': 'Bearer YOUR_API_KEY',
      },
      body: JSON.stringify({
        text: text,       // The text to translate
        source_lang: 'EN', // Source language
        target_lang: 'YO', // Target language (Yoruba)
      }),
    });

    if (!response.ok) {
      const errorData = await response.text(); // Or response.json() if error details are in JSON
      console.error("API Error Response:", errorData);
      throw new Error(`API request failed: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.translated_text;
    
    return translatedText || `Error: Could not find translation in response for "${text}"`;
  } catch (error) {
    console.error("Error during translation API call:", error);
    return `Error translating: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};