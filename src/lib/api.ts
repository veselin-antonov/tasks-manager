export interface Task {
  id: string;
  name: string;
  link: string;
  lastFailed: string | null;
}

interface ApiError {
  error: string;
}

interface ListTasksResponse {
  tasks: Task[];
}

interface SingleTaskResponse {
  task: Task;
}

interface SolveTaskResponse {
  ok: true;
}

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim();

function isPlaceholder(value: string): boolean {
  return value.startsWith('<') && value.endsWith('>');
}

export function getApiConfigError(): string | null {
  if (!API_URL) {
    return null;
  }

  if (isPlaceholder(API_URL)) {
    return 'Set VITE_API_URL in .env.local to your backend URL.';
  }

  try {
    new URL(API_URL);
  } catch {
    return 'VITE_API_URL must be a valid URL.';
  }

  return null;
}

function getBaseApiUrl(): string {
  const configError = getApiConfigError();

  if (configError) {
    throw new Error(configError);
  }

  if (API_URL) {
    return API_URL;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:3001';
}

function createUrl(path: string): string {
  const base = new URL(getBaseApiUrl());
  return new URL(path, base).toString();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(createUrl(path), init);
  } catch {
    throw new Error(
      'Cannot reach the API server. Start it with `npm run dev` or `npm run start`.',
    );
  }

  const data: unknown = await response.json();

  if (!response.ok) {
    if (data && typeof data === 'object' && 'error' in data) {
      throw new Error(String((data as ApiError).error));
    }

    throw new Error(`Request failed with status ${response.status}.`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid API response.');
  }

  if ('error' in data && typeof (data as ApiError).error === 'string') {
    throw new Error((data as ApiError).error);
  }

  return data as T;
}

export const api = {
  list: () => request<ListTasksResponse>('/api/tasks'),
  add: (name: string, link: string) =>
    request<SingleTaskResponse>('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, link }),
    }),
  fail: (id: string) =>
    request<SingleTaskResponse>(`/api/tasks/${encodeURIComponent(id)}/fail`, {
      method: 'POST',
    }),
  updateLastFailed: (id: string, lastFailed: string | null) =>
    request<SingleTaskResponse>(
      `/api/tasks/${encodeURIComponent(id)}/last-failed`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastFailed }),
      },
    ),
  solve: (id: string) =>
    request<SolveTaskResponse>(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
};
