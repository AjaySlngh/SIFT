"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export interface SiftUser {
  id: string;
  name: string;
  kind: string;
  role: string;
}

interface ActorContextValue {
  actorId: string | null;
  setActorId: (id: string) => void;
  users: SiftUser[];
  loading: boolean;
}

const ActorContext = createContext<ActorContextValue | null>(null);

const STORAGE_KEY = "sift.actorId";

export function ActorProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<SiftUser[]>([]);
  const [actorId, setActorIdState] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data: SiftUser[]) => {
        setUsers(data);
        setActorIdState((current) => {
          if (current && data.some((u) => u.id === current)) return current;
          const firstHuman = data.find((u) => u.kind === "human");
          return firstHuman?.id ?? data[0]?.id ?? null;
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function setActorId(id: string) {
    setActorIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <ActorContext.Provider value={{ actorId, setActorId, users, loading }}>{children}</ActorContext.Provider>
  );
}

export function useActor(): ActorContextValue {
  const ctx = useContext(ActorContext);
  if (!ctx) throw new Error("useActor must be used within an ActorProvider");
  return ctx;
}
