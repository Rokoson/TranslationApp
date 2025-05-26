import { Alert } from 'react-native';
// Assuming you have a central config for your backend URL
import { BACKEND_BASE_URL } from '../config/apiConfig'; // Adjust path if your apiConfig is elsewhere

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


/**
 * Fetches image metadata from the server.
 * The component will then construct the full image URL.
 */
export const fetchServerImageMetadata = async (limit: number, offset: number, category?: string | null): Promise<ServerImageMetadata[]> => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL" || !BACKEND_BASE_URL) { // Added check for unconfigured URL
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL.");
    throw new Error("Backend URL not configured.");
  }

  let apiUrl = `${BACKEND_BASE_URL}/api/image_metadata?limit=${limit}&offset=${offset}`;
  if (category) {
    apiUrl += `&filter_term=${encodeURIComponent(category)}`;
  }
  console.log(`[contentApiService] fetchServerImageMetadata: Fetching from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
    }
    const metadataList: ServerImageMetadata[] = await response.json();
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

  } catch (error) {
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
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL" || !BACKEND_BASE_URL) {
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL.");
    throw new Error("Backend URL not configured.");
  }
  let apiUrl = `${BACKEND_BASE_URL}/api/sentences?limit=${limit}&offset=${offset}`;
  if (category) {
    apiUrl += `&filter_term=${encodeURIComponent(category)}`; // Assuming backend uses 'filter_term'
  }
  console.log(`[contentApiService] fetchServerSentences: Fetching from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[contentApiService] fetchServerSentences: Error fetching sentences:", error);
    throw error; // Re-throw to be handled by the caller
  }
};

/**
 * Fetches available sentence categories from the server.
 */
export const fetchAvailableCategories = async (): Promise<CategoryInfo[]> => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL" || !BACKEND_BASE_URL) {
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL.");
    throw new Error("Backend URL not configured.");
  }
  const apiUrl = `${BACKEND_BASE_URL}/api/sentence-categories`; // Adjust endpoint if different
  console.log(`[contentApiService] fetchAvailableCategories: Fetching from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[contentApiService] fetchAvailableCategories: Error fetching categories:", error);
    throw error; // Re-throw to be handled by the caller
  }
};

/**
 * Fetches available image categories from the server.
 */
export const fetchAvailableImageCategories = async (): Promise<CategoryInfo[]> => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL" || !BACKEND_BASE_URL) {
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL.");
    throw new Error("Backend URL not configured.");
  }
  const apiUrl = `${BACKEND_BASE_URL}/api/image-categories`; // Endpoint for image categories
  console.log(`[contentApiService] fetchAvailableImageCategories: Fetching from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("[contentApiService] fetchAvailableImageCategories: Error fetching image categories:", error);
    throw error; // Re-throw to be handled by the caller
  }
};
