# Changelog

All notable changes to this project are documented in this file.

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
