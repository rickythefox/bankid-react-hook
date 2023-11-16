/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from "@testing-library/react";
import handlers from "../mocks/mockApi.ts";
import { setupServer } from "msw/node";
import useBankID from "./useBankID.ts";

const waitForValueToChange = async <T, >(getValue: () => T) => {
    const original = getValue();

    await waitFor(async () => {
        expect(await original).not.toEqual(await getValue());
    });
};

beforeAll(() => {
    setupServer(...handlers).listen();
});

beforeEach(() => {
    vi.useFakeTimers({
        toFake: [
            'setTimeout',
            'clearTimeout',
            'setImmediate',
            'clearImmediate',
            'setInterval',
            'clearInterval',
            'Date',
            'nextTick',
            'hrtime',
            'requestAnimationFrame',
            'cancelAnimationFrame',
            'requestIdleCallback',
            'cancelIdleCallback',
            'performance',
            // The above excludes 'queueMicrotask'
        ],
        shouldAdvanceTime: true,
    });
});

afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
});

describe('useBankID', () => {
    it('happy flow works', async () => {
        const {result, rerender} = renderHook(() => useBankID("https://foo.com/api"));

        // Can start login
        expect(result.current.start).toBeTruthy();

        // Trigger login
        act(() => void result.current.start!());

        // Can't start login while logging in
        expect(result.current.start).toBeFalsy();

        // Gets an orderRef
        await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

        // Gets a qr code 2 seconds later
        act(() => void vi.advanceTimersByTime(2000));
        await waitFor(() => expect(result.current.data.qr).toBeTruthy());

        // Continues polling for qr codes
        for (let i = 0; i < 4; i++) {
            const lastQr = result.current.data.qr;
            act(() => void vi.advanceTimersByTime(2000));
            await waitFor(() => expect(result.current.data.qr).not.toBe(lastQr));
        }

        // User is signing, so no more qr codes
        act(() => void vi.advanceTimersByTime(2000));
        await waitFor(() => expect(result.current.data.qr).toBeFalsy());

        // User logs in for two more collect calls
        for (let i = 0; i < 2; i++) {
            act(() => void vi.advanceTimersByTime(2000));
            await waitFor(() => expect(result.current.data.userData).toBeFalsy());
        }

        // Gets user data
        await waitFor(() => expect(result.current.data.userData).toBeTruthy());

        // Gets JWT token
        await waitFor(() => expect(result.current.token).toEqual("jwt"));

        // Can log in again
        expect(result.current.start).toBeTruthy();
    });
});
