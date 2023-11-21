# useBankID React hook

A React hook for using the Swedish BankID.
* Simplifies using the BankID API.
* Polls using correct intervals - 1s for qr code, 2s for collect.
* Supports animated QR code.

### Building

```bash
pnpm build
```

### Testing
Uses vitest for testing and MSW for mocking the API.

```bash
pnpm test
```
