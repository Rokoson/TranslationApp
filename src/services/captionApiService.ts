// Assuming you have a central config for your backend URL, similar to contentApiService
// If not, you can define BACKEND_BASE_URL here or pass it as a parameter.
// Import the generic request handler and config check from contentApiService
import { makeApiRequest } from '@/src/utils/apiUtils'; // Import from new location

/**
 * Generates a caption for a given image identifier by calling the backend API.
 * @param imageIdentifier - The unique identifier for the image (e.g., filename or ID).
 * @returns A promise that resolves to the generated caption string.
 */
export const generateCaptionAPI = async (imageIdentifier: string): Promise<string> => {
  const path = '/api/caption'; // Relative path
  const queryParams = { image_identifier: imageIdentifier };

  try {
    // makeApiRequest will handle BACKEND_BASE_URL and check configuration
    const data = await makeApiRequest<{ caption?: string }>(path, undefined, queryParams);
    if (!data?.caption) {
      // If the API succeeds but doesn't return a caption, it might be an unexpected state
      throw new Error("Caption not found in API response.");
    }
    return data.caption;
  } catch (error) {
    console.error("[captionApiService] generateCaptionAPI: Error fetching caption:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
};