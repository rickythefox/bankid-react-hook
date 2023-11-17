import axios from "axios";
import { useEffect, useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

enum LoginStatus {
  None,
  Starting,
  Polling,
  UserSign,
  Complete,
  Failed,
}

const getFetcher = (url: string) => axios.get(url).then((res) => res.data);
const postFetcher = (url: string) => axios.post(url).then((res) => res.data);

const useBankID = (baseUrl: string) => {
  baseUrl = baseUrl.replace(/\/$/, "");

  const [orderRef, setOrderRef] = useState<string>("");
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
    if (!authenticateData?.orderRef) return;

    setOrderRef(authenticateData.orderRef);

    const timeoutId = setTimeout(() => {
      setLoginStatus(LoginStatus.Polling);
    }, 2000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [authenticateData?.orderRef]);

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
        console.error(e);
      }
    }
  };

  const cancel = async () => {
    if (orderRef) {
      await callCancel();
      resetAuthenticate();
      setOrderRef("");
      setLoginStatus(LoginStatus.None);
    }
  };

  const canStart = [LoginStatus.None, LoginStatus.Complete, LoginStatus.Failed].includes(loginStatus);
  const canCancel = [LoginStatus.Starting, LoginStatus.Polling, LoginStatus.UserSign].includes(loginStatus);
  return {
    data: { orderRef, qr, userData },
    token: userData?.token,
    start: canStart ? start : null,
    cancel: canCancel ? cancel : null,
    errorMessage,
  };
};

export default useBankID;
