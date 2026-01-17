export const DEFAULT_BACKENDS = {
  prod: 'https://aiza-be.bin932.com:3150',
  dev: 'http://localhost:8080',
} as const;

export function getDefaultBackend(): string {
  if (typeof window === 'undefined') {
    return DEFAULT_BACKENDS.prod;
  }
  const host = window.location.host;
  if (host === 'localhost:3000') {
    return DEFAULT_BACKENDS.dev;
  }
  return DEFAULT_BACKENDS.prod;
}

// For backward compatibility
export const DEFAULT_BACKEND = DEFAULT_BACKENDS.prod;

export type BackendKey = keyof typeof DEFAULT_BACKENDS;
