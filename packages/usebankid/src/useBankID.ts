import { ActionType, reducer } from "./reducer";
import { Status } from "./types";
import { useCallback, useEffect, useReducer } from "react";

async function fetchData(url: string, options?: RequestInit, searchParams?: Record<string, any>) {
  const res = await fetch(searchParams ? `${url}?${new URLSearchParams(searchParams).toString()}` : url, {
    ...options,
  });
  return res.json();
}

export function useBankID(baseUrl: string) {
  baseUrl = baseUrl.replace(/\/$/, "");
  const [state, dispatch] = useReducer(reducer, { status: Status.None });

  const callAuthenticate = useCallback(() => {
    fetchData(`${baseUrl}/authenticate`, { method: "POST" })
      .then((data) => dispatch({ type: ActionType.UpdateAuthenticationData, ...data }))
      .catch((error) => dispatch({ type: ActionType.Error, error, errorMessage: "Error when calling authenticate" }));
  }, [baseUrl]);

  const startCollecting = useCallback(() => {
    return setInterval(() => {
      fetchData(`${baseUrl}/collect`, undefined, { orderRef: state.orderRef })
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
  }, [baseUrl, state.orderRef]);

  const startGeneratingQrCodes = useCallback(() => {
    return setInterval(() => {
      fetchData(`${baseUrl}/qr`, undefined, { orderRef: state.orderRef })
        .then((data) => dispatch({ type: ActionType.UpdateQr, qr: data.qr }))
        .catch((error) => dispatch({ type: ActionType.Error, error, errorMessage: "Error when calling qr" }));
    }, 1000);
  }, [baseUrl, state.orderRef]);

  const cancelLogin = useCallback(() => {
    fetchData(`${baseUrl}/cancel`, { method: "POST" }, { orderRef: state.orderRef })
      .then(() => dispatch({ type: ActionType.UpdateLoginStatus, status: Status.Cancelled }))
      .catch((error) => dispatch({ type: ActionType.Error, error, errorMessage: "Error when calling cancel" }));
  }, [baseUrl, state.orderRef]);

  useEffect(() => {
    switch (state.status) {
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
        clearInterval(state.qrInterval);
        break;
      case Status.Cancelling:
        cancelLogin();
        break;
      case Status.Complete:
      case Status.Failed:
      case Status.Cancelled:
        clearInterval(state.collectInterval);
        clearInterval(state.qrInterval);
        break;
    }
  }, [baseUrl, callAuthenticate, cancelLogin, startCollecting, startGeneratingQrCodes, state]);

  const start = (initialOrderRef: string = "") => {
    const canStart = [Status.None, Status.Complete, Status.Failed, Status.Cancelled].includes(state.status);
    if (!canStart) return false;

    if (initialOrderRef) {
      dispatch({ type: ActionType.ContinueLogin, orderRef: initialOrderRef });
    } else {
      dispatch({ type: ActionType.StartLogin });
    }
    return true;
  };

  const cancel = () => {
    const canCancel = [Status.Starting, Status.Started, Status.Polling, Status.UserSign].includes(state.status);
    if (!canCancel) return false;

    dispatch({ type: ActionType.CancelLogin });
    return true;
  };

  const { orderRef, qr, autoStartToken, userData } = state;
  return {
    data: { orderRef, qr, autoStartToken, userData },
    start,
    cancel,
    loginStatus: state.status,
    errorMessage: state.errorMessage,
  };
}
