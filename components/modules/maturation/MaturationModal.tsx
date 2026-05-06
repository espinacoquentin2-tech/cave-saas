"use client";
// @ts-nocheck

import React, { useState } from "react";
import { FF, Input, Modal, Select, Btn } from "@/components/ui";
import { CHAMPAGNE_GEODATA } from "@/lib/geodata";
import { useAuth, useStore, useTheme } from "@/lib/store";
import { buildApiHeaders, extractApiErrorMessage } from "@/lib/client-app-helpers";

export function MaturationModal({ onClose, editData = null }: { onClose: any; editData?: any }) {
  const T = useTheme();
  const { user } = useAuth();
  const { state, dispatch, refreshData } = useStore();

  const [form, setForm] = useState(() => {
    if (editData) {
      return {
        ...editData,
        date: new Date(editData.date).toISOString().slice(0, 10),
        parcelleId: editData.parcelleId ?? "",
        sucre: editData.sucre ?? "", ph: editData.ph ?? "", at: editData.at ?? "",
        malique: editData.malique ?? "", tartrique: editData.tartrique ?? "",
        maladie: editData.maladie || "Aucune", intensite: editData.intensite ?? "", notes: editData.notes || ""
      };
    }
    return {
      date: new Date().toISOString().slice(0, 10), parcelle: "", parcelleId: "", cepage: "CH",
      sucre: "", ph: "", at: "", malique: "", tartrique: "", maladie: "Aucune", intensite: "", notes: ""
    };
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  
  const [isAddingParcelle, setIsAddingParcelle] = useState(false);
  const [newDep, setNewDep] = useState("");
  const [newReg, setNewReg] = useState("");
  const [newCom, setNewCom] = useState("");
  const [newNom, setNewNom] = useState("");

  const handleSaveNewParcelle = async () => {
    if (!newNom.trim() || !newDep || !newReg || !newCom) return alert("Veuillez remplir tous les champs du terroir.");
    try {
      const res = await fetch('/api/parcelles', { 
        method: 'POST', 
        headers: buildApiHeaders(user),
        body: JSON.stringify({ nom: newNom.trim(), departement: newDep, region: newReg, commune: newCom }) 
      });
      if (res.ok) {
        const d = await res.json();
        dispatch({ type: "ADD_PARCELLE", payload: d });
        setForm({ ...form, parcelle: d.nom, parcelleId: d.id });
        setIsAddingParcelle(false);
        setNewDep(""); setNewReg(""); setNewCom(""); setNewNom("");
      } else {
        const err = await res.json().catch(() => ({}));
        alert(extractApiErrorMessage(err, "Erreur lors de la création de la parcelle."));
      }
    } catch (e: any) { alert(e?.message || "Erreur réseau."); }
  };

  const submit = async () => {
    if (!form.parcelle) return alert("Veuillez sélectionner une parcelle.");
    if (!form.date) return alert("La date est requise.");
    
    setIsSubmitting(true);
    
    try {
      // Nettoyage des virgules pour les décimales
      const cleanNum = (val: any) => val ? String(val).replace(',', '.') : "";
      
      const payload = {
        ...form,
        parcelleId: form.parcelleId ? Number(form.parcelleId) : undefined,
        sucre: cleanNum(form.sucre),
        ph: cleanNum(form.ph),
        at: cleanNum(form.at),
        malique: cleanNum(form.malique),
        tartrique: cleanNum(form.tartrique),
        intensite: cleanNum(form.intensite),
        idempotencyKey
      };

      const res = await fetch('/api/maturation', {
        method: 'POST', // L'API gère l'upsert si l'ID est présent
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        const savedRecord = data?.data || data;
        dispatch({ type: form.id ? "UPDATE_MATURATION" : "ADD_MATURATION", payload: savedRecord });
        dispatch({ type: "TOAST_ADD", payload: { msg: `Prélèvement ${form.id ? 'mis à jour' : 'enregistré'} avec succès.`, color: T.green } });
        
        if (refreshData) await refreshData(); // Force la resync de la base
        onClose();
      } else {
        throw new Error(extractApiErrorMessage(data, "Erreur de sauvegarde."));
      }
    } catch (e: any) { 
      alert(e?.message ?? "Erreur de sauvegarde."); 
      setIsSubmitting(false);
    }
  };

  const depts = Object.keys(CHAMPAGNE_GEODATA || {});
  const regions = newDep ? Object.keys((CHAMPAGNE_GEODATA as any)[newDep] || {}) : [];
  const communes = (newDep && newReg) ? ((CHAMPAGNE_GEODATA as any)[newDep]?.[newReg] || []) : [];
  const selectedParcelleExists = form.parcelleId
    ? (state.parcelles || []).some((p: any) => String(p.id) === String(form.parcelleId))
    : false;
  const legacyParcelleOptionValue = !form.parcelleId && form.parcelle ? `LEGACY:${form.parcelle}` : "";
  const selectedParcelleValue = form.parcelleId
    ? String(form.parcelleId)
    : legacyParcelleOptionValue;

  return (
    <Modal title={form.id ? "Compléter les analyses" : "Saisir un prélèvement"} onClose={onClose}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
	        <FF label="Date"><Input type="date" value={form.date} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, date:e.target.value})} disabled={isSubmitting} /></FF>
	        <FF label="Cépage">
	          <Select value={form.cepage} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm({...form, cepage:e.target.value})} disabled={isSubmitting}>
            <option value="CH">Chardonnay (CH)</option>
            <option value="PN">Pinot Noir (PN)</option>
            <option value="PM">Meunier (PM)</option>
            <option value="PBL">Pinot Blanc (PBL)</option>
            <option value="ARB">Arbane (ARB)</option>
            <option value="PMES">Petit Meslier (PMES)</option>
            <option value="PG">Pinot Gris (PG)</option>
            <option value="CH-ROSE">Chardonnay Rose (CH-ROSE)</option>
            <option value="VOLTIS">Voltis (VOL)</option>
          </Select>
        </FF>
      </div>
      
      {!isAddingParcelle ? (
        <FF label="Parcelle">
	          <Select value={selectedParcelleValue} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
	            if (e.target.value === "ADD_NEW") {
                setIsAddingParcelle(true);
                return;
              }
              if (!e.target.value) {
                setForm({ ...form, parcelle: "", parcelleId: "" });
                return;
              }
              if (e.target.value.startsWith("LEGACY:")) {
                setForm({ ...form, parcelle: e.target.value.slice("LEGACY:".length), parcelleId: "" });
                return;
              }
              const selectedParcelle = (state.parcelles || []).find((p: any) => String(p.id) === e.target.value);
              if (selectedParcelle) {
                setForm({ ...form, parcelle: selectedParcelle.nom, parcelleId: selectedParcelle.id });
              }
	          }} disabled={isSubmitting}>
	            <option value="">-- Choisir une parcelle --</option>
              {form.parcelleId && !selectedParcelleExists ? (
                <option value={String(form.parcelleId)}>
                  {form.parcelle} (liaison introuvable)
                </option>
              ) : null}
              {!form.parcelleId && form.parcelle ? (
                <option value={legacyParcelleOptionValue}>
                  {form.parcelle} (relevé historique)
                </option>
              ) : null}
	            {(state.parcelles || []).map((p: any) => <option key={p.id} value={String(p.id)}>{p.nom} {p.commune ? `(${p.commune})` : ""}</option>)}
            <option value="ADD_NEW" style={{ fontWeight: "bold", color: T.accent }}>+ Ajouter une nouvelle parcelle...</option>
          </Select>
        </FF>
      ) : (
        <div style={{ background: T.surfaceHigh, padding: 14, borderRadius: 6, border: `1px solid ${T.accent}50`, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: "bold", color: T.accentLight }}>📍 Nouveau Terroir</div>
            <button onClick={() => setIsAddingParcelle(false)} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 12 }}>✕ Annuler</button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
	            <Select value={newDep} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setNewDep(e.target.value); setNewReg(""); setNewCom(""); }}>
	              <option value="">Département</option>
	              {depts.map((d: any) => <option key={d}>{d}</option>)}
	            </Select>
	            <Select value={newReg} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => { setNewReg(e.target.value); setNewCom(""); }} disabled={!newDep}>
	              <option value="">Région / Sous-région</option>
	              {regions.map((r: any) => <option key={r}>{r}</option>)}
	            </Select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
	            <Select value={newCom} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewCom(e.target.value)} disabled={!newReg}>
	              <option value="">Commune</option>
	              {communes.map((c: any) => <option key={c}>{c}</option>)}
	            </Select>
	            <Input autoFocus value={newNom} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setNewNom(e.target.value)} placeholder="Nom (Ex: Les Craies)" />
          </div>

          <Btn onClick={handleSaveNewParcelle} style={{ width: "100%" }} disabled={!newNom || !newDep || !newReg || !newCom}>Enregistrer la parcelle</Btn>
        </div>
      )}

      <div style={{ background: T.surfaceHigh, padding: 14, borderRadius: 4, border: `1px solid ${T.border}`, marginTop: 16 }}>
        <div style={{ fontSize:11, color:T.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Analyses</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
	          <FF label="Sucre (g/L)"><Input type="text" inputMode="decimal" value={form.sucre} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, sucre:e.target.value})} placeholder="Ex: 154" disabled={isSubmitting} /></FF>
	          <FF label="Acidité Totale"><Input type="text" inputMode="decimal" value={form.at} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, at:e.target.value})} placeholder="Ex: 8.5" disabled={isSubmitting} /></FF>
	          <FF label="pH"><Input type="text" inputMode="decimal" value={form.ph} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, ph:e.target.value})} placeholder="Ex: 3.05" disabled={isSubmitting} /></FF>
	          <FF label="Acide Malique"><Input type="text" inputMode="decimal" value={form.malique} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, malique:e.target.value})} placeholder="Ex: 6.2" disabled={isSubmitting} /></FF>
	          <FF label="Acide Tartrique"><Input type="text" inputMode="decimal" value={form.tartrique} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, tartrique:e.target.value})} placeholder="Ex: 7.1" disabled={isSubmitting} /></FF>
        </div>
      </div>

      <div style={{ background: T.surfaceHigh, padding: 14, borderRadius: 4, border: `1px solid ${T.border}`, marginTop: 16, marginBottom: 16 }}>
        <div style={{ fontSize:11, color:T.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>État Sanitaire</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FF label="Symptôme">
	            <Select value={form.maladie} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm({...form, maladie:e.target.value})} disabled={isSubmitting}>
              <option value="Aucune">Sain (Aucune)</option>
              <option value="Mildiou">Mildiou</option>
              <option value="Oïdium">Oïdium</option>
              <option value="Pourriture Grise">Pourriture Grise</option>
            </Select>
          </FF>
          <FF label="Fréquence (%)">
	            <Input type="text" inputMode="decimal" value={form.intensite} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, intensite:e.target.value})} disabled={form.maladie === "Aucune" || isSubmitting} placeholder="Ex: 5" />
          </FF>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !form.parcelle} style={{ background: isSubmitting ? T.textDim : T.accent, transition: "background 0.2s" }}>
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Btn>
      </div>
    </Modal>
  );
}
