import { useId, useState } from "react";
import { track, tracker } from "../tracker";
import { FieldError } from "./FieldError";

export const defaultInputTracking = [
  track("change", "> input"),
  track("mount"),
  track("click", "> input"),
  track("unmount"),
];

export function Input({
  tracking = defaultInputTracking,
  id,
  doNotTrack = false,
}: any) {
  const [value, setValue] = useState("");
  const [hasError, setError] = useState(false);

  const inputTracking = tracker({
    package: "@gel/input|1.0.0",
    component: "Input",
    track: tracking,
    enabled: !doNotTrack,
    params: {
      value: "$currentTarget.value",
    },
  });

  const reactId = useId();
  const elemId = id || reactId;

  return (
    <label {...inputTracking}>
      <input
        value={value}
        id={elemId}
        onChange={(e) => setValue(e.target.value)}
        onBlur={(e) => {
          setError(!e.target.value);
        }}
      />
      {hasError && <FieldError inputId={elemId}>Error</FieldError>}
    </label>
  );
}
