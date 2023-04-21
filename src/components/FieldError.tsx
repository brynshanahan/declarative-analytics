import { trigger, triggers } from "../tracker";

export function FieldError({
  children,
  inputId,
}: {
  children: any;
  inputId: string;
}) {
  const errorTriggers = triggers([
    trigger("mount", "error", "#" + inputId),
    trigger("unmount", "resolved"),
  ]);
  return (
    <span {...errorTriggers}>
      <span>{children}</span>
    </span>
  );
}
