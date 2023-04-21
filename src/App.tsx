import { useState } from "react";
import { Input } from "./components/Input";
import { LogEvents } from "./components/LogEvents";
import { trackerParams, tracker, track } from "./tracker";

const appParams = trackerParams({
  user: {
    id: 1,
  },
}); // the same as writing `data-tr-params="{ "user": { "id": 1 }}"

const transactionTracking = tracker({
  params: {
    transaction_name: "My Transaction",
  },
  track: [track("submit", null, "myApplicationSubmitEvent")],
});

export default function App() {
  const [open, setOpen] = useState(false);

  return (
    <div {...appParams}>
      {open ? "Open" : "Closed"}
      {
        <form
          {...(open && transactionTracking)}
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
