"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/shared/utils/cn";
import FormField from "./FormField";
import {
  CONTROL_ICON_SIZES,
  FIELD_ERROR,
  FIELD_ICON_SIZES,
  FIELD_SIZES,
  FIELD_VARIANTS,
  defaultFieldVariant,
} from "./formStyles";

const OPTION_SIZES = {
  sm: "py-1.5 pl-2.5 pr-8 text-xs",
  md: "py-2 pl-3 pr-9 text-sm",
  lg: "py-2.5 pl-3.5 pr-10 text-sm",
};

const LIST_MAX_HEIGHT = 288;
const LIST_GAP = 4;
const TYPEAHEAD_RESET_MS = 500;

const sameValue = (a, b) => a !== undefined && a !== null && String(a) === String(b);

const optionText = (opt) =>
  opt.textValue ?? (typeof opt.label === "string" || typeof opt.label === "number" ? String(opt.label) : String(opt.value));

// icon: Material Symbols name (string) or any node (e.g. <ProviderIcon/>)
function OptionIcon({ icon, size }) {
  if (!icon) return null;
  if (typeof icon !== "string") return <span className="flex shrink-0 items-center">{icon}</span>;
  return (
    <span
      className={cn("material-symbols-outlined shrink-0 text-text-muted", CONTROL_ICON_SIZES[size] || CONTROL_ICON_SIZES.md)}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

/**
 * Listbox-style dropdown (Tailwind UI pattern). Focus stays on the trigger
 * (select-only combobox); the option list renders in a portal so it is never
 * clipped by overflow-hidden cards or modals.
 *
 * options: [{ value, label, disabled?, icon?, textValue? }] — textValue is used
 * for typeahead when label is a node.
 * size: "sm" | "md" | "lg" (see formStyles); variant: "filled" | "outline"
 * onChange receives a native-like event ({ target: { value, name } }, value
 * stringified like a native <select>); onValueChange receives the raw value.
 * triggerLabelClassName / listClassName style the trigger text and the popover
 * (e.g. hide the text on small screens, widen the list).
 */
export default function Select({
  label,
  options = [],
  value,
  onChange,
  onValueChange,
  placeholder = "Select an option",
  error,
  hint,
  disabled = false,
  required = false,
  size = "md",
  variant,
  name,
  id,
  className,
  selectClassName,
  triggerLabelClassName,
  listClassName,
  "aria-label": ariaLabel,
  title,
}) {
  const iconSize = FIELD_ICON_SIZES[size] || FIELD_ICON_SIZES.md;
  const autoId = useId();
  const triggerId = id || `select-${autoId}`;
  const listId = `${triggerId}-listbox`;
  const optionId = (index) => `${triggerId}-opt-${index}`;

  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const typeahead = useRef({ text: "", timer: null });

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState(null);

  const selectedIndex = options.findIndex((opt) => sameValue(opt.value, value));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const enabledIndex = useCallback(
    (from, step) => {
      for (let i = from; i >= 0 && i < options.length; i += step) {
        if (!options[i].disabled) return i;
      }
      return -1;
    },
    [options]
  );

  const openList = useCallback(
    (preferIndex) => {
      if (disabled) return;
      const start = preferIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
      setActiveIndex(options[start]?.disabled ? enabledIndex(start, 1) : start);
      setOpen(true);
    },
    [disabled, selectedIndex, options, enabledIndex]
  );

  const closeList = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (index) => {
      const opt = options[index];
      if (!opt || opt.disabled) return;
      closeList();
      triggerRef.current?.focus();
      if (sameValue(opt.value, value)) return;
      onChange?.({ target: { value: String(opt.value), name }, currentTarget: { value: String(opt.value), name } });
      onValueChange?.(opt.value);
    },
    [options, value, name, onChange, onValueChange, closeList]
  );

  // Position the portal list under (or above) the trigger
  const updatePosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const spaceBelow = window.innerHeight - rect.bottom - LIST_GAP;
    const spaceAbove = rect.top - LIST_GAP;
    const listHeight = Math.min(listRef.current?.scrollHeight || LIST_MAX_HEIGHT, LIST_MAX_HEIGHT);
    const placeAbove = spaceBelow < listHeight && spaceAbove > spaceBelow;
    setPosition({
      left: rect.left,
      minWidth: rect.width,
      maxWidth: Math.max(rect.width, window.innerWidth - rect.left - 8),
      maxHeight: Math.max(120, Math.min(LIST_MAX_HEIGHT, (placeAbove ? spaceAbove : spaceBelow) - 8)),
      ...(placeAbove
        ? { bottom: window.innerHeight - rect.top + LIST_GAP }
        : { top: rect.bottom + LIST_GAP }),
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  // Close on outside pointer down
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (triggerRef.current?.contains(e.target) || listRef.current?.contains(e.target)) return;
      closeList();
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, closeList]);

  // Keep the active option visible while navigating
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(optionId(activeIndex))?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeIndex]);

  useEffect(() => () => clearTimeout(typeahead.current.timer), []);

  const findByTypeahead = (char) => {
    const state = typeahead.current;
    clearTimeout(state.timer);
    state.text += char.toLowerCase();
    state.timer = setTimeout(() => { state.text = ""; }, TYPEAHEAD_RESET_MS);
    const from = open ? activeIndex : selectedIndex;
    const order = options.map((_, i) => (from + 1 + i) % options.length);
    // Repeating the same key cycles through matches
    const query = /^(.)\1*$/.test(state.text) ? state.text[0] : state.text;
    return order.find((i) => {
      const opt = options[i];
      return !opt.disabled && optionText(opt).toLowerCase().startsWith(query);
    });
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    const { key } = e;

    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(key)) {
        e.preventDefault();
        openList(key === "ArrowUp" && selectedIndex < 0 ? enabledIndex(options.length - 1, -1) : undefined);
      } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const match = findByTypeahead(key);
        if (match !== undefined) commit(match);
      }
      return;
    }

    switch (key) {
      case "ArrowDown": {
        e.preventDefault();
        const next = enabledIndex(activeIndex + 1, 1);
        if (next >= 0) setActiveIndex(next);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = enabledIndex(activeIndex - 1, -1);
        if (prev >= 0) setActiveIndex(prev);
        break;
      }
      case "Home":
      case "PageUp":
        e.preventDefault();
        setActiveIndex(enabledIndex(0, 1));
        break;
      case "End":
      case "PageDown":
        e.preventDefault();
        setActiveIndex(enabledIndex(options.length - 1, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (activeIndex >= 0) commit(activeIndex);
        else closeList();
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation(); // don't close an enclosing Modal/Drawer
        closeList();
        break;
      case "Tab":
        closeList();
        break;
      default:
        if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const match = findByTypeahead(key);
          if (match !== undefined) setActiveIndex(match);
        }
    }
  };

  const list =
    open && typeof document !== "undefined"
      ? createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={label ? `${triggerId}-label` : undefined}
            aria-label={label ? undefined : ariaLabel || title}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()} // keep focus on the trigger
            className={cn(
              "fixed z-60 overflow-auto py-1 rounded-lg",
              "bg-surface border border-border shadow-lg ring-1 ring-black/5",
              "focus:outline-none",
              !position && "invisible",
              listClassName
            )}
            style={position || undefined}
          >
            {options.length === 0 && (
              <li className={cn("text-text-muted", OPTION_SIZES[size] || OPTION_SIZES.md)}>No options</li>
            )}
            {options.map((opt, index) => {
              const isSelected = index === selectedIndex;
              const isActive = index === activeIndex;
              return (
                <li
                  key={`${opt.value}-${index}`}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={opt.disabled || undefined}
                  onMouseMove={() => !opt.disabled && index !== activeIndex && setActiveIndex(index)}
                  onClick={() => commit(index)}
                  className={cn(
                    "relative flex items-center gap-2 select-none whitespace-nowrap",
                    OPTION_SIZES[size] || OPTION_SIZES.md,
                    opt.disabled
                      ? "cursor-not-allowed text-text-muted opacity-50"
                      : "cursor-pointer text-text-main",
                    isActive && !opt.disabled && "bg-brand-500/10 text-brand-600 dark:text-brand-400",
                    isSelected && "font-semibold"
                  )}
                >
                  <OptionIcon icon={opt.icon} size={size} />
                  <span className="truncate">{opt.label ?? opt.value}</span>
                  {isSelected && (
                    <span
                      className={cn(
                        "absolute inset-y-0 flex items-center text-brand-500",
                        size === "sm" ? "right-2" : "right-3"
                      )}
                      aria-hidden="true"
                    >
                      <span className={cn("material-symbols-outlined", CONTROL_ICON_SIZES[size] || CONTROL_ICON_SIZES.md)}>
                        check
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>,
          document.body
        )
      : null;

  return (
    <FormField
      label={label}
      htmlFor={triggerId}
      labelId={`${triggerId}-label`}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      <div className="relative">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          aria-label={label ? undefined : ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          title={title}
          disabled={disabled}
          onClick={() => (open ? closeList() : openList())}
          onKeyDown={handleKeyDown}
          className={cn(
            "relative w-full flex items-center gap-2 text-left text-text-main cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500/40",
            "transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
            FIELD_SIZES[size] || FIELD_SIZES.md,
            iconSize.padEnd,
            FIELD_VARIANTS[variant || defaultFieldVariant(size)],
            open && "ring-2 ring-brand-500/30 border-brand-500/40",
            error && FIELD_ERROR,
            selectClassName
          )}
        >
          {selected && <OptionIcon icon={selected.icon} size={size} />}
          <span className={cn("min-w-0 truncate", !selected && "text-text-muted", triggerLabelClassName)}>
            {selected ? selected.label ?? selected.value : placeholder}
          </span>
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 flex items-center justify-center text-text-muted",
              iconSize.box
            )}
            aria-hidden="true"
          >
            <span
              className={cn(
                "material-symbols-outlined transition-transform duration-150",
                iconSize.icon,
                open && "rotate-180"
              )}
            >
              expand_more
            </span>
          </span>
        </button>
        {name && <input type="hidden" name={name} value={value ?? ""} />}
      </div>
      {list}
    </FormField>
  );
}
