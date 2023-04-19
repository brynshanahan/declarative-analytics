import { useState } from "react";
import { track, tracker } from "../tracker";
import { FieldError } from "./FieldError";

export const defaultInputTracking = [
  track("change", "> input"),
  track("mount"),
  track("click", "> input"),
  track("unmount"),
];

export function Input({ tracking = defaultInputTracking }) {
  const [value, setValue] = useState("");

  const [hasError, setError] = useState(false);
  const inputTracking = tracker({
    package: "@gel/input|1.0.0",
    component: "Input",
    track: tracking,
    params: {
      value,
    },
  });
  return (
    <label {...inputTracking}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => {
          setError(!e.target.value);
        }}
      />
      {hasError && <FieldError>Error</FieldError>}
    </label>
  );
}
