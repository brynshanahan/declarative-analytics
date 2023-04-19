import { trigger, triggers } from "../tracker";

const errorTracking = triggers([
  trigger("mount", "error"),
  trigger("unmount", "resolved"),
]);

export function FieldError({ children }: { children: any }) {
  return <span {...errorTracking}>{children}</span>;
}
