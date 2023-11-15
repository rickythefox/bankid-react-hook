import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import handlers from "./mocks/mockApi.ts";
import { setupWorker } from "msw/browser";

setupWorker(...handlers).start().then(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(
        <React.StrictMode>
            <App/>
        </React.StrictMode>,
    );
});

