'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useServerConfig, ServiceConfig } from './ServerConfigContext';

interface PendingAuth {
  serverId: string;
  service: 'api' | 'analytics';
  codeVerifier: string;
  tokenEndpoint: string;
  clientId: string;
}

interface AuthContextValue {
  isLoggedIn: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getAccessToken: (service?: 'api' | 'analytics') => Promise<string | null>;
  handleOAuthCallback: (code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const RANDOM_CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateRandomString(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += RANDOM_CHARSET[Math.floor(Math.random() * RANDOM_CHARSET.length)];
  }
  return result;
}

async function sha256AndBase64(input: string): Promise<string> {
  const buffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const bytes = new Uint8Array(hashBuffer);
  const binary = String.fromCharCode(...bytes);
  const base64String = btoa(binary);
  return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function parseJwtPayload(token: string): { iss: string; exp: number; client_id: string } {
  const parts = token.split('.');
  return JSON.parse(atob(parts[1]));
}

function getStoredTokens(): any[] {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('aiza_tokens') || '[]');
}

function setStoredTokens(tokens: any[]): void {
  localStorage.setItem('aiza_tokens', JSON.stringify(tokens));
}

function findTokenIndex(tokens: any[], issuer: string, clientId: string): number {
  return tokens.findIndex((t: any) => {
    const payload = parseJwtPayload(t.access_token);
    return payload.iss === issuer && payload.client_id === clientId;
  });
}

function isTokenValid(token: any): boolean {
  try {
    const { exp } = parseJwtPayload(token.access_token);
    return exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

function mergeToken(tokens: any[], newToken: any): any[] {
  const payload = parseJwtPayload(newToken.access_token);
  const index = findTokenIndex(tokens, payload.iss, payload.client_id);

  if (index >= 0) {
    const result = [...tokens];
    result[index] = newToken;
    return result;
  }
  return [...tokens, newToken];
}

function removeToken(issuer: string, clientId: string): void {
  const tokens = getStoredTokens().filter((t: any) => {
    const payload = parseJwtPayload(t.access_token);
    return !(payload.iss === issuer && payload.client_id === clientId);
  });
  setStoredTokens(tokens);
}

function getRedirectUri(): string {
  return `${location.protocol}//${location.host}/cognito_redirect`;
}

async function exchangeAuthCode(
  tokenEndpoint: string,
  clientId: string,
  code: string,
  codeVerifier: string
): Promise<any> {
  const formData = new URLSearchParams();
  formData.append('redirect_uri', getRedirectUri());
  formData.append('client_id', clientId);
  formData.append('code', code);
  formData.append('grant_type', 'authorization_code');
  formData.append('code_verifier', codeVerifier);

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  return response.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { serverId, aizaJson, openIdConfig } = useServerConfig();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const silentAuthInProgress = useRef<Map<string, Promise<string | null>>>(new Map());

  const apiService = aizaJson?.api;
  const analyticsService = aizaJson?.analytics;
  const { issuer, token_endpoint, authorization_endpoint, end_session_endpoint } = openIdConfig ?? {};

  const checkLoginStatus = useCallback((service?: ServiceConfig): boolean => {
    if (!issuer || !service) return false;
    const tokens = getStoredTokens();
    const index = findTokenIndex(tokens, issuer, service.client_id);
    return index >= 0 && isTokenValid(tokens[index]);
  }, [issuer]);

  useEffect(() => {
    setIsLoggedIn(checkLoginStatus(apiService));
  }, [apiService, checkLoginStatus]);

  useEffect(() => {
    function handleStorageChange(event: StorageEvent): void {
      if (event.key === 'aiza_tokens') {
        setIsLoggedIn(checkLoginStatus(apiService));
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [apiService, checkLoginStatus]);

  useEffect(() => {
    const REFRESH_THRESHOLD_MS = 60 * 1000;

    async function handleVisibilityChange(): Promise<void> {
      if (document.visibilityState !== 'visible') return;
      if (!apiService || !issuer || !token_endpoint) return;

      const tokens = getStoredTokens();
      const tokenIndex = findTokenIndex(tokens, issuer, apiService.client_id);

      if (tokenIndex < 0) {
        setIsLoggedIn(false);
        return;
      }

      const token = tokens[tokenIndex];
      try {
        const { exp } = parseJwtPayload(token.access_token);
        const expiresIn = exp * 1000 - Date.now();
        const shouldRefresh = expiresIn < REFRESH_THRESHOLD_MS && expiresIn > 0 && token.refresh_token;

        if (shouldRefresh) {
          const formData = new URLSearchParams();
          formData.append('grant_type', 'refresh_token');
          formData.append('client_id', apiService.client_id);
          formData.append('refresh_token', token.refresh_token);

          const response = await fetch(token_endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData,
          });

          if (response.ok) {
            const newToken = await response.json();
            tokens[tokenIndex].access_token = newToken.access_token;
            tokens[tokenIndex].id_token = newToken.id_token;
            setStoredTokens(tokens);
            setIsLoggedIn(true);
            return;
          }
        }

        setIsLoggedIn(isTokenValid(token));
      } catch {
        setIsLoggedIn(false);
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [apiService, issuer, token_endpoint]);

  const login = useCallback(async () => {
    if (!serverId || !authorization_endpoint || !token_endpoint || !apiService) {
      throw new Error('Backend not configured');
    }

    const codeVerifier = generateRandomString(40);
    const codeChallenge = await sha256AndBase64(codeVerifier);

    const pendingAuth: PendingAuth = {
      serverId,
      service: 'api',
      codeVerifier,
      tokenEndpoint: token_endpoint,
      clientId: apiService.client_id,
    };
    localStorage.setItem('aiza_pending_auth', JSON.stringify(pendingAuth));

    const url = new URL(authorization_endpoint);
    url.searchParams.set('client_id', apiService.client_id);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email');
    url.searchParams.set('redirect_uri', getRedirectUri());
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    location.assign(url.toString());
  }, [serverId, authorization_endpoint, token_endpoint, apiService]);

  const logout = useCallback(async () => {
    if (!issuer || !end_session_endpoint || !apiService) {
      throw new Error('Backend not configured');
    }

    removeToken(issuer, apiService.client_id);

    const logoutUrl = `${location.protocol}//${location.host}`;
    const url = new URL(end_session_endpoint);
    url.searchParams.set('client_id', apiService.client_id);
    url.searchParams.set('logout_uri', logoutUrl);

    location.assign(url.toString());
  }, [issuer, end_session_endpoint, apiService]);

  const handleOAuthCallback = useCallback(async (code: string) => {
    const pendingAuthStr = localStorage.getItem('aiza_pending_auth');
    if (!pendingAuthStr) {
      throw new Error('No pending authentication found');
    }

    const pendingAuth: PendingAuth = JSON.parse(pendingAuthStr);

    const token = await exchangeAuthCode(
      pendingAuth.tokenEndpoint,
      pendingAuth.clientId,
      code,
      pendingAuth.codeVerifier
    );

    const tokens = getStoredTokens();
    const merged = mergeToken(tokens, token);
    setStoredTokens(merged);

    localStorage.removeItem('aiza_pending_auth');
    setIsLoggedIn(true);
  }, []);

  const trySilentAuth = useCallback(async (service: ServiceConfig): Promise<string | null> => {
    if (!serverId || !authorization_endpoint || !token_endpoint) return null;

    const cacheKey = `${serverId}:${service.client_id}`;

    const existingPromise = silentAuthInProgress.current.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    const silentAuthPromise = (async (): Promise<string | null> => {
      try {
        const codeVerifier = generateRandomString(40);
        const codeChallenge = await sha256AndBase64(codeVerifier);
        const redirectUri = getRedirectUri();
        const state = generateRandomString(16);

        const url = new URL(authorization_endpoint);
        url.searchParams.set('client_id', service.client_id);
        url.searchParams.set('response_type', 'code');
        url.searchParams.set('scope', 'openid email');
        url.searchParams.set('redirect_uri', redirectUri);
        url.searchParams.set('code_challenge', codeChallenge);
        url.searchParams.set('code_challenge_method', 'S256');
        url.searchParams.set('prompt', 'none');
        url.searchParams.set('state', state);

        return await new Promise<string | null>((resolve) => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';

          function cleanup(): void {
            window.removeEventListener('message', messageHandler);
            if (iframe.parentNode) {
              iframe.parentNode.removeChild(iframe);
            }
            silentAuthInProgress.current.delete(cacheKey);
          }

          const timeout = setTimeout(() => {
            cleanup();
            resolve(null);
          }, 10000);

          async function messageHandler(event: MessageEvent): Promise<void> {
            if (event.origin !== location.origin) return;

            const data = event.data;
            if (data?.type !== 'oauth_callback' || data?.state !== state) return;

            clearTimeout(timeout);

            if (data.error || !data.code) {
              cleanup();
              resolve(null);
              return;
            }

            try {
              const token = await exchangeAuthCode(
                token_endpoint!,
                service.client_id,
                data.code,
                codeVerifier
              );

              const tokens = getStoredTokens();
              const merged = mergeToken(tokens, token);
              setStoredTokens(merged);

              cleanup();
              resolve(token.access_token);
            } catch {
              cleanup();
              resolve(null);
            }
          }

          window.addEventListener('message', messageHandler);
          document.body.appendChild(iframe);
          iframe.src = url.toString();
        });
      } catch {
        silentAuthInProgress.current.delete(cacheKey);
        return null;
      }
    })();

    silentAuthInProgress.current.set(cacheKey, silentAuthPromise);
    return silentAuthPromise;
  }, [serverId, authorization_endpoint, token_endpoint]);

  const refreshToken = useCallback(async (
    token: any,
    service: ServiceConfig
  ): Promise<any | null> => {
    if (!token_endpoint) return null;

    try {
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('client_id', service.client_id);
      formData.append('refresh_token', token.refresh_token);

      const response = await fetch(token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData,
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch {
      return null;
    }
  }, [token_endpoint]);

  const getAccessToken = useCallback(async (serviceName: 'api' | 'analytics' = 'api'): Promise<string | null> => {
    if (!issuer) return null;

    const service = serviceName === 'api' ? apiService : analyticsService;
    if (!service) return null;

    const tokens = getStoredTokens();
    const tokenIndex = findTokenIndex(tokens, issuer, service.client_id);

    if (tokenIndex >= 0) {
      const token = tokens[tokenIndex];

      if (isTokenValid(token)) {
        return token.access_token;
      }

      if (token.refresh_token) {
        const newToken = await refreshToken(token, service);
        if (newToken) {
          tokens[tokenIndex].access_token = newToken.access_token;
          tokens[tokenIndex].id_token = newToken.id_token;
          setStoredTokens(tokens);
          if (serviceName === 'api') {
            setIsLoggedIn(true);
          }
          return newToken.access_token;
        }
      }

      removeToken(issuer, service.client_id);
      if (serviceName === 'api') {
        setIsLoggedIn(false);
      }
    }

    if (serviceName !== 'api') {
      return await trySilentAuth(service);
    }

    return null;
  }, [issuer, apiService, analyticsService, refreshToken, trySilentAuth]);

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        login,
        logout,
        getAccessToken,
        handleOAuthCallback,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
