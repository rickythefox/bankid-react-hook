/**
 * @vitest-environment jsdom
 */
import {
  authenticate401Error,
  authenticateNetworkError,
  collect401Error,
  collectFailedResponse,
  collectNetworkError,
  COLLECTS_TO_COMPLETE,
  defaultHandlers,
  qr401Error,
  qrNetworkError,
  QRS_TO_GENERATE,
  resetCounts,
  setCollectedCount,
} from "../../../mocks/mockApi";
import { Status, useBankID } from "../src";
import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let server: ReturnType<typeof setupServer>;

beforeAll(() => {
  server = setupServer(...defaultHandlers);
  server.listen();
});

afterAll(() => {
  server.close();
});

beforeEach(() => {
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

  resetCounts();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  server.resetHandlers();
});

describe("useBankID", () => {
  it("normal flow works", async () => {
    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Can start login
    expect(result.current.start).toBeTruthy();

    // Trigger login
    await act(() => result.current.start!());

    // Can't start login while logging in
    expect(result.current.start()).toBeFalsy();

    // Gets an orderRef, autoStartToken and qr code
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());
    expect(result.current.data.autoStartToken).toBeTruthy();
    expect(result.current.data.qr).toEqual("qr-initial");

    // Gets a qr code 2 seconds later
    act(() => void vi.advanceTimersByTime(1900));
    await waitFor(() => expect(result.current.data.qr).toEqual("qr-1"));

    expect(result.current.loginStatus).toEqual(Status.Polling);

    // Continues polling for qr codes
    for (let i = 0; i < QRS_TO_GENERATE; i++) {
      const lastQr = result.current.data.qr;
      act(() => void vi.advanceTimersByTime(1000));
      await waitFor(() => expect(result.current.data.qr).not.toBe(lastQr));
    }

    // User is signing, so no more qr codes
    act(() => void vi.advanceTimersByTime(2000));
    await waitFor(() => expect(result.current.data.qr).toBeFalsy());

    expect(result.current.loginStatus).toEqual(Status.UserSign);

    // User logs in for a few more collect calls
    for (let i = 0; i < COLLECTS_TO_COMPLETE - QRS_TO_GENERATE + 1; i++) {
      act(() => void vi.advanceTimersByTime(2000));
      await waitFor(() => expect(result.current.data.userData).toBeFalsy());
    }

    // Gets user data
    await waitFor(() => expect(result.current.data.userData).toBeTruthy());

    // Gets JWT token
    await waitFor(() => expect(result.current.data?.userData?.token).toEqual("jwt"));

    expect(result.current.loginStatus).toEqual(Status.Complete);

    // Can log in again
    expect(result.current.start).toBeTruthy();
  });

  it("continuation flow works", async () => {
    setCollectedCount(5);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Can start login
    expect(result.current.start).toBeTruthy();

    // Trigger login
    await act(() => result.current.start!("orderref-123"));

    // Can't start login while logging in
    expect(result.current.start()).toBeFalsy();

    expect(result.current.loginStatus).toEqual(Status.Polling);

    // User is signing, so no more qr codes
    act(() => void vi.advanceTimersByTime(4000));
    await waitFor(() => expect(result.current.data.qr).toBeFalsy());

    // User logs in for two more collect calls
    for (let i = 0; i < 2; i++) {
      act(() => void vi.advanceTimersByTime(2000));
      await waitFor(() => expect(result.current.data.userData).toBeFalsy());
    }

    // Gets user data
    await waitFor(() => expect(result.current.data.userData).toBeTruthy());

    // Gets JWT token
    await waitFor(() => expect(result.current.data?.userData?.token).toEqual("jwt"));

    expect(result.current.loginStatus).toEqual(Status.Complete);

    // Can log in again
    expect(result.current.start).toBeTruthy();
  });

  it("failed login signals failure", async () => {
    server.use(...collectFailedResponse);
    setCollectedCount(5);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    await act(() => result.current.start!("orderref-123"));

    // User is signing, so no more qr codes
    act(() => void vi.advanceTimersByTime(4000));
    await waitFor(() => expect(result.current.data.qr).toBeFalsy());

    // User logs in for two more collect calls
    for (let i = 0; i < 2; i++) {
      act(() => void vi.advanceTimersByTime(2000));
      await waitFor(() => expect(result.current.data.userData).toBeFalsy());
    }

    // Gets failed login status
    await waitFor(() => expect(result.current.loginStatus).toEqual(Status.Failed));
  });

  it("can cancel login", async () => {
    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    result.current.start!();
    // Wait for orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    expect(result.current.loginStatus).toEqual(Status.Polling);

    // Cancel login
    await act(() => result.current.cancel!());
    expect(result.current.cancel()).toBeFalsy();

    // No qr codes are generated
    act(() => void vi.advanceTimersByTime(2000));
    await waitFor(() => expect(result.current.data.qr).toBeFalsy());
    expect(result.current.loginStatus).toEqual(Status.Cancelled);
  });

  it("provides an error message on authenticate network error", async () => {
    server.use(...authenticateNetworkError);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    result.current.start!();

    // Wait for error
    await waitFor(() => expect(result.current.errorMessage).toMatch("Error when calling authenticate"));
    expect(result.current.loginStatus).toEqual(Status.Failed);
  });

  it("provides an error message on authenticate fail", async () => {
    server.use(...authenticate401Error);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    result.current.start!();

    // Wait for error
    await waitFor(() => expect(result.current.errorMessage).toMatch("Error when calling authenticate"));
    expect(result.current.loginStatus).toEqual(Status.Failed);
  });

  it("provides an error message on collect network error", async () => {
    server.use(...collectNetworkError);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    result.current.start!();

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() => expect(result.current.errorMessage).toMatch("Error when calling collect"));
    expect(result.current.loginStatus).toEqual(Status.Failed);
  });

  it("provides an error message on collect fail", async () => {
    server.use(...collect401Error);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    result.current.start!();

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() => expect(result.current.errorMessage).toMatch("Error when calling collect"));
    expect(result.current.loginStatus).toEqual(Status.Failed);
  });

  it("provides an error message on qr network error", async () => {
    server.use(...qrNetworkError);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    result.current.start!();

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() => expect(result.current.errorMessage).toMatch("Error when calling qr"));
    expect(result.current.loginStatus).toEqual(Status.Failed);
  });

  it("provides an error message on qr fail", async () => {
    server.use(...qr401Error);

    const { result } = renderHook(() => useBankID("https://foo.com/api"));

    // Trigger login
    result.current.start!();

    // Gets an orderRef
    await waitFor(() => expect(result.current.data.orderRef).toBeTruthy());

    // Wait 2s
    act(() => void vi.advanceTimersByTime(2000));

    // Wait for error
    await waitFor(() => expect(result.current.errorMessage).toMatch("Error when calling qr"));
    expect(result.current.loginStatus).toEqual(Status.Failed);
  });
});
