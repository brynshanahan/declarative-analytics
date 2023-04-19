import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { mountTracking } from "./tracker/trackerInterpreter";
import { getUserPreferencesEnabled } from "./tracker/DomTracker.ts";
import { dataLayer, onDataLayerPushListeners } from "./dataLayer.tsx";

const root = document.getElementById("root") as HTMLElement;

if (getUserPreferencesEnabled()) {
  import("./tracker/DomTracker.ts").then((module) => {
    mountTracking(root, module, (eventName, ctx) => {
      dataLayer.push({
        event: eventName,
        ...ctx,
      });

      for (const listener of onDataLayerPushListeners) {
        listener();
      }
    });
  });
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
