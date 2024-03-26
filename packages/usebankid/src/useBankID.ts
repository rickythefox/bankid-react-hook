import { ActionType, reducer } from "./reducer";
import { Status } from "./types";
import { useCallback, useEffect, useMemo, useReducer } from "react";

async function fetchData(url: string, options?: RequestInit, searchParams?: Record<string, any>) {
  const res = await fetch(searchParams ? `${url}?${new URLSearchParams(searchParams).toString()}` : url, {
    ...options,
  });
  return res.json();
}

export function useBankID(baseUrl: string) {
  baseUrl = baseUrl.replace(/\/$/, "");
  const [state, dispatch] = useReducer(reducer, { status: Status.None });
  const { status, orderRef, qr, userData, autoStartToken, error, errorMessage, token, collectInterval, qrInterval } =
    state;

  const callAuthenticate = useCallback(() => {
    fetchData(`${baseUrl}/authenticate`, { method: "POST" })
      .then((data) => dispatch({ type: ActionType.UpdateAuthenticationData, ...data }))
      .catch((error) => dispatch({ type: ActionType.Error, error, errorMessage: "Error when calling authenticate" }));
  }, [baseUrl]);

  const startCollecting = useCallback(() => {
    return setInterval(() => {
      fetchData(`${baseUrl}/collect`, undefined, { orderRef: orderRef })
        .then((data) => {
          if (data.hintCode === "userSign") {
            dispatch({ type: ActionType.UpdateLoginStatus, status: Status.UserSign });
          } else if (data.status === "complete") {
            dispatch({
              type: ActionType.UpdateUserData,
              data: data.completionData.user,
              token: data.token,
            });
          }
        })
        .catch((error) => dispatch({ type: ActionType.Error, error, errorMessage: "Error when calling collect" }));
    }, 2000);
  }, [baseUrl, orderRef]);

  const startGeneratingQrCodes = useCallback(() => {
    return setInterval(() => {
      fetchData(`${baseUrl}/qr`, undefined, { orderRef: orderRef })
        .then((data) => dispatch({ type: ActionType.UpdateQr, qr: data.qr }))
        .catch((error) => dispatch({ type: ActionType.Error, error, errorMessage: "Error when calling qr" }));
    }, 1000);
  }, [baseUrl, orderRef]);

  const cancelLogin = useCallback(() => {
    fetchData(`${baseUrl}/cancel`, { method: "POST" }, { orderRef: orderRef })
      .then(() => dispatch({ type: ActionType.UpdateLoginStatus, status: Status.Cancelled }))
      .catch((error) => dispatch({ type: ActionType.Error, error, errorMessage: "Error when calling cancel" }));
  }, [baseUrl, orderRef]);

  useEffect(() => {
    switch (status) {
      case Status.Starting:
        callAuthenticate();
        break;
      case Status.Continuing:
        dispatch({
          type: ActionType.UpdateIntervalIds,
          collectInterval: startCollecting(),
        });
        break;
      case Status.Started: {
        dispatch({
          type: ActionType.UpdateIntervalIds,
          collectInterval: startCollecting(),
          qrInterval: startGeneratingQrCodes(),
        });
        break;
      }
      case Status.UserSign:
        clearInterval(qrInterval);
        break;
      case Status.Cancelling:
        cancelLogin();
        break;
      case Status.Complete:
      case Status.Failed:
      case Status.Cancelled:
        clearInterval(collectInterval);
        clearInterval(qrInterval);
        break;
    }
  }, [
    baseUrl,
    callAuthenticate,
    startCollecting,
    startGeneratingQrCodes,
    cancelLogin,
    status,
    collectInterval,
    qrInterval,
  ]);

  const canStart = [Status.None, Status.Failed, Status.Cancelled].includes(status);
  const start = useCallback(
    (initialOrderRef: string = "") => {
      if (!canStart) return false;

      if (initialOrderRef) {
        dispatch({ type: ActionType.ContinueLogin, orderRef: initialOrderRef });
      } else {
        dispatch({ type: ActionType.StartLogin });
      }
      return true;
    },
    [canStart],
  );

  const canCancel = [Status.Starting, Status.Started, Status.Polling, Status.UserSign].includes(status);
  const cancel = useCallback(() => {
    if (!canCancel) return false;

    dispatch({ type: ActionType.CancelLogin });
    return true;
  }, [canCancel]);

  const reset = useCallback(() => {
    dispatch({ type: ActionType.Reset });
  }, []);

  const data = useMemo(() => ({ orderRef, qr, autoStartToken, userData }), [orderRef, qr, autoStartToken, userData]);

  return {
    data,
    start,
    cancel,
    reset,
    loginStatus: status,
    errorMessage: errorMessage,
  };
}
