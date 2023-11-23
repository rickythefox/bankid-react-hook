import { Fetcher, LoginStatus } from "./types";
import { useEffect, useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

function createFetcher(config: RequestInit) {
  return async (url: string) => {
    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const errorMessage = await response.text();
        return Promise.reject(new Error(errorMessage));
      }
      return await response.json();
    } catch (error) {
      return Promise.reject(error);
    }
  };
}

const defaultGetFetcher = createFetcher({ method: "GET" });
const defaultPostFetcher = createFetcher({ method: "POST" });

export function useBankID(
  baseUrl: string,
  getFetcher: Fetcher = defaultGetFetcher,
  postFetcher: Fetcher = defaultPostFetcher,
) {
  baseUrl = baseUrl.replace(/\/$/, "");

  const [orderRef, setOrderRef] = useState<string>("");
  const [autoStartToken, setAutoStartToken] = useState<string>("");
  const [loginStatus, setLoginStatus] = useState<LoginStatus>(LoginStatus.None);
  const [qr, setQr] = useState<string>("");
  const [userData, setUserData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const {
    trigger: callAuthenticate,
    reset: resetAuthenticate,
    data: authenticateData,
    error: authenticateError,
  } = useSWRMutation(`${baseUrl}/authenticate`, postFetcher);
  const {
    trigger: callCancel,
    // data: cancelData,
    error: cancelError,
  } = useSWRMutation(`${baseUrl}/cancel?orderRef=${orderRef}`, postFetcher);
  const { data: collectData, error: collectError } = useSWR(
    [LoginStatus.Polling, LoginStatus.UserSign].includes(loginStatus)
      ? `${baseUrl}/collect?orderRef=${orderRef}`
      : null,
    getFetcher,
    {
      dedupingInterval: 0,
      refreshInterval: 2000,
    },
  );
  const { data: qrData, error: qrError } = useSWR(
    loginStatus === LoginStatus.Polling ? `${baseUrl}/qr?orderRef=${orderRef}` : null,
    getFetcher,
    {
      dedupingInterval: 0,
      refreshInterval: 1000,
    },
  );

  // If authenticateData is set, continue the login process
  useEffect(() => {
    if (!authenticateData?.orderRef || !authenticateData?.autoStartToken) return;

    setOrderRef(authenticateData.orderRef);
    setAutoStartToken(authenticateData.autoStartToken);

    const timeoutId = setTimeout(() => {
      setLoginStatus(LoginStatus.Polling);
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [authenticateData]);

  useEffect(() => {
    if (!collectData) return;

    if (collectData.status === "complete") {
      setUserData({ ...collectData.completionData.user, token: collectData.token });
      setOrderRef("");
      setLoginStatus(LoginStatus.Complete);
      resetAuthenticate();
    }

    if (collectData.hintCode === "userSign") {
      setLoginStatus(LoginStatus.UserSign);
    }
  }, [resetAuthenticate, collectData]);

  useEffect(() => {
    setQr("");
    if ([LoginStatus.Starting, LoginStatus.Polling].includes(loginStatus)) {
      setQr(qrData?.qr || authenticateData?.qr || "");
    }
  }, [authenticateData?.qr, qrData?.qr, loginStatus]);

  useEffect(() => {
    if (authenticateError) {
      setErrorMessage(`Error when calling authenticate: ${authenticateError}`);
    } else if (collectError) {
      setErrorMessage(`Error when calling collect: ${collectError}`);
    } else if (cancelError) {
      setErrorMessage(`Error when calling cancel: ${cancelError}`);
    } else if (qrError) {
      setErrorMessage(`Error when calling qr: ${qrError}`);
    } else {
      return;
    }

    setLoginStatus(LoginStatus.Failed);
    setOrderRef("");
    resetAuthenticate();
  }, [qrError, collectError, authenticateError, resetAuthenticate, cancelError]);

  const start = async (initialOrderRef: string = "") => {
    const canStart = [LoginStatus.None, LoginStatus.Complete, LoginStatus.Failed].includes(loginStatus);
    if (!canStart || orderRef) return false;

    try {
      if (initialOrderRef) {
        setOrderRef(initialOrderRef);
        setLoginStatus(LoginStatus.UserSign);
      } else {
        await callAuthenticate();
        setLoginStatus(LoginStatus.Starting);
      }
    } catch (e) {
      // Will be handled by useSWR
    }
    return true;
  };

  const cancel = async () => {
    const canCancel = [LoginStatus.Starting, LoginStatus.Polling, LoginStatus.UserSign].includes(loginStatus);
    if (!canCancel || !orderRef) return false;

    setOrderRef("");
    setQr("");
    await callCancel();
    resetAuthenticate();
    setLoginStatus(LoginStatus.None);
    return true;
  };

  return {
    data: { orderRef, qr, autoStartToken, userData },
    start,
    cancel,
    loginStatus,
    errorMessage,
  };
}
