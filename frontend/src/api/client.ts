const API_URL = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`

/** Erro de validação do FastAPI (422) para um campo específico. */
export interface FieldError {
  field: string
  message: string
}

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldError[]

  constructor(status: number, message: string, fieldErrors: FieldError[] = []) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

interface PydanticError {
  loc: (string | number)[]
  msg: string
}

function parseError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return new ApiError(status, detail)
  if (Array.isArray(detail)) {
    const fieldErrors = (detail as PydanticError[]).map((error) => ({
      // loc = ["body", "campo", ...]; erros de modelo inteiro vêm sem campo.
      field: error.loc.filter((part) => part !== 'body').join('.'),
      message: error.msg.replace(/^Value error, /, ''),
    }))
    return new ApiError(status, fieldErrors[0]?.message ?? 'Dados inválidos', fieldErrors)
  }
  if (status >= 500) return new ApiError(status, 'Erro no servidor. Tente novamente.')
  return new ApiError(status, `Falha na requisição (${status})`)
}

type QueryValue = string | number | undefined | null

export async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; query?: Record<string, QueryValue> } = {},
): Promise<T> {
  const url = new URL(`${API_URL}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    throw new ApiError(0, 'Não foi possível conectar à API. O backend está rodando?')
  }

  if (response.status === 204) return undefined as T
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) throw parseError(response.status, body)
  return body as T
}
