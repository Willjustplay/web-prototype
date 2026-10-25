# Implementation Plan: Email Authentication, Resend, MongoDB, and Admin Panel

> **Purpose:** Add secure email/password authentication with email
> verification, Resend-powered transactional email, and a new admin
> panel to the existing website.
>
> **Project constraints:** The frontend framework is currently
> unspecified ("Other"). MongoDB is the database. Authentication is
> custom-built with Resend. Login uses email + password and requires
> email verification. Build a new Admin Panel. Preserve existing
> features, routes, visual design, and user workflows wherever possible.
>
> **Instructions for the coding agent:** Inspect the repository before
> changing anything. Do not assume a framework, package manager, folder
> layout, styling system, or deployment provider. Adapt this plan to the
> project's actual stack. Do not rewrite or replace the existing
> application just to match example paths in this document.

## 1. Goals and acceptance criteria

### Goals

-   Add registration, email verification, login, logout,
    forgot-password, and password-reset flows.
-   Use Resend only as the email delivery provider; implement token
    generation, verification, sessions, and authorization in the
    application.
-   Persist users, sessions, verification/reset tokens, and
    administrative audit events in MongoDB.
-   Build a new responsive admin panel that matches the existing
    website's visual language.
-   Enforce role and account-status checks on the server for every
    protected operation.
-   Preserve existing features and avoid unrelated refactors.

### Definition of done

-   A new user can register, receives a verification email, verifies the
    email, and then logs in.
-   Unverified, suspended, or disabled users cannot access protected
    user or admin resources.
-   Password reset tokens expire, are single-use, and cannot be used to
    discover whether an email is registered.
-   Admin routes and APIs reject non-admin users even if they manually
    call the API or modify the UI.
-   Admins can search, filter, paginate, view, suspend/reactivate users,
    and change eligible roles according to the authorization rules
    below.
-   Sensitive admin actions create audit-log entries.
-   No secrets, passwords, raw tokens, or session credentials are
    exposed in frontend code, responses, or logs.
-   Existing core routes and functionality pass regression tests.
-   Setup and deployment instructions are documented.

## 2. Repository discovery and compatibility rules

Before implementation:

1.  Inspect the repository root, `package.json` or equivalent manifest,
    lockfile, framework configuration, entry points, routes, middleware,
    styles, design system, test setup, and deployment configuration.
2.  Identify whether the project uses server-side rendering, a separate
    API server, serverless functions, or a client-only frontend.
3.  Identify existing authentication, user/profile models, database
    connection utilities, logging, email code, form validation, and UI
    components.
4.  Record the current routes and important user flows. Run the existing
    tests and build before edits if the project is runnable.
5.  Report the actual stack and proposed file changes before major
    structural changes.
6.  Reuse established conventions and dependencies. Add the smallest
    reasonable number of dependencies.
7.  Do not overwrite existing files or remove features without a clear,
    necessary reason. If a planned path conflicts with the existing
    layout, adapt the path rather than forcing this example structure.
8.  Keep changes scoped to authentication, email, admin functionality,
    and directly required infrastructure.

## 3. Proposed architecture

Use the project's existing framework and runtime. The logical
architecture should contain these layers, whether they live in one
application or separate packages:

-   **Existing frontend:** registration, login, verification,
    reset-password, user account pages, and admin UI.
-   **HTTP/API layer:** input parsing, schema validation, rate limiting,
    CSRF protection where applicable, response shaping, and error
    handling.
-   **Authentication service:** password hashing, credential checks,
    email verification, token lifecycle, and session lifecycle.
-   **Authorization layer:** authenticated-user guard, verified-account
    guard, active-account guard, and admin-role guard.
-   **Domain/services layer:** user management, email
    templates/delivery, session management, audit logging.
-   **Persistence layer:** MongoDB connection, repositories/models,
    indexes, and transaction handling only where supported and
    necessary.
-   **Resend:** outbound transactional email only. Never treat a
    successful email API response as proof that the recipient owns the
    address.
-   **Configuration layer:** validated environment variables and
    production-safe defaults.

### Request flow

1.  A request reaches the existing application's route/controller/API
    handler.
2.  Validate input and apply rate limits.
3.  Authenticate the session when required.
4.  Check account status, verification state, and role on the server.
5.  Call the relevant service and repository.
6.  Send email through a centralized Resend adapter when required.
7.  Return a minimal response and write an audit event for sensitive
    administrative actions.

### Security defaults

-   Password hashing: use Argon2id when compatible with the runtime;
    otherwise use a well-maintained, appropriately configured
    password-hashing library. Never store plaintext or reversibly
    encrypted passwords.
-   Sessions: prefer opaque, random session IDs in `HttpOnly`, `Secure`
    (production), `SameSite=Lax` cookies. Store only a hash of the
    session token in MongoDB. Rotate the session after login and
    privilege changes.
-   Tokens: generate with a cryptographically secure random source;
    store only a hash; expire and invalidate after use.
-   Transport: HTTPS in production.
-   Admin authorization: deny by default and validate permissions on
    every server-side operation.
-   Rate limiting: apply to registration, login, verification resend,
    password-reset requests, and token submission.
-   Errors: avoid account enumeration; do not expose internal exceptions
    to clients.

## 4. MongoDB data model

Adapt names to existing conventions. Use MongoDB collections with schema
validation through the project's model/ODM layer and create indexes
deliberately.

### `users`

Suggested fields: - `_id`: ObjectId. - `name`: string, trimmed and
length-limited. - `email`: normalized lowercase string. -
`emailNormalized`: optional explicit normalized field if the existing
schema requires a separate display email. - `passwordHash`: string. -
`role`: enum, default `user`; allowed values initially `user` and
`admin`. - `emailVerifiedAt`: date or `null`. - `status`: enum, such as
`active` or `suspended`; default `active`. - `createdAt`, `updatedAt`:
dates. - `lastLoginAt`: date or `null`. - `passwordChangedAt`: date or
`null`. - `sessionVersion`: integer, default `0`, if needed for global
session invalidation.

Indexes: - Unique index on the canonical normalized email. - Indexes for
`role`, `status`, and `createdAt` only when query patterns justify
them. - Do not rely on application-only checks for email uniqueness;
handle duplicate-key errors safely.

### `sessions`

Suggested fields: - `_id`. - `userId`: ObjectId referencing `users`. -
`tokenHash`: unique hash of the opaque cookie token. - `createdAt`,
`expiresAt`, `lastSeenAt`. - Optional `ipHash` and a truncated or
privacy-reviewed user-agent field if operationally necessary.

Indexes: - Unique index on `tokenHash`. - TTL index on `expiresAt` for
cleanup. TTL deletion is asynchronous; the application must still check
expiry on every request. - Index on `userId` for logout-all and user
administration.

### `email_verification_tokens`

Suggested fields: - `_id`. - `userId`. - `tokenHash`. - `expiresAt`,
`createdAt`, `usedAt` or a consumed state. - Optional delivery status
metadata that does not include the raw token.

Indexes: - Unique index on `tokenHash`. - TTL index on `expiresAt` for
cleanup. - Index on `userId`.

### `password_reset_tokens`

Suggested fields: - `_id`. - `userId`. - `tokenHash`. - `expiresAt`,
`createdAt`, `usedAt`.

Indexes: - Unique index on `tokenHash`. - TTL index on `expiresAt`. -
Index on `userId`.

### `audit_logs`

Suggested fields: - `_id`. - `actorUserId`: admin or system actor,
nullable for system events. - `action`: controlled action name,
e.g. `user.suspended`, `user.role_changed`. - `targetUserId`: optional
user affected. - `createdAt`. - `requestId`: optional correlation
identifier. - `metadata`: allowlisted, non-sensitive fields only.

Do not store passwords, raw verification/reset tokens, cookies, API
keys, or full request bodies. Define retention and access rules for
audit logs.

### Optional `email_delivery_events`

Use only if email-delivery tracking is needed. Store provider message
ID, recipient reference or appropriately minimized recipient data,
template type, status, timestamps, and sanitized error code. Verify
webhook signatures before trusting delivery events. Never store raw
authentication links or tokens in delivery logs.

### Consistency and concurrency

-   Handle token consumption atomically so two simultaneous requests
    cannot successfully consume the same token.
-   Use transactions only if MongoDB deployment and topology support
    them and the operation truly needs a multi-document transaction.
-   If email delivery fails after a token record is created, keep the
    account recoverable and provide a safe retry path; do not create a
    usable session for an unverified account.
-   Make state-changing operations idempotent where practical.

## 5. Authentication and account flows

### Registration

1.  Validate name, email, and password server-side.
2.  Normalize email consistently.
3.  Apply rate limiting and bot-abuse controls appropriate to the site.
4.  Hash the password using the selected password-hashing algorithm.
5.  Create an unverified user with the default `user` role. Never accept
    `role` or `status` from public registration input.
6.  Generate a high-entropy verification token, store only its hash and
    expiry, and send the verification link through Resend.
7.  Return a neutral success response that does not reveal whether an
    email already exists.
8.  If the email is already registered, do not overwrite its password or
    account state.

### Email verification

1.  Accept the token from the verification URL, preferably via a page
    that exchanges it with a POST request to avoid consuming tokens
    through link-preview crawlers.
2.  Hash the submitted token and find a matching, unexpired, unused
    record.
3.  Atomically consume the token and set `emailVerifiedAt`.
4.  Invalidate other outstanding verification tokens for that user.
5.  Show a clear success or expired-link message and offer a
    rate-limited resend path.
6.  Do not automatically grant admin privileges or bypass account-status
    checks.

### Login

1.  Validate the request and rate limit by IP and account identifier,
    using a strategy appropriate to the deployment.
2.  Find the normalized email and verify the password hash.
3.  Use a generic error for invalid credentials.
4.  Reject unverified or suspended accounts with safe, actionable
    messaging.
5.  Rotate or create a new opaque session token; store its hash only.
6.  Set the session cookie with appropriate flags and update
    `lastLoginAt`.
7.  Never store access tokens in `localStorage` when a secure
    cookie-based session is feasible.

### Logout

-   Invalidate the current session in MongoDB and clear the cookie.
-   Implement logout-all/session revocation if included in account
    security settings or required for suspended users/password changes.

### Forgot password

1.  Always return a neutral response such as "If an eligible account
    exists, instructions will be sent."
2.  Rate limit requests and avoid sending mail for every repeated
    request.
3.  Generate a high-entropy, short-lived token; store only its hash.
4.  Send a reset link through Resend.
5.  Do not change account status or reveal whether the address exists.

### Reset password

1.  Validate token and new password requirements.
2.  Atomically consume an unexpired, unused token.
3.  Update the password hash and `passwordChangedAt`.
4.  Invalidate all outstanding reset tokens and existing sessions, or
    increment `sessionVersion` and enforce it consistently.
5.  Send a password-changed notification without including the password.
6.  Do not automatically log the user in unless the security design
    explicitly supports it.

### Email verification resend

-   Apply per-IP and per-account rate limits and cooldowns.
-   Return a neutral response.
-   Invalidate or supersede older tokens safely.
-   Record only sanitized delivery outcomes.

## 6. Resend integration

### Configuration

Use environment variables such as:

``` env
RESEND_API_KEY=
RESEND_FROM_EMAIL=Account Security <no-reply@example.com>
APP_BASE_URL=https://example.com
MONGODB_URI=
SESSION_SECRET=
TOKEN_PEPPER=
NODE_ENV=production
```

These names are examples; adapt to the framework. Use a dedicated,
properly configured secret-management facility in production.
`APP_BASE_URL` must be an explicit trusted origin; do not build
security-sensitive links from an untrusted request `Host` header.

-   `RESEND_API_KEY` must be server-only and never use a
    public/client-prefixed environment variable.
-   Use a verified sending domain and configure SPF/DKIM and DMARC
    according to Resend's current instructions.
-   Keep development and production keys/domains separate.
-   Fail fast on missing required configuration at server startup.
-   Never commit real secrets to Git or place them in screenshots, logs,
    or documentation.

### Centralized email service

Create a provider adapter, for example
`emailService.sendVerificationEmail(...)`,
`emailService.sendPasswordResetEmail(...)`, and
`emailService.sendSecurityNotification(...)`. Route all outbound mail
through this layer.

Requirements: - Use escaped, template-based HTML and a readable
plain-text alternative. - Include a clear site identity and expected
action. - Use absolute URLs based on the trusted configured application
origin. - Avoid exposing raw tokens to logs, analytics, or error
monitoring. - Sanitize and classify provider errors; do not return
provider internals to users. - Handle rate limits, transient failures,
and retries with bounded backoff where safe. - Do not retry indefinitely
or create duplicate messages on every page refresh. - Store a provider
message ID when available. - Add a local development mode that logs a
safe preview or uses a test provider without sending real user emails.

### Suggested templates

-   `verify-email`
-   `reset-password`
-   `password-changed`
-   `account-suspended` or `account-status-changed`, if the product
    requires notifications
-   Optional admin/security alert templates for high-risk events

Only send security notifications when the triggering action succeeds.
Ensure notifications do not reveal sensitive account data.

### Optional webhooks

If delivery/bounce/complaint webhooks are implemented: - Verify the
provider's signature using the official Resend mechanism. - Reject
invalid signatures and replayed events where applicable. - Treat webhook
payloads as untrusted until verified. - Make event processing
idempotent. - Do not let a webhook grant access or verify account
ownership unless the flow explicitly and safely requires it.

## 7. API endpoint contract

Adapt route names and response conventions to the actual framework. All
endpoints must validate inputs and use centralized error handling.

  ------------------------------------------------------------------------------------------
  Method            Endpoint                          Access            Purpose
  ----------------- --------------------------------- ----------------- --------------------
  `POST`            `/api/auth/register`              Public,           Create an unverified
                                                      rate-limited      user and send
                                                                        verification email

  `POST`            `/api/auth/verify-email`          Public,           Consume verification
                                                      rate-limited      token

  `POST`            `/api/auth/resend-verification`   Public,           Request another
                                                      rate-limited      verification email

  `POST`            `/api/auth/login`                 Public,           Verify credentials
                                                      rate-limited      and create session

  `POST`            `/api/auth/logout`                Authenticated     Revoke current
                                                                        session

  `GET`             `/api/auth/me`                    Authenticated     Return safe
                                                                        current-user profile

  `POST`            `/api/auth/forgot-password`       Public,           Request
                                                      rate-limited      password-reset email

  `POST`            `/api/auth/reset-password`        Public,           Consume reset token
                                                      rate-limited      and change password

  `POST`            `/api/auth/logout-all`            Authenticated     Revoke all sessions
                                                                        for current user

  `GET`             `/api/admin/overview`             Admin             Return dashboard
                                                                        metrics

  `GET`             `/api/admin/users`                Admin             Search, filter,
                                                                        sort, and paginate
                                                                        users

  `GET`             `/api/admin/users/:id`            Admin             Return safe user
                                                                        details

  `PATCH`           `/api/admin/users/:id/status`     Admin with        Suspend/reactivate a
                                                      permission        user

  `PATCH`           `/api/admin/users/:id/role`       Privileged admin  Change an eligible
                                                      only              user's role

  `GET`             `/api/admin/audit-logs`           Admin with        Read filtered audit
                                                      permission        events

  `GET`             `/api/admin/email-events`         Admin with        Inspect sanitized
                                                      permission,       email delivery
                                                      optional          events
  ------------------------------------------------------------------------------------------

### API rules

-   Use an allowlist for accepted request fields; reject unexpected
    privileged fields such as `role`, `status`, `emailVerifiedAt`, or
    `passwordHash` in public endpoints.
-   Validate IDs before database lookup and return safe 400/404
    responses.
-   Enforce bounded page size, allowlisted sort fields, and bounded
    search input.
-   Return only safe user fields; never return `passwordHash`, session
    hashes, reset tokens, verification tokens, or secrets.
-   Use appropriate HTTP status codes, but keep
    account-enumeration-sensitive responses neutral.
-   If using cookie sessions, protect state-changing requests against
    CSRF using the framework's supported approach, origin checks, and/or
    CSRF tokens as appropriate.
-   CORS must be restrictive when a separate frontend origin is
    required; do not combine credentialed requests with wildcard
    origins.

## 8. Admin Panel scope and authorization

### UI pages

-   `/admin`: summary cards for total users, verified users, unverified
    users, suspended users, and recent activity. Use efficient aggregate
    queries and avoid loading entire collections.
-   `/admin/users`: paginated table with search, filters for
    status/role/verification, and allowlisted sorting.
-   `/admin/users/:id`: profile metadata, verification state, account
    status, role, timestamps, and safe administrative actions.
-   `/admin/audit-logs`: filter by actor, action, target, and date
    range.
-   Optional `/admin/email-events`: sanitized delivery status and
    failure categories.

### UX requirements

-   Reuse existing typography, colors, spacing, components, navigation,
    responsive behavior, and accessibility conventions.
-   Do not replace the existing site-wide design or navigation
    unnecessarily.
-   Provide loading, empty, error, success, and confirmation states.
-   Require confirmation for suspension, reactivation, and role changes.
-   Disable duplicate submissions while a request is in progress.
-   Show clear permission errors without revealing internal
    implementation details.
-   Never rely on frontend route hiding as the security boundary.

### Server-side role policy

-   New public users always receive `role: user`.
-   Only a securely bootstrapped initial admin or a privileged admin can
    grant admin privileges.
-   Prevent an admin from accidentally removing or demoting the last
    active privileged admin.
-   Prevent an admin from suspending or demoting their own account if
    that could lock out administration.
-   Consider separating `admin` from more granular permissions if the
    project grows.
-   Every privileged mutation must be checked server-side and written to
    `audit_logs`.
-   Revoke affected sessions when an account is suspended or privileges
    change, or enforce the new status/role on every request so stale
    sessions cannot retain access.
-   Provide a secure first-admin bootstrap procedure via a one-time
    CLI/seed command or protected deployment task. Never expose a public
    "make me admin" endpoint.

### Audit actions

At minimum record: - `user.suspended` - `user.reactivated` -
`user.role_changed` - `admin.login` and `admin.logout` where
appropriate - `sessions.revoked` - Relevant security configuration
changes, if supported

Include actor, target, timestamp, request ID, and allowlisted
before/after values where useful. Never include secrets or raw tokens.

## 9. Suggested folder structure

This is a **logical example**, not a mandate. Match the existing
project's conventions and framework.

``` text
project-root/
├── docs/
│   └── implementation-plan.md
├── src/                         # or the project's existing source directory
│   ├── config/
│   │   ├── env.*
│   │   └── database.*
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.*
│   │   │   ├── auth.controller.*
│   │   │   ├── auth.service.*
│   │   │   ├── auth.validation.*
│   │   │   └── auth.middleware.*
│   │   ├── users/
│   │   │   ├── user.model.*
│   │   │   ├── user.repository.*
│   │   │   ├── user.service.*
│   │   │   └── user.validation.*
│   │   ├── sessions/
│   │   ├── email/
│   │   │   ├── resend.client.*
│   │   │   ├── email.service.*
│   │   │   └── templates/
│   │   ├── admin/
│   │   │   ├── admin.routes.*
│   │   │   ├── admin.controller.*
│   │   │   ├── admin.service.*
│   │   │   └── admin.authorization.*
│   │   └── audit/
│   ├── middleware/              # if consistent with the framework
│   ├── pages-or-routes/
│   │   ├── login/
│   │   ├── register/
│   │   ├── verify-email/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── admin/
│   ├── components/              # reuse existing shared components
│   └── styles/                  # preserve existing styling system
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── security/
├── .env.example
└── existing project files...
```

Use the file extensions, directory names, routing conventions, and
language already used by the project. Do not create parallel duplicate
folders if equivalent modules already exist.

## 10. Testing plan

### Unit tests

-   Email normalization and validation.
-   Password hashing and verification.
-   Token generation, hashing, expiry, and one-time consumption.
-   Authorization helpers and account-state checks.
-   Input schema validation and safe response shaping.
-   Resend adapter error classification and retry rules.

### Integration tests

-   Registration creates the correct unverified user.
-   Verification succeeds once and rejects expired, invalid, or reused
    tokens.
-   Login rejects wrong passwords, unverified users, and suspended
    users.
-   Logout revokes the session.
-   Forgot-password responses do not disclose whether the email exists.
-   Reset-password changes the hash and invalidates old sessions/tokens.
-   Duplicate registration does not overwrite an existing account.
-   MongoDB unique indexes handle concurrent duplicate registrations.
-   Admin list filters, pagination, role updates, suspension, and audit
    logging work correctly.
-   A non-admin cannot call any admin endpoint directly.
-   A suspended user cannot continue using a previously issued session.
-   Email-provider failure leaves the user in a safe, recoverable state.

### Security tests

-   Attempt privilege escalation by sending `role: admin` during
    registration/profile updates.
-   Attempt IDOR by changing user IDs in admin and account routes.
-   Attempt CSRF where cookie authentication is used.
-   Attempt brute force and verification/reset email flooding.
-   Attempt reuse of consumed tokens and concurrent token consumption.
-   Verify cookies have correct flags in production.
-   Verify secrets and raw tokens are absent from client bundles, API
    responses, logs, and error reports.
-   Verify that invalid webhook signatures are rejected if webhooks
    exist.
-   Verify last-admin protections and self-lockout protections.

### End-to-end and regression tests

-   Full register → verify email → login → logout journey.
-   Forgot password → reset password → login with new password.
-   Admin login → search user → suspend/reactivate user → verify audit
    entry.
-   Test responsive layouts and keyboard accessibility for all new
    pages.
-   Run existing unit/integration/E2E tests and production build.
-   Manually compare key pages against the pre-change UI to ensure the
    existing design and functionality remain intact.

Use a disposable test database or isolated test collections. Never run
destructive tests against production data.

## 11. Deployment and operations

1.  Provision MongoDB with network restrictions, least-privilege
    credentials, backups, and TLS where supported.
2.  Configure the Resend account, verified sender domain, DNS records,
    and production API key.
3.  Set `MONGODB_URI`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
    `APP_BASE_URL`, and any session/token secrets in the hosting
    provider's secret manager.
4.  Ensure production uses HTTPS and secure cookies.
5.  Configure allowed origins, trusted proxy behavior, and rate-limit
    storage for the actual deployment topology. Avoid in-memory rate
    limits if multiple instances require shared limits.
6.  Run schema/index initialization or migrations through a controlled
    deployment step.
7.  Create the first admin through a secure one-time bootstrap
    procedure; remove or disable the bootstrap capability afterward.
8.  Deploy to staging and test email delivery, links, cookies, role
    checks, and logs.
9.  Deploy production with rollback capability and monitor
    authentication errors, email failures, elevated request rates, and
    database errors.
10. Document key rotation, account recovery, admin lockout recovery,
    backup restoration, and incident response.
11. Keep dependencies updated and review the framework's security
    guidance before production release.

### Operational notes

-   MongoDB TTL indexes are cleanup aids, not a substitute for checking
    expiration in application code.
-   Resend delivery acceptance does not guarantee inbox delivery.
    Monitor bounces, complaints, and provider errors where available.
-   Configure email sending limits and abuse monitoring.
-   Do not expose detailed provider errors or internal database errors
    to users.
-   Keep audit-log access restricted and define retention based on
    operational and legal requirements.

## 12. Environment variable checklist

Create or update `.env.example` with placeholders only:

``` env
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
MONGODB_URI=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
SESSION_SECRET=
TOKEN_PEPPER=
```

Adapt variables to the actual framework. If the implementation uses
separate secrets for session signing, CSRF, or token hashing, name and
validate them explicitly. Do not place real credentials in
`.env.example`. Ensure the real `.env` file is ignored by version
control.

## 13. Implementation phases for the AI coding agent

### Phase 0 --- Inspect and report

-   Identify the framework, runtime, package manager, database
    library/ODM, UI styling system, route structure, tests, and
    deployment target.
-   Run existing checks and note pre-existing failures.
-   Return a concise implementation map with the files that will be
    reused, added, or changed.
-   Do not make broad changes before this audit.

### Phase 1 --- Foundation

-   Add validated server-only configuration.
-   Reuse or implement a MongoDB connection utility.
-   Add user/session/token/audit models or repositories and required
    indexes.
-   Add unit tests for normalization, password hashing, token utilities,
    and authorization.
-   Verify existing build and tests still pass.

### Phase 2 --- Authentication backend

-   Implement registration, email verification, login, logout,
    current-user, forgot-password, reset-password, and verification
    resend.
-   Implement safe session cookies, expiry checks, revocation, rate
    limiting, and centralized error handling.
-   Add integration tests for success and failure paths.

### Phase 3 --- Resend and templates

-   Implement the centralized Resend adapter and email templates.
-   Add development-safe email previews or a mock provider.
-   Test configuration errors, provider errors, and rate-limit
    responses.
-   Verify no secret or raw token is logged.

### Phase 4 --- Authentication UI

-   Add or adapt registration, login, verification, forgot-password, and
    reset-password pages.
-   Match existing styles and components.
-   Add loading, validation, expired-link, resend, and error states.
-   Protect existing account pages without changing unrelated features.

### Phase 5 --- Admin Panel

-   Implement server-side admin guards and permissions before connecting
    UI actions.
-   Build dashboard, users list/detail, account status controls, role
    management, and audit log pages.
-   Add pagination, filters, confirmation dialogs, and accessible
    responsive states.
-   Implement first-admin bootstrap securely and enforce last-admin
    protections.
-   Test every privileged endpoint as both admin and non-admin.

### Phase 6 --- Hardening and regression

-   Run unit, integration, E2E, security, lint, type-check, and
    production-build commands supported by the project.
-   Fix newly introduced failures; clearly distinguish pre-existing
    failures from regressions.
-   Review logs, response payloads, cookies, CORS/CSRF configuration,
    and secret exposure.
-   Confirm existing features and visual design remain intact.

### Phase 7 --- Staging and release

-   Deploy to staging and test real email delivery using controlled test
    accounts.
-   Verify DNS/domain setup, environment variables, MongoDB indexes,
    session behavior, and admin bootstrap.
-   Deploy with rollback instructions and monitoring.
-   Document setup, testing commands, deployment steps, and known
    limitations.

## 14. Final coding-agent report

At completion, report: - Actual framework and runtime discovered. -
Files added and changed. - Database collections and indexes created. -
API endpoints implemented. - Resend configuration required. - How to
create the first admin securely. - Environment variables required, with
no real secret values. - Tests and build commands run, plus results. -
Any manual DNS/deployment steps still required. - Any deviations from
this plan and the reason for each.

Do not claim an item is complete unless it has been implemented and
tested. If repository access is unavailable, request the project files
or repository context rather than inventing its structure.
