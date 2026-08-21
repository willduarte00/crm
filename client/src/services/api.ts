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

/**
 * Mensagens padrão por status. Evita que o texto bruto devolvido pelo
 * servidor (uma página HTML de erro do proxy, um stack trace) chegue à tela.
 */
const STATUS_MESSAGES: Record<number, string> = {
  400: 'Os dados enviados são inválidos. Revise os campos e tente novamente.',
  401: 'Sua sessão expirou. Entre novamente para continuar.',
  403: 'Você não tem permissão para executar esta ação.',
  404: 'O registro não foi encontrado. Ele pode ter sido removido.',
  409: 'Este registro entra em conflito com outro já existente.',
  413: 'O arquivo enviado excede o tamanho máximo permitido.',
  422: 'Não foi possível concluir a operação com estes dados.',
  429: 'Muitas tentativas em sequência. Aguarde alguns instantes.',
  500: 'O servidor encontrou um erro. Tente novamente em instantes.',
  502: 'O servidor está indisponível no momento. Tente novamente em instantes.',
  503: 'O servidor está indisponível no momento. Tente novamente em instantes.',
};

function messageForStatus(status: number): string {
  return (
    STATUS_MESSAGES[status] ||
    (status >= 500
      ? 'O servidor encontrou um erro. Tente novamente em instantes.'
      : 'Não foi possível concluir a operação.')
  );
}

/**
 * Aceita apenas mensagens curtas em texto simples vindas do backend.
 * Qualquer coisa que pareça HTML ou um despejo técnico é descartada em
 * favor da mensagem genérica do status.
 */
function sanitizeServerMessage(value: unknown, status: number): string {
  if (typeof value !== 'string') return messageForStatus(status);
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return messageForStatus(status);
  if (/[<>]/.test(trimmed)) return messageForStatus(status);
  if (/\b(at\s+\w+\s+\(|Error:|node_modules|\/app\/|prisma\.)/i.test(trimmed)) {
    return messageForStatus(status);
  }
  return trimmed;
}

/** Evita disparar várias navegações para /login em requisições paralelas. */
let isRedirectingToLogin = false;

function redirectToLogin() {
  if (isRedirectingToLogin) return;
  if (window.location.pathname === '/login') return;
  isRedirectingToLogin = true;
  window.location.replace('/login');
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;
  if (!headers.has('Content-Type') && !isFormData) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Envia cookies httpOnly
    });
  } catch {
    // Falha de rede: nunca há resposta HTTP para inspecionar.
    throw new AppApiError(0, {
      error: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
    });
  }

  // Interceptor de 401: sessão expirada ou revogada (tokenVersion).
  // Login e /me tratam o 401 localmente e não devem redirecionar.
  if (response.status === 401) {
    const isLogin = url.includes('/api/auth/login');
    const isMe = url.includes('/api/auth/me');
    if (!isLogin && !isMe) {
      redirectToLogin();
    }
  }

  let data: unknown;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else {
    data = await response.text().catch(() => '');
  }

  if (!response.ok) {
    const payload =
      data && typeof data === 'object'
        ? (data as ApiError)
        : ({ error: data } as ApiError);

    throw new AppApiError(response.status, {
      ...payload,
      error: sanitizeServerMessage(payload?.error, response.status),
    });
  }

  return data as T;
}

/**
 * Baixa um arquivo protegido por sessão e entrega ao navegador.
 * Passa pelo mesmo tratamento de erro/401 das demais requisições, em vez
 * de navegar para a URL e deixar o navegador exibir um JSON de erro.
 */
export async function apiDownload(url: string, fallbackFileName: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, { credentials: 'include' });
  } catch {
    throw new AppApiError(0, {
      error: 'Sem conexão com o servidor. Verifique sua internet e tente novamente.',
    });
  }

  if (response.status === 401) {
    redirectToLogin();
  }

  if (!response.ok) {
    throw new AppApiError(response.status, { error: messageForStatus(response.status) });
  }

  // Prefere o nome sugerido pelo servidor no Content-Disposition.
  const disposition = response.headers.get('content-disposition') || '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const fileName = match ? decodeURIComponent(match[1]) : fallbackFileName;

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

/** Extrai uma mensagem segura de qualquer erro para exibir ao usuário. */
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof AppApiError) {
    return err.data.error || fallback;
  }
  return fallback;
}
