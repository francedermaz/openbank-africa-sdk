# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added
- Production support for the MTN MoMo adapter: `baseUrl`/`apiUser`/`apiKey` config, since MTN has no self-service provisioning API in production (credentials come from the MTN Partner Portal after KYC approval). Sandbox behavior is unchanged.
- Configurable request timeout on `HttpClient` (default 30s), surfaced as a normal `OpenBankError`.
- Single automatic retry on a 401 response: invalidates the cached token and retries once before propagating the error.
- Two new SDK-only error codes (`INVALID_CONFIGURATION`, `NOT_AUTHENTICATED`) — the adapter's and client's own validation guards now throw `OpenBankError` instead of a plain `Error`, consistent with MTN-originated failures.
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
