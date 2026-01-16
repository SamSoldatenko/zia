'use client';

import { useState, useEffect } from 'react';
import { Alert, Button } from '@mui/material';
import { useServerConfig } from './context/ServerConfigContext';

export default function BackendMismatchBanner(): React.ReactElement | null {
  const { urlMismatch, serverConfig } = useServerConfig();
  const [currentOrigin, setCurrentOrigin] = useState('');

  useEffect(() => {
    setCurrentOrigin(window.location.origin);
  }, []);

  if (!urlMismatch || !serverConfig?.web) {
    return null;
  }

  const targetUrl = serverConfig.web;

  function handleNavigate(): void {
    window.location.href = targetUrl;
  }

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" onClick={handleNavigate}>
          Go to {serverConfig.web}
        </Button>
      }
    >
      You&apos;re accessing from {currentOrigin} but this backend expects {serverConfig.web}.
    </Alert>
  );
}
