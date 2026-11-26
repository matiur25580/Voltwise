# Identity API

All routes are prefixed with `/api/v1`.

## Register

`POST /auth/register`

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "password": "a-long-unique-password",
  "organizationName": "Northstar Industries"
}
```

Creates a user, an organization, and an owner membership. Returns a short-lived access token in the response body and sets the rotating refresh token in an HttpOnly cookie.

## Login

`POST /auth/login`

Accepts `email` and `password`. The initial implementation selects the user's earliest active membership. Multi-organization tenant switching is a later milestone.

## Refresh and logout

- `POST /auth/refresh` rotates the refresh cookie and returns a new access token.
- `POST /auth/logout` revokes the presented refresh session and clears the cookie.

The refresh cookie is scoped to `/api/v1/auth`, HttpOnly, SameSite=Lax, and Secure in production. The browser must send credentials for refresh/logout requests.

## Current identity

`GET /auth/me` requires `Authorization: Bearer <access-token>` and returns the user, trusted tenant context, role, and effective permissions.

## Organization

`GET /organizations/current` requires a bearer token and the `organization:read` permission.

## Error envelope

Errors use a stable shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed."
  }
}
```

## Operational requirements

Set a unique `JWT_ACCESS_SECRET` (at least 32 characters) and use HTTPS in production. Do not store access or refresh tokens in localStorage. Keep the refresh cookie HttpOnly and use a same-origin deployment or a carefully configured credentialed CORS origin. Before public production launch, add email verification, password reset, CSRF protection for the deployed cookie topology, security audit events, account abuse controls, and transactional registration.
