"use client";

import Link from "next/link";
import { useActor } from "./actor-context";

export function NavBar() {
  const { actorId, setActorId, users, loading } = useActor();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3 text-sm">
      <nav className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          sift
        </Link>
        <Link href="/worklist" className="text-gray-600 hover:text-black">
          Worklist
        </Link>
        <Link href="/ledger" className="text-gray-600 hover:text-black">
          Ledger
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <label htmlFor="actor" className="text-gray-500">
          Acting as
        </label>
        <select
          id="actor"
          className="rounded border border-gray-300 px-2 py-1"
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
