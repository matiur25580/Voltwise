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

The active tenant is derived from the verified access token and revalidated against an active membership on every authenticated request. Clients must never choose a tenant by sending a tenant ID in ordinary resource requests. The refresh cookie uses an HttpOnly, SameSite=Lax, root-path cookie so it is available to the organization switch endpoint as well as auth endpoints.

## Organization members

- `GET /organizations/members` lists members in the active tenant; requires `members:read`.
- `PATCH /organizations/members/:membershipId/role` changes a member role; requires `members:manage`.
- `PATCH /organizations/members/:membershipId/status` activates or suspends a member; requires `members:manage`.
- `GET /organizations/audit-events?limit=50` reads the latest tenant audit events; requires `members:manage`.

Every member mutation scopes its database lookup by both membership ID and the trusted active tenant. Users cannot change their own role or membership status. Only owners may assign owner roles; admins cannot assign owner/admin roles. The final active owner cannot be demoted or suspended.

## Invitations

- `POST /organizations/invitations` creates a seven-day invitation for `admin`, `operator`, `analyst`, or `viewer`; requires `members:manage`. Only owners may invite administrators.
- `GET /organizations/invitations` lists pending, unexpired invitations in the active tenant; requires `members:read`.
- `POST /organizations/invitations/accept` accepts an invitation for the currently authenticated account. The invitation email must match the account email exactly (case-insensitive).
- `DELETE /organizations/invitations/:invitationId` revokes a pending invitation in the active tenant; requires `members:manage`.

Invitation tokens are generated from 256 bits of cryptographic randomness, stored only as SHA-256 hashes, expire after seven days, and are returned once by the create endpoint for delivery. Do not log or persist the plaintext token. Email delivery is not wired yet: a trusted delivery adapter must send the one-time token to the invitation email before production use. The invited user must already have an account and authenticate before accepting; registration-time invitation acceptance is a follow-up.

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

Set a unique `JWT_ACCESS_SECRET` (at least 32 characters) and use HTTPS in production. Do not store access or refresh tokens in localStorage. Keep the refresh cookie HttpOnly and use a same-origin deployment or a carefully configured credentialed CORS origin. Before public production launch, add email verification, password reset, CSRF protection appropriate to the deployed cookie topology, an email delivery adapter, registration-time invitation acceptance, transactional registration, and broader cross-tenant integration tests. Last-owner changes also need transaction-backed concurrency protection on a MongoDB replica set.
