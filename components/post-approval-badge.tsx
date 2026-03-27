import { Badge } from "./ui/badge";

interface PostApprovalBadgeProps {
  status: "pending" | "approved" | "rejected";
  showLabel?: boolean;
}

export function PostApprovalBadge({ status, showLabel = true }: PostApprovalBadgeProps) {
  const variants: Record<string, { color: string; label: string }> = {
    pending: { color: "bg-yellow-100 text-yellow-800", label: "Pending Review" },
    approved: { color: "bg-green-100 text-green-800", label: "Approved" },
    rejected: { color: "bg-red-100 text-red-800", label: "Rejected" },
  };

  const variant = variants[status] || variants.pending;

  return (
    <Badge variant="outline" className={variant.color}>
      {showLabel ? variant.label : status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
