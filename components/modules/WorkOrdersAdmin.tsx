"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, FF, Input, Modal, Select } from "@/components/ui";
import { formatVolShort, useStore, useTheme } from "@/lib/store";
import {
  buildApiHeaders,
  extractApiErrorMessage,
  unwrapApiData,
} from "@/lib/client-app-helpers";

export function WorkOrdersAdmin({ workOrders, setWorkOrders }: { workOrders: any; setWorkOrders: any }) {
  const T = useTheme(); 
  const { state, dispatch } = useStore();
  const [modal, setModal] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const [form, setForm] = useState({ 
    recette: "SOUTIRAGE", 
    targetContainerId: "", 
    targetLotId: "",
    details: "",
    intrantProductId: "",
    intrantQuantity: "1",
    intrantUnit: "opération",
    sources: [{ lotId: "", volume: "" }]
  });

  const availLots = state.lots.filter((l: any) => l.volume > 0 && l.status !== "TIRE");
  const availCuves = state.containers.filter((c: any) => c.status === "VIDE" && c.status !== "ARCHIVÉE");
  
  const getLotCode = (id: any) => state.lots.find((l: any) => String(l.id) === String(id))?.code || id;
  const getContainerName = (id: any) => state.containers.find((c: any) => String(c.id) === String(id))?.displayName || state.containers.find((c: any) => String(c.id) === String(id))?.name || id;

  const isTransfer = form.recette === "SOUTIRAGE";
  const isAssemblage = form.recette === "ASSEMBLAGE";
  const isTirage = form.recette === "TIRAGE";
  const isIntrant = ["LEVURAGE", "SULFITAGE", "CHAPTALISATION", "ACIDIFICATION", "COLLAGE", "FILTRATION", "STABILISATION TARTRIQUE", "OUILLAGE", "AJOUT AUTRE PRODUIT"].includes(form.recette);
  const intrantProducts = (state.products || []).filter((product: any) => product.category === "Intrants");
  const selectedIntrantProduct = intrantProducts.find((product: any) => String(product.id) === String(form.intrantProductId));

  const updateSource = (index: any, field: any, value: any) => {
    const newSources: any[] = [...form.sources];
    newSources[index][field] = value;
    setForm({ ...form, sources: newSources });
  };
  const addSource = () => setForm({ ...form, sources: [...form.sources, { lotId: "", volume: "" }] });
  const removeSource = (index: any) => setForm({ ...form, sources: form.sources.filter((_: any, i: any) => i !== index) });

  const createWO = async () => {
    // 1. Validation Frontend rapide
    if (isTransfer) {
      if (!form.sources[0].lotId || !form.targetContainerId || !form.sources[0].volume) return alert("Remplissez tous les champs pour le soutirage.");
    } else if (isTirage) {
      if (!form.sources[0].lotId || !form.sources[0].volume) return alert("Choisissez un lot et un volume pour le tirage.");
    } else if (isAssemblage) {
      if (!form.targetContainerId || form.sources.some((s: any) => !s.lotId || !s.volume)) return alert("Remplissez tous les champs et volumes des lots à assembler.");
    } else if (isIntrant) {
      if (!form.targetLotId || !form.details || !(parseFloat(form.intrantQuantity) > 0) || !form.intrantUnit) return alert("Veuillez choisir un lot, indiquer le produit, la quantité et l'unité.");
    }

    setIsSubmitting(true);

    try {
      // 2. Préparation du Payload pour l'API
      const payload: any = {
        recette: form.recette,
        details: form.details || undefined,
        sources: isIntrant ? [{
          kind: "INTRANT",
          label: form.details,
          quantity: parseFloat(form.intrantQuantity),
          unit: form.intrantUnit,
          productId: form.intrantProductId ? parseInt(form.intrantProductId) : null,
        }] : form.sources.filter((s: any) => s.lotId && s.volume),
        idempotencyKey
      };
      if (form.targetContainerId) payload.targetContainerId = form.targetContainerId;
      if (form.targetLotId) payload.targetLotId = form.targetLotId;

      const res = await fetch('/api/workorders', {
        method: 'POST',
        headers: buildApiHeaders(undefined),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(extractApiErrorMessage(data, "Erreur lors de la planification de l'ordre de travail."));
      }
      const workOrder = unwrapApiData(data);

      // 3. Mise à jour de l'UI (Optimistic UI ou remplacement par les données du serveur)
      setWorkOrders([workOrder, ...workOrders]);
      dispatch({ type: "TOAST_ADD", payload: { msg: "Ordre de travail planifié avec succès !", color: T.green } });
      
      // Réinitialisation
      setIdempotencyKey(crypto.randomUUID());
      setModal(false);
      setForm({ recette: "SOUTIRAGE", targetContainerId: "", targetLotId: "", details: "", intrantProductId: "", intrantQuantity: "1", intrantUnit: "opération", sources: [{ lotId: "", volume: "" }] });

    } catch (error: any) {
      alert(error?.message || "Erreur lors de la planification de l'ordre de travail.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Ordres de Travail</h1>
        <Btn onClick={() => setModal(true)}>+ Planifier une tâche</Btn>
      </div>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"120px 150px 2fr 2fr 120px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1 }}>
          <div>Date</div><div>Action</div><div>Lot Source / Cible</div><div>Détails</div><div>Statut</div>
        </div>
        {workOrders.length === 0 ? <div style={{ padding:"40px", textAlign:"center", color:T.textDim }}>Aucun ordre de travail planifié.</div> : workOrders.map((w: any, i: any) => (
            <div key={w.id} style={{ display:"grid", gridTemplateColumns:"120px 150px 2fr 2fr 120px", gap:12, padding:"16px 16px", alignItems:"center", borderBottom:i<workOrders.length-1?`1px solid ${T.border}`:"none" }}>
              <div style={{ fontSize:11, color:T.textDim, fontFamily:"monospace" }}>{w.date.split('T')[0]}</div>
              <Badge label={w.recette} color={T.accent} />
              <div style={{ fontSize:13, color:T.accentLight, fontFamily:"monospace", fontWeight:600 }}>{w.displaySource || "Multiples"}</div>
              <div style={{ fontSize:13, color:T.text }}>{w.displayAction || "Opération en cours"}</div>
              <Badge label={w.status} color={w.status === "PENDING" ? T.red : T.green} />
            </div>
        ))}
      </div>

      {modal && (
        <Modal title="Nouveau plan de travail" onClose={() => setModal(false)}>
          <FF label="Type d'opération">
            <Select value={form.recette} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm({...form, recette: e.target.value})} disabled={isSubmitting}>
              {["SOUTIRAGE","ASSEMBLAGE","TIRAGE","LEVURAGE","SULFITAGE","CHAPTALISATION","ACIDIFICATION","COLLAGE","FILTRATION","STABILISATION TARTRIQUE","OUILLAGE","AJOUT AUTRE PRODUIT"].map((r: any)=><option key={r}>{r}</option>)}
            </Select>
          </FF>

          {(isTransfer || isTirage) && (
            <>
              <FF label="Lot source (Cuve de départ)">
                <Select value={form.sources[0].lotId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>updateSource(0, "lotId", e.target.value)} disabled={isSubmitting}>
                  <option value="">-- Choisir un lot source --</option>
                  {availLots.map((l: any)=><option key={l.id} value={l.id}>{l.code} (Dispo: {formatVolShort(l.volume)})</option>)}
                </Select>
              </FF>
              <div style={{ display:"grid", gridTemplateColumns: isTirage ? "1fr" : "1fr 1fr", gap:12 }}>
                <FF label={isTirage ? "Volume (hL) à tirer" : "Volume (hL) à transférer"}>
                  <Input type="number" step="0.1" value={form.sources[0].volume} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateSource(0, "volume", e.target.value)} disabled={isSubmitting} />
                </FF>
                {!isTirage && (
                  <FF label="Cuve de destination">
                    <Select value={form.targetContainerId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm({...form, targetContainerId:e.target.value})} disabled={isSubmitting}>
                      <option value="">-- Choisir une cuve vide --</option>
                      {availCuves.map((c: any)=><option key={c.id} value={c.id}>{c.displayName || c.name} (Capacité: {c.capacity} hL)</option>)}
                    </Select>
                  </FF>
                )}
              </div>
            </>
          )}

          {isAssemblage && (
            <div style={{ background:T.surfaceHigh, padding:14, borderRadius:6, border:`1px solid ${T.border}`, marginBottom:16 }}>
              <div style={{ fontSize:10, textTransform:"uppercase", color:T.textDim, marginBottom:10, fontWeight: "bold" }}>Composition de l'assemblage (Lots sources)</div>
              {form.sources.map((s: any, i: any) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <Select value={s.lotId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>updateSource(i, "lotId", e.target.value)} style={{ flex:2 }} disabled={isSubmitting}>
                    <option value="">-- Sélectionner un Lot --</option>
                    {availLots.map((l: any)=><option key={l.id} value={l.id}>{l.code} (Dispo: {formatVolShort(l.volume)})</option>)}
                  </Select>
                  <Input type="number" step="0.1" placeholder="Vol (hL)" value={s.volume} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateSource(i, "volume", e.target.value)} style={{ flex:1 }} disabled={isSubmitting} />
                  {form.sources.length > 1 && <Btn variant="ghost" onClick={()=>removeSource(i)} disabled={isSubmitting} style={{ color:T.red, padding:"0 8px" }}>✕</Btn>}
                </div>
              ))}
              <Btn variant="secondary" onClick={addSource} disabled={isSubmitting} style={{ fontSize:10, padding:"4px 8px", marginTop:4 }}>+ Ajouter un lot supplémentaire</Btn>
              
              <div style={{ marginTop:16, borderTop:`1px solid ${T.border}`, paddingTop:16 }}>
                <FF label="Cuve de destination finale (Assemblage)">
                  <Select value={form.targetContainerId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm({...form, targetContainerId:e.target.value})} disabled={isSubmitting}>
                    <option value="">-- Choisir une cuve pour recevoir l'assemblage --</option>
                    {availCuves.map((c: any)=><option key={c.id} value={c.id}>{c.displayName || c.name} (Capacité: {c.capacity} hL)</option>)}
                  </Select>
                </FF>
              </div>
            </div>
          )}

          {isIntrant && (
            <div style={{ background:T.surfaceHigh, padding:14, borderRadius:6, border:`1px solid ${T.border}`, marginBottom:16 }}>
              <FF label="Lot cible (à traiter)">
                <Select value={form.targetLotId} onChange={(e: React.ChangeEvent<HTMLSelectElement>)=>setForm({...form, targetLotId:e.target.value})} disabled={isSubmitting}>
                  <option value="">-- Choisir le lot à traiter --</option>
                  {state.lots.filter((l: any) => l.status !== "TIRE").map((l: any)=><option key={l.id} value={l.id}>{l.code}</option>)}
                </Select>
              </FF>
              <FF label="Détails du produit (Nom exact, Quantité, Dosage...)">
                <Input value={form.details} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, details:e.target.value})} disabled={isSubmitting} placeholder="Ex: 5g/hL de SO2, Levure IOC 18-2007 (500g)..." />
              </FF>
              <FF label="Produit inventaire (optionnel)">
                <Select
                  value={form.intrantProductId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const product = intrantProducts.find((candidate: any) => String(candidate.id) === String(e.target.value));
                    setForm({
                      ...form,
                      intrantProductId: e.target.value,
                      details: product ? product.name : form.details,
                      intrantUnit: product ? product.unit : form.intrantUnit,
                    });
                  }}
                  disabled={isSubmitting}
                >
                  <option value="">Non stocké</option>
                  {intrantProducts.map((product: any) => (
                    <option key={product.id} value={product.id}>{product.name} ({Number(product.currentStock || 0).toFixed(3)} {product.unit})</option>
                  ))}
                </Select>
              </FF>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <FF label="Quantité">
                  <Input type="number" step="0.001" value={form.intrantQuantity} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, intrantQuantity:e.target.value})} disabled={isSubmitting} />
                </FF>
                <FF label="Unité">
                  <Input value={form.intrantUnit} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setForm({...form, intrantUnit:e.target.value})} disabled={isSubmitting || !!selectedIntrantProduct} />
                </FF>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
            <Btn variant="secondary" onClick={() => setModal(false)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={createWO} disabled={isSubmitting} style={{ background: isSubmitting ? T.textDim : T.accent }}>
              {isSubmitting ? "Planification en cours..." : "Planifier l'opération"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
