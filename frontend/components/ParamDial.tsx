import React from "react";

interface Option<T> {
  label: string;
  value: T;
}

interface ParamDialProps<T> {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
}

export default function ParamDial<T>({
  label,
  options,
  value,
  onChange,
}: ParamDialProps<T>) {
  return (
    <div className="flex flex-col gap-1.5 font-mono text-xs">
      <span className="text-silver uppercase tracking-widest">{label}</span>
      <div className="flex border border-slate bg-void p-0.5 overflow-x-auto scrollbar-none max-w-full">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => onChange(option.value)}
              className={`px-3.5 py-1.5 text-center transition-colors cursor-pointer select-none font-semibold uppercase relative focus-visible:z-10 shrink-0 ${
                isActive
                  ? "bg-ink text-void"
                  : "bg-transparent text-silver hover:text-ink"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
