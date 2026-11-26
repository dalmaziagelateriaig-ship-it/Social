import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { PLATFORM_LABELS, PLATFORMS, type Platform } from "@/lib/types";

type Variant = "primary" | "secondary" | "danger" | "ghost";

function buttonClass(variant: Variant, className: string) {
  const styles = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50",
    secondary: "bg-white text-stone-800 border border-stone-300 hover:bg-stone-50 disabled:opacity-50",
    danger: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
    ghost: "text-stone-600 hover:bg-stone-100",
  }[variant];
  return `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed ${styles} ${className}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: "bg-pink-100 text-pink-800",
  facebook: "bg-blue-100 text-blue-800",
  tiktok: "bg-stone-900 text-white",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PLATFORM_COLORS[platform]}`}>
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export function PlatformPicker({ value, onChange }: { value: Platform[]; onChange: (v: Platform[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PLATFORMS.map((p) => {
        const on = value.includes(p);
        return (
          <button
            type="button"
            key={p}
            onClick={() => onChange(on ? value.filter((x) => x !== p) : [...value, p])}
            className={`rounded-full border px-3 py-1.5 text-sm transition ${
              on ? "border-brand-600 bg-brand-50 text-brand-700" : "border-stone-300 bg-white text-stone-600 hover:bg-stone-50"
            }`}
          >
            {on ? "✓ " : ""}
            {PLATFORM_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</div>;
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />;
}
