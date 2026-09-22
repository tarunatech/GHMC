import { cn } from "@/lib/utils";

type StatusType = "paid" | "pending" | "partial" | "cancelled";

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  paid: {
    label: "Paid",
    className: "status-paid",
  },
  pending: {
    label: "Pending",
    className: "status-pending",
  },
  partial: {
    label: "Partial",
    className: "status-partial",
  },
  cancelled: {
    label: "Cancelled",
    className: "status-cancelled",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedKey = (status || "").toLowerCase();
  const config = statusConfig[normalizedKey] || {
    label: status || "Unknown",
    className: "bg-muted text-muted-foreground",
  };

  return (
    <span className={cn("status-badge", config.className, className)}>
      {config.label}
    </span>
  );
}
