import { useReducer } from "react";
import { onDataLayerPushListeners } from "../dataLayer";

let updater = () => {};

onDataLayerPushListeners.add(() => {
  updater();
});

export function LogEvents() {
  const [_, update] = useReducer((s) => s + 1, 0);

  updater = update;

  const logs = window["dataLayer" as any] as unknown as any[];

  return (
    <div>
      {logs.map((log, i) => {
        return (
          <pre style={{ fontSize: 11 }} key={i}>
            <code>{JSON.stringify(log)}</code>
          </pre>
        );
      })}
    </div>
  );
}
