'use client';
import { useEffect } from "react";
import { useZia } from "../ui/ZiaContext";
import { useRouter, useSearchParams } from 'next/navigation';

export default function CognitoRedirect() {
    const router = useRouter();
    const params = useSearchParams();
    const { exchangeCodeToToken, oauthUrl } = useZia();

    useEffect(() => {
        const code = params.get('code');
        if (!code) return;
        if (!oauthUrl) return; // we need useEffect finished in ZiaContext before we call exchangeCodeToToken
        exchangeCodeToToken(code + '')
            .then(token => {
                router.replace('/');
            }, console.error);
    }, [exchangeCodeToToken, oauthUrl, params, router]);

    return (
        <main className="flex min-h-screen flex-col items-center justify-between p-24">
            <p>Processing login...</p>
        </main>
    );
}