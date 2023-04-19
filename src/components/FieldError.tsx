import { trigger, triggers } from "../tracker";

const errorTriggers = triggers([
  trigger("mount", "error"),
  trigger("unmount", "resolved"),
]);

export function FieldError({ children }: { children: any }) {
  return (
    <span {...errorTriggers}>
      <span>{children}</span>
    </span>
  );
}
