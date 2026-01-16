# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zia is a personal AI assistant web application built with Next.js 16 (App Router), React 19, TypeScript, and AWS Cognito authentication.

## Commands

```bash
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm run lint     # Run ESLint
npm run test     # Run all tests with Vitest
npm test -- __tests__/Auth.test.tsx  # Run a single test file
```

## Architecture

### App Structure
- **app/layout.tsx** - Root layout wraps entire app with `ZiaProvider` and renders `Auth` component in header
- **app/ui/context/** - Modular context providers:
  - **ZiaProvider.tsx** - Composes all providers (ServerConfig → Auth → Settings)
  - **ServerConfigContext.tsx** - Backend configuration, fetches `/info.json` and OpenID config, detects URL mismatch
  - **AuthContext.tsx** - OAuth2/PKCE authentication, token management, silent auth for secondary services
  - **SettingsContext.tsx** - User settings (theme: light/dark/system), MUI theme provider
- **app/ui/Auth.tsx** - User menu component with login/logout and dev tools (press Alt while menu is open to reveal dev options)
- **app/ui/BackendMismatchBanner.tsx** - Warning banner when accessing from URL that doesn't match backend's expected `web` URL
- **app/ui/ThemeToggle.tsx** - Theme mode switcher component
- **app/cognito_redirect/page.tsx** - Handles OAuth callback, exchanges auth code for tokens

### Authentication Flow
1. `login()` initiates PKCE flow, stores pending auth state, redirects to Cognito
2. `/cognito_redirect` receives callback, calls `handleOAuthCallback()`
3. Tokens stored in localStorage under `zia_tokens` (keyed by issuer + client_id)
4. `getAccessToken(service)` returns valid token, auto-refreshes, or attempts silent auth for analytics service

### Backend Configuration
- **app/config/backends.ts** - Default backend URLs and auto-detection logic
- Server config stored in localStorage as `zia_backend:{serverId}`
- Current backend stored as `zia_current_backend`
- `connectTo(url)` fetches `/info.json` from backend, then OpenID config
- Default backend auto-selected: dev (`localhost:8080`) when running on `localhost:3000`, otherwise prod

### Styling
- Tailwind CSS for utility classes (supports dark mode via `dark:` prefix)
- MUI (Material UI) for components (Menu, MenuItem, Alert, Button, etc.)
- Lucide React for icons
