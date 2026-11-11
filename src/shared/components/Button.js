"use client";

import { cn } from "@/shared/utils/cn";
import { CONTROL_HEIGHTS, CONTROL_ICON_SIZES } from "./formStyles";

const variants = {
  primary: "bg-brand-500 hover:bg-brand-600 text-white shadow-sm disabled:bg-surface-3 disabled:text-text-muted",
  secondary: "bg-surface-2 hover:bg-surface-3 text-text-main border border-border disabled:opacity-50",
  outline: "border border-border text-text-main hover:bg-surface-2 hover:border-brand-500/40",
  ghost: "text-text-muted hover:bg-surface-2 hover:text-text-main",
  danger: "bg-red-500 hover:bg-red-600 text-white shadow-sm disabled:bg-surface-3 disabled:text-text-muted",
  success: "bg-green-600 hover:bg-green-700 text-white shadow-sm disabled:bg-surface-3 disabled:text-text-muted",
};

// Heights match Input/Select of the same size (see formStyles)
const sizes = {
  xs: `${CONTROL_HEIGHTS.xs} px-2.5 text-[11px] rounded-[6px] gap-1.5`,
  sm: `${CONTROL_HEIGHTS.sm} px-3 text-xs rounded-lg`,
  md: `${CONTROL_HEIGHTS.md} px-4 text-sm rounded-[10px]`,
  lg: `${CONTROL_HEIGHTS.lg} px-6 text-sm rounded-[10px]`,
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  disabled = false,
  loading = false,
  fullWidth = false,
  className,
  ...props
}) {
  const iconSize = CONTROL_ICON_SIZES[size] || CONTROL_ICON_SIZES.md;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 ease-out cursor-pointer",
        "active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className={cn("material-symbols-outlined animate-spin", iconSize)}>progress_activity</span>
      ) : icon ? (
        <span className={cn("material-symbols-outlined", iconSize)}>{icon}</span>
      ) : null}
      {children}
      {iconRight && !loading && (
        <span className={cn("material-symbols-outlined", iconSize)}>{iconRight}</span>
      )}
    </button>
  );
}
