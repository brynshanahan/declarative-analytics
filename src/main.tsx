import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { getUserPreferencesEnabled } from "./tracker/DomTracker";
import { dataLayer, onDataLayerPushListeners } from "./dataLayer";

const root = document.getElementById("root") as HTMLElement;

if (getUserPreferencesEnabled()) {
  Promise.all([
    import("./tracker/trackerInterpreter"),
    import("./tracker/DomTracker"),
  ]).then(([{ mountTracking }, domTracker]) => {
    const sendToGa = (eventName: string, ctx: {}) => {
      dataLayer.push({
        event: eventName,
        ...ctx,
      });

      for (const listener of onDataLayerPushListeners) {
        listener();
      }
    };
    mountTracking(root, domTracker, sendToGa);
  });
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
