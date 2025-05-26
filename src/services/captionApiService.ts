import { Alert } from 'react-native';
// Assuming you have a central config for your backend URL, similar to contentApiService
// If not, you can define BACKEND_BASE_URL here or pass it as a parameter.
import { BACKEND_BASE_URL } from '../config/apiConfig'; // Adjust path if your apiConfig is elsewhere

/**
 * Generates a caption for a given image identifier by calling the backend API.
 * @param imageIdentifier - The unique identifier for the image (e.g., filename or ID).
 * @returns A promise that resolves to the generated caption string.
 */
export const generateCaptionAPI = async (imageIdentifier: string): Promise<string> => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL_PLACEHOLDER" || !BACKEND_BASE_URL) {
    // Fallback or alert if the URL isn't properly configured
    Alert.alert("Configuration Error", "Backend URL for captioning is not configured.");
    console.error("generateCaptionAPI: BACKEND_BASE_URL is not configured.");
    // Return a mock error or throw, depending on desired behavior
    return "Error: Captioning service URL not configured.";
  }

  // Adjust the endpoint and query parameter name as per your backend API design
  // Example: /api/caption?image_filename=your_image.jpg
  const apiUrl = `${BACKEND_BASE_URL}/api/caption?image_identifier=${encodeURIComponent(imageIdentifier)}`;
  console.log(`[captionApiService] generateCaptionAPI: Fetching from ${apiUrl}`);

  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
    }
    const data = await response.json(); // Assuming the backend returns JSON like { "caption": "..." }
    return data.caption || "No caption returned."; // Adjust based on actual response structure
  } catch (error) {
    console.error("[captionApiService] generateCaptionAPI: Error fetching caption:", error);
    throw error; // Re-throw to be handled by the caller (ImageCaptionScreen)
  }
};