import "./App.css";
import useBankID, { LoginStatus } from "./hooks/useBankID.ts";
import { useState } from "react";
import QRCode from "react-qr-code";

function App() {
  const [baseUrl, setBaseUrl] = useState<string>("https://foo.com/api");
  const { data, start, cancel, errorMessage, loginStatus } = useBankID(baseUrl);

  const onChangeBaseUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    const urlPattern = /https?:\/\/(\w+:?\w*)?(\S+)(:\d+)?(\/|\/([\w#!:.?+=&%\-/]))?/;
    if (!urlPattern.test(e.target.value)) {
      setBaseUrl("https://foo.com/api");
      return;
    }

    setBaseUrl(e.target.value);
  };

  return (
    <>
      <label htmlFor={"baseUrl"}>Base URL</label>
      <input type={"text"} id={"baseUrl"} name={"baseUrl"} onChange={onChangeBaseUrl} />
      {baseUrl && <div>Using base URL: {baseUrl}</div>}
      {data.qr ? (
        <div>
          <QRCode value={data.qr} />
        </div>
      ) : (
        <div>Waiting for qr...</div>
      )}
      Login status: {LoginStatus[loginStatus]}
      {data.userData?.completionData?.user ? (
        <div>{data.userData.completionData.user}</div>
      ) : (
        <div>Waiting for user data...</div>
      )}
      {start && <button onClick={start}>Authenticate</button>}
      {cancel && <button onClick={cancel}>Cancel</button>}
      {errorMessage && <div>Error: {errorMessage}</div>}
    </>
  );
}

export default App;
