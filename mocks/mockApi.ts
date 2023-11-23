import { http, HttpResponse } from "msw";

let collectedCount = 0;
let qrCount = 0;

export const setCollectedCount = (count: number) => {
  collectedCount = count;
};

export const defaultHandlers = [
  http?.post(/.*foo.com\/api\/authenticate/, (_info) => {
    collectedCount = 0;
    qrCount = 0;
    return HttpResponse.json({
      orderRef: "orderref-123",
      autoStartToken: "token",
      qr: "qr-initial",
    });
  }),

  http?.get(/.*foo.com\/api\/collect/, (info) => {
    const url = new URL(info.request.url);
    if (url.searchParams.get("orderRef") !== "orderref-123") {
      return HttpResponse.error();
    }
    collectedCount++;
    return HttpResponse.json({
      status: collectedCount > 7 ? "complete" : "pending",
      hintCode: collectedCount > 7 ? "" : collectedCount > 5 ? "userSign" : "outstandingTransaction",
      orderRef: "orderref-123",
      completionData:
        collectedCount > 7
          ? {
              user: {
                personalNumber: "191212121212",
                name: "Test Testsson",
                givenName: "Test",
                surname: "Testsson",
              },
            }
          : null,
      token: "jwt",
    });
  }),

  http?.get(/.*foo.com\/api\/qr/, (info) => {
    const url = new URL(info.request.url);
    if (url.searchParams.get("orderRef") !== "orderref-123") {
      return HttpResponse.error();
    }
    return HttpResponse.json({
      qr: `qr-${++qrCount}`,
    });
  }),

  http?.post(/.*foo.com\/api\/cancel/, (info) => {
    const url = new URL(info.request.url);
    if (url.searchParams.get("orderRef") !== "orderref-123") {
      return HttpResponse.error();
    }
    collectedCount = 0;
    return HttpResponse.json();
  }),
];

export const authenticateNetworkError = [
  http?.post(/.*foo.com\/api\/authenticate/, (_info) => {
    return HttpResponse.error();
  }),
];

export const authenticate401Error = [
  http?.post(/.*foo.com\/api\/authenticate/, (_info) => {
    return HttpResponse.text("Unauthorized", { status: 401 });
  }),
];

export const collectNetworkError = [
  http?.get(/.*foo.com\/api\/collect/, (_info) => {
    return HttpResponse.error();
  }),
];

export const collect401Error = [
  http?.get(/.*foo.com\/api\/collect/, (_info) => {
    return HttpResponse.text("Unauthorized", { status: 401 });
  }),
];

export const qrNetworkError = [
  http?.get(/.*foo.com\/api\/qr/, (_info) => {
    return HttpResponse.error();
  }),
];

export const qr401Error = [
  http?.get(/.*foo.com\/api\/qr/, (_info) => {
    return HttpResponse.text("Unauthorized", { status: 401 });
  }),
];
