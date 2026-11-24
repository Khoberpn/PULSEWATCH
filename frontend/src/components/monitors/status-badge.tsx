import React from "react";
import { getStatusBadgeVariant, cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  enabled?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  enabled = true,
  className,
}) => {
  const { label, className: badgeClass, dotColor } = getStatusBadgeVariant(status, enabled);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-semibold border rounded-full uppercase tracking-wider select-none",
        badgeClass,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)} />
      {label}
    </span>
  );
};
