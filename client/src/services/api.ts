import { ApiError } from '../types';

export class AppApiError extends Error {
  status: number;
  data: ApiError;

  constructor(status: number, data: ApiError) {
    super(data.error || 'Erro na requisição');
    this.name = 'AppApiError';
    this.status = status;
    this.data = data;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Envia cookies httpOnly
  });

  // Interceptor de 401: se for desautenticado e não for a rota de login ou verificação inicial /me
  if (response.status === 401) {
    const isLogin = url.includes('/api/auth/login');
    const isMe = url.includes('/api/auth/me');
    if (!isLogin && !isMe) {
      window.location.href = '/login';
    }
  }

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    throw new AppApiError(
      response.status,
      typeof data === 'object' ? data : { error: data || response.statusText }
    );
  }

  return data as T;
}
