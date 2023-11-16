# useBankID React hook

A React hook for using the Swedish BankID.
* Simplifies using the BankID API.
* Polls using correct intevals - 1s for qr code, 2s for collect.
* Supports animated QR code.
* Includes mocked API, demo and tests.

Adapt to your own backend implementation.

Happy flow works for now, error handling is being worked on. 

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
