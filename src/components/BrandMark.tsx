import { cn } from "@/lib/utils";

const BrandMark = ({ className }: { className?: string }) => (
  <span
    className={cn("grid size-8 shrink-0 place-items-center bg-primary", className)}
    aria-hidden="true"
  >
    <span className="grid size-6 grid-cols-3 grid-rows-3 bg-primary-foreground">
      <span className="col-start-1 row-start-2 bg-primary" />
      <span className="col-start-3 row-start-2 bg-primary" />
      <span className="col-start-2 row-start-3 bg-primary" />
    </span>
  </span>
);

export default BrandMark;
