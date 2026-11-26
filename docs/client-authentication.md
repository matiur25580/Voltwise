# Client Authentication

The React client restores a session by calling `POST /api/v1/auth/refresh` with credentials enabled. The refresh token remains in the server-set HttpOnly cookie; the short-lived access token is held in React memory only.

After login, registration, or refresh, the client loads `GET /api/v1/auth/me` and `GET /api/v1/organizations/current` using the access token. The dashboard is not rendered until session restoration completes and is shown only when an access token is present.

The sign-in screen supports login and organization registration. Sign-out calls the API logout endpoint and clears the in-memory identity state.

## Client security notes

- Do not persist access or refresh tokens in localStorage, sessionStorage, or IndexedDB.
- Keep API requests same-origin through the Vite `/api` proxy in development.
- The refresh request is single-flight to avoid duplicate token rotations during React StrictMode development effect replay.
- Access token refresh on a 401 response for arbitrary API requests, organization switching, invitation acceptance, and CSRF hardening are future work.
- Cookie-based refresh requires HTTPS in production and a deployment topology with compatible SameSite/CORS settings.
