"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Panoramica", icon: "🏠" },
  { href: "/calendario", label: "Calendario", icon: "📅" },
  { href: "/crea", label: "Crea con AI", icon: "✨" },
  { href: "/video", label: "Video", icon: "🎬" },
  { href: "/piano", label: "Piano del mese", icon: "🗓️" },
  { href: "/orari", label: "Orari migliori", icon: "⏰" },
  { href: "/profilo", label: "La mia attività", icon: "🏪" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {LINKS.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              active ? "bg-brand-50 font-medium text-brand-700" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <span aria-hidden>{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
