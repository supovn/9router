"use client";

import { cn } from "@/shared/utils/cn";
import { CONTROL_HEIGHTS } from "./formStyles";

export default function SegmentedControl({
  options = [],
  value,
  onChange,
  size = "md",
  className,
}) {
  // Outer height matches Input/Select/Button of the same size (see formStyles)
  const sizes = {
    sm: { track: `${CONTROL_HEIGHTS.sm} p-0.5 rounded-lg`, item: "h-7 px-3 text-xs rounded-md" },
    md: { track: `${CONTROL_HEIGHTS.md} p-1 rounded-[10px]`, item: "h-7 px-4 text-sm rounded-[8px]" },
    lg: { track: `${CONTROL_HEIGHTS.lg} p-1 rounded-[10px]`, item: "h-9 px-4 text-sm rounded-[8px]" },
  };
  const sizeStyles = sizes[size] || sizes.md;

  return (
    <div
      className={cn(
        "inline-flex items-center overflow-x-auto",
        "bg-surface-2",
        sizeStyles.track,
        className
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "shrink-0 inline-flex items-center font-medium transition-all",
            sizeStyles.item,
            value === option.value
              ? "bg-surface text-text-main shadow-sm"
              : "text-text-muted hover:text-text-main"
          )}
        >
          {option.icon && (
            <span className="material-symbols-outlined text-[16px] mr-1.5">
              {option.icon}
            </span>
          )}
          {option.label}
        </button>
      ))}
    </div>
  );
}
