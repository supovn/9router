"use client";

import { useId } from "react";
import { cn } from "@/shared/utils/cn";
import FormField from "./FormField";
import {
  FIELD_BASE,
  FIELD_ERROR,
  FIELD_ICON_SIZES,
  FIELD_SIZES,
  FIELD_VARIANTS,
  defaultFieldVariant,
} from "./formStyles";

export default function Input({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error,
  hint,
  icon,
  disabled = false,
  required = false,
  size = "md",
  variant,
  id,
  className,
  inputClassName,
  ...props
}) {
  const autoId = useId();
  const inputId = id || (label ? `input-${autoId}` : undefined);
  const iconSize = FIELD_ICON_SIZES[size] || FIELD_ICON_SIZES.md;

  return (
    <FormField label={label} htmlFor={inputId} required={required} error={error} hint={hint} className={className}>
      <div className="relative">
        {icon && (
          <div
            className={cn(
              "absolute inset-y-0 left-0 flex items-center justify-center pointer-events-none text-text-muted",
              iconSize.box
            )}
          >
            <span className={cn("material-symbols-outlined", iconSize.icon)}>{icon}</span>
          </div>
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          className={cn(
            FIELD_BASE,
            FIELD_SIZES[size] || FIELD_SIZES.md,
            FIELD_VARIANTS[variant || defaultFieldVariant(size)],
            icon && iconSize.padStart,
            error && FIELD_ERROR,
            inputClassName
          )}
          {...props}
        />
      </div>
    </FormField>
  );
}
