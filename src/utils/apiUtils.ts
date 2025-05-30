import { BACKEND_BASE_URL } from '@/src/config/apiConfig';

// Custom error for configuration issues
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

// Helper function to check backend URL configuration
const checkBackendUrlConfiguration = (): void => {
  if (BACKEND_BASE_URL === "BACKEND_BASE_URL" || !BACKEND_BASE_URL) {
    // Throw a custom error instead of calling Alert directly
    throw new ConfigurationError("Backend URL not configured. Please set your BACKEND_BASE_URL.");
  }
};

// Generic API request helper
export async function makeApiRequest<T>(
  urlOrPath: string,
  requestOptions?: RequestInit, // For method, headers, body, etc.
  queryParams?: Record<string, string | number | null | undefined> // Primarily for GET request query params
): Promise<T> {
  let apiUrl = urlOrPath;

  // Check if urlOrPath is a relative path and needs BACKEND_BASE_URL
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    checkBackendUrlConfiguration(); // Check config only if using the relative path with base URL
    apiUrl = `${BACKEND_BASE_URL}${urlOrPath}`;
  }

  // Append query parameters if provided.
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        params.append(key, String(value));
      }
    });
    const queryString = params.toString();
    if (queryString) {
      apiUrl += (apiUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  console.log(`[apiUtils] makeApiRequest: Fetching from ${apiUrl}`);
  try {
    const response = await fetch(apiUrl, requestOptions);
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`[apiUtils] makeApiRequest: HTTP error for ${apiUrl}! Status: ${response.status}, Message: ${errorData}`);
      const httpError = new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      (httpError as any).status = response.status; // Optionally attach status code
      throw httpError;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return await response.json() as T;
  } catch (error) {
    // Log the error here as it's a central point, but still re-throw
    // to let the specific service or UI handle it further if needed.
    console.error(`[apiUtils] makeApiRequest: Error during API request to ${apiUrl}:`, error);
    throw error;
  }
}