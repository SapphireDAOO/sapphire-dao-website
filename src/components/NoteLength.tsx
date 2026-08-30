import { MAX_NOTE_LENGTH } from "@/constants";
import { cn } from "@/lib/utils";

/**
 * Character count for a note composer. The textarea stops accepting input at
 * the limit, so without this the field just goes dead with nothing to explain
 * why.
 */
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
