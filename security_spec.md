# Security Specification (Phase 0: Payload-First Security TDD)

## 1. Data Invariants
1. **Default-Deny Catch-All**: Unmapped paths are strictly denied (`allow read, write: if false;`).
2. **ID Poisoning Guard**: Every single-document path variable (`{userId}`, `{productId}`, `{gameId}`, `{transactionId}`, `{testimonialId}`, `{settingId}`, `{logId}`) must match `^[a-zA-Z0-9_\-]+$` and be `<= 128` characters.
3. **PII Isolation**: `/users/{userId}`, `/settings/{settingId}`, and `/audit_logs/{logId}` contain sensitive PII or credentials and can only be read by the document owner or verified administrators (`will.buisness7@gmail.com` or existing `/admins/{uid}`).
4. **Strict Validation Blueprints (`isValid[Entity]`)**: Every `create` and `update` operation must pass through its dedicated `isValid[Entity](incoming())` helper enforcing `hasAll`, `hasOnly`, string `.size()` bounds, and immutable fields (`id`, `createdAt`, `ownerId`).
5. **Temporal Integrity & Immutability**: `id` and `created_at` cannot be mutated during `update`.
6. **Terminal State Locking**: Once a `Transaction` reaches `status == 'completed'` or `status == 'cancelled'`, non-admin users cannot mutate its state.

## 2. The "Dirty Dozen" Payloads (All Must Return `PERMISSION_DENIED`)
1. **Shadow Field Injection on User**: `{ id: "u1", email: "a@b.com", name: "User", role: "buyer", status: "active", created_at: "2026-01-01T00:00:00Z", isSuperAdmin: true }`
2. **Self-Assigned Admin Role on User Create**: `{ id: "u1", email: "hacker@evil.com", name: "Hacker", role: "admin", status: "active", created_at: "2026-01-01T00:00:00Z" }`
3. **Unverified Email Spoofing Admin**: Authenticated request with `email: "will.buisness7@gmail.com"` and `email_verified: false`.
4. **PII Blanket Read on `/users/{otherUserId}`**: Authenticated non-owner attempting `get` on another user's profile document.
5. **Unbounded ID Poisoning**: Document path `/products/a_1500_char_id...` exceeding 128 chars or containing invalid characters.
6. **Oversized String Exhaustion on Product Title**: `{ id: "p1", game: "MLBB", category: "Akun Game", title: "<10000 chars>", price: 10000, stock: 1, condition: "ready" }`
7. **Negative Price / Stock Injection on Product**: `{ id: "p1", game: "MLBB", category: "Akun Game", title: "Valid", price: -5000, stock: -1, condition: "ready" }`
8. **Terminal State Mutation on Completed Transaction**: Non-admin attempting `update` on `/transactions/{txId}` where `resource.data.status == 'completed'`.
9. **Immutable `created_at` Tampering on Update**: Updating `created_at` to a different value on `/transactions/{txId}` or `/users/{userId}`.
10. **Unauthorized Write to `/settings/{settingId}`**: Non-admin user attempting to overwrite payment gateway or SMTP settings.
11. **Audit Log Deletion / Tampering**: Attempting `update` or `delete` on `/audit_logs/{logId}` (audit logs are append-only).
12. **Invalid Rating Out-of-Bounds on Testimonial**: `{ id: "t1", name: "Buyer", rating: 999, text: "Great", created_at: "2026-01-01T00:00:00Z" }`
