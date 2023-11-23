import { http, HttpResponse } from "msw";

export const COLLECTS_TO_COMPLETE = 8;
export const QRS_TO_GENERATE = 5;

let collectedCount = 0;
let qrCount = 0;

export const setCollectedCount = (count: number) => {
  collectedCount = count;
};

export const resetCounts = () => {
  collectedCount = 0;
  qrCount = 0;
};

export const defaultHandlers = [
  http?.post(/.*foo.com\/api\/authenticate/, (_info) => {
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
      status: collectedCount >= COLLECTS_TO_COMPLETE ? "complete" : "pending",
      hintCode:
        collectedCount >= COLLECTS_TO_COMPLETE
          ? ""
          : collectedCount >= QRS_TO_GENERATE
            ? "userSign"
            : "outstandingTransaction",
      orderRef: "orderref-123",
      completionData:
        collectedCount >= COLLECTS_TO_COMPLETE
          ? {
              user: {
                personalNumber: "191212121212",
                name: "Test Testsson",
                givenName: "Test",
                surname: "Testsson",
              },
            }
          : null,
      token: collectedCount < COLLECTS_TO_COMPLETE ? `collected-${collectedCount}` : "jwt",
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
    return HttpResponse.json({});
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
