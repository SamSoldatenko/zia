'use client';

import { useState, useEffect } from 'react';
import { Collapse, Divider, Menu, MenuItem } from '@mui/material';
import { User, LogOut, KeyRound, Unplug, EarthLock, UserRoundCheck, Key } from 'lucide-react';
import { DEFAULT_BACKENDS } from '@/app/config/backends';
import { useServerConfig } from './context/ServerConfigContext';
import { useAuth } from './context/AuthContext';
import ThemeToggle from './ThemeToggle';

export default function Auth(): React.ReactElement {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [altKeyPressed, setAltKeyPressed] = useState(false);
  const [keyLoading, setKeyLoading] = useState(false);
  const { connectTo } = useServerConfig();
  const { login, logout, isLoggedIn, getAccessToken } = useAuth();
  const open = Boolean(anchorEl);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Alt') setAltKeyPressed(true);
    }
    function handleKeyUp(event: KeyboardEvent): void {
      if (event.key === 'Alt') setAltKeyPressed(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [open]);

  function handleClick(event: React.MouseEvent<HTMLButtonElement>): void {
    setAnchorEl(event.currentTarget);
    if (event.altKey) setAltKeyPressed(true);
  }

  function handleClose(): void {
    setAnchorEl(null);
    setAltKeyPressed(false);
    setKeyLoading(false);
  }

  function handleLogin(): void {
    login();
    handleClose();
  }

  function handleLogout(): void {
    logout();
    handleClose();
  }

  function handleGetAccessKey(): void {
    setKeyLoading(true);
    getAccessToken()
      .then(console.log, console.error)
      .then(handleClose);
  }

  function handleSwitchBackend(url: string): void {
    connectTo(url);
    handleClose();
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        {isLoggedIn ? <UserRoundCheck size={20} /> : <User size={20} />}
      </button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleLogin}>
          <KeyRound size={18} className="mr-2" /> Login
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogOut size={18} className="mr-2" /> Logout
        </MenuItem>
        <Divider />
        <MenuItem disableRipple sx={{ '&:hover': { backgroundColor: 'transparent' } }}>
          <ThemeToggle />
        </MenuItem>
        <Collapse in={altKeyPressed} unmountOnExit>
          <Divider />
          <MenuItem onClick={handleGetAccessKey} disabled={keyLoading}>
            <Key size={18} className="mr-2" /> Get Access Key
          </MenuItem>
          <MenuItem onClick={() => handleSwitchBackend(DEFAULT_BACKENDS.dev)}>
            <Unplug size={18} className="mr-2" /> Dev Backend
          </MenuItem>
          <MenuItem onClick={() => handleSwitchBackend(DEFAULT_BACKENDS.prod)}>
            <EarthLock size={18} className="mr-2" /> Prod Backend
          </MenuItem>
        </Collapse>
      </Menu>
    </div>
  );
}
