"use client";

import { useId } from "react";
import { cn } from "@/shared/utils/cn";
import FormField from "./FormField";
import {
  FIELD_BASE,
  FIELD_ERROR,
  FIELD_TEXT_SIZES,
  FIELD_VARIANTS,
  defaultFieldVariant,
} from "./formStyles";

const RESIZE = { y: "resize-y", none: "resize-none", both: "resize" };

export default function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  error,
  hint,
  disabled = false,
  required = false,
  size = "md",
  variant,
  resize = "y",
  id,
  className,
  textareaClassName,
  ...props
}) {
  const autoId = useId();
  const textareaId = id || (label ? `textarea-${autoId}` : undefined);

  return (
    <FormField label={label} htmlFor={textareaId} required={required} error={error} hint={hint} className={className}>
      <textarea
        id={textareaId}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        className={cn(
          FIELD_BASE,
          "block",
          RESIZE[resize] || RESIZE.y,
          FIELD_TEXT_SIZES[size] || FIELD_TEXT_SIZES.md,
          FIELD_VARIANTS[variant || defaultFieldVariant(size)],
          error && FIELD_ERROR,
          textareaClassName
        )}
        {...props}
      />
    </FormField>
  );
}
