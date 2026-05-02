"use client";
// @ts-nocheck

import React, { useEffect, useState } from "react";
import { Btn, FF, Input, Modal } from "@/components/ui";
import { useTheme } from "@/lib/store";

export function AdminResetDatabaseModal({
  open,
  isResetting,
  onClose,
  onConfirm,
}: {
  open: boolean;
  isResetting: boolean;
  onClose: () => void;
  onConfirm: (reseed: boolean) => void;
}) {
  const T = useTheme();
  const [resetConfirmation, setResetConfirmation] = useState("");
  const [resetReseed, setResetReseed] = useState(true);

  useEffect(() => {
    if (!open) {
      setResetConfirmation("");
      setResetReseed(true);
    }
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    if (isResetting) return;
    onClose();
  };

  const handleConfirm = () => {
    if (isResetting || resetConfirmation !== "RESET DATABASE") return;
    onConfirm(resetReseed);
  };

  return (
    <Modal title="Réinitialiser la base de test" onClose={handleClose}>
      <div style={{ padding: "4px 0 0", color: T.text, lineHeight: 1.6, fontSize: 13 }}>
        Cette action supprime les données métier de développement puis recharge, si vous le souhaitez, une démo crédible du <strong>Domaine des Trois Coteaux</strong>.
      </div>
      <div style={{ marginTop: 14, padding: 14, background: T.bg, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 12, color: T.textDim }}>
        Sont conservés : utilisateurs, rôles, authentification, sessions et référentiels système indispensables.
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontSize: 13, color: T.text, cursor: isResetting ? "not-allowed" : "pointer", opacity: isResetting ? 0.6 : 1 }}>
        <input
          type="checkbox"
          checked={resetReseed}
          disabled={isResetting}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetReseed(e.target.checked)}
          style={{ accentColor: T.accent }}
        />
        Recharger des données de démo crédibles
      </label>
      <FF label="Tapez RESET DATABASE pour confirmer">
        <Input
          value={resetConfirmation}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetConfirmation(e.target.value)}
          disabled={isResetting}
          placeholder="RESET DATABASE"
        />
      </FF>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
        <Btn variant="secondary" onClick={handleClose} disabled={isResetting}>Annuler</Btn>
        <Btn onClick={handleConfirm} disabled={isResetting || resetConfirmation !== "RESET DATABASE"} style={{ background: T.red, color: "#fff", borderColor: T.red }}>
          {isResetting ? "Réinitialisation..." : "Réinitialiser"}
        </Btn>
      </div>
    </Modal>
  );
}
