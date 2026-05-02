import type { Document, Signer, SignerInput, SigningSession, SignaturePayload } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type to JSON if not already set (FormData sets its own)
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const documentsApi = {
  list: (token: string) =>
    apiFetch<{ data: Document[] }>('/api/documents', {}, token),

  upload: (token: string, formData: FormData) =>
    apiFetch<{ data: Document }>('/api/documents', {
      method: 'POST',
      body: formData,
      headers: { Authorization: `Bearer ${token}` },
    }),

  get: (token: string, id: string) =>
    apiFetch<{ data: Document }>(`/api/documents/${id}`, {}, token),

  delete: (token: string, id: string) =>
    apiFetch<void>(`/api/documents/${id}`, { method: 'DELETE' }, token),

  addSigners: (token: string, id: string, signers: SignerInput[]) =>
    apiFetch<{ data: Signer[] }>(`/api/documents/${id}/signers`, {
      method: 'POST',
      body: JSON.stringify({ signers }),
    }, token),

  send: (token: string, id: string) =>
    apiFetch<{ message: string }>(`/api/documents/${id}/send`, { method: 'POST' }, token),

  getDownloadUrl: (token: string, id: string) =>
    apiFetch<{ data: { url: string } }>(`/api/documents/${id}/download`, {}, token),
};

export const signApi = {
  getSession: (token: string) =>
    apiFetch<{ data: SigningSession }>(`/api/sign/${token}`),

  submit: (token: string, placements: SignaturePayload[]) =>
    apiFetch<{ data: { success: boolean; completed: boolean } }>(`/api/sign/${token}`, {
      method: 'POST',
      body: JSON.stringify({ placements }),
    }),
};
