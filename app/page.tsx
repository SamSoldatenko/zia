'use client';

import { Alert } from '@mui/material';
import { useServerConfig } from './ui/context/ServerConfigContext';

export default function Home() {
  const { serverConfig } = useServerConfig();
  return (
    <main className="flex-1 p-5 max-w-[20cm] w-full mx-auto">
      <Alert severity="error" onClose={() => {}}>
        test error message
      </Alert>
      <div>
        <a href="jwttest.html">JWT debug</a>
      </div>
      <div>Server URL: {serverConfig?.backendUrl}
      </div>
    </main>
  );
}
