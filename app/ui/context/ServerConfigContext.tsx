'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getDefaultBackend } from '@/app/config/backends';

export interface ServiceConfig {
  url: string;
  client_id: string;
  scopes: string[];
}

export interface ServerConfig {
  name: string;
  version: string;
  web: string;
  backendUrl: string;
  openidConfiguration: string;
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  endSessionEndpoint: string;
  api: ServiceConfig;
  analytics?: ServiceConfig;
}

interface ServerConfigContextValue {
  serverId: string | null;
  serverConfig: ServerConfig | null;
  isLoading: boolean;
  error: string | null;
  urlMismatch: boolean;
  connectTo: (url: string) => Promise<void>;
  getService: (name: 'api' | 'analytics') => ServiceConfig | null;
}

const ServerConfigContext = createContext<ServerConfigContextValue | undefined>(undefined);

function getServerId(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host;
  } catch {
    return url;
  }
}

export function ServerConfigProvider({ children }: { children: React.ReactNode }) {
  const [serverId, setServerId] = useState<string | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [urlMismatch, setUrlMismatch] = useState(false);

  const loadServerConfig = useCallback(async (backendUrl: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const id = getServerId(backendUrl);

      const infoResponse = await fetch(backendUrl + '/info.json');
      if (!infoResponse.ok) {
        throw new Error(`Cannot load ${backendUrl}/info.json`);
      }
      const info = await infoResponse.json();

      const openidUrl = info['openid-configuration'];
      const openidResponse = await fetch(openidUrl);
      if (!openidResponse.ok) {
        throw new Error(`Cannot load ${openidUrl}`);
      }
      const openid = await openidResponse.json();

      const config: ServerConfig = {
        name: info.name || id,
        version: info.version || '1.0.0',
        web: info.web || '',
        backendUrl,
        openidConfiguration: openidUrl,
        issuer: openid.issuer,
        authorizationEndpoint: openid.authorization_endpoint,
        tokenEndpoint: openid.token_endpoint,
        userInfoEndpoint: openid.userinfo_endpoint,
        endSessionEndpoint: openid.end_session_endpoint,
        api: info.api || {
          url: backendUrl,
          client_id: info.client_id,
          scopes: ['email', 'openid', 'phone'],
        },
        analytics: info.analytics,
      };

      localStorage.setItem(`zia_backend:${id}`, JSON.stringify(config));
      localStorage.setItem('zia_current_backend', backendUrl);

      setServerId(id);
      setServerConfig(config);

      if (typeof window !== 'undefined' && config.web) {
        setUrlMismatch(window.location.origin !== config.web);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backend');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectTo = useCallback(async (url: string) => {
    await loadServerConfig(url);
  }, [loadServerConfig]);

  const getService = useCallback((name: 'api' | 'analytics'): ServiceConfig | null => {
    if (!serverConfig) return null;
    return serverConfig[name] || null;
  }, [serverConfig]);

  useEffect(() => {
    const storedBackendUrl = localStorage.getItem('zia_current_backend');
    const backendUrl = storedBackendUrl || getDefaultBackend();
    loadServerConfig(backendUrl);
  }, [loadServerConfig]);

  return (
    <ServerConfigContext.Provider
      value={{
        serverId,
        serverConfig,
        isLoading,
        error,
        urlMismatch,
        connectTo,
        getService,
      }}
    >
      {children}
    </ServerConfigContext.Provider>
  );
}

export function useServerConfig() {
  const context = useContext(ServerConfigContext);
  if (!context) {
    throw new Error('useServerConfig must be used within a ServerConfigProvider');
  }
  return context;
}
