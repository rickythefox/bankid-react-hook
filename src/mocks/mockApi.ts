import { http, HttpResponse } from "msw";

let collectedCount = 0;
let qrCount = 0;

const handlers = [
    http?.post(/.*\/authenticate/, (info) => {
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

export default handlers;