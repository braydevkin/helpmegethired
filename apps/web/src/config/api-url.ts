const DEFAULT_API_URL = "http://localhost:3001";

export const apiUrl = process.env.API_URL ?? DEFAULT_API_URL;

// The browser cannot resolve the compose network's `api` host, so the page sends the Model Key
// to the address the API is published on.
export const apiPublicUrl = process.env.API_PUBLIC_URL ?? DEFAULT_API_URL;
