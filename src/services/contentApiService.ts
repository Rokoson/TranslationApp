// Assuming you have a central config for your backend URL
import { BACKEND_BASE_URL } from '@/src/config/apiConfig'; // Adjust path if your apiConfig is elsewhere
import { ConfigurationError, makeApiRequest } from '@/src/utils/apiUtils'; // Import from new location

// Interface for the metadata of images fetched from the server
export interface ServerImageMetadata {
  id?: string | number; // Optional ID, can be added by frontend if missing
  image_key: string;
  english_caption: string;
  asset_filename: string;
  url?: string; // To store the fully constructed URL for the image
  category?: string; // If your image metadata includes a category
}

// Interface for sentences fetched from the server
export interface ServerSentence {
  id: string | number;
  sentence: string;
  category?: string; // Optional: if your sentences from server also include category
}

// Interface for category data fetched from the server (used for both sentence and image categories)
export interface CategoryInfo {
  value: string;        // The raw value for API filtering (e.g., "common_phr")
  displayName: string;  // The user-friendly name for display (e.g., "Common Phrases")
}

// Export ConfigurationError so UI can catch it specifically if needed
export { ConfigurationError };

/**
 * Fetches image metadata from the server.
 * The component will then construct the full image URL.
 */
export const fetchServerImageMetadata = async (limit: number, offset: number, category?: string | null): Promise<ServerImageMetadata[]> => {
  const queryParams = { limit, offset, filter_term: category };

  try {
    const metadataList = await makeApiRequest<ServerImageMetadata[]>('/api/image_metadata', undefined, queryParams);
    console.log("[contentApiService] fetchServerImageMetadata: Received metadata:", metadataList);

    // Filter for valid data first
    const validMetadata = metadataList.filter(meta =>
      meta.image_key && typeof meta.image_key === 'string' && meta.image_key.trim() !== "" &&
      meta.asset_filename && typeof meta.asset_filename === 'string' && meta.asset_filename.trim() !== "" &&
      meta.asset_filename?.trim().toLowerCase() !== "undefined"
    );

    // Then, construct the full URL for each valid metadata object
    return validMetadata.map(meta => ({
      ...meta,
      url: `${BACKEND_BASE_URL}/api/images/${encodeURIComponent(meta.asset_filename)}`
    }));

  } catch (error) { // Catching potential errors from makeApiRequest or subsequent processing
    console.error("[contentApiService] fetchServerImageMetadata: Error fetching image metadata:", error);
    throw error; // Re-throw to be handled by the caller
  }
};

/**
 * Fetches sentences from the server.
 */
export const fetchServerSentences = async (
  limit: number,
  offset: number,
  category?: string | null
): Promise<ServerSentence[]> => {
  const queryParams = { limit, offset, filter_term: category };
  // Assuming backend uses 'filter_term' for category filtering
  return makeApiRequest<ServerSentence[]>('/api/sentences', undefined, queryParams);
};

/**
 * Fetches available sentence categories from the server.
 */
export const fetchAvailableCategories = async (): Promise<CategoryInfo[]> => {
  // Adjust endpoint if different, e.g., '/api/categories/sentence'
  return makeApiRequest<CategoryInfo[]>('/api/sentence-categories');
};

/**
 * Fetches available image categories from the server.
 */
export const fetchAvailableImageCategories = async (): Promise<CategoryInfo[]> => {
  // Adjust endpoint if different, e.g., '/api/categories/image'
  return makeApiRequest<CategoryInfo[]>('/api/image-categories');
};
