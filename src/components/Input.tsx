import { useState } from "react";
import { track } from "../tracker/tracker";
import { tracker } from "../tracker/tracker";
import { FieldError } from "./FieldError";

export const defaultInputTracking = [
  track("change", "> input"),
  track("mount"),
  track("click", "> input"),
];

export function Input({ tracking = defaultInputTracking }) {
  const inputTracking = tracker({
    package: "@gel/input|1.0.0",
    component: "Input",
    track: tracking,
  });

  const [hasError, setError] = useState(false);
  return (
    <label {...inputTracking}>
      <input
        onBlur={(e) => {
          setError(!e.target.value);
        }}
      />
      {hasError && <FieldError>Error</FieldError>}
    </label>
  );
}
