import { BACKEND_BASE_URL } from "@/src/config/apiConfig";
import { Alert } from "react-native";

// Interface for the metadata of images fetched from the server
export interface ServerImageMetadata {
  id?: string | number; // Optional ID, can be added by frontend if missing
  image_key: string;
  english_caption: string;
  asset_filename: string;
  url?: string; // To store the fully constructed URL for the image
}

// Interface for sentences fetched from the server
export interface ServerSentence {
  id: string | number;
  sentence: string;
  category?: string; // Optional: if your sentences from server also include category
}
// Interface for category data fetched from the server
export interface CategoryInfo {
  value: string;
  displayName: string;
}

/**
 * Fetches image metadata from the server.
 * The component will then construct the full image URL.
 */
export const fetchServerImageMetadata = async (limit: number, offset: number): Promise<ServerImageMetadata[]> => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL") {
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL.");
    throw new Error("Backend URL not configured.");
  }
  // Append limit and offset if your backend supports them for this endpoint
  // If not, they are ignored by the backend but the frontend call is consistent.
  // Example: const apiUrl = `${BACKEND_BASE_URL}/api/image_metadata?limit=${limit}&offset=${offset}`;
  const apiUrl = `${BACKEND_BASE_URL}/api/image_metadata`; // Current: no limit/offset sent
  console.log(`[contentApiService] fetchServerImageMetadata: Fetching from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
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
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL") {
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL.");
    throw new Error("Backend URL not configured.");
  }
  let apiUrl = `${BACKEND_BASE_URL}/api/sentences?limit=${limit}&offset=${offset}`;
  try {
    if (category) {
      //apiUrl += `&category=${encodeURIComponent(category)}`;
      apiUrl += `&filter_term=${encodeURIComponent(category)}`;
    }
    console.log(`[contentApiService] fetchServerSentences: Fetching from ${apiUrl}`); // Moved log to after category is appended
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
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL") {
    Alert.alert("Configuration Needed", "Please set your BACKEND_BASE_URL.");
    throw new Error("Backend URL not configured.");
  }
  // Ensure this endpoint matches your backend route for categories
  const apiUrl = `${BACKEND_BASE_URL}/api/sentence-categories`; 
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