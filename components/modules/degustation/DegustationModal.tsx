"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Btn, FF, Input, Modal, Select } from "@/components/ui";
import { useAuth, useStore, useTheme } from "@/lib/store";
import { buildApiHeaders } from "@/lib/client-app-helpers";
import { supabase } from "@/lib/supabase";
import {
  BAIES_DATA_PREFIX,
  BAIES_ECRASEMENT,
  BAIES_NATURE_CITRONNEE,
  BAIES_VENDANGE,
  GUSTATIF_TAXONOMY,
  OLFACTIF_TAXONOMY,
  PHASES_DEGUSTATION,
  VISUEL_TAGS,
} from "@/components/modules/degustation/degustation.constants";

export function DegustationModal({ onClose, defaultPhase = "BAIES" }: { onClose: () => void; defaultPhase?: string }) {
  const T = useTheme();
  const { user } = useAuth();
  const { state, dispatch, refreshData } = useStore();

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    phase: defaultPhase,
    parcelle: "",
    lotId: "",
    bottleLotId: "",
    robe: "",
    noteGlobale: "",
    sucreTest: "",
    notes: ""
  });

  const [baiesForm, setBaiesForm] = useState({
    aptitudeEcrasement: "",
    sucrosite: "",
    acidite: "",
    vegetal: "",
    fruite: "",
    natureCitronnee: "",
    aromePellicule: "",
    astringencePellicule: "",
    vendange: "",
  });

  // Gestion des tags cliquables
  const [selectedNez, setSelectedNez] = useState<string[]>([]);
  const [selectedBouche, setSelectedBouche] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const toggleTag = (list: string[], setList: (next: string[]) => void, tag: string) => {
    if (list.includes(tag)) setList(list.filter((t: string) => t !== tag));
    else setList([...list, tag]);
  };

  const getTargetOptions = () => {
    if (form.phase === "BAIES") {
      const options = Array.from(
        new Set((state.maturations || []).map((m: any) => `${m.parcelle} • ${m.cepage}`).filter(Boolean))
      ) as string[];
      options.sort((a: string, b: string) => a.localeCompare(b));
      return options.map((label: string) => <option key={label} value={label}>{label}</option>);
    }
    if (["FERMENTATION", "VINS_CLAIRS", "DOSAGE", "CHAMPAGNE"].includes(form.phase)) {
      return (state.lots || []).filter((l: any) => l.volume > 0).map((l: any) => <option key={l.id} value={l.id}>{l.code} ({l.volume} hL)</option>);
    }
    return null;
  };

  const submit = async () => {
    // Validation frontend basique avant d'envoyer au backend
    if (form.phase === "BAIES" && !form.parcelle) return alert("Veuillez sélectionner une parcelle.");
    if (["FERMENTATION", "VINS_CLAIRS", "DOSAGE", "CHAMPAGNE"].includes(form.phase) && !form.lotId) return alert("Veuillez sélectionner un lot.");

    setIsSubmitting(true);
    
    try {
      const session = await supabase.auth.getSession();
      const runtimeToken = session.data.session?.access_token ?? user?.accessToken;
      const authUser = runtimeToken ? { ...user, accessToken: runtimeToken } : user;
      const headers = buildApiHeaders(authUser);
      const hasAuthorization = Boolean((headers as Record<string, string>).Authorization);

      const baiesData = form.phase === "BAIES" ? {
        aptitudeEcrasement: baiesForm.aptitudeEcrasement,
        sucrosite: baiesForm.sucrosite,
        acidite: baiesForm.acidite,
        vegetal: baiesForm.vegetal,
        fruite: baiesForm.fruite,
        natureCitronnee: baiesForm.natureCitronnee,
        aromePellicule: baiesForm.aromePellicule,
        astringencePellicule: baiesForm.astringencePellicule,
        vendange: baiesForm.vendange,
      } : null;

      const payload = {
        ...form,
        bottleLotId: undefined,
        nez: form.phase === "BAIES" ? undefined : (selectedNez.length > 0 ? selectedNez.join(', ') : undefined),
        bouche: form.phase === "BAIES" ? undefined : (selectedBouche.length > 0 ? selectedBouche.join(', ') : undefined),
        robe: form.phase === "BAIES" ? undefined : form.robe,
        noteGlobale: form.noteGlobale ? parseFloat(form.noteGlobale) : undefined,
        sucreTest: form.sucreTest ? parseFloat(form.sucreTest) : undefined,
        notes: form.phase === "BAIES"
          ? `${BAIES_DATA_PREFIX}${JSON.stringify(baiesData)}${form.notes ? `\n${form.notes}` : ''}`
          : form.notes,
        idempotencyKey
      };

      const res = await fetch('/api/degustations', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (!res.ok) {
        const apiError = data?.error || data?.message || "Erreur lors de la sauvegarde.";
        throw new Error(`${apiError} (route=/api/degustations, phase=${form.phase}, auth=${hasAuthorization ? "present" : "missing"})`);
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: "Dégustation enregistrée avec succès !", color: T.green } });
      
      if (refreshData) await refreshData();
      onClose();

    } catch (e) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e instanceof Error ? e.message : String(e), color: T.red } });
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Nouvelle Dégustation" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <FF label="Date">
          <Input type="date" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, date: e.target.value})} disabled={isSubmitting} />
        </FF>
        <FF label="Phase d'élaboration">
          <Select value={form.phase} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({...form, phase: e.target.value, parcelle: "", lotId: "", bottleLotId: "", robe: "", sucreTest: ""})} disabled={isSubmitting}>
            {PHASES_DEGUSTATION.map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </FF>
      </div>

      <div style={{ background: T.surfaceHigh, padding: 16, borderRadius: 6, border: `1px solid ${T.border}`, marginBottom: 20 }}>
        <FF label="Élément dégusté (Cible obligatoire)">
          <Select value={form.phase === "BAIES" ? form.parcelle : form.lotId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const val = e.target.value;
                    if (form.phase === "BAIES") setForm({...form, parcelle: val});
                    else setForm({...form, lotId: val});
                  }} disabled={isSubmitting}>
            <option value="">-- Sélectionner l'élément --</option>
            {getTargetOptions()}
          </Select>
        </FF>
      </div>

      {form.phase === "BAIES" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <FF label="Aptitude à l'écrasement">
              <Select value={baiesForm.aptitudeEcrasement} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBaiesForm({ ...baiesForm, aptitudeEcrasement: e.target.value })} disabled={isSubmitting}>
                <option value="">-- Choisir --</option>
                {BAIES_ECRASEMENT.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </FF>
            <FF label="Nature citronnée">
              <Select value={baiesForm.natureCitronnee} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBaiesForm({ ...baiesForm, natureCitronnee: e.target.value })} disabled={isSubmitting}>
                <option value="">-- Choisir --</option>
                {BAIES_NATURE_CITRONNEE.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </FF>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 20 }}>
            {[
              ["Sucrosité", "sucrosite"],
              ["Acidité", "acidite"],
              ["Végétal", "vegetal"],
              ["Fruité", "fruite"],
              ["Arôme pellicule", "aromePellicule"],
              ["Astringence pellicule", "astringencePellicule"],
            ].map(([label, key]) => (
              <FF key={key} label={label}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(11, minmax(0, 1fr))", gap: 4 }}>
                  {Array.from({ length: 11 }, (_, i) => {
                    const active = String((baiesForm as any)[key]) === String(i);
                    return (
                      <button
                        key={`${key}-${i}`}
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => setBaiesForm({ ...baiesForm, [key]: String(i) })}
                        style={{
                          padding: "6px 0",
                          borderRadius: 4,
                          border: `1px solid ${active ? T.accent : T.border}`,
                          background: active ? `${T.accent}22` : T.surface,
                          color: active ? T.accent : T.textDim,
                          fontSize: 11,
                          fontWeight: active ? "bold" : "normal",
                          cursor: isSubmitting ? "not-allowed" : "pointer",
                        }}
                      >
                        {i}
                      </button>
                    );
                  })}
                </div>
              </FF>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <FF label="Vendange">
              <Select value={baiesForm.vendange} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setBaiesForm({ ...baiesForm, vendange: e.target.value })} disabled={isSubmitting}>
                <option value="">-- Choisir --</option>
                {BAIES_VENDANGE.map((v: string) => <option key={v} value={v}>{v}</option>)}
              </Select>
            </FF>
          </div>
        </>
      ) : (
      <>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {form.phase === "DOSAGE" && (
          <FF label="Dosage testé (g/L)">
            <Input type="number" step="0.5" value={form.sucreTest} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, sucreTest: e.target.value})} disabled={isSubmitting} placeholder="Ex: 5.5" />
          </FF>
        )}
      </div>

      <div style={{ borderTop: `1px dashed ${T.border}`, margin: "20px 0" }} />

      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentLight, marginBottom: 12, textTransform: "uppercase" }}>👁️ Visuel</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {VISUEL_TAGS.map((tag: string) => {
          const currentTags = (form.robe || '').split(',').map((t: string) => t.trim()).filter(Boolean);
          const isActive = currentTags.includes(tag);
          return (
            <button key={tag} type="button" onClick={() => {
              const nextTags = isActive ? currentTags.filter((t: string) => t !== tag) : [...currentTags, tag];
              setForm({ ...form, robe: nextTags.join(', ') });
            }} disabled={isSubmitting} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 20, cursor: isSubmitting ? "not-allowed" : "pointer", border: `1px solid ${isActive ? T.accent : T.border}`, background: isActive ? `${T.accent}22` : "transparent", color: isActive ? T.accent : T.textDim }}>
              {tag}
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentLight, marginBottom: 12, textTransform: "uppercase" }}>👃 Analyse Olfactive</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {OLFACTIF_TAXONOMY.map((tag: any) => {
          const isActive = selectedNez.includes(tag);
          return (
            <button key={tag} onClick={() => toggleTag(selectedNez, setSelectedNez, tag)} disabled={isSubmitting}
              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 20, cursor: "pointer", transition: "all 0.2s",
                        border: `1px solid ${isActive ? T.accent : T.border}`,
                        background: isActive ? T.accent+"22" : "transparent",
                        color: isActive ? T.accent : T.textDim }}>
              {tag}
            </button>
          );
        })}
      </div>

      <div style={{ borderTop: `1px dashed ${T.border}`, margin: "20px 0" }} />

      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentLight, marginBottom: 12, textTransform: "uppercase" }}>👄 Analyse Gustative</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {GUSTATIF_TAXONOMY.map((tag: any) => {
          const isActive = selectedBouche.includes(tag);
          return (
            <button key={tag} onClick={() => toggleTag(selectedBouche, setSelectedBouche, tag)} disabled={isSubmitting}
              style={{ padding: "4px 10px", fontSize: 11, borderRadius: 20, cursor: "pointer", transition: "all 0.2s",
                        border: `1px solid ${isActive ? T.accent : T.border}`,
                        background: isActive ? T.accent+"22" : "transparent",
                        color: isActive ? T.accent : T.textDim }}>
              {tag}
            </button>
          );
        })}
      </div>
      </>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:16, alignItems:"start" }}>
        <FF label="Note Globale (/20)">
          <Input type="number" step="0.5" max="20" min="0" value={form.noteGlobale} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({...form, noteGlobale: e.target.value})} disabled={isSubmitting} style={{ fontSize: 18, fontWeight: "bold", textAlign: "center", color: T.accentLight }} />
        </FF>
        <FF label="Conclusion / Mots-clés libres">
          <textarea 
            maxLength={250} 
            value={form.notes} 
            onChange={e => setForm({...form, notes: e.target.value})} 
            disabled={isSubmitting}
            style={{ width:"100%", height:70, padding:10, borderRadius:4, border:`1px solid ${T.border}`, background:T.surface, color:T.text, resize:"none", fontFamily:"inherit", fontSize:13 }} 
            placeholder="Commentaire de synthèse ou précision sur les arômes..."
          />
          <div style={{ textAlign:"right", fontSize:10, marginTop:4, color: form.notes.length >= 250 ? T.red : T.textDim, fontWeight: form.notes.length >= 250 ? "bold" : "normal" }}>
            {form.notes.length} / 250
          </div>
        </FF>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting} style={{ background: isSubmitting ? T.textDim : T.accent }}>
          {isSubmitting ? "Enregistrement sécurisé..." : "Enregistrer la dégustation"}
        </Btn>
      </div>
    </Modal>
  );
}
