# useBankID React hook

A React hook for using the Swedish BankID.
* Simplifies using the BankID API.
* Polls using correct intervals - 1s for qr code, 2s for collect.
* Supports animated QR code.
* Includes mocked API, demo and tests.
* Demo can be used to test a real API implementation

Adapt to your own backend implementation.

### Running the demo
Uses vite for bundling, pnpm for package management.

```bash
pnpm install
pnpm dev
```

### Testing
Uses vitest for testing and MSW for mocking the API.

```bash
pnpm test
```
