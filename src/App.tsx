import './App.css';
import useBankID from "./hooks/useBankID.ts";

function App() {
    const {data, start, cancel} = useBankID();

    return (
        <>
            {data.qr ? <div>{data.qr}</div> : <div>Waiting for qr...</div>}
            {data.userData ? <div>{data.userData.token}</div> : <div>Waiting for user data...</div>}
            {start && <button onClick={start}>Authenticate</button>}
            {cancel && <button onClick={cancel}>Cancel</button>}
        </>
    );
}

export default App;
