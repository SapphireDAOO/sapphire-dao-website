import { MAX_NOTE_LENGTH } from "@/constants";
import { cn } from "@/lib/utils";

export const NoteLength = ({ value }: { value: string }) => (
  <p
    className={cn(
      "text-right text-[11px] tabular-nums",
      value.length >= MAX_NOTE_LENGTH ? "text-amber-600" : "text-gray-500",
    )}
  >
    {value.length}/{MAX_NOTE_LENGTH}
  </p>
);
