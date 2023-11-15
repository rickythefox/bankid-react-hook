import { useEffect, useState } from 'react';
import useSWR from "swr";
import axios from "axios";

import useSWRMutation from "swr/mutation";

enum LoginStatus {
    None,
    Starting,
    Polling,
    UserSign,
    Complete,
    Failed
}

const getFetcher = (url: string) => axios.get(url).then((res) => res.data);
const postFetcher = (url: string) => axios.post(url).then((res) => res.data);

const useBankID = () => {
    const [orderRef, setOrderRef] = useState<string>("");
    const [loginStatus, setLoginStatus] = useState<LoginStatus>(LoginStatus.None);
    const [qr, setQr] = useState<string>("");
    const [userData, setUserData] = useState<any>(null);

    const authenticateCall = useSWRMutation(`https://foo.com/authenticate`, postFetcher);
    const cancelCall = useSWRMutation(`https://foo.com/cancel?orderRef=${orderRef}`, postFetcher);

    const {
        data: collectData,
        error
    } = useSWR([LoginStatus.Polling, LoginStatus.UserSign].includes(loginStatus) ? `https://foo.com/collect?orderRef=${orderRef}` : null, getFetcher, {
        dedupingInterval: 0,
        refreshInterval: 2000,
    });
    const {data: qrData} = useSWR(loginStatus === LoginStatus.Polling ? `https://foo.com/qr?orderRef=${orderRef}` : null, getFetcher, {
        dedupingInterval: 0,
        refreshInterval: 1000,
    });

    useEffect(() => {
        if (!authenticateCall?.data?.orderRef) return;

        setOrderRef(authenticateCall.data.orderRef);

        const timeoutId = setTimeout(() => {
            setLoginStatus(LoginStatus.Polling);
        }, 2000);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [authenticateCall?.data?.orderRef]);

    useEffect(() => {
        if (!collectData) return;

        if (collectData.status === "complete") {
            setUserData({...collectData.completionData.user, token: collectData.token});
            setOrderRef("");
            setLoginStatus(LoginStatus.Complete);
            authenticateCall.reset();
        }

        if (collectData.hintCode === "userSign") {
            setLoginStatus(LoginStatus.UserSign);
        }
    }, [authenticateCall, collectData]);

    useEffect(() => {
        setQr(qrData?.qr || "");
    }, [qrData]);

    const start = async () => {
        if (!orderRef) {
            authenticateCall.trigger();
            setLoginStatus(LoginStatus.Starting);
        }
    };

    const cancel = async () => {
        if (orderRef) {
            cancelCall.trigger();
            authenticateCall.reset();
            setOrderRef("");
            setLoginStatus(LoginStatus.None);
        }
    };

    const canStart = [LoginStatus.None, LoginStatus.Complete, LoginStatus.Failed].includes(loginStatus);
    const canCancel = [LoginStatus.Starting, LoginStatus.Polling, LoginStatus.UserSign].includes(loginStatus);
    return {data: {orderRef, qr, userData}, token: userData?.token, start: canStart ? start : null, cancel: canCancel ? cancel : null};
};

export default useBankID;
