import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { mountTracking } from "./tracker/trackerInterpreter";

const root = document.getElementById("root") as HTMLElement;

const cleanup = mountTracking(root);

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
