// Shared sizing/styling for form controls so Input, Select, Textarea, Button
// and SegmentedControl line up when placed in the same row.
//   sm = 32px (toolbars, filters, inline)   md = 36px (default)   lg = 44px

export const CONTROL_HEIGHTS = {
  xs: "h-6",
  sm: "h-8",
  md: "h-9",
  lg: "h-11",
};

// Text fields (Input, Select trigger). 16px text below `sm` avoids iOS zoom.
export const FIELD_SIZES = {
  sm: "h-8 px-2.5 text-xs rounded-lg",
  md: "h-9 px-3 text-[16px] sm:text-sm rounded-[10px]",
  lg: "h-11 px-3.5 text-[16px] sm:text-sm rounded-[10px]",
};

// Padding/text only — for multi-line fields that can't have a fixed height
export const FIELD_TEXT_SIZES = {
  sm: "px-2.5 py-1.5 text-xs rounded-lg",
  md: "px-3 py-2 text-[16px] sm:text-sm rounded-[10px]",
  lg: "px-3.5 py-2.5 text-[16px] sm:text-sm rounded-[10px]",
};

// Material Symbols size for icons inside a control of each size
export const CONTROL_ICON_SIZES = {
  xs: "text-[14px]",
  sm: "text-[16px]",
  md: "text-[18px]",
  lg: "text-[20px]",
};

// Leading/trailing icon slot per size
export const FIELD_ICON_SIZES = {
  sm: { box: "w-7", icon: CONTROL_ICON_SIZES.sm, padStart: "pl-7", padEnd: "pr-7" },
  md: { box: "w-9", icon: CONTROL_ICON_SIZES.md, padStart: "pl-9", padEnd: "pr-9" },
  lg: { box: "w-10", icon: CONTROL_ICON_SIZES.lg, padStart: "pl-10", padEnd: "pr-10" },
};

export const FIELD_VARIANTS = {
  filled: "bg-surface-2 border border-transparent",
  outline: "bg-surface border border-border",
};

export const FIELD_BASE =
  "w-full text-text-main placeholder-text-muted/70 transition-all duration-150 ease-out " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40 " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

export const FIELD_ERROR = "ring-1 ring-red-500 focus:ring-2 focus:ring-red-500/40 border-red-500/40";

// Default look: form fields are filled (like the original Input), compact ones outlined
export const defaultFieldVariant = (size) => (size === "sm" ? "outline" : "filled");
