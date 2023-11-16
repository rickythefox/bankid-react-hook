/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from "@testing-library/react";
import { authenticate401Error, authenticateNetworkError, collect401Error, collectNetworkError, defaultHandlers } from "../mocks/mockApi.ts";
import { setupServer } from "msw/node";
import useBankID from "./useBankID.ts";

let server: ReturnType<typeof setupServer>;

beforeAll(() => {
    server = setupServer(...defaultHandlers);
    server.listen();
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
    server.resetHandlers();
});

describe('useBankID', () => {
    it('happy flow works', async () => {
        const {result, rerender} = renderHook(() => useBankID("https://foo.com/api"));

        // Can start login
        expect(result.current.start).toBeTruthy();

        // Trigger login
        await act(() => result.current.start!());

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

    it("can cancel login", async () => {
        const {result, rerender} = renderHook(() => useBankID("https://foo.com/api"));

        // Trigger login
        await act(() => result.current.start!());
        // Wait for orderRef
        await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

        // Cancel login
        await act(() => result.current.cancel!());
        expect(result.current.data.orderRef).toBeFalsy();

        // No qr codes are generated
        act(() => void vi.advanceTimersByTime(2000));
        await waitFor(() => expect(result.current.data.qr).toBeFalsy());
    });

    it("provides an error message on authenticate network error", async () => {
        server.use(...authenticateNetworkError);

        const {result, rerender} = renderHook(() => useBankID("https://foo.com/api"));

        // Trigger login
        await act(() => result.current.start!());

        // Wait for error
        await waitFor(() => expect(result.current.errorMessage).toEqual("Error when calling authenticate: AxiosError: Network Error"));
    });

    it("provides an error message on authenticate fail", async () => {
        server.use(...authenticate401Error);

        const {result, rerender} = renderHook(() => useBankID("https://foo.com/api"));

        // Trigger login
        await act(() => result.current.start!());

        // Wait for error
        await waitFor(() => expect(result.current.errorMessage).toEqual("Error when calling authenticate: AxiosError: Request failed with status code 401"));
    });

    it("provides an error message on collect network error", async () => {
        server.use(...collectNetworkError);

        const {result, rerender} = renderHook(() => useBankID("https://foo.com/api"));

        // Trigger login
        await act(() => result.current.start!());

        // Gets an orderRef
        await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

        // Wait 2s
        act(() => void vi.advanceTimersByTime(2000));

        // Wait for error
        await waitFor(() => expect(result.current.errorMessage).toEqual("Error when calling collect: AxiosError: Network Error"));
    });

    it("provides an error message on collect fail", async () => {
        server.use(...collect401Error);
        const h = server.listHandlers();

        const {result, rerender} = renderHook(() => useBankID("https://foo.com/api"));

        // Trigger login
        await act(() => result.current.start!());

        // Gets an orderRef
        await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

        // Wait 2s
        act(() => void vi.advanceTimersByTime(2000));

        // Wait for error
        await waitFor(() => expect(result.current.errorMessage).toEqual("Error when calling collect: AxiosError: Request failed with status code 401"));
    });
});
