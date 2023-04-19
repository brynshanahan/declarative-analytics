import { Input } from "./components/Input";
import { LogEvents } from "./components/LogEvents";
import { params, tracker, track } from "./tracker/tracker";

const appParams = params({
  user: {
    id: 1,
  },
});

export default function App() {
  const transactionTracking = tracker({
    params: {
      transaction_name: "My Transaction",
    },
    track: [track("submit", null, "myApplicationSubmitEvent")],
  });

  return (
    <div {...appParams}>
      <form
        {...transactionTracking}
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Input />
        <Button>Submit</Button>
      </form>
      <LogEvents />
      <div tabIndex={0} />
    </div>
  );
}

function Button({ children }: any) {
  return <button type="submit">{children}</button>;
}
