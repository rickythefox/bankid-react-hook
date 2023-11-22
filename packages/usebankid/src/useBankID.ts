import { Fetcher, LoginStatus } from "./types";
import { useEffect, useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

export function useBankID(baseUrl: string, getFetcher: Fetcher, postFetcher: Fetcher) {
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

  useEffect(() => {
    if (!authenticateData?.orderRef || !authenticateData?.autoStartToken) return;

    setOrderRef(authenticateData.orderRef);
    setAutoStartToken(authenticateData.autoStartToken);
    setQr(authenticateData.qr);

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
    setQr(qrData?.qr || "");
  }, [qrData]);

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

  const start = async () => {
    if (!orderRef) {
      try {
        await callAuthenticate();
        setLoginStatus(LoginStatus.Starting);
      } catch (e) {
        // Will be handled by useSWR
      }
    }
  };

  const cancel = async () => {
    if (orderRef) {
      setOrderRef("");
      setQr("");
      await callCancel();
      resetAuthenticate();
      setLoginStatus(LoginStatus.None);
    }
  };

  const canStart = [LoginStatus.None, LoginStatus.Complete, LoginStatus.Failed].includes(loginStatus);
  const canCancel = [LoginStatus.Starting, LoginStatus.Polling, LoginStatus.UserSign].includes(loginStatus);
  return {
    data: { orderRef, qr, autoStartToken, userData },
    start: canStart ? start : null,
    cancel: canCancel ? cancel : null,
    loginStatus,
    errorMessage,
  };
}
