# Changelog

All notable changes to this project are documented in this file.

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
