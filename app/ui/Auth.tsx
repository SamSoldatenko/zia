'use client';
import { useState } from "react";
import { Divider, Menu, MenuItem } from "@mui/material";
import { User, LogIn, LogOut, KeyRound, Unplug, EarthLock, UserRoundCheck } from "lucide-react";
import { useZia } from "./ZiaContext";

export default function Auth() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openedWithAlt, setOpenedWithAlt] = useState<boolean>(false);
  const {switchBackend, doLogin, doLogout, backendUrl, isLoggedIn} = useZia();
  const open = Boolean(anchorEl);
  const isDevBackend = (backendUrl !== 'https://zia-be.bin932.com:3150');

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
    setOpenedWithAlt(event.altKey);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setOpenedWithAlt(false);
  };

  const handleLogin = () => {
    doLogin();
    handleClose();
  };

  const handleLogout = () => {
    doLogout();
    handleClose();
  };

  const connectToDev = () => {
    switchBackend('http://localhost:8080');
    handleClose();
  };

  const connectToProd = () => {
    switchBackend('https://zia-be.bin932.com:3150');
    handleClose();
  };

  return (
    <div className="fixed top-4 right-4">
      <button
        onClick={handleClick}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-gray-200 shadow-lg hover:bg-gray-300 transition"
      >
        {isLoggedIn ? <UserRoundCheck size={24} /> : <User size={24} />}
      </button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleLogin}>
          <KeyRound size={18} className="mr-2" /> Login
        </MenuItem>
        <MenuItem onClick={handleLogout}>
          <LogOut size={18} className="mr-2" /> Logout
        </MenuItem>
        {(isDevBackend || openedWithAlt) && (
          <>
            <Divider />
            <MenuItem onClick={connectToDev}>
              <Unplug size={18} className="mr-2" /> Dev Backend
            </MenuItem>
            <MenuItem onClick={connectToProd}>
              <EarthLock size={18} className="mr-2" /> Prod Backend
            </MenuItem>
          </>
        )}
      </Menu>
    </div>
  );
}
