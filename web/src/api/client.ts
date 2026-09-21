// Typed HTTP Client for Humora API

const BASE_URL = '/api/v1';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
}

export const getToken = (): string | null => {
  return localStorage.getItem('humora_access_token');
};

export const setTokens = (accessToken: string, refreshToken: string) => {
  localStorage.setItem('humora_access_token', accessToken);
  localStorage.setItem('humora_refresh_token', refreshToken);
};

export const clearTokens = () => {
  localStorage.removeItem('humora_access_token');
  localStorage.removeItem('humora_refresh_token');
  localStorage.removeItem('humora_user');
};

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const json: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    message: 'Failed to parse JSON response',
    data: null as any,
  }));

  if (!response.ok || !json.success) {
    if (response.status === 401) {
      clearTokens();
    }
    throw new Error(json.message || `Request failed with status ${response.status}`);
  }

  return json.data;
}

export const api = {
  get: <T = any>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T = any>(endpoint: string, body?: any) =>
    apiRequest<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = any>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
  upload: async <T = any>(endpoint: string, formData: FormData): Promise<T> => {
    const token = getToken();
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    const json: ApiResponse<T> = await response.json().catch(() => ({
      success: false,
      message: 'Failed to parse JSON response',
      data: null as any,
    }));

    if (!response.ok || !json.success) {
      if (response.status === 401) {
        clearTokens();
      }
      throw new Error(json.message || `Upload failed with status ${response.status}`);
    }

    return json.data;
  },
};
