/**
 * API Client with automatic token injection, error formatting, request deduplication, and SWR caching.
 */

// Normalize BASE_URL so it handles missing /api, trailing slashes, or relative /api gracefully
const RAW_URL = (import.meta.env.VITE_API_URL || '/api').trim().replace(/\/+$/, '');
const BASE_URL = RAW_URL === '' || RAW_URL === '/api' 
  ? '/api' 
  : (RAW_URL.endsWith('/api') ? RAW_URL : `${RAW_URL}/api`);

interface RequestOptions extends RequestInit {
  data?: any;
  skipCache?: boolean;
}

// In-memory cache for ultra-fast UI rendering (0ms response on navigation)
interface CacheItem {
  data: any;
  timestamp: number;
}
const apiCache = new Map<string, CacheItem>();

// In-flight promise map to deduplicate identical concurrent requests
const inFlightRequests = new Map<string, Promise<any>>();

// Cache TTL defaults: 60s for static academic meta, 15s for dynamic data
const getCacheTTL = (endpoint: string): number => {
  if (endpoint.includes('/academic/semesters') || endpoint.includes('/academic/branches')) return 60_000;
  if (endpoint.includes('/academic/sections') || endpoint.includes('/academic/subjects')) return 30_000;
  return 10_000;
};

/**
 * Invalidate cached endpoints (e.g. after a POST, PUT, or DELETE mutation)
 */
export function invalidateApiCache(prefix?: string): void {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.includes(prefix)) {
      apiCache.delete(key);
    }
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${BASE_URL}${cleanEndpoint}`;

  // 1. Check in-memory cache for GET requests
  const isGet = method === 'GET';
  const cacheKey = `${url}?${JSON.stringify(options.data || '')}`;

  if (isGet && !options.skipCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < getCacheTTL(cleanEndpoint)) {
      return cached.data as T;
    }

    // 2. In-flight request deduplication (prevent firing identical simultaneous requests)
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey) as Promise<T>;
    }
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Inject Bearer token if stored (provides fallback for Capacitor / cross-origin PWA environments)
  const storedToken = localStorage.getItem('aurora_token');
  if (storedToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${storedToken}`;
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

  const executeFetch = async (): Promise<T> => {
    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
        body,
      });

      const contentType = response.headers.get('content-type');
      let data: any;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (response.status === 401) {
        // Clear session cache on 401 Unauthorized
        localStorage.removeItem('aurora_token');
        localStorage.removeItem('aurora_user');
        localStorage.removeItem('aurora_student');
        localStorage.removeItem('aurora_admin');
        apiCache.clear();

        const errorMessage = (typeof data === 'object' && data?.error) ? data.error : 'Authentication required. Please log in.';
        const errorObj = new Error(errorMessage) as any;
        if (typeof data === 'object' && data?.code) errorObj.code = data.code;
        if (typeof data === 'object' && data?.usn) errorObj.usn = data.usn;
        throw errorObj;
      }

      if (!response.ok) {
        const errorMessage = (typeof data === 'object' && data?.error) ? data.error : `Request failed with status ${response.status}`;
        const errorObj = new Error(errorMessage) as any;
        if (typeof data === 'object' && data?.code) errorObj.code = data.code;
        if (typeof data === 'object' && data?.usn) errorObj.usn = data.usn;
        throw errorObj;
      }

      // Automatically store in cache for GET requests
      if (isGet && !options.skipCache) {
        apiCache.set(cacheKey, { data, timestamp: Date.now() });
      } else if (!isGet) {
        // Automatically invalidate related cache on mutating calls
        if (cleanEndpoint.includes('/academic/')) invalidateApiCache('/academic/');
        if (cleanEndpoint.includes('/timetable/')) invalidateApiCache('/timetable/');
        if (cleanEndpoint.includes('/attendance/')) invalidateApiCache('/attendance/');
      }

      return data as T;
    } catch (err: any) {
      if (!navigator.onLine) {
        // If offline and have stale cache, return it rather than failing
        const stale = apiCache.get(cacheKey);
        if (stale) return stale.data as T;
        throw new Error('You are currently offline. Changes will sync when reconnected.');
      }
      throw err;
    } finally {
      if (isGet) inFlightRequests.delete(cacheKey);
    }
  };

  if (isGet && !options.skipCache) {
    const fetchPromise = executeFetch();
    inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  return executeFetch();
}
