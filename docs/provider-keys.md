# User-owned provider keys

Existing users log in through Better Auth. There is no public signup or account
management. A Better Auth password account is required; a row in SPY's `users`
table alone does not provide login credentials.

Each user supplies a Google embeddings key and at least one chat provider key.
As in the source app, Google supports both capabilities, so one Google key can
satisfy both requirements. Exa is optional. Provider verification checks access
at save time; it does not guarantee quota, billing, or access to every model.

Keys are encrypted with AES-256-GCM before being written to `providerKeys` in
Convex. Authentication determines the owner; public functions never accept a
user ID. Ciphertext is bound to the owner and provider through authenticated
associated data. Public queries return only provider IDs, last-four-character
hints, and readiness flags. Raw saved keys are never sent back to the browser
or stored in browser storage.

`PROVIDER_KEYS_ENCRYPTION_KEY` is a server-only Convex environment variable:
32 random bytes encoded as base64. Keep it with the deployment's secret backup;
do not replace it while saved keys exist. Rotation requires decrypting and
re-encrypting existing rows with both keys available. Database exports contain
ciphertext and require this secret for recovery. Never prefix it with `VITE_`.

Node actions that later call models, embeddings, or tools must use
`requireProviderKey` from `convex/providers/credentials.ts`. It enforces setup
and resolves only the authenticated caller's saved key. There is no app-wide
provider-key fallback. Chat, embedding execution, and search transport are
separate feature ports and are not implemented by the key-storage sprint.

Saving verifies with fixed provider endpoints before encryption. Exa verification
performs one search and may incur an Exa charge; the settings pane discloses it.
Verification requests time out after ten seconds and reject redirects. Provider
response bodies and credentials are not logged or surfaced as errors.

Per the user's request, this feature has no automated or browser behavior tests
run during implementation. No accounts or sample keys are seeded. The user will
manually check save, refresh/revisit persistence, account isolation, removal,
rejected credentials, and the setup gate with their own existing-user accounts.
TypeScript compilation and deployment are build steps only.
