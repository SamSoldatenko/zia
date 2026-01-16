'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useServerConfig, ServiceConfig } from './ServerConfigContext';

interface PendingAuth {
  serverId: string;
  service: string;
  codeVerifier: string;
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
  return JSON.parse(localStorage.getItem('zia_tokens') || '[]');
}

function setStoredTokens(tokens: any[]): void {
  localStorage.setItem('zia_tokens', JSON.stringify(tokens));
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
  const { serverId, serverConfig, getService } = useServerConfig();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const silentAuthInProgress = useRef<Map<string, Promise<string | null>>>(new Map());

  const checkLoginStatus = useCallback((service?: ServiceConfig) => {
    if (!serverConfig || !service) return false;
    const tokens = getStoredTokens();
    const index = findTokenIndex(tokens, serverConfig.issuer, service.client_id);
    return index >= 0 && isTokenValid(tokens[index]);
  }, [serverConfig]);

  useEffect(() => {
    const apiService = getService('api');
    setIsLoggedIn(checkLoginStatus(apiService || undefined));
  }, [serverConfig, getService, checkLoginStatus]);

  const login = useCallback(async () => {
    if (!serverConfig || !serverId) {
      throw new Error('Backend not configured');
    }

    const service = getService('api');
    if (!service) {
      throw new Error('API service not available');
    }

    const codeVerifier = generateRandomString(40);
    const codeChallenge = await sha256AndBase64(codeVerifier);

    const pendingAuth: PendingAuth = {
      serverId,
      service: 'api',
      codeVerifier,
    };
    localStorage.setItem('zia_pending_auth', JSON.stringify(pendingAuth));

    const url = new URL(serverConfig.authorizationEndpoint);
    url.searchParams.set('client_id', service.client_id);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email');
    url.searchParams.set('redirect_uri', getRedirectUri());
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    location.assign(url.toString());
  }, [serverConfig, serverId, getService]);

  const logout = useCallback(async () => {
    if (!serverConfig) {
      throw new Error('Backend not configured');
    }

    const service = getService('api');
    if (!service) {
      throw new Error('API service not available');
    }

    removeToken(serverConfig.issuer, service.client_id);

    const logoutUrl = `${location.protocol}//${location.host}`;
    const url = new URL(serverConfig.endSessionEndpoint);
    url.searchParams.set('client_id', service.client_id);
    url.searchParams.set('logout_uri', logoutUrl);

    location.assign(url.toString());
  }, [serverConfig, getService]);

  const handleOAuthCallback = useCallback(async (code: string) => {
    const pendingAuthStr = localStorage.getItem('zia_pending_auth');
    if (!pendingAuthStr) {
      throw new Error('No pending authentication found');
    }

    const pendingAuth: PendingAuth = JSON.parse(pendingAuthStr);
    const storedBackendUrl = localStorage.getItem('zia_current_backend');

    if (!storedBackendUrl) {
      throw new Error('No backend configured');
    }

    const id = new URL(storedBackendUrl).host;
    const configStr = localStorage.getItem(`zia_backend:${id}`);
    if (!configStr) {
      throw new Error('Backend configuration not found');
    }

    const config = JSON.parse(configStr);
    const service = config[pendingAuth.service];
    if (!service) {
      throw new Error(`Service ${pendingAuth.service} not found in config`);
    }

    const token = await exchangeAuthCode(
      config.tokenEndpoint,
      service.client_id,
      code,
      pendingAuth.codeVerifier
    );

    const tokens = getStoredTokens();
    const merged = mergeToken(tokens, token);
    setStoredTokens(merged);

    localStorage.removeItem('zia_pending_auth');
    setIsLoggedIn(true);
  }, []);

  const trySilentAuth = useCallback(async (service: ServiceConfig): Promise<string | null> => {
    if (!serverConfig || !serverId) return null;

    const config = serverConfig;
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

        const url = new URL(config.authorizationEndpoint);
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
                config.tokenEndpoint,
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
  }, [serverConfig, serverId]);

  const refreshToken = useCallback(async (
    token: any,
    service: ServiceConfig
  ): Promise<any | null> => {
    if (!serverConfig) return null;

    try {
      const formData = new URLSearchParams();
      formData.append('grant_type', 'refresh_token');
      formData.append('client_id', service.client_id);
      formData.append('refresh_token', token.refresh_token);

      const response = await fetch(serverConfig.tokenEndpoint, {
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
  }, [serverConfig]);

  const getAccessToken = useCallback(async (serviceName: 'api' | 'analytics' = 'api'): Promise<string | null> => {
    if (!serverConfig) return null;

    const service = getService(serviceName);
    if (!service) return null;

    const tokens = getStoredTokens();
    const tokenIndex = findTokenIndex(tokens, serverConfig.issuer, service.client_id);

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

      removeToken(serverConfig.issuer, service.client_id);
      if (serviceName === 'api') {
        setIsLoggedIn(false);
      }
    }

    if (serviceName !== 'api') {
      return await trySilentAuth(service);
    }

    return null;
  }, [serverConfig, getService, refreshToken, trySilentAuth]);

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
