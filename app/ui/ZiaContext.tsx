'use client';

import { createContext, useContext, useEffect, useState } from "react";

interface ZiaContextProps {
  backendUrl: string | null;
  oauthUrl: string | null; // url to .well-known/openid-configuration

  switchBackend: (url: string) => Promise<void>;
  getAccessToken: () => Promise<string>;
  doLogin: () => Promise<URL>;
  doLogout: () => Promise<void>;
  exchangeCodeToToken: (code: string) => Promise<string>;
}

const ZiaContext = createContext<ZiaContextProps | undefined>(undefined);

export const ZiaProvider = ({ children }: { children: React.ReactNode }) => {
  const [backendUrl, setBackendUrl] = useState<string>('');
  const [oauthUrl, setOauthUrl] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');
  const [issuerId, setIssuerId] = useState<string>('');
  const [authorizationEndpoint, setAuthorizationEnpoint] = useState<string>('');
  const [tokentEndpoint, setTokenEndpoint] = useState<string>('');
  const [userInfoEndpoint, setUserInfoEndpoint] = useState<string>('');
  const [endSessionEndpoint, setEndSessionEndpoint] = useState<string>('');

  useEffect(() => {
    const storedConfig = JSON.parse(localStorage.getItem('zia_config') || 'null');
    const {
      api_url,
      // comes from $api_url/info.json
      oauth_url, client_id,
      // Comes from oauth_url
      issuer, authorization_endpoint, token_endpoint, userinfo_endpoint, end_session_endpoint
    } = storedConfig || loadDefaultConfig();
    setBackendUrl(api_url);
    setOauthUrl(oauth_url);
    setClientId(client_id);
    setIssuerId(issuer);
    setAuthorizationEnpoint(authorization_endpoint);
    setTokenEndpoint(token_endpoint);
    setUserInfoEndpoint(userinfo_endpoint);
    setEndSessionEndpoint(end_session_endpoint);
  }, []);

  const switchBackend = async (api_url: string) => {
    const response = await fetch(api_url + '/info.json');
    if (!response.ok) {
      throw new Error('Can not load ' + api_url + '/info.json');
    }
    const {
      web: web_url,
      'openid-configuration': oauth_url,
      client_id
    } = await response.json();
    const oauthResponse = await fetch(oauth_url);
    if (!oauthResponse.ok) {
      throw new Error('Can not load ' + oauth_url);
    }
    const {
      authorization_endpoint,
      issuer: oauth_issuer,
      token_endpoint,
      userinfo_endpoint,
      end_session_endpoint,
    } = await oauthResponse.json();
    localStorage.setItem('zia_config', JSON.stringify({
      api_url,
      oauth_url,
      client_id,
      issuer: oauth_issuer,
      authorization_endpoint,
      token_endpoint,
      userinfo_endpoint,
      end_session_endpoint,
    }));
    setBackendUrl(api_url);
    setOauthUrl(oauth_url);
    setClientId(client_id);
    setIssuerId(oauth_issuer);
    setAuthorizationEnpoint(authorization_endpoint);
    setTokenEndpoint(token_endpoint);
    setUserInfoEndpoint(userinfo_endpoint);
    setEndSessionEndpoint(end_session_endpoint);
  };

  const doLogin = async () => {
    const code_verifier = generateRandomString(40);
    localStorage.setItem('zia_code_verifier', code_verifier);
    const code = await sha256AndBase64(code_verifier);
    const redirectUri = `${location.protocol}//${location.host}/cognito_redirect`;

    const url = new URL(authorizationEndpoint);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'email openid phone');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('code_challenge', code);
    url.searchParams.set('code_challenge_method', 'S256');
    location.assign(url.toString());
    return url;
  };

  const doLogout = async () => {
    const tokens = JSON.parse(localStorage.getItem('zia_tokens') || '[]');
    const filteredTokens = tokens.filter((token: any) => {
      const { access_token } = token;
      const { iss, client_id } = parse_payload(access_token);
      return !(iss === issuerId && client_id === clientId);
    });
    localStorage.setItem('zia_tokens', JSON.stringify(filteredTokens));

    const logoutUrl = `${location.protocol}//${location.host}`;
    const url = new URL(endSessionEndpoint);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('logout_uri', logoutUrl);
    location.assign(url.toString());
  };

  const exchangeCodeToToken = async (code: string) => {
    const code_verifier = '' + localStorage.getItem('zia_code_verifier');
    const redirectUri = `${location.protocol}//${location.host}/cognito_redirect`;
    var formData = new URLSearchParams();
    formData.append("redirect_uri", redirectUri);
    formData.append("client_id", clientId);
    formData.append("code", code);
    formData.append("grant_type", "authorization_code");
    formData.append("code_verifier", code_verifier);

    const response = await fetch(tokentEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData
    });
    if (!response.ok) {
      throw new Error('Token exchange failed');
    }
    const token = await response.json();
    const tokens = JSON.parse(localStorage.getItem('zia_tokens') || '[]');
    const merged = merge_tokens(tokens, token);
    localStorage.setItem('zia_tokens', JSON.stringify(merged));
    localStorage.removeItem('zia_code_verifier');
    return token;
  };

  const getAccessToken = async () => {
    const tokens = JSON.parse(localStorage.getItem('zia_tokens') || '[]');
    for (let index = 0; index < tokens.length; index++) {
      const { access_token, refresh_token } = tokens[index];
      const { iss, exp, client_id } = parse_payload(access_token);
      if (iss === issuerId && client_id === clientId) {
        const isValid = (exp * 1000 > new Date().getTime());
        if (isValid) {
          return access_token;
        }
        const {
          id_token: new_id_token,
          access_token: new_access_token
        } = await renewToken(refresh_token);
        tokens[index].id_token = new_id_token;
        tokens[index].access_token = new_access_token;
        localStorage.setItem('zia_tokens', JSON.stringify(tokens));
        return new_access_token;
      }
    }
    return null;
  };

  const renewToken = async (refresh_token: string) => {
    const data = new URLSearchParams();
    data.append("grant_type", "refresh_token");
    data.append("client_id", clientId || '');
    data.append("refresh_token", refresh_token);
    const response = await fetch(tokentEndpoint || '', {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: data
    });
    if (response.ok) {
      return response.json();
    }
    throw new Error('Failed to update token');
  }

  return (
    <ZiaContext.Provider value={{ backendUrl, oauthUrl, switchBackend, getAccessToken, doLogin, doLogout, exchangeCodeToToken }}>
      {children}
    </ZiaContext.Provider>
  );
};

export const useZia = () => {
  const context = useContext(ZiaContext);
  if (!context) throw new Error("useZia must be used within an ZiaProvider");
  return context;
};

function generateRandomString(length: number) {
  var charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // Characters to include in the random string
  var result = "";
  for (var i = 0; i < length; i++) {
    var randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }
  return result;
}

async function sha256AndBase64(input: string) {
  const buffer = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  let binary = "";
  const bytes = new Uint8Array(hashBuffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64String = btoa(binary);
  return base64String.replace('+', '-').replace('/', '_').replace(/=+$/, '');
}

function parse_payload(s: string) {
  var parts = s.split('\.');
  return JSON.parse(atob(parts[1]));
}

function loadDefaultConfig() {
  // todo check current location to switch to dev mode
  return {
    api_url: 'https://zia-be.bin932.com:3150',
    // comes from info.json
    oauth_url: 'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_SSH5Zn4xD/.well-known/openid-configuration',
    client_id: '41n5fausr4m817q9uko6rkb5ni',
    // comes from openid-config
    issuer: 'https://cognito-idp.eu-central-1.amazonaws.com/eu-central-1_SSH5Zn4xD',
    authorization_endpoint: 'https://zia.auth.eu-central-1.amazoncognito.com/oauth2/authorize',
    token_endpoint: 'https://zia.auth.eu-central-1.amazoncognito.com/oauth2/token',
    userinfo_endpoint: 'https://zia.auth.eu-central-1.amazoncognito.com/oauth2/userInfo',
    end_session_endpoint: 'https://zia.auth.eu-central-1.amazoncognito.com/logout',
  };
};

function merge_tokens(tokens:any[], token:any) {
  var payload = parse_payload(token.access_token);
  for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i]
      var p = parse_payload(t.access_token);
      if (payload.iss == p.iss && payload.client_id == p.client_id) {
          var result = [...tokens];
          result[i] = token;
          return result;
      }
  }
  return [...tokens, token];
}