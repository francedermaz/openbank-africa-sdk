# Changelog

All notable changes to this project are documented in this file.

## [0.3.0] - 2026-07-30

### Added
- **Disbursements support** for the MTN MoMo adapter, under a new `client.disbursements` namespace: `transfer` (pay a user), `getStatus`, `getBalance`, and `validateAccountHolder`. `transfer` mirrors `requestToPay` but sends the counterparty as `payee` rather than `payer`, since money flows out; it returns `PENDING` on MTN's `202 Accepted` and settles via `getStatus` polling.
- `validateAccountHolder(phoneNumber)` checks a number is a registered, active MoMo account before you send money to it. A number MTN doesn't know answers HTTP 404, which resolves to `{ isActive: false }` rather than throwing — for a call that exists to ask whether an account exists, that is the answer, not a failure. Every other error still propagates.
- Three MTN error codes that surface on disbursement transfers: `NOT_ENOUGH_FUNDS`, `PAYER_LIMIT_REACHED`, `SENDER_ACCOUNT_NOT_ACTIVE`. Previously they fell through to `UNKNOWN_ERROR`.
- New exported types: `TransferRequest`, `TransferResult`, `AccountHolderStatus`, `CollectionsApi`, `DisbursementsApi`, `MtnProducts`, `MtnProductCredentials`, `MtnProductName`.
- Integration test suite against the real sandbox for disbursements (`MTN_DISBURSEMENTS_KEY`).

### Changed
- **BREAKING —** per-product credentials moved from the top level into `products.{collections,disbursements}`. Collections and Disbursements are separate product subscriptions in the MoMo portal, each issuing its own primary key (and, in production, its own API user/key pair), so a single top-level `subscriptionKey`/`apiUser`/`apiKey` could not express both. `baseUrl` and `targetEnvironment` stay top-level — the host and wallet platform are shared across products. At least one product must be configured. All call sites (`client.collections.*`) are unchanged; see the README's "Migrating from 0.2.x".
- **BREAKING —** the integration-test env var `MTN_SUBSCRIPTION_KEY` is now `MTN_COLLECTIONS_KEY`.
- Each product now owns its own token and its own 401-retry state: a 401 on disbursements invalidates only the disbursements token and leaves collections untouched. Previously a single `TokenManager` was hardcoded to the collections token endpoint.
- In sandbox, `authenticate()` provisions one API user/key pair **per configured product**, since each product subscription carries a different subscription key. It authenticates all configured products in parallel and fails as a whole if any one fails.
- Calling into a product that was not configured now rejects with `INVALID_CONFIGURATION` naming the missing config key, instead of failing on an undefined namespace.

### Internal
- Extracted `MtnProductSession` (per-product credentials, token, context, and 401 retry) and `errors.ts` (`withMtnErrorMapping`) out of the adapter and out of `collections.ts`. `MtnMomoAdapter` now only wires products to operations, and `collections.ts`/`disbursements.ts` are symmetric modules of pure functions. `CollectionsRequestContext` was renamed to `MtnRequestContext` — it was never collections-specific.

## [0.2.1] - 2026-07-29

### Changed
- README: point installation at `npm install openbank-africa-sdk` now that the package is published.
- `package.json`: normalized `repository.url` (`git+https://...`) and array formatting per `npm pkg fix`.

## [0.2.0] - 2026-07-29

### Added
- Production support for the MTN MoMo adapter: `baseUrl`/`apiUser`/`apiKey`/`targetEnvironment` config, since MTN has no self-service provisioning API in production (credentials come from the MTN Partner Portal after KYC approval) and no single production base URL (MTN runs a separate host per market). `targetEnvironment` is MTN's wire-level per-market identifier (e.g. `mtnrwanda`) — distinct from the SDK's own `environment: 'production'` mode switch, which is never sent on the wire. Sandbox behavior is unchanged. Unverified against a real MTN production tenant — see the README's Production section.
- Configurable request timeout on `HttpClient` (default 30s), armed through the full response including body streaming, surfaced as a normal `OpenBankError` with a new `TIMEOUT` code.
- Single automatic retry on a 401 response: invalidates the cached token and retries once before propagating the error. `requestToPay`'s retry reuses the original `X-Reference-Id` so MTN sees one idempotent request, not a duplicate.
- Two new SDK-only error codes (`INVALID_CONFIGURATION`, `NOT_AUTHENTICATED`) — the adapter's and client's own validation guards now throw `OpenBankError` instead of a plain `Error`, consistent with MTN-originated failures. Token-refresh and sandbox-provisioning failures are now mapped too, not just collections calls.
- Expanded `SdkErrorCode` to match MTN's full documented error code reference (previously only had a partial set; unmapped codes like `INVALID_CURRENCY` fell through to `UNKNOWN_ERROR`).
- `OpenBankError` now carries the originating HTTP status (`httpStatus`) when available.
- README: installation, requirements, production configuration, and error handling sections.
- `engines.node >=18` in `package.json`.

## [0.1.0] - 2026-07-28

### Added
- Initial MVP scaffold: TypeScript project setup, Jest testing, CI workflow.
- Core HTTP client, OAuth2 token manager, base64 and UUID utilities.
- MTN MoMo adapter: sandbox provisioning, Request to Pay, transaction status, account balance.
- Public `OpenBankClient` interface with a `mtn-momo` adapter.
- Minimal example app and integration test harness (requires real MTN sandbox credentials).
- MTN API errors normalized to the SDK's own `OpenBankError`/`SdkErrorCode` contract.

### Verified
- Full flow (`authenticate` → `requestToPay` → `getStatus`) validated against the real MTN MoMo sandbox.
