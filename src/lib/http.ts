// Utilidades de fetch para el navegador: tiempo de espera y mensajes comprensibles.

export const REQUEST_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;
  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/** fetch con tiempo máximo de espera; si se agota lanza un mensaje que permite reintentar. */
export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      throw new ApiError('La solicitud tardó demasiado. Revisa tu conexión e intenta nuevamente.', 0, 'TIMEOUT');
    }
    throw new ApiError('No se pudo comunicar con el servidor. Intenta nuevamente.', 0, 'NETWORK');
  } finally {
    clearTimeout(timer);
  }
}

/** Convierte una respuesta no exitosa en un ApiError con el mensaje que envió el servidor. */
export async function throwIfNotOk(res: Response, fallbackMsg: string) {
  if (res.ok) return;
  const data = await res.json().catch(() => null);
  const message = (data && typeof data.error === 'string' && data.error) || fallbackMsg;
  throw new ApiError(message, res.status, data?.code, data);
}
