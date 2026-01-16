'use client';

import { ServerConfigProvider } from './ServerConfigContext';
import { AuthProvider } from './AuthContext';
import { SettingsProvider } from './SettingsContext';

export function ZiaProvider({ children }: { children: React.ReactNode }) {
  return (
    <ServerConfigProvider>
      <AuthProvider>
        <SettingsProvider>
          {children}
        </SettingsProvider>
      </AuthProvider>
    </ServerConfigProvider>
  );
}
