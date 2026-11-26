# Identity and Organization API

All routes are prefixed with `/api/v1`. Authenticated routes require `Authorization: Bearer <access-token>`; refresh credentials are carried only in the HttpOnly `voltwise_refresh` cookie.

## Authentication

- `POST /auth/register` creates a user, organization, owner membership, and session.
- `POST /auth/login` authenticates the user and selects the earliest active membership for the initial session.
- `POST /auth/refresh` rotates the refresh cookie and returns a short-lived access token.
- `POST /auth/logout` revokes the presented refresh session and clears the cookie.
- `GET /auth/me` returns the authenticated user and trusted tenant context.

## Organizations and tenant switching

- `GET /organizations` lists only the authenticated user's active organization memberships.
- `POST /organizations/:organizationId/switch` switches context only when the caller has an active membership in that organization. The server revokes the presented refresh session, issues a new tenant-scoped session, and replaces the HttpOnly cookie.
- `GET /organizations/current` returns the active organization and member count.

The active tenant is derived from the verified access token and revalidated against an active membership on every authenticated request. Clients must never choose a tenant by sending a tenant ID in ordinary resource requests.

## Organization members

- `GET /organizations/members` lists members in the active tenant; requires `members:read`.
- `PATCH /organizations/members/:membershipId/role` changes a member role; requires `members:manage`.
- `PATCH /organizations/members/:membershipId/status` activates or suspends a member; requires `members:manage`.
- `GET /organizations/audit-events?limit=50` reads the latest tenant audit events; requires `members:manage`.

Every member mutation scopes its database lookup by both membership ID and the trusted active tenant. Users cannot change their own role or membership status. Only owners may assign owner roles; admins cannot assign owner/admin roles. The final active owner cannot be demoted or suspended.

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

Set a unique `JWT_ACCESS_SECRET` (at least 32 characters) and use HTTPS in production. Do not store access or refresh tokens in localStorage. Keep the refresh cookie HttpOnly and use a same-origin deployment or a carefully configured credentialed CORS origin. Before public production launch, add email verification, password reset, CSRF protection for the deployed cookie topology, invitation delivery/acceptance, transactional registration, and broader security integration tests.
