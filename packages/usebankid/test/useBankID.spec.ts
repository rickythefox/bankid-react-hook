/**
 * @vitest-environment jsdom
 */
import {
  authenticate401Error,
  authenticateNetworkError,
  collect401Error,
  collectNetworkError,
  defaultHandlers,
  qr401Error,
  qrNetworkError,
} from "../../../mocks/mockApi";
import { useBankID } from "../src";
import { LoginStatus } from "../src";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import { setupServer } from "msw/node";
import { mutate } from "swr";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const getFetcher = (url: string) => axios.get(url).then((res) => res.data);
const postFetcher = (url: string) => axios.post(url).then((res) => res.data);

let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer(...defaultHandlers);
  server.listen();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
  // Clear SWR cache
  void mutate(Boolean, undefined, false);

  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "Date",
      "nextTick",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "performance",
      // The above excludes 'queueMicrotask' and 'hrtime'
    ],
    shouldAdvanceTime: true,
  });
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  server.resetHandlers();
});

describe("useBankID", () => {
  it("happy flow works", async () => {
    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Can start login
    expect(result.current.start).toBeTruthy();

    // Trigger login
    await act(() => result.current.start!());

    // Can't start login while logging in
    expect(result.current.start).toBeFalsy();

    // Gets an orderRef, autoStartToken and qr code
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());
    expect(result.current.data.autoStartToken).toBeTruthy();
    expect(result.current.data.qr).toBeTruthy();

    // Gets a qr code 2 seconds later
    act(() => void vi.advanceTimersByTime(2000));
    await waitFor(() => expect(result.current.data.qr).toBeTruthy());

    expect(result.current.loginStatus).toEqual(LoginStatus.Polling);

    // Continues polling for qr codes
    for (let i = 0; i < 4; i++) {
      const lastQr = result.current.data.qr;
      act(() => void vi.advanceTimersByTime(2000));
      await waitFor(() => expect(result.current.data.qr).not.toBe(lastQr));
    }

    // User is signing, so no more qr codes
    act(() => void vi.advanceTimersByTime(2000));
    await waitFor(() => expect(result.current.data.qr).toBeFalsy());

    expect(result.current.loginStatus).toEqual(LoginStatus.UserSign);

    // User logs in for two more collect calls
    for (let i = 0; i < 2; i++) {
      act(() => void vi.advanceTimersByTime(2000));
      await waitFor(() => expect(result.current.data.userData).toBeFalsy());
    }

    // Gets user data
    await waitFor(() => expect(result.current.data.userData).toBeTruthy());

    // Gets JWT token
    await waitFor(() => expect(result.current.data?.userData?.token).toEqual("jwt"));

    expect(result.current.loginStatus).toEqual(LoginStatus.Complete);

    // Can log in again
    expect(result.current.start).toBeTruthy();
  });

  it("can cancel login", async () => {
    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Trigger login
    await act(() => result.current.start!());
    // Wait for orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    expect(result.current.loginStatus).toEqual(LoginStatus.Starting);

    // Cancel login
    await act(() => result.current.cancel!());
    expect(result.current.data.orderRef).toBeFalsy();

    // No qr codes are generated
    act(() => void vi.advanceTimersByTime(2000));
    await waitFor(() => expect(result.current.data.qr).toBeFalsy());
    expect(result.current.loginStatus).toEqual(LoginStatus.None);
  });

  it("provides an error message on authenticate network error", async () => {
    server.use(...authenticateNetworkError);

    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Trigger login
    await act(() => result.current.start!());

    // Wait for error
    await waitFor(() =>
      expect(result.current.errorMessage).toEqual("Error when calling authenticate: AxiosError: Network Error"),
    );
    expect(result.current.loginStatus).toEqual(LoginStatus.Failed);
  });

  it("provides an error message on authenticate fail", async () => {
    server.use(...authenticate401Error);

    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Trigger login
    await act(() => result.current.start!());

    // Wait for error
    await waitFor(() =>
      expect(result.current.errorMessage).toEqual(
        "Error when calling authenticate: AxiosError: Request failed with status code 401",
      ),
    );
    expect(result.current.loginStatus).toEqual(LoginStatus.Failed);
  });

  it("provides an error message on collect network error", async () => {
    server.use(...collectNetworkError);

    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Trigger login
    await act(() => result.current.start!());

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() =>
      expect(result.current.errorMessage).toEqual("Error when calling collect: AxiosError: Network Error"),
    );
    expect(result.current.loginStatus).toEqual(LoginStatus.Failed);
  });

  it("provides an error message on collect fail", async () => {
    server.use(...collect401Error);

    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Trigger login
    await act(() => result.current.start!());

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() =>
      expect(result.current.errorMessage).toEqual(
        "Error when calling collect: AxiosError: Request failed with status code 401",
      ),
    );
    expect(result.current.loginStatus).toEqual(LoginStatus.Failed);
  });

  it("provides an error message on qr network error", async () => {
    server.use(...qrNetworkError);

    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Trigger login
    await act(() => result.current.start!());

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() =>
      expect(result.current.errorMessage).toEqual("Error when calling qr: AxiosError: Network Error"),
    );
    expect(result.current.loginStatus).toEqual(LoginStatus.Failed);
  });

  it("provides an error message on qr fail", async () => {
    server.use(...qr401Error);

    const { result } = renderHook(() => useBankID("https://foo.com/api", getFetcher, postFetcher));

    // Trigger login
    await act(() => result.current.start!());

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() =>
      expect(result.current.errorMessage).toEqual(
        "Error when calling qr: AxiosError: Request failed with status code 401",
      ),
    );
    expect(result.current.loginStatus).toEqual(LoginStatus.Failed);
  });
});
