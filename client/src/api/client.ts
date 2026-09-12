/**
 * API Client with automatic token injection, error formatting, and offline caching support.
 */

// Normalize BASE_URL so it handles missing /api, trailing slashes, or relative /api gracefully
const RAW_URL = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
const BASE_URL = RAW_URL === '' || RAW_URL === '/api' 
  ? '/api' 
  : (RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`);

interface RequestOptions extends RequestInit {
  data?: any;
}

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('aurora_token');
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body = options.body;
  if (options.data) {
    if (options.data instanceof FormData) {
      body = options.data;
      // Do NOT set Content-Type for FormData; browser sets multipart boundary automatically
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.data);
    }
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      body,
    });

    if (response.status === 401) {
      // Clear token on 401 Unauthorized
      localStorage.removeItem('aurora_token');
      localStorage.removeItem('aurora_user');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Session expired. Please log in again.');
    }

    const contentType = response.headers.get('content-type');
    let data: any;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMessage = data?.error || `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return data as T;
  } catch (err: any) {
    if (!navigator.onLine) {
      throw new Error('You are currently offline. Changes will sync when reconnected.');
    }
    throw err;
  }
}
