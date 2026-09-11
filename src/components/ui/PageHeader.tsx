import { ReactNode } from "react";
import { Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-tight sm:leading-[44px] tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-body">{description}</p>
      </div>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-btn-primary text-btn-primary-text text-xs font-medium rounded-md shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:bg-gray-800 transition-colors w-full sm:w-auto cursor-pointer shrink-0"
        >
          {actionIcon || <Plus size={12} strokeWidth={2.5} />}
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
}
