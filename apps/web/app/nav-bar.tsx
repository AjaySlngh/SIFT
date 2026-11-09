"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActor } from "./actor-context";

const LINKS = [
  { href: "/", label: "Cases" },
  { href: "/worklist", label: "Worklist" },
  { href: "/ledger", label: "Ledger" },
];

export function NavBar() {
  const { actorId, setActorId, users, loading } = useActor();
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-3 backdrop-blur"
      style={{ borderColor: "var(--border)", backgroundColor: "rgba(10, 10, 11, 0.85)" }}
    >
      <nav className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-sm text-xs font-bold text-white"
            style={{ backgroundColor: "var(--accent)" }}
          >
            S
          </span>
          <span className="font-mono text-sm font-semibold tracking-widest uppercase">sift</span>
        </Link>
        <div className="flex items-center gap-5">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className="font-mono text-xs tracking-widest uppercase transition"
                style={{ color: active ? "var(--foreground)" : "var(--muted)" }}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="flex items-center gap-2">
        <label htmlFor="actor" className="label-eyebrow">
          Acting as
        </label>
        <select
          id="actor"
          className="input py-1 font-mono text-xs"
          value={actorId ?? ""}
          disabled={loading || users.length === 0}
          onChange={(e) => setActorId(e.target.value)}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.role})
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
