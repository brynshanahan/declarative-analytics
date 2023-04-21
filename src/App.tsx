import { useState } from "react";
import { Input } from "./components/Input";
import { LogEvents } from "./components/LogEvents";
import { trackerParams, tracker, track } from "./tracker";

const appParams = trackerParams({
  user: {
    id: 3,
  },
}); // the same as writing `data-tr-params="{ "user": { "id": 1 }}"

export default function App() {
  const [open, setOpen] = useState(false);

  const transactionTracking = tracker({
    params: {
      transaction_name: "My Transaction",
    },
    enabled: open,
    track: [track("submit", null, "myApplicationSubmitEvent", { test: 1 })],
  });

  if (!open) {
    return (
      <div {...appParams}>
        {open ? "Open" : "Closed"}
        <button
          type="button"
          onClick={(e) => {
            setOpen(!open);
          }}
        >
          Toggle
        </button>
      </div>
    );
  }

  return (
    <div {...appParams}>
      {open ? "Open" : "Closed"}
      {
        <form
          {...transactionTracking}
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <Input />
          <Button>Submit</Button>
        </form>
      }
      <LogEvents />
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
        }}
      >
        Toggle
      </button>
      <div tabIndex={0} />
    </div>
  );
}

function Button({ children }: any) {
  return <button type="submit">{children}</button>;
}
