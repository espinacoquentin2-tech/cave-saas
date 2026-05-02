"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, FF, Input, Modal, Select } from "@/components/ui";
import { useAuth, useStore, useTheme } from "@/lib/store";
import { buildApiHeaders, unwrapApiData } from "@/lib/client-app-helpers";
import {
  ROLE_OPTIONS,
  formatRoleLabel,
  normalizeRoleKey,
  roleColorByKey,
  roleKeyToBackendRole,
  toUiUser,
} from "@/lib/roles";

export function AdminUsers() {
  const T = useTheme();
  const { state, dispatch } = useStore();
  const { user, setUser } = useAuth();

  const [modal, setModal] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [form, setForm] = useState({ name: "", email: "", roleKey: "CAVISTE" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = (k: any, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const buildUserPayload = (data: any, includeId = false) => {
    const roleKey = normalizeRoleKey(data?.roleKey ?? data?.role);
    const backendRole = roleKeyToBackendRole(roleKey);

    if (!roleKey || !backendRole) return null;

    return {
      ...(includeId && data?.id ? { id: Number(data.id) } : {}),
      name: data.name,
      email: data.email,
      role: backendRole,
    };
  };

  const handleUpsertUser = async (isEdit = false) => {
    const dataToSubmit = isEdit ? editUser : form;
    if (!dataToSubmit) return;
    if (!dataToSubmit.name || !dataToSubmit.email) return alert("Nom et Email obligatoires.");
    const payload = buildUserPayload(dataToSubmit, isEdit);
    if (!payload) return alert("Rôle utilisateur invalide.");

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/users", {
        method: isEdit ? "PUT" : "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la sauvegarde de l'utilisateur.");
      }

      const savedUser = toUiUser(unwrapApiData(data));

      if (isEdit) {
        dispatch({ type: "UPDATE_USER", payload: savedUser });
        dispatch({ type: "TOAST_ADD", payload: { msg: "Profil utilisateur mis à jour.", color: T.blue } });

        if (user && user.email === savedUser.email) {
          setUser({ ...user, name: savedUser.name, role: savedUser.role, roleLabel: savedUser.roleLabel, roleKey: savedUser.roleKey, initials: savedUser.initials });
        }
        setEditUser(null);
      } else {
        dispatch({ type: "ADD_USER", payload: savedUser });
        dispatch({ type: "TOAST_ADD", payload: { msg: "Nouvel utilisateur créé avec succès.", color: T.green } });
        setModal(false);
        setForm({ name: "", email: "", roleKey: "CAVISTE" });
      }
    } catch (error: any) {
      dispatch({ type: "TOAST_ADD", payload: { msg: error?.message ?? "Erreur inconnue", color: T.red } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: T.textStrong, margin: 0 }}>Utilisateurs & Droits d'Accès</h1>
        <Btn onClick={() => setModal(true)}>+ Ajouter utilisateur</Btn>
      </div>
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 100px", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, background: T.surfaceHigh }}>
          <div>Nom & Prénom</div><div>Adresse Email</div><div>Rôle (Droits)</div><div>Actions</div>
        </div>
        {state.users.map((u: any, i: number) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 100px", alignItems: "center", padding: "16px 16px", borderBottom: i < state.users.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <span style={{ color: T.textStrong, fontWeight: 600 }}>{u.name}</span>
            <span style={{ color: T.textDim, fontFamily: "monospace", fontSize: 12 }}>{u.email}</span>
            <div><Badge label={u.roleLabel ?? formatRoleLabel(u.roleKey ?? u.role)} color={roleColorByKey(T, u.roleKey ?? u.role)} /></div>
            <Btn variant="ghost" onClick={() => setEditUser({ ...u, roleKey: normalizeRoleKey(u.roleKey ?? u.role) ?? "CAVISTE" })}>Éditer</Btn>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Ajouter un nouvel utilisateur" onClose={() => setModal(false)}>
          <FF label="Nom complet">
            <Input value={form.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("name", e.target.value)} disabled={isSubmitting} placeholder="Ex: Jean Dupont" />
          </FF>
          <FF label="Adresse Email (Sert d'identifiant)">
            <Input type="email" value={form.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => set("email", e.target.value)} disabled={isSubmitting} placeholder="jean@domaine.fr" />
          </FF>
          <FF label="Niveau d'accès (Rôle)">
            <Select value={form.roleKey} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => set("roleKey", e.target.value)} disabled={isSubmitting}>
              {ROLE_OPTIONS.filter(({ roleKey }) => roleKey !== "ADMIN").map(({ roleKey, roleLabel }) => <option key={roleKey} value={roleKey}>{roleLabel}</option>)}
            </Select>
          </FF>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 12, fontStyle: "italic", borderLeft: `2px solid ${T.accent}`, paddingLeft: 10 }}>
            Un email contenant un lien de connexion magique sera envoyé à cet utilisateur.
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <Btn variant="secondary" onClick={() => setModal(false)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={() => handleUpsertUser(false)} disabled={isSubmitting} style={{ background: isSubmitting ? T.textDim : T.accent }}>Créer l'accès</Btn>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal title="Modifier les droits utilisateur" onClose={() => setEditUser(null)}>
          <FF label="Nom complet">
            <Input value={editUser.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditUser({ ...(editUser || {}), name: e.target.value })} disabled={isSubmitting} />
          </FF>
          <FF label="Adresse Email">
            <Input type="email" value={editUser.email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditUser({ ...(editUser || {}), email: e.target.value })} disabled={isSubmitting} />
          </FF>
          <FF label="Niveau d'accès (Rôle)">
            <Select value={normalizeRoleKey(editUser.roleKey ?? editUser.role) ?? "CAVISTE"} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEditUser({ ...(editUser || {}), roleKey: e.target.value })} disabled={isSubmitting}>
              {ROLE_OPTIONS.map(({ roleKey, roleLabel }) => <option key={roleKey} value={roleKey}>{roleLabel}</option>)}
            </Select>
          </FF>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 24 }}>
            <Btn variant="secondary" onClick={() => setEditUser(null)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={() => handleUpsertUser(true)} disabled={isSubmitting}>Sauvegarder les modifications</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
