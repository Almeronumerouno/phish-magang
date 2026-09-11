import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: "green" | "red" | "gray";
  icon?: ReactNode;
}

export function StatCard({ label, value, trend, trendColor = "gray" }: StatCardProps) {
  const trendColorMap = {
    green: "text-green-600 bg-green-50",
    red: "text-red-600 bg-red-50",
    gray: "text-gray-600 bg-gray-100",
  };

  return (
    <div className="bg-card rounded-lg border border-border p-4 sm:p-5 flex-1 min-w-0 shadow-xs">
      <p className="text-[11px] sm:text-xs text-muted font-medium uppercase tracking-wider mb-1 truncate">
        {label}
      </p>
      <div className="flex items-baseline justify-between sm:justify-start gap-2 flex-wrap">
        <span className="text-xl sm:text-2xl font-bold text-foreground">{value}</span>
        {trend && (
          <span
            className={`text-[11px] sm:text-xs font-medium px-1.5 py-0.5 rounded ${trendColorMap[trendColor]} shrink-0`}
          >
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
