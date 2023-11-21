import { defaultHandlers } from "../../../mocks/mockApi.ts";
import App from "./App.tsx";
import "./index.css";
import { setupWorker } from "msw/browser";
import React from "react";
import ReactDOM from "react-dom/client";

setupWorker(...defaultHandlers)
  .start()
  .then(() => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>,
    );
  });
