import { useReducer, useState } from "react";
import { onSendEvent } from "../tracker/trackerInterpreter";

let updater = () => {};

onSendEvent(() => {
  updater();
});

export function LogEvents() {
  const [_, update] = useReducer((s) => s + 1, 0);

  updater = update;

  const logs = window["dataLayer" as any] as unknown as any[];

  return (
    <div>
      {logs.map((log, i) => {
        return <div key={i}>{JSON.stringify(log)}</div>;
      })}
    </div>
  );
}
