'use client';

import Image from "next/image";
import { useZia } from "./ui/ZiaContext";
import { boxClasses } from "@mui/material";

export default function Home() {
  const { backendUrl, getAccessToken, oauthUrl } = useZia();
  return (
    <main className="flex-1 p-5 max-w-[20cm] w-full mx-auto">
      <div>
        <a href="jwttest.html">ABC</a>
      </div>
      {backendUrl}
    </main>
  );
}
