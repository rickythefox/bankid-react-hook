import { http, HttpResponse } from "msw";

let collectedCount = 0;
let qrCount = 0;

export const defaultHandlers = [
    http?.post(/.*\/authenticate/, (_info) => {
        return HttpResponse.json(
            {
                "orderRef": "123",
                "autoStartToken": "token",
                "qr": "qr-initial"
            }
        );
    }),

    http?.get(/.*\/collect/, (info) => {
        const url = new URL(info.request.url);
        if (url.searchParams.get("orderRef") !== "123") {
            return HttpResponse.error();
        }
        collectedCount++;
        return HttpResponse.json(
            {
                "status": collectedCount > 7 ? "complete" : "pending",
                "hintCode": collectedCount > 7
                    ? ""
                    : collectedCount > 5
                        ? "userSign"
                        : "outstandingTransaction",
                "orderRef": "123",
                "completionData": collectedCount > 7 ? {
                    "user": {
                        "personalNumber": "string",
                        "name": "string",
                        "givenName": "string",
                        "surname": "string"
                    }
                } : null,
                "token": "jwt"
            }
        );
    }),

    http?.get(/.*\/qr/, (info) => {
        const url = new URL(info.request.url);
        if (url.searchParams.get("orderRef") !== "123") {
            return HttpResponse.error();
        }
        return HttpResponse.json(
            {
                "qr": `qr-${++qrCount}`
            }
        );
    }),

    http?.post(/.*\/cancel/, (info) => {
        const url = new URL(info.request.url);
        if (url.searchParams.get("orderRef") !== "123") {
            return HttpResponse.error();
        }
        collectedCount = 0;
        return HttpResponse.json();
    }),
];

export const authenticateNetworkError = [
    http?.post(/.*\/authenticate/, (_info) => {
        return HttpResponse.error()
    })
];

export const authenticate401Error = [
    http?.post(/.*\/authenticate/, (_info) => {
        return HttpResponse.text("Unauthorized", { status: 401 });
    })
];

export const collectNetworkError = [
    http?.get(/.*\/collect/, (_info) => {
        return HttpResponse.error()
    })
];

export const collect401Error = [
    http?.get(/.*\/collect/, (_info) => {
        return HttpResponse.text("Unauthorized", { status: 401 });
    })
];

export const qrNetworkError = [
    http?.get(/.*\/qr/, (_info) => {
        return HttpResponse.error()
    })
];

export const qr401Error = [
    http?.get(/.*\/qr/, (_info) => {
        return HttpResponse.text("Unauthorized", { status: 401 });
    })
];
