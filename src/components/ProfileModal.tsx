import * as React from "react";
import { useState, useEffect } from "react";
import { db, type UserProfile } from "../utils/dbStorage";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export default function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      const all = await db.users.toArray();
      if (!mounted) return;
      if (all && all.length) {
        setProfile(all[0]);
        setFullName(all[0].fullName || "");
        setRole(all[0].role || "");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [open]);

  async function save() {
    const id = profile?.userId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rec: UserProfile = {
      userId: id,
      fullName: fullName || "",
      role: role || "",
      preferredRegister: { tone: "neutral", preserveFacts: true },
      createdAt: Date.now(),
    } as any;
    try {
      await db.users.put(rec);
    } catch (err) {
      console.error(err);
    }
    onClose();
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-lg rounded bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Profil utilisateur</h3>
        <div className="grid gap-3">
          <label className="text-sm">Nom complet</label>
          <Input value={fullName} onChange={(e) => setFullName((e.target as HTMLInputElement).value)} />
          <label className="text-sm">Rôle / Institution</label>
          <Input value={role} onChange={(e) => setRole((e.target as HTMLInputElement).value)} />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={save}>Enregistrer</Button>
        </div>
      </div>
    </div>
  );
}
