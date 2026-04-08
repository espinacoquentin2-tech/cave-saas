"use client";
// @ts-nocheck

import React, { useState, useReducer, useRef, useEffect } from "react";
import {
  THEMES, CONTAINER_TYPES, LOT_STATUSES, LOT_STATUS_COLORS,
  BOTTLE_STATUSES, BOTTLE_STATUS_COLORS, CEPAGES,
  getFillPct, formatVol, formatVolShort, getTypeColor, roleColor,
  initialState, storeReducer, ThemeCtx, AuthCtx, StoreCtx, useTheme, useAuth, useStore
} from "../lib/store";
import { FillBar, Badge, KpiCard, Modal, FF, Input, Select, Btn, Toast } from "../components/ui";
import { supabase } from "../lib/supabase";
import { CHAMPAGNE_GEODATA } from '../lib/geodata';

// =============================================================================
// HELPERS & COMPOSANTS SUR-MESURE
// =============================================================================
const formatStatus = (s: string | null | undefined) => {
  if (!s) return "";
  if (s === "FERMENTATION_ALCOOLIQUE") return "FA";
  if (s === "FERMENTATION_MALOLACTIQUE") return "FML";
  if (s === "FA_ET_FML") return "FA & FML";
  return s.replace(/_/g, " ");
};

type MultiSelectDropProps = {
  label: string;
  options: any[];
  selected: any[];
  onChange: (next: any[]) => void;
  format?: (value: any) => any;
  width?: number;
};

type LoginScreenProps = {
  onLogin: (user: any) => void;
};

type TaskExecutionModalProps = {
  task: any;
  onClose: () => void;
  workOrders: any[];
  setWorkOrders: (next: any[]) => void;
  refreshData: () => Promise<void> | void;
};

type DashboardProps = {
  setNav: (nav: string) => void;
  workOrders: any[];
  setWorkOrders: (next: any[]) => void;
  onRefresh: () => Promise<void> | void;
};

type MacerationModalProps = {
  pressing: any;
  onClose: () => void;
  dispatch: (action: any) => void;
  refreshData: () => Promise<void> | void;
  user: any;
  state: any;
};

type TankFillPreviewProps = {
  container: any;
  incomingVolume: any;
  T: any;
  colorOverride?: string;
};

type VendangesProps = {
  onSelectContainer: (container: any) => void;
};

const buildApiHeaders = (user: { accessToken?: string } | null | undefined, extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  'x-request-id': crypto.randomUUID(),
  ...(user?.accessToken ? { Authorization: `Bearer ${user.accessToken}` } : {}),
  ...extra,
});

function MultiSelectDrop({ label, options, selected, onChange, format = (v: any) => v, width = 140 }: MultiSelectDropProps) {
  const T = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && e.target instanceof Node && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const toggle = (opt: any) => {
    if (selected.includes(opt)) onChange(selected.filter(x => x !== opt));
    else onChange([...selected, opt]);
  };

  const displayLabel = selected.length === 0 ? label : 
                       selected.length === 1 ? format(selected[0]) : 
                       `${selected.length} sélections`;

  return (
    <div style={{ position: 'relative', width }} ref={ref}>
      <div onClick={() => setOpen(!open)} style={{ border: `1px solid ${open ? T.accent : T.border}`, padding: '9px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, background: T.surfaceHigh, color: selected.length ? T.textStrong : T.textDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{displayLabel}</span>
        <span style={{ fontSize: 10 }}>▼</span>
      </div>
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 4, zIndex: 100, maxHeight: 220, overflowY: 'auto', boxShadow: '0 8px 16px rgba(0,0,0,0.8)' }}>
          {options.length === 0 ? (
            <div style={{ padding: '8px 12px', fontSize: 11, color: T.textDim, fontStyle: 'italic' }}>Vide</div>
          ) : options.map(o => (
            <label key={o} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.border}44`, fontSize: 11, color: T.text, transition: 'background .15s' }} onMouseEnter={e => e.currentTarget.style.background = T.surfaceHigh} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} style={{ marginRight: 10, accentColor: T.accent, cursor: 'pointer' }} />
              {format(o)}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LOGIN
// =============================================================================
function LoginScreen({ onLogin }: LoginScreenProps) {
  const T = useTheme();
  const { state } = useStore();
  const [email, setEmail] = useState(""); 
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState(""); 
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); 
    setErr("");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    
    if (error) { 
      setErr("Identifiants incorrects ou utilisateur non trouvé."); 
      setLoading(false); 
    } else {
      const authUser = data.user;
      if (!authUser || !authUser.email) {
        setErr("Utilisateur introuvable.");
        setLoading(false);
        return;
      }

      const foundUser = (state.users || []).find((u: any) => u.email === authUser.email);
      const fullName = foundUser ? foundUser.name : authUser.email.split('@')[0].toUpperCase();
      const role = foundUser ? foundUser.role : "Chef de cave";

      onLogin({ id: authUser.id, email: authUser.email, name: fullName, role: role, initials: fullName.substring(0, 2).toUpperCase(), accessToken: data.session?.access_token });
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:T.loginBg, display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:44 }}>
          <div style={{ fontSize:10, letterSpacing:6, color:T.textDim, textTransform:"uppercase", marginBottom:10 }}>Domaine · Champagne</div>
          <div style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:40, color:T.accentLight, letterSpacing:2 }}>CAVE</div>
          <div style={{ fontSize:9, color:T.textDim, letterSpacing:4, marginTop:4, textTransform:"uppercase" }}>Gestion viticole sécurisée</div>
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"32px 32px 24px", borderTop:`2px solid ${T.accent}` }}>
          <FF label="Adresse e-mail"><Input type="email" value={email} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} disabled={loading} placeholder="vous@domaine.fr" /></FF>
          <FF label="Mot de passe"><Input type="password" value={pwd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPwd(e.target.value)} disabled={loading} placeholder="••••••••" /></FF>
          {err && <div style={{ background:T.red+"22", border:`1px solid ${T.red}44`, borderRadius:3, padding:"8px 12px", fontSize:12, color:T.red, marginBottom:14 }}>{err}</div>}
          <Btn onClick={submit} disabled={loading || !email || !pwd} style={{ width:"100%", padding:13, marginTop:6 }}>{loading ? "Vérification..." : "Se connecter ->"}</Btn>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MODALE D'EXÉCUTION DES ORDRES DE TRAVAIL (CAVISTE) - SÉCURISÉE API
// =============================================================================
function TaskExecutionModal({ task, onClose, workOrders, setWorkOrders, refreshData }: TaskExecutionModalProps) {
  const T = useTheme();
  const { state, dispatch } = useStore();
  const { user } = useAuth();

  const plannedVol = task.volume || (task.sources ? task.sources.reduce((sum: number, s: any) => sum + (parseFloat(s.volume) || 0), 0) : 0);
  
  const [volMain, setVolMain] = useState(plannedVol.toString());
  const [remVol, setRemVol] = useState("");
  const [remType, setRemType] = useState("LIES"); 
  const [remTargetId, setRemTargetId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const fmtHL = { "37.5cl":0.00375, "75cl":0.0075, "150cl":0.015, "300cl":0.03 };
  const [tirageTypeMise, setTirageTypeMise] = useState("EFFERVESCENT");
  const [tirageFormat, setTirageFormat] = useState("75cl");
  const [tirageBouchage, setTirageBouchage] = useState("Capsule");
  const [tirageModele, setTirageModele] = useState("");
  const [tirageZone, setTirageZone] = useState("");
  const [tirageCount, setTirageCount] = useState(plannedVol > 0 ? Math.floor(plannedVol / fmtHL["75cl"]).toString() : "");

  const targetContainer = (state.containers || []).find((c: any) => String(c.id) === String(task.targetContainerId));
  const freeSpace = targetContainer ? Math.round(((targetContainer.capacityValue || targetContainer.capacity || 0) - (targetContainer.currentVolume || 0)) * 100) / 100 : 0;
  const isTankCapacityIssue = targetContainer && task.recette !== "TIRAGE" ? (parseFloat(volMain) || 0) > freeSpace : false;

  const btlNeeded = task.recette === "TIRAGE" ? (parseInt(tirageCount) || 0) : 0;
  const bottleProduct = (state.products || []).find((p: any) => p.subCategory === "Bouteilles" && p.name.includes(tirageFormat));
  const bouchageProduct = (state.products || []).find((p: any) => p.subCategory === (tirageBouchage === "Capsule" ? "Capsules" : "Bouchons"));

  const bottleStock = bottleProduct ? bottleProduct.currentStock : 0;
  const bouchageStock = bouchageProduct ? bouchageProduct.currentStock : 0;

  const isBottleShortage = btlNeeded > bottleStock;
  const isBouchageShortage = btlNeeded > bouchageStock;
  const isStockShortage = task.recette === "TIRAGE" && (isBottleShortage || isBouchageShortage || !bottleProduct || !bouchageProduct);

  const recoveryTanks = (state.containers || []).filter((c: any) => 
    c.status !== "ARCHIVÉE" && (remType === "LIES" ? c.type === "CUVE_LIES" : c.type === "CUVE_BOURBES")
  );

  let isTirageBlockedAOC = false;
  let baseYear = new Date().getFullYear();
  let nextYear = baseYear + 1;
  const lotSourceId = task.lotId || (task.sources && task.sources[0]?.lotId);
  const lotSource = (state.lots || []).find((l: any) => String(l.id) === String(lotSourceId));
  
  if (task.recette === "TIRAGE" && tirageTypeMise === "EFFERVESCENT" && lotSource) {
      baseYear = parseInt(lotSource.year || lotSource.millesime) || parseInt((lotSource.businessCode || lotSource.code).substring(0,4)) || baseYear;
      nextYear = baseYear + 1;
      const releaseDate = new Date(`${nextYear}-01-01T00:00:00Z`);
      if (new Date() < releaseDate) {
        isTirageBlockedAOC = true;
      }
  }

  // VÉRIFICATION AOC
  const lotEvents = (state.events || []).filter((e: any) => String(e.lotId) === String(task.targetLotId) && (e.type === "INTRANT" || e.eventType === "INTRANT"));
  const hasChaptalise = lotEvents.some((e: any) => (e.note || e.comment)?.toLowerCase().includes("sucre") || (e.note || e.comment)?.toLowerCase().includes("chaptalisation"));
  const hasAcidifie = lotEvents.some((e: any) => (e.note || e.comment)?.toLowerCase().includes("acide") || (e.note || e.comment)?.toLowerCase().includes("acidification"));
  
  const isChaptalisationBlocked = task.recette === "CHAPTALISATION" && hasAcidifie;
  const isAcidificationBlocked = task.recette === "ACIDIFICATION" && hasChaptalise;

  const reportIssue = () => {
    const updated = workOrders.map(w => w.id === task.id ? { ...w, status: "BLOCKED", displayAction: "🚨 BLOQUÉ : Problème matériel ou AOC" } : w);
    setWorkOrders(updated);
    dispatch({ type: "TOAST_ADD", payload: { msg: "Alerte envoyée au Chef de cave.", color: T.red } });
    onClose();
  };

  const execute = async () => {
    if (isTankCapacityIssue) return alert("Capacité insuffisante pour ce volume !");
    if (isStockShortage) return alert("Stock insuffisant pour réaliser ce tirage !");
    
    setIsSubmitting(true);
    const vMain = parseFloat(volMain) || 0;
    const vRem = parseFloat(remVol) || 0;
    
    try {
      // 1. SOUTIRAGE SIMPLE (API TRANSACTIONS)
      if (task.recette === "SOUTIRAGE") {
        const sourceContId = lotSource?.currentContainerId || lotSource?.containerId;
        if (!lotSource) throw new Error("Lot source introuvable.");

        if (targetContainer && (targetContainer.currentVolume || 0) > 0) {
          const targetLot = (state.lots || []).find((l: any) => String(l.currentContainerId || l.containerId) === String(targetContainer.id));
          const isMustTransfer = lotSource.status.includes("MOUT") || lotSource.status.includes("FERMENTATION");
          if (isMustTransfer && targetLot && (targetLot.mainGrapeCode || targetLot.cepage) !== "MULTI" && (targetLot.mainGrapeCode || targetLot.cepage) !== (lotSource.mainGrapeCode || lotSource.cepage)) {
            throw new Error(`🚨 Règle AOC : Impossible de mélanger des cépages au stade de moût.`);
          }
        }

        const res = await fetch('/api/transfers', { 
          method:'POST', 
          headers: buildApiHeaders(user),
          body: JSON.stringify({ 
            lotId: parseInt(lotSource.id), 
            fromId: parseInt(sourceContId), 
            destinations: [{ toId: parseInt(task.targetContainerId), volume: vMain }],
            volume: vMain + vRem, // Le total soutiré
            operator: user.name,
            remainderType: (vRem > 0 && remTargetId) ? remType : undefined,
            bourbesDestId: (vRem > 0 && remTargetId) ? parseInt(remTargetId) : undefined,
            date: new Date().toISOString(),
            idempotencyKey
          }) 
        }); 
        if (!res.ok) throw new Error((await res.json()).error);
      } 
      
      // 2. ASSEMBLAGE MULTIPLE (API ASSEMBLAGE)
      else if (task.recette === "ASSEMBLAGE") {
        const sourcesToProcess = task.sources || [{ lotId: task.lotId, volume: task.volume }];
        const fullSourceLots: any[] = sourcesToProcess.map((s: any) => (state.lots || []).find((l: any) => String(l.id) === String(s.lotId))).filter(Boolean);

        const hasCoteaux = fullSourceLots.some(l => l.status === "COTEAUX");
        const hasVinDeBase = fullSourceLots.some(l => l.status === "VIN_DE_BASE" || l.status === "FA_ET_FML" || l.status === "MOUT_DEBOURBE");
        const hasRouge = fullSourceLots.some(l => l.status === "VIN_ROUGE");
        
        const hasMusts = fullSourceLots.some(l => l.status.includes("MOUT") || l.status.includes("FERMENTATION"));
        if (hasMusts) {
          const uniqueCepages = [...new Set(fullSourceLots.map(l => l.mainGrapeCode || l.cepage))].filter(c => c !== "MULTI");
          if (uniqueCepages.length > 1) {
            throw new Error("🚨 Règle AOC : Il est formellement interdit d'assembler des cépages différents (" + uniqueCepages.join(", ") + ") au stade de moût.");
          }
        }

        if (hasCoteaux && hasVinDeBase) {
          throw new Error("🚨 Règle AOC : Interdit d'assembler un vin tranquille (Coteaux) avec un Vin de Base effervescent !");
        }

        const isRose = (hasRouge && hasVinDeBase) || fullSourceLots.some(l => (l.businessCode || l.code).includes("-Rosé"));
        const years = [...new Set(fullSourceLots.map(l => l.year || l.millesime).filter(Boolean))];
        const anneeLabel = years.length === 1 ? years[0] : "SA";

        const baseCode = `${anneeLabel}-ASSEM-${String((state.lots || []).length+1).padStart(3,"0")}`;
        const codeAssem = isRose ? `${baseCode}-Rosé` : baseCode;

        const sourceLotsData = sourcesToProcess.map((s: any) => ({ id: parseInt(s.lotId), volumeUsed: parseFloat(s.volume) || 0 }));
        
        const res = await fetch('/api/lots/assemblage', { 
          method: 'POST', 
          headers: buildApiHeaders(user),
          body: JSON.stringify({ 
            code: codeAssem, 
            volume: vMain, 
            sourceLots: sourceLotsData, 
            targetContainerId: parseInt(task.targetContainerId), 
            operator: user.name,
            millesime: anneeLabel === "SA" ? "SA" : parseInt(anneeLabel),
            cepage: "MULTI",
            idempotencyKey
          }) 
        }); 
        if (!res.ok) throw new Error((await res.json()).error);
      }

      // 3. TIRAGE (API TIRAGE SÉCURISÉE)
      else if (task.recette === "TIRAGE") {
        const execDate = new Date().toISOString(); 
        const volUsed = btlNeeded * ((fmtHL as Record<string, number>)[tirageFormat] || 0.0075);
        const detailBouchage = `${tirageBouchage} (${tirageModele || "Non précisé"})`;
        const isTranquille = tirageTypeMise === "TRANQUILLE";
        const finalNote = isTranquille ? `Mise en bouteille vin tranquille sous ${detailBouchage}.` : `Exécution OT Tirage effervescent sous ${detailBouchage}.`;

        const res = await fetch('/api/tirage', { 
          method: 'POST', 
          headers: buildApiHeaders(user), 
          body: JSON.stringify({ 
            lotId: parseInt(lotSourceId), 
            format: tirageFormat, count: btlNeeded, volume: volUsed, 
            zone: tirageZone, tirageDate: execDate, operator: user.name, note: finalNote,
            isTranquille, idempotencyKey
          }) 
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || errorData.error || "Erreur de tirage");
        }
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || errorData.error || "Erreur de tirage");
        }
      }

      // 4. INTRANTS (API INTRANTS SÉCURISÉE)
      else if (["LEVURAGE", "SULFITAGE", "CHAPTALISATION", "ACIDIFICATION", "COLLAGE", "FILTRATION", "STABILISATION TARTRIQUE", "OUILLAGE", "AJOUT AUTRE PRODUIT"].includes(task.recette)) {
        const res = await fetch('/api/lots/intrants', { 
          method: 'POST', 
          headers: buildApiHeaders(user),
          body: JSON.stringify({ 
            lotId: parseInt(task.targetLotId), 
            intrant: task.recette, quantity: 1, unit: "opération", 
            operator: user.name, note: task.displayAction, idempotencyKey 
          }) 
        }); 
        if (!res.ok) throw new Error((await res.json()).error);
      }

      setWorkOrders(workOrders.filter(w => w.id !== task.id));
      dispatch({ type: "TOAST_ADD", payload: { msg: `Tâche ${task.recette} exécutée avec succès !`, color: T.green } });
      if (refreshData) await refreshData();
      onClose();

    } catch(e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert("Erreur lors de l'exécution : " + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Exécution : ${task.recette}`} onClose={onClose}>
      <div style={{ background:T.surfaceHigh, padding:14, borderRadius:4, marginBottom:16, fontSize:12, border:`1px solid ${T.border}` }}>
        <div style={{ color:T.textDim, marginBottom:4 }}>Tâche prévue :</div>
        <div style={{ color:T.accent, fontWeight:"bold", fontFamily:"monospace", wordBreak:"break-all" }}>{task.displaySource || task.lotId}</div>
        
        {targetContainer && task.recette !== "TIRAGE" && (
          <>
            <div style={{ color:T.textStrong }}>Vers : {targetContainer.displayName || targetContainer.name}</div>
            <div style={{ color:T.textDim, marginTop:4 }}>Volume théorique attendu : {plannedVol} hL</div>
          </>
        )}
      </div>

      {isChaptalisationBlocked && (
        <div style={{ background:T.red+"15", border:`1px solid ${T.red}55`, borderRadius:4, padding:14, marginBottom: 16 }}>
          <div style={{ color:T.red, fontSize:12, fontWeight:"bold", marginBottom:4 }}>🚨 Blocage AOC : Règle des Intrants</div>
          <div style={{ color:T.red, fontSize:11, lineHeight:1.4 }}>Impossible d'exécuter la chaptalisation. Le lot a déjà été acidifié. Le cumul des deux est interdit.</div>
          <Btn variant="primary" onClick={reportIssue} disabled={isSubmitting} style={{ marginTop:8, fontSize:11, background:T.red, color:"#fff" }}>Signaler le blocage</Btn>
        </div>
      )}

      {isAcidificationBlocked && (
        <div style={{ background:T.red+"15", border:`1px solid ${T.red}55`, borderRadius:4, padding:14, marginBottom: 16 }}>
          <div style={{ color:T.red, fontSize:12, fontWeight:"bold", marginBottom:4 }}>🚨 Blocage AOC : Règle des Intrants</div>
          <div style={{ color:T.red, fontSize:11, lineHeight:1.4 }}>Impossible d'exécuter l'acidification. Le lot a déjà été chaptalisé (ajout de sucre). Le cumul est interdit.</div>
          <Btn variant="primary" onClick={reportIssue} disabled={isSubmitting} style={{ marginTop:8, fontSize:11, background:T.red, color:"#fff" }}>Signaler le blocage</Btn>
        </div>
      )}

      {task.recette === "TIRAGE" ? (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          
          <div style={{ marginBottom: 4, borderBottom:`1px solid ${T.border}`, paddingBottom: 16 }}>
            <FF label="Type de mise en bouteille">
              <Select value={tirageTypeMise} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTirageTypeMise(e.target.value)} disabled={isSubmitting} style={{ fontWeight:"bold", color: tirageTypeMise === "TRANQUILLE" ? "#8b1c31" : T.accent }}>
                <option value="EFFERVESCENT">Prise de mousse (Champagne)</option>
                <option value="TRANQUILLE">Vin Tranquille (Coteaux / Rouge)</option>
              </Select>
            </FF>
          </div>

          {isTirageBlockedAOC && (
            <div style={{ background:T.red+"15", border:`1px solid ${T.red}55`, borderRadius:4, padding:14 }}>
              <div style={{ color:T.red, fontSize:12, fontWeight:"bold", marginBottom:4 }}>🚨 Blocage AOC : Tirage prématuré</div>
              <div style={{ color:T.red, fontSize:11, lineHeight:1.4 }}>
                Le tirage pour la prise de mousse d'un vin de la vendange {baseYear} est strictement interdit avant le 1er janvier {nextYear}.
              </div>
            </div>
          )}

          {isStockShortage && btlNeeded > 0 && (
            <div style={{ background:T.red+"15", border:`1px solid ${T.red}55`, borderRadius:4, padding:14 }}>
              <div style={{ color:T.red, fontSize:12, fontWeight:"bold", marginBottom:6 }}>⚠️ Stock insuffisant pour tirer {btlNeeded.toLocaleString('fr-FR')} bouteilles :</div>
              <ul style={{ color:T.red, fontSize:12, margin:0, paddingLeft:20 }}>
                {!bottleProduct && <li>Aucune bouteille {tirageFormat} au catalogue.</li>}
                {isBottleShortage && bottleProduct && <li>Manque {(btlNeeded - bottleStock).toLocaleString('fr-FR')} Bouteilles (En stock: {bottleStock.toLocaleString('fr-FR')})</li>}
                {!bouchageProduct && <li>Aucun produit {tirageBouchage} au catalogue.</li>}
                {isBouchageShortage && bouchageProduct && <li>Manque {(btlNeeded - bouchageStock).toLocaleString('fr-FR')} {tirageBouchage}s (En stock: {bouchageStock.toLocaleString('fr-FR')})</li>}
              </ul>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FF label="Format bouteille">
              <Select value={tirageFormat} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const formatKey = e.target.value as keyof typeof fmtHL;
                setTirageFormat(e.target.value);
                setTirageCount(plannedVol > 0 ? Math.floor(plannedVol / fmtHL[formatKey]).toString() : "");
              }}>
                {["37.5cl","75cl","150cl"].map(f => <option key={f}>{f}</option>)}
              </Select>
            </FF>
            <FF label="Nombre de bouteilles réel">
              <Input type="number" value={tirageCount} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTirageCount(e.target.value)} disabled={isSubmitting} />
            </FF>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
            <FF label="Bouchage">
              <Select value={tirageBouchage} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTirageBouchage(e.target.value)} disabled={isSubmitting}>
                <option value="Capsule">Capsule</option>
                <option value="Liège">Liège</option>
              </Select>
            </FF>
            <FF label="Modèle (Marque - Réf)">
              <Input value={tirageModele} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTirageModele(e.target.value)} placeholder="Ex: Trescases - 29x29" disabled={isSubmitting} />
            </FF>
          </div>

          <FF label="Emplacement de stockage">
            <Input value={tirageZone} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTirageZone(e.target.value)} placeholder="Ex: Cave 2 - Palette 15" disabled={isSubmitting} />
          </FF>
        </div>
      ) : (
        targetContainer && (
          <FF label={`Volume de JUS CLAIR transféré vers ${targetContainer.displayName || targetContainer.name} (hL)`}>
            <Input type="number" step="0.1" value={volMain} onChange={e => setVolMain(e.target.value)} disabled={isSubmitting} style={{ borderColor: isTankCapacityIssue ? T.red : T.border }} />
          </FF>
        )
      )}

      {isTankCapacityIssue && task.recette !== "TIRAGE" && (
        <div style={{ background:T.red+"15", border:`1px solid ${T.red}44`, padding:12, borderRadius:4, marginBottom:16, marginTop:8 }}>
          <div style={{ color:T.red, fontSize:12, marginBottom:8 }}>⚠️ Impossible : {targetContainer?.displayName || targetContainer?.name} n'a que {freeSpace.toFixed(1)} hL d'espace libre !</div>
          <Btn variant="primary" onClick={reportIssue} disabled={isSubmitting} style={{ width:"100%", fontSize:11, background:T.red, color:"#fff" }}>Signaler le blocage au Chef de Cave</Btn>
        </div>
      )}

      {(task.recette === "SOUTIRAGE" || task.recette === "ASSEMBLAGE") && !isTankCapacityIssue && (
        <div style={{ borderTop:`1px solid ${T.border}`, marginTop:16, paddingTop:16 }}>
          <div style={{ fontSize:11, color:T.accent, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Gestion des restes (Lies / Bourbes)</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <FF label="Type de reste">
              <Select value={remType} onChange={e => { setRemType(e.target.value); setRemTargetId(""); }} disabled={isSubmitting}>
                <option value="LIES">Lies</option>
                <option value="BOURBES">Bourbes</option>
              </Select>
            </FF>
            <FF label="Volume récupéré (hL)">
              <Input type="number" step="0.1" value={remVol} onChange={e => setRemVol(e.target.value)} placeholder="ex: 0.5" disabled={isSubmitting} />
            </FF>
          </div>
          {parseFloat(remVol) > 0 && (
            <FF label={`Envoyer ces ${remType.toLowerCase()} vers :`}>
              <Select value={remTargetId} onChange={e => setRemTargetId(e.target.value)} disabled={isSubmitting}>
                <option value="">-- Choisir la cuve de stockage --</option>
                {recoveryTanks.map(c => {
                  const volDispo = Math.max(0, (c.capacityValue || c.capacity || 0) - (c.currentVolume || 0)).toFixed(1);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.displayName || c.name} ({volDispo} hL dispo)
                    </option>
                  );
                })}
              </Select>
            </FF>
          )}
        </div>
      )}

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn 
          onClick={execute} 
          disabled={isSubmitting || isTankCapacityIssue || isStockShortage || isTirageBlockedAOC || isChaptalisationBlocked || isAcidificationBlocked || (parseFloat(remVol) > 0 && !remTargetId) || (task.recette === "TIRAGE" && !tirageCount)}
        >
          {isSubmitting ? "Traitement Serveur..." : "Valider la tâche"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// DASHBOARD (Avec intégration des alertes d'inventaire)
// =============================================================================
function Dashboard({ setNav, workOrders, setWorkOrders, onRefresh }: DashboardProps) {
  const T = useTheme(); 
  const { user } = useAuth(); 
  const { state } = useStore();
  
  // NOUVEAU : Récupération sûre (fallback arrays vides)
  const containers = state.containers || [];
  const lots = state.lots || [];
  const bottleLots = state.bottleLots || [];
  const events = state.events || [];
  const products = state.products || [];
  
  const [executingTask, setExecutingTask] = useState(null);

  const totalCapacity = containers.reduce((s, c) => s + (c.capacityValue || c.capacity || 0), 0);
  const totalVol      = containers.reduce((s, c) => s + (c.currentVolume || 0), 0);
  const lotsActifs    = lots.filter(l => l.status !== "TIRE" && l.status !== "ARCHIVE").length;
  const cuvesPleines  = containers.filter(c => (c.currentVolume || 0) > 0).length;
  const cuvesVides    = containers.filter(c => (c.currentVolume || 0) === 0).length;
  
  // Utilisation des bons champs BDD (currentBottleCount)
  const surLattes     = bottleLots.filter(b => b.status === "SUR_LATTES" || b.status === "A_DEGORGER").reduce((s, b) => s + (b.currentBottleCount || b.currentCount || 0), 0);
  const prodFinis     = bottleLots.filter(b => b.status === "PRET_EXPEDITION").reduce((s, b) => s + (b.currentBottleCount || b.currentCount || 0), 0);
  
  const fillRate      = totalCapacity > 0 ? Math.round(totalVol / totalCapacity * 100) : 0;
  const lotsByStatus  = LOT_STATUSES.map(s => ({ s, count: lots.filter(l => l.status === s).length })).filter(x => x.count > 0);

  const pendingTasks = workOrders.filter(w => w.status === "PENDING" || w.status === "BLOCKED").sort((a,b) => {
    if (a.status === "BLOCKED" && b.status !== "BLOCKED") return -1;
    if (a.status !== "BLOCKED" && b.status === "BLOCKED") return 1;
    return new Date(a.date) - new Date(b.date);
  });

  // 🚨 1. ALERTES CUVERIE & LOTS
  const caveAlerts = [
    ...workOrders.filter(w => w.status === "BLOCKED").map(w => ({ level: "red", msg: `Blocage OT: ${w.recette} impossible (Capacité)`, nav: "admin_wo" })),
    ...containers.filter(c => c.status === "VIDE" && c.notes).map(c => ({ level:"warn", msg:`${c.displayName || c.name} : ${c.notes}`, nav:"cuverie" })),
    ...containers.filter(c => c.status === "NETTOYAGE").map(c => ({ level:"info", msg:`${c.displayName || c.name} en nettoyage`, nav:"cuverie" })),
    ...lots.filter(l => l.notes && l.notes.includes("sans suivi")).map(l => ({ level:"warn", msg:`${l.businessCode || l.code} : ${l.notes}`, nav:"lots" })),
    ...bottleLots.filter(b => b.status === "A_DEGORGER").map(b => ({ level:"action", msg:`${b.businessCode || b.code} prêt à dégorger (${((b.currentBottleCount || b.currentCount) || 0).toLocaleString("fr-FR")} btl)`, nav:"stock" })),
  ];

  // 📦 2. ALERTES MATIÈRES SÈCHES (NOUVEAU)
  const stockAlerts = products
    .filter(p => p.currentStock <= p.minStock)
    .map(p => ({
      level: p.currentStock === 0 ? "red" : "warn",
      msg: p.currentStock === 0 ? `RUPTURE : ${p.name}` : `Stock critique : ${p.name} (Reste ${p.currentStock.toLocaleString('fr-FR')} ${p.unit})`,
      nav: "inventaire"
    }));

  const totalAlertsCount = caveAlerts.length + stockAlerts.length;
  
  // Utilisation des createdAt BDD
  const recentEvts = [...events].sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).slice(0, 6);
  const getLotCode = id => lots.find(l => String(l.id) === String(id))?.businessCode || lots.find(l => String(l.id) === String(id))?.code || id;
  const getContainerName = id => containers.find(c => String(c.id) === String(id))?.displayName || containers.find(c => String(c.id) === String(id))?.name || id;
  
  const alertColors = { warn: "#d98b2b", info: T.blue, action: T.green, red: T.red };

  const quickLinks = [
    { label:"Cuverie", sub:`${cuvesPleines} actives`, nav:"cuverie", color:T.blue },
    { label:"Pressoirs", sub:`Réception vendanges`, nav:"vendanges", color:T.accent },
    { label:"Matières", sub:`Stocks & Commandes`,   nav:"inventaire", color:"#d98b2b" },
    { label:"Stock",   sub:`${surLattes.toLocaleString("fr-FR")} btl`, nav:"stock", color:T.green },
  ];

  const formatVolStr = (vol: any) => typeof vol === 'number' ? `${vol.toFixed(1)} hL` : `${vol} hL`;

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:10, color:T.accent, letterSpacing:4, textTransform:"uppercase", marginBottom:6 }}>Vue d'ensemble</div>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Tableau de bord</h1>
        <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>{new Date().toLocaleDateString("fr-FR", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}<span style={{ marginLeft:16, color:T.accent }}>{user.name}</span><span style={{ marginLeft:8, fontSize:10, color:T.textDim }}>({user.role})</span></div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))", gap:16, marginBottom:24 }}>
        {[
          { value:formatVolStr(totalVol), label:"Volume en cave", sub:`${fillRate}% de capacité`, accent:T.accent, nav:"cuverie" },
          { value:lotsActifs,          label:"Lots actifs",    sub:`${lots.length} au total`,  accent:T.blue, nav:"lots" },
          { value:cuvesPleines,        label:"Contenants actifs", sub:`${cuvesVides} vides`,   accent:T.green, nav:"cuverie" },
          { value:surLattes.toLocaleString("fr-FR"), label:"Sur lattes", sub:"bouteilles", accent:T.accentDim, nav:"stock" },
          { value:prodFinis.toLocaleString("fr-FR"), label:"Prêts expédition", sub:"bouteilles", accent:T.green, nav:"stock" },
          { value:totalAlertsCount || "OK", label:"Alertes", sub: totalAlertsCount ? "à traiter" : "tout est bon", accent: totalAlertsCount ? T.red : T.green, nav:"" },
        ].map((k,i) => (
          <div key={i} onClick={() => k.nav ? setNav(k.nav) : null} style={{ cursor: k.nav ? "pointer" : "default", transition:"transform 0.15s" }} onMouseEnter={e => k.nav && (e.currentTarget.style.transform = "translateY(-3px)")} onMouseLeave={e => k.nav && (e.currentTarget.style.transform = "none")}>
            <KpiCard value={k.value} label={k.label} sub={k.sub} accent={k.accent} />
          </div>
        ))}
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:"20px 24px", marginBottom:18 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim }}>Taux de remplissage global</span>
          <span style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight: "bold" }}>{formatVolStr(totalVol)} / {formatVolStr(totalCapacity)}</span>
        </div>
        <div style={{ height:10, background:T.border, borderRadius:5, overflow:"hidden" }}>
          <div style={{ width:`${fillRate}%`, height:"100%", background:`linear-gradient(90deg, ${T.accentDim}, ${T.accent})`, borderRadius:5, transition:"width 1s" }} />
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:18 }}>
        
        {/* TÂCHES EN ATTENTE */}
        <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <span style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, fontWeight: "bold" }}>✅ Mes Tâches</span>
            {pendingTasks.length > 0 && <span style={{ fontSize:10, background:T.red+"22", color:T.red, border:`1px solid ${T.red}44`, padding:"2px 8px", borderRadius:10, fontFamily:"monospace" }}>{pendingTasks.length} en attente</span>}
          </div>
          {pendingTasks.length === 0 ? (
            <div style={{ textAlign:"center", padding:"30px 0", color:T.green }}><div style={{ fontSize:22, marginBottom:10 }}>✓</div><div style={{ fontSize:12, color:T.textDim, fontStyle: "italic" }}>Aucune tâche planifiée</div></div> 
          ) : pendingTasks.slice(0, 5).map((w, i) => (
            <div key={w.id} style={{ display:"grid", gridTemplateColumns:"80px 1fr 90px", gap:12, alignItems:"center", padding:"12px 0", borderBottom:i < pendingTasks.length-1 ? `1px solid ${T.border}` : "none", background: w.status === "BLOCKED" ? T.red+"11" : "transparent" }}>
              <div style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{w.date.split('T')[0]}</div>
              <div>
                <div style={{ fontSize:11, color: w.status === "BLOCKED" ? T.red : T.accent, textTransform:"uppercase", fontWeight:600 }}>{w.recette}</div>
                <div style={{ fontSize:12, color:T.textStrong, marginTop:4, fontFamily:"monospace", lineHeight: 1.4 }}>
                  {w.displaySource ? (
                    <>{w.displaySource} <br/> <span style={{color: w.status === "BLOCKED" ? T.red : T.textDim, fontSize: 10}}>{w.displayAction}</span></>
                  ) : (
                    <>Lot: {getLotCode(w.lotId)} -&gt; Cuve: {getContainerName(w.targetContainerId)} ({w.volume} hL)</>
                  )}
                </div>
              </div>
              <div style={{ textAlign:"right" }}>
                {w.status !== "BLOCKED" && (
                  <Btn variant="ghost" style={{ fontSize:10, padding:"4px 8px" }} onClick={() => setExecutingTask(w)}>EXÉCUTER</Btn>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* ALERTES (CUVERIE & STOCKS) */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, fontWeight: "bold" }}>Alertes Cuverie & Lots</span>
            </div>
            {caveAlerts.length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 0", color:T.green }}><div style={{ fontSize:22, marginBottom:6 }}>✓</div><div style={{ fontSize:12, color:T.textDim, fontStyle: "italic" }}>Aucune alerte — tout est en ordre</div></div>
            ) : caveAlerts.map((a, i) => (
              <div key={i} onClick={() => setNav(a.nav)} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 0", borderBottom:i < caveAlerts.length-1 ? `1px solid ${T.border}` : "none", cursor:"pointer" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:alertColors[a.level] || T.accent, flexShrink:0, marginTop:4 }} />
                <div style={{ fontSize:12, color: a.level === "red" ? T.red : T.textStrong, flex:1, lineHeight:1.4 }}>{a.msg}</div>
              </div>
            ))}
          </div>

          <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
              <span style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, fontWeight: "bold" }}>Alertes Matières Sèches</span>
            </div>
            {stockAlerts.length === 0 ? (
              <div style={{ textAlign:"center", padding:"20px 0", color:T.green }}><div style={{ fontSize:22, marginBottom:6 }}>✓</div><div style={{ fontSize:12, color:T.textDim, fontStyle: "italic" }}>Stocks suffisants</div></div>
            ) : stockAlerts.map((a, i) => (
              <div key={i} onClick={() => setNav(a.nav)} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 0", borderBottom:i < stockAlerts.length-1 ? `1px solid ${T.border}` : "none", cursor:"pointer" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:alertColors[a.level] || T.accent, flexShrink:0, marginTop:4 }} />
                <div style={{ fontSize:12, color: a.level === "red" ? T.red : T.textStrong, flex:1, lineHeight:1.4, fontWeight: a.level === "red" ? "bold" : "normal" }}>{a.msg}</div>
              </div>
            ))}
          </div>

        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:16, fontWeight: "bold" }}>Activité récente (Base de données)</div>
          {recentEvts.length === 0 ? (
            <div style={{ color:T.textDim, fontSize:12, fontStyle:"italic", textAlign:"center", padding:"30px 0" }}>Aucune activité enregistrée</div>
          ) : recentEvts.map((e, i) => (
            <div key={e.id} style={{ display:"grid", gridTemplateColumns:"120px 110px 1fr 28px", gap:8, alignItems:"center", padding:"10px 0", borderBottom:i < recentEvts.length-1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{new Date(e.createdAt || e.date).toLocaleDateString('fr-FR')}</div>
              <Badge label={e.eventType || e.type} />
              <div style={{ fontSize:11, color:T.textStrong, fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{getLotCode(e.lotId)}</div>
              <div style={{ fontSize:10, color:T.textDim }}>{e.operator?.split("@")[0] || e.operator}</div>
            </div>
          ))}
        </div>
        
        <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:16, fontWeight: "bold" }}>Accès rapides</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
            {quickLinks.map(q => (<div key={q.nav} onClick={() => setNav(q.nav)} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:6, padding:"16px 18px", cursor:"pointer", borderLeft:`3px solid ${q.color}`, transition:"border-color .15s" }} onMouseEnter={e => e.currentTarget.style.borderLeftColor = q.color} onMouseLeave={e => e.currentTarget.style.borderLeftColor = q.color}><div style={{ fontSize:15, color:T.textStrong, fontWeight:600, marginBottom:3 }}>{q.label}</div><div style={{ fontSize:11, color:T.textDim }}>{q.sub}</div></div>))}
          </div>
          
          <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:12, fontWeight: "bold" }}>Statuts lots actifs</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {lotsByStatus.map(({ s, count }) => (
              <div key={s} onClick={() => setNav("lots")} style={{ cursor:"pointer", background:LOT_STATUS_COLORS[s]+"22", border:`1px solid ${LOT_STATUS_COLORS[s]}44`, borderRadius:4, padding:"5px 12px", fontSize:10, color:LOT_STATUS_COLORS[s], fontFamily:"monospace", fontWeight: "bold" }}>
                {formatStatus(s)} · {count}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {executingTask && (
        <TaskExecutionModal 
          task={executingTask} 
          onClose={() => setExecutingTask(null)} 
          workOrders={workOrders}
          setWorkOrders={setWorkOrders}
          refreshData={onRefresh}
        />
      )}
    </div>
  );
}

// =============================================================================
// MODALE D'ENCUVAGE (Macération Rouge / Rosé de Saignée) - SÉCURISÉE
// =============================================================================
function MacerationModal({ pressing, onClose, dispatch, refreshData, user, state }: MacerationModalProps) {
  const T = useTheme();
  // On estime que 1000 kg de vendange entière/égrappée prennent environ 10 hL à 12 hL de volume en cuve
  const volumeEstime = ((pressing.weight / 1000) * 11).toFixed(1);

  const [form, setForm] = useState({
    cuveId: "",
    typeVendange: "Égrappée 100%",
    volumeOccupe: volumeEstime,
    sanitaire: "A",
    notes: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const availCuves = (state.containers || []).filter(c => 
    c.status !== "ARCHIVÉE" && 
    c.status !== "PLEINE" && 
    !c.type.includes("DEBOURBAGE") && 
    !c.type.includes("CITERNE")
  );

  const submit = async () => {
    setIsSubmitting(true);
    const millesime = new Date(pressing.date).getFullYear();
    const ts = Date.now();
    const cruFormatted = (pressing.cru || pressing.parcelle).toUpperCase().replace(/\s+/g,"-");

    try {
      const codeMac = `${millesime}-${pressing.cepage}-${cruFormatted}-MAC-${String(ts).slice(-4)}`;
      const noteMac = `Vendange: ${form.typeVendange} | Sanitaire: ${form.sanitaire} | Poids: ${pressing.weight}kg` + (form.notes ? ` | Obs: ${form.notes}` : "");
      
      // 1. Création du Lot de macération (API Transactionnelle)
      const res = await fetch('/api/lots', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          code: codeMac, millesime, cepage: pressing.cepage, lieu: pressing.cru || pressing.parcelle, 
          volume: parseFloat(form.volumeOccupe), containerId: parseInt(form.cuveId), 
          status: "MACERATION", notes: noteMac, operator: user.name,
          idempotencyKey
        }) 
      });

      if (!res.ok) throw new Error((await res.json()).error || "Erreur de création de lot");

      // 2. MISE À JOUR DU QUAI (API)
      await fetch('/api/pressings', { 
        method: 'PATCH', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ id: pressing.id, status: "PRESSE" }) 
      }).catch(()=>{});

      dispatch({ type: 'UPDATE_PRESSING', payload: { id: pressing.id, status: "PRESSE" } }); 
      dispatch({ type: "TOAST_ADD", payload: { msg: "Vendange encuvée en macération !", color: T.accent } });
      
      if (refreshData) await refreshData();
      onClose();
    } catch(e) { 
      alert("Erreur lors de l'encuvage : " + e.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const sanColors = { "A+": T.green, "A": T.accent, "B": "#d98b2b", "C": T.red, "FA": T.blue };

  if (showAdd) {
    return <AddContainerModal initialCapacity={Math.ceil(parseFloat(volumeEstime)).toString()} onClose={() => setShowAdd(false)} onSuccess={(newId) => { setForm({ ...form, cuveId: newId }); setShowAdd(false); }} />;
  }

  return (
    <Modal title={`Encuvage Macération : ${(pressing.weight || pressing.poids).toLocaleString('fr-FR')} kg de ${pressing.cepage}`} onClose={onClose}>
      <div style={{ background:T.surfaceHigh, padding:14, borderRadius:4, marginBottom:16, fontSize:12, color:T.textDim, borderLeft:`3px solid #8b1c31` }}>
        La vendange (jus + baies + rafles) va être placée directement en cuve pour extraction de la couleur et des arômes. Un nouveau lot "MACERATION" sera créé.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <FF label="État Sanitaire">
          <Select value={form.sanitaire} disabled={isSubmitting} onChange={e=>setForm({...form, sanitaire:e.target.value})} style={{ borderLeft: `4px solid ${sanColors[form.sanitaire]}`, fontWeight:"bold" }}>
            <option value="A+">A+ (Parfait)</option><option value="A">A (Très bon)</option><option value="B">B (Moyen, trié)</option><option value="C">C (Médiocre)</option>
          </Select>
        </FF>
        <FF label="Type de vendange">
          <Select value={form.typeVendange} disabled={isSubmitting} onChange={e=>setForm({...form, typeVendange:e.target.value})}>
            <option>Égrappée 100%</option><option>Vendange Entière 100%</option><option>Partiellement Égrappée</option>
          </Select>
        </FF>
      </div>

      <div style={{ border:`1px solid ${T.border}`, borderRadius:4, padding:16, marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ fontSize:12, fontWeight:"bold", color:T.textStrong, textTransform:"uppercase" }}>Destination</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
          <FF label="Volume occupé estimé (hL)">
            <Input type="number" step="0.1" value={form.volumeOccupe} disabled={isSubmitting} onChange={e=>setForm({...form, volumeOccupe:e.target.value})} />
          </FF>
          <FF label="Envoyer vers (Cuve)">
            <div style={{ display: "flex", gap: 8 }}>
              <Select value={form.cuveId} disabled={isSubmitting} onChange={e=>setForm({...form, cuveId:e.target.value})} style={{ flex: 1, borderColor: !form.cuveId ? T.red : T.border }}>
                <option value="">-- Choisir une cuve --</option>
                {availCuves.map(c => {
                  const volDispo = Math.max(0, (c.capacityValue || c.capacity || 0) - (c.currentVolume || 0)).toFixed(1);
                  return (
                    <option key={c.id} value={c.id}>
                      {c.displayName || c.name} ({volDispo} hL dispo)
                    </option>
                  );
                })}
              </Select>
              <Btn variant="secondary" onClick={() => setShowAdd(true)} disabled={isSubmitting}>+</Btn>
            </div>
          </FF>
        </div>
        <div style={{ marginTop: 8 }}>
          <FF label="Observations (Sulfitage, levurage...)">
            <Input value={form.notes} disabled={isSubmitting} onChange={e=>setForm({...form, notes:e.target.value})} placeholder="Ex: Sulfitage à la benne 3g/hL..." />
          </FF>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !form.cuveId || parseFloat(form.volumeOccupe) <= 0} style={{ background: isSubmitting ? T.textDim : "#8b1c31", borderColor: isSubmitting ? T.textDim : "#8b1c31", color: "#fff" }}>
          {isSubmitting ? "Enregistrement..." : "Valider l'encuvage"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// COMPOSANT VISUEL RÉUTILISABLE : APERÇU DE REMPLISSAGE DE CUVE
// =============================================================================
function TankFillPreview({ container, incomingVolume, T, colorOverride }: TankFillPreviewProps) {
  if (!container) return null;

  const currentV = parseFloat(container.currentVolume || container.volume) || 0;
  const cap = parseFloat(container.capacityValue || container.capacity) || 1;
  const incomingV = parseFloat(incomingVolume) || 0;
  const predictedV = currentV + incomingV;
  const isOver = predictedV > cap;
  
  const currentHeightPct = Math.min(100, (currentV / cap) * 100);
  const incomingHeightPct = Math.min(100 - currentHeightPct, (incomingV / cap) * 100);
  
  let fillColor = colorOverride || T.accent;
  if (!colorOverride) {
    if (container.type?.includes("BOURBES") || container.type?.includes("LIES")) fillColor = "#5e4a3d";
    if (container.type?.includes("REBECHES")) fillColor = "#8c3b3b";
  }

  return (
    <div style={{ marginTop: 12, background: T.bg, border: `1px solid ${isOver ? T.red : T.border}`, borderRadius: 4, padding: "12px 16px", display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ width: 32, height: 48, border: `2px solid ${T.borderLight}`, borderRadius: 3, position: "relative", overflow: "hidden", flexShrink: 0, background: T.surface }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: `${currentHeightPct}%`, background: T.textDim, transition: "height 0.3s ease" }} />
        <div style={{ position: "absolute", bottom: `${currentHeightPct}%`, left: 0, width: "100%", height: `${incomingHeightPct}%`, background: fillColor, opacity: 0.85, transition: "height 0.3s ease", animation: incomingV > 0 ? "pulseOpacity 2s infinite" : "none" }} />
        <div style={{ position: "absolute", top: 0, left: 4, width: 4, height: "100%", background: "white", opacity: 0.1 }} />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: "bold", color: T.textStrong, marginBottom: 2 }}>
          {container.displayName || container.name}
        </div>
        <div style={{ fontSize: 11, color: T.textDim }}>
          Actuel: {currentV.toFixed(2)} hL {incomingV > 0 && <span style={{margin:"0 4px"}}>→</span>} 
          {incomingV > 0 && (
            <span style={{ color: isOver ? T.red : T.textStrong, fontWeight: "bold" }}>
              Prévision: {predictedV.toFixed(2)} hL
            </span>
          )}
          <span style={{ color: T.textDim }}> / {cap.toFixed(2)} hL</span>
        </div>
        {isOver && <div style={{ fontSize: 10, color: T.red, fontWeight: "bold", marginTop: 2 }}>⚠️ DÉBORDEMENT (+{(predictedV - cap).toFixed(2)} hL)</div>}
      </div>
    </div>
  );
}

// =============================================================================
// MODULE VENDANGES (QUAI, PRESSOIRS & DÉBOURBAGE) - PRODUCTION READY
// =============================================================================
function Vendanges({ onSelectContainer }: VendangesProps) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore();
  const { user } = useAuth(); 
  
  const isChef = user?.role === "Chef de cave" || user?.role === "Admin";

  const [activeTab, setActiveTab] = useState("PRESSOIRS"); 
  
  const [newApport, setNewApport] = useState({ parcelle: "", cepage: "CH", poids: "" });
  const [isCustomOrigin, setIsCustomOrigin] = useState(false);
  const [apportToDelete, setApportToDelete] = useState(null); 
  const [customDep, setCustomDep] = useState("");
  const [customReg, setCustomReg] = useState("");
  const [customCom, setCustomCom] = useState("");
  const [customNom, setCustomNom] = useState("");
  
  const [newPress, setNewPress] = useState({ nom: "", type: "Pneumatique", marque: "Bücher", capacite: 4000 });
  const [showAddPress, setShowAddPress] = useState(false);
  
  const [actionModal, setActionModal] = useState(null); 
  const [selectedApport, setSelectedApport] = useState("");
  const [loadWeight, setLoadWeight] = useState(""); 
  const [loadWarning, setLoadWarning] = useState(null);
  const [mixWarning, setMixWarning] = useState(null); 

  const [showAddCuve, setShowAddCuve] = useState(false);
  const [newCuve, setNewCuve] = useState({ name: "", type: "Débourbage Cuvée", capacityValue: "" });
  
  const [cuveeDests, setCuveeDests] = useState([]);
  const [tailleDests, setTailleDests] = useState([]);
  const [rebechesDests, setRebechesDests] = useState([]);

  const [transferModal, setTransferModal] = useState(null); 
  const [transferDests, setTransferDests] = useState([]); 
  const [transferOptions, setTransferOptions] = useState({ actionRest: "ENVOYER_BOURBES", bourbesDestId: "" });
  
  const [quickBourbe, setQuickBourbe] = useState(false);
  const [quickBourbeName, setQuickBourbeName] = useState("");
  const [quickBourbeCap, setQuickBourbeCap] = useState("");

  const [quickDestIndex, setQuickDestIndex] = useState(null);
  const [quickDestName, setQuickDestName] = useState("");
  const [quickDestCap, setQuickDestCap] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const pressoirs = state.pressoirs || [];
  const apports = state.pressings || []; 
  const apportsEnAttente = apports.filter(a => a.status !== "PRESSÉ");

  const depts = Object.keys(CHAMPAGNE_GEODATA || {});
  const regions = customDep ? Object.keys(CHAMPAGNE_GEODATA[customDep] || {}) : [];
  const communes = (customDep && customReg) ? (CHAMPAGNE_GEODATA[customDep][customReg] || []) : [];

  const safeParseFloat = (val) => parseFloat(String(val).replace(',', '.'));
  const parseToHl = (val) => parseFloat((parseFloat(String(val).replace(',', '.')) || 0).toFixed(2));

  // --- ACTIONS SIMPLES ---
  const handleAddApport = async () => {
    let finalParcelle = newApport.parcelle;
    if (isCustomOrigin) {
      if (!customCom || !customNom) return alert("Veuillez renseigner la commune et le nom.");
      finalParcelle = `${customNom} (${customCom})`;
    } else {
      if (!finalParcelle) return alert("Veuillez sélectionner une provenance.");
    }
    if (!newApport.poids) return alert("Veuillez renseigner le poids.");

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pressings', { 
        method: 'POST', 
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ 
          date: new Date().toISOString(), 
          parcelle: finalParcelle, 
          cepage: newApport.cepage, 
          poids: safeParseFloat(newApport.poids), 
          status: "EN_ATTENTE" 
        }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error);
      
      dispatch({ type: "TOAST_ADD", payload: { msg: "Raisins réceptionnés sur le quai", color: T.green } });
      if (refreshData) await refreshData();
      
      setNewApport({ parcelle: "", cepage: "CH", poids: "" });
      setIsCustomOrigin(false); setCustomDep(""); setCustomReg(""); setCustomCom(""); setCustomNom("");
    } catch (e) { 
      alert(e.message); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const confirmDeleteApport = async () => {
    if (!apportToDelete) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/pressings?id=${apportToDelete.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      if (refreshData) await refreshData();
    } catch(e) { 
      alert(e.message);
    }
    setApportToDelete(null); 
    setIsSubmitting(false);
  };

  const handleAddPress = async () => {
    if (!newPress.nom) return alert("Nom requis");
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pressoirs', { 
        method: 'POST', 
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(newPress) 
      });
      if (!res.ok) throw new Error("Erreur serveur");
      
      if (refreshData) await refreshData();
      setNewPress({ nom: "", type: "Pneumatique", marque: "Bücher", capacite: 4000 });
      setShowAddPress(false);
    } catch (e) { 
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePressStatus = async (id, status, extraData = {}) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pressoirs', { 
        method: 'PUT', 
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ id, status, ...extraData }) 
      });
      if (!res.ok) throw new Error("Erreur serveur");
      
      if (refreshData) await refreshData();
      if (status === "VIDE") setActionModal(null);
    } catch (e) { 
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- MOTEUR DE CHARGEMENT API-DRIVEN ---
  const handleLoadSubmit = async (forceLoad = false, forceMix = false) => {
    if (!selectedApport || !loadWeight) return alert("Veuillez sélectionner un lot et indiquer le poids à charger.");
    
    const apport = apports.find(a => String(a.id) === String(selectedApport));
    const weightToLoad = safeParseFloat(loadWeight);
    const p = actionModal.press;

    if (weightToLoad > apport.poids) return alert("Vous ne pouvez pas charger plus que ce qu'il reste sur le quai !");
    
    const currentLoad = p.loadKg || 0;
    const totalLoad = currentLoad + weightToLoad;
    const fillPct = (totalLoad / p.capacite) * 100;

    // Avertissement de charge locale (Frontend)
    if (!forceLoad) {
      if (fillPct < 90 || fillPct > 110) {
        setLoadWarning({
          type: fillPct < 90 ? 'UNDER' : 'OVER',
          fillPct, totalLoad, missing: p.capacite - totalLoad, excess: totalLoad - p.capacite,
          forceMix
        });
        return; 
      }
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pressings/load', { 
        method: 'POST', 
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ 
          pressId: p.id, 
          apportId: apport.id, 
          weightToLoad, 
          forceMix, 
          idempotencyKey 
        }) 
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        // Gestion de l'erreur 409 (Mélange de cépage détecté par le backend)
        if (res.status === 409) {
          setMixWarning({ apport, press: p, weightToLoad });
          setIsSubmitting(false);
          return;
        }
        throw new Error(errorData.error);
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: "Pressoir chargé avec succès !", color: T.green } });
      setActionModal(null);
      setLoadWarning(null); 
      setMixWarning(null);
      setIdempotencyKey(crypto.randomUUID());
      if (refreshData) await refreshData();

    } catch(e) { 
      alert(e.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCuveDebourbage = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/containers', { 
        method: 'POST', 
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ 
          name: newCuve.name, 
          type: newCuve.type, 
          capacity: safeParseFloat(newCuve.capacityValue), 
          zone: "Cuverie" 
        }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error);
      
      if (refreshData) await refreshData();
      setNewCuve({ name: "", type: "Débourbage Cuvée", capacityValue: "" });
      setShowAddCuve(false);
    } catch(e) { 
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- DÉBOURBAGE (TRANSFERT / SOUTIRAGE) ---
  const validerTransfert = async () => {
    // 1. Calcul du volume total saisi
    const volSaisi = transferDests.reduce((sum, d) => sum + parseToHl(d.vol), 0);
    
    // Remplacement du "alert" par un Toast rouge
    if (volSaisi <= 0) {
      dispatch({ type: "TOAST_ADD", payload: { msg: "Veuillez indiquer un volume supérieur à 0 pour le soutirage.", color: T.red } });
      return;
    }
    
    const sourceId = transferModal.id;
    const currentLot = (state.lots || []).find(l => String(l.currentContainerId || l.containerId) === String(sourceId) && parseFloat(l.currentVolume || l.volume) > 0);

    if (!currentLot) {
       dispatch({ type: "TOAST_ADD", payload: { msg: "Erreur : La cuve source est vide ou le lot est introuvable.", color: T.red } });
       return;
    }

    if (transferOptions.actionRest === "ENVOYER_BOURBES" && !transferOptions.bourbesDestId) {
      dispatch({ type: "TOAST_ADD", payload: { msg: "Veuillez sélectionner la cuve de destination pour les bourbes/lies.", color: T.red } });
      return;
    }

    setIsSubmitting(true);
    try {
      // 2. Préparation stricte des destinations
      const validDestinations = transferDests
        .filter(d => d.cuveId && parseToHl(d.vol) > 0)
        .map(d => ({ toId: parseInt(d.cuveId), volume: parseToHl(d.vol) }));

      if (validDestinations.length === 0) {
        throw new Error("Aucune cuve de destination valide n'a été configurée.");
      }

      // 3. Payload Zod-compliant
      const payload = {
          lotId: parseInt(currentLot.id),
          fromId: parseInt(sourceId),
          volume: volSaisi, 
          destinations: validDestinations,
          remainderType: transferOptions.actionRest === "ENVOYER_BOURBES" ? "BOURBES" : null,
          bourbesDestId: transferOptions.bourbesDestId ? parseInt(transferOptions.bourbesDestId) : null, 
          operator: user?.name || "Système",
          date: new Date().toISOString(),
          idempotencyKey: idempotencyKey || crypto.randomUUID() // Sécurité absolue
      };

      // 4. Appel de l'API blindée
      const res = await fetch('/api/transfers', {
          method: 'POST',
          headers: buildApiHeaders(user),
          headers: buildApiHeaders(user),
          body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors du transfert.");

      // 5. SUCCÈS
      if (refreshData) await refreshData();
      
      dispatch({ type: "TOAST_ADD", payload: { msg: `Soutirage validé et sauvegardé en base !`, color: T.accent } });
      
      // Reset de l'interface
      setTransferModal(null);
      setTransferDests([]);
      setTransferOptions({ actionRest: "ENVOYER_BOURBES", bourbesDestId: "" });

    } catch (e: any) {
        // 6. ECHEC : Affichage de l'erreur métier en rouge
        dispatch({ type: "TOAST_ADD", payload: { msg: `Action refusée : ${e.message}`, color: T.red } });
    } finally {
        setIsSubmitting(false);
        // On renouvelle la clé pour éviter tout blocage au prochain clic
        setIdempotencyKey(crypto.randomUUID());
    }
  };

  // --- ÉCOULEMENT DES JUS DU PRESSOIR (Création des lots de moût) ---
  const validerEcoulement = async () => {
    const p = actionModal.press;
    setIsSubmitting(true);
    
    try {
      // 1. Préparation du payload pour l'API
      const payload = {
        pressoirId: p.id,
        parcelle: p.parcelle,
        cepage: p.cepage,
        cuvees: cuveeDests.filter(d => d.cuveId && parseToHl(d.vol) > 0).map(d => ({ containerId: parseInt(d.cuveId), volume: parseToHl(d.vol) })),
        tailles: tailleDests.filter(d => d.cuveId && parseToHl(d.vol) > 0).map(d => ({ containerId: parseInt(d.cuveId), volume: parseToHl(d.vol) })),
        rebeches: rebechesDests.filter(d => d.cuveId && parseToHl(d.vol) > 0).map(d => ({ containerId: parseInt(d.cuveId), volume: parseToHl(d.vol) })),
        operator: user?.name || "Système",
        idempotencyKey: idempotencyKey || crypto.randomUUID()
      };

      const res = await fetch('/api/pressings/ecoulement', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify(payload) 
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'écoulement en base de données.");

      // 2. SUCCÈS
      dispatch({ type: "TOAST_ADD", payload: { msg: "Jus écoulés, lots créés et pressoir vidé !", color: T.green } });
      
      setActionModal(null);
      if (refreshData) await refreshData();

    } catch(e: any) { 
      // 3. ECHEC : Remplacement du vieux alert()
      dispatch({ type: "TOAST_ADD", payload: { msg: `Erreur d'écoulement : ${e.message}`, color: T.red } });
    } finally {
      setIsSubmitting(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  const calculateFractions = (kg) => {
    const cuvee = (kg / 4000) * 20.5;
    const taille = (kg / 4000) * 5.0;
    const maxRebeches = (cuvee + taille) * 0.10; 
    return {
      cuvee: cuvee.toFixed(2), 
      taille: taille.toFixed(2), 
      rebeches: maxRebeches.toFixed(2) 
    };
  };

  const toggleCleaning = async (c) => {
    setIsSubmitting(true);
    const nextStatus = c.status === "NETTOYAGE" ? "VIDE" : "NETTOYAGE";
    try {
        await fetch(`/api/containers`, { method: 'PUT', headers: buildApiHeaders(user), body: JSON.stringify({ id: c.id, status: nextStatus }) });
        await fetch(`/api/containers`, { method: 'PUT', headers: buildApiHeaders(user), body: JSON.stringify({ id: c.id, status: nextStatus }) });
        if (refreshData) await refreshData();
    } catch(e){}
    finally { setIsSubmitting(false); }
  };

  const pressoirsActifs = pressoirs.filter(p => p.status !== "VIDE");
  const pressoirsArret = pressoirs.filter(p => p.status === "VIDE");
  
  const cuvesDebourbage = (state.containers || []).filter(c => c.status !== "ARCHIVÉE" && (c.type?.includes("Débourbage") || c.type?.includes("Belon") || c.displayName?.toLowerCase().includes("cuvée") || c.displayName?.toLowerCase().includes("taille")));
  
  const debourbageActifs = cuvesDebourbage.filter(c => (parseFloat(c.currentVolume || c.volume) || 0) > 0);
  const debourbageVides = cuvesDebourbage.filter(c => (parseFloat(c.currentVolume || c.volume) || 0) <= 0);

  const cuvesCuverie = (state.containers || []).filter(c => {
    if (c.status === "ARCHIVÉE") return false;
    const t = (c.type || "").toLowerCase();
    const n = ((c.displayName || c.name) || "").toLowerCase();
    
    if (t.includes("débourbage") || t.includes("belon")) return false;
    if (t.includes("bourbe") || t.includes("rebeche") || t.includes("rebêche") || t.includes("lies")) return false;
    if (n.includes("bourbe") || n.includes("rebeche") || n.includes("rebêche") || n.includes("lies")) return false;
    
    if (c.type === "CUVE_BOURBES" || c.type === "CUVE_LIES" || c.type === "CUVE_REBECHES") return false;

    return true;
  });

  const cuvesBourbes = (state.containers || []).filter(c => c.status !== "ARCHIVÉE" && (c.type === "CUVE_BOURBES" || c.type?.includes("Bourbe") || (c.displayName || c.name || "").toLowerCase().includes("bourbe")));
  const cuvesRebeches = (state.containers || []).filter(c => c.status !== "ARCHIVÉE" && (c.type === "CUVE_REBECHES" || c.type?.includes("Rebeche") || (c.displayName || c.name || "").toLowerCase().includes("rebêche") || (c.displayName || c.name || "").toLowerCase().includes("rebeche")));

  const renderDebourbageCard = (c) => {
    const nameToDisplay = c.displayName || c.name || "Sans nom";
    const isCuvee = c.type.includes("Cuvée") || nameToDisplay.toLowerCase().includes("cuvée");
    const currentVol = parseFloat(c.currentVolume || c.volume) || 0;
    const capacity = parseFloat(c.capacityValue || c.capacity) || 1; 
    
    const fillPct = Math.min(100, (currentVol / capacity) * 100);
    const isVide = currentVol <= 0;

    return (
      <div key={c.id} style={{ background: T.surfaceHigh, border: `1px solid ${c.status === "NETTOYAGE" ? T.blue : T.border}`, borderRadius: 4, padding: 16, display: "flex", flexDirection: "column", borderLeft: `3px solid ${c.status === "NETTOYAGE" ? T.blue : (isCuvee ? T.accent : T.textDim)}`, opacity: isVide && c.status !== "NETTOYAGE" ? 0.7 : 1, transition: "opacity 0.3s" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: "bold", color: T.textStrong, fontFamily: "monospace" }}>{nameToDisplay}</div>
            <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginTop: 4 }}>{c.type}</div>
          </div>
          {c.status === "NETTOYAGE" ? (
            <Badge label="NETTOYAGE" color={T.blue} />
          ) : (
            <Badge label={isCuvee ? "CUVÉE" : "TAILLE"} color={isCuvee ? T.accent : T.textDim} />
          )}
        </div>
        
        <div style={{ width: "100%", height: 4, background: T.border, borderRadius: 2, overflow: "hidden", marginBottom: 8 }}>
          <div style={{ width: `${fillPct}%`, height: "100%", background: isCuvee ? T.accent : T.textDim, transition: "width 0.5s ease" }} />
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ fontWeight: "bold", color: isVide ? T.textDim : T.textStrong }}>{currentVol.toFixed(2)} hL</span>
            <span style={{ color: T.textDim }}> / {capacity.toFixed(0)} hL</span>
          </div>
          
          <div style={{ display: "flex", gap: 6 }}>
            {isVide && (
              <Btn variant={c.status === "NETTOYAGE" ? "secondary" : "ghost"} disabled={isSubmitting} onClick={() => toggleCleaning(c)} style={{ padding: "4px 8px", fontSize: 10, color: c.status === "NETTOYAGE" ? T.text : T.textDim }}>
                {c.status === "NETTOYAGE" ? "✅ Propre" : "🧼 Laver"}
              </Btn>
            )}
            <Btn variant="secondary" style={{ padding: "4px 12px", fontSize: 11, borderColor: isVide ? T.border : T.accentLight, color: isVide ? T.textDim : T.textStrong, opacity: isVide ? 0.5 : 1 }} 
                 disabled={isVide || isSubmitting} onClick={() => { 
                   const autoClair = parseToHl(currentVol * 0.98); 
                   setTransferModal(c); 
                   setTransferDests([{ id: Date.now(), cuveId: "", vol: autoClair.toFixed(2) }]); 
                   setTransferOptions({ actionRest: "ENVOYER_BOURBES", bourbesDestId: "" });
                   setQuickDestIndex(null);
                 }}>
              SOUTIRER ↪
            </Btn>
          </div>
        </div>
      </div>
    );
  };

  const renderDestSection = (title, icon, color, dests, setDests, options, theoVol, defaultType, isHardLimit = false) => {
    const total = dests.reduce((sum, d) => sum + parseToHl(d.vol), 0);
    const isOverLimit = isHardLimit && total > (parseFloat(theoVol) + 0.05);

    return (
      <div style={{ background: T.surfaceHigh, border: `1px solid ${color}`, borderRadius: 6, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontSize: 16, fontWeight: "bold", color: color }}>{icon} {title}</div>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ fontSize: 14, fontWeight: "bold", fontFamily: "monospace", color: isOverLimit ? T.red : T.textStrong }}>
                Total réparti : {total.toFixed(2)} hL
              </div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: isOverLimit ? T.red : T.textDim, textAlign: "right", marginBottom: 16 }}>
          {isHardLimit ? "Maximum autorisé" : "Théorique attendu"} : {parseFloat(theoVol).toFixed(2)} hL
        </div>

        {dests.map((d, i) => {
           const targetCuve = options.find(c => String(c.id) === String(d.cuveId));
           const free = targetCuve ? Math.max(0, parseFloat(targetCuve.capacityValue || targetCuve.capacity || 0) - parseFloat(targetCuve.currentVolume || targetCuve.volume || 0)) : 0;
           const isOver = parseToHl(d.vol) > (free + 0.05);

           return (
             <div key={d.id} style={{ marginBottom: 12 }}>
               <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                 <div style={{ flex: 2 }}>
                   <Select value={d.cuveId} disabled={isSubmitting} onChange={e => {
                       const selectedCuveId = e.target.value;
                       const nd = [...dests]; 
                       nd[i] = { ...nd[i], cuveId: selectedCuveId }; 
                       
                       if (selectedCuveId) {
                           const tCuve = options.find(c => String(c.id) === String(selectedCuveId));
                           if (tCuve) {
                               const freeSpace = Math.max(0, parseFloat(tCuve.capacityValue || tCuve.capacity || 0) - parseFloat(tCuve.currentVolume || tCuve.volume || 0));
                               const safeSpace = freeSpace * 0.9; 
                               
                               const otherDestsVol = dests.filter((_, idx) => idx !== i).reduce((s, od) => s + parseToHl(od.vol), 0);
                               const remainingToDistribute = Math.max(0, parseFloat(theoVol) - otherDestsVol);
                               
                               const autoVol = Math.min(safeSpace, remainingToDistribute);
                               nd[i] = { ...nd[i], vol: autoVol > 0 ? autoVol.toFixed(2) : "" };
                           }
                       } else {
                           nd[i] = { ...nd[i], vol: "" };
                       }
                       setDests(nd);
                   }} style={{ borderColor: isOver ? T.red : T.border }}>
                      <option value="">-- Choisir cuve --</option>
                      {options.map(c => {
                         const dispo = Math.max(0, parseFloat(c.capacityValue || c.capacity || 0) - parseFloat(c.currentVolume || c.volume || 0));
                         const isAlreadySelected = dests.some((otherD, idx) => idx !== i && String(otherD.cuveId) === String(c.id));
                         return <option key={c.id} value={c.id} disabled={isAlreadySelected}>{c.displayName || c.name} (Dispo: {dispo.toFixed(2)} hL)</option>
                      })}
                   </Select>
                 </div>
                 <div style={{ flex: 1, display:"flex", gap:4 }}>
                   <Input type="number" step="0.1" value={d.vol} disabled={isSubmitting} onChange={e => {
                       const nd = [...dests]; 
                       nd[i] = { ...nd[i], vol: e.target.value }; 
                       setDests(nd);
                   }} placeholder="Vol." style={{ borderColor: isOver ? T.red : T.border }} />
                   <Btn variant="secondary" disabled={isSubmitting} onClick={() => {
                       const tCuve = options.find(c => String(c.id) === String(d.cuveId));
                       const freeSpace = tCuve ? Math.max(0, parseFloat(tCuve.capacityValue || tCuve.capacity || 0) - parseFloat(tCuve.currentVolume || tCuve.volume || 0)) : 0;
                       const safeSpace = freeSpace * 0.9;
                       const otherDests = dests.filter((_, idx) => idx !== i).reduce((s, od) => s + parseToHl(od.vol), 0);
                       const remTheo = Math.max(0, parseFloat(theoVol) - otherDests);
                       const maxVal = Math.min(remTheo, safeSpace);
                       if(maxVal > 0) {
                          const nd = [...dests]; 
                          nd[i] = { ...nd[i], vol: maxVal.toFixed(2) }; 
                          setDests(nd);
                       }
                   }}>MAX</Btn>
                 </div>
                 {dests.length > 1 && (
                   <Btn variant="ghost" disabled={isSubmitting} style={{color:T.red, padding:"0 8px"}} onClick={() => {
                      setDests(dests.filter((_, idx) => idx !== i));
                   }}>✕</Btn>
                 )}
               </div>
             </div>
           )
        })}
        <div style={{ marginTop: 8 }}>
           <Btn variant="secondary" disabled={isSubmitting} style={{ fontSize: 10, padding: "4px 8px" }} onClick={() => {
              setDests([...dests, { id: Date.now() + Math.random(), cuveId: "", vol: "" }]);
           }}>+ Éclater dans une autre cuve</Btn>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Vendanges & Pressoirs</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Du quai de réception jusqu'aux cuves de débourbage.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant={activeTab === "QUAI" ? "primary" : "secondary"} onClick={() => setActiveTab("QUAI")}>🍇 Quai de réception</Btn>
          <Btn variant={activeTab === "PRESSOIRS" ? "primary" : "secondary"} onClick={() => setActiveTab("PRESSOIRS")}>⚙️ Pressoirs</Btn>
          <Btn variant={activeTab === "DEBOURBAGE" ? "primary" : "secondary"} onClick={() => setActiveTab("DEBOURBAGE")}>💧 Débourbage</Btn>
        </div>
      </div>

      {activeTab === "QUAI" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.accent}50` }}>
            <h3 style={{ margin: "0 0 16px 0", color: T.accentLight, fontSize: 16 }}>Nouveaux raisins sur le quai</h3>
            <div style={{ display: "flex", gap: 16, alignItems: isCustomOrigin ? "flex-start" : "flex-end", flexWrap: "wrap" }}>
              {!isCustomOrigin ? (
                <FF label="Provenance (Parcelle ou Autre)" style={{ flex: 1, minWidth: 200 }}>
                  <Select value={newApport.parcelle} disabled={isSubmitting} onChange={(e) => {
                    if (e.target.value === "CUSTOM") setIsCustomOrigin(true);
                    else setNewApport({...newApport, parcelle: e.target.value});
                  }}>
                    <option value="">-- Sélectionner --</option>
                    {(state.parcelles || []).map(p => <option key={p.id} value={p.nom}>{p.nom}</option>)}
                    <option value="CUSTOM" style={{ fontWeight: "bold", color: T.accent }}>+ Autre origine (Négoce, Achat...)</option>
                  </Select>
                </FF>
              ) : (
                <div style={{ background: T.bg, padding: 14, borderRadius: 6, border: `1px solid ${T.accent}50`, flex: 1, minWidth: 300 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: "bold", color: T.accentLight }}>📍 Origine sur-mesure (Négoce, Achat...)</div>
                    <button onClick={() => setIsCustomOrigin(false)} disabled={isSubmitting} style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 12 }}>✕ Annuler</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                    <Select value={customDep} disabled={isSubmitting} onChange={e => { setCustomDep(e.target.value); setCustomReg(""); setCustomCom(""); }}>
                      <option value="">Département</option>
                      {depts.map(d => <option key={d}>{d}</option>)}
                    </Select>
                    <Select value={customReg} disabled={!customDep || isSubmitting} onChange={e => { setCustomReg(e.target.value); setCustomCom(""); }}>
                      <option value="">Région / Sous-région</option>
                      {regions.map(r => <option key={r}>{r}</option>)}
                    </Select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <Select value={customCom} disabled={!customReg || isSubmitting} onChange={e => setCustomCom(e.target.value)}>
                      <option value="">Commune</option>
                      {communes.map(c => <option key={c}>{c}</option>)}
                    </Select>
                    <Input value={customNom} disabled={isSubmitting} onChange={e=>setCustomNom(e.target.value)} placeholder="Nom du Vendeur ou Lieu-dit" />
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                <FF label="Cépage" style={{ width: 140 }}>
                  <Select value={newApport.cepage} disabled={isSubmitting} onChange={(e) => setNewApport({...newApport, cepage: e.target.value})}>
                    <option value="CH">Chardonnay</option><option value="PN">Pinot Noir</option><option value="PM">Meunier</option><option value="PBL">Pinot Blanc</option><option value="ARB">Arbane</option><option value="PMES">Petit Meslier</option><option value="PG">Pinot Gris</option><option value="VOLTIS">Voltis</option>
                  </Select>
                </FF>
                <FF label="Poids (kg)" style={{ width: 120 }}>
                  <Input type="text" value={newApport.poids} disabled={isSubmitting} onChange={(e) => setNewApport({...newApport, poids: e.target.value})} placeholder="Ex: 4000" />
                </FF>
                <Btn onClick={handleAddApport} disabled={isSubmitting} style={{ height: 38 }}>{isSubmitting ? "..." : "+ Ajouter l'apport"}</Btn>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ margin: "0 0 16px 0", color: T.textStrong, fontSize: 16 }}>Raisins en attente de pressurage ({apportsEnAttente.length})</h3>
            {apportsEnAttente.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>Le quai est vide. Aucun raisin en attente.</div>
            ) : (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 150px 40px", padding: "12px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 11, color: T.textDim, textTransform: "uppercase" }}>
                  <div>Provenance</div><div>Cépage</div><div>Poids restant</div><div>Vol. Estimé</div><div>Statut</div><div></div>
                </div>
                {apportsEnAttente.map(a => {
                  const volEstime = calculateFractions(a.weight || a.poids || 0);
                  const totalEstime = (Number(volEstime.cuvee) + Number(volEstime.taille)).toFixed(2);
                  return (
                    <div key={a.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 150px 40px", padding: "12px 20px", alignItems: "center", borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ fontWeight: "bold", color: T.textStrong }}>{a.cru || a.parcelle || "Inconnue"}</div>
                      <div style={{ color: T.text }}>{a.cepage}</div>
                      <div style={{ fontWeight: "bold", color: T.accentLight }}>{a.weight || a.poids} kg</div>
                      <div style={{ color: T.textDim }}>~ {totalEstime} hL</div>
                      <div><Badge label="En attente" color={T.accent} /></div>
                      <div style={{ textAlign: "right" }}>
                        {isChef && <button onClick={() => setApportToDelete(a)} disabled={isSubmitting} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.7 }} title="Supprimer cet apport">🗑️</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "PRESSOIRS" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          <div style={{ display: "flex", justifyContent: "flex-end" }}><Btn onClick={() => setShowAddPress(true)} disabled={isSubmitting}>+ Ajouter un pressoir</Btn></div>
          <div>
            <h3 style={{ margin: "0 0 16px 0", color: T.accentLight, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>Pressoirs en activité ({pressoirsActifs.length})</h3>
            {pressoirsActifs.length === 0 ? (
              <div style={{ padding:"30px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucune machine en route.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
                {pressoirsActifs.map(p => {
                  const isPret = p.status === "PRET_ECOULAGE";
                  const fillPct = ((p.loadKg || 0) / p.capacite) * 100;
                  
                  return (
                    <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.accent}`, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                      <div style={{ padding: "16px 20px", background: T.accent+"15", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div><div style={{ fontSize: 18, fontWeight: "bold", color: T.textStrong, fontFamily: "monospace" }}>{p.nom}</div><div style={{ fontSize: 11, color: T.textDim }}>{p.type} • {p.capacite} kg max</div></div>
                        <Badge label={isPret ? "PRÊT (ÉCOULAGE)" : "PRESSURAGE"} color={isPret ? T.green : T.accent} />
                      </div>
                      
                      <div style={{ width: "100%", height: 4, background: T.border }}>
                         <div style={{ width: `${Math.min(100, fillPct)}%`, height: "100%", background: fillPct > 110 ? T.red : (fillPct < 90 ? "#e6a15c" : T.green) }} />
                      </div>

                      <div style={{ padding: 20, flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
                        <div style={{ background: T.surfaceHigh, padding: 16, borderRadius: 6, border: `1px dashed ${T.border}` }}>
                          
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                            <span>Lot en cours</span>
                            {p.startTime && <span style={{color: T.accent}}>⏳ Démarré à {new Date(p.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: 14 }}>
                            <span>{p.parcelle} <span style={{ color: T.accent }}>({p.cepage})</span></span>
                            <span style={{ color: fillPct > 110 ? T.red : T.textStrong }}>{p.loadKg} kg</span>
                          </div>
                          
                          {fillPct < 90 && <div style={{ fontSize: 10, color: "#e6a15c", marginTop: 4 }}>⚠️ Sous-chargé ({(p.capacite - p.loadKg).toFixed(0)} kg manquants)</div>}
                          {fillPct > 110 && <div style={{ fontSize: 10, color: T.red, marginTop: 4, fontWeight: "bold" }}>⚠️ Surcharge ({p.loadKg - p.capacite} kg en trop)</div>}

                          {!isPret && (
                            <div style={{ marginTop: 20 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.textDim, marginBottom: 4 }}>
                                <span>Cycle en cours...</span>
                                
                                <div style={{ display: "flex", gap: 8 }}>
                                  <button disabled={isSubmitting} style={{ background:"none", border:"none", color: T.accentLight, fontWeight: "bold", cursor: isSubmitting ? "default" : "pointer" }} onClick={() => {
                                      setActionModal({ type: "LOAD", press: p });
                                      setSelectedApport("");
                                      setLoadWeight(""); 
                                  }}>
                                    [📥 Compléter]
                                  </button>
                                  <button disabled={isSubmitting} style={{ background:"none", border:"none", color: T.accent, fontWeight: "bold", cursor: isSubmitting ? "default" : "pointer" }} onClick={() => updatePressStatus(p.id, "PRET_ECOULAGE", { loadKg: p.loadKg, parcelle: p.parcelle, cepage: p.cepage, startTime: p.startTime })}>
                                    [Forcer Fin ⏭️]
                                  </button>
                                </div>
                              </div>
                              <div style={{ width: "100%", height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}><div style={{ width: "60%", height: "100%", background: T.accent, animation: "pulse 2s infinite" }} /></div>
                            </div>
                          )}
                        </div>
                        {isPret && (<Btn style={{ width: "100%", background: T.green, borderColor: T.green }} disabled={isSubmitting} onClick={() => {
                          setActionModal({ type: "ECOULEMENT", press: p });
                        }}>🍷 Fractionner & Écouler</Btn>)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ margin: "0 0 16px 0", color: T.textDim, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>Pressoirs à l'arrêt ({pressoirsArret.length})</h3>
            {pressoirsArret.length === 0 ? (
              <div style={{ padding:"30px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucune machine disponible.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
                {pressoirsArret.map(p => (
                  <div key={p.id} style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", opacity: 0.8 }}>
                    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><div style={{ fontSize: 18, fontWeight: "bold", color: T.textStrong, fontFamily: "monospace" }}>{p.nom}</div><div style={{ fontSize: 11, color: T.textDim }}>{p.type} • {p.capacite} kg max</div></div>
                      <Badge label="VIDE" color={T.textDim} />
                    </div>
                    <div style={{ padding: 20, textAlign: "center", color: T.textDim, fontSize: 13 }}>
                      <Btn disabled={isSubmitting || apportsEnAttente.length === 0} onClick={() => { 
                        setActionModal({ type: "LOAD", press: p }); 
                        setSelectedApport(""); 
                        setLoadWeight("");
                      }} style={{ width: "100%" }}>📥 Démarrer cycle (Nouveau Marc)</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "DEBOURBAGE" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: T.textDim, fontSize: 14 }}>Transférez les jus débourbés vers la cuverie de fermentation ou les bourbes vers le stockage.</div>
            <Btn onClick={() => {
                setNewCuve({ name: "", type: "Débourbage Cuvée", capacityValue: "" });
                setShowAddCuve(true);
            }}>+ Ajouter un Belon</Btn>
          </div>
          
          {cuvesDebourbage.length === 0 ? (
            <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>Aucune cuve de débourbage configurée.</div>
          ) : (
            <div>
              {debourbageActifs.length > 0 && (
                <div style={{ marginBottom: 32 }}>
                  <h3 style={{ margin: "0 0 16px 0", color: T.accentLight, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>Belons en activité ({debourbageActifs.length})</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                    {debourbageActifs.map(renderDebourbageCard)}
                  </div>
                </div>
              )}
              
              {debourbageVides.length > 0 && (
                <div>
                  <h3 style={{ margin: "0 0 16px 0", color: T.textDim, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>Belons vides ({debourbageVides.length})</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                    {debourbageVides.map(renderDebourbageCard)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- MODALES --- */}

      {actionModal?.type === "LOAD" && actionModal.press && (
        <Modal title={`Charger : ${actionModal.press.nom}`} onClose={() => setActionModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
            <FF label="Lot de raisins à charger">
              <Select value={selectedApport} disabled={isSubmitting} onChange={e => setSelectedApport(e.target.value)}>
                <option value="">-- Sélectionner un apport sur le quai --</option>
                {apportsEnAttente.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.cru || a.parcelle} ({a.cepage}) - Reste: {a.weight || a.poids} kg
                  </option>
                ))}
              </Select>
            </FF>
            <FF label="Poids à charger (kg)">
              <Input
                type="number"
                disabled={isSubmitting}
                value={loadWeight}
                onChange={e => setLoadWeight(e.target.value)}
                placeholder={`Ex: ${actionModal.press.capacite}`}
              />
            </FF>
            <div style={{ fontSize: 11, color: T.textDim }}>
              Capacité max du pressoir : {actionModal.press.capacite} kg
            </div>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={() => setActionModal(null)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={() => handleLoadSubmit(false, false)} disabled={!selectedApport || !loadWeight || isSubmitting}>
              {isSubmitting ? "Chargement..." : "Charger le pressoir"}
            </Btn>
          </div>
        </Modal>
      )}

      {/* 👇 MODALE : ALERTE DE MÉLANGE 👇 */}
      {mixWarning && (
        <Modal title="⚠️ Mélange de cépages détecté" onClose={() => setMixWarning(null)}>
          <div style={{ padding: "10px 0 20px 0", color: T.text, lineHeight: 1.5, fontSize: 14 }}>
            Le pressoir contient actuellement du <strong>{mixWarning.press.cepage}</strong>.<br/><br/>
            Vous vous apprêtez à y ajouter <strong>{mixWarning.weightToLoad} kg de {mixWarning.apport.cepage}</strong>.<br/><br/>
            Le système conservera l'identité du cépage majoritaire, mais gardera la trace exacte de ce mélange dans la provenance du lot.<br/>
            Voulez-vous vraiment procéder à ce mélange ?
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setMixWarning(null)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={() => {
              setMixWarning(null);
              handleLoadSubmit(false, true); // Force Mix = True
            }} disabled={isSubmitting} style={{ background: T.red, borderColor: T.red, color: "#fff" }}>
              Forcer l'assemblage
            </Btn>
          </div>
        </Modal>
      )}

      {loadWarning && (
        <Modal title={loadWarning.type === 'UNDER' ? "⚠️ Sous-charge détectée" : "🚨 Surcharge détectée"} onClose={() => setLoadWarning(null)}>
          <div style={{ padding: "10px 0 20px 0", color: T.text, lineHeight: 1.5, fontSize: 14 }}>
            {loadWarning.type === 'UNDER' ? (
              <>
                Le pressoir ne sera rempli qu'à <strong>{loadWarning.fillPct.toFixed(1)}%</strong> ({loadWarning.totalLoad} kg sur {actionModal.press.capacite} kg max).<br/><br/>
                Il vous manque <strong>{loadWarning.missing.toFixed(0)} kg</strong> pour atteindre la pleine capacité de la machine.<br/>
                Voulez-vous vraiment lancer le cycle tel quel ?
              </>
            ) : (
              <>
                Vous dépassez la capacité de la machine (<strong>{loadWarning.totalLoad} kg</strong> pour {actionModal.press.capacite} kg autorisés).<br/><br/>
                Vous avez <strong>{loadWarning.excess.toFixed(0)} kg en trop</strong>. Cela peut entraîner une casse mécanique ou une extraction excessive.<br/>
                Voulez-vous forcer le chargement ?
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="secondary" onClick={() => setLoadWarning(null)} disabled={isSubmitting}>Annuler et modifier</Btn>
            <Btn onClick={() => handleLoadSubmit(true, loadWarning.forceMix)} disabled={isSubmitting} style={{ background: loadWarning.type === 'OVER' ? T.red : T.accent, borderColor: loadWarning.type === 'OVER' ? T.red : T.accent, color: "#fff" }}>
              {isSubmitting ? "Traitement..." : (loadWarning.type === 'OVER' ? "Forcer la surcharge" : "Lancer en sous-charge")}
            </Btn>
          </div>
        </Modal>
      )}

      {/* --- MODALE D'ÉCOULEMENT (LA PLUS IMPORTANTE) --- */}
      {actionModal?.type === "ECOULEMENT" && actionModal.press && (() => {
        const cuvesCuvee = cuvesDebourbage.filter(c => c.type.includes("Cuvée") || (c.displayName || c.name || "").toLowerCase().includes("cuvée"));
        const cuvesTaille = cuvesDebourbage.filter(c => c.type.includes("Taille") || (c.displayName || c.name || "").toLowerCase().includes("taille"));
        const calcVol = calculateFractions(actionModal.press.loadKg); 

        const isDestInvalid = (dests, options) => dests.some(d => {
            const v = parseToHl(d.vol); 
            if (v > 0 && !d.cuveId) return true;
            if (d.cuveId && v <= 0) return true;
            if (d.cuveId && v > 0) {
                const targetCuve = options.find(c => String(c.id) === String(d.cuveId));
                const free = targetCuve ? Math.max(0, parseFloat(targetCuve.capacityValue || targetCuve.capacity || 0) - parseFloat(targetCuve.currentVolume || targetCuve.volume || 0)) : 0;
                if (v > free) return true;
            }
            return false;
        });

        const totalC = cuveeDests.reduce((s,d)=>parseToHl(s+parseToHl(d.vol)),0); 
        const totalT = tailleDests.reduce((s,d)=>parseToHl(s+parseToHl(d.vol)),0); 
        const totalR = rebechesDests.reduce((s,d)=>parseToHl(s+parseToHl(d.vol)),0); 

        const hasErrors =
           isDestInvalid(cuveeDests, cuvesCuvee) ||
           isDestInvalid(tailleDests, cuvesTaille) ||
           isDestInvalid(rebechesDests, cuvesRebeches) ||
           totalC <= 0 ||
           totalT <= 0 ||
           totalR > parseToHl(calcVol.rebeches);

        return (
          <Modal title={`Fractionnement : ${actionModal.press.nom}`} onClose={() => setActionModal(null)} wide={true}>
            <div style={{ width: "100%" }}>
              <div style={{ fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                Le pressurage de <strong>{actionModal.press.loadKg} kg</strong> de <strong>{actionModal.press.parcelle} ({actionModal.press.cepage})</strong> est terminé.<br/>
                Ajustez les volumes et répartissez les jus dans un ou plusieurs Belons.
              </div>

              <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
                {renderDestSection("Cuvée", "🥇", T.accentLight, cuveeDests, setCuveeDests, cuvesCuvee, calcVol.cuvee, "Débourbage Cuvée")}
                {renderDestSection("Taille", "🥈", T.textStrong, tailleDests, setTailleDests, cuvesTaille, calcVol.taille, "Débourbage Taille")}
                {renderDestSection("Rebêches (0 à 10%)", "🥉", T.red, rebechesDests, setRebechesDests, cuvesRebeches, calcVol.rebeches, "CUVE_REBECHES", true)}
              </div>

              <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
                <Btn variant="secondary" onClick={() => setActionModal(null)} disabled={isSubmitting}>Annuler</Btn>
                <Btn onClick={validerEcoulement} disabled={hasErrors || isSubmitting}>
                  {isSubmitting ? "Sauvegarde en cours..." : "Valider et vider la machine"}
                </Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* --- MODALES ANNEXES --- */}
      {apportToDelete && (
        <Modal title="Supprimer cet apport" onClose={() => setApportToDelete(null)}>
          <div style={{ fontSize: 14, color: T.text, marginBottom: 24 }}>
            Êtes-vous sûr de vouloir supprimer l'apport de <strong>{apportToDelete.weight || apportToDelete.poids} kg</strong> ?<br/><br/>Cette action effacera l'enregistrement.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={() => setApportToDelete(null)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={confirmDeleteApport} disabled={isSubmitting} style={{ background: T.red, borderColor: T.red, color: "#fff" }}>{isSubmitting ? "Suppression..." : "🗑️ Supprimer définitivement"}</Btn>
          </div>
        </Modal>
      )}

      {showAddPress && (
        <Modal title="Ajouter un pressoir" onClose={() => setShowAddPress(false)}>
          <div style={{ display: "grid", gap: 16, marginBottom: 24 }}>
            <FF label="Nom du pressoir"><Input disabled={isSubmitting} value={newPress.nom} onChange={(e) => setNewPress({...newPress, nom: e.target.value})} placeholder="Ex: Pressoir 1" /></FF>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <FF label="Type">
                <Select disabled={isSubmitting} value={newPress.type} onChange={(e) => setNewPress({...newPress, type: e.target.value})}>
                  <option>Pneumatique</option><option>Traditionnel (Maie fixe)</option><option>Hydraulique (Maie tournante)</option><option>Mécanique (Plateaux)</option>
                </Select>
              </FF>
              <FF label="Constructeur"><Input disabled={isSubmitting} value={newPress.marque} onChange={(e) => setNewPress({...newPress, marque: e.target.value})} placeholder="Ex: Bücher..." /></FF>
            </div>
            <FF label="Capacité (Marc)">
              <Select disabled={isSubmitting} value={newPress.capacite} onChange={(e) => setNewPress({...newPress, capacite: Number(e.target.value)})}>
                <option value={2000}>2 000 kg</option><option value={4000}>4 000 kg</option><option value={6000}>6 000 kg</option><option value={8000}>8 000 kg</option><option value={12000}>12 000 kg</option>
              </Select>
            </FF>
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={() => setShowAddPress(false)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={handleAddPress} disabled={isSubmitting}>{isSubmitting ? "Enregistrement..." : "Enregistrer"}</Btn>
          </div>
        </Modal>
      )}

      {/* --- MODALE DE SOUTIRAGE DEBOURBAGE --- */}
      {/* On réutilise la modale TransferModal existante mais en la bindant correctement */}
      {transferModal && <TransferModal container={transferModal} onClose={() => setTransferModal(null)} />}
    </div>
  );
}

// =============================================================================
// MODALS ACTIONS CUVE (SÉCURISÉES)
// =============================================================================
function CorrectVolumeModal({ container, lot, onClose }) {
  const T = useTheme(); 
  const { dispatch, refreshData } = useStore(); 
  const { user } = useAuth();
  
  const [vol, setVol] = useState(lot.currentVolume || lot.volume); 
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/lots/volume', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ lotId: lot.id, newVolume: parseFloat(vol), operator: user.name, note, idempotencyKey }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur serveur");
      
      dispatch({ type: "TOAST_ADD", payload: { msg: `Volume corrigé à ${vol} hL`, color: "#2d6640" } }); 
      if (refreshData) await refreshData();
      onClose();
    } catch(e) {
      alert("Erreur : " + e.message);
      setIdempotencyKey(crypto.randomUUID()); // 👈 NOUVELLE CLÉ GÉNÉRÉE EN CAS D'ERREUR
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Corriger le volume" onClose={onClose}>
      <div style={{ marginBottom:14, fontSize:12, fontFamily:"monospace", padding:"8px 12px", background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:3 }}>
        Volume actuel : <strong style={{ color:T.accent }}>{lot.currentVolume || lot.volume} hL</strong>
      </div>
      <FF label="Nouveau volume (hL)">
        <Input type="number" step="0.1" value={vol} onChange={e => setVol(e.target.value)} disabled={isSubmitting} />
      </FF>
      <FF label="Raison">
        <Input placeholder="Ex: Ouillage..." value={note} onChange={e => setNote(e.target.value)} disabled={isSubmitting} />
      </FF>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !vol}>{isSubmitting ? "Enregistrement..." : "Valider"}</Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODALE D'OPÉRATIONS / INTRANTS (SÉCURISÉE)
// =============================================================================
function AddIntrantModal({ container, lot, onClose }) {
  const T = useTheme(); 
  const { dispatch, refreshData, state } = useStore(); 
  const { user } = useAuth();
  
  const [intrant, setIntrant] = useState("Ouillage"); 
  const [qty, setQty] = useState("1"); 
  const [unit, setUnit] = useState("opération");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Analyse historique pour interface
  const lotEvents = (state.events || []).filter(e => String(e.lotId) === String(lot.id) && (e.type === "INTRANT" || e.eventType === "INTRANT"));
  const hasChaptalise = lotEvents.some(e => (e.note || e.comment)?.toLowerCase().includes("sucre") || (e.note || e.comment)?.toLowerCase().includes("chaptalisation"));
  const hasAcidifie = lotEvents.some(e => (e.note || e.comment)?.toLowerCase().includes("acide") || (e.note || e.comment)?.toLowerCase().includes("acidification"));

  const isSelectingSucre = intrant === "Chaptalisation (Sucre)";
  const isSelectingAcide = intrant === "Acidification";
  const isBlockedAOC = (isSelectingSucre && hasAcidifie) || (isSelectingAcide && hasChaptalise);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/lots/intrants', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ lotId: lot.id, intrant, quantity: parseFloat(qty), unit, operator: user.name, idempotencyKey }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur serveur");
      const data = await res.json();

      if (data.autoStatusUpdate) {
        dispatch({ type: "TOAST_ADD", payload: { msg: "Levurage OK. Le lot a automatiquement basculé en Fermentation Alcoolique !", color: T.accent } });
      } else {
        dispatch({ type: "TOAST_ADD", payload: { msg: "Opération enregistrée", color: "#2d6640" } }); 
      }

      if (refreshData) await refreshData();
      onClose(); 
    } catch(e) {
      alert("Erreur : " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Opération / Intrant" onClose={onClose}>
      <div style={{ marginBottom: 16 }}>
        <FF label="Type d'opération">
          <Select value={intrant} onChange={e => setIntrant(e.target.value)} style={{ borderColor: isBlockedAOC ? T.red : T.border }} disabled={isSubmitting}>
            <optgroup label="Opérations Œnologiques">
              <option value="Ouillage">Ouillage</option>
              <option value="Filtration">Filtration</option>
              <option value="Stabilisation Tartrique">Stabilisation Tartrique</option>
            </optgroup>
            <optgroup label="Ajout de Produits (Intrants)">
              <option value="SO2 (Solution)">SO2 (Solution)</option>
              <option value="SO2 (Poudre)">SO2 (Poudre)</option>
              <option value="Levures LSA">Levures LSA</option>
              <option value="Bentonite">Bentonite</option>
              <option value="Chaptalisation (Sucre)">Chaptalisation (Sucre)</option>
              <option value="Acidification">Acidification (Acides)</option>
              <option value="Nutriments">Nutriments</option>
            </optgroup>
          </Select>
        </FF>
        
        {isBlockedAOC && (
          <div style={{ background:T.red+"15", border:`1px solid ${T.red}44`, padding:10, borderRadius:4, marginTop:8, color:T.red, fontSize:11, fontWeight:"bold" }}>
            🚨 Interdiction AOC : Ce lot a déjà subi une {hasAcidifie ? "acidification" : "chaptalisation"}. Cumuler les deux opérations est interdit.
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
        <FF label="Quantité">
          <Input type="number" step="0.1" value={qty} onChange={e => setQty(e.target.value)} disabled={isBlockedAOC || isSubmitting} />
        </FF>
        <FF label="Unité">
          <Select value={unit} onChange={e => setUnit(e.target.value)} disabled={isBlockedAOC || isSubmitting}>
            {["opération", "g", "kg", "mL", "cL", "L", "g/hL", "mL/hL"].map(u => <option key={u}>{u}</option>)}
          </Select>
        </FF>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={!qty || isBlockedAOC || isSubmitting}>{isSubmitting ? "Enregistrement..." : "Enregistrer"}</Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODALE AJOUT CONTENANT (SÉCURISÉE)
// =============================================================================
function AddContainerModal({ onClose, onSuccess, initialCapacity = "", initialType = "CUVE_INOX" }) {
  const T = useTheme(); 
  const { dispatch, refreshData } = useStore();
  
  const [form, setForm] = useState({ name:"", type: initialType, customType:"", capacity:initialCapacity, zone:"", notes:"", status:"VIDE" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const isDebourbage = form.type.includes("DEBOURBAGE");
  
  const handleCapacityChange = (e) => {
    let val = e.target.value;
    if (isDebourbage && parseFloat(val) > 200) val = "200";
    setForm({ ...form, capacity: val });
  };

  useEffect(() => {
    if (isDebourbage && parseFloat(form.capacity) > 200) {
      setForm(f => ({ ...f, capacity: "200" }));
    }
  }, [form.type, isDebourbage, form.capacity]);

  const submit = async () => {
    const finalType = form.type === "AUTRE" && form.customType 
      ? form.customType.toUpperCase().replace(/\s+/g, "_") 
      : form.type;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/containers', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ ...form, type: finalType, capacity: parseFloat(form.capacity), idempotencyKey }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur serveur");
      const dbC = await res.json(); 
      
      dispatch({ type:"TOAST_ADD", payload:{ msg:`${form.name} ajouté`, color:"#2d6640" } }); 
      if (refreshData) await refreshData();
      if (onSuccess) onSuccess(dbC.id.toString()); else onClose(); 
    } catch (e) {
      alert("Erreur : " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Ajouter contenant" onClose={onClose}>
      <FF label="Nom affiché">
        <Input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="Ex: Cuve Inox 1" disabled={isSubmitting} />
      </FF>
      <FF label="Type">
        <Select value={form.type} onChange={e => setForm({...form, type:e.target.value})} disabled={isSubmitting}>
          {CONTAINER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g," ")}</option>)}
        </Select>
      </FF>
      {form.type === "AUTRE" && (
        <FF label="Précisez le type (ex: AMPHORE)">
          <Input value={form.customType || ""} onChange={e => setForm({...form, customType:e.target.value})} placeholder="AMPHORE..." disabled={isSubmitting} />
        </FF>
      )}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
         <FF label="Capacité en hL">
           <Input 
             type="number" step="0.1" 
             value={form.capacity} 
             onChange={handleCapacityChange} 
             style={{ borderColor: isDebourbage && parseFloat(form.capacity) === 200 ? T.red : T.border }} 
             disabled={isSubmitting}
           />
           {isDebourbage && <div style={{ fontSize: 10, color: T.red, marginTop: 4, fontWeight: "bold" }}>⚠️ Limite AOC : 200 hL max</div>}
         </FF>
         <FF label="Zone">
           <Input value={form.zone} onChange={e => setForm({...form, zone:e.target.value})} disabled={isSubmitting} />
         </FF>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !form.name || !form.capacity || (form.type === "AUTRE" && !form.customType)}>{isSubmitting ? "Création..." : "Créer"}</Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODALE AJOUT COMPARTIMENT CITERNE
// =============================================================================
function AddCompartmentModal({ container, onClose }) {
  const T = useTheme();
  const { dispatch, refreshData } = useStore();
  const [cap, setCap] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const submit = async () => {
    const parsedCap = parseFloat(cap);
    if (!parsedCap || parsedCap <= 0) return alert("Veuillez entrer une capacité valide.");

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/containers/compartment', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ originalContainerId: container.id, newCapacity: parsedCap, idempotencyKey })
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erreur serveur");
      
      dispatch({ type: "TOAST_ADD", payload: { msg: "Compartiment créé !", color: T.green } });
      if (refreshData) await refreshData();
      onClose();
    } catch(e) { 
      alert("Erreur : " + e.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Ajouter un compartiment`} onClose={onClose}>
      <div style={{ background: T.surfaceHigh, padding: 14, borderRadius: 4, marginBottom: 16, border: `1px solid ${T.border}` }}>
        <div style={{ color: T.text, fontSize: 12, lineHeight: 1.5 }}>
          La capacité de <strong>{container.displayName || container.name.split(" - Comp ")[0]}</strong> va augmenter.
        </div>
      </div>
      <FF label={`Capacité du NOUVEAU compartiment (hL)`}>
        <Input type="number" step="0.1" value={cap} onChange={e => setCap(e.target.value)} placeholder={`Ex: 25`} disabled={isSubmitting} />
      </FF>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !cap || parseFloat(cap) <= 0}>{isSubmitting ? "Création..." : "Créer le compartiment"}</Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODALE DE TRANSFERT / SOUTIRAGE (UNIFIÉE EN BACKEND)
// =============================================================================
function TransferModal({ container, onClose }) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore(); 
  const { user } = useAuth();
  
  const [dests, setDests] = useState([{ id: Date.now(), toId: "", vol: "", filterZone: "", filterCat: "", filterType: "" }]);
  const [remType, setRemType] = useState(""); 
  const [showAdd, setShowAdd] = useState(false);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [ph, setPh] = useState("");
  const [at, setAt] = useState("");
  const [tavp, setTavp] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const isAdmin = user?.role === "Admin" || user?.role === "Chef de cave";
  
  const lotToTransfer = (state.lots || []).find(l => String(l.id) === String(container.lotId || container.currentLots?.[0]?.id));
  const isSoutirageDebourbage = container.type === "CUVE_DEBOURBAGE" && lotToTransfer?.status === "MOUT_NON_DEBOURBE";
  const isMustTransfer = lotToTransfer?.status?.includes("MOUT") || lotToTransfer?.status?.includes("FERMENTATION");

  const GROUPS = {
    CUVES: ["CUVE_INOX", "CUVE_BETON", "CUVE_EMAIL", "CUVE_FIBRE", "CUVE_PLASTIQUE", "CUVE_BOURBES", "CUVE_LIES"],
    BOIS: ["BARRIQUE", "FOUDRE"]
  };

  const baseAvailTargets = (state.containers || []).filter(c => 
    String(c.id) !== String(container.id) && 
    c.status !== "ARCHIVÉE" && 
    (c.currentVolume || 0) < (c.capacityValue || c.capacity || 0)
  );
  
  const uniqueZones = [...new Set(baseAvailTargets.map(c => c.zone).filter(Boolean))].sort();

  const sourceVol = Number((container.currentVolume || 0).toFixed(2));
  const totalVol = Number(dests.reduce((sum, d) => sum + (parseFloat(d.vol) || 0), 0).toFixed(2));
  
  const isVolValid = totalVol > 0 && totalVol <= sourceVol;
  const isPartial = totalVol > 0 && totalVol < sourceVol;

  const hasCapacityIssue = dests.some(d => {
    if (!d.toId || !d.vol) return false;
    const targetCuve = baseAvailTargets.find(c => String(c.id) === String(d.toId));
    if (!targetCuve) return true;
    const targetCap = targetCuve.capacityValue || targetCuve.capacity || 0;
    const targetCur = targetCuve.currentVolume || 0;
    const free = Number((targetCap - targetCur).toFixed(2));
    return Number(parseFloat(d.vol).toFixed(2)) > free;
  });

  const hasCepageMismatch = dests.some(d => {
    if (!d.toId || !isMustTransfer) return false;
    const targetCuve = baseAvailTargets.find(c => String(c.id) === String(d.toId));
    if (!targetCuve || targetCuve.currentVolume <= 0) return false; 
    const targetLot = (state.lots || []).find(l => String(l.currentContainerId || l.containerId) === String(targetCuve.id));
    if (!targetLot) return false;
    return (targetLot.mainGrapeCode || targetLot.cepage) !== "MULTI" && (targetLot.mainGrapeCode || targetLot.cepage) !== (lotToTransfer?.mainGrapeCode || lotToTransfer?.cepage);
  });

  const updateDest = (id, field, value) => {
    if (["filterZone", "filterCat", "filterType"].includes(field)) {
      setDests(dests.map(d => d.id === id ? { ...d, [field]: value, toId: "" } : d));
    } else {
      setDests(dests.map(d => d.id === id ? { ...d, [field]: value } : d));
    }
  };

  const handleMax = (destId) => {
    const otherDestsVol = dests.filter(d => d.id !== destId).reduce((sum, d) => sum + (parseFloat(d.vol) || 0), 0);
    const availableFromSource = Math.max(0, sourceVol - otherDestsVol);
    const dest = dests.find(d => d.id === destId);
    const targetCuve = baseAvailTargets.find(c => String(c.id) === String(dest.toId));
    const targetCap = targetCuve ? (targetCuve.capacityValue || targetCuve.capacity || 0) : Infinity;
    const targetCur = targetCuve ? (targetCuve.currentVolume || 0) : 0;
    const freeSpaceTarget = Math.max(0, targetCap - targetCur);
    const maxVal = Math.min(availableFromSource, freeSpaceTarget);
    updateDest(destId, "vol", maxVal > 0 ? Number(maxVal.toFixed(2)).toString() : ""); 
  };

  const submit = async () => {
    if (hasCapacityIssue || hasCepageMismatch || !lotToTransfer) return;

    setIsSubmitting(true);
    const isoDate = transferDate ? new Date(transferDate).toISOString() : new Date().toISOString();
    
    try {
      // API UNIFIÉE ! Tout se passe en backend en 1 seule transaction
      const res = await fetch('/api/transfers', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          lotId: lotToTransfer.id, 
          fromId: container.id, 
          destinations: dests.map(d => ({ toId: parseInt(d.toId), volume: Number(parseFloat(d.vol).toFixed(2)) })), 
          volume: totalVol,
          operator: user.name, 
          remainderType: isPartial ? remType : null, 
          date: isoDate,
          ph: ph ? parseFloat(ph) : null,
          at: at ? parseFloat(at) : null,
          tavp: tavp ? parseFloat(tavp) : null,
          idempotencyKey
        }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de transfert");
      
      dispatch({ type:"TOAST_ADD", payload:{ msg:`Transfert éclaté validé`, color:"#2d6640" } }); 
      if (refreshData) await refreshData();
      onClose(); 
    } catch(e) {
      alert("Erreur : " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showAdd) {
    return (
      <AddContainerModal 
        initialCapacity="50"
        onClose={() => setShowAdd(false)} 
        onSuccess={(newId) => { 
          const emptyRow = dests.find(d => !d.toId);
          if(emptyRow) updateDest(emptyRow.id, "toId", newId);
          setShowAdd(false); 
        }} 
      />
    );
  }

  return (
    <Modal title={`Transfert (Max ${sourceVol} hL)`} onClose={onClose} wide={true}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <FF label="Date de l'opération" style={{ flex: 1, maxWidth: 200 }}>
          <Input type="date" value={transferDate} onChange={e => setTransferDate(e.target.value)} disabled={isSubmitting} />
        </FF>
        {isAdmin && <Btn variant="ghost" onClick={() => setShowAdd(true)} style={{ fontSize:10, color:T.accent }} disabled={isSubmitting}>+ NOUVELLE CUVE</Btn>}
      </div>
      
      <div style={{ background:T.surfaceHigh, padding:14, borderRadius:6, border:`1px solid ${T.border}`, marginBottom:16, marginTop:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <div style={{ fontSize:10, textTransform:"uppercase", color:T.textDim, letterSpacing:1 }}>Destinations</div>
          <div style={{ fontSize:11, color: totalVol > sourceVol ? T.red : T.accent, fontFamily:"monospace", fontWeight: "bold" }}>
            Total réparti : {totalVol} / {sourceVol} hL
          </div>
        </div>

        {dests.map((d, i) => {
          const alreadySelectedIds = dests.filter(other => other.id !== d.id).map(other => String(other.toId));
          let filteredTargets = baseAvailTargets.filter(c => !alreadySelectedIds.includes(String(c.id)));

          if (d.filterZone) filteredTargets = filteredTargets.filter(c => c.zone === d.filterZone);
          if (d.filterCat === "CUVES") filteredTargets = filteredTargets.filter(c => GROUPS.CUVES.includes(c.type));
          if (d.filterCat === "BOIS") filteredTargets = filteredTargets.filter(c => GROUPS.BOIS.includes(c.type));
          if (d.filterCat === "CITERNE") filteredTargets = filteredTargets.filter(c => c.type === "CITERNE" || c.type === "COMPARTIMENT");
          if (d.filterCat === "AUTRE") filteredTargets = filteredTargets.filter(c => c.type === "AUTRE");
          if (d.filterType) filteredTargets = filteredTargets.filter(c => c.type === d.filterType);

          const targetCuve = baseAvailTargets.find(c => String(c.id) === String(d.toId));
          const targetLot = targetCuve && targetCuve.currentVolume > 0 ? (state.lots || []).find(l => String(l.currentContainerId || l.containerId) === String(targetCuve.id)) : null;
          const free = targetCuve ? (targetCuve.capacityValue || targetCuve.capacity || 0) - (targetCuve.currentVolume || 0) : 0;
          
          const isError = parseFloat(d.vol) > free;
          const isRowCepageMismatch = isMustTransfer && targetLot && (targetLot.mainGrapeCode || targetLot.cepage) !== "MULTI" && (targetLot.mainGrapeCode || targetLot.cepage) !== (lotToTransfer?.mainGrapeCode || lotToTransfer?.cepage);

          return (
            <div key={d.id} style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16, paddingBottom:16, borderBottom: i < dests.length-1 ? `1px dashed ${T.border}` : "none" }}>
              <div style={{ display:"flex", gap:8 }}>
                <Select value={d.filterZone} onChange={e => updateDest(d.id, "filterZone", e.target.value)} style={{ flex: 1, fontSize: 11 }} disabled={isSubmitting}>
                  <option value="">-- Zone --</option>
                  {uniqueZones.map(z => <option key={z} value={z}>{z}</option>)}
                </Select>
                <Select value={d.filterCat} onChange={e => updateDest(d.id, "filterCat", e.target.value)} style={{ flex: 1, fontSize: 11 }} disabled={isSubmitting}>
                  <option value="">-- Catégorie --</option>
                  <option value="CUVES">Cuves</option><option value="BOIS">Bois</option><option value="CITERNE">Citernes</option><option value="AUTRE">Autres</option>
                </Select>
                {(d.filterCat === "CUVES" || d.filterCat === "BOIS") && (
                  <Select value={d.filterType} onChange={e => updateDest(d.id, "filterType", e.target.value)} style={{ flex: 1, fontSize: 11 }} disabled={isSubmitting}>
                    <option value="">-- Type --</option>
                    {GROUPS[d.filterCat].map(t => <option key={t} value={t}>{t.replace("CUVE_", "")}</option>)}
                  </Select>
                )}
              </div>

              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <div style={{ flex: 2 }}>
                  <Select value={d.toId} onChange={e => updateDest(d.id, "toId", e.target.value)} style={{ borderColor: isError || isRowCepageMismatch ? T.red : T.border }} disabled={isSubmitting}>
                    <option value="">-- Sélectionner la cuve ({filteredTargets.length} trouvées) --</option>
                    {filteredTargets.map(c => {
                      const dispo = Math.max(0, (c.capacityValue || c.capacity || 0) - (c.currentVolume || 0)).toFixed(2);
                      return <option key={c.id} value={c.id}>{c.displayName || c.name} ({dispo} hL dispo)</option>;
                    })}
                  </Select>
                  {isError && <div style={{ color:T.red, fontSize:10, marginTop:4 }}>⚠️ Dépasse la capacité disponible !</div>}
                  {isRowCepageMismatch && <div style={{ color:T.red, fontSize:10, marginTop:4, fontWeight: "bold" }}>⚠️ Action Interdite : Moûts de cépages différents.</div>}
                </div>
                
                <div style={{ flex: 1, display:"flex", gap:4 }}>
                  <Input type="number" step="0.1" placeholder="Vol (hL)" value={d.vol} onChange={e => updateDest(d.id, "vol", e.target.value)} style={{ borderColor: isError ? T.red : T.border }} disabled={isRowCepageMismatch || isSubmitting} />
                  <Btn variant="secondary" onClick={() => handleMax(d.id)} disabled={isRowCepageMismatch || isSubmitting}>MAX</Btn>
                </div>
                {dests.length > 1 && <Btn variant="ghost" onClick={() => setDests(dests.filter(other => other.id !== d.id))} style={{ color:T.red, padding:"8px" }} disabled={isSubmitting}>✕</Btn>}
              </div>
            </div>
          )
        })}
        <div style={{ display:"flex", justifyContent:"flex-start", marginTop: 8 }}>
          <Btn variant="secondary" onClick={() => setDests([...dests, { id: Date.now(), toId: "", vol: "", filterZone: "", filterCat: "", filterType: "" }])} style={{ fontSize:10, padding:"4px 8px" }} disabled={isSubmitting}>+ Ajouter une destination</Btn>
        </div>
      </div>
      
      {isPartial && (
         <FF label="Que devient le reste en cuve source ?">
           <Select value={remType} onChange={e => setRemType(e.target.value)} disabled={isSubmitting}>
             <option value="">Garder le statut actuel</option><option value="BOURBES">Qualifier en Bourbes</option><option value="LIES">Qualifier en Lies</option>
           </Select>
         </FF>
      )}

      {isSoutirageDebourbage && (
        <div style={{ marginTop: 16, borderTop: `1px solid ${T.border}`, paddingTop: 16 }}>
          <div style={{ fontSize: 11, color: T.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>🔬 Résultats Labo (Moût clair)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, background: T.surfaceHigh, padding: "12px", borderRadius: 4 }}>
            <FF label="pH"><Input type="number" step="0.01" value={ph} onChange={e => setPh(e.target.value)} disabled={isSubmitting} /></FF>
            <FF label="AT"><Input type="number" step="0.1" value={at} onChange={e => setAt(e.target.value)} disabled={isSubmitting} /></FF>
            <FF label="TAVP"><Input type="number" step="0.1" value={tavp} onChange={e => setTavp(e.target.value)} disabled={isSubmitting} /></FF>
          </div>
        </div>
      )}
      
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={!isVolValid || hasCapacityIssue || hasCepageMismatch || dests.some(d => !d.toId || !d.vol) || totalVol > sourceVol || isSubmitting}>
          {isSubmitting ? "Transfert en cours..." : "Valider le transfert"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODALE DE DÉCUVAGE (UNIFIÉE EN BACKEND)
// =============================================================================
function DecuvageModal({ container, lot, onClose }) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore();
  const { user } = useAuth();

  const [form, setForm] = useState({
    volGoutte: "", cuveGoutteId: "",
    volPresse: "", cuvePresseId: "",
    statusDest: "FERMENTATION_ALCOOLIQUE", 
    notes: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [showAdd, setShowAdd] = useState(null);

  const availCuves = state.containers.filter(c => 
    c.status !== "PLEINE" && c.status !== "ARCHIVÉE" && String(c.id) !== String(container.id) && !c.type.includes("DEBOURBAGE")
  );

  const volG = parseFloat(form.volGoutte) || 0;
  const volP = parseFloat(form.volPresse) || 0;
  const isFormValid = (volG > 0 ? form.cuveGoutteId !== "" : true) && (volP > 0 ? form.cuvePresseId !== "" : true) && (volG > 0 || volP > 0);

  const submit = async () => {
    setIsSubmitting(true);
    try {
      // API UNIFIÉE : Tout le cycle de décuvage d'un coup
      const res = await fetch('/api/lots/decuvage', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          sourceLotId: lot.id, 
          sourceContainerId: container.id, 
          volGoutte: volG, 
          cuveGoutteId: form.cuveGoutteId ? parseInt(form.cuveGoutteId) : null, 
          volPresse: volP, 
          cuvePresseId: form.cuvePresseId ? parseInt(form.cuvePresseId) : null, 
          finalStatus: form.statusDest, 
          notes: form.notes, 
          operator: user.name,
          idempotencyKey
        }) 
      });

      if (!res.ok) throw new Error((await res.json()).error || "Erreur de décuvage");

      dispatch({ type: "TOAST_ADD", payload: { msg: "Décuvage terminé avec succès !", color: "#8b1c31" } });
      if (refreshData) await refreshData();
      onClose();
    } catch(e) { 
      alert("Erreur : " + e.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showAdd) {
    return (
      <AddContainerModal 
        initialCapacity={showAdd === "goutte" ? Math.ceil(volG).toString() : Math.ceil(volP).toString()}
        onClose={() => setShowAdd(null)}
        onSuccess={(newId) => {
          if (showAdd === "goutte") setForm({ ...form, cuveGoutteId: newId });
          if (showAdd === "presse") setForm({ ...form, cuvePresseId: newId });
          setShowAdd(null);
        }}
      />
    );
  }

  return (
    <Modal title={`Décuvage & Pressurage : ${lot.businessCode || lot.code}`} onClose={onClose} wide={true}>
      <div style={{ background:"#8b1c3115", padding:14, borderRadius:4, marginBottom:16, fontSize:12, color:T.textDim, borderLeft:`3px solid #8b1c31` }}>
        Le lot en macération de <strong>{lot.currentVolume || lot.volume} hL (estimé)</strong> va être séparé. Le lot d'origine sera archivé et la cuve passera en nettoyage.
      </div>

      <div style={{ marginBottom: 20 }}>
        <FF label="Statut cible des jus écoulés">
          <Select value={form.statusDest} onChange={e=>setForm({...form, statusDest:e.target.value})} disabled={isSubmitting}>
            <option value="FERMENTATION_ALCOOLIQUE">Fermentation Alcoolique (Sucres à finir)</option>
            <option value="VIN_ROUGE">Vin Rouge (FA Terminée)</option>
            <option value="VIN_DE_BASE">Vin de Base (Rosé)</option>
          </Select>
        </FF>
      </div>

      <div style={{ border:`1px solid ${T.border}`, borderRadius:4, padding:16, marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:"bold", color:"#8b1c31", marginBottom:12, textTransform:"uppercase" }}>🍷 Vin de Goutte (-G)</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
          <FF label="Volume écoulé (hL)"><Input type="number" step="0.1" value={form.volGoutte} onChange={e=>setForm({...form, volGoutte:e.target.value})} disabled={isSubmitting} /></FF>
          <FF label="Envoyer vers (Cuve/Foudre)">
            <div style={{ display: "flex", gap: 8 }}>
              <Select value={form.cuveGoutteId} onChange={e=>setForm({...form, cuveGoutteId:e.target.value})} disabled={isSubmitting} style={{ flex: 1, borderColor: volG > 0 && !form.cuveGoutteId ? T.red : T.border }}>
                <option value="">-- Choisir un contenant --</option>
                {availCuves.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name}</option>)}
              </Select>
              <Btn variant="secondary" onClick={() => setShowAdd("goutte")} disabled={isSubmitting}>+</Btn>
            </div>
          </FF>
        </div>
      </div>

      <div style={{ border:`1px solid ${T.border}`, borderRadius:4, padding:16, marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:"bold", color:T.textDim, marginBottom:12, textTransform:"uppercase" }}>🗜️ Vin de Presse (-P)</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
          <FF label="Volume pressé (hL)"><Input type="number" step="0.1" value={form.volPresse} onChange={e=>setForm({...form, volPresse:e.target.value})} disabled={isSubmitting} /></FF>
          <FF label="Envoyer vers (Cuve/Barrique)">
            <div style={{ display: "flex", gap: 8 }}>
              <Select value={form.cuvePresseId} onChange={e=>setForm({...form, cuvePresseId:e.target.value})} disabled={isSubmitting} style={{ flex: 1, borderColor: volP > 0 && !form.cuvePresseId ? T.red : T.border }}>
                <option value="">-- Choisir un contenant --</option>
                {availCuves.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name}</option>)}
              </Select>
              <Btn variant="secondary" onClick={() => setShowAdd("presse")} disabled={isSubmitting}>+</Btn>
            </div>
          </FF>
        </div>
      </div>

      <FF label="Observations générales">
        <Input value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} disabled={isSubmitting} />
      </FF>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:20 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !isFormValid} style={{ background: isSubmitting ? T.textDim : "#8b1c31", borderColor: isSubmitting ? T.textDim : "#8b1c31", color: "#fff" }}>
          {isSubmitting ? "Traitement..." : "Valider le Décuvage"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// COMPOSANTS CUVERIE (PRODUCTION READY)
// =============================================================================

function ContainerTile({ c, onClick }) {
  const T = useTheme(); 
  const { state } = useStore();
  
  // NOUVEAU : On récupère les enfants et on utilise les bons champs BDD
  const enfants = (state.containers || []).filter(enfant => enfant.parentId === c.id);
  const totalCapacity = (c.capacityValue || c.capacity || 0) + enfants.reduce((sum, e) => sum + (e.capacityValue || e.capacity || 0), 0);
  let totalVolume = (c.currentVolume || 0) + enfants.reduce((sum, e) => sum + (e.currentVolume || 0), 0);

  const isReallyEmpty = c.status === "VIDE" || c.status === "NETTOYAGE" || totalVolume <= 0;
  totalVolume = isReallyEmpty ? 0 : totalVolume;
  
  const pct = totalCapacity > 0 ? Math.round((totalVolume / totalCapacity) * 100) : 0; 
  const tc = getTypeColor(c.type);
  
  // Utilisation de currentContainerId pour la correspondance
  const lot = isReallyEmpty ? null : (state.lots || []).find(l => String(l.id) === String(c.lotId) || String(l.currentContainerId || l.containerId) === String(c.id));
  const displayStatus = isReallyEmpty && c.status !== "NETTOYAGE" ? "VIDE" : c.status;

  const formatVolShort = (vol) => typeof vol === 'number' ? `${vol.toFixed(1)} hL` : `${vol} hL`;

  return (
    <div onClick={onClick} style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:16, cursor:"pointer", position:"relative", overflow:"hidden", borderLeft:`3px solid ${displayStatus === "NETTOYAGE" ? T.blue : tc}`, transition: "transform 0.2s, box-shadow 0.2s" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${T.accent}11`; }} onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}>
      <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:tc+"0d", pointerEvents:"none" }} />
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
        <div>
          <div style={{ fontSize:14, fontFamily:"monospace", color:T.textStrong, fontWeight: "bold" }}>{c.displayName || c.name}</div>
          <div style={{ fontSize:10, color:T.textDim }}>{c.type.replace(/_/g," ")} {enfants.length > 0 && `(${enfants.length + 1} Comps)`}</div>
        </div>
        <div style={{ width: 24, height: 32, border:`2px solid ${tc}66`, borderRadius: 2, position:"relative", overflow:"hidden", background: T.surfaceHigh }}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:tc+"88" }} />
        </div>
      </div>
      {lot ? (
        <div style={{ fontSize:11, color:T.accentLight, fontFamily:"monospace", marginBottom:10, fontWeight: "bold" }}>{lot.businessCode || lot.code} {enfants.length > 0 && "+ autres"}</div>
      ) : (
        <div style={{ fontSize:11, color:T.textDim, marginBottom:10, fontStyle:"italic" }}>Vide</div>
      )}
      <FillBar pct={pct} color={tc} />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:10, alignItems:"center" }}>
        <div style={{ fontSize:13, color:T.textStrong, fontWeight: "bold" }}>
          {totalVolume > 0 ? formatVolShort(totalVolume) : "--"}
          <span style={{ color:T.textDim, fontSize:10, fontWeight: "normal" }}> / {totalCapacity} hL</span>
        </div>
        <Badge label={displayStatus.replace(/_/g," ")} color={displayStatus === "NETTOYAGE" ? T.blue : (displayStatus === "VIDE" ? T.textDim : tc)} />
      </div>
    </div>
  );
}

// =============================================================================
// DÉTAIL D'UNE CUVE / CITERNE (SÉCURISÉ)
// =============================================================================
function ContainerDetail({ container: initialContainer, onBack, onSelectLot, onSelectContainer }) {
  const T = useTheme(); 
  const { user } = useAuth(); 
  const { state, dispatch, refreshData } = useStore();
  const container = (state.containers || []).find(c => c.id === initialContainer.id) || initialContainer;
  const [modal, setModal] = useState(null); 
  const [histTab, setHistTab] = useState("evenements");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const navigableContainers = (state.containers || [])
    .filter(c => 
      c.status !== "LIVRE" && 
      c.status !== "ARCHIVÉE" && 
      !c.parentId && 
      c.type !== "COMPARTIMENT" &&
      c.type !== "CUVE_DEBOURBAGE" && 
      !c.type?.includes("Débourbage") && 
      !c.type?.includes("Belon")
    )
    .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
  
  const currentIndex = navigableContainers.findIndex(c => c.id === container.id);
  const prevContainer = currentIndex > 0 ? navigableContainers[currentIndex - 1] : null;
  const nextContainer = currentIndex < navigableContainers.length - 1 ? navigableContainers[currentIndex + 1] : null;

  const isCiterneMere = container.type === "CITERNE";
  const baseName = (container.displayName || container.name).split(" - Comp ")[0]; 
  
  const enfants = (state.containers || []).filter(c => 
    c.parentId === container.id || 
    (c.type === "COMPARTIMENT" && (c.displayName || c.name).startsWith(baseName) && c.id !== container.id)
  );
  
  const allCompartments = isCiterneMere ? [container, ...enfants] : [container]; 
  
  const totalCapacity = isCiterneMere ? allCompartments.reduce((sum, c) => sum + (c.capacityValue || c.capacity || 0), 0) : (container.capacityValue || container.capacity || 0);
  const totalVolume = isCiterneMere ? allCompartments.reduce((sum, c) => sum + (c.currentVolume || 0), 0) : (container.currentVolume || 0);

  const isReallyEmpty = container.status === "VIDE" || container.status === "NETTOYAGE" || totalVolume <= 0;
  const currentVol = isReallyEmpty ? 0 : totalVolume;
  
  const displayCurrentVol = currentVol > 0 ? Number(currentVol.toFixed(2)) : 0;
  const pct = totalCapacity > 0 ? Math.round((displayCurrentVol / totalCapacity) * 100) : 0; 
  
  const tc = getTypeColor(container.type);
  const displayStatus = isReallyEmpty && container.status !== "NETTOYAGE" ? "VIDE" : container.status;

  const lot = isReallyEmpty ? null : (state.lots || []).find(l => String(l.id) === String(container.lotId) || String(l.currentContainerId || l.containerId) === String(container.id));

  const hist = (state.events || []).filter(e => String(e.containerId) === String(container.id)).sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  
  const lotsPasses = [...new Set((state.events || []).filter(e => String(e.containerId) === String(container.id) && e.lotId).map(e => e.lotId))].map(id => { 
    const l = (state.lots || []).find(x => String(x.id) === String(id)); 
    if (!l) return null; 
    const evts = (state.events || []).filter(e => String(e.lotId) === String(id) && String(e.containerId) === String(container.id)).sort((a,b) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime()); 
    return { lot:l, from: evts[0]?.createdAt || evts[0]?.date, to: evts[evts.length-1]?.createdAt || evts[evts.length-1]?.date }; 
  }).filter(Boolean).reverse();
  
  const formatVolShort = (vol) => typeof vol === 'number' ? `${vol.toFixed(1)} hL` : `${vol} hL`;

  const toggleCleaning = async () => {
    setIsSubmitting(true);
    const nextStatus = displayStatus === "NETTOYAGE" ? "VIDE" : "NETTOYAGE";
    try {
      const res = await fetch(`/api/containers`, { // Adaptez à votre route API
        method: 'PUT', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ id: container.id, status: nextStatus }) 
      });
      if (!res.ok) throw new Error("Erreur serveur");
      if (refreshData) await refreshData();
    } catch(e) {
      alert("Impossible de modifier le statut de nettoyage.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeDelete = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/containers?id=${container.id}`, { method: 'DELETE' });
      
      if (res.ok) { 
        dispatch({ type: "DELETE_CONTAINER", payload: container.id }); 
        dispatch({ type: "TOAST_ADD", payload: { msg: "Supprimé définitivement", color: T.green } }); 
        if (refreshData) await refreshData(); 
        onBack(); 
      } else { 
        const err = await res.json();
        throw new Error(err.error || "Raison inconnue");
      }
    } catch(e) {
      alert("BLOCAGE BASE DE DONNÉES : " + e.message);
    } finally {
      setIsSubmitting(false);
      setModal(null);
    }
  };

  const formatEventDate = (dStr) => {
    if (!dStr) return "--";
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr; // Fallback pour les vieilles dates formatées manuellement
    return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`;
  };
  
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <button onClick={onBack} style={{ background:"none", border:`1px solid ${T.border}`, color:T.textDim, padding:"6px 14px", borderRadius:3, cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
          {"<- Retour"}
        </button>
        
        {onSelectContainer && (
          <div style={{ display: "flex", gap: 8 }}>
            <button 
              onClick={() => prevContainer && onSelectContainer(prevContainer)} 
              disabled={!prevContainer}
              style={{ background:"none", border:`1px solid ${T.border}`, color: prevContainer ? T.textStrong : T.textDim, padding:"6px 14px", borderRadius:3, cursor: prevContainer ? "pointer" : "default", fontSize:11, fontFamily:"monospace", opacity: prevContainer ? 1 : 0.3, transition: "all 0.2s" }}
              onMouseEnter={e => prevContainer && (e.currentTarget.style.background = T.surfaceHigh)}
              onMouseLeave={e => prevContainer && (e.currentTarget.style.background = "none")}
            >
              {"< Précédent"}
            </button>
            <button 
              onClick={() => nextContainer && onSelectContainer(nextContainer)} 
              disabled={!nextContainer}
              style={{ background:"none", border:`1px solid ${T.border}`, color: nextContainer ? T.textStrong : T.textDim, padding:"6px 14px", borderRadius:3, cursor: nextContainer ? "pointer" : "default", fontSize:11, fontFamily:"monospace", opacity: nextContainer ? 1 : 0.3, transition: "all 0.2s" }}
              onMouseEnter={e => nextContainer && (e.currentTarget.style.background = T.surfaceHigh)}
              onMouseLeave={e => nextContainer && (e.currentTarget.style.background = "none")}
            >
              {"Suivant >"}
            </button>
          </div>
        )}
      </div>
      
      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:20, alignItems:"start" }}>
        
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:22, borderLeft:`3px solid ${displayStatus === "NETTOYAGE" ? T.blue : tc}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
              <div>
                <div style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:22, color:T.textStrong }}>
                  {isCiterneMere ? baseName : (container.displayName || container.name)}
                </div>
                <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:2, marginTop:3 }}>
                  {isCiterneMere ? `TOTAL ${container.type.replace(/_/g," ")}` : container.type.replace(/_/g," ")}
                </div>
              </div>
              <Badge label={displayStatus.replace(/_/g," ")} color={displayStatus === "PLEINE" || displayStatus === "PLEIN" ? T.green : (displayStatus === "NETTOYAGE" ? T.blue : T.textDim)} />
            </div>
            
            <div style={{ display:"flex", justifyContent:"center", margin:"20px 0" }}>
              <div style={{ position:"relative", width:80, height:120 }}>
                <div style={{ position:"absolute", inset:0, border:`3px solid ${tc}44`, borderRadius:6 }} />
                <div style={{ position:"absolute", bottom:0, left:0, right:0, height:`${pct}%`, background:`linear-gradient(to top, ${tc}88, ${tc}44)`, borderRadius:"0 0 4px 4px", transition:"height 1s" }} />
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:16, fontFamily:"Georgia,serif", color:T.textStrong, fontWeight:"bold", textShadow:"0 0 4px rgba(255,255,255,0.5)" }}>{pct}%</span>
                </div>
              </div>
            </div>
            
            <div style={{ textAlign:"center", marginBottom:16 }}>
              <div style={{ fontSize:18, color:T.textStrong, fontFamily:"monospace", fontWeight: "bold" }}>{displayCurrentVol} hL</div>
              <div style={{ fontSize:11, color:T.textDim }}>sur {totalCapacity} hL</div>
            </div>
          </div>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          
          {user.role !== "Lecture seule" && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:18 }}>
              <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:14, fontWeight:"bold" }}>Actions rapides</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                
                {(!isCiterneMere || enfants.length === 0) && (
                  <>
                    {!lot && isReallyEmpty && <Btn onClick={() => setModal("createLot")} disabled={isSubmitting}>+ Créer lot</Btn>}
                    
                    {lot && <Btn variant="ghost" onClick={() => setModal("transfer")} disabled={isSubmitting}>Transférer</Btn>}
                    
                    {lot && (lot.status === "MACERATION" || lot.status === "MOUT_NON_DEBOURBE") && (
                      <Btn variant="primary" onClick={() => setModal("decuvage")} style={{ background: "#8b1c31", borderColor: "#8b1c31", color: "#fff" }} disabled={isSubmitting}>
                        🍷 Décuver / Presser
                      </Btn>
                    )}

                    {lot && <Btn variant="ghost" onClick={() => setModal("intrant")} disabled={isSubmitting}>Ajout intrant</Btn>}
                    {lot && <Btn variant="ghost" onClick={() => setModal("volume")} disabled={isSubmitting}>Corriger volume</Btn>}
                  </>
                )}
                
                {(user.role === "Admin" || user.role === "Chef de cave") && (
                  <>
                    <Btn variant="ghost" onClick={() => setModal("rename")} disabled={isSubmitting}>✏️ Renommer</Btn>
                    {isReallyEmpty && (
                       <Btn variant="ghost" onClick={() => setModal("deleteConfirm")} style={{ color: T.red }} disabled={isSubmitting}>
                         🗑️ {isCiterneMere ? "Supprimer Tout" : "Supprimer"}
                       </Btn>
                    )}
                    {container.type === "CITERNE" && (
                      <Btn variant="ghost" onClick={() => setModal("compartment")} disabled={isSubmitting}>+ Ajouter compartiment</Btn>
                    )}
                  </>
                )}

                {!lot && <Btn variant={displayStatus === "NETTOYAGE" ? "secondary" : "ghost"} onClick={toggleCleaning} disabled={isSubmitting}>{displayStatus === "NETTOYAGE" ? "✅ Terminer nettoyage" : "🧼 Mettre en nettoyage"}</Btn>}
              </div>
            </div>
          )}

          {isCiterneMere && (
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:18 }}>
              <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:14, fontWeight:"bold" }}>Détail des Compartiments</div>
              
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {allCompartments.map((comp, index) => {
                   const compLot = (comp.currentVolume || comp.volume) > 0 ? (state.lots || []).find(l => String(l.currentContainerId || l.containerId) === String(comp.id)) : null;
                   const compName = index === 0 ? "Compartiment 1 (Base)" : (comp.displayName || comp.name).split(" - ")[1] || (comp.displayName || comp.name);
                   const isCompEmpty = (comp.currentVolume || comp.volume) <= 0;

                   return (
                     <div key={comp.id} style={{ display:"grid", gridTemplateColumns:"1fr 120px 140px", gap:10, alignItems:"center", padding:"12px", background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6 }}>
                       <div>
                         <div style={{ fontSize:13, color:T.textStrong, fontWeight:"bold" }}>{compName}</div>
                         <div style={{ fontSize:11, color:T.textDim }}>{isCompEmpty ? 0 : Number((comp.currentVolume || 0).toFixed(2))} / {comp.capacityValue || comp.capacity} hL</div>
                       </div>
                       <div style={{ textAlign:"left" }}>
                         {compLot ? <div style={{ fontSize:12, color:T.accentLight, fontFamily:"monospace", fontWeight:"bold" }}>{compLot.businessCode || compLot.code}</div> : <div style={{ fontSize:12, color:T.textDim, fontStyle:"italic" }}>Vide</div>}
                       </div>
                       <div style={{ display:"flex", justifyContent:"flex-end", gap:6 }}>
                          {isCompEmpty ? (
                            <Btn variant="secondary" style={{fontSize:9, padding:"4px 8px", background:T.surface, color:T.textDim, borderColor:T.border}} onClick={() => setModal("createLot")}>+ Créer Lot</Btn>
                          ) : (
                            compLot && <Btn variant="secondary" style={{fontSize:9, padding:"4px 8px"}} onClick={() => {
                               if (onSelectLot) onSelectLot(compLot);
                               else dispatch({ type: "TOAST_ADD", payload: { msg: "Allez dans l'onglet Lots pour voir ce lot.", color: T.accent } });
                            }}>Voir Lot</Btn>
                          )}
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          )}

          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
            <div style={{ display:"flex", borderBottom:`1px solid ${T.border}`, background: T.surfaceHigh }}>
              <button onClick={()=>setHistTab("evenements")} style={{ flex:1, background:histTab==="evenements"?T.accent+"15":"none", border:"none", borderBottom:`2px solid ${histTab==="evenements"?T.accent:"transparent"}`, color:histTab==="evenements"?T.accent:T.textDim, padding:"12px 16px", cursor:"pointer", fontSize:11, fontFamily:"monospace", textTransform:"uppercase", fontWeight: "bold" }}>Événements</button>
              <button onClick={()=>setHistTab("lots")} style={{ flex:1, background:histTab==="lots"?T.accent+"15":"none", border:"none", borderBottom:`2px solid ${histTab==="lots"?T.accent:"transparent"}`, color:histTab==="lots"?T.accent:T.textDim, padding:"12px 16px", cursor:"pointer", fontSize:11, fontFamily:"monospace", textTransform:"uppercase", fontWeight: "bold" }}>Lots passés</button>
            </div>
            
            {histTab === "evenements" && (
              <div style={{ padding:4 }}>
                {hist.length === 0 ? (
                  <div style={{ padding:"32px 20px", textAlign:"center", color:T.textDim, fontSize:12, fontStyle: "italic" }}>Aucun événement enregistré</div>
                ) : (
                  hist.map((h, i) => (
                    <div key={h.id} style={{ display:"grid", gridTemplateColumns:"140px 110px 1fr 100px", gap:10, alignItems:"center", padding:"12px 16px", borderBottom:i<hist.length-1?`1px solid ${T.border}`:"none" }}>
                      <div style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{formatEventDate(h.createdAt || h.date)}</div>
                      <div><Badge label={h.eventType || h.type} /></div>
                      <div style={{ fontSize:11, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontStyle:"italic" }} title={h.comment || h.note}>{h.comment || h.note || "--"}</div>
                      <div style={{ fontSize:11, color:T.textDim, textAlign:"right", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{h.operator || "--"}</div>
                    </div>
                  ))
                )}
              </div>
            )}
            
            {histTab === "lots" && (
              <div style={{ padding:4 }}>
                {lotsPasses.length === 0 ? (
                  <div style={{ padding:"32px 20px", textAlign:"center", color:T.textDim, fontSize:12, fontStyle: "italic" }}>Aucun lot n'a encore transité</div>
                ) : (
                  lotsPasses.map(({ lot:l, from, to }) => (
                    <div key={l.id} style={{ display:"grid", gridTemplateColumns:"2fr 60px 120px 120px 100px", padding:"12px 16px", alignItems:"center", borderBottom:`1px solid ${T.border}` }}>
                      <div style={{ fontSize:11, color:T.accentLight, fontFamily:"monospace", fontWeight: "bold" }}>{l.businessCode || l.code}</div>
                      <div style={{ fontSize:12, color:T.text }}>{l.year || l.millesime}</div>
                      <div style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{formatEventDate(from)}</div>
                      <div style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{formatEventDate(to)}</div>
                      <div><Badge label={formatStatus(l.status)} color={LOT_STATUS_COLORS[l.status] || T.textDim} /></div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {modal === "createLot" && <CreateLotModal container={container} onClose={() => setModal(null)} />}
      {modal === "transfer"  && <TransferModal  container={container} onClose={() => setModal(null)} />}
      {modal === "intrant"   && <AddIntrantModal container={container} lot={lot} onClose={() => setModal(null)} />}
      {modal === "volume"    && <CorrectVolumeModal container={container} lot={lot} onClose={() => setModal(null)} />}
      {modal === "rename"    && <RenameContainerModal container={container} onClose={() => setModal(null)} />}
      {modal === "compartment" && <AddCompartmentModal container={container} onClose={() => setModal(null)} />}
      {modal === "decuvage"  && <DecuvageModal container={container} lot={lot} onClose={() => setModal(null)} />}
      
      {modal === "deleteConfirm" && (
        <Modal title="Confirmation de suppression" onClose={() => setModal(null)}>
          <div style={{ padding:"20px 0", color:T.text, lineHeight:1.5 }}>
            Voulez-vous vraiment supprimer définitivement <strong style={{color:T.red}}>{isCiterneMere ? baseName : (container.displayName || container.name)}</strong> {isCiterneMere && "et TOUS ses compartiments"} ?<br/><br/>
            Cette action est irréversible.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={() => setModal(null)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={executeDelete} disabled={isSubmitting} style={{ background:T.red, color:"#fff", borderColor:T.red }}>
              {isSubmitting ? "Suppression..." : "Oui, supprimer"}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// TOUR DE FERMENTATION ALCOOLIQUE (FA) - SÉCURISÉ & API-DRIVEN
// =============================================================================
function TourFA({ onSelectLot }: any) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore();
  
  const [tourDate, setTourDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [readings, setReadings] = useState<Record<string, { density: string, temperature: string }>>({});
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // On ne filtre que les lots pertinents pour la FA
  const faLots = (state.lots || [])
    .filter((l: any) => l.status === "FERMENTATION_ALCOOLIQUE" || l.status === "MOUT_NON_DEBOURBE" || l.status === "MOUT_DEBOURBE")
    .sort((a: any, b: any) => (a.businessCode || a.code).localeCompare(b.businessCode || b.code));

  const updateReading = (lotId: string, field: 'density' | 'temperature', value: string) => {
    setReadings(prev => ({
      ...prev,
      [lotId]: { ...prev[lotId], [field]: value }
    }));
  };

  const submitTour = async () => {
    // Formatage des données pour le payload API
    const payloadReadings = Object.entries(readings).map(([lotId, data]) => ({
      lotId,
      date: tourDate,
      density: data.density || undefined,
      temperature: data.temperature || undefined
    })).filter(r => r.density !== undefined || r.temperature !== undefined);

    if (payloadReadings.length === 0) {
      return alert("Veuillez saisir au moins une valeur (densité ou température) pour valider le tour.");
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/fa', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({
          readings: payloadReadings,
          idempotencyKey
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'enregistrement en base de données.");

      dispatch({ type: "TOAST_ADD", payload: { msg: `Tour de FA enregistré (${data.count} cuves mises à jour)`, color: T.green } });
      
      // On vide les champs de saisie et on génère une nouvelle clé pour le prochain tour
      setReadings({});
      setIdempotencyKey(crypto.randomUUID());
      
      if (refreshData) await refreshData();

    } catch (e: any) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e.message, color: T.red } });
      setIdempotencyKey(crypto.randomUUID()); // Renouvellement de la clé en cas d'erreur
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: T.textStrong, margin: 0 }}>Tour de FA</h1>
          <div style={{ color: T.textDim, fontSize: 13, marginTop: 4 }}>Saisie rapide des densités et températures pour les lots en cours de fermentation.</div>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <FF label="Date du relevé">
            <Input type="date" value={tourDate} onChange={(e: any) => setTourDate(e.target.value)} disabled={isSubmitting} />
          </FF>
          <Btn onClick={submitTour} disabled={isSubmitting || Object.keys(readings).length === 0} style={{ background: isSubmitting ? T.textDim : T.accent, height: 38, marginTop: 16 }}>
            {isSubmitting ? "Enregistrement sécurisé..." : "Valider le Tour"}
          </Btn>
        </div>
      </div>

      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 2fr 100px 1.5fr 1.5fr", padding: "12px 16px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, background: T.surfaceHigh }}>
          <div>Code Lot</div><div>Contenant</div><div>Volume</div><div>Densité</div><div>Température (°C)</div>
        </div>
        
        {faLots.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center", color: T.textDim, fontStyle: "italic" }}>Aucun lot n'est actuellement en Fermentation Alcoolique.</div>
        ) : (
          faLots.map((l: any, i: number) => {
            const container = (state.containers || []).find((c: any) => String(c.id) === String(l.currentContainerId || l.containerId));
            
            return (
              <div key={l.id} style={{ display: "grid", gridTemplateColumns: "150px 2fr 100px 1.5fr 1.5fr", padding: "12px 16px", alignItems: "center", borderBottom: i < faLots.length - 1 ? `1px solid ${T.border}` : "none", transition: "background .15s" }} onMouseEnter={e => e.currentTarget.style.background = T.surfaceHigh} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <div onClick={() => onSelectLot(l)} style={{ fontSize: 13, color: T.accent, fontFamily: "monospace", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }}>
                  {l.businessCode || l.code}
                </div>
                <div style={{ fontSize: 13, color: T.textStrong }}>
                  {container ? (container.displayName || container.name) : "Vrac"}
                </div>
                <div style={{ fontSize: 12, color: T.textDim, fontFamily: "monospace" }}>
                  {l.currentVolume || l.volume} hL
                </div>
                <div style={{ paddingRight: 16 }}>
                  <Input 
                    type="number" 
                    step="1" 
                    placeholder="Ex: 1024" 
                    value={readings[l.id]?.density || ""} 
                    onChange={(e: any) => updateReading(l.id, 'density', e.target.value)} 
                    disabled={isSubmitting} 
                  />
                </div>
                <div style={{ paddingRight: 16 }}>
                  <Input 
                    type="number" 
                    step="0.5" 
                    placeholder="Ex: 18.5" 
                    value={readings[l.id]?.temperature || ""} 
                    onChange={(e: any) => updateReading(l.id, 'temperature', e.target.value)} 
                    disabled={isSubmitting} 
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// =============================================================================
// COMPOSANT PRINCIPAL CUVERIE
// =============================================================================
function Cuverie({ onSelectContainer }) {
  const T = useTheme(); 
  const { state } = useStore(); 
  const { user } = useAuth();
  
  const [mainFilter, setMainFilter] = useState("TOUS"); 
  const [subFilter, setSubFilter] = useState(""); 
  const [search, setSearch] = useState(""); 
  
  const [filterZones, setFilterZones] = useState([]); 
  const [modal, setModal] = useState(false);
  
  const GROUPS = {
    CUVES: ["CUVE_INOX", "CUVE_BETON", "CUVE_EMAIL", "CUVE_FIBRE", "CUVE_PLASTIQUE"],
    BOIS: ["BARRIQUE", "FOUDRE"],
    SOUS_PRODUITS: ["CUVE_BOURBES", "CUVE_LIES", "CUVE_REBECHES"]
  };

  const isAdmin = user?.role === "Admin" || user?.role === "Chef de cave";
  
  const uniqueZones = [...new Set((state.containers || []).map(c => c.zone).filter(Boolean))].sort();

  const handleMainFilter = (f) => {
    setMainFilter(f);
    setSubFilter(""); 
  };

  const filtered = (state.containers || []).filter(c => {
    if (
      c.status === "LIVRE" || 
      c.status === "ARCHIVÉE" || 
      c.parentId || 
      c.type === "COMPARTIMENT" || 
      c.type === "CUVE_DEBOURBAGE" || 
      c.type?.includes("Débourbage") || 
      c.type?.includes("Belon")
    ) {
      return false;
    }

    const matchSearch = !search || (c.displayName || c.name).toLowerCase().includes(search.toLowerCase());
    const matchZone = filterZones.length === 0 || filterZones.includes(c.zone);
    
    let matchFilter = false;

    const t = (c.type || "").toLowerCase();
    const n = ((c.displayName || c.name) || "").toLowerCase();
    const isSousProduit = 
      GROUPS.SOUS_PRODUITS.includes(c.type) ||
      t.includes("bourbe") || t.includes("lies") || t.includes("rebeche") || t.includes("rebêche") || 
      n.includes("bourbe") || n.includes("lies") || n.includes("rebeche") || n.includes("rebêche");
    
    if (mainFilter === "TOUS") { 
      matchFilter = true; 
    } else if (mainFilter === "RÉSERVES") {
      matchFilter = (state.lots || []).some(l => (String(l.currentContainerId || l.containerId) === String(c.id) || String(l.id) === String(c.lotId)) && l.status === "RESERVE");
    } else if (mainFilter === "CUVES") {
      if (subFilter) matchFilter = c.type === subFilter && !isSousProduit;
      else matchFilter = GROUPS.CUVES.includes(c.type) && !isSousProduit;
    } else if (mainFilter === "BOIS") {
      if (subFilter) matchFilter = c.type === subFilter;
      else matchFilter = GROUPS.BOIS.includes(c.type);
    } else if (mainFilter === "CITERNE") {
      matchFilter = c.type === "CITERNE";
    } else if (mainFilter === "SOUS-PRODUITS") {
      if (subFilter) matchFilter = isSousProduit && c.type === subFilter;
      else matchFilter = isSousProduit;
    } else if (mainFilter === "AUTRE") {
      matchFilter = c.type === "AUTRE" || (!GROUPS.CUVES.includes(c.type) && !GROUPS.BOIS.includes(c.type) && c.type !== "CITERNE" && !isSousProduit);
    }
    
    return matchFilter && matchSearch && matchZone;
  });

  const cuvesActives = filtered.filter(c => (parseFloat(c.currentVolume || 0)) > 0);
  const cuvesVides = filtered.filter(c => (parseFloat(c.currentVolume || 0)) <= 0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div><h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Cuverie</h1></div>
        {isAdmin && <Btn onClick={() => setModal(true)}>+ Ajouter contenant</Btn>}
      </div>
      
      <div style={{ display:"flex", gap:10, marginBottom: mainFilter === "CUVES" || mainFilter === "BOIS" || mainFilter === "SOUS-PRODUITS" ? 10 : 20, flexWrap:"wrap" }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un contenant..." style={{ minWidth:200 }} />
        
        {uniqueZones.length > 0 && (
          <MultiSelectDrop label="Toutes les zones" options={uniqueZones} selected={filterZones} onChange={setFilterZones} width={160} />
        )}

        {["TOUS", "CUVES", "BOIS", "CITERNE", "RÉSERVES", "SOUS-PRODUITS", "AUTRE"].map(t => (
          <button key={t} onClick={() => handleMainFilter(t)} style={{ background: mainFilter===t ? T.accent+"22" : "none", border:`1px solid ${mainFilter===t ? T.accent : T.border}`, color: mainFilter===t ? T.accent : T.textDim, padding:"7px 16px", borderRadius:4, cursor:"pointer", fontSize:11, fontFamily:"monospace", fontWeight: t === "RÉSERVES" ? "bold" : "normal", transition:"all 0.2s" }}>
            {t}
          </button>
        ))}
        
        {(search || filterZones.length > 0) && (
          <Btn variant="ghost" onClick={() => { setSearch(""); setFilterZones([]); }}>Effacer filtres</Btn>
        )}
      </div>

      {(mainFilter === "CUVES" || mainFilter === "BOIS" || mainFilter === "SOUS-PRODUITS") && (
        <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", background:T.surfaceHigh, padding:10, borderRadius:6, border:`1px solid ${T.border}` }}>
          <span style={{fontSize:10, color:T.textDim, textTransform:"uppercase", alignSelf:"center", marginRight:10, fontWeight: "bold"}}>Sous-catégories :</span>
          {GROUPS[mainFilter === "SOUS-PRODUITS" ? "SOUS_PRODUITS" : mainFilter].map(t => (
            <button key={t} onClick={() => setSubFilter(subFilter === t ? "" : t)} style={{ background: subFilter===t ? T.accent : "transparent", color: subFilter===t ? T.bg : T.textDim, border:`1px solid ${subFilter===t ? T.accent : T.border}`, padding:"5px 12px", borderRadius:4, cursor:"pointer", fontSize:10, fontFamily:"monospace", transition:"all 0.2s" }}>
              {t.replace("CUVE_", "").replace(/_/g," ")}
            </button>
          ))}
        </div>
      )}
      
      {filtered.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:8, color:T.textDim, fontStyle:"italic" }}>Aucun contenant ne correspond à ces critères.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {cuvesActives.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 16px 0", color: T.accentLight, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                Contenants pleins ou en cours d'utilisation ({cuvesActives.length})
              </h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(215px,1fr))", gap:16 }}>
                {cuvesActives.map(c => <ContainerTile key={c.id} c={c} onClick={() => onSelectContainer(c)} />)}
              </div>
            </div>
          )}

          {cuvesVides.length > 0 && (
            <div>
              <h3 style={{ margin: "0 0 16px 0", color: T.textDim, fontSize: 16, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>
                Contenants vides ou en nettoyage ({cuvesVides.length})
              </h3>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(215px,1fr))", gap:16 }}>
                {cuvesVides.map(c => (
                  <div key={c.id} style={{ opacity: c.status !== "NETTOYAGE" ? 0.7 : 1, transition: "opacity 0.2s" }}>
                    <ContainerTile c={c} onClick={() => onSelectContainer(c)} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {modal && <AddContainerModal onClose={() => setModal(false)} />}
    </div>
  );
}

function RenameContainerModal({ container, onClose }) {
  const T = useTheme(); 
  const { dispatch, refreshData } = useStore();
  const [newName, setNewName] = useState(container.displayName || container.name);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!newName.trim() || newName === (container.displayName || container.name)) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/containers', { 
        method: 'PUT', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ id: container.id, name: newName }) 
      });
      
      if (res.ok) {
        dispatch({ type: "TOAST_ADD", payload: { msg: `Renommé en ${newName}`, color: T.green } });
        if (refreshData) await refreshData();
        onClose();
      } else {
        throw new Error((await res.json()).error);
      }
    } catch(e) {
      alert("Erreur : " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Renommer le contenant" onClose={onClose}>
      <FF label="Nouveau nom">
        <Input value={newName} onChange={e => setNewName(e.target.value)} disabled={isSubmitting} />
      </FF>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={!newName.trim() || newName === (container.displayName || container.name) || isSubmitting}>{isSubmitting ? "Sauvegarde..." : "Valider"}</Btn>
      </div>
    </Modal>
  );
}

function CreateLotModal({ container, onClose }) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore(); 
  const { user } = useAuth();
  
  const seqNum = String((state.lots || []).length + 1).padStart(3, "0");
  
  const [form, setForm] = useState({ millesime: String(new Date().getFullYear()), cepage: "CH", lieu: "", qualite: "", volume: "", status: "FERMENTATION_ALCOOLIQUE", notes: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  
  const qualiteSuffix = form.qualite === "Cuvée" ? "-C" : form.qualite === "Taille" ? "-T" : "";
  const code = form.millesime && form.cepage && form.lieu ? `${form.millesime}-${form.cepage}-${form.lieu.toUpperCase().replace(/\s+/g,"-")}${qualiteSuffix}-${seqNum}` : "";

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/lots', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          code, millesime: parseInt(form.millesime), cepage: form.cepage, lieu: form.lieu.toUpperCase(), 
          volume: parseFloat(form.volume), containerId: container.id, status: form.status, 
          notes: form.qualite ? `Qualité : ${form.qualite}. ${form.notes}` : form.notes, 
          operator: user.name, idempotencyKey 
        }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error);
      
      dispatch({ type:"TOAST_ADD", payload:{ msg:`Lot ${code} créé !`, color:"#2d6640" } }); 
      if (refreshData) await refreshData();
      onClose(); 
    } catch(e) {
      alert("Erreur : " + e.message);
      setIdempotencyKey(crypto.randomUUID()); // 👈 NOUVELLE CLÉ GÉNÉRÉE EN CAS D'ERREUR
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Créer un lot" onClose={onClose}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <FF label="Millésime"><Input type="number" value={form.millesime} onChange={e => setForm({...form, millesime:e.target.value})} disabled={isSubmitting}/></FF>
        <FF label="Cépage">
          <Select value={form.cepage} onChange={e => setForm({...form, cepage:e.target.value})} disabled={isSubmitting}>
            {CEPAGES.map(c => <option key={c}>{c}</option>)}
          </Select>
        </FF>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:12 }}>
        <FF label="Lieu-dit / Parcelle"><Input value={form.lieu} onChange={e => setForm({...form, lieu:e.target.value})} disabled={isSubmitting}/></FF>
        <FF label="Qualité">
          <Select value={form.qualite} onChange={e => setForm({...form, qualite:e.target.value})} disabled={isSubmitting}>
            <option value="">Standard</option><option value="Cuvée">Cuvée (-C)</option><option value="Taille">Taille (-T)</option>
          </Select>
        </FF>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <FF label="Volume initial (hL)"><Input type="number" step="0.1" value={form.volume} onChange={e => setForm({...form, volume:e.target.value})} disabled={isSubmitting}/></FF>
        <FF label="Statut initial">
          <Select value={form.status} onChange={e => setForm({...form, status:e.target.value})} disabled={isSubmitting}>
            {LOT_STATUSES.slice(0,4).map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </Select>
        </FF>
      </div>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={!form.lieu || !form.volume || isSubmitting}>{isSubmitting ? "Création..." : "Créer"}</Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODALES BOUTEILLES (SÉCURISÉES & API-DRIVEN)
// =============================================================================

function RemuageModal({ bl, actionType, onClose }) {
  const T = useTheme();
  const { dispatch, refreshData } = useStore();

  const [location, setLocation] = useState(bl.zone || bl.locationZone || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const isRemuage = actionType === "EN_REMUAGE";
  const title = isRemuage ? "Mise en Remuage" : "Mise sur Pointes";
  const statusDest = isRemuage ? "EN_REMUAGE" : "SUR_POINTES";

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bottles/status', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ 
          blId: parseInt(bl.id), 
          status: statusDest, 
          location, 
          note: `${title} - Emplacement: ${location}`,
          idempotencyKey 
        })
      });

      if (!res.ok) throw new Error((await res.json()).error || "Erreur de changement de statut");

      dispatch({ type: "TOAST_ADD", payload: { msg: `Lot passé en statut: ${statusDest.replace('_', ' ')}`, color: T.accent } });
      if (refreshData) await refreshData();
      onClose();
    } catch (e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <div style={{ background:T.surfaceHigh, padding:14, borderRadius:4, marginBottom:20, fontSize:12, color:T.textDim, borderLeft:`3px solid ${T.accent}` }}>
        Enregistre l'évolution du cycle de vieillissement en base de données.
      </div>
      <FF label="Nouvel emplacement physique">
        <Input value={location} onChange={e => setLocation(e.target.value)} disabled={isSubmitting} placeholder={isRemuage ? "Ex: Gyropalette 4" : "Ex: Caisse-Palette 12"} />
      </FF>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !location}>{isSubmitting ? "Validation..." : "Valider l'opération"}</Btn>
      </div>
    </Modal>
  );
}

function DegorgerModal({ bl, onClose }) {
  const T = useTheme(); 
  const { dispatch, refreshData } = useStore(); 
  
  const [count, setCount] = useState(""); 
  const [sugar, setSugar] = useState(""); 
  const [modeleBouchon, setModeleBouchon] = useState(""); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  
  const max = bl.currentBottleCount || bl.currentCount || 0;

  const getDosageInfo = (val) => {
    if (val === "") return { label: "--", suffix: "", color: T.textDim };
    const g = parseFloat(val);
    if (g === 0)  return { label: "Brut Nature / Zéro Dosage", suffix: "-Nature", color: "#8c7355" }; 
    if (g <= 6)   return { label: "Extra-Brut", suffix: "-EBrut", color: "#a68b6a" };
    if (g <= 12)  return { label: "Brut", suffix: "-Brut", color: T.accent }; 
    if (g <= 17)  return { label: "Extra-Dry", suffix: "-EDry", color: "#e6c27a" };
    if (g <= 32)  return { label: "Sec", suffix: "-Sec", color: "#f0d599" };
    if (g <= 50)  return { label: "Demi-Sec", suffix: "-DSec", color: "#fae8b6" };
    return { label: "Doux", suffix: "-Doux", color: "#fff5d1" };
  };

  const dosageInfo = getDosageInfo(sugar);
  const finalDosageString = sugar !== "" ? `${dosageInfo.label} (${sugar} g/L)` : "Non dosé (0 g/L)";

  const submit = async () => {
    const qtyNum = parseInt(count);
    if (!qtyNum || qtyNum <= 0 || qtyNum > max) return alert("Quantité invalide.");

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bottles/degorger', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          blId: parseInt(bl.id), 
          count: qtyNum, 
          dosage: finalDosageString, 
          suffix: dosageInfo.suffix, 
          note: `Dégorgement. Bouchage: ${modeleBouchon || "Non précisé"}`,
          idempotencyKey 
        }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur de dégorgement");

      dispatch({ type:"TOAST_ADD", payload:{ msg:`${qtyNum} btl dégorgées ! (Création lot Produits Finis)`, color:T.green } }); 
      if (refreshData) await refreshData();
      onClose(); 
    } catch(e) { 
      alert(e.message); 
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Dégorgement" onClose={onClose}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <FF label={`Nombre de btl (max ${max})`}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input type="number" value={count} onChange={e => setCount(e.target.value)} disabled={isSubmitting} style={{ flex: 1 }} />
            <Btn variant="secondary" onClick={() => setCount(max.toString())} disabled={isSubmitting}>MAX</Btn>
          </div>
        </FF>
        <FF label="Sucre ajouté (g/L)">
          <Input type="number" step="0.1" placeholder="Ex: 8" value={sugar} onChange={e => setSugar(e.target.value)} disabled={isSubmitting} />
        </FF>
      </div>

      <div style={{ marginTop: 4, marginBottom: 16, textAlign: "right", minHeight: 24 }}>
        {sugar !== "" && <div style={{ fontSize: 11, color: T.textDim }}>Catégorie AOC : <Badge label={dosageInfo.label} color={dosageInfo.color} /></div>}
      </div>
      
      <div style={{ marginTop: 8 }}>
        <FF label="Modèle de Bouchon Liège (Optionnel)">
          <Input value={modeleBouchon} onChange={e => setModeleBouchon(e.target.value)} disabled={isSubmitting} placeholder="Ex: Mytik - MD5" />
        </FF>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !count || sugar === ""} style={{ background: isSubmitting ? T.textDim : T.accent }}>
          {isSubmitting ? "Traitement..." : "Valider le dégorgement"}
        </Btn>
      </div>
    </Modal>
  );
}

function HabillerModal({ bl, onClose }) {
  const T = useTheme(); 
  const { state, dispatch, refreshData } = useStore();
  
  const [count, setCount] = useState(""); 
  const [coiffeId, setCoiffeId] = useState("");
  const [etiquetteId, setEtiquetteId] = useState("");
  const [cartonId, setCartonId] = useState("");
  const [cartonSize, setCartonSize] = useState("6");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  
  const max = bl.currentBottleCount || bl.currentCount || 0;

  const coiffes = (state.products || []).filter(p => p.subCategory === "Coiffes");
  const etiquettes = (state.products || []).filter(p => p.subCategory === "Étiquettes" || p.subCategory === "Contre-étiquettes");
  const cartons = (state.products || []).filter(p => p.subCategory === "Cartons");

  const submit = async () => {
    const qtyNum = parseInt(count);
    if (!qtyNum || qtyNum <= 0 || qtyNum > max) return alert("Quantité invalide.");

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bottles/habiller', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          blId: parseInt(bl.id), count: qtyNum, 
          coiffeId: coiffeId ? parseInt(coiffeId) : null,
          etiquetteId: etiquetteId ? parseInt(etiquetteId) : null,
          cartonId: cartonId ? parseInt(cartonId) : null,
          cartonSize: parseInt(cartonSize),
          idempotencyKey 
        }) 
      });

      if (!res.ok) throw new Error((await res.json()).error || "Erreur d'habillage");

      dispatch({ type:"TOAST_ADD", payload:{ msg:`${qtyNum} btl habillées. Stocks déduits !`, color:"#9960aa" } }); 
      if (refreshData) await refreshData();
      onClose(); 
    } catch(e) { alert(e.message); }
    finally { setIsSubmitting(false); }
  };

  return (
    <Modal title={`Habillage & Mise en carton`} onClose={onClose}>
      <FF label={`Nombre de bouteilles à habiller (max ${max})`}>
        <div style={{ display: "flex", gap: 8 }}>
          <Input type="number" value={count} onChange={e => setCount(e.target.value)} disabled={isSubmitting} style={{ flex: 1 }} />
          <Btn variant="secondary" onClick={() => setCount(max.toString())} disabled={isSubmitting}>MAX</Btn>
        </div>
      </FF>

      <div style={{ border:`1px solid ${T.border}`, borderRadius:4, padding:16, marginBottom:16, marginTop: 16 }}>
        <div style={{ fontSize:12, fontWeight:"bold", color:T.accent, marginBottom:12, textTransform:"uppercase" }}>Habillage (Unité)</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FF label="Coiffe">
            <Select value={coiffeId} onChange={e => setCoiffeId(e.target.value)} disabled={isSubmitting}>
              <option value="">-- Sans coiffe --</option>
              {coiffes.map(p => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
            </Select>
          </FF>
          <FF label="Étiquette">
            <Select value={etiquetteId} onChange={e => setEtiquetteId(e.target.value)} disabled={isSubmitting}>
              <option value="">-- Sans étiquette --</option>
              {etiquettes.map(p => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
            </Select>
          </FF>
        </div>
      </div>

      <div style={{ border:`1px solid ${T.border}`, borderRadius:4, padding:16, marginBottom:20 }}>
        <div style={{ fontSize:12, fontWeight:"bold", color:T.textDim, marginBottom:12, textTransform:"uppercase" }}>Mise en Carton</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
          <FF label="Format">
            <Select value={cartonSize} onChange={e => setCartonSize(e.target.value)} disabled={isSubmitting}>
              <option value="1">Unité (1)</option><option value="3">Carton de 3</option><option value="6">Carton de 6</option>
            </Select>
          </FF>
          <FF label="Modèle de carton">
            <Select value={cartonId} onChange={e => setCartonId(e.target.value)} disabled={isSubmitting}>
              <option value="">-- Sans carton --</option>
              {cartons.map(p => <option key={p.id} value={p.id}>{p.name} ({p.currentStock} dispo)</option>)}
            </Select>
          </FF>
        </div>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !count} style={{ background: "#9960aa", borderColor: "#9960aa", color: "#fff" }}>
          {isSubmitting ? "Traitement..." : "Valider l'habillage"}
        </Btn>
      </div>
    </Modal>
  );
}

function ExpedierModal({ bl, onClose }) {
  const T = useTheme(); 
  const { dispatch, refreshData } = useStore();
  
  const [count, setCount] = useState(""); 
  const [clientName, setClientName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const max = bl.currentBottleCount || bl.currentCount || 0;

  const submit = async () => {
    const qtyNum = parseInt(count);
    if (!qtyNum || qtyNum <= 0 || qtyNum > max) return alert("Quantité invalide.");
    if (!clientName.trim()) return alert("Nom du client requis.");

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/bottles/expedier', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          blId: parseInt(bl.id), count: qtyNum, clientName, idempotencyKey 
        }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur d'expédition");

      dispatch({ type:"TOAST_ADD", payload:{ msg:`${qtyNum} expédiées à ${clientName}`, color:T.green } }); 
      if (refreshData) await refreshData();
      onClose(); 
    } catch(e) { alert(e.message); }
    finally { setIsSubmitting(false); }
  };

  return (
    <Modal title="Expédition" onClose={onClose}>
      <FF label={`Nombre (max ${max})`}>
        <div style={{ display: "flex", gap: 8 }}>
          <Input type="number" value={count} onChange={e => setCount(e.target.value)} disabled={isSubmitting} style={{ flex: 1 }} />
          <Btn variant="secondary" onClick={() => setCount(max.toString())} disabled={isSubmitting}>MAX</Btn>
        </div>
      </FF>
      <FF label="Nom du Client / Acheteur">
        <Input value={clientName} onChange={e => setClientName(e.target.value)} disabled={isSubmitting} />
      </FF>
      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !count || !clientName}>
          {isSubmitting ? "Traitement..." : "Valider l'expédition"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// STOCK BOUTEILLES (Cycle Complet)
// =============================================================================
function StockBouteilles({ onSelectLot }) {
  const T = useTheme(); 
  const { state } = useStore();
  
  const [tab, setTab] = useState("vieillissement"); 
  const [modal, setModal] = useState(null); 
  const [selBl, setSelBl] = useState(null);
  
  const vieillissement = (state.bottleLots || []).filter(b => ["SUR_LATTES", "EN_REMUAGE", "SUR_POINTES", "A_DEGORGER"].includes(b.status));
  const aHabiller = (state.bottleLots || []).filter(b => b.status === "EN_CAVE" || b.status === "DEGORGE");
  const finis = (state.bottleLots || []).filter(b => b.status === "PRET_EXPEDITION");
  const reserves = (state.bottleLots || []).filter(b => b.status === "RESERVE");

  const getAgingMonths = (dateStr) => {
    if (!dateStr) return 0;
    const tirageDate = new Date(dateStr);
    const diffTime = Math.abs(new Date() - tirageDate);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
  };

  const formatStatus = (s) => s ? s.replace(/_/g, ' ') : "INCONNU";

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Stock Bouteilles</h1>
      </div>
      
      <div style={{ display:"flex", gap: 10, marginBottom:20, flexWrap: "wrap" }}>
        {["vieillissement", "habillage", "finis", "reserves"].map((t) => {
          const labels = { vieillissement: `VIEILLISSEMENT (${vieillissement.length})`, habillage: `À HABILLER (${aHabiller.length})`, finis: `PRÊTS (${finis.length})`, reserves: `VINS DE RÉSERVE (${reserves.length})` };
          return (
            <button key={t} onClick={() => setTab(t)} style={{ background: tab===t ? T.accent : "transparent", color: tab===t ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
              {labels[t]}
            </button>
          )
        })}
      </div>

      {tab === "vieillissement" && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 70px 90px 100px 1fr 100px 180px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1 }}>
            <div>Code Tirage</div><div>Format</div><div>Stock</div><div>Statut</div><div>Emplacement</div><div>Tirage (Âge)</div><div>Action (Cycle)</div>
          </div>
          {vieillissement.length === 0 ? <div style={{ padding:"40px", textAlign:"center", color:T.textDim }}>Aucune bouteille en vieillissement.</div> : vieillissement.map((b, i) => {
            const age = getAgingMonths(b.tirageDate);
            const isReady = age >= 15;
            const btlCount = b.currentBottleCount || b.currentCount || 0;
            
            return (
              <div key={b.id} style={{ display:"grid", gridTemplateColumns:"2fr 70px 90px 100px 1fr 100px 180px", padding:"14px 16px", alignItems:"center", borderBottom:i<vieillissement.length-1?`1px solid ${T.border}`:"none" }}>
                <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>{b.code || b.businessCode}</div>
                <div style={{ fontSize:13, color:T.text }}>{b.format || b.formatCode}</div>
                <div style={{ fontSize:14, color:T.textStrong, fontWeight:"bold" }}>{btlCount}</div>
                <div><Badge label={formatStatus(b.status)} color={BOTTLE_STATUS_COLORS[b.status] || T.textDim} /></div>
                <div style={{ fontSize:12, color:T.textDim }}>{b.zone || b.locationZone || "--"}</div>
                <div style={{ fontSize:12, color: isReady ? T.accent : T.textDim, fontWeight: isReady ? "bold" : "normal" }}>{b.tirageDate ? `${age} mois` : "--"}</div>
                
                <div style={{ display: "flex", gap: 6 }}>
                  {b.status === "SUR_LATTES" && (
                    <Btn variant="secondary" style={{ fontSize:10, padding:"6px 8px", flex: 1, opacity: isReady ? 1 : 0.6, borderColor: T.accent, color: T.accent }} disabled={!isReady} onClick={() => { setSelBl(b); setModal("remuage_start"); }}>
                      {isReady ? "REMUAGE" : "🔒 < 15 MOIS"}
                    </Btn>
                  )}
                  {b.status === "EN_REMUAGE" && (
                    <Btn variant="secondary" style={{ fontSize:10, padding:"6px 8px", flex: 1, borderColor: "#e6a15c", color: "#e6a15c" }} onClick={() => { setSelBl(b); setModal("pointes_start"); }}>
                      S/ POINTES
                    </Btn>
                  )}
                  {(b.status === "SUR_POINTES" || b.status === "A_DEGORGER") && (
                    <Btn variant="primary" style={{ fontSize:10, padding:"6px 8px", flex: 1 }} onClick={() => { setSelBl(b); setModal("degorger"); }}>
                      DÉGORGER
                    </Btn>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "habillage" && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 140px 1fr 110px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1 }}>
            <div>Code Lot</div><div>Format</div><div>Stock (Nues)</div><div>Emplacement</div><div>Statut</div><div>Action</div>
          </div>
          {aHabiller.length === 0 ? <div style={{ padding:"40px", textAlign:"center", color:T.textDim }}>Aucune bouteille nue en attente d'habillage.</div> : aHabiller.map((b, i) => (
            <div key={b.id} style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 140px 1fr 110px", padding:"14px 16px", alignItems:"center", borderBottom:i<aHabiller.length-1?`1px solid ${T.border}`:"none" }}>
              <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>{b.code || b.businessCode}</div>
              <div style={{ fontSize:13, color:T.text }}>{b.format || b.formatCode}</div>
              <div style={{ fontSize:15, color:T.textStrong, fontWeight:"bold" }}>{b.currentBottleCount || b.currentCount} btl</div>
              <div style={{ fontSize:12, color:T.textDim }}>{b.zone || b.locationZone || "--"}</div>
              <div><Badge label={formatStatus(b.status)} color={BOTTLE_STATUS_COLORS[b.status]} /></div>
              <div>
                <Btn variant="primary" style={{ fontSize:10, padding:"6px 12px", width:"100%", background:"#9960aa", borderColor:"#9960aa" }} onClick={() => { setSelBl(b); setModal("habiller"); }}>
                  HABILLER
                </Btn>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "finis" && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 140px 1fr 110px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1 }}>
            <div>Code Dégorgement</div><div>Format</div><div>Stock Dispo</div><div>Date Dégorg.</div><div>Dosage</div><div>Action</div>
          </div>
          {finis.length === 0 ? <div style={{ padding:"40px", textAlign:"center", color:T.textDim }}>Aucun produit fini prêt à l'expédition.</div> : finis.map((b, i) => (
            <div key={b.id} style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 140px 1fr 110px", padding:"14px 16px", alignItems:"center", borderBottom:i<finis.length-1?`1px solid ${T.border}`:"none" }}>
              <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>{b.code || b.businessCode}</div>
              <div style={{ fontSize:13, color:T.text }}>{b.format || b.formatCode}</div>
              <div style={{ fontSize:15, color:T.textStrong, fontWeight:"bold" }}>{b.currentBottleCount || b.currentCount} btl</div>
              <div style={{ fontSize:11, color:T.textDim, fontFamily:"monospace" }}>{b.degorgDate || b.degorgementDate ? new Date(b.degorgDate || b.degorgementDate).toLocaleDateString('fr-FR') : "--"}</div>
              <div style={{ fontSize:12, color:T.textDim }}>{b.dosage || (b.dosageValue ? `${b.dosageValue} g/L` : "--")}</div>
              <div><Btn variant="primary" style={{ fontSize:10, padding:"6px 12px", width:"100%" }} onClick={() => { setSelBl(b); setModal("expedier"); }}>EXPÉDIER</Btn></div>
            </div>
          ))}
        </div>
      )}

      {tab === "reserves" && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 140px 1fr", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1 }}>
            <div>Code Lot (Réserve)</div><div>Format</div><div>Stock Actuel</div><div>Date Tirage</div><div>Emplacement</div>
          </div>
          {reserves.length === 0 ? (
             <div style={{ padding:"40px", textAlign:"center", color:T.textDim }}>Aucun vin de réserve en bouteilles.</div>
          ) : reserves.map((b, i) => (
            <div key={b.id} style={{ display:"grid", gridTemplateColumns:"2fr 80px 120px 140px 1fr", padding:"14px 16px", alignItems:"center", borderBottom:i<reserves.length-1?`1px solid ${T.border}`:"none" }}>
              <div onClick={() => onSelectLot && onSelectLot(b)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor:"pointer", textDecoration:"underline" }}>{b.code || b.businessCode}</div>
              <div style={{ fontSize:13, color:T.text }}>{b.format || b.formatCode}</div>
              <div style={{ fontSize:15, color:T.textStrong, fontWeight:"bold" }}>{b.currentBottleCount || b.currentCount} btl</div>
              <div style={{ fontSize:11, color:T.textDim, fontFamily:"monospace" }}>{b.tirageDate ? new Date(b.tirageDate).toLocaleDateString('fr-FR') : "--"}</div>
              <div style={{ fontSize:12, color:T.textDim }}>{b.zone || b.locationZone || "--"}</div>
            </div>
          ))}
        </div>
      )}

      {modal === "remuage_start" && selBl && <RemuageModal bl={selBl} actionType="EN_REMUAGE" onClose={() => setModal(null)} />}
      {modal === "pointes_start" && selBl && <RemuageModal bl={selBl} actionType="SUR_POINTES" onClose={() => setModal(null)} />}
      {modal === "degorger" && selBl && <DegorgerModal bl={selBl} onClose={() => setModal(null)} />}
      {modal === "habiller" && selBl && <HabillerModal bl={selBl} onClose={() => setModal(null)} />}
      {modal === "expedier" && selBl && <ExpedierModal bl={selBl} onClose={() => setModal(null)} />}
    </div>
  );
}

// =============================================================================
// LISTE DES LOTS (ACTIFS / HISTORIQUE)
// =============================================================================
function Lots({ onSelectLot }) {
  const T = useTheme(); 
  const { state } = useStore();
  
  const [tab, setTab] = useState("actifs"); 
  const [search, setSearch] = useState("");
  const [filterMillesimes, setFilterMillesimes] = useState([]);
  const [filterCepages, setFilterCepages] = useState([]);
  const [filterLieux, setFilterLieux] = useState([]);
  const [filterContainers, setFilterContainers] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);

  const GROUPS = {
    CUVES: ["CUVE_INOX", "CUVE_BETON", "CUVE_EMAIL", "CUVE_FIBRE", "CUVE_PLASTIQUE", "CUVE_DEBOURBAGE"],
    BOIS: ["BARRIQUE", "FOUDRE"],
    SOUS_PRODUITS: ["CUVE_BOURBES", "CUVE_LIES", "CUVE_REBECHES"]
  };

  const formatVolShort = (vol) => typeof vol === 'number' ? `${vol.toFixed(1)} hL` : `${vol} hL`;
  const formatStatus = (s) => s ? s.replace(/_/g, ' ') : "INCONNU";

  const unifiedLots = [
    ...(state.lots || []).map(l => ({ ...l, _type: 'bulk', code: l.businessCode || l.code, millesime: l.year || l.millesime, volume: l.currentVolume || l.volume, containerId: l.currentContainerId || l.containerId })),
    ...(state.bottleLots || []).map(b => {
      const src = (state.lots || []).find(l => l.id == b.sourceLotId);
      return {
        ...b,
        _type: 'bottle',
        code: b.businessCode || b.code,
        millesime: src?.year || src?.millesime || "--",
        cepage: src?.mainGrapeCode || src?.cepage || "MULTI",
        lieu: b.locationZone || b.zone || "--",
        volume: b.currentBottleCount || b.currentCount, 
        containerId: null,
        format: b.formatCode || b.format
      };
    })
  ];

  const uniqueMillesimes = [...new Set(unifiedLots.map(l => l.millesime))].filter(m => m && m !== "--").sort((a,b) => b - a).map(String);
  const uniqueLieux = [...new Set(unifiedLots.map(l => l.lieu).filter(Boolean))].filter(l => l !== "--").sort();
  const uniqueStatuses = [...new Set(unifiedLots.map(l => l.status))].sort();
  
  const containerCategories = ["Cuves", "Bois", "Citernes", "Bouteilles", "Sous-produits", "Vrac (Sans contenant)", "Autre"];

  const actifsCount = unifiedLots.filter(l => {
    const isDeadBulk = l._type === 'bulk' && (l.volume <= 0 || ["ASSEMBLE", "TIRE", "ARCHIVE"].includes(l.status));
    const isDeadBottle = l._type === 'bottle' && l.volume <= 0; 
    return !(isDeadBulk || isDeadBottle);
  }).length;

  const historiqueCount = unifiedLots.length - actifsCount;

  const filtered = unifiedLots.filter(l => {
    const isDeadBulk = l._type === 'bulk' && (l.volume <= 0 || ["ASSEMBLE", "TIRE", "ARCHIVE"].includes(l.status));
    const isDeadBottle = l._type === 'bottle' && l.volume <= 0;
    const isDead = isDeadBulk || isDeadBottle;
    
    if (tab === "actifs" && isDead) return false;
    if (tab === "historique" && !isDead) return false;

    const container = (l._type === 'bulk' && !isDeadBulk) ? (state.containers || []).find(c => c.id === l.containerId) : null;

    const matchSearch = !search || (l.code || "").toLowerCase().includes(search.toLowerCase());
    const matchMillesime = filterMillesimes.length === 0 || filterMillesimes.includes(l.millesime?.toString());
    const matchCepage = filterCepages.length === 0 || filterCepages.includes(l.cepage);
    const matchLieu = filterLieux.length === 0 || filterLieux.includes(l.lieu);
    const matchStatus = filterStatuses.length === 0 || filterStatuses.includes(l.status);
    
    let matchContainer = true;
    if (filterContainers.length > 0) {
      if (l._type === 'bottle') {
        matchContainer = filterContainers.includes("Bouteilles");
      } else if (!container) {
        matchContainer = filterContainers.includes("Vrac (Sans contenant)");
      } else {
        const t = (container.type || "").toLowerCase();
        const n = ((container.displayName || container.name) || "").toLowerCase();
        const isSousProduit = GROUPS.SOUS_PRODUITS.includes(container.type) || t.includes("bourbe") || t.includes("lies") || t.includes("rebeche") || n.includes("bourbe") || n.includes("lies") || n.includes("rebeche");

        if (isSousProduit) {
          matchContainer = filterContainers.includes("Sous-produits");
        } else if (GROUPS.CUVES.includes(container.type)) {
          matchContainer = filterContainers.includes("Cuves");
        } else if (GROUPS.BOIS.includes(container.type)) {
          matchContainer = filterContainers.includes("Bois");
        } else if (container.type === "CITERNE" || container.type === "COMPARTIMENT") {
          matchContainer = filterContainers.includes("Citernes");
        } else {
          matchContainer = filterContainers.includes("Autre");
        }
      }
    }

    return matchSearch && matchMillesime && matchCepage && matchLieu && matchStatus && matchContainer;
  });

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Lots</h1>
      </div>
      
      <div style={{ display:"flex", gap: 10, marginBottom:20 }}>
        <button onClick={() => setTab("actifs")} style={{ background: tab==="actifs" ? T.accent : "transparent", color: tab==="actifs" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
          LOTS ACTIFS ({actifsCount})
        </button>
        <button onClick={() => setTab("historique")} style={{ background: tab==="historique" ? T.accent : "transparent", color: tab==="historique" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
          HISTORIQUE ({historiqueCount})
        </button>
      </div>

      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Recherche code..." style={{ width:180 }} />
        
        <MultiSelectDrop label="Tous millésimes" options={uniqueMillesimes} selected={filterMillesimes} onChange={setFilterMillesimes} width={150} />
        <MultiSelectDrop label="Tous cépages" options={CEPAGES} selected={filterCepages} onChange={setFilterCepages} width={130} />
        <MultiSelectDrop label="Tous lieux-dits" options={uniqueLieux} selected={filterLieux} onChange={setFilterLieux} width={150} />
        <MultiSelectDrop label="Tous contenants" options={containerCategories} selected={filterContainers} onChange={setFilterContainers} width={180} />
        <MultiSelectDrop label="Tous statuts" options={uniqueStatuses} selected={filterStatuses} onChange={setFilterStatuses} format={formatStatus} width={160} />

        {(search || filterMillesimes.length > 0 || filterCepages.length > 0 || filterLieux.length > 0 || filterContainers.length > 0 || filterStatuses.length > 0) && (
          <Btn variant="ghost" onClick={() => { setSearch(""); setFilterMillesimes([]); setFilterCepages([]); setFilterLieux([]); setFilterContainers([]); setFilterStatuses([]); }}>
            Effacer filtres
          </Btn>
        )}
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 60px 80px 90px 110px 1fr 130px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1 }}>
          <div>Code Lot</div><div>Mill.</div><div>Cép.</div><div>Volume</div><div>Contenant</div><div>Lieu / Zone</div><div>Statut</div>
        </div>
        
        {filtered.length === 0 && (
          <div style={{ padding:"40px", textAlign:"center", color:T.textDim }}>Aucun lot dans cette section.</div>
        )}

        {filtered.map((l, i) => {
          const isDeadBulk = l._type === 'bulk' && (l.volume <= 0 || ["ASSEMBLE", "TIRE", "ARCHIVE"].includes(l.status));
          const container = (l._type === 'bulk' && !isDeadBulk) ? (state.containers || []).find(c => c.id === l.containerId) : null;
          
          return (
            <div key={l.code} onClick={() => onSelectLot(l)} style={{ display:"grid", gridTemplateColumns:"2fr 60px 80px 90px 110px 1fr 130px", padding:"14px 16px", borderBottom: i < filtered.length-1 ? `1px solid ${T.border}` : "none", cursor:"pointer", alignItems:"center", opacity: tab === "historique" ? 0.6 : 1 }} onMouseEnter={e => e.currentTarget.style.background = T.surfaceHigh} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600 }}>{l.code}</div>
              <div style={{ fontSize:13, color:T.text }}>{l.millesime}</div>
              <div style={{ fontSize:12, color:T.accentLight, fontFamily:"monospace" }}>{l.cepage}</div>
              <div style={{ fontSize:13, color:T.text }}>
                {l._type === 'bottle' ? `${l.volume} btl` : (l.volume > 0 ? formatVolShort(l.volume) : "0 hL")}
              </div>
              <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>
                {l._type === 'bottle' ? l.format : (container ? (container.displayName || container.name) : (isDeadBulk ? "--" : "Vrac"))}
              </div>
              <div style={{ fontSize:12, color:T.textDim }}>{l.lieu || "--"}</div>
              <Badge label={formatStatus(l.status)} color={LOT_STATUS_COLORS[l.status] || T.textDim} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// MODULE PLANIFICATEUR DE TIRAGE (SÉCURISÉ & STATELESS)
// =============================================================================
function PlanificateurTirage() {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore();

  const [activeTab, setActiveTab] = useState("MIXTION");
  
  // Sécurité et UX pour l'appel API
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // --- ÉTATS MÉTIER (Valeurs par défaut, plus de LocalStorage) ---
  const [tirageDays, setTirageDays] = useState([
    { id: 1, name: "Lundi", vinBaseVolume: 31.5 },
    { id: 2, name: "Mardi", vinBaseVolume: 31.5 },
    { id: 3, name: "Mercredi", vinBaseVolume: 31.5 },
    { id: 4, name: "Jeudi", vinBaseVolume: 31.5 },
    { id: 5, name: "Vendredi", vinBaseVolume: 15.0 },
  ]);

  const [tirageStocks, setTirageStocks] = useState({
    bouteilles: 20000, magnums: 1200,
    bidules: 20000, capsules: 20000, 
    bouchonsLiege: 5000, agrafes: 5000
  });

  const [config, setConfig] = useState({
    mixTargetPressure: 6.0, mixLevainPct: 3.0, mixLevainSugar: 20,
    mixSugarSource: "LIQUEUR", mixLiqueurSugar: 530,
    tirageFormat: 0.75, tirageBouchage: "CAPSULE",
    levainTemp: 16,
    alimVolLevain: 18.6, alimVolFinal: 23.8,
    alimDensiteVeille: 1005, alimDensiteMatin: 998, alimLiqueurG: 530, alimAlcVin: 11.0
  });

  const updateConfig = (key, value) => { setConfig(prev => ({ ...prev, [key]: value })); };

  // --- ÉTATS VOLATILES (Sélections actuelles de cuves) ---
  const [mixBaseTankId, setMixBaseTankId] = useState("");
  const [mixLevainTankId, setMixLevainTankId] = useState("");
  const [mixDestTankId, setMixDestTankId] = useState("");
  const [mixVolVinSaisi, setMixVolVinSaisi] = useState("");

  const [createLevainSourceId, setCreateLevainSourceId] = useState("");
  const [alimSourceTankId, setAlimSourceTankId] = useState("");
  const [alimLevainTankId, setAlimLevainTankId] = useState("");

  // ===========================================================================
  // FILTRAGE DES CUVES
  // ===========================================================================
  const getContainerLot = (c) => state.lots?.find(l => String(l.id) === String(c.lotId));

  const cuvesVinBase = (state.containers || []).filter(c => {
    if (parseFloat(c.currentVolume) <= 0) return false;
    const t = (c.type || "").toUpperCase();
    const n = (c.displayName || c.name || "").toUpperCase();
    if (t.includes("BOURBE") || t.includes("LIE") || t.includes("REBECHE")) return false;
    if (n.includes("BOURBE") || n.includes("LIE") || n.includes("REBECHE")) return false;
    const lot = getContainerLot(c);
    if (!lot) return false;
    if (lot.status !== "VIN_CLAIR" && lot.status !== "ASSEMBLAGE") return false;
    return true;
  });

  const cuvesTirage = (state.containers || []).filter(c => {
    if (parseFloat(c.currentVolume) > 0) return false; 
    if (c.zone !== "Cuverie") return false;
    const t = (c.type || "").toUpperCase();
    const n = (c.displayName || c.name || "").toUpperCase();
    if (t.includes("BELON") || t.includes("DEBOURBAGE")) return false;
    if (t.includes("BOURBE") || t.includes("LIE") || t.includes("REBECHE")) return false;
    if (n.includes("BOURBE") || n.includes("LIE") || n.includes("REBECHE")) return false;
    if (t.includes("FOUDRE") || t.includes("CITERNE") || t.includes("RESERVE") || t.includes("AUTRE")) return false;
    if (t.includes("CUVE") || n.includes("CUVE")) return true;
    return false;
  });

  const cuvesLevain = (state.containers || []).filter(c => {
    const t = (c.type || "").toUpperCase();
    const n = (c.displayName || c.name || "").toUpperCase();
    return t.includes("LEVAIN") || n.includes("LEVAIN");
  });

  // ===========================================================================
  // CALCULS : MIXTION (PRÉVISUALISATION FRONTEND)
  // ===========================================================================
  const selectedBaseTank = cuvesVinBase.find(c => String(c.id) === String(mixBaseTankId));
  const baseVol = mixVolVinSaisi !== "" ? parseFloat(mixVolVinSaisi) : (selectedBaseTank ? parseFloat(selectedBaseTank.currentVolume) : 0);
  const getTargetSugar = (bars) => (bars * 4) * (25.4 / 24.0); 

  const calcMixtionPreview = () => {
    if (!baseVol || baseVol <= 0) return null;
    const baseSugar = 1.0; 
    const targetSugarGF = getTargetSugar(config.mixTargetPressure);
    const volLevain = baseVol * (config.mixLevainPct / 100);
    const volVinLevain = baseVol + volLevain;
    const sucreVinLevain = ((baseVol * baseSugar) + (volLevain * config.mixLevainSugar)) / volVinLevain;
    const sucreManquant = targetSugarGF - sucreVinLevain;
    
    if (sucreManquant <= 0) return { error: "Le vin contient déjà trop de sucre pour cette pression." };

    let volLiqueur = 0, poidsSucre = 0, volMixtion = 0;
    if (config.mixSugarSource === "LIQUEUR") {
      volLiqueur = (volVinLevain * sucreManquant) / (config.mixLiqueurSugar - sucreManquant);
      volMixtion = volVinLevain + volLiqueur;
    } else {
      poidsSucre = (volVinLevain * sucreManquant) / (1 - (sucreManquant * 0.00063));
      volMixtion = volVinLevain + (poidsSucre * 0.00063);
    }

    const deltaRho = (targetSugarGF - baseSugar) / 2.5;
    const nbCols = Math.floor((volMixtion * 100) / config.tirageFormat);

    return {
      volVin: baseVol.toFixed(2), volLevain: volLevain.toFixed(2),
      volLiqueur: volLiqueur > 0 ? volLiqueur.toFixed(3) : null,
      poidsSucre: poidsSucre > 0 ? poidsSucre.toFixed(1) : null,
      volMixtion: volMixtion.toFixed(2), deltaRho: deltaRho.toFixed(1),
      targetSugar: targetSugarGF.toFixed(1), nbCols
    };
  };
  const resMix = calcMixtionPreview();

  // ===========================================================================
  // CALCULS : PLANNING HEBDOMADAIRE (Page 2)
  // ===========================================================================
  const calcWeeklyPlanning = () => {
    let taux = 0.78; 
    if (config.levainTemp === 20) taux = 0.70;
    if (config.levainTemp === 13) taux = 0.87;

    const baseSugar = 1.0; 
    const targetSugarGF = getTargetSugar(config.mixTargetPressure);

    const cascadeResult = [];
    let volNextDayLevain = 0; 
    
    let cBtls = config.tirageFormat === 0.75 ? tirageStocks.bouteilles : tirageStocks.magnums;
    let cF1 = config.tirageBouchage === "CAPSULE" ? tirageStocks.bidules : tirageStocks.bouchonsLiege;
    let cF2 = config.tirageBouchage === "CAPSULE" ? tirageStocks.capsules : tirageStocks.agrafes;

    const levainNeeds = [...tirageDays].reverse().map((day, index) => {
      const vVin = parseFloat(day.vinBaseVolume) || 0;
      const besoinLevain = vVin * (config.mixLevainPct / 100);
      let volToFeed = index === 0 ? 0 : volNextDayLevain * taux; 
      let totalLevainCuveMatin = volToFeed + besoinLevain;
      let alimentation = index === 0 ? 0 : volNextDayLevain - volToFeed;
      volNextDayLevain = totalLevainCuveMatin; 
      return { ...day, besoinLevain, totalLevainCuveMatin, resteCuve: volToFeed, alimentation };
    }).reverse(); 

    levainNeeds.forEach(day => {
      const vVin = parseFloat(day.vinBaseVolume) || 0;
      const vLevain = day.besoinLevain;
      const volVinLevain = vVin + vLevain;
      let volMixtion = 0;
      
      if (vVin > 0) {
        const sucreVinLevain = ((vVin * baseSugar) + (vLevain * config.mixLevainSugar)) / volVinLevain;
        const sucreManquant = targetSugarGF - sucreVinLevain;
        if (config.mixSugarSource === "LIQUEUR") {
          volMixtion = volVinLevain + ((volVinLevain * sucreManquant) / (config.mixLiqueurSugar - sucreManquant));
        } else {
          volMixtion = volVinLevain + (((volVinLevain * sucreManquant) / (1 - (sucreManquant * 0.00063))) * 0.00063);
        }
      }

      const nbColsTires = Math.floor((volMixtion * 100) / config.tirageFormat);
      cBtls -= nbColsTires; cF1 -= nbColsTires; cF2 -= nbColsTires;

      cascadeResult.push({
        ...day, volMixtion, nbColsTires, stockBouteilles: cBtls, stockF1: cF1, stockF2: cF2
      });
    });

    return cascadeResult;
  };
  const cascade = calcWeeklyPlanning();
  const maxLevainVol = cascade.length > 0 ? Math.max(...cascade.map(r => r.totalLevainCuveMatin)) : 0;

  // ===========================================================================
  // CALCULS : ALIMENTATION (Page 3)
  // ===========================================================================
  const calcAlimentation = () => {
    const vLevain = parseFloat(config.alimVolLevain) || 0;
    const vFinal = parseFloat(config.alimVolFinal) || 0;
    if (!vLevain || !vFinal || vFinal <= vLevain) return null;
    const sucreConsomme = (config.alimDensiteVeille - config.alimDensiteMatin) * 2.5;
    const vLiqueur = (vFinal * (20 + sucreConsomme) - (vLevain * 20)) / config.alimLiqueurG;
    const alcLiqueur = config.alimLiqueurG >= 600 ? 6.8 : 7.5; 
    const alcNeeds = (vFinal * 12.0) - (vLevain * 12.0) - (vLiqueur * alcLiqueur) - (vFinal * (sucreConsomme / 16.8));
    const vVin = alcNeeds / config.alimAlcVin;
    const vEau = vFinal - (vLevain + vVin + vLiqueur);
    return { sucreConsomme: sucreConsomme.toFixed(1), vLiqueur: vLiqueur > 0 ? vLiqueur.toFixed(3) : "0.000", vVin: vVin > 0 ? vVin.toFixed(2) : "0.00", vEau: vEau > 0 ? vEau.toFixed(2) : "0.00", dap: ((vFinal * 100 * 20) / 1000).toFixed(2) };
  };
  const resAlim = calcAlimentation();

  // ===========================================================================
  // ACTIONS DE CUVERIE INTELLIGENTES (SÉCURISÉES)
  // ===========================================================================

  const handleAutoCreateLevain = async () => {
    if (!createLevainSourceId) {
      dispatch({ type: "TOAST_ADD", payload: { msg: "Sélectionnez la cuve de vin qui servira à créer le levain.", color: T.red } });
      return;
    }
    
    const sourceTank = state.containers.find(c => String(c.id) === String(createLevainSourceId));
    if (!sourceTank || parseFloat(sourceTank.currentVolume) < maxLevainVol) {
      dispatch({ type: "TOAST_ADD", payload: { msg: `Volume insuffisant dans la cuve source. Il vous faut au moins ${maxLevainVol.toFixed(1)} hL.`, color: T.red } });
      return;
    }

    setIsSubmitting(true);
    const suggestedCap = Math.ceil(maxLevainVol * 1.2);
    try {
      const res = await fetch('/api/containers', { 
        method: 'POST', 
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ 
          name: "Cuve à Levain", displayName: "Cuve Levain (Actif)", 
          type: "CUVE_INOX", capacityValue: suggestedCap,
          status: "PLEINE", zone: "Cuverie", currentVolume: parseFloat(maxLevainVol.toFixed(2)) 
        }) 
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la création de la cuve.");
        
      const newSourceVol = parseFloat(sourceTank.currentVolume) - maxLevainVol;
      dispatch({
        type: "SET_CONTAINERS",
        payload: state.containers.map(c => c.id === sourceTank.id ? { ...c, currentVolume: newSourceVol } : c)
      });

      dispatch({ type: "ADD_CONTAINER", payload: data });
      dispatch({ type: "TOAST_ADD", payload: { msg: `Levain créé ! ${maxLevainVol.toFixed(1)} hL prélevés.`, color: T.green } });
      
      setMixLevainTankId(data.id);
      setAlimLevainTankId(data.id);
      updateConfig('alimVolFinal', maxLevainVol);
      
      if (refreshData) await refreshData();
      
    } catch(e: any) { 
      dispatch({ type: "TOAST_ADD", payload: { msg: `Erreur : ${e.message}`, color: T.red } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValiderAlimentation = async () => {
    if (!alimSourceTankId || !alimLevainTankId) {
      dispatch({ type: "TOAST_ADD", payload: { msg: "Sélectionnez la cuve source (vin) et la cuve levain.", color: T.red } });
      return;
    }
    if (!resAlim) {
      dispatch({ type: "TOAST_ADD", payload: { msg: "Les volumes saisis sont incohérents.", color: T.red } });
      return;
    }

    const sourceTank = state.containers.find(c => String(c.id) === String(alimSourceTankId));
    const levainTank = state.containers.find(c => String(c.id) === String(alimLevainTankId));

    const vVinNeeded = parseFloat(resAlim.vVin);
    if (parseFloat(sourceTank.currentVolume) < vVinNeeded) {
      dispatch({ type: "TOAST_ADD", payload: { msg: `Volume insuffisant dans la cuve source. Il vous faut ${vVinNeeded.toFixed(2)} hL.`, color: T.red } });
      return;
    }

    // Ici on applique la mise à jour optimiste frontend (en attendant ton API d'alimentation dédiée)
    const newSourceVol = Math.max(0, parseFloat(sourceTank.currentVolume) - vVinNeeded);
    const newLevainVol = parseFloat(config.alimVolFinal);

    dispatch({
      type: "SET_CONTAINERS",
      payload: state.containers.map(c => {
        if (c.id === sourceTank.id) return { ...c, currentVolume: newSourceVol };
        if (c.id === levainTank.id) return { ...c, currentVolume: newLevainVol };
        return c;
      })
    });

    dispatch({ type: "TOAST_ADD", payload: { msg: `Alimentation validée ! Levain remonté à ${newLevainVol} hL.`, color: T.green } });
  };

  const handleValiderMixtion = async () => {
    if (!mixBaseTankId || !mixDestTankId || !mixLevainTankId) {
      dispatch({ type: "TOAST_ADD", payload: { msg: "Sélectionnez la cuve de base, la cuve de levain, et la cuve de destination.", color: T.red } });
      return;
    }
    if (!resMix || resMix.error) {
      dispatch({ type: "TOAST_ADD", payload: { msg: "Corrigez les erreurs de calcul avant de valider.", color: T.red } });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        baseTankId: mixBaseTankId,
        levainTankId: mixLevainTankId,
        destTankId: mixDestTankId,
        baseVolToDraw: parseFloat(mixVolVinSaisi) || parseFloat(selectedBaseTank.currentVolume),
        targetPressure: parseFloat(config.mixTargetPressure),
        levainPct: parseFloat(config.mixLevainPct),
        levainSugar: parseFloat(config.mixLevainSugar),
        sugarSource: config.mixSugarSource,
        liqueurSugar: parseFloat(config.mixLiqueurSugar),
        tirageFormat: parseFloat(config.tirageFormat),
        tirageBouchage: config.tirageBouchage,
        idempotencyKey: idempotencyKey || crypto.randomUUID()
      };

      const res = await fetch('/api/mixtion/execute', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Une erreur est survenue lors de l'enregistrement.");
        throw new Error(data.message || data.error || "Une erreur est survenue lors de l'enregistrement.");
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: `Succès : ${data.volMixtion.toFixed(2)}hL préparés en cuve !`, color: T.green } });
      
      setIdempotencyKey(crypto.randomUUID());
      if (refreshData) await refreshData();
      
      setMixVolVinSaisi("");
      setMixDestTankId("");

    } catch (e: any) {
      dispatch({ type: "TOAST_ADD", payload: { msg: `Opération refusée : ${e.message}`, color: T.red } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Préparation & Tirage</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Calculs des mixtions, propagation des levains et anticipation des matières sèches.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant={activeTab === "MIXTION" ? "primary" : "secondary"} onClick={() => setActiveTab("MIXTION")}>🍷 Mixtion & Mise</Btn>
          <Btn variant={activeTab === "PLANNING" ? "primary" : "secondary"} onClick={() => setActiveTab("PLANNING")}>📅 Planning & Stocks</Btn>
          <Btn variant={activeTab === "ALIM" ? "primary" : "secondary"} onClick={() => setActiveTab("ALIM")}>🧪 Alimentation Jour.</Btn>
        </div>
      </div>

      {activeTab === "MIXTION" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.accentLight, marginBottom: 16 }}>1. Source & Levain</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <FF label="Cuve d'assemblage (Vin clair)">
                  <Select value={mixBaseTankId} disabled={isSubmitting} onChange={e => {
                    setMixBaseTankId(e.target.value);
                    if (e.target.value) {
                      const c = cuvesVinBase.find(x => String(x.id) === String(e.target.value));
                      if (c) setMixVolVinSaisi(c.currentVolume);
                    } else { setMixVolVinSaisi(""); }
                  }}>
                    <option value="">-- Mode Libre (Manuelle) --</option>
                    {cuvesVinBase.map(c => {
                      const lot = getContainerLot(c);
                      const codeDisplay = lot ? `[${lot.code}]` : "";
                      return <option key={c.id} value={c.id}>{c.displayName || c.name} {codeDisplay} - {parseFloat(c.currentVolume).toFixed(2)} hL</option>
                    })}
                  </Select>
                </FF>
                <FF label="Volume de vin à tirer (hL)">
                  <Input type="number" step="0.1" value={mixVolVinSaisi} disabled={isSubmitting} onChange={e => setMixVolVinSaisi(e.target.value)} />
                </FF>
              </div>
              <FF label="Cuve de Levain (Mère)">
                <Select value={mixLevainTankId} disabled={isSubmitting} onChange={e => setMixLevainTankId(e.target.value)} style={{ borderColor: !mixLevainTankId ? T.accent : T.border }}>
                  <option value="">-- Sélectionner le levain actif --</option>
                  {cuvesLevain.length === 0 && <option disabled>Aucune cuve à levain détectée en cuverie.</option>}
                  {cuvesLevain.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name} - {parseFloat(c.currentVolume).toFixed(2)} hL dispo</option>)}
                </Select>
              </FF>
            </div>

            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>2. Objectifs & Sucrage</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <FF label="Pression visée (Bars)"><Input type="number" step="0.1" value={config.mixTargetPressure} disabled={isSubmitting} onChange={e => updateConfig('mixTargetPressure', e.target.value)} /></FF>
                <FF label="% de Levain"><Input type="number" step="0.1" value={config.mixLevainPct} disabled={isSubmitting} onChange={e => updateConfig('mixLevainPct', e.target.value)} /></FF>
              </div>
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: T.text, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" checked={config.mixSugarSource === "LIQUEUR"} onChange={() => updateConfig('mixSugarSource', "LIQUEUR")} disabled={isSubmitting} /> Liqueur/MCR
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, color: T.text, fontSize: 13, cursor: "pointer" }}>
                  <input type="radio" checked={config.mixSugarSource === "SUCRE"} onChange={() => updateConfig('mixSugarSource', "SUCRE")} disabled={isSubmitting} /> Sucre Sec
                </label>
              </div>
              {config.mixSugarSource === "LIQUEUR" && (
                <FF label="Concentration Liqueur (g/L)">
                  <Input type="number" value={config.mixLiqueurSugar} disabled={isSubmitting} onChange={e => updateConfig('mixLiqueurSugar', e.target.value)} />
                </FF>
              )}
            </div>

            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.accent}55` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.accentLight, marginBottom: 16 }}>3. Embouteillage</div>
              <FF label="Cuve de Destination (Mixtion & Tirage)" style={{ marginBottom: 16 }}>
                <Select value={mixDestTankId} disabled={isSubmitting} onChange={e => setMixDestTankId(e.target.value)} style={{ borderColor: !mixDestTankId ? T.accent : T.border }}>
                  <option value="">-- Sélectionner une cuve de tirage vide --</option>
                  {cuvesTirage.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name}</option>)}
                </Select>
              </FF>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Format Bouteille">
                  <Select value={config.tirageFormat} disabled={isSubmitting} onChange={e => updateConfig('tirageFormat', parseFloat(e.target.value))}>
                    <option value={0.75}>Champenoise (75 cl)</option>
                    <option value={1.5}>Magnum (1.5 L)</option>
                  </Select>
                </FF>
                <FF label="Type Bouchage">
                  <Select value={config.tirageBouchage} disabled={isSubmitting} onChange={e => updateConfig('tirageBouchage', e.target.value)}>
                    <option value="CAPSULE">Capsule + Bidule</option>
                    <option value="LIEGE">Liège + Agrafe</option>
                  </Select>
                </FF>
              </div>
            </div>
          </div>

          <div>
            <div style={{ position: "sticky", top: 20, background: T.surface, padding: 32, borderRadius: 8, border: `2px solid ${T.accent}`, opacity: isSubmitting ? 0.6 : 1, pointerEvents: isSubmitting ? "none" : "auto", transition: "opacity 0.2s" }}>
              <div style={{ fontSize: 12, color: T.accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: "bold", marginBottom: 24, textAlign: "center" }}>Recette de la Cuve de Mixtion</div>
              {!resMix ? (
                <div style={{ textAlign: "center", color: T.textDim, fontStyle: "italic", padding: "40px 0" }}>Veuillez indiquer un volume de vin à tirer.</div>
              ) : resMix.error ? (
                <div style={{ textAlign: "center", color: T.red, fontWeight: "bold", padding: "40px 0" }}>{resMix.error}</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: `1px dashed ${T.border}` }}>
                    <div style={{ fontSize: 14, color: T.textDim }}>1. Vin de Base :</div>
                    <div style={{ fontSize: 18, color: T.textStrong, fontWeight: "bold", fontFamily: "monospace" }}>{resMix.volVin} hL</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: `1px dashed ${T.border}` }}>
                    <div style={{ fontSize: 14, color: T.textDim }}>2. Levain ({config.mixLevainPct}%) :</div>
                    <div style={{ fontSize: 18, color: T.textStrong, fontWeight: "bold", fontFamily: "monospace" }}>{resMix.volLevain} hL</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 14, color: T.textDim }}>3. {config.mixSugarSource === "LIQUEUR" ? "Liqueur :" : "Sucre sec :"}</div>
                    <div style={{ fontSize: 22, color: T.accentLight, fontWeight: "bold", fontFamily: "monospace" }}>
                      {config.mixSugarSource === "LIQUEUR" ? `+ ${resMix.volLiqueur} hL` : `+ ${resMix.poidsSucre} kg`}
                    </div>
                  </div>
                  <div style={{ background: T.bg, padding: 20, borderRadius: 6, marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 12, textTransform: "uppercase", color: T.textDim, fontWeight: "bold" }}>Volume Total Cuve</div>
                      <div style={{ fontSize: 24, color: T.textStrong, fontWeight: "bold", fontFamily: "monospace" }}>{resMix.volMixtion} hL</div>
                    </div>
                    <div style={{ borderTop: `1px solid ${T.border}`, margin: "16px 0" }} />
                    <div style={{ fontSize: 12, textTransform: "uppercase", color: T.accent, fontWeight: "bold", marginBottom: 8 }}>🔍 Contrôle Densité (Après brassage)</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 13, color: T.text }}>Augmentation de densité (<span style={{fontFamily:"monospace"}}>Δρ</span>)</div>
                      <div style={{ fontSize: 16, color: T.green, fontWeight: "bold", fontFamily: "monospace" }}>+ {resMix.deltaRho}</div>
                    </div>
                  </div>
                  <div style={{ background: T.accent+"11", border: `1px solid ${T.accent}44`, padding: 20, borderRadius: 6, marginTop: 8 }}>
                    <div style={{ fontSize: 12, textTransform: "uppercase", color: T.accentLight, fontWeight: "bold", marginBottom: 16 }}>📦 Tirage & Matières Sèches</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 14, color: T.textStrong, fontWeight: "bold" }}>Nombre de cols estimés :</div>
                      <div style={{ fontSize: 22, color: T.textStrong, fontWeight: "bold", fontFamily: "monospace" }}>{resMix.nbCols.toLocaleString('fr-FR')}</div>
                    </div>
                  </div>
                  <Btn 
                    onClick={handleValiderMixtion} 
                    disabled={isSubmitting || !mixBaseTankId || !mixLevainTankId || !mixDestTankId}
                    style={{ width: "100%", marginTop: 16, height: 48, fontSize: 14, background: isSubmitting ? T.textDim : T.accent, transition: "background 0.2s" }}
                  >
                    {isSubmitting ? "Enregistrement sécurisé en cours..." : "Valider & Lancer la Mixtion"}
                  </Btn>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "PLANNING" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: T.surfaceHigh, padding: "20px 24px", borderRadius: 8, border: `1px solid ${T.border}`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: "bold", color: T.accentLight, marginBottom: 4 }}>Température de Cuve à Levain</div>
                <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>Détermine la vitesse de multiplication nocturne des levures.</div>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                {[13, 16, 20].map(temp => (
                  <button key={temp} onClick={() => updateConfig('levainTemp', temp)} style={{ flex: 1, padding: "8px 0", borderRadius: 4, border: `1px solid ${config.levainTemp === temp ? T.accent : T.border}`, background: config.levainTemp === temp ? T.accent+"22" : T.surface, color: config.levainTemp === temp ? T.accent : T.textDim, fontWeight: "bold", cursor: "pointer" }}>
                    {temp} °C
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, padding: "20px 24px", borderRadius: 8, border: `1px dashed ${T.border}` }}>
              <div style={{ fontSize: 12, fontWeight: "bold", color: T.textDim, textTransform: "uppercase", marginBottom: 12 }}>Inventaire Initial (Modifiable)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize: 12 }}><span>Bouteilles:</span> <Input type="number" value={tirageStocks.bouteilles} onChange={e=>setTirageStocks({...tirageStocks, bouteilles: parseInt(e.target.value)||0})} style={{width: 70, height: 24, fontSize:11}} /></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize: 12 }}><span>Bidules:</span> <Input type="number" value={tirageStocks.bidules} onChange={e=>setTirageStocks({...tirageStocks, bidules: parseInt(e.target.value)||0})} style={{width: 70, height: 24, fontSize:11}} /></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize: 12 }}><span>Capsules:</span> <Input type="number" value={tirageStocks.capsules} onChange={e=>setTirageStocks({...tirageStocks, capsules: parseInt(e.target.value)||0})} style={{width: 70, height: 24, fontSize:11}} /></div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "250px 1fr", gap: 32 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 20 }}>Programme de Tirage</div>
              <div style={{ fontSize: 11, color: T.textDim, marginBottom: 12, fontStyle: "italic" }}>Saisissez le volume de <strong>vin de base</strong> à tirer chaque jour.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {tirageDays.map(day => (
                  <div key={day.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottom: `1px dashed ${T.border}` }}>
                    <div style={{ fontSize: 14, color: T.text }}>{day.name}</div>
                    <Input 
                      type="number" step="0.5" 
                      value={day.vinBaseVolume} 
                      onChange={e => setTirageDays(tirageDays.map(d => d.id === day.id ? { ...d, vinBaseVolume: e.target.value } : d))}
                      style={{ width: 70, textAlign: "center" }} 
                      title="Volume de vin en hL"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "16px 20px", background: T.surfaceHigh, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong }}>Cycle de vie de la Cuve à Levain</div>
                  <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase" }}>Hypothèse : {config.mixLevainPct}% Levain | Dilution : {config.levainTemp === 16 ? "0.78" : config.levainTemp === 20 ? "0.70" : "0.87"}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "80px 100px 100px 100px 1fr 100px", padding: "12px 20px", background: T.bg, borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: "bold", color: T.textDim, textTransform: "uppercase", gap: 10 }}>
                  <div>Jour</div>
                  <div style={{ textAlign: "center" }} title="Volume total présent dans la cuve le matin avant le tirage.">Vol. Matin</div>
                  <div style={{ textAlign: "center", color: T.accentLight }} title="Ce que vous prélevez pour la mixtion du jour.">Prélèvement</div>
                  <div style={{ textAlign: "center" }} title="Ce qu'il reste dans la cuve.">Reste Cuve</div>
                  <div style={{ textAlign: "center", color: T.green }} title="Vin + Eau + Sucre ajoutés pour nourrir les levures.">Alimentation</div>
                  <div style={{ textAlign: "right" }} title="Volume cible que la cuve atteindra le lendemain matin après multiplication.">Cible Demain</div>
                </div>
                {cascade.map((p, i) => (
                  <div key={p.id} style={{ display: "grid", gridTemplateColumns: "80px 100px 100px 100px 1fr 100px", padding: "16px 20px", alignItems: "center", borderBottom: i < cascade.length - 1 ? `1px solid ${T.border}` : "none", gap: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: "bold", color: T.textStrong }}>{p.name}</div>
                    <div style={{ textAlign: "center", fontSize: 14, fontWeight: "bold", fontFamily: "monospace", color: p.totalLevainCuveMatin === maxLevainVol ? T.accent : T.textDim }}>{p.totalLevainCuveMatin.toFixed(1)} hL</div>
                    <div style={{ textAlign: "center", fontSize: 13, color: T.accentLight, fontWeight: "bold" }}>-{p.besoinLevain.toFixed(2)} hL</div>
                    <div style={{ textAlign: "center", fontSize: 13, color: T.textDim }}>{p.resteCuve.toFixed(2)} hL</div>
                    <div style={{ textAlign: "center", fontSize: 13, color: T.green, fontWeight: "bold" }}>{p.alimentation > 0 ? `+ ${p.alimentation.toFixed(2)} hL` : "-"}</div>
                    <div style={{ textAlign: "right", fontSize: 13, fontFamily: "monospace", color: T.textDim }}>{i < cascade.length -1 ? cascade[i+1].totalLevainCuveMatin.toFixed(1) : "0.0"} hL</div>
                  </div>
                ))}
                <div style={{ padding: 20, background: T.bg, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ fontSize: 20 }}>💡</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: "bold", color: T.textStrong }}>Création de la Cuve à Levain</div>
                      <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>Besoin initial : <strong>{maxLevainVol.toFixed(1)} hL</strong>.</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <Select value={createLevainSourceId} onChange={e => setCreateLevainSourceId(e.target.value)} style={{ width: 180, fontSize: 12 }}>
                      <option value="">-- Pomper le vin depuis --</option>
                      {cuvesVinBase.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
                    </Select>
                    <Btn onClick={handleAutoCreateLevain} style={{ fontSize: 12, padding: "8px 16px" }} disabled={isSubmitting || !createLevainSourceId}>{isSubmitting ? "Création..." : "+ Créer le Levain"}</Btn>
                  </div>
                </div>
              </div>

              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "12px 20px", background: T.surfaceHigh, borderBottom: `1px solid ${T.border}`, fontSize: 14, fontWeight: "bold", color: T.textStrong }}>
                  Consommation des Matières Sèches
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "80px 100px 100px 1fr 1fr 1fr", padding: "12px 20px", background: T.bg, borderBottom: `1px solid ${T.border}`, fontSize: 10, fontWeight: "bold", color: T.textDim, textTransform: "uppercase", gap: 10 }}>
                  <div>Jour</div>
                  <div style={{ textAlign: "center" }}>Tirage Mixtion</div>
                  <div style={{ textAlign: "center" }}>Cols tirés</div>
                  <div style={{ textAlign: "right" }}>Stock Btls</div>
                  <div style={{ textAlign: "right" }}>Stock {config.tirageBouchage === "CAPSULE" ? "Bidules" : "Liège"}</div>
                  <div style={{ textAlign: "right" }}>Stock {config.tirageBouchage === "CAPSULE" ? "Capsules" : "Agrafes"}</div>
                </div>
                {cascade.map((p, i) => {
                  const isBtlLow = p.stockBouteilles < 0;
                  const isF1Low = p.stockF1 < 0;
                  const isF2Low = p.stockF2 < 0;
                  const hasShortage = isBtlLow || isF1Low || isF2Low;
                  return (
                    <div key={p.id} style={{ display: "grid", gridTemplateColumns: "80px 100px 100px 1fr 1fr 1fr", padding: "12px 20px", alignItems: "center", borderBottom: i < cascade.length - 1 ? `1px solid ${T.border}` : "none", background: hasShortage ? T.red+"11" : "transparent", gap: 10 }}>
                      <div style={{ fontSize: 13, fontWeight: "bold", color: hasShortage ? T.red : T.textStrong }}>{p.name}</div>
                      <div style={{ textAlign: "center", fontSize: 13, color: T.text }}>{p.volMixtion.toFixed(1)} hL</div>
                      <div style={{ textAlign: "center", fontSize: 13, color: T.textStrong, fontWeight: "bold" }}>-{p.nbColsTires.toLocaleString('fr-FR')}</div>
                      <div style={{ textAlign: "right", fontSize: 13, fontFamily: "monospace", fontWeight: "bold", color: isBtlLow ? T.red : T.textDim }}>{p.stockBouteilles.toLocaleString('fr-FR')}</div>
                      <div style={{ textAlign: "right", fontSize: 13, fontFamily: "monospace", fontWeight: "bold", color: isF1Low ? T.red : T.textDim }}>{p.stockF1.toLocaleString('fr-FR')}</div>
                      <div style={{ textAlign: "right", fontSize: 13, fontFamily: "monospace", fontWeight: "bold", color: isF2Low ? T.red : T.textDim }}>{p.stockF2.toLocaleString('fr-FR')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "ALIM" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.accentLight, marginBottom: 16 }}>1. Volumes (du Planning)</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Volume Restant (hL)"><Input type="number" step="0.1" value={config.alimVolLevain} onChange={e=>updateConfig('alimVolLevain', e.target.value)} /></FF>
                <FF label="Volume Visé (hL)"><Input type="number" step="0.1" value={config.alimVolFinal} onChange={e=>updateConfig('alimVolFinal', e.target.value)} /></FF>
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>2. Activité des Levures</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Densité VEILLE (ex: 1006)"><Input type="number" value={config.alimDensiteVeille} onChange={e=>updateConfig('alimDensiteVeille', e.target.value)} /></FF>
                <FF label="Densité CE MATIN (ex: 998)"><Input type="number" value={config.alimDensiteMatin} onChange={e=>updateConfig('alimDensiteMatin', e.target.value)} /></FF>
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>3. Intrants</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Liqueur (g/L)"><Input type="number" value={config.alimLiqueurG} onChange={e=>updateConfig('alimLiqueurG', e.target.value)} /></FF>
                <FF label="TAV Vin Nourricier (%)"><Input type="number" step="0.1" value={config.alimAlcVin} onChange={e=>updateConfig('alimAlcVin', e.target.value)} /></FF>
              </div>
            </div>
          </div>

          <div>
            <div style={{ position: "sticky", top: 20, background: T.surface, padding: 32, borderRadius: 8, border: `2px solid ${T.accent}`, boxShadow: `0 10px 30px ${T.accent}22` }}>
              <div style={{ fontSize: 12, color: T.accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: "bold", marginBottom: 24, textAlign: "center" }}>Recette d'Alimentation</div>
              {!resAlim ? (
                <div style={{ textAlign: "center", color: T.textDim, fontStyle: "italic", padding: "40px 0" }}>Vérifiez vos volumes. Le volume visé doit être supérieur au volume restant.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: `1px dashed ${T.border}` }}>
                    <div style={{ fontSize: 13, color: T.textDim }}>Sucre consommé (nuit) :</div>
                    <div style={{ fontSize: 14, color: T.textStrong, fontWeight: "bold" }}>{resAlim.sucreConsomme} g/L</div>
                  </div>
                  <div style={{ padding: "16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 15, color: T.text, fontWeight: "bold" }}>1️⃣ Liqueur :</div>
                      <div style={{ fontSize: 20, color: T.accentLight, fontWeight: "bold", fontFamily: "monospace" }}>+ {resAlim.vLiqueur} hL</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 15, color: T.text, fontWeight: "bold" }}>2️⃣ Vin ({config.alimAlcVin}%) :</div>
                      <div style={{ fontSize: 20, color: T.accentLight, fontWeight: "bold", fontFamily: "monospace" }}>+ {resAlim.vVin} hL</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 15, color: T.text, fontWeight: "bold" }}>3️⃣ Eau pure :</div>
                      <div style={{ fontSize: 20, color: "#3b82f6", fontWeight: "bold", fontFamily: "monospace" }}>+ {resAlim.vEau} hL</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontSize: 15, color: T.text, fontWeight: "bold" }}>4️⃣ Azote (DAP) :</div>
                      <div style={{ fontSize: 20, color: "#10b981", fontWeight: "bold", fontFamily: "monospace" }}>+ {resAlim.dap} kg</div>
                    </div>
                  </div>
                  <div style={{ background: T.accent+"11", border: `1px solid ${T.accent}44`, padding: 20, borderRadius: 6, marginTop: 16 }}>
                    <div style={{ fontSize: 12, textTransform: "uppercase", color: T.accentLight, fontWeight: "bold", marginBottom: 12 }}>🔄 Exécuter l'alimentation</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                      <Select value={alimSourceTankId} onChange={e => setAlimSourceTankId(e.target.value)} style={{ fontSize: 12 }}>
                        <option value="">-- Vin nourricier --</option>
                        {cuvesVinBase.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
                      </Select>
                      <Select value={alimLevainTankId} onChange={e => {
                          setAlimLevainTankId(e.target.value);
                          const t = cuvesLevain.find(c => String(c.id) === String(e.target.value));
                          if (t) updateConfig('alimVolLevain', t.currentVolume);
                      }} style={{ fontSize: 12 }}>
                        <option value="">-- Cuve à Levain --</option>
                        {cuvesLevain.map(c => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
                      </Select>
                    </div>
                    <Btn onClick={handleValiderAlimentation} disabled={!alimSourceTankId || !alimLevainTankId} style={{ width: "100%", fontSize: 13 }}>Valider l'Alimentation</Btn>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ASSEMBLAGES
// =============================================================================
function Assemblages() {
  const T = useTheme(); 
  const { user } = useAuth(); 
  const { state, dispatch, refreshData } = useStore();
  
  const [selected, setSelected] = useState([]); 
  const [volumes, setVolumes] = useState({});
  const [sim, setSim] = useState(false); 
  const [targetCuveId, setTargetCuveId] = useState("");
  const [showAddCuve, setShowAddCuve] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  
  const fmtHL = { "37.5cl":0.00375, "75cl":0.0075, "150cl":0.015, "300cl":0.03 };

  const CEPAGES_BLANCS = ["CH", "ARBANE", "PETIT MESLIER", "PINOT BLANC", "VOLTIS", "CHARDONNAY ROSE"];
  const CEPAGES_NOIRS = ["PN", "PM", "MEUNIER"];

  const availBulk = (state.lots || [])
    .filter(l => l.currentVolume > 0 && l.status !== "TIRE" && l.status !== "ARCHIVE")
    .map(l => ({ ...l, _type: 'bulk', code: l.businessCode || l.code, volume: l.currentVolume || l.volume, cepage: l.mainGrapeCode || l.cepage, millesime: l.year || l.millesime }));
    
  const availBottles = (state.bottleLots || [])
    .filter(b => (b.currentBottleCount || b.currentCount) > 0 && b.status === "RESERVE")
    .map(b => {
      const src = (state.lots || []).find(l => l.id == b.sourceLotId);
      return { 
        ...b, _type: 'bottle', 
        code: b.businessCode || b.code,
        volume: b.currentBottleCount || b.currentCount,
        format: b.formatCode || b.format,
        cepage: src?.mainGrapeCode || src?.cepage || "MULTI", 
        millesime: src?.year || src?.millesime || "SA" 
      };
    });

  const availLots = [...availBulk, ...availBottles].sort((a,b) => a.code.localeCompare(b.code));
  
  const excludedTypes = ["CUVE_BOURBES", "CUVE_LIES", "CUVE_DEBOURBAGE", "COMPARTIMENT"];
  const availCuves = (state.containers || []).filter(c => c.status === "VIDE" && !excludedTypes.includes(c.type) && c.status !== "ARCHIVÉE");
  
  const toggle = lot => { 
    setSim(false); 
    setSelected(selected.find(s => s.id === lot.id) ? selected.filter(s => s.id !== lot.id) : [...selected, lot]); 
  };
  
  const totalVol = selected.reduce((s, l) => {
    const rawVal = parseFloat(volumes[l.id]) || 0;
    if (l._type === 'bottle') return s + (rawVal * (fmtHL[l.format] || 0.0075));
    return s + rawVal;
  }, 0);

  const validCuves = availCuves.filter(c => (c.capacityValue || c.capacity) >= totalVol);
  
  const cmap = {}; 
  selected.forEach(l => { 
    const rawVal = parseFloat(volumes[l.id]) || 0;
    const volHl = l._type === 'bottle' ? rawVal * (fmtHL[l.format] || 0.0075) : rawVal;
    if (totalVol > 0) cmap[l.cepage] = (cmap[l.cepage] || 0) + (volHl / totalVol * 100); 
  });

  const isBdB = Object.keys(cmap).length > 0 && Object.keys(cmap).every(c => CEPAGES_BLANCS.includes(c.toUpperCase()));
  const isBdN = Object.keys(cmap).length > 0 && Object.keys(cmap).every(c => CEPAGES_NOIRS.includes(c.toUpperCase()));
  
  const uniqueYears = [...new Set(selected.map(l => l.millesime?.toString()))].filter(y => y && y !== "--" && y !== "SA" && y !== "NV");
  const isMillesime = uniqueYears.length === 1 && selected.length > 0 && selected.every(l => l.millesime?.toString() === uniqueYears[0]);
  const anneeMillesime = isMillesime ? uniqueYears[0] : null;

  let warning80 = null;
  if (isMillesime && anneeMillesime) {
    const kgYear = (state.pressings || []).filter(p => p.date?.startsWith(anneeMillesime)).reduce((s, p) => s + (parseFloat(p.weight)||0), 0);
    const volTotalYear = (kgYear / 4000) * 25.5;

    let volDejaTire = 0;
    (state.bottleLots || []).forEach(b => {
       const src = (state.lots || []).find(l => l.id == b.sourceLotId);
       if (src && String(src.year || src.millesime) === String(anneeMillesime)) {
           volDejaTire += (b.initialBottleCount || b.initialCount || b.currentBottleCount) * (fmtHL[b.formatCode || b.format] || 0.0075); 
       }
    });

    const projectedVol = volDejaTire + totalVol;
    const pct = volTotalYear > 0 ? (projectedVol / volTotalYear) * 100 : 0;

    if (pct > 80) {
      warning80 = { pct: pct.toFixed(1), volTotalYear: volTotalYear.toFixed(1), projectedVol: projectedVol.toFixed(1), volDejaTire: volDejaTire.toFixed(1) };
    }
  }

  let baseCepage = Object.keys(cmap).length === 1 ? Object.keys(cmap)[0] : "MULTI";
  let suffix = "";
  if (isBdB) suffix += "-BdB";
  if (isBdN) suffix += "-BdN";
  if (isMillesime) suffix += `-M${anneeMillesime}`;

  const proposedCode = `${new Date().getFullYear()}-${baseCepage}-ASSEM-${String((state.lots || []).length+1).padStart(3,"0")}${suffix}`;
  const compoDetails = Object.entries(cmap).map(([c,p]) => `${c} ${p.toFixed(1)}%`).join(" / ") + " | Sources: " + selected.map(l => l.code).join(", ");

  const submitAssemblage = async () => {
    const sourceLotsData = selected.filter(l => l._type === 'bulk').map(l => ({ id: l.id, volumeUsed: parseFloat(volumes[l.id]) || 0 })).filter(s => s.volumeUsed > 0);
    const sourceBottlesData = selected.filter(l => l._type === 'bottle').map(l => ({ id: l.id, countUsed: parseInt(volumes[l.id]) || 0, format: l.format })).filter(s => s.countUsed > 0);
    
    const finalMillesime = isMillesime ? parseInt(anneeMillesime) : "SA";
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/lots/assemblage', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          code: proposedCode, millesime: finalMillesime, cepage: baseCepage, 
          volume: totalVol, sourceLots: sourceLotsData, sourceBottles: sourceBottlesData, 
          targetContainerId: parseInt(targetCuveId), compoDetails,
          idempotencyKey 
        }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur lors de l'assemblage");

      dispatch({ type:"TOAST_ADD", payload:{ msg:`Assemblage ${proposedCode} validé et tracé en base !`, color:"#2d6640" } }); 
      setSim(false); setVolumes({}); setSelected([]);
      setIdempotencyKey(crypto.randomUUID());
      if (refreshData) await refreshData();
    } catch(e) {
      alert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Assemblages</h1>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 340px", gap:16 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:20 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.textDim, marginBottom:16, letterSpacing:1 }}>Lots disponibles</div>
          {availLots.map(l => {
            const isBot = l._type === 'bottle';
            const isSel = selected.find(s=>s.id===l.id);
            return (
              <div key={l.id} onClick={() => { if(!isSubmitting) toggle(l); }} style={{ padding:"12px 14px", marginBottom:8, borderRadius:3, cursor: isSubmitting ? "default" : "pointer", background: isSel ? T.accent+"22":T.surfaceHigh, border:`1px solid ${isSel ? T.accent : T.border}` }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:600 }}>{l.code}</div>
                  {isBot && <Badge label={l.format} color={T.accentLight} />}
                </div>
                <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>
                  {isBot ? `${l.volume} btl` : Number(l.volume.toFixed(2)) + " hL"} - {l.cepage} {l.status === "RESERVE" ? "(RÉSERVE)" : ""}
                </div>
              </div>
            )
          })}
        </div>
        
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:20 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.textDim, marginBottom:16, letterSpacing:1 }}>Volumes prélevés</div>
          {selected.length === 0 && <div style={{ color:T.textDim, fontSize:12, fontStyle:"italic" }}>Sélectionnez des lots à gauche.</div>}
          
          {selected.map(l => {
            const isBot = l._type === 'bottle';
            const maxVal = l.volume;
            const inputVal = volumes[l.id] || "";
            const computedHl = isBot && inputVal ? (parseInt(inputVal) * (fmtHL[l.format] || 0)).toFixed(2) : null;

            return (
              <div key={l.id} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", marginBottom:6 }}>{l.code}</div>
                <div style={{ display:"flex", gap:8 }}>
                  <Input 
                    type="number" step={isBot ? "1" : "0.1"} 
                    placeholder={isBot ? "Nbr de bouteilles" : "Volume hL"}
                    value={inputVal} disabled={isSubmitting}
                    onChange={e => { setSim(false); setVolumes({...volumes,[l.id]:e.target.value}); }} 
                    style={{ flex:1 }} 
                  />
                  <Btn variant="secondary" onClick={() => { setSim(false); setVolumes({...volumes, [l.id]: maxVal}) }} disabled={isSubmitting}>MAX</Btn>
                </div>
                {isBot && computedHl > 0 && (
                  <div style={{ fontSize:10, color:T.textDim, marginTop:4, textAlign:"right" }}>
                    ↳ Équivaut à <span style={{color:T.textStrong, fontWeight:"bold"}}>{computedHl} hL</span>
                  </div>
                )}
              </div>
            )
          })}
          {selected.length > 1 && <Btn onClick={() => setSim(true)} disabled={isSubmitting} style={{ width:"100%", marginTop:12 }}>Simuler l'assemblage</Btn>}
        </div>

        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:20 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.textDim, marginBottom:16, letterSpacing:1 }}>Résultat</div>
          {sim && (
            <>
              <div style={{ fontSize:28, fontFamily:"Georgia,serif", color:T.textStrong, marginBottom:10 }}>{Number(totalVol.toFixed(2))} hL</div>
              <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:"bold", marginBottom:20, wordBreak:"break-all" }}>{proposedCode}</div>
              
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
                {isBdB && <Badge label="🌟 Blanc de Blancs" color="#e6c27a" />}
                {isBdN && <Badge label="🌟 Blanc de Noirs" color="#8c7355" />}
                {isMillesime ? <Badge label={`📅 Millésimé ${anneeMillesime}`} color={T.blue} /> : <Badge label="📅 Sans Année (SA)" color={T.textDim} />}
              </div>

              {warning80 && (
                <div style={{ background: "#d98b2b15", border: `1px solid #d98b2b55`, borderRadius: 4, padding: 14, marginBottom: 16 }}>
                  <div style={{ color: "#d98b2b", fontSize: 12, fontWeight: "bold", marginBottom: 6 }}>⚠️ Alerte AOC : Règle des 80% Millésimé</div>
                  <div style={{ color: T.textStrong, fontSize: 11, lineHeight: 1.4 }}>
                    Vous vous apprêtez à revendiquer <strong>{warning80.projectedVol} hL</strong> de millésime {anneeMillesime} (dont {warning80.volDejaTire} hL déjà tirés en bouteilles par le passé).<br/><br/>
                    Cela représente <strong>{warning80.pct}%</strong> de votre récolte totale pour cette année-là (estimée à {warning80.volTotalYear} hL).<br/><br/>
                    <span style={{color: "#d98b2b"}}>Rappel : Le cahier des charges interdit de dépasser 80%.</span>
                  </div>
                </div>
              )}

              {validCuves.length > 0 ? (
                <FF label="Cuve de réception">
                  <div style={{ display: "flex", gap: 8 }}>
                    <Select value={targetCuveId} onChange={e => setTargetCuveId(e.target.value)} disabled={isSubmitting} style={{ flex: 1 }}>
                      <option value="">-- Choisir --</option>
                      {validCuves.map(c => (<option key={c.id} value={c.id}>{c.displayName || c.name} (Capacité: {c.capacityValue || c.capacity} hL)</option>))}
                    </Select>
                  </div>
                </FF>
              ) : (
                <div style={{ background:T.red+"15", border:`1px solid ${T.red}44`, borderRadius:4, padding:16, marginBottom:16 }}>
                  <div style={{ color:T.red, fontSize:12, marginBottom:10, lineHeight:1.4 }}>⚠️ Aucune cuve vide n'a la capacité suffisante pour accueillir cet assemblage ({Number(totalVol.toFixed(2))} hL requis).</div>
                </div>
              )}
              
              <Btn onClick={submitAssemblage} disabled={isSubmitting || !targetCuveId || totalVol <= 0 || !validCuves.find(c => String(c.id) === String(targetCuveId))} style={{ width:"100%", marginTop:10 }}>
                {isSubmitting ? "Enregistrement base..." : "Valider l'assemblage"}
              </Btn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// LOT DETAIL (Composant Principal pour Fiche Lot)
// =============================================================================
function LotDetail({ lot: initialLot, onBack, onSelectLot }) {
  const T = useTheme(); 
  const { user } = useAuth(); 
  const { state, dispatch, refreshData } = useStore();
  
  const [modal, setModal] = useState(null); 
  const [rightTab, setRightTab] = useState("analyses"); 
  
  const [tirageForm, setTirageForm] = useState({ typeMise: "EFFERVESCENT", format:"75cl", volume:"", count:"", bouchage:"Capsule", modeleBouchage:"", zone:"", note:"" });
  const [statusForm, setStatusForm] = useState({ status: "", note: "" });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Helper local :
  const formatVolShort = (vol) => typeof vol === 'number' ? `${vol.toFixed(1)} hL` : `${vol} hL`;
  const formatStatus = (s) => s ? s.replace(/_/g, ' ') : "INCONNU";

  const isBottle = 'formatCode' in initialLot || 'format' in initialLot || 'initialCount' in initialLot || 'initialBottleCount' in initialLot;
  const lot = isBottle 
    ? ((state.bottleLots || []).find(b => b.id === initialLot.id) || initialLot)
    : ((state.lots || []).find(l => l.id === initialLot.id) || initialLot);

  const unifiedLots = [
    ...(state.lots || []).map(l => ({ ...l, _type: 'bulk', code: l.businessCode || l.code })),
    ...(state.bottleLots || []).map(b => ({ ...b, _type: 'bottle', code: b.businessCode || b.code }))
  ].sort((a, b) => a.code.localeCompare(b.code));

  const currentIndex = unifiedLots.findIndex(l => l.id === lot.id && l._type === (isBottle ? 'bottle' : 'bulk'));
  const prevLot = currentIndex > 0 ? unifiedLots[currentIndex - 1] : null;
  const nextLot = currentIndex < unifiedLots.length - 1 ? unifiedLots[currentIndex + 1] : null;

  const renderNavHeader = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
      <button onClick={onBack} style={{ background:"none", border:`1px solid ${T.border}`, color:T.textDim, padding:"6px 14px", borderRadius:3, cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
        {"<- Retour"}
      </button>
      
      {onSelectLot && (
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            onClick={() => prevLot && onSelectLot(prevLot)} 
            disabled={!prevLot}
            style={{ background:"none", border:`1px solid ${T.border}`, color: prevLot ? T.textStrong : T.textDim, padding:"6px 14px", borderRadius:3, cursor: prevLot ? "pointer" : "default", fontSize:11, fontFamily:"monospace", opacity: prevLot ? 1 : 0.3, transition: "all 0.2s" }}
            onMouseEnter={e => prevLot && (e.currentTarget.style.background = T.surfaceHigh)}
            onMouseLeave={e => prevLot && (e.currentTarget.style.background = "none")}
          >
            {"< Précédent"}
          </button>
          <button 
            onClick={() => nextLot && onSelectLot(nextLot)} 
            disabled={!nextLot}
            style={{ background:"none", border:`1px solid ${T.border}`, color: nextLot ? T.textStrong : T.textDim, padding:"6px 14px", borderRadius:3, cursor: nextLot ? "pointer" : "default", fontSize:11, fontFamily:"monospace", opacity: nextLot ? 1 : 0.3, transition: "all 0.2s" }}
            onMouseEnter={e => nextLot && (e.currentTarget.style.background = T.surfaceHigh)}
            onMouseLeave={e => nextLot && (e.currentTarget.style.background = "none")}
          >
            {"Suivant >"}
          </button>
        </div>
      )}
    </div>
  );

  const sourceLot = isBottle ? (state.lots || []).find(l => l.id == lot.sourceLotId) : null;
  const container = !isBottle ? (state.containers || []).find(c => c.id === (lot.currentContainerId || lot.containerId)) : null;

  const lotAnalyses = (isBottle && sourceLot)
    ? (state.analyses || []).filter(a => a.lotId === sourceLot.id).sort((a,b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime())
    : (state.analyses || []).filter(a => a.lotId === lot.id).sort((a,b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime());

  let displayRecette = "--";
  let sourceCodes = [];
  const notesToParse = isBottle ? sourceLot?.notes : lot.notes;

  if (notesToParse) {
    if (notesToParse.includes("Sources:")) {
      const parts = notesToParse.split("Sources:");
      displayRecette = parts[0].replace("|", "").trim(); 
      sourceCodes = parts[1].split(",").map(c => c.trim());
    } else {
      displayRecette = notesToParse;
    }
  }

  const getAgingMonths = (dateStr) => {
    if (!dateStr) return 0;
    const tirageDate = new Date(dateStr);
    const diffTime = Math.abs(new Date() - tirageDate);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44));
  };

  const handlePrintPDF = () => {
    const pdfVol = isBottle ? `${lot.currentBottleCount || lot.currentCount} btl (${lot.formatCode || lot.format})` : formatVolShort(lot.currentVolume || lot.volume);
    const pdfCont = isBottle ? (lot.locationZone || lot.zone || "Stock Cave") : (container ? (container.displayName || container.name) : "Vrac");
    const pdfMillesime = isBottle ? (sourceLot?.year || sourceLot?.millesime || "--") : (lot.year || lot.millesime);
    const pdfCepage = isBottle ? (sourceLot?.mainGrapeCode || sourceLot?.cepage || "--") : (lot.mainGrapeCode || lot.cepage);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fiche de Traçabilité - ${lot.businessCode || lot.code}</title>
          <style>
            body { font-family: 'Georgia', serif; color: #1a1510; padding: 40px; max-width: 800px; margin: auto; }
            .brand { font-size: 12px; letter-spacing: 4px; text-transform: uppercase; color: #7a7268; text-align: center; margin-bottom: 10px; }
            h1 { font-size: 32px; text-align: center; color: #1a1510; margin-top: 0; margin-bottom: 40px; }
            h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 2px; border-bottom: 1px solid #ccc6bb; padding-bottom: 8px; margin-top: 40px; color: #5a3e0e; }
            .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .grid-item { background: #f5f3ef; padding: 16px; border-radius: 4px; border: 1px solid #e0dbd2; }
            .label { font-family: sans-serif; font-size: 10px; color: #7a7268; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
            .value { font-family: monospace; font-size: 16px; font-weight: bold; color: #2a2520; }
            table { width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 11px; margin-top: 10px; }
            th, td { border-bottom: 1px solid #e0dbd2; padding: 10px 8px; text-align: left; }
            th { text-transform: uppercase; color: #7a7268; font-size: 10px; letter-spacing: 1px; }
          </style>
        </head>
        <body>
          <div class="brand">Domaine · Champagne</div>
          <h1>Fiche de Traçabilité</h1>
          
          <div class="grid">
            <div class="grid-item"><div class="label">Code Lot</div><div class="value">${lot.businessCode || lot.code}</div></div>
            <div class="grid-item"><div class="label">Millésime</div><div class="value">${pdfMillesime}</div></div>
            <div class="grid-item"><div class="label">Cépage</div><div class="value">${pdfCepage}</div></div>
            <div class="grid-item"><div class="label">Volume / Stock</div><div class="value">${pdfVol}</div></div>
            <div class="grid-item"><div class="label">Emplacement</div><div class="value">${pdfCont}</div></div>
            <div class="grid-item"><div class="label">Statut</div><div class="value">${formatStatus(lot.status)}</div></div>
          </div>

          <h2>Analyses Oenologiques ${isBottle ? "(Vin de base)" : ""}</h2>
          <table>
            <thead><tr><th>Date</th><th>pH</th><th>AT (g/L)</th><th>SO2 Libre (mg/L)</th><th>Alcool (% vol)</th></tr></thead>
            <tbody>
              ${lotAnalyses.length > 0 ? lotAnalyses.map(a => `<tr><td>${new Date(a.analysisDate).toLocaleDateString('fr-FR')}</td><td>${a.ph||'--'}</td><td>${a.at||'--'}</td><td>${a.so2Free||'--'}</td><td>${a.alcohol||'--'}</td></tr>`).join('') : `<tr><td colspan="5" style="text-align:center; font-style:italic;">Aucune analyse enregistrée</td></tr>`}
            </tbody>
          </table>
          
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank', 'width=900,height=800');
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // =========================================================
  // RENDU POUR LES BOUTEILLES (TIRAGES / DEGORGEMENTS)
  // =========================================================
  if (isBottle) {
    const statusC = T.accent; 
    const btlCount = lot.currentBottleCount || lot.currentCount || 0;
    const isDeadBottle = btlCount <= 0;
    const ageMois = getAgingMonths(lot.tirageDate);

    return (
      <div>
        {renderNavHeader()}
        
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:24, marginBottom:16, borderLeft:`3px solid ${isDeadBottle ? T.textDim : statusC}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
            <div>
              <div style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:26, color:isDeadBottle ? T.textDim : T.textStrong, marginBottom:6 }}>
                {lot.businessCode || lot.code}
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {isDeadBottle && <Badge label="ÉPUISÉ / HISTORIQUE" color={T.textDim} />}
                <Badge label={formatStatus(lot.status)} color={isDeadBottle ? T.textDim : statusC} />
                <Badge label={lot.formatCode || lot.format} color={isDeadBottle ? T.textDim : T.accentLight} />
                {sourceLot && <Badge label={`Base: ${sourceLot.year || sourceLot.millesime}`} color={T.textDim} />}
              </div>
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <Btn variant="secondary" onClick={handlePrintPDF}>📄 Générer PDF</Btn>
              {!isDeadBottle && (
                <>
                  {["DEGORGE", "EN_CAVE"].includes(lot.status) && (
                    <Btn variant="primary" onClick={() => setModal("habiller")} style={{ background: "#9960aa", borderColor: "#9960aa", color: "#fff" }}>👗 Habiller</Btn>
                  )}
                  {lot.status === "PRET_EXPEDITION" && (
                     <Btn variant="primary" onClick={() => setModal("expedier")}>📦 Expédier</Btn>
                  )}
                </>
              )}
            </div>
          </div>
          
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:16, marginTop:20 }}>
            {[
              ["Stock Actuel", `${btlCount} btl`], 
              ["Emplacement", lot.locationZone || lot.zone || "Non renseigné"], 
              ["Date Tirage", lot.tirageDate ? new Date(lot.tirageDate).toLocaleDateString('fr-FR') : "--"],
              ["Sur Lattes", lot.tirageDate ? `${ageMois} mois` : "--"], 
              ["Recette Base", displayRecette]
            ].map(([k,v]) => (
              <div key={k} style={{gridColumn: k==="Recette Base"?"span 2":"span 1"}}>
                <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{k}</div>
                <div style={{ fontSize:14, color: isDeadBottle ? T.textDim : T.textStrong, fontFamily:"monospace", fontWeight: k==="Sur Lattes" && ageMois>=15 ? "bold" : "normal" }}>
                  {v} 
                  {k === "Sur Lattes" && ageMois >= 36 && <span style={{marginLeft:6}} title="Millésimable">🌟</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
           <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:20 }}>
             <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:14 }}>Timeline Bouteilles</div>
             <div style={{ color:T.textDim, fontSize:12, fontStyle:"italic" }}>Les événements de dégorgement / habillage de l'API s'afficheront ici.</div>
           </div>

           <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:20 }}>
                <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:14 }}>Généalogie & Origines 🧬</div>
                {sourceLot ? (
                   <div 
                      onClick={() => onSelectLot(sourceLot)}
                      style={{ background: T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:4, padding:"12px 16px", cursor:"pointer", display:"inline-flex", flexDirection:"column", gap:4, minWidth:200 }}
                      onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.borderColor = T.accent)}
                      onMouseLeave={e => (e.currentTarget.style.transform = "none", e.currentTarget.style.borderColor = T.border)}
                    >
                      <div style={{ fontSize:10, color:T.textDim }}>Tiré à partir du lot :</div>
                      <div style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, textDecoration: "underline" }}>{sourceLot.businessCode || sourceLot.code}</div>
                    </div>
                ) : (
                   <div style={{ color:T.textDim, fontSize:12, fontStyle:"italic" }}>Lot de base introuvable.</div>
                )}
              </div>
           </div>
        </div>
        
        {/* Modales Bouteilles (Déjà Sécurisées !) */}
        {modal === "habiller" && <HabillerModal bl={lot} onClose={() => setModal(null)} />}
        {modal === "expedier" && <ExpedierModal bl={lot} onClose={() => setModal(null)} />}
      </div>
    );
  }

  // =========================================================
  // RENDU POUR LE VRAC (CUVES / ASSEMBLAGES)
  // =========================================================
  const lotEvents  = (state.events || []).filter(e => e.lotId === lot.id).sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
  const lotFas     = (state.faReadings || []).filter(f => f.lotId === parseInt(lot.id));
  const bulkVol    = lot.currentVolume || lot.volume || 0;
  const isDeadBulk = bulkVol <= 0 || ["ASSEMBLE", "TIRE", "ARCHIVE"].includes(lot.status);

  // Ce POST tape déjà sur l'API existante /api/lots/statuts (qui devra utiliser Zod)
  const submitStatusChange = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/lots/statuts', { 
        method: 'POST', 
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        // 👈 INJECTION DE LA CLÉ ICI :
        body: JSON.stringify({ lotId: lot.id, newStatus: statusForm.status, operator: user.name, note: statusForm.note, idempotencyKey }) 
      });
      
      if (!res.ok) throw new Error((await res.json()).error || "Erreur serveur"); // 👈 GESTION DE L'ERREUR
      
      dispatch({ type:"TOAST_ADD", payload:{ msg:`Statut passé à ${formatStatus(statusForm.status)}`, color:"#2d6640" } }); 
      setModal(null); 
      if (refreshData) await refreshData(); 
      
    } catch(e) {
      alert("Erreur : " + e.message);
      setIdempotencyKey(crypto.randomUUID()); // 👈 NOUVELLE CLÉ GÉNÉRÉE EN CAS D'ERREUR
    } finally { 
      setIsSubmitting(false); 
    }
  };

  // Ce POST tape sur l'API sécurisée /api/tirage que nous avons faite dans le TirageService
const submitTirage = async () => {
  setIsSubmitting(true);
  
  try {
    const isTranquille = tirageForm.typeMise === "TRANQUILLE";
    const finalNote = isTranquille 
      ? `Mise en bouteille tranquille (${tirageForm.bouchage}). ${tirageForm.note || ''}` 
      : `Tirage effervescent (${tirageForm.bouchage}). ${tirageForm.note || ''}`;

    // 1. Calcul automatique du nombre de bouteilles (count)
    const volumeHL = parseFloat(tirageForm.volume);
    const formatLiters = tirageForm.format === "75cl" ? 0.75 : (tirageForm.format === "150cl" ? 1.5 : 0.375);
    const calculatedCount = Math.floor((volumeHL * 100) / formatLiters);

    // 2. On récupère le lot source depuis la cuve sélectionnée
    const sourceLot = container?.currentLots?.[0];
    if (!sourceLot) {
      throw new Error("La cuve sélectionnée est vide. Aucun lot à tirer.");
    }

    // 3. Préparation du payload STRICTEMENT aligné avec Zod (TirageSchema)
    const payload = {
      lotId: sourceLot.id,
      format: tirageForm.format,
      count: calculatedCount,
      volume: volumeHL,
      zone: container?.zone || null, // Optionnel : pour savoir où on range les palettes
      tirageDate: new Date().toISOString(),
      note: finalNote,
      isTranquille: isTranquille,
      idempotencyKey: idempotencyKey || crypto.randomUUID()
    };

    // 4. Appel à l'API blindée
    const res = await fetch('/api/tirage', { 
      method: 'POST', 
      headers: buildApiHeaders(user), 
      headers: buildApiHeaders(user), 
      body: JSON.stringify(payload) 
    });
    
    const data = await res.json();

    // 5. Gestion des erreurs du Backend (Zod ou BusinessLogicError)
    if (!res.ok) {
      throw new Error(data.error || "Une erreur est survenue lors du tirage.");
    }

    // 6. SUCCÈS ! 🎉 Affichage du Toast vert de ton système natif
    dispatch({ 
      type: "TOAST_ADD", 
      payload: { msg: `Tirage validé ! Lot créé : ${data.bottleLotCode}`, color: "#2d6640" } 
    }); 
    
    setModal(null); 
    if (refreshData) await refreshData(); 

  } catch(e: any) {
    // 7. ECHEC ! 🛑 Affichage du Toast rouge avec le message d'erreur strict
    dispatch({ 
      type: "TOAST_ADD", 
      payload: { msg: `Erreur : ${e.message}`, color: "#d93025" } // Code couleur rouge standard
    });
  } finally {
    // 8. On débloque l'UI et on génère une nouvelle clé pour la prochaine tentative
    setIsSubmitting(false);
    setIdempotencyKey(crypto.randomUUID());
  }
};

  const statusC = LOT_STATUS_COLORS[lot.status] || T.textDim;
  const compoBadge = lot.mainGrapeCode || lot.cepage === "MULTI" && lot.notes?.includes("|") ? lot.notes.split("|")[0].trim() : (lot.mainGrapeCode || lot.cepage);

  return (
    <div>
      {renderNavHeader()}
      
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:24, marginBottom:16, borderLeft:`3px solid ${isDeadBulk ? T.textDim : statusC}` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:16 }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:26, color: isDeadBulk ? T.textDim : T.textStrong, marginBottom:6 }}>
              {lot.businessCode || lot.code}
            </div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {isDeadBulk && <Badge label="ARCHIVÉ / VIDE" color={T.textDim} />}
              <Badge label={formatStatus(lot.status)} color={isDeadBulk ? T.textDim : statusC} />
              <Badge label={`Millésime ${lot.year || lot.millesime}`} color={T.textDim} />
              <Badge label={compoBadge} color={isDeadBulk ? T.textDim : T.accent} />
            </div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <Btn variant="secondary" onClick={handlePrintPDF}>📄 Générer PDF</Btn>
            
            {!isDeadBulk && (
              <>
                <Btn variant="secondary" onClick={() => { setStatusForm({ status: lot.status, note: "" }); setModal("status"); }}>Modifier Statut</Btn>
                <Btn variant="ghost" onClick={() => setModal("tirage")} disabled={!["VIN_DE_BASE", "ASSEMBLAGE", "RESERVE", "VIN_ROUGE"].includes(lot.status)}>
                  Tirer / Mettre en bouteille
                </Btn>
              </>
            )}
          </div>
        </div>
        
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:16, marginTop:20 }}>
          {[
            ["Volume", formatVolShort(bulkVol)], 
            ["Contenant", container ? (container.displayName || container.name) : "--"], 
            ["Statut", formatStatus(lot.status)], 
            ["Recette", displayRecette]
          ].map(([k,v]) => (
            <div key={k} style={{gridColumn: k==="Recette"?"span 2":"span 1"}}>
              <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{k}</div>
              <div style={{ fontSize:14, color: isDeadBulk ? T.textDim : T.textStrong, fontFamily:"monospace" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:20, marginBottom:16 }}>
        <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:14 }}>Généalogie & Origines 🧬</div>
        {sourceCodes.length > 0 ? (
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {sourceCodes.map(code => {
              const sLot = (state.lots || []).find(l => (l.businessCode || l.code) === code);
              return (
                <div 
                  key={code} onClick={() => sLot && onSelectLot && onSelectLot(sLot)}
                  style={{ background: T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:4, padding:"12px 16px", cursor: sLot ? "pointer" : "default", transition:"all 0.15s", display:"flex", flexDirection:"column", gap:4, minWidth:200 }}
                  onMouseEnter={e => sLot && (e.currentTarget.style.transform = "translateY(-2px)", e.currentTarget.style.borderColor = T.accent)}
                  onMouseLeave={e => sLot && (e.currentTarget.style.transform = "none", e.currentTarget.style.borderColor = T.border)}
                >
                  <div style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, textDecoration: sLot ? "underline" : "none" }}>{code}</div>
                  <div style={{ fontSize:11, color:T.textDim }}>{sLot ? `Vol actuel: ${formatVolShort(sLot.currentVolume || sLot.volume)}` : "Lot non disponible"}</div>
                </div>
              )
            })}
          </div>
        ) : lot.notes && lot.notes.includes("Issu de") ? (
          <div style={{ fontSize:13, color:T.textStrong }}>🍇 {lot.placeCode || lot.lieu || "Parcelle inconnue"} <span style={{color:T.textDim, fontSize:12, marginLeft:8}}>({lot.notes})</span></div>
        ) : (
          <div style={{ color:T.textDim, fontSize:12, fontStyle:"italic" }}>Racine directe (Parcelle : {lot.placeCode || lot.lieu || "Non renseignée"}).</div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:20 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:2, color:T.textDim, marginBottom:14 }}>Timeline</div>
          {lotEvents.map((e, i) => (
            <div key={e.id} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom: i < lotEvents.length-1 ? `1px solid ${T.border}` : "none" }}>
              <div>
                <div style={{ width:8, height:8, borderRadius:"50%", background:T.accent, marginTop:4 }} />
                {i < lotEvents.length-1 && <div style={{ width:1, height:"100%", background:T.border, margin:"4px auto 0" }} />}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <Badge label={e.eventType || e.type} />
                  <span style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{e.createdAt ? new Date(e.createdAt).toLocaleDateString('fr-FR') : e.date}</span>
                </div>
                <div style={{ fontSize:12, color:T.text, marginTop:6 }}>{e.comment || e.note || "--"}</div>
              </div>
            </div>
          ))}
        </div>
        
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
            <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
              <button onClick={() => setRightTab("analyses")} style={{ flex:1, background: rightTab === "analyses" ? T.accent+"15" : "none", border:"none", borderBottom:`2px solid ${rightTab === "analyses" ? T.accent : "transparent"}`, color: rightTab === "analyses" ? T.accent : T.textDim, padding:"14px 16px", cursor:"pointer", fontSize:11, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:1 }}>Analyses</button>
              <button onClick={() => setRightTab("fa")} style={{ flex:1, background: rightTab === "fa" ? T.red+"15" : "none", border:"none", borderBottom:`2px solid ${rightTab === "fa" ? T.red : "transparent"}`, color: rightTab === "fa" ? T.red : T.textDim, padding:"14px 16px", cursor:"pointer", fontSize:11, fontFamily:"monospace", textTransform:"uppercase", letterSpacing:1 }}>Suivi FA 🌡️</button>
            </div>
            
            {rightTab === "analyses" && (
              <div style={{ padding: 20 }}>
                {lotAnalyses.length === 0 ? <div style={{ color:T.textDim, fontSize:12, fontStyle:"italic" }}>Aucune analyse</div> : lotAnalyses.map(a => <div key={a.id} style={{paddingBottom:8, marginBottom:8, borderBottom:`1px solid ${T.border}`}}><span style={{fontFamily:"monospace", color:T.textDim, fontSize:11}}>{new Date(a.analysisDate || a.date).toLocaleDateString('fr-FR')}</span> - <span style={{color:T.textStrong}}>pH {a.ph}</span></div>)}
              </div>
            )}
            
            {rightTab === "fa" && (
              <div style={{ padding: 20 }}>
                <FaChartContainer data={lotFas} />
              </div>
            )}
          </div>
        </div>
      </div>

      {modal === "status" && (
        <Modal title="Changer statut" onClose={() => setModal(null)}>
          <FF label="Nouveau statut">
            <Select value={statusForm.status} onChange={e => setStatusForm({ ...statusForm, status: e.target.value })} disabled={isSubmitting}>
              {LOT_STATUSES.map(s => <option key={s} value={s}>{formatStatus(s)}</option>)}
            </Select>
          </FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
            <Btn variant="secondary" onClick={() => setModal(null)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={submitStatusChange} disabled={isSubmitting}>{isSubmitting ? "Enregistrement..." : "Valider"}</Btn>
          </div>
        </Modal>
      )}

      {modal === "tirage" && (() => {
        // Logique de vérification AOC
        const isTranquille = tirageForm.typeMise === "TRANQUILLE";
        const baseYear = parseInt(lot.year || lot.millesime) || parseInt((lot.businessCode || lot.code).substring(0,4)) || new Date().getFullYear();
        const nextYear = baseYear + 1;
        const releaseDate = new Date(`${nextYear}-01-01T00:00:00Z`);
        const isTirageBlockedAOC = !isTranquille && new Date() < releaseDate;

        return (
          <Modal title={isTranquille ? "Mise en Bouteille (Vin Tranquille)" : "Tirage (Prise de mousse)"} onClose={() => setModal(null)}>
            
            <div style={{ marginBottom: 20, borderBottom:`1px solid ${T.border}`, paddingBottom: 16 }}>
              <FF label="Type de mise en bouteille">
                <Select value={tirageForm.typeMise} onChange={e=>setTirageForm({...tirageForm, typeMise:e.target.value})} disabled={isSubmitting} style={{ fontWeight:"bold", color: isTranquille ? "#8b1c31" : T.accent }}>
                  <option value="EFFERVESCENT">Prise de mousse (Champagne)</option>
                  <option value="TRANQUILLE">Vin Tranquille (Coteaux / Rouge)</option>
                </Select>
              </FF>
              {isTranquille && (
                <div style={{ fontSize:11, color:"#8b1c31", marginTop:8, fontStyle:"italic" }}>
                  ℹ️ Ce lot contournera l'étape de dégorgement et ira directement "En Cave".
                </div>
              )}
            </div>

            {isTirageBlockedAOC && (
              <div style={{ background:T.red+"15", border:`1px solid ${T.red}55`, borderRadius:4, padding:14, marginBottom: 16 }}>
                <div style={{ color:T.red, fontSize:12, fontWeight:"bold", marginBottom:4 }}>🚨 Blocage AOC : Tirage prématuré</div>
                <div style={{ color:T.red, fontSize:11, lineHeight:1.4 }}>
                  Le tirage pour la prise de mousse d'un vin de base de la vendange {baseYear} est strictement interdit avant le 1er janvier {nextYear}.
                </div>
              </div>
            )}

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <FF label="Format">
                <Select value={tirageForm.format} onChange={e => setTirageForm({...tirageForm, format:e.target.value})} disabled={isSubmitting}>
                  {["37.5cl","75cl","150cl"].map(f => <option key={f}>{f}</option>)}
                </Select>
              </FF>
              <FF label={`Volume hL (Max ${bulkVol})`}>
                <Input type="number" step="0.1" value={tirageForm.volume} onChange={e => setTirageForm({...tirageForm, volume:e.target.value})} disabled={isSubmitting} />
              </FF>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginTop: 8 }}>
              <FF label="Type de bouchage">
                <Select value={tirageForm.bouchage} onChange={e => setTirageForm({...tirageForm, bouchage:e.target.value})} disabled={isSubmitting}>
                  {!isTranquille && <option value="Capsule">Capsule</option>}
                  <option value="Liège">Liège</option>
                </Select>
              </FF>
              <FF label="Modèle (Marque - Réf)">
                <Input value={tirageForm.modeleBouchage} onChange={e => setTirageForm({...tirageForm, modeleBouchage:e.target.value})} disabled={isSubmitting} placeholder="Ex: Trescases - 29x29" />
              </FF>
            </div>

            <FF label="Notes (Optionnel)">
              <Input value={tirageForm.note} onChange={e => setTirageForm({...tirageForm, note:e.target.value})} disabled={isSubmitting} placeholder="Ex: Ajout de levures spécifiques..." />
            </FF>

            <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:16 }}>
              <Btn variant="secondary" onClick={() => setModal(null)} disabled={isSubmitting}>Annuler</Btn>
              <Btn onClick={submitTirage} disabled={isSubmitting || !tirageForm.volume || isTirageBlockedAOC}>
                {isSubmitting ? "Tirage en cours..." : "Valider le tirage"}
              </Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// =============================================================================
// EXPÉDITIONS & DISTILLERIE (100% BACKEND AUTHORITY)
// =============================================================================
function Expeditions({ onSelectLot }) {
  const T = useTheme(); 
  const { user } = useAuth();
  const { state, dispatch, refreshData } = useStore();
  
  const [tab, setTab] = useState("bouteilles");
  
  // Plus de deliveredIds local ! 
  // On utilise l'état du serveur via confirmDeliveryId
  const [confirmDeliveryId, setConfirmDeliveryId] = useState(null);
  const [isValidatingDelivery, setIsValidatingDelivery] = useState(false);
  const [modalDistillerie, setModalDistillerie] = useState(false);

  // --- LOGIQUE MÉTIER ---
  // On filtre les expéditions depuis les événements du store (chargés via fetchAll)
  const expeditionsBouteilles = (state.events || [])
    .filter(e => e.type === "EXPEDITION")
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const expeditionsDistillerie = (state.events || [])
    .filter(e => e.type === "DISTILLERIE" || (e.type === "PERTE" && e.note?.includes("[DISTILLERIE]")))
    .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const citernesEtComps = (state.containers || []).filter(c => c.type === "CITERNE" || c.type === "COMPARTIMENT");
  const vracLots = (state.lots || []).filter(l => citernesEtComps.some(c => String(c.id) === String(l.currentContainerId)));

  // --- ACTION SÉCURISÉE ---
  const executeDelivery = async () => {
    if (!confirmDeliveryId) return;
    setIsValidatingDelivery(true);
    
    try {
      // On met à jour le statut DIRECTEMENT en base de données
      const res = await fetch('/api/containers', { 
        method: 'PUT',
        headers: buildApiHeaders(user), 
        headers: buildApiHeaders(user), 
        body: JSON.stringify({ 
          id: parseInt(confirmDeliveryId), 
          status: 'LIVRE' // Le backend devient le seul juge du statut
        }) 
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Erreur serveur");
      }
      
      dispatch({ type: "TOAST_ADD", payload: { msg: "Expédition archivée et marquée comme livrée.", color: T.green } });
      
      // On rafraîchit les données pour que tous les utilisateurs voient le changement
      if (refreshData) await refreshData();

    } catch(e) { 
      dispatch({ type: "TOAST_ADD", payload: { msg: e.message, color: T.red } });
    } finally {
      setIsValidatingDelivery(false);
      setConfirmDeliveryId(null);
    }
  };

  const parseBottleNote = (note) => {
    const match = note?.match(/(\d+)\s*btl/);
    const qty = match ? match[0] : "--";
    let details = note || "";
    if (details.includes("- Client :")) {
       details = "Client : " + details.split("- Client :")[1].trim();
    } else {
       details = details.replace(/Expédition de \d+ btl.*\.?/i, "").trim();
       if (!details) details = "Destinataire non renseigné";
    }
    return { qty, details };
  };

  const gridCols = "140px 160px 120px 1fr 120px 140px"; 

  // ==========================================
  // COMPOSANT INTERNE : MODALE DISTILLERIE
  // ==========================================
  const DistillerieModal = () => {
    const [lotId, setLotId] = useState("");
    const [volume, setVolume] = useState("");
    const [motif, setMotif] = useState("Lies");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("TOUS");

    const availLots = (state.lots || []).filter(l => l.currentVolume > 0 && l.status !== "TIRE" && l.status !== "ARCHIVE");
    const selectedLot = availLots.find(l => String(l.id) === String(lotId));

    const filteredLots = availLots.filter(l => {
      if (search && !l.code.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus !== "TOUS") {
        if (filterStatus === "LIES" && l.status !== "LIES") return false;
        if (filterStatus === "BOURBES" && l.status !== "BOURBES") return false;
        if (filterStatus === "REBECHES" && l.status !== "REBECHES") return false;
        if (filterStatus === "AUTRES" && ["LIES", "BOURBES", "REBECHES"].includes(l.status)) return false;
      }
      return true;
    });

    const submit = async () => {
      const volNum = parseFloat(volume.replace(',', '.'));
      if (!selectedLot || !volNum || volNum <= 0) return alert("Veuillez saisir un volume valide.");
      if (volNum > selectedLot.currentVolume) return alert("Le volume saisi dépasse le volume disponible du lot.");

      setIsSubmitting(true);

      try {
        // On utilise la route des pertes que nous avions créée précédemment !
        const payload = { 
          entityType: "BULK", 
          entityId: String(lotId), 
          amount: volNum, 
          note: `[DISTILLERIE] Motif: ${motif} - ${notes}`.trim(),
          idempotencyKey 
        };

        const res = await fetch('/api/pertes', {
          method: 'POST',
          headers: buildApiHeaders(user),
          headers: buildApiHeaders(user),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || data.error || "Erreur de sauvegarde.");
        if (!res.ok) throw new Error(data.message || data.error || "Erreur de sauvegarde.");

        // Si on vide la cuve, on la passe en nettoyage (API Cuverie existante)
        if (volNum >= selectedLot.currentVolume && selectedLot.currentContainerId) {
             await fetch('/api/containers', { 
               method: 'PUT', 
               headers: buildApiHeaders(user), 
               headers: buildApiHeaders(user), 
               body: JSON.stringify({ id: selectedLot.currentContainerId, status: 'NETTOYAGE' }) 
             }).catch(()=>{});
        }

        dispatch({ type: "TOAST_ADD", payload: { msg: "Envoi en distillerie enregistré et certifié !", color: T.accent } });
        if (refreshData) await refreshData();
        setModalDistillerie(false);

      } catch(e) { 
        alert(e.message); 
        setIsSubmitting(false);
      }
    };

    return (
      <Modal title="Nouvel envoi en Distillerie" onClose={() => setModalDistillerie(false)}>
        <div style={{ background: T.red+"15", padding: 14, borderRadius: 4, marginBottom: 20, fontSize: 12, color: T.red, borderLeft: `3px solid ${T.red}` }}>
          L'opération est définitive. Le volume sera soustrait du lot et tracé dans le registre des douanes.
        </div>

        {!selectedLot ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1 }}>Sélectionner le lot à expédier</div>
            
            <div style={{ display: "flex", gap: 8 }}>
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher code..." style={{ flex: 1 }} autoFocus disabled={isSubmitting} />
              <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: 140 }} disabled={isSubmitting}>
                <option value="TOUS">Tous types</option>
                <option value="LIES">Lies</option>
                <option value="BOURBES">Bourbes</option>
                <option value="REBECHES">Rebêches</option>
                <option value="AUTRES">Vins / Moûts</option>
              </Select>
            </div>

            <div style={{ border: `1px solid ${T.border}`, borderRadius: 4, maxHeight: 220, overflowY: "auto", background: T.surfaceHigh }}>
              {filteredLots.length === 0 ? (
                <div style={{ padding: 16, textAlign: "center", color: T.textDim, fontSize: 12 }}>Aucun lot trouvé.</div>
              ) : filteredLots.map(l => (
                <div 
                  key={l.id} onClick={() => { if(!isSubmitting){ setLotId(l.id); setVolume(l.currentVolume.toString()); } }} 
                  style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, cursor: isSubmitting ? "default" : "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "background 0.2s" }} 
                  onMouseEnter={e => { if(!isSubmitting) e.currentTarget.style.background = T.accent+"15" }} onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div>
                    <div style={{ fontSize: 13, color: T.accent, fontWeight: "bold", fontFamily: "monospace" }}>{l.code}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{l.status}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: "bold", color: T.textStrong }}>{l.currentVolume} hL</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ background: T.surfaceHigh, border: `1px solid ${T.accent}`, borderRadius: 6, padding: 16, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Lot sélectionné</div>
                <div style={{ fontSize: 16, color: T.accentLight, fontWeight: "bold", fontFamily: "monospace" }}>{selectedLot.code}</div>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>{selectedLot.status} • Disponible : {selectedLot.currentVolume} hL</div>
              </div>
              <Btn variant="secondary" onClick={() => { setLotId(""); setVolume(""); }} disabled={isSubmitting} style={{ fontSize: 10, padding: "4px 8px" }}>Changer</Btn>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <FF label={`Volume expédié (Max ${selectedLot.currentVolume} hL)`}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Input type="number" step="0.1" value={volume} onChange={e => setVolume(e.target.value)} disabled={isSubmitting} placeholder="0.0" style={{ flex: 1, fontWeight: "bold", color: parseFloat(volume) > selectedLot.currentVolume ? T.red : T.text }} />
                  <Btn variant="secondary" onClick={() => setVolume(selectedLot.currentVolume.toString())} disabled={isSubmitting}>MAX</Btn>
                </div>
              </FF>
              <FF label="Motif légal">
                <Select value={motif} onChange={e => setMotif(e.target.value)} disabled={isSubmitting}>
                  <option value="Lies">Lies</option>
                  <option value="Bourbes">Bourbes</option>
                  <option value="Rebêches">Rebêches</option>
                  <option value="Vin altéré (Défaut)">Vin altéré (Défaut)</option>
                  <option value="Fonds de cuve">Fonds de cuve</option>
                </Select>
              </FF>
            </div>
          </div>
        )}

        {selectedLot && (
           <div style={{ marginTop: 12 }}>
             <FF label="Détails (Transporteur, n° de bon...)">
               <Input value={notes} onChange={e => setNotes(e.target.value)} disabled={isSubmitting} placeholder="Ex: Enlèvement par Distillerie X..." />
             </FF>
           </div>
        )}

        <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
          <Btn variant="secondary" onClick={() => setModalDistillerie(false)} disabled={isSubmitting}>Annuler</Btn>
          <Btn onClick={submit} disabled={isSubmitting || !lotId || !volume || parseFloat(volume) > selectedLot?.currentVolume} style={{ background: isSubmitting ? T.textDim : T.red, borderColor: isSubmitting ? T.textDim : T.red, color: "#fff" }}>
            {isSubmitting ? "Enregistrement..." : "Valider l'expédition"}
          </Btn>
        </div>
      </Modal>
    );
  };

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Expéditions</h1>
      </div>

      <div style={{ display:"flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom:20 }}>
        <div style={{ display:"flex", gap: 10 }}>
          <button onClick={() => setTab("bouteilles")} style={{ background: tab==="bouteilles" ? T.accent : "transparent", color: tab==="bouteilles" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
            BOUTEILLES ({expeditionsBouteilles.length})
          </button>
          <button onClick={() => setTab("vrac")} style={{ background: tab==="vrac" ? T.accent : "transparent", color: tab==="vrac" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
            VRAC / CITERNE ({vracLots.length})
          </button>
          <button onClick={() => setTab("distillerie")} style={{ background: tab==="distillerie" ? T.red : "transparent", color: tab==="distillerie" ? T.bg : T.red, border: `1px solid ${T.red}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
            DISTILLERIE ({expeditionsDistillerie.length})
          </button>
        </div>

        {tab === "distillerie" && (
          <Btn onClick={() => setModalDistillerie(true)} style={{ background: T.red, borderColor: T.red, color: "#fff" }}>
            + Nouvel envoi (Distillerie)
          </Btn>
        )}
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
        
        <div style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, textAlign: "center", background: T.surfaceHigh }}>
          <div>Date d'expédition</div><div>Lot Source</div><div>Volume - Qtité</div><div>Détails de l'envoi</div><div>Opérateur</div><div>Statut</div>
        </div>

        {/* ... L'affichage des vues Bouteilles, Vrac et Distillerie reste identique visuellement ... */}
        {tab === "bouteilles" && (
          <>
            {expeditionsBouteilles.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucune expédition de bouteilles enregistrée.</div>
            ) : expeditionsBouteilles.map((e, i) => {
              const { qty, details } = parseBottleNote(e.comment || e.note);
              const isDelivered = deliveredIds.includes(e.id);
              const lotObj = (state.bottleLots || []).find(l => String(l.id) === String(e.lotId || e.bottleLotId));
              
              return (
                <div key={e.id} style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"16px 16px", alignItems:"center", borderBottom: i<expeditionsBouteilles.length-1 ? `1px solid ${T.border}` : "none", textAlign: "center" }}>
                  <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{e.date ? e.date.split(" à ")[0] : new Date(e.eventDatetime).toLocaleDateString('fr-FR')}</div>
                  <div onClick={() => lotObj && onSelectLot && onSelectLot(lotObj)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor: lotObj ? "pointer" : "default", textDecoration: lotObj ? "underline" : "none" }}>
                    {lotObj ? lotObj.code : "--"}
                  </div>
                  <div style={{ fontSize:13, color:T.textStrong }}>{qty}</div>
                  <div style={{ fontSize:13, color:T.text }}>📦 {details}</div>
                  <div style={{ fontSize:12, color:T.textDim }}>{e.operator}</div>
                  <div onClick={() => toggleDelivery(e.id)} style={{cursor:"pointer", transition:"transform 0.1s", opacity: isDelivered ? 0.5 : 1, display: "flex", justifyContent: "center"}}>
                    <Badge label={isDelivered ? "Livré ✅" : "En livraison 🚚"} color={isDelivered ? T.textDim : T.accent} />
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ... Autres vues (Vrac, Distillerie) copiées de votre code original car elles sont justes en UI ... */}
        {tab === "distillerie" && (
          <>
            {expeditionsDistillerie.length === 0 ? (
              <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucun envoi en distillerie enregistré.</div>
            ) : expeditionsDistillerie.map((e, i) => {
              const lotObj = (state.lots || []).find(l => String(l.id) === String(e.lotId));
              const noteText = e.comment || e.note || "";
              let cleanNote = noteText.replace(/\[DISTILLERIE\](\s*Motif:\s*)?/i, "");
              cleanNote = cleanNote.replace(/Perte\/Manquant de [\d.,]+\s*hL\.?\s*/i, "").trim();
              
              const isDelivered = deliveredIds.includes(e.id);
              const fallbackVol = noteText.match(/(\d+(?:[.,]\d+)?)\s*(?:hL|btl)/i)?.[1] || 0;
              const displayVol = e.volumeChange ? Math.abs(e.volumeChange) : (e.volumeOut > 0 ? e.volumeOut : fallbackVol);
              
              return (
                <div key={e.id} style={{ display:"grid", gridTemplateColumns:gridCols, gap:16, padding:"16px 16px", alignItems:"center", borderBottom: i<expeditionsDistillerie.length-1 ? `1px solid ${T.border}` : "none", background: T.red+"08", textAlign: "center" }}>
                  <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{e.date ? e.date.split(" à ")[0] : new Date(e.eventDatetime).toLocaleDateString('fr-FR')}</div>
                  <div onClick={() => lotObj && onSelectLot && onSelectLot(lotObj)} style={{ fontSize:13, color:T.accent, fontFamily:"monospace", fontWeight:600, cursor: lotObj ? "pointer" : "default", textDecoration: lotObj ? "underline" : "none" }}>
                    {lotObj ? lotObj.code : (e.lotId || "Lot Inconnu")}
                  </div>
                  <div style={{ fontSize:14, color:T.red, fontWeight: "bold", fontFamily: "monospace" }}>{displayVol} hL</div>
                  <div style={{ fontSize:13, color:T.textStrong }}>🏭 {cleanNote}</div>
                  <div style={{ fontSize:12, color:T.textDim }}>{e.operator}</div>
                  <div onClick={() => toggleDelivery(e.id)} style={{cursor:"pointer", transition:"transform 0.1s", opacity: isDelivered ? 0.5 : 1, display: "flex", justifyContent: "center"}}>
                    <Badge label={isDelivered ? "Livré ✅" : "En livraison 🚚"} color={isDelivered ? T.textDim : T.accent} />
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {confirmDeliveryId && (
        <Modal title="Confirmation de livraison" onClose={() => setConfirmDeliveryId(null)}>
          <div style={{ padding:"20px 0", color:T.text, lineHeight:1.5 }}>
            Confirmez-vous que cette citerne est bien arrivée chez le client ?<br/><br/>
            La cuve passera au statut LIVRÉ en base de données.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
            <Btn variant="secondary" onClick={() => setConfirmDeliveryId(null)} disabled={isValidatingDelivery}>Annuler</Btn>
            <Btn onClick={executeDelivery} disabled={isValidatingDelivery} style={{ background: isValidatingDelivery ? T.textDim : T.green, color:T.bg, borderColor: isValidatingDelivery ? T.textDim : T.green }}>
              {isValidatingDelivery ? "Validation..." : "Oui, confirmer la livraison"}
            </Btn>
          </div>
        </Modal>
      )}

      {modalDistillerie && <DistillerieModal />}
    </div>
  );
}

// =============================================================================
// MODALE : AJOUTER UN NOUVEAU PRODUIT AU CATALOGUE (SÉCURISÉ)
// =============================================================================
function AddProductModal({ onClose }) {
  const T = useTheme();
  const { dispatch, refreshData } = useStore();
  
  const [form, setForm] = useState({ 
    category: "Matières Sèches", 
    subCategory: "Bouteilles", 
    name: "", 
    unit: "btl", 
    minStock: "500", 
    currentStock: "0" 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const CATEGORIES = {
    "Matières Sèches": ["Bouteilles", "Cartons", "Palettes", "Autre"],
    "Bouchage": ["Bouchons", "Capsules", "Muselets", "Bidules", "Autre"],
    "Intrants": ["Levures", "Nutrition", "Colle", "SO2", "Sucre", "Acides", "Autre"],
    "Habillage": ["Coiffes", "Étiquettes", "Collerettes", "Autre"]
  };

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    setForm({ ...form, category: newCat, subCategory: CATEGORIES[newCat][0] });
  };

  const submit = async () => {
    if (!form.name.trim()) return alert("Le nom du produit est requis.");
    
    setIsSubmitting(true);
    try {
      const payload = { 
        ...form, 
        minStock: parseFloat(form.minStock) || 0, 
        currentStock: parseFloat(form.currentStock) || 0,
        idempotencyKey 
      };

      const res = await fetch('/api/inventory/products', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur de création.");

      dispatch({ type: "TOAST_ADD", payload: { msg: `${form.name} ajouté au catalogue`, color: T.green } });
      if (refreshData) await refreshData();
      onClose();
    } catch(e) {
      alert(e.message);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Nouveau produit" onClose={onClose}>
      <FF label="Désignation du produit">
        <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} disabled={isSubmitting} placeholder="Ex: Bouchon Liège Extra, Nutrition Azotée..." />
      </FF>
      
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        <FF label="Catégorie principale">
          <Select value={form.category} onChange={handleCategoryChange} disabled={isSubmitting}>
            {Object.keys(CATEGORIES).map(c => <option key={c} value={c}>{c}</option>)}
          </Select>
        </FF>
        <FF label="Sous-catégorie">
          <Select value={form.subCategory} onChange={e => setForm({...form, subCategory: e.target.value})} disabled={isSubmitting}>
            {CATEGORIES[form.category].map(sc => <option key={sc} value={sc}>{sc}</option>)}
          </Select>
        </FF>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginTop: 8 }}>
        <FF label="Unité de mesure">
          <Select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} disabled={isSubmitting}>
            <option value="btl">Bouteilles (btl)</option>
            <option value="unités">Unités</option>
            <option value="kg">Kilogrammes (kg)</option>
            <option value="g">Grammes (g)</option>
            <option value="L">Litres (L)</option>
            <option value="mL">Millilitres (mL)</option>
          </Select>
        </FF>
        <FF label="Stock Actuel">
          <Input type="number" step="1" value={form.currentStock} onChange={e => setForm({...form, currentStock: e.target.value})} disabled={isSubmitting} />
        </FF>
        <FF label="Seuil d'alerte">
          <Input type="number" step="1" value={form.minStock} onChange={e => setForm({...form, minStock: e.target.value})} disabled={isSubmitting} />
        </FF>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={!form.name.trim() || isSubmitting} style={{ background: isSubmitting ? T.textDim : T.accent }}>
          {isSubmitting ? "Création..." : "Créer le produit"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODALE : MOUVEMENT DE STOCK (SÉCURISÉ)
// =============================================================================
function StockMovementModal({ product, productsList, onSelectProduct, onClose }) {
  const T = useTheme();
  const { state, dispatch, refreshData } = useStore();
  
  const [type, setType] = useState("IN"); 
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const currentIndex = productsList.findIndex(p => p.id === product.id);
  const prevProduct = currentIndex > 0 ? productsList[currentIndex - 1] : null;
  const nextProduct = currentIndex < productsList.length - 1 ? productsList[currentIndex + 1] : null;

  const handleNav = (targetProduct) => {
    setQuantity("");
    setNote("");
    setIdempotencyKey(crypto.randomUUID());
    onSelectProduct(targetProduct);
  };

  const submit = async () => {
    const qtyNum = parseFloat(quantity);
    if (!qtyNum || qtyNum <= 0) return alert("Quantité invalide.");
    if (type === "OUT" && qtyNum > product.currentStock) return alert("Impossible de consommer plus que le stock disponible.");

    setIsSubmitting(true);
    
    try {
      const payload = { 
        productId: product.id, 
        type, 
        quantity: qtyNum, 
        note: note.trim(), 
        idempotencyKey 
      };

      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Erreur de mouvement.");
      if (!res.ok) throw new Error(data.message || data.error || "Erreur de mouvement.");

      dispatch({ type: "TOAST_ADD", payload: { msg: `Mouvement validé en base de données.`, color: type === "IN" ? T.green : T.accent } });
      if (refreshData) await refreshData();
      
      setIsSubmitting(false);
      
      if (nextProduct && note.toLowerCase().includes("inventaire")) {
        handleNav(nextProduct);
      } else {
        onClose();
      }
    } catch(e) {
      alert(e.message);
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={`Ajuster Stock : ${product.name}`} onClose={onClose}>
      
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: -40, marginBottom: 24 }}>
        <button 
          onClick={() => prevProduct && handleNav(prevProduct)} disabled={!prevProduct || isSubmitting}
          style={{ background:"none", border:`1px solid ${T.border}`, color: prevProduct ? T.textStrong : T.textDim, padding:"6px 14px", borderRadius:3, cursor: prevProduct && !isSubmitting ? "pointer" : "default", fontSize:11, fontFamily:"monospace", opacity: prevProduct ? 1 : 0.3, transition: "all 0.2s" }}
        >{"< Précédent"}</button>
        <button 
          onClick={() => nextProduct && handleNav(nextProduct)} disabled={!nextProduct || isSubmitting}
          style={{ background:"none", border:`1px solid ${T.border}`, color: nextProduct ? T.textStrong : T.textDim, padding:"6px 14px", borderRadius:3, cursor: nextProduct && !isSubmitting ? "pointer" : "default", fontSize:11, fontFamily:"monospace", opacity: nextProduct ? 1 : 0.3, transition: "all 0.2s" }}
        >{"Suivant >"}</button>
      </div>

      <div style={{ background:T.surfaceHigh, padding:14, borderRadius:4, marginBottom:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Stock Actuel</div>
          <div style={{ fontSize:18, color:T.textStrong, fontWeight:"bold", fontFamily:"monospace" }}>
            {product.currentStock} {product.unit}
          </div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Nouveau Stock (Simulation)</div>
          <div style={{ fontSize:18, color: type === "IN" ? T.green : T.accent, fontWeight:"bold", fontFamily:"monospace" }}>
            {quantity ? (type === "IN" ? product.currentStock + parseFloat(quantity) : product.currentStock - parseFloat(quantity)) : "--"}
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
        <FF label="Type d'opération">
          <Select value={type} onChange={e => setType(e.target.value)} disabled={isSubmitting}>
            <option value="IN">Livraison (Entrée +)</option>
            <option value="OUT">Consommation/Perte (Sortie -)</option>
          </Select>
        </FF>
        <FF label={`Quantité (${product.unit})`}>
          <Input type="number" step="0.1" min="0.1" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={isSubmitting} placeholder="Ex: 5000" />
        </FF>
      </div>

      <div style={{ marginTop: 12 }}>
        <FF label="Raison / Bon de livraison (Optionnel)">
          <Input value={note} onChange={e => setNote(e.target.value)} disabled={isSubmitting} placeholder={type === "IN" ? "BL Fournisseur n°..." : "Tirage imprévu, casse, inventaire..."} />
        </FF>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !quantity} style={{ background: isSubmitting ? T.textDim : (type === "IN" ? T.green : T.accent) }}>
          {isSubmitting ? "Validation serveur..." : "Valider l'opération"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// PAGE INVENTAIRE (STOCKS & COMMANDES)
// =============================================================================
function Stocks() {
  const T = useTheme();
  const { state } = useStore();
  
  const [tab, setTab] = useState("inventaire");
  const [filterCat, setFilterCat] = useState("TOUTES");
  const [filterSubCat, setFilterSubCat] = useState(""); 
  const [search, setSearch] = useState("");
  
  const [selectedProduct, setSelectedProduct] = useState(null); 
  const [showAddProduct, setShowAddProduct] = useState(false); 

  const products = state.products || [];
  const movements = state.stockMovements || [];

  const CATEGORIES = {
    "Matières Sèches": ["Bouteilles", "Cartons", "Palettes"],
    "Bouchage": ["Bouchons", "Capsules", "Muselets", "Bidules"],
    "Intrants": ["Levures", "Nutrition", "Colle", "SO2", "Sucre", "Acides"],
    "Habillage": ["Coiffes", "Étiquettes", "Collerettes"]
  };

  const categoriesKeys = ["TOUTES", ...Object.keys(CATEGORIES)];
  const alertsCount = products.filter(p => p.currentStock <= p.minStock).length;

  const filteredProducts = products.filter(p => {
    const matchCat = filterCat === "TOUTES" || p.category === filterCat;
    const matchSubCat = !filterSubCat || p.subCategory === filterSubCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSubCat && matchSearch;
  }).sort((a,b) => a.category.localeCompare(b.category) || a.subCategory.localeCompare(b.subCategory) || a.name.localeCompare(b.name));

  const subtotals = {};
  filteredProducts.forEach(p => {
    if (!subtotals[p.subCategory]) subtotals[p.subCategory] = { sum: 0, unit: p.unit };
    subtotals[p.subCategory].sum += p.currentStock;
  });

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Inventaire & Matières</h1>
          {alertsCount > 0 && (
             <div style={{ fontSize:13, color:T.red, marginTop:8, display:"flex", alignItems:"center", gap:6, fontWeight: "bold" }}>
               <div style={{ width:8, height:8, borderRadius:"50%", background:T.red, animation:"pulse 2s infinite" }}/> 
               {alertsCount} produit(s) en rupture ou sous le seuil d'alerte !
             </div>
          )}
        </div>
        <Btn variant="secondary" onClick={() => setShowAddProduct(true)}>+ Nouveau Produit</Btn>
      </div>

      {/* Le reste de l'affichage du composant Stocks reste exactement identique, l'UI était déjà parfaite */}
      {/* ... */}
      <div style={{ display:"flex", gap: 10, marginBottom:20 }}>
        <button onClick={() => setTab("inventaire")} style={{ background: tab==="inventaire" ? T.accent : "transparent", color: tab==="inventaire" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
          ÉTAT DES STOCKS
        </button>
        <button onClick={() => setTab("mouvements")} style={{ background: tab==="mouvements" ? T.accent : "transparent", color: tab==="mouvements" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 3, fontSize: 11, fontWeight: "bold", letterSpacing: 1, cursor: "pointer", fontFamily: "monospace", transition:"all .2s" }}>
          HISTORIQUE MOUVEMENTS
        </button>
      </div>

      {tab === "inventaire" && (
        <>
          <div style={{ display:"flex", gap:10, marginBottom: filterCat !== "TOUTES" ? 10 : 20, flexWrap:"wrap" }}>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher article..." style={{ minWidth:200 }} />
            
            <div style={{ display:"flex", gap:6, background:T.surfaceHigh, padding:4, borderRadius:6, border:`1px solid ${T.border}` }}>
              {categoriesKeys.map(c => (
                <button key={c} onClick={() => { setFilterCat(c); setFilterSubCat(""); }} style={{ background: filterCat===c ? T.accent : "transparent", color: filterCat===c ? T.bg : T.textDim, border:"none", padding:"6px 12px", borderRadius:4, cursor:"pointer", fontSize:11, fontFamily:"monospace", transition:"all .2s", fontWeight: filterCat===c ? "bold" : "normal" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {filterCat !== "TOUTES" && CATEGORIES[filterCat] && (
            <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", background:T.surfaceHigh, padding:10, borderRadius:6, border:`1px solid ${T.border}` }}>
              <span style={{fontSize:10, color:T.textDim, textTransform:"uppercase", alignSelf:"center", marginRight:10, fontWeight: "bold"}}>Sous-catégories :</span>
              {CATEGORIES[filterCat].map(sc => (
                <button key={sc} onClick={() => setFilterSubCat(filterSubCat === sc ? "" : sc)} style={{ background: filterSubCat===sc ? T.accent : "transparent", color: filterSubCat===sc ? T.bg : T.textDim, border:`1px solid ${filterSubCat===sc ? T.accent : T.border}`, padding:"5px 12px", borderRadius:4, cursor:"pointer", fontSize:10, fontFamily:"monospace", transition:"all 0.2s" }}>
                  {sc}
                </button>
              ))}
            </div>
          )}

          {Object.keys(subtotals).length > 0 && (
            <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
              {Object.entries(subtotals).map(([sub, data]) => (
                <div key={sub} style={{ background:T.surfaceHigh, padding:"10px 14px", borderRadius:6, border:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:10 }}>
                  <span style={{ color:T.textDim, fontSize:11, textTransform:"uppercase", letterSpacing:1 }}>Total {sub}</span>
                  <span style={{ color:T.textStrong, fontSize:15, fontWeight:"bold", fontFamily:"monospace" }}>{data.sum.toLocaleString('fr-FR')} <span style={{fontSize:12, color:T.textDim}}>{data.unit}</span></span>
                </div>
              ))}
            </div>
          )}

          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
            <div style={{ display:"grid", gridTemplateColumns:"150px 1.5fr 150px 150px 150px 120px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, background: T.surfaceHigh }}>
              <div>Catégorie</div><div>Désignation</div><div>Seuil Alerte</div><div>Stock Actuel</div><div>État</div><div>Action</div>
            </div>
            
            {filteredProducts.map((p, i) => {
              const isAlert = p.currentStock <= p.minStock;
              const isCritical = p.currentStock === 0;

              return (
                <div key={p.id} style={{ display:"grid", gridTemplateColumns:"150px 1.5fr 150px 150px 150px 120px", padding:"14px 16px", alignItems:"center", borderBottom:i<filteredProducts.length-1?`1px solid ${T.border}`:"none", background: isCritical ? T.red+"11" : (isAlert ? "#d98b2b11" : "transparent") }}>
                  <div style={{ fontSize:11, color:T.textDim, fontFamily:"monospace" }}>{p.subCategory}</div>
                  <div style={{ fontSize:13, color:T.textStrong, fontWeight:"bold" }}>{p.name}</div>
                  <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{p.minStock} {p.unit}</div>
                  <div style={{ fontSize:15, color: isCritical ? T.red : (isAlert ? "#d98b2b" : T.green), fontFamily:"monospace", fontWeight:"bold" }}>
                    {p.currentStock.toLocaleString('fr-FR')} {p.unit}
                  </div>
                  <div>
                    {isCritical ? <Badge label="RUPTURE" color={T.red} /> : (isAlert ? <Badge label="À COMMANDER" color="#d98b2b" /> : <Badge label="OK" color={T.green} />)}
                  </div>
                  <div>
                    <Btn variant="secondary" style={{ fontSize:10, padding:"6px 12px" }} onClick={() => setSelectedProduct(p)}>MOUVEMENT</Btn>
                  </div>
                </div>
              );
            })}
            
            {filteredProducts.length === 0 && (
              <div style={{ padding:"40px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucun article trouvé dans l'inventaire.</div>
            )}
          </div>
        </>
      )}

      {tab === "mouvements" && (
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"120px 80px 2fr 120px 2fr 120px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, background: T.surfaceHigh }}>
            <div>Date</div><div>Sens</div><div>Produit</div><div>Quantité</div><div>Motif / BL</div><div>Opérateur</div>
          </div>
          {movements.length === 0 ? (
             <div style={{ padding:"60px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucun mouvement enregistré.</div>
          ) : [...movements].sort((a,b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).map((m, i) => {
            const product = products.find(p => p.id === m.productId);
            return (
              <div key={m.id} style={{ display:"grid", gridTemplateColumns:"120px 80px 2fr 120px 2fr 120px", padding:"14px 16px", alignItems:"center", borderBottom:i<movements.length-1?`1px solid ${T.border}`:"none" }}>
                <div style={{ fontSize:11, color:T.textDim, fontFamily:"monospace" }}>{new Date(m.createdAt || m.date).toLocaleDateString('fr-FR')}</div>
                <div><Badge label={m.type === "IN" ? "ENTRÉE" : "SORTIE"} color={m.type === "IN" ? T.green : T.accent} /></div>
                <div style={{ fontSize:13, color:T.textStrong, fontWeight: "bold" }}>{product?.name || "Produit inconnu"}</div>
                <div style={{ fontSize:13, color: m.type === "IN" ? T.green : T.accent, fontFamily:"monospace", fontWeight:"bold" }}>
                  {m.type === "IN" ? "+" : "-"}{m.quantity} {product?.unit}
                </div>
                <div style={{ fontSize:12, color:T.textDim, fontStyle:"italic" }}>{m.note || "--"}</div>
                <div style={{ fontSize:11, color:T.textDim }}>{m.operator}</div>
              </div>
            );
          })}
        </div>
      )}

      {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} />}
      {selectedProduct && (
        <StockMovementModal 
          product={selectedProduct} 
          productsList={filteredProducts} 
          onSelectProduct={setSelectedProduct} 
          onClose={() => setSelectedProduct(null)} 
        />
      )}
    </div>
  );
}

// =============================================================================
// TRACABILITÉ (Moteur Cartographique / API-Driven)
// =============================================================================
function Tracabilite({ onSelectLot }) {
  const T = useTheme(); 
  const { state } = useStore();
  
  const [search, setSearch] = useState("");
  
  // États de l'arbre généalogique chargés depuis le serveur
  const [lineage, setLineage] = useState(null);
  const [isLoadingLineage, setIsLoadingLineage] = useState(false);
  const [maturationModal, setMaturationModal] = useState(null);

  // 1. MOTEUR DE RECHERCHE INITIAL (Sur le store local pour la rapidité de la barre de recherche)
  const allLots = [
    ...(state.lots || []).map(l => ({ ...l, _type: 'bulk' })),
    ...(state.bottleLots || []).map(b => ({ ...b, _type: 'bottle' }))
  ];

  const filteredSearch = allLots
    .filter(l => l.code.toLowerCase().includes(search.toLowerCase()) || (l.lieu && l.lieu.toLowerCase().includes(search.toLowerCase())))
    .slice(0, 12); 

  // 2. FETCH DE L'ARBRE GÉNÉALOGIQUE DEPUIS LE SERVEUR
  const handleFocusLot = async (lotCode, type) => {
    if (!lotCode) return setLineage(null);
    
    setIsLoadingLineage(true);
    setSearch(""); // On vide la recherche

    try {
      const res = await fetch('/api/tracabilite', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify({ lotCode, type })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erreur de chargement de la traçabilité.");
      }

      const data = await res.json();
      
      // On remappe `businessCode` vers `code` pour l'affichage UI
      const normalizeNode = (node) => ({ ...node, code: node.businessCode || node.code });
      
      setLineage({
        focusedLot: normalizeNode(data.focusedLot),
        parents: data.parents.map(normalizeNode),
        children: data.children.map(normalizeNode),
        expeditions: data.expeditions
      });

    } catch (e) {
      alert(e.message);
      setLineage(null);
    } finally {
      setIsLoadingLineage(false);
    }
  };

  // --- HELPERS UI ---
  const formatStatus = (status) => {
    if (!status) return "INCONNU";
    if (status === "FERMENTATION_ALCOOLIQUE") return "FA";
    if (status === "MOUT_NON_DEBOURBE") return "MOÛT BRUT";
    if (status === "MOUT_DEBOURBE") return "JUS CLAIR";
    if (status === "A_DEGORGER") return "SUR LATTES";
    return status.replace(/_/g, ' ');
  };

  const formatVolShort = (vol) => typeof vol === 'number' ? `${vol.toFixed(1)} hL` : `${vol} hL`;

  // --- COMPOSANT VISUEL D'UN NOEUD (Carte Lot) ---
  const LotNode = ({ lot, isCenter }) => {
    const isBottle = lot._type === 'bottle';
    const volStr = isBottle ? `${lot.currentBottleCount || lot.currentCount || 0} btl` : formatVolShort(lot.currentVolume || lot.volume || 0);
    const badgeColor = isBottle ? T.accentLight : LOT_STATUS_COLORS[lot.status] || T.textDim;
    
    return (
      <div 
        style={{ 
          background: isCenter ? T.surfaceHigh : T.surface, 
          border: `1px solid ${isCenter ? T.accent : T.border}`, 
          borderRadius: 6, padding: "16px", cursor: "pointer", 
          transition: "transform 0.2s, border-color 0.2s",
          boxShadow: isCenter ? `0 4px 20px ${T.accent}22` : "none",
          width: "100%", position: "relative",
          display: "flex", flexDirection: "column", gap: 10,
          opacity: isLoadingLineage ? 0.5 : 1
        }}
        onClick={() => !isCenter && !isLoadingLineage && handleFocusLot(lot.code, lot._type)}
        onMouseEnter={e => { if(!isLoadingLineage) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.borderColor = T.accent; } }}
        onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.borderColor = isCenter ? T.accent : T.border; }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: "bold", color: isCenter ? T.accent : T.textStrong, fontFamily: "monospace", wordBreak: "break-all", flex: 1 }}>{lot.code}</div>
          <div style={{ flexShrink: 0 }}>
            <Badge label={isBottle ? (lot.format || 'Bouteille') : formatStatus(lot.status)} color={badgeColor} />
          </div>
        </div>
        
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ fontSize: 12, color: T.text }}>Vol: <span style={{ fontWeight: "bold" }}>{volStr}</span></div>
          <div style={{ display: "flex", gap: 6 }}>
            {!isCenter && (
              <Btn variant="secondary" style={{ fontSize: 9, padding: "4px 8px" }} disabled={isLoadingLineage}>📍 Centrer</Btn>
            )}
            <Btn style={{ fontSize: 9, padding: "4px 8px" }} onClick={(e) => { e.stopPropagation(); onSelectLot(lot); }}>Fiche</Btn>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: T.textStrong, margin: 0 }}>Graphe de Traçabilité</h1>
        {lineage && (
          <Btn variant="secondary" onClick={() => setLineage(null)}>🔄 Nouvelle recherche</Btn>
        )}
      </div>

      {!lineage ? (
        // ÉCRAN DE RECHERCHE INITIAL
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 16 }}>🎯</div>
          <h2 style={{ fontSize: 18, color: T.textStrong, marginBottom: 8 }}>Point d'entrée de la cartographie</h2>
          <div style={{ color: T.textDim, fontSize: 13, marginBottom: 24 }}>Recherchez un lot (vrac ou bouteille) pour interroger le serveur sur son ascendance et sa descendance.</div>
          
          <Input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Rechercher par code lot ou provenance (Ex: 2025-CH)..." 
            style={{ maxWidth: 400, margin: "0 auto 30px", textAlign: "center", fontSize: 16, padding: "12px" }} 
            autoFocus
          />
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: 16, textAlign: "left" }}>
            {filteredSearch.map(l => (
              <LotNode key={l.id} lot={l} isCenter={false} />
            ))}
          </div>
          {filteredSearch.length === 0 && search && (
            <div style={{ color: T.textDim, fontStyle: "italic", marginTop: 20 }}>Aucun lot trouvé pour "{search}"</div>
          )}
        </div>
      ) : (
        // ÉCRAN CARTOGRAPHIQUE (Généalogie Serveur)
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 30, alignItems: "start", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "30px 20px" }}>
          
          {/* COLONNE GAUCHE : LES PARENTS OU ORIGINES */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, textAlign: "center", borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
              ⬅️ Origines (Parents)
            </div>
            
            {lineage.parents.length > 0 ? (
              lineage.parents.map(p => (
                <LotNode key={p.id} lot={p} isCenter={false} />
              ))
            ) : lineage.focusedLot.lieu ? (
              <div style={{ border: `1px dashed ${T.accent}55`, borderRadius: 6, padding: 16, background: T.bg, textAlign: "center" }}>
                <div style={{ fontSize: 10, color: T.textDim, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>🌱 Origine Raisins (Vendanges)</div>
                {lineage.focusedLot.lieu.split('+').map(p => p.trim()).map((p, i) => {
                  const rawName = p.replace(/\s*\([^)]*\)/g, '').trim(); 
                  return (
                    <Btn 
                      key={i} 
                      variant="secondary" 
                      onClick={() => setMaturationModal(rawName)} 
                      style={{ width: "100%", marginBottom: i === lineage.focusedLot.lieu.split('+').length - 1 ? 0 : 8, fontSize: 11, borderColor: T.accent+"33", color: T.accentLight, padding: "8px" }}
                    >
                      🍇 {p}
                    </Btn>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "30px 20px", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.textDim, fontSize: 12 }}>
                Racine d'origine.<br/>Aucun parent identifié en base.
              </div>
            )}
          </div>

          {/* COLONNE CENTRALE : LE LOT CIBLÉ */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
            <div style={{ fontSize: 11, color: T.accent, textTransform: "uppercase", letterSpacing: 2, textAlign: "center", borderBottom: `1px solid ${T.accent}44`, paddingBottom: 10, fontWeight: "bold" }}>
              Lot Centré
            </div>
            <div style={{ position: "absolute", left: -30, top: "50%", width: 30, borderTop: `2px dashed ${T.border}`, zIndex: 0 }} />
            <div style={{ position: "absolute", right: -30, top: "50%", width: 30, borderTop: `2px dashed ${T.border}`, zIndex: 0 }} />
            
            <div style={{ position: "relative", zIndex: 1 }}>
              <LotNode lot={lineage.focusedLot} isCenter={true} />
            </div>
            <div style={{ textAlign: "center", color: T.textDim, fontSize: 11, fontStyle: "italic", padding: "0 10px" }}>
              {lineage.focusedLot.notes || "Aucune note spécifique."}
            </div>
          </div>

          {/* COLONNE DROITE : LES ENFANTS & EXPÉDITIONS */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 2, textAlign: "center", borderBottom: `1px solid ${T.border}`, paddingBottom: 10 }}>
              Destinations (Enfants) ➡️
            </div>
            
            {lineage.children.length === 0 && lineage.expeditions.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", border: `1px dashed ${T.border}`, borderRadius: 6, color: T.textDim, fontSize: 12 }}>
                Aucune descendance ou expédition enregistrée.
              </div>
            ) : (
              <>
                {lineage.children.map(c => (
                  <LotNode key={c.id} lot={c} isCenter={false} />
                ))}
                
                {lineage.expeditions.length > 0 && (
                  <div style={{ marginTop: 10, borderTop: `1px dashed ${T.green}44`, paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ fontSize: 10, color: T.green, textTransform: "uppercase", letterSpacing: 1, textAlign: "center" }}>Expéditions liées</div>
                    {lineage.expeditions.map(e => (
                      <div key={e.id} style={{ background: T.green + "11", border: `1px solid ${T.green}55`, borderRadius: 4, padding: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: "bold", color: T.green }}>📦 {e.comment || "Expédition"}</div>
                          <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>{new Date(e.eventDatetime).toLocaleDateString('fr-FR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* --- MODALE : SUIVI MATURATION --- */}
      {maturationModal && (() => {
        const rawName = maturationModal;
        const matData = (state.maturations || []).filter(m => m.parcelle === rawName).sort((a,b) => new Date(a.date) - new Date(b.date));

        return (
          <Modal title={`📊 Suivi Maturation : ${rawName}`} onClose={() => setMaturationModal(null)} wide>
            {matData.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center", color: T.textDim, fontStyle: "italic", lineHeight: 1.6 }}>
                Aucun relevé de maturation enregistré pour la parcelle <strong>{rawName}</strong> cette année.<br/>
                Les données d'échantillonnage n'ont pas été saisies dans le module Maturation.
              </div>
            ) : (
              <div style={{ overflowX: "auto", marginTop: 10 }}>
                <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, fontSize: 10 }}>
                      <th style={{ padding: "12px 8px" }}>Date de Prélèvement</th>
                      <th style={{ padding: "12px 8px" }}>Cépage</th>
                      <th style={{ padding: "12px 8px" }}>Sucre (g/L)</th>
                      <th style={{ padding: "12px 8px" }}>Acidité Totale</th>
                      <th style={{ padding: "12px 8px" }}>TAVP Estimé</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matData.map((m, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.border}55` }}>
                        <td style={{ padding: "12px 8px", color: T.textStrong }}>{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                        <td style={{ padding: "12px 8px" }}>{m.cepage || '-'}</td>
                        <td style={{ padding: "12px 8px" }}>{m.sucre || '-'}</td>
                        <td style={{ padding: "12px 8px" }}>{m.at || '-'}</td>
                        <td style={{ padding: "12px 8px", color: T.accentLight, fontWeight: "bold" }}>{m.tavp ? `${m.tavp.toFixed(2)} %vol` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <Btn onClick={() => setMaturationModal(null)}>Fermer</Btn>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}

// =============================================================================
// ANALYSES (PRODUCTION READY AVEC API)
// =============================================================================
const ANALYSIS_FIELDS = [
  { key:"ph", label:"pH", unit:"", hint:"3.00-3.50" }, 
  { key:"at", label:"AT", unit:"g/L", hint:"6.0-9.0" },
  { key:"so2Free", label:"SO2 libre", unit:"mg/L", hint:"15-35" }, 
  { key:"alcohol", label:"Alcool", unit:"% vol", hint:"10.0-13.0" }
];
const EMPTY_A = { analysisDate:"", lotId:"", ph:"", at:"", so2Free:"", alcohol:"", notes:"" };

function AnalyseModal({ initial, onClose, onSuccess, title }) {
  const T = useTheme(); 
  const { state, dispatch } = useStore();
  const [form, setForm] = useState(initial ? { ...initial } : { ...EMPTY_A, analysisDate: new Date().toISOString().slice(0, 10), notes: "Saisie manuelle" });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  const handleSave = async () => {
    if (!form.analysisDate || !form.lotId) return alert("La date et le lot sont obligatoires.");
    
    setIsSubmitting(true);
    try {
      const payload = {
        analyses: [form], // L'API attend un tableau
        idempotencyKey
      };

      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la sauvegarde.");

      dispatch({ type: "TOAST_ADD", payload: { msg: "Analyse enregistrée avec succès.", color: T.green } });
      onSuccess(); // Déclenche le rafraîchissement global

    } catch (e) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e.message, color: T.red } });
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={title || "Saisir une analyse manuellement"} onClose={onClose}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom: 16 }}>
        <FF label="Date">
          <Input type="date" value={form.analysisDate} onChange={e => set("analysisDate", e.target.value)} disabled={isSubmitting} />
        </FF>
        <FF label="Lot analysé">
          <Select value={form.lotId} onChange={e => set("lotId", e.target.value)} disabled={isSubmitting}>
            <option value="">-- Choisir le lot --</option>
            {(state.lots || []).map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
          </Select>
        </FF>
      </div>
      
      <div style={{ background: T.surfaceHigh, padding: 16, borderRadius: 6, border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: 12, textTransform: "uppercase", color: T.textDim, marginBottom: 12, fontWeight: "bold" }}>Paramètres Œnologiques</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
          {ANALYSIS_FIELDS.map(f => (
            <FF key={f.key} label={f.label}>
              <Input type="text" inputMode="decimal" value={form[f.key] || ""} onChange={e => set(f.key, e.target.value)} disabled={isSubmitting} placeholder={f.hint} />
            </FF>
          ))}
        </div>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={handleSave} disabled={isSubmitting || !form.lotId} style={{ background: isSubmitting ? T.textDim : T.accent }}>
          {isSubmitting ? "Enregistrement..." : "Enregistrer"}
        </Btn>
      </div>
    </Modal>
  );
}

function AIImportModal({ initialFile, onClose, onSuccess }) {
  const T = useTheme(); 
  const { state, dispatch } = useStore();
  
  const [phase, setPhase] = useState("loading"); 
  const [results, setRes] = useState([]);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // Simulation de l'extraction IA
  useEffect(() => {
    if (initialFile) {
      setTimeout(() => {
        setRes([{ 
          ...EMPTY_A, _id:0, _ok:true, 
          lotId: state.lots[0]?.id || "", 
          analysisDate: new Date().toISOString().slice(0, 10), 
          ph: "3.12", at: "7.8", so2Free: "22", alcohol: "11.2", notes: "Extrait par IA (PDF)" 
        }]);
        setPhase("review");
      }, 1500);
    }
  }, [initialFile, state.lots]);

  const upd = (idx, k, v) => setRes(rs => rs.map((x,i) => i===idx ? {...x,[k]:v} : x));
  const tog = idx => setRes(rs => rs.map((x,i) => i===idx ? {...x,_ok:!x._ok} : x));
  const confirmedRows = results.filter(r => r._ok);

  const handleImport = async () => {
    if (confirmedRows.length === 0) return alert("Sélectionnez au moins une ligne à importer.");
    
    const invalidRows = confirmedRows.filter(r => !r.lotId);
    if (invalidRows.length > 0) return alert("Veuillez lier manuellement un Lot à chaque ligne avant l'import.");

    setIsSubmitting(true);
    try {
      const payload = {
        analyses: confirmedRows.map(r => {
          const { _id, _ok, ...cleanRow } = r; // On retire les clés de l'UI
          return cleanRow;
        }),
        idempotencyKey
      };

      const res = await fetch('/api/analyses', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de l'importation.");

      dispatch({ type: "TOAST_ADD", payload: { msg: `${data.count} analyses importées avec succès !`, color: T.green } });
      onSuccess(); // Rafraîchissement global

    } catch (e) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e.message, color: T.red } });
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={phase === "loading" ? "Analyse du rapport en cours..." : "Vérification des données extraites"} onClose={onClose} wide={phase==="review"}>
      {phase === "loading" && (
        <div style={{ textAlign:"center", padding:"60px 20px" }}>
          <div style={{ fontSize: 40, marginBottom: 20 }}>⚙️</div>
          <div style={{ fontSize: 16, color: T.textStrong, fontFamily: "Georgia,serif" }}>L'Intelligence Artificielle déchiffre votre document...</div>
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 8 }}>Identification des lots et paramètres œnologiques en cours</div>
        </div>
      )}
      
      {phase === "review" && (
        <div>
          <div style={{ marginBottom:16, fontSize:12, color:T.textDim }}>Veuillez vérifier les valeurs extraites avant de les importer dans la base de données.</div>
          <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:4, padding:"12px 16px", display:"grid", gridTemplateColumns:"30px 140px 1fr 80px 80px 80px 80px", gap:10, alignItems:"center" }}>
            <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>OK</div>
            <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Date</div>
            <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Lot identifié</div>
            <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>pH</div>
            <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>AT</div>
            <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>SO2 L</div>
            <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Alc</div>
          </div>
          
          {results.map((r, idx) => (
            <div key={idx} style={{ display:"grid", gridTemplateColumns:"30px 140px 1fr 80px 80px 80px 80px", gap:10, alignItems:"center", padding:"12px 0", borderBottom:`1px solid ${T.border}` }}>
              <div><input type="checkbox" checked={r._ok} onChange={() => tog(idx)} disabled={isSubmitting} style={{cursor:"pointer", accentColor:T.accent}} /></div>
              <div><Input type="date" value={r.analysisDate} onChange={e=>upd(idx,"analysisDate",e.target.value)} disabled={!r._ok || isSubmitting} /></div>
              <div>
                <Select value={r.lotId} onChange={e=>upd(idx,"lotId",e.target.value)} disabled={!r._ok || isSubmitting} style={{ borderColor: !r.lotId ? T.red : T.border }}>
                  <option value="">-- Non trouvé --</option>
                  {(state.lots || []).map(l => <option key={l.id} value={l.id}>{l.code}</option>)}
                </Select>
              </div>
              <div><Input value={r.ph} onChange={e=>upd(idx,"ph",e.target.value)} disabled={!r._ok || isSubmitting} /></div>
              <div><Input value={r.at} onChange={e=>upd(idx,"at",e.target.value)} disabled={!r._ok || isSubmitting} /></div>
              <div><Input value={r.so2Free} onChange={e=>upd(idx,"so2Free",e.target.value)} disabled={!r._ok || isSubmitting} /></div>
              <div><Input value={r.alcohol} onChange={e=>upd(idx,"alcohol",e.target.value)} disabled={!r._ok || isSubmitting} /></div>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:24 }}>
            <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={handleImport} disabled={isSubmitting || confirmedRows.length === 0} style={{ background: isSubmitting ? T.textDim : T.accent }}>
              {isSubmitting ? "Importation en base..." : `Importer (${confirmedRows.length}) sélections`}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Analyses() {
  const T = useTheme(); 
  const { state, refreshData } = useStore();
  
  const [modal, setModal] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const getLotCode = id => (state.lots || []).find(l => String(l.id) === String(id))?.code || "--";

  const handleSuccess = async () => {
    if (refreshData) await refreshData();
    setModal(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      setModal({ type: "ai", file });
    }
  };

  const analysesList = state.analyses || [];

  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Analyses de Laboratoire</h1>
        <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Centralisez et suivez les paramètres œnologiques de vos lots (Saisie ou Import PDF).</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 28 }}>
        
        {/* DRAG & DROP ZONE */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('ai-file-upload').click()}
          style={{
            background: dragOver ? T.accent+"11" : T.surfaceHigh,
            border: `2px dashed ${dragOver ? T.accent : T.border}`,
            borderRadius: 8,
            padding: "36px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
          <div style={{ fontSize: 16, color: T.accentLight, fontFamily: "monospace", fontWeight: "bold", marginBottom: 6 }}>Assistant IA : Glissez votre rapport PDF ici</div>
          <div style={{ fontSize: 12, color: T.textDim }}>Ou cliquez pour parcourir. L'IA extraira automatiquement les lots et les valeurs.</div>
          <input id="ai-file-upload" type="file" accept=".pdf,.csv,.jpg,.png" style={{ display: "none" }} onChange={e => e.target.files[0] && setModal({ type: "ai", file: e.target.files[0] })} />
        </div>

        {/* MANUAL ENTRY */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "36px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>✍️</div>
          <div style={{ fontSize: 14, color: T.textStrong, fontWeight: "bold", marginBottom: 16, textTransform: "uppercase" }}>Saisie Classique</div>
          <Btn onClick={() => setModal({ type: "manual" })}>+ Nouvelle Analyse</Btn>
        </div>
      </div>

      {/* HISTORIQUE DES ANALYSES */}
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"120px 1fr 80px 80px 80px 80px 1fr", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, background: T.surfaceHigh }}>
          <div>Date</div><div>Code Lot</div><div>pH</div><div>AT</div><div>SO2 L.</div><div>Alc.</div><div>Méthode / Source</div>
        </div>
        {analysesList.length === 0 ? (
          <div style={{ padding:"60px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucune analyse enregistrée.</div>
        ) : analysesList.sort((a,b) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime()).map((a) => (
          <div key={a.id} style={{ display:"grid", gridTemplateColumns:"120px 1fr 80px 80px 80px 80px 1fr", padding:"14px 16px", alignItems:"center", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize:12, color:T.textDim, fontFamily:"monospace" }}>{new Date(a.analysisDate).toLocaleDateString('fr-FR')}</div>
            <div style={{ fontSize:13, color:T.accentLight, fontFamily:"monospace", fontWeight:600 }}>{getLotCode(a.lotId)}</div>
            <div style={{ fontSize:13, color:T.textStrong, fontWeight: "bold" }}>{a.ph || "--"}</div>
            <div style={{ fontSize:13, color:T.text }}>{a.at || "--"}</div>
            <div style={{ fontSize:13, color:T.text }}>{a.so2Free || "--"}</div>
            <div style={{ fontSize:13, color:T.text }}>{a.alcohol || "--"}</div>
            <div style={{ fontSize:11, color:T.textDim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontStyle: "italic" }} title={a.notes}>{a.notes || "Saisie manuelle"}</div>
          </div>
        ))}
      </div>

      {modal?.type === "manual" && <AnalyseModal onClose={() => setModal(null)} onSuccess={handleSuccess} />}
      {modal?.type === "ai"     && <AIImportModal initialFile={modal.file} onClose={() => setModal(null)} onSuccess={handleSuccess} />}
    </div>
  );
}

// =============================================================================
// ADMIN & ORDRES DE TRAVAIL (PRODUCTION READY)
// =============================================================================
function WorkOrdersAdmin({ workOrders, setWorkOrders }) {
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
    sources: [{ lotId: "", volume: "" }]
  });

  const availLots = state.lots.filter(l => l.volume > 0 && l.status !== "TIRE");
  const availCuves = state.containers.filter(c => c.status === "VIDE" && c.status !== "ARCHIVÉE");
  
  const getLotCode = id => state.lots.find(l => String(l.id) === String(id))?.code || id;
  const getContainerName = id => state.containers.find(c => String(c.id) === String(id))?.displayName || state.containers.find(c => String(c.id) === String(id))?.name || id;

  const isTransfer = form.recette === "SOUTIRAGE";
  const isAssemblage = form.recette === "ASSEMBLAGE";
  const isIntrant = ["LEVURAGE", "SULFITAGE", "CHAPTALISATION", "ACIDIFICATION", "COLLAGE", "FILTRATION", "STABILISATION TARTRIQUE", "OUILLAGE", "AJOUT AUTRE PRODUIT"].includes(form.recette);

  const updateSource = (index, field, value) => {
    const newSources = [...form.sources];
    newSources[index][field] = value;
    setForm({ ...form, sources: newSources });
  };
  const addSource = () => setForm({ ...form, sources: [...form.sources, { lotId: "", volume: "" }] });
  const removeSource = (index) => setForm({ ...form, sources: form.sources.filter((_, i) => i !== index) });

  const createWO = async () => {
    // 1. Validation Frontend rapide
    if (isTransfer) {
      if (!form.sources[0].lotId || !form.targetContainerId || !form.sources[0].volume) return alert("Remplissez tous les champs pour le soutirage.");
    } else if (isAssemblage) {
      if (!form.targetContainerId || form.sources.some(s => !s.lotId || !s.volume)) return alert("Remplissez tous les champs et volumes des lots à assembler.");
    } else if (isIntrant) {
      if (!form.targetLotId || !form.details) return alert("Veuillez choisir un lot et indiquer les détails du produit.");
    }

    setIsSubmitting(true);

    try {
      // 2. Préparation du Payload pour l'API
      const payload = {
        recette: form.recette,
        targetContainerId: form.targetContainerId,
        targetLotId: form.targetLotId,
        details: form.details,
        // On n'envoie que les sources valides pour éviter les erreurs Zod
        sources: isIntrant 
          ? [{ lotId: form.targetLotId, volume: "1" }] // Volume factice pour passer la validation Zod si intrant
          : form.sources.filter(s => s.lotId && s.volume),
        idempotencyKey
      };

      const res = await fetch('/api/workorders', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la planification de l'ordre de travail.");
      }

      // 3. Mise à jour de l'UI (Optimistic UI ou remplacement par les données du serveur)
      setWorkOrders([data, ...workOrders]);
      dispatch({ type: "TOAST_ADD", payload: { msg: "Ordre de travail planifié avec succès !", color: T.green } });
      
      // Réinitialisation
      setIdempotencyKey(crypto.randomUUID());
      setModal(false);
      setForm({ recette: "SOUTIRAGE", targetContainerId: "", targetLotId: "", details: "", sources: [{ lotId: "", volume: "" }] });

    } catch (error) {
      alert(error.message);
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
        {workOrders.length === 0 ? <div style={{ padding:"40px", textAlign:"center", color:T.textDim }}>Aucun ordre de travail planifié.</div> : workOrders.map((w, i) => (
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
            <Select value={form.recette} onChange={e=>setForm({...form, recette: e.target.value})} disabled={isSubmitting}>
              {["SOUTIRAGE","ASSEMBLAGE","LEVURAGE","SULFITAGE","CHAPTALISATION","ACIDIFICATION","COLLAGE","FILTRATION","STABILISATION TARTRIQUE","OUILLAGE","AJOUT AUTRE PRODUIT"].map(r=><option key={r}>{r}</option>)}
            </Select>
          </FF>

          {isTransfer && (
            <>
              <FF label="Lot source (Cuve de départ)">
                <Select value={form.sources[0].lotId} onChange={e=>updateSource(0, "lotId", e.target.value)} disabled={isSubmitting}>
                  <option value="">-- Choisir un lot à soutirer --</option>
                  {availLots.map(l=><option key={l.id} value={l.id}>{l.code} (Dispo: {formatVolShort(l.volume)})</option>)}
                </Select>
              </FF>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <FF label="Volume (hL) à transférer">
                  <Input type="number" step="0.1" value={form.sources[0].volume} onChange={e=>updateSource(0, "volume", e.target.value)} disabled={isSubmitting} />
                </FF>
                <FF label="Cuve de destination">
                  <Select value={form.targetContainerId} onChange={e=>setForm({...form, targetContainerId:e.target.value})} disabled={isSubmitting}>
                    <option value="">-- Choisir une cuve vide --</option>
                    {availCuves.map(c=><option key={c.id} value={c.id}>{c.displayName || c.name} (Capacité: {c.capacity} hL)</option>)}
                  </Select>
                </FF>
              </div>
            </>
          )}

          {isAssemblage && (
            <div style={{ background:T.surfaceHigh, padding:14, borderRadius:6, border:`1px solid ${T.border}`, marginBottom:16 }}>
              <div style={{ fontSize:10, textTransform:"uppercase", color:T.textDim, marginBottom:10, fontWeight: "bold" }}>Composition de l'assemblage (Lots sources)</div>
              {form.sources.map((s, i) => (
                <div key={i} style={{ display:"flex", gap:8, marginBottom:8 }}>
                  <Select value={s.lotId} onChange={e=>updateSource(i, "lotId", e.target.value)} style={{ flex:2 }} disabled={isSubmitting}>
                    <option value="">-- Sélectionner un Lot --</option>
                    {availLots.map(l=><option key={l.id} value={l.id}>{l.code} (Dispo: {formatVolShort(l.volume)})</option>)}
                  </Select>
                  <Input type="number" step="0.1" placeholder="Vol (hL)" value={s.volume} onChange={e=>updateSource(i, "volume", e.target.value)} style={{ flex:1 }} disabled={isSubmitting} />
                  {form.sources.length > 1 && <Btn variant="ghost" onClick={()=>removeSource(i)} disabled={isSubmitting} style={{ color:T.red, padding:"0 8px" }}>✕</Btn>}
                </div>
              ))}
              <Btn variant="secondary" onClick={addSource} disabled={isSubmitting} style={{ fontSize:10, padding:"4px 8px", marginTop:4 }}>+ Ajouter un lot supplémentaire</Btn>
              
              <div style={{ marginTop:16, borderTop:`1px solid ${T.border}`, paddingTop:16 }}>
                <FF label="Cuve de destination finale (Assemblage)">
                  <Select value={form.targetContainerId} onChange={e=>setForm({...form, targetContainerId:e.target.value})} disabled={isSubmitting}>
                    <option value="">-- Choisir une cuve pour recevoir l'assemblage --</option>
                    {availCuves.map(c=><option key={c.id} value={c.id}>{c.displayName || c.name} (Capacité: {c.capacity} hL)</option>)}
                  </Select>
                </FF>
              </div>
            </div>
          )}

          {isIntrant && (
            <div style={{ background:T.surfaceHigh, padding:14, borderRadius:6, border:`1px solid ${T.border}`, marginBottom:16 }}>
              <FF label="Lot cible (à traiter)">
                <Select value={form.targetLotId} onChange={e=>setForm({...form, targetLotId:e.target.value})} disabled={isSubmitting}>
                  <option value="">-- Choisir le lot à traiter --</option>
                  {state.lots.filter(l => l.status !== "TIRE").map(l=><option key={l.id} value={l.id}>{l.code}</option>)}
                </Select>
              </FF>
              <FF label="Détails du produit (Nom exact, Quantité, Dosage...)">
                <Input value={form.details} onChange={e=>setForm({...form, details:e.target.value})} disabled={isSubmitting} placeholder="Ex: 5g/hL de SO2, Levure IOC 18-2007 (500g)..." />
              </FF>
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

// =============================================================================
// PARAMÈTRES
// =============================================================================
function Parametres({ theme, setTheme }) {
  const T = useTheme();
  return (
    <div>
      <div style={{ marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Paramètres</h1>
      </div>
      <div style={{ fontSize: 13, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16, fontWeight: "bold" }}>Apparence (Thème)</div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))", gap:12 }}>
        {Object.entries(THEMES).map(([key, th]) => (
          <div key={key} onClick={() => setTheme(key)} style={{ border:`2px solid ${theme===key?th.accent:T.border}`, padding:16, cursor:"pointer", background:theme===key?th.accent+"11":T.surfaceHigh, borderRadius:8, transition: "all 0.2s" }}>
            <div style={{ color:T.textStrong, fontWeight:"bold", marginBottom:4 }}>{th.name}</div>
            <div style={{ color:T.textDim, fontSize:11 }}>{th.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// GESTION DES UTILISATEURS (ADMIN)
// =============================================================================
function AdminUsers() {
  const T = useTheme(); 
  const { state, dispatch } = useStore();
  const { user, setUser } = useAuth(); 
  
  const [modal, setModal] = useState(false); 
  const [editUser, setEditUser] = useState(null); 
  const [form, setForm]   = useState({ name:"", email:"", role:"Caviste", pwd:"" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const set = (k,v) => setForm(f => ({...f,[k]:v}));

  const handleUpsertUser = async (isEdit = false) => {
    const dataToSubmit = isEdit ? editUser : form;
    if (!dataToSubmit.name || !dataToSubmit.email) return alert("Nom et Email obligatoires.");
    
    setIsSubmitting(true);
    
    try {
      // 👈 VRAI APPEL API (Fini la simulation !)
      const res = await fetch('/api/users', { 
        method: isEdit ? 'PUT' : 'POST', 
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(dataToSubmit) 
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la sauvegarde de l'utilisateur.");
      }

      // 'data' correspond maintenant à l'utilisateur fraîchement renvoyé par Prisma
      const savedUser = {
        ...data,
        initials: data.name.substring(0, 2).toUpperCase() // On recrée l'initiale pour l'UI
      };

      if (isEdit) {
        dispatch({ type: "UPDATE_USER", payload: savedUser });
        dispatch({ type: "TOAST_ADD", payload: { msg: "Profil utilisateur mis à jour.", color: T.blue } }); 
        
        // Si l'utilisateur modifie son PROPRE compte, on met à jour sa session active
        if (user && user.email === savedUser.email) {
          setUser({ ...user, name: savedUser.name, role: savedUser.role, initials: savedUser.initials });
        }
        setEditUser(null);
      } else {
        dispatch({ type: "ADD_USER", payload: savedUser });
        dispatch({ type: "TOAST_ADD", payload: { msg: "Nouvel utilisateur créé avec succès.", color: T.green } }); 
        setModal(false); 
        setForm({ name:"", email:"", role:"Caviste", pwd:"" });
      }

    } catch (error) {
      dispatch({ type: "TOAST_ADD", payload: { msg: error.message, color: T.red } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Utilisateurs & Droits d'Accès</h1>
        <Btn onClick={() => setModal(true)}>+ Ajouter utilisateur</Btn>
      </div>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 100px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, background: T.surfaceHigh }}>
          <div>Nom & Prénom</div><div>Adresse Email</div><div>Rôle (Droits)</div><div>Actions</div>
        </div>
        {state.users.map((u, i) => (
          <div key={u.id} style={{ display:"grid", gridTemplateColumns:"2fr 2fr 1fr 100px", alignItems:"center", padding:"16px 16px", borderBottom: i < state.users.length - 1 ? `1px solid ${T.border}` : "none" }}>
            <span style={{ color:T.textStrong, fontWeight:600 }}>{u.name}</span>
            <span style={{ color:T.textDim, fontFamily:"monospace", fontSize:12 }}>{u.email}</span>
            <div><Badge label={u.role} color={roleColor(T, u.role)} /></div>
            <Btn variant="ghost" onClick={() => setEditUser(u)}>Éditer</Btn>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="Ajouter un nouvel utilisateur" onClose={() => setModal(false)}>
          <FF label="Nom complet">
            <Input value={form.name} onChange={e => set("name",e.target.value)} disabled={isSubmitting} placeholder="Ex: Jean Dupont" />
          </FF>
          <FF label="Adresse Email (Sert d'identifiant)">
            <Input type="email" value={form.email} onChange={e => set("email",e.target.value)} disabled={isSubmitting} placeholder="jean@domaine.fr" />
          </FF>
          <FF label="Niveau d'accès (Rôle)">
            <Select value={form.role} onChange={e => set("role",e.target.value)} disabled={isSubmitting}>
              {["Chef de cave","Caviste","Lecture seule"].map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </FF>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 12, fontStyle: "italic", borderLeft: `2px solid ${T.accent}`, paddingLeft: 10 }}>
            Un email contenant un lien de connexion magique sera envoyé à cet utilisateur.
          </div>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
            <Btn variant="secondary" onClick={() => setModal(false)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={() => handleUpsertUser(false)} disabled={isSubmitting} style={{ background: isSubmitting ? T.textDim : T.accent }}>Créer l'accès</Btn>
          </div>
        </Modal>
      )}

      {editUser && (
        <Modal title="Modifier les droits utilisateur" onClose={() => setEditUser(null)}>
          <FF label="Nom complet">
            <Input value={editUser.name} onChange={e => setEditUser({...editUser, name:e.target.value})} disabled={isSubmitting} />
          </FF>
          <FF label="Adresse Email">
            <Input type="email" value={editUser.email} onChange={e => setEditUser({...editUser, email:e.target.value})} disabled={isSubmitting} />
          </FF>
          <FF label="Niveau d'accès (Rôle)">
            <Select value={editUser.role} onChange={e => setEditUser({...editUser, role:e.target.value})} disabled={isSubmitting}>
              {["Admin","Chef de cave","Caviste","Lecture seule"].map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
          </FF>
          <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
            <Btn variant="secondary" onClick={() => setEditUser(null)} disabled={isSubmitting}>Annuler</Btn>
            <Btn onClick={() => handleUpsertUser(true)} disabled={isSubmitting}>Sauvegarder les modifications</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =============================================================================
// JOURNAL D'AUDIT (SÉCURITÉ & TRAÇABILITÉ)
// =============================================================================
function AdminLogs() {
  const T = useTheme(); 
  const { state } = useStore();
  const lots = state.lots || []; 
  const getLotCode = id => lots.find(l => String(l.id) === String(id))?.code || id || "--";
  
  const [search, setSearch] = useState(""); 
  const [filterDates, setFilterDates] = useState([]);
  const [filterTypes, setFilterTypes] = useState([]); 
  const [filterLots, setFilterLots] = useState([]);
  const [filterOperators, setFilterOperators] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  // Génération des options uniques pour les filtres (basé sur le store local pour l'instant)
  const uniqueDates = [...new Set((state.events || []).map(e => e.date.split(" à ")[0]))].sort((a, b) => {
      const [d1, m1, y1] = a.split('/'); const [d2, m2, y2] = b.split('/');
      return new Date(y2, m2-1, d2) - new Date(y1, m1-1, d1);
  });
  const uniqueTypes = [...new Set((state.events || []).map(e => e.type))].sort();
  const uniqueLots = [...new Set((state.events || []).map(e => getLotCode(e.lotId)))].filter(c => c !== "--").sort();
  const uniqueOperators = [...new Set((state.events || []).map(e => e.operator))].filter(Boolean).sort();

  const parseDate = (dStr) => {
      if(!dStr) return 0;
      const [datePart, timePart] = dStr.split(' à ');
      if(!datePart) return 0;
      const [d, m, y] = datePart.split('/');
      const [h, min] = timePart ? timePart.split(':') : [0,0];
      return new Date(y, m-1, d, h, min).getTime();
  };
  
  const filteredEvents = (state.events || []).filter(e => {
    const lotCode = getLotCode(e.lotId);
    const dateOnly = e.date.split(' à ')[0];

    const matchSearch = !search || lotCode.toLowerCase().includes(search.toLowerCase()) || (e.note || "").toLowerCase().includes(search.toLowerCase());
    const matchDate = filterDates.length === 0 || filterDates.includes(dateOnly);
    const matchType = filterTypes.length === 0 || filterTypes.includes(e.type);
    const matchLot = filterLots.length === 0 || filterLots.includes(lotCode);
    const matchOperator = filterOperators.length === 0 || filterOperators.includes(e.operator);

    return matchSearch && matchDate && matchType && matchLot && matchOperator;
  }).sort((a,b) => parseDate(b.date) - parseDate(a.date));

  const toggleAll = () => { 
    if (selectedIds.length === filteredEvents.length && filteredEvents.length > 0) setSelectedIds([]); 
    else setSelectedIds(filteredEvents.map(e => e.id)); 
  };
  
  const toggleOne = (id) => { 
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter(x => x !== id)); 
    else setSelectedIds([...selectedIds, id]); 
  };

  const handleExportExcel = () => {
    const toExport = selectedIds.length > 0 ? filteredEvents.filter(e => selectedIds.includes(e.id)) : filteredEvents;
    if (toExport.length === 0) return alert("Aucune donnée à exporter.");
    const rows = [["Date", "Type d'opération", "Code Lot", "Flux Volume", "Détails / Notes", "Opérateur Validant"].join(";")];
    
    toExport.forEach(e => {
      const flux = e.volumeIn > 0 ? `+${e.volumeIn} hL` : e.volumeOut > 0 ? `-${e.volumeOut} hL` : "0";
      const cleanNote = `"${(e.note || "").replace(/"/g, '""')}"`;
      rows.push([e.date, e.type, getLotCode(e.lotId), flux, cleanNote, e.operator].join(";"));
    });

    const link = document.createElement("a"); 
    link.setAttribute("href", encodeURI("data:text/csv;charset=utf-8,\uFEFF" + rows.join("\n"))); 
    link.setAttribute("download", `Journal_Audit_${new Date().toISOString().slice(0,10)}.csv`); 
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Journal d'Audit</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Historique légal et inaltérable de toutes les opérations du chai.</div>
        </div>
        <Btn onClick={handleExportExcel} variant={selectedIds.length > 0 ? "primary" : "secondary"}>📥 Exporter Sélection (CSV)</Btn>
      </div>
      
      {/* FILTRES AVANCÉS MULTIPLES */}
      <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", alignItems:"center", background: T.surfaceHigh, padding: "16px 20px", borderRadius: 8, border: `1px solid ${T.border}` }}>
        <Input value={search} onChange={e => { setSearch(e.target.value); setSelectedIds([]); }} placeholder="🔍 Recherche libre..." style={{ width: 180 }} />
        
        <MultiSelectDrop label="Toutes les dates" options={uniqueDates} selected={filterDates} onChange={v => { setFilterDates(v); setSelectedIds([]); }} width={160} />
        <MultiSelectDrop label="Tous les types" options={uniqueTypes} selected={filterTypes} onChange={v => { setFilterTypes(v); setSelectedIds([]); }} format={t => t.replace(/_/g, " ")} width={160} />
        <MultiSelectDrop label="Tous les lots" options={uniqueLots} selected={filterLots} onChange={v => { setFilterLots(v); setSelectedIds([]); }} width={160} />
        <MultiSelectDrop label="Tous les opérateurs" options={uniqueOperators} selected={filterOperators} onChange={v => { setFilterOperators(v); setSelectedIds([]); }} width={180} />
        
        {(search || filterDates.length > 0 || filterTypes.length > 0 || filterLots.length > 0 || filterOperators.length > 0) && (
          <Btn variant="ghost" onClick={() => { setSearch(""); setFilterDates([]); setFilterTypes([]); setFilterLots([]); setFilterOperators([]); }} style={{ color: T.accent }}>
            ✕ Effacer filtres
          </Btn>
        )}
      </div>

      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"40px 130px 150px 170px 80px 1fr 120px", padding:"12px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, background: T.surfaceHigh }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
            <input type="checkbox" checked={selectedIds.length === filteredEvents.length && filteredEvents.length > 0} onChange={toggleAll} style={{cursor:"pointer", accentColor:T.accent}} />
          </div>
          <div>Date d'enregistrement</div><div>Type d'opération</div><div>Lot Impacté</div><div>Volume</div><div>Détails / Notes</div><div>Opérateur Validant</div>
        </div>
        {filteredEvents.length === 0 ? (
           <div style={{ padding:"60px", textAlign:"center", color:T.textDim, fontStyle: "italic" }}>Aucun événement d'audit ne correspond à vos filtres actuels.</div>
        ) : filteredEvents.map((e, i) => (
            <div key={e.id} style={{ display:"grid", gridTemplateColumns:"40px 130px 150px 170px 80px 1fr 120px", padding:"14px 16px", alignItems:"center", borderBottom: i < filteredEvents.length - 1 ? `1px solid ${T.border}` : "none", background: selectedIds.includes(e.id) ? T.accent+"11" : "transparent", transition:"background .15s" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
                <input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggleOne(e.id)} style={{cursor:"pointer", accentColor:T.accent}} />
              </div>
              <div style={{ fontSize:11, color:T.textDim, fontFamily:"monospace" }}>{e.date}</div>
              <div><Badge label={e.type} /></div>
              <div style={{ fontSize:12, color:T.accentLight, fontFamily:"monospace", fontWeight:600 }} title={getLotCode(e.lotId)}>{getLotCode(e.lotId)}</div>
              
              <div style={{ fontSize:12, fontFamily:"monospace", fontWeight: "bold", color: e.volumeIn > 0 ? T.green : e.volumeOut > 0 ? T.red : T.textDim }}>
                {e.volumeIn > 0 ? `+${e.volumeIn} hL` : e.volumeOut > 0 ? `-${e.volumeOut} hL` : "--"}
              </div>
              
              <div style={{ fontSize:12, color:T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontStyle: "italic" }} title={e.note}>{e.note || "--"}</div>
              <div style={{ fontSize:11, color:T.textDim, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }} title={e.operator}>{e.operator}</div>
            </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// RECHERCHE GLOBALE (SEARCH BAR)
// =============================================================================
function GlobalSearch({ onNavigate, onSelectContainer, onSelectLot }) {
  const T = useTheme(); 
  const { state } = useStore();
  const [query, setQuery] = useState(""); 
  const [open, setOpen] = useState(false);
  
  // Limite la recherche à 5 résultats max pour la performance
  const results = (state.lots || []).filter(l => l.code.toLowerCase().includes(query.toLowerCase())).map(l => ({ type:"lot", label:l.code, obj:l })).slice(0, 5);

  return (
    <div style={{ position:"relative", flex:1, maxWidth:420 }}>
      <Input 
        value={query} 
        onChange={e => { setQuery(e.target.value); setOpen(true); }} 
        placeholder="Rechercher un code lot (Ex: 2025-CH-AVZ)..." 
        style={{ width:"100%", background:T.surfaceHigh, border:`1px solid ${T.border}`, padding:"10px 14px", color:T.text, outline:"none", borderRadius: 20, fontFamily:"monospace", fontSize:13 }} 
      />
      {open && query.length >= 2 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, background:T.surface, zIndex:500, border:`1px solid ${T.border}`, borderRadius: 8, marginTop:8, boxShadow:"0 10px 30px rgba(0,0,0,0.5)", overflow: "hidden" }}>
          {results.length === 0 ? (
            <div style={{ padding: "12px 16px", fontSize: 12, color: T.textDim, fontStyle: "italic" }}>Aucun lot trouvé.</div>
          ) : results.map((r, i) => (
            <div key={i} onMouseDown={() => { setQuery(""); setOpen(false); onNavigate("lots"); onSelectLot(r.obj); }} 
                 style={{ padding:"12px 16px", cursor:"pointer", borderBottom: i < results.length-1 ? `1px solid ${T.border}` : "none", transition: "background 0.2s" }}
                 onMouseOver={e => e.currentTarget.style.background = T.surfaceHigh}
                 onMouseOut={e => e.currentTarget.style.background = "transparent"}>
              <span style={{color:T.accentLight, fontFamily:"monospace", fontSize:13, fontWeight:600}}>🍷 {r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ADMINISTRATIF & DOUANES (CAHIER DE PRESSOIR, DRM, EXPORTS)
// =============================================================================
function Administratif() {
  const T = useTheme(); 
  const { state } = useStore();
  const [tab, setTab] = useState("pressoir");
  const [modal, setModal] = useState(null);
  
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [drmMonth, setDrmMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; 
  });

  // ==========================================
  // 1. LOGIQUE CAHIER DE PRESSOIR
  // ==========================================
  const pressings = state.pressings || [];
  const years = [...new Set(pressings.map(p => p.date ? p.date.split("-")[0] : ""))].filter(Boolean).sort((a,b) => b - a);
  
  const activeYear = years.includes(year) ? year : (years[0] || new Date().getFullYear().toString());
  const filteredPressings = pressings
    .filter(p => p.date && p.date.startsWith(activeYear))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const totalKg = filteredPressings.reduce((sum, p) => sum + (parseFloat(p.weightKilos || p.weight) || 0), 0);
  const totalTheoCuvee = ((totalKg / 4000) * 20.5).toFixed(2);
  const totalTheoTaille = ((totalKg / 4000) * 5.0).toFixed(2);

  // ==========================================
  // 2. LOGIQUE DRM (REGISTRE DE CAVE)
  // ==========================================
  const [drmY, drmM] = drmMonth.split('-');
  const targetMonthStr = `${drmM}/${drmY}`; 
  const currentMonthLabel = new Date(drmMonth + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const drmEvents = (state.events || []).filter(e => e.date.includes(targetMonthStr));
  const pertesMois = drmEvents.filter(e => e.type === "PERTE" || e.type === "CASSE");
  const distillerieMois = drmEvents.filter(e => e.type === "DISTILLERIE");

  const getVolSafe = (e) => {
    const vol = parseFloat(e.volumeOut || e.volumeIn || 0);
    if (vol > 0) return vol;
    return parseFloat(e.note?.match(/\d+(\.\d+)?/)?.[0] || 0);
  };

  const distilMoisHl = distillerieMois.reduce((s, e) => s + getVolSafe(e), 0);

  const getLotNameSafe = (e) => {
    const lot = state.lots?.find(l => String(l.id) === String(e.lotId));
    if (lot) return lot.code;
    const bLot = state.bottleLots?.find(b => String(b.id) === String(e.lotId));
    return bLot ? bLot.code : "Inconnu";
  };

  // ==========================================
  // 3. MOTEUR D'EXPORTS (CSV & PDF)
  // ==========================================
  
  // Fonction utilitaire pour déclencher le téléchargement d'un CSV
  const downloadCSV = (csvContent, fileName) => {
    // Le BOM (\uFEFF) force Excel à lire le fichier en UTF-8 (pour les accents)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPressoirCSV = () => {
    // Séparateur Point-Virgule pour Excel France
    let csv = "Date;N° Marc;Parcelle/Provenance;Cépage;Kilos;Degré;Destination\n";
    filteredPressings.forEach(p => {
      const dateStr = new Date(p.date).toLocaleDateString('fr-FR');
      const marc = p.marcNumber || "";
      const parcelle = p.parcelleName || p.provenance || "";
      const cepage = p.cepage || "";
      const kilos = p.weightKilos || p.weight || 0;
      const degre = p.potentialAlc || "";
      const dest = p.destinationTank || "";
      csv += `${dateStr};${marc};${parcelle};${cepage};${kilos};${degre};${dest}\n`;
    });
    downloadCSV(csv, `Cahier_Pressoir_${activeYear}.csv`);
  };

  const exportDrmCSV = () => {
    let csv = "Date;Type de Sortie;Lot concerne;Quantite Sortie;Unite;Motif/Destinataire;Operateur\n";
    
    distillerieMois.forEach(e => {
      const dateStr = e.date.split(" à ")[0];
      const note = e.note?.replace("[DISTILLERIE] Motif: ", "") || "";
      csv += `${dateStr};DISTILLERIE;${getLotNameSafe(e)};${getVolSafe(e)};hL;${note};${e.operator}\n`;
    });

    pertesMois.forEach(e => {
      const dateStr = e.date.split(" à ")[0];
      const unite = e.type === "CASSE" ? "Bouteilles" : "hL";
      csv += `${dateStr};${e.type};${getLotNameSafe(e)};${getVolSafe(e)};${unite};${e.note};${e.operator}\n`;
    });

    downloadCSV(csv, `DRM_Sorties_${drmMonth}.csv`);
  };

  const exportPDF = () => {
    // Déclenche la fenêtre d'impression native du navigateur
    window.print();
  };

  return (
    <div className="admin-container">
      {/* RÈGLES D'IMPRESSION (Masque les menus lors de l'export PDF) */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .admin-container, .admin-container * { visibility: visible; }
          .admin-container { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .print-header { font-size: 24px !important; margin-bottom: 20px !important; color: #000 !important; }
        }
      `}</style>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
        <h1 className="print-header" style={{ fontFamily:"'Playfair Display', serif", fontSize:32, color:T.textStrong, margin:0 }}>
          {tab === "pressoir" ? `Cahier de Pressoir - ${activeYear}` : `Registre de Cave - ${currentMonthLabel}`}
        </h1>
        
        {/* BOUTONS CACHÉS À L'IMPRESSION */}
        <div className="no-print" style={{ display:"flex", gap: 10 }}>
          <button onClick={() => setTab("pressoir")} style={{ background: tab==="pressoir" ? T.accent : "transparent", color: tab==="pressoir" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 4, fontSize: 11, fontWeight: "bold", cursor: "pointer", transition:"all .2s" }}>
            CAHIER DE PRESSOIR
          </button>
          <button onClick={() => setTab("drm")} style={{ background: tab==="drm" ? T.accent : "transparent", color: tab==="drm" ? T.bg : T.accent, border: `1px solid ${T.accent}`, padding: "9px 18px", borderRadius: 4, fontSize: 11, fontWeight: "bold", cursor: "pointer", transition:"all .2s" }}>
            REGISTRE DE CAVE (DRM)
          </button>
        </div>
      </div>

      {/* --- VUE CAHIER DE PRESSOIR --- */}
      {tab === "pressoir" && (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
          
          <div className="no-print" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:T.surfaceHigh, padding:20, borderRadius:8, border:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", gap:24, alignItems:"center" }}>
              <FF label="Année de récolte">
                <Select value={activeYear} onChange={e => setYear(e.target.value)} style={{ width:120 }}>
                  {years.length > 0 ? years.map(y => <option key={y} value={y}>{y}</option>) : <option value={year}>{year}</option>}
                </Select>
              </FF>
              <div style={{ height:30, width:1, background:T.border }} />
              <div>
                <div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", marginBottom:4 }}>Total Kilos {activeYear}</div>
                <div style={{ fontSize:18, color:T.accentLight, fontWeight:"bold" }}>{totalKg.toLocaleString()} kg</div>
              </div>
            </div>
            <div style={{ display:"flex", gap:16, alignItems: "center" }}>
              <Btn variant="secondary" onClick={exportPressoirCSV}>📥 Exporter CSV</Btn>
              <Btn variant="secondary" onClick={exportPDF}>📄 Imprimer PDF</Btn>
            </div>
          </div>

          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
             <div style={{ display: "grid", gridTemplateColumns: "100px 100px 1.5fr 1fr 100px 80px 1fr", padding: "12px 20px", background: T.surfaceHigh, borderBottom: `2px solid ${T.border}`, fontSize: 10, fontWeight: "bold", color: T.textDim, textTransform: "uppercase" }}>
                <div>Date</div><div>N° Marc</div><div>Parcelle</div><div>Cépage</div><div style={{textAlign:"right"}}>Kilos</div><div style={{textAlign:"right"}}>Dég.</div><div>Destination</div>
             </div>
             {filteredPressings.map((p, i) => (
                <div key={p.id} style={{ display: "grid", gridTemplateColumns: "100px 100px 1.5fr 1fr 100px 80px 1fr", padding: "14px 20px", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: i%2===0?"transparent":T.surfaceHigh+"44", fontSize: 13 }}>
                   <div style={{ color:T.textDim }}>{new Date(p.date).toLocaleDateString('fr-FR').slice(0,5)}</div>
                   <div style={{ fontFamily:"monospace", fontWeight:"bold" }}>{p.marcNumber || `M-${i+1}`}</div>
                   <div style={{ fontWeight:"500" }}>{p.parcelleName || p.provenance}</div>
                   <div style={{ color:T.textDim }}>{p.cepage}</div>
                   <div style={{ textAlign:"right", fontWeight:"bold" }}>{p.weightKilos?.toLocaleString()}</div>
                   <div style={{ textAlign:"right", color:T.accent }}>{p.potentialAlc}°</div>
                   <div style={{ textAlign:"right", fontSize:11, color:T.textDim }}>{p.destinationTank || "En pressoir"}</div>
                </div>
             ))}
             {/* Total visible à l'impression */}
             <div style={{ padding: "16px 20px", background: T.surfaceHigh, borderTop: `2px solid ${T.border}`, textAlign: "right" }}>
                <span style={{ fontSize: 12, textTransform: "uppercase", color: T.textDim, marginRight: 16 }}>Poids Total :</span>
                <span style={{ fontSize: 16, fontWeight: "bold", color: T.textStrong }}>{totalKg.toLocaleString()} kg</span>
             </div>
          </div>
        </div>
      )}

      {/* --- VUE DRM --- */}
      {tab === "drm" && (
        <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
          
          <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: T.textStrong }}>Période :</span>
              <Input type="month" value={drmMonth} onChange={e => setDrmMonth(e.target.value)} style={{ width: 170 }} />
            </div>
            <div style={{ display: "flex", gap: 12 }}>
               <Btn variant="secondary" onClick={exportDrmCSV}>📥 Exporter CSV</Btn>
               <Btn variant="secondary" onClick={exportPDF}>📄 Imprimer PDF</Btn>
            </div>
          </div>

          {/* Section Distillerie */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", color: T.textStrong, textTransform: "uppercase", letterSpacing: 1 }}>Sorties Distillerie</div>
              <div style={{ fontSize: 14, fontWeight: "bold", color: "#d98b2b", fontFamily: "monospace" }}>Total : -{distilMoisHl.toFixed(2)} hL</div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"120px 150px 100px 1fr 120px", padding:"10px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase" }}>
              <div>Date</div><div>Lot</div><div>Quantité</div><div>Motif</div><div>Opérateur</div>
            </div>
            {distillerieMois.length === 0 ? <div style={{ padding:30, textAlign:"center", color:T.textDim }}>Aucun mouvement ce mois-ci.</div> : 
              distillerieMois.map(e => (
                <div key={e.id} style={{ display:"grid", gridTemplateColumns:"120px 150px 100px 1fr 120px", padding:"14px 16px", borderBottom:`1px solid ${T.border}`, fontSize:12 }}>
                  <div style={{ color:T.textDim }}>{e.date.split(" à ")[0]}</div>
                  <div style={{ fontWeight:"bold" }}>{getLotNameSafe(e)}</div>
                  <div style={{ color:"#d98b2b", fontWeight:"bold" }}>-{getVolSafe(e)} hL</div>
                  <div>{e.note?.replace("[DISTILLERIE] Motif: ", "")}</div>
                  <div style={{ color:T.textDim }}>{e.operator}</div>
                </div>
              ))
            }
          </div>
          
          {/* Section Pertes */}
          <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20 }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: "bold", color: T.textStrong, textTransform: "uppercase", letterSpacing: 1 }}>Pertes & Casses déclarées</div>
                <Btn className="no-print" onClick={() => setModal("perte")} style={{ background:T.red, borderColor:T.red, color:"#fff" }}>⚠️ Déclarer Perte</Btn>
             </div>
             <div style={{ display:"grid", gridTemplateColumns:"120px 80px 150px 100px 1fr 120px", padding:"10px 16px", borderBottom:`1px solid ${T.border}`, fontSize:10, color:T.textDim, textTransform:"uppercase" }}>
                <div>Date</div><div>Type</div><div>Lot</div><div>Quantité</div><div>Motif</div><div>Opérateur</div>
             </div>
             {pertesMois.length === 0 ? <div style={{ padding:30, textAlign:"center", color:T.textDim }}>Aucune perte déclarée.</div> :
               pertesMois.map(e => (
                 <div key={e.id} style={{ display:"grid", gridTemplateColumns:"120px 80px 150px 100px 1fr 120px", padding:"14px 16px", borderBottom:`1px solid ${T.border}`, fontSize:12 }}>
                   <div style={{ color:T.textDim }}>{e.date.split(" à ")[0]}</div>
                   <div><Badge label={e.type} color={T.red} /></div>
                   <div style={{ fontWeight:"bold" }}>{getLotNameSafe(e)}</div>
                   <div style={{ color:T.red, fontWeight:"bold" }}>-{getVolSafe(e)} {e.type === "CASSE" ? "btl" : "hL"}</div>
                   <div>{e.note}</div>
                   <div style={{ color:T.textDim }}>{e.operator}</div>
                 </div>
               ))
             }
          </div>
        </div>
      )}
      
      {modal === "perte" && <PerteCasseModal onClose={() => setModal(null)} />}
    </div>
  );
}

// =============================================================================
// MODALE : DÉCLARATION DE PERTES ET CASSES (SÉCURISÉE)
// =============================================================================
function PerteCasseModal({ onClose }) {
  const T = useTheme();
  const { user } = useAuth();
  const { state, dispatch, refreshData } = useStore();

  const [type, setType] = useState("BOTTLE"); // "BOTTLE" ou "BULK"
  const [entityId, setEntityId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  
  // 👈 NOUVEAU: Sécurité de l'appel API
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const availBulk = (state.lots || []).filter(l => l.volume > 0 && l.status !== "TIRE" && l.status !== "ARCHIVE");
  const availBottles = (state.bottleLots || []).filter(b => b.currentCount > 0);

  const submit = async () => {
    if (!entityId || !amount || !note) return alert("Veuillez remplir tous les champs, le motif est obligatoire.");
    
    setIsSubmitting(true);
    try {
      const payload = { 
        entityType: type, 
        entityId: String(entityId), 
        amount: parseFloat(amount), 
        note: note.trim(),
        idempotencyKey: idempotencyKey
      };

      const res = await fetch('/api/pertes', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || "Une erreur est survenue.");
        throw new Error(data.message || data.error || "Une erreur est survenue.");
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: "Déclaration enregistrée et validée pour les douanes.", color: T.green } });
      
      // On rafraîchit la BDD complète pour mettre à jour les stocks et le DRM
      if (refreshData) await refreshData();
      onClose();

    } catch(e) { 
      dispatch({ type: "TOAST_ADD", payload: { msg: e.message, color: T.red } });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Déclarer une Perte ou Casse" onClose={onClose}>
      <div style={{ background:T.red+"15", padding:14, borderRadius:4, marginBottom:20, fontSize:12, color:T.red, borderLeft:`3px solid ${T.red}` }}>
        Attention : Cette opération est transactionnelle et définitive. Les volumes ou bouteilles seront immédiatement soustraits du registre de cave légal.
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12, marginBottom:16 }}>
        <FF label="Type de perte">
          <Select value={type} onChange={e => { setType(e.target.value); setEntityId(""); }}>
            <option value="BOTTLE">Casse Bouteilles (unités)</option>
            <option value="BULK">Perte Vrac (hL) / Distillerie</option>
          </Select>
        </FF>
        <FF label="Lot concerné">
          <Select value={entityId} onChange={e => setEntityId(e.target.value)}>
            <option value="">-- Choisir un lot --</option>
            {type === "BULK" 
              ? availBulk.map(l => <option key={l.id} value={l.id}>{l.code} (Dispo: {l.volume} hL)</option>)
              : availBottles.map(b => <option key={b.id} value={b.id}>{b.code} (Dispo: {b.currentCount} btl)</option>)
            }
          </Select>
        </FF>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:12 }}>
        <FF label={type === "BULK" ? "Volume perdu (hL)" : "Nombre de bouteilles"}>
          <Input type="number" step={type === "BULK" ? "0.1" : "1"} value={amount} onChange={e => setAmount(e.target.value)} />
        </FF>
        <FF label="Motif (Obligatoire Douanes)">
          <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Ex: Casse palette, [DISTILLERIE] Envoi MCR..." />
        </FF>
      </div>

      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop:24 }}>
        <Btn variant="secondary" onClick={onClose} disabled={isSubmitting}>Annuler</Btn>
        <Btn onClick={submit} disabled={isSubmitting || !entityId || !amount || !note} style={{ background: isSubmitting ? T.textDim : T.red, borderColor: isSubmitting ? T.textDim : T.red, color: "#fff", transition: "background 0.2s" }}>
          {isSubmitting ? "Enregistrement sécurisé..." : "Confirmer la perte / sortie"}
        </Btn>
      </div>
    </Modal>
  );
}

// =============================================================================
// MODULE PLANIFICATEUR DE VENDANGES (100% SÉCURISÉ & STATELESS)
// =============================================================================
function PlanificateurVendanges() {
  const T = useTheme();
  const { state, dispatch } = useStore();

  // --- ÉTATS LOCAUX (Mémoire vive uniquement - Plus de LocalStorage) ---
  const [globalTarget, setGlobalTarget] = useState(10.5);
  const [customTargets, setCustomTargets] = useState({});

  const [filterCepage, setFilterCepage] = useState("");
  const [filterCommune, setFilterCommune] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'asc' });

  // --- ÉTATS SERVEUR (Données Calculées) ---
  const [serverProjections, setServerProjections] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);

  // 👈 APPEL API DEBOUNCÉ (Seul le serveur effectue les calculs critiques)
  useEffect(() => {
    const fetchCalculations = async () => {
      setIsCalculating(true);
      try {
        const res = await fetch('/api/vendanges/calculate', {
          method: 'POST',
          headers: buildApiHeaders(user),
          headers: buildApiHeaders(user),
          body: JSON.stringify({ globalTarget, customTargets })
        });
        
        if (res.ok) {
          const data = await res.json();
          // Conversion des ISO strings reçues du serveur en objets Date pour le tri
          const hydratedData = data.map(d => ({
            ...d,
            proj: { 
              ...d.proj, 
              projDate: new Date(d.proj.projDate), 
              lastDate: new Date(d.proj.lastDate) 
            }
          }));
          setServerProjections(hydratedData);
        } else {
          throw new Error("Erreur de calcul serveur.");
        }
      } catch (e) {
        dispatch({ type: "TOAST_ADD", payload: { msg: "Erreur lors du calcul des prédictions.", color: T.red } });
      } finally {
        setIsCalculating(false);
      }
    };

    // Debounce pour optimiser les appels serveurs lors de la saisie
    const timerId = setTimeout(() => { fetchCalculations(); }, 500);
    return () => clearTimeout(timerId);
    
  }, [globalTarget, customTargets, dispatch, T.red]);


  // --- HELPERS D'AFFICHAGE ---
  const handleCustomTarget = (parcelleName, val) => {
    const num = parseFloat(val);
    if (isNaN(num)) {
      const newT = { ...customTargets };
      delete newT[parcelleName];
      setCustomTargets(newT);
    } else {
      setCustomTargets({ ...customTargets, [parcelleName]: num });
    }
  };

  const getSanitaryColor = (maladie, intensite) => {
    if (!maladie || maladie === "Aucune") return T.green;
    const num = parseFloat(intensite) || 0;
    if (!intensite || num >= 10) return T.red;
    if (num >= 5) return "#d98b2b";
    return T.green; 
  };

  // Synchronisation avec les données géographiques locales
  const allProjections = serverProjections.map(backendProj => {
    const geoParcelle = (state.parcelles || []).find(p => p.nom === backendProj.parcelleNom) || {};
    return {
      parcelle: { 
        nom: backendProj.parcelleNom, 
        cepage: backendProj.cepage, 
        commune: geoParcelle.commune || "Inconnue" 
      },
      proj: backendProj.proj
    };
  });

  const availableCepages = [...new Set(allProjections.map(p => p.parcelle.cepage).filter(Boolean))].sort();
  const availableCommunes = [...new Set(allProjections.map(p => p.parcelle.commune).filter(Boolean))].sort();

  let displayedProjections = allProjections.filter(({ parcelle }) => {
    if (filterCepage && parcelle.cepage !== filterCepage) return false;
    if (filterCommune && parcelle.commune !== filterCommune) return false;
    return true;
  });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  displayedProjections.sort((a, b) => {
    let valA, valB;
    switch (sortConfig.key) {
      case 'parcelle': valA = a.parcelle.nom.toLowerCase(); valB = b.parcelle.nom.toLowerCase(); break;
      case 'cible': valA = a.proj.adjustedTarget; valB = b.proj.adjustedTarget; break;
      case 'tavp': valA = a.proj.currentDeg; valB = b.proj.currentDeg; break;
      case 'dynamique': valA = a.proj.degrePerDay; valB = b.proj.degrePerDay; break;
      case 'sanitaire': valA = a.proj.intensiteNum; valB = b.proj.intensiteNum; break;
      case 'date': valA = a.proj.projDate; valB = b.proj.projDate; break;
      default: valA = a.proj.projDate; valB = b.proj.projDate;
    }
    if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
    if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const SortHeader = ({ label, sortKey, align = "left" }) => {
    const isActive = sortConfig.key === sortKey;
    const arrow = isActive ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ' ↕';
    return (
      <div 
        onClick={() => handleSort(sortKey)} 
        style={{ textAlign: align, cursor: "pointer", userSelect: "none", color: isActive ? T.accentLight : T.textDim, transition: "color 0.2s" }}
      >
        {label} <span style={{ fontSize: 10, opacity: isActive ? 1 : 0.5 }}>{arrow}</span>
      </div>
    );
  };

  const calculateAverages = () => {
    const statsByCepage = {};
    const statsByZone = {};

    allProjections.forEach(({ parcelle, proj }) => {
      const c = parcelle.cepage || "Autre";
      if (!statsByCepage[c]) statsByCepage[c] = { sumDates: 0, count: 0 };
      statsByCepage[c].sumDates += proj.projDate.getTime();
      statsByCepage[c].count += 1;

      const z = parcelle.commune || "Zone inconnue";
      if (!statsByZone[z]) statsByZone[z] = { sumDates: 0, count: 0 };
      statsByZone[z].sumDates += proj.projDate.getTime();
      statsByZone[z].count += 1;
    });

    const formatMeanDate = (sum, count) => {
      if (count === 0) return "-";
      return new Date(sum / count).toLocaleDateString('fr-FR');
    };

    return {
      cepages: Object.entries(statsByCepage).map(([name, data]) => ({ name, date: formatMeanDate(data.sumDates, data.count), count: data.count })),
      zones: Object.entries(statsByZone).map(([name, data]) => ({ name, date: formatMeanDate(data.sumDates, data.count), count: data.count }))
    };
  };

  const averages = calculateAverages();

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Planificateur de Vendanges</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Outil d'Aide à la Décision (Backend Calculation).</div>
        </div>
        {isCalculating && <div style={{ fontSize: 12, color: T.accentLight, fontWeight: "bold", background: T.accent+"22", padding: "6px 12px", borderRadius: 20 }}>↻ Calculs en cours...</div>}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, opacity: isCalculating ? 0.7 : 1, transition: "opacity 0.3s" }}>
        
        <div style={{ background: T.surfaceHigh, padding: "20px 24px", borderRadius: 8, border: `1px solid ${T.border}`, display: "flex", flexWrap: "wrap", gap: 24, justifyContent: "space-between", alignItems: "center" }}>
          
          <div style={{ display: "flex", gap: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: "bold", color: T.textStrong }}>Cible globale :</span>
              <div style={{ display: "flex", alignItems: "center" }}>
                <Input type="number" step="0.1" value={globalTarget} onChange={e => setGlobalTarget(parseFloat(e.target.value) || 10.0)} style={{ width: 80, fontSize: 16, textAlign: "center", fontWeight: "bold", color: T.accent }} />
                <span style={{ marginLeft: 8, color: T.textDim, fontSize: 12 }}>%vol</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", borderLeft: `1px dashed ${T.border}`, paddingLeft: 32 }}>
              <span style={{ fontSize: 12, color: T.textDim }}>Filtrer :</span>
              <Select value={filterCepage} onChange={e => setFilterCepage(e.target.value)} style={{ width: 140 }}>
                <option value="">Tous Cépages</option>
                {availableCepages.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Select value={filterCommune} onChange={e => setFilterCommune(e.target.value)} style={{ width: 160 }}>
                <option value="">Toutes Communes</option>
                {availableCommunes.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </div>
          </div>
        </div>

        {/* ... (Reste du rendu UI inchangé, il était déjà conforme) ... */}
        {allProjections.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: "bold", color: T.accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>📊 Moyenne par Cépage</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                {averages.cepages.map(avg => (
                  <div key={avg.name} style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, padding: "12px 20px", borderRadius: 6, flex: 1, minWidth: 120 }}>
                    <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong }}>{avg.name}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>({avg.count} parcelles)</div>
                    <div style={{ fontSize: 18, color: T.accentLight, fontFamily: "monospace", fontWeight: "bold" }}>{avg.date}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* ... etc ... */}
          </div>
        )}
        
        {/* Grille de données identique à l'originale */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1.5fr 1.5fr", padding: "12px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 11, textTransform: "uppercase", fontWeight: "bold", background: T.surfaceHigh }}>
            <SortHeader label="Parcelle" sortKey="parcelle" />
            <SortHeader label="Cible" sortKey="cible" align="center" />
            <SortHeader label="Dernier TAVP" sortKey="tavp" align="center" />
            <SortHeader label="Dynamique" sortKey="dynamique" align="center" />
            <SortHeader label="État Sanitaire" sortKey="sanitaire" align="center" />
            <SortHeader label="Date estimée" sortKey="date" align="right" />
          </div>
          {displayedProjections.map(({ parcelle, proj }, i) => {
            const sColor = getSanitaryColor(proj.maladie, proj.intensiteNum);
            return (
              <div key={parcelle.nom} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.5fr 1fr 1.5fr 1.5fr", padding: "16px 20px", alignItems: "center", borderBottom: i < displayedProjections.length - 1 ? `1px solid ${T.border}` : 'none', background: proj.isReady ? T.green+"11" : "transparent" }}>
                <div>
                  <div style={{ fontWeight: "bold", color: T.textStrong, fontSize: 14 }}>{parcelle.nom}</div>
                  <div style={{ fontSize: 11, color: T.accent, marginTop: 4 }}>{parcelle.cepage} • {parcelle.commune}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <Input type="number" step="0.1" placeholder={globalTarget.toString()} value={customTargets[parcelle.nom] || ""} onChange={e => handleCustomTarget(parcelle.nom, e.target.value)} style={{ width: 60, fontSize: 14, fontWeight: "bold", color: T.textStrong, textAlign: "center", padding: "4px", background: "transparent", borderColor: customTargets[parcelle.nom] ? T.accent : "transparent" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong }}>{proj.currentDeg.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>le {proj.lastDate.toLocaleDateString('fr-FR').slice(0,5)}</div>
                </div>
                <div style={{ textAlign: "center" }}>
                   <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong }}>+{proj.degrePerDay.toFixed(2)}°/j</div>
                </div>
                <div style={{ textAlign: "center", borderLeft: `1px dashed ${T.border}`, borderRight: `1px dashed ${T.border}`, padding: "0 10px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ color: sColor, fontSize: "11px", fontWeight: "bold", textTransform: "uppercase" }}>{proj.riskLabel}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {proj.isReady ? <Badge label="VENDANGEABLE" color={T.green} /> : <div style={{ fontSize: 14, fontWeight: "bold", color: proj.riskLevel === "RED" ? T.red : T.accentLight }}>{proj.projDate.toLocaleDateString('fr-FR')}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUIVI DE MATURATION (VIGNOBLE) - PRODUCTION READY
// =============================================================================
function MaturationModal({ onClose, editData = null }) {
  const T = useTheme();
  const { user } = useAuth();
  const { state, dispatch, refreshData } = useStore();

  const [form, setForm] = useState(() => {
    if (editData) {
      return {
        ...editData,
        date: new Date(editData.date).toISOString().slice(0, 10),
        sucre: editData.sucre ?? "", ph: editData.ph ?? "", at: editData.at ?? "",
        malique: editData.malique ?? "", tartrique: editData.tartrique ?? "",
        maladie: editData.maladie || "Aucune", intensite: editData.intensite ?? "", notes: editData.notes || ""
      };
    }
    return {
      date: new Date().toISOString().slice(0, 10), parcelle: "", cepage: "CH",
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
        headers: buildApiHeaders(user),
        body: JSON.stringify({ nom: newNom.trim(), departement: newDep, region: newReg, commune: newCom }) 
      });
      if (res.ok) {
        const d = await res.json();
        dispatch({ type: "ADD_PARCELLE", payload: d });
        setForm({ ...form, parcelle: d.nom });
        setIsAddingParcelle(false);
        setNewDep(""); setNewReg(""); setNewCom(""); setNewNom("");
      } else { alert("Erreur lors de la création de la parcelle."); }
    } catch (e) { alert("Erreur réseau."); }
  };

  const submit = async () => {
    if (!form.parcelle) return alert("Veuillez sélectionner une parcelle.");
    if (!form.date) return alert("La date est requise.");
    
    setIsSubmitting(true);
    
    try {
      // Nettoyage des virgules pour les décimales
      const cleanNum = (val) => val ? String(val).replace(',', '.') : "";
      
      const payload = {
        ...form,
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
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        dispatch({ type: form.id ? "UPDATE_MATURATION" : "ADD_MATURATION", payload: data });
        dispatch({ type: "TOAST_ADD", payload: { msg: `Prélèvement ${form.id ? 'mis à jour' : 'enregistré'} avec succès.`, color: T.green } });
        
        if (refreshData) await refreshData(); // Force la resync de la base
        onClose();
      } else {
        throw new Error(data.error || "Erreur de sauvegarde.");
      }
    } catch (e) { 
      alert(e.message); 
      setIsSubmitting(false);
    }
  };

  const depts = Object.keys(CHAMPAGNE_GEODATA || {});
  const regions = newDep ? Object.keys(CHAMPAGNE_GEODATA[newDep]) : [];
  const communes = (newDep && newReg) ? CHAMPAGNE_GEODATA[newDep][newReg] : [];

  return (
    <Modal title={form.id ? "Compléter les analyses" : "Saisir un prélèvement"} onClose={onClose}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
        <FF label="Date"><Input type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} disabled={isSubmitting} /></FF>
        <FF label="Cépage">
          <Select value={form.cepage} onChange={e=>setForm({...form, cepage:e.target.value})} disabled={isSubmitting}>
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
          <Select value={form.parcelle} onChange={e => {
            if (e.target.value === "ADD_NEW") setIsAddingParcelle(true);
            else setForm({...form, parcelle: e.target.value});
          }} disabled={isSubmitting}>
            <option value="">-- Choisir une parcelle --</option>
            {(state.parcelles || []).map(p => <option key={p.id} value={p.nom}>{p.nom} {p.commune ? `(${p.commune})` : ""}</option>)}
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
            <Select value={newDep} onChange={e => { setNewDep(e.target.value); setNewReg(""); setNewCom(""); }}>
              <option value="">Département</option>
              {depts.map(d => <option key={d}>{d}</option>)}
            </Select>
            <Select value={newReg} onChange={e => { setNewReg(e.target.value); setNewCom(""); }} disabled={!newDep}>
              <option value="">Région / Sous-région</option>
              {regions.map(r => <option key={r}>{r}</option>)}
            </Select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <Select value={newCom} onChange={e => setNewCom(e.target.value)} disabled={!newReg}>
              <option value="">Commune</option>
              {communes.map(c => <option key={c}>{c}</option>)}
            </Select>
            <Input autoFocus value={newNom} onChange={e=>setNewNom(e.target.value)} placeholder="Nom (Ex: Les Craies)" />
          </div>

          <Btn onClick={handleSaveNewParcelle} style={{ width: "100%" }} disabled={!newNom || !newDep || !newReg || !newCom}>Enregistrer la parcelle</Btn>
        </div>
      )}

      <div style={{ background: T.surfaceHigh, padding: 14, borderRadius: 4, border: `1px solid ${T.border}`, marginTop: 16 }}>
        <div style={{ fontSize:11, color:T.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>Analyses</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FF label="Sucre (g/L)"><Input type="text" inputMode="decimal" value={form.sucre} onChange={e=>setForm({...form, sucre:e.target.value})} placeholder="Ex: 154" disabled={isSubmitting} /></FF>
          <FF label="Acidité Totale"><Input type="text" inputMode="decimal" value={form.at} onChange={e=>setForm({...form, at:e.target.value})} placeholder="Ex: 8.5" disabled={isSubmitting} /></FF>
          <FF label="pH"><Input type="text" inputMode="decimal" value={form.ph} onChange={e=>setForm({...form, ph:e.target.value})} placeholder="Ex: 3.05" disabled={isSubmitting} /></FF>
          <FF label="Acide Malique"><Input type="text" inputMode="decimal" value={form.malique} onChange={e=>setForm({...form, malique:e.target.value})} placeholder="Ex: 6.2" disabled={isSubmitting} /></FF>
          <FF label="Acide Tartrique"><Input type="text" inputMode="decimal" value={form.tartrique} onChange={e=>setForm({...form, tartrique:e.target.value})} placeholder="Ex: 7.1" disabled={isSubmitting} /></FF>
        </div>
      </div>

      <div style={{ background: T.surfaceHigh, padding: 14, borderRadius: 4, border: `1px solid ${T.border}`, marginTop: 16, marginBottom: 16 }}>
        <div style={{ fontSize:11, color:T.textDim, textTransform:"uppercase", letterSpacing:1, marginBottom:12 }}>État Sanitaire</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <FF label="Symptôme">
            <Select value={form.maladie} onChange={e=>setForm({...form, maladie:e.target.value})} disabled={isSubmitting}>
              <option value="Aucune">Sain (Aucune)</option>
              <option value="Mildiou">Mildiou</option>
              <option value="Oïdium">Oïdium</option>
              <option value="Pourriture Grise">Pourriture Grise</option>
            </Select>
          </FF>
          <FF label="Fréquence (%)">
            <Input type="text" inputMode="decimal" value={form.intensite} onChange={e=>setForm({...form, intensite:e.target.value})} disabled={form.maladie === "Aucune" || isSubmitting} placeholder="Ex: 5" />
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

function Maturation() {
  const T = useTheme();
  const { state } = useStore();
  
  const [modalData, setModalData] = useState(null);
  const [graphData, setGraphData] = useState(null); 
  const [activeYear, setActiveYear] = useState(new Date().getFullYear().toString());
  
  const [exportSelection, setExportSelection] = useState([]);
  const [expDep, setExpDep] = useState("");
  const [expReg, setExpReg] = useState("");
  const [expCom, setExpCom] = useState("");

  const maturations = state.maturations || [];
  
  const currentYear = new Date().getFullYear().toString();
  const availableYears = maturations.map(m => m.date ? m.date.substring(0, 4) : "").filter(Boolean);
  const displayYears = [...new Set([currentYear, activeYear, ...availableYears])].sort((a,b) => b - a);

  const dataForYear = maturations
    .filter(m => m.date && m.date.startsWith(activeYear))
    .sort((a,b) => new Date(a.date) - new Date(b.date));

  const parcelles = {};
  dataForYear.forEach(m => {
    const key = `${m.parcelle} (${m.cepage})`;
    if (!parcelles[key]) parcelles[key] = [];
    parcelles[key].push(m);
  });

  const allParcelleKeys = Object.keys(parcelles);

  const parcelleGeoMap = {};
  (state.parcelles || []).forEach(p => { parcelleGeoMap[p.nom] = p; });

  const filteredParcelleKeys = allParcelleKeys.filter(key => {
    const nomParcelle = parcelles[key][0].parcelle; 
    const geo = parcelleGeoMap[nomParcelle] || {};

    if (expDep && geo.departement !== expDep) return false;
    if (expReg && geo.region !== expReg) return false;
    if (expCom && geo.commune !== expCom) return false;
    return true;
  });

  const depts = Object.keys(CHAMPAGNE_GEODATA || {});
  const regions = expDep ? Object.keys(CHAMPAGNE_GEODATA[expDep]) : [];
  const communes = (expDep && expReg) ? CHAMPAGNE_GEODATA[expDep][expReg] : [];

  const toggleExportSelection = (key) => {
    if (exportSelection.includes(key)) setExportSelection(exportSelection.filter(k => k !== key));
    else setExportSelection([...exportSelection, key]);
  };

  const selectAllFiltered = () => {
    const allFilteredSelected = filteredParcelleKeys.length > 0 && filteredParcelleKeys.every(k => exportSelection.includes(k));
    if (allFilteredSelected) {
      setExportSelection(exportSelection.filter(k => !filteredParcelleKeys.includes(k)));
    } else {
      const newSelection = new Set([...exportSelection, ...filteredParcelleKeys]);
      setExportSelection(Array.from(newSelection));
    }
  };

  const getExportData = () => {
    let dataToExport = [];
    (exportSelection.length > 0 ? exportSelection : filteredParcelleKeys).forEach(key => {
      dataToExport = [...dataToExport, ...parcelles[key]];
    });
    return dataToExport.sort((a,b) => new Date(a.date) - new Date(b.date));
  };

  const exportCSV = () => {
    const data = getExportData();
    if (data.length === 0) return alert("Aucune donnée à exporter.");
    const rows = [["Date", "Parcelle", "Cépage", "Sucre (g/L)", "TAVP (°)", "AT", "pH", "Maladie", "Intensité"].join(";")];
    data.forEach(r => {
      const d = new Date(r.date);
      const shortDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      rows.push([
        shortDate, r.parcelle, r.cepage, r.sucre || "", 
        r.tavp ? r.tavp.toFixed(2) : "", r.at || "", r.ph || "", 
        r.maladie || "", r.intensite || ""
      ].join(";"));
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Maturation_${activeYear}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const exportPDF = () => {
    const data = getExportData();
    if (data.length === 0) return alert("Aucune donnée à exporter.");
    const html = `
      <!DOCTYPE html><html><head><title>Maturation ${activeYear}</title>
      <style>
        body { font-family: sans-serif; padding: 40px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: center; }
        th { background-color: #f5f5f5; }
      </style></head><body>
      <h1>Suivi de Maturation - ${activeYear}</h1>
      <table><tr><th>Date</th><th>Parcelle</th><th>Cépage</th><th>Sucre</th><th>TAVP</th><th>AT</th><th>pH</th><th>État Sanitaire</th></tr>
      ${data.map(r => {
        const d = new Date(r.date);
        const shortDate = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return `<tr>
          <td><strong>${shortDate}</strong></td><td><strong>${r.parcelle}</strong></td><td>${r.cepage}</td>
          <td>${r.sucre || "-"}</td><td>${r.tavp ? r.tavp.toFixed(1) : "-"}</td>
          <td>${r.at || "-"}</td><td>${r.ph || "-"}</td>
          <td>${r.maladie !== "Aucune" ? r.maladie + (r.intensite ? ' '+r.intensite+'%' : '') : "Sain"}</td>
        </tr>`;
      }).join('')}
      </table></body></html>`;
    const win = window.open('', '_blank'); win.document.write(html); win.document.close(); win.print();
  };

  const getSanitaryStyle = (maladie, intensite) => {
    if (!maladie || maladie === "Aucune") return { color: T.green, bg: "transparent", border: "transparent" };
    const num = parseFloat(intensite) || 0;
    if (!intensite) return { color: T.red, bg: T.red + "22", border: T.red };
    if (num >= 10) return { color: T.red, bg: T.red + "22", border: T.red };
    if (num >= 5)  return { color: "#d98b2b", bg: "#d98b2b22", border: "#d98b2b" }; 
    return { color: T.green, bg: T.green + "11", border: T.green + "55" }; 
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Maturation</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Réseau de maturation et contrôles sanitaires.</div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Select value={activeYear} onChange={e => setActiveYear(e.target.value)} style={{ width: 100, fontWeight: "bold", cursor:"pointer" }}>
            {displayYears.map(y => <option key={y} value={y}>{y}</option>)}
          </Select>
          <Btn onClick={() => setModalData("new")}>+ Nouveau Prélèvement</Btn>
        </div>
      </div>

      {allParcelleKeys.length > 0 && (
        <div style={{ background: T.surfaceHigh, padding: "16px 24px", borderRadius: 6, border: `1px solid ${T.border}`, marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 300 }}>
              <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Filtres géographiques & Export</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div style={{ width: "100%" }}>
                  <Select value={expDep} onChange={e => { setExpDep(e.target.value); setExpReg(""); setExpCom(""); setExportSelection([]); }}>
                    <option value="">Tous Départements</option>
                    {depts.map(d => <option key={d}>{d}</option>)}
                  </Select>
                </div>
                <div style={{ width: "100%" }}>
                  <Select value={expReg} onChange={e => { setExpReg(e.target.value); setExpCom(""); setExportSelection([]); }} disabled={!expDep}>
                    <option value="">Toutes Régions</option>
                    {regions.map(r => <option key={r}>{r}</option>)}
                  </Select>
                </div>
                <div style={{ width: "100%" }}>
                  <Select value={expCom} onChange={e => { setExpCom(e.target.value); setExportSelection([]); }} disabled={!expReg}>
                    <option value="">Toutes Communes</option>
                    {communes.map(c => <option key={c}>{c}</option>)}
                  </Select>
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              <Btn variant="secondary" onClick={exportCSV} style={{ fontSize: 12, padding: "8px 12px" }}>📥 CSV</Btn>
              <Btn variant="secondary" onClick={exportPDF} style={{ fontSize: 12, padding: "8px 12px" }}>📄 PDF</Btn>
            </div>
          </div>

          <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Sélection pour l'export ({filteredParcelleKeys.length})</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button 
                onClick={selectAllFiltered} 
                style={{ padding: "4px 8px", fontSize: 11, borderRadius: 4, border: `1px solid ${T.border}`, background: filteredParcelleKeys.length > 0 && filteredParcelleKeys.every(k => exportSelection.includes(k)) ? T.accent : "transparent", color: filteredParcelleKeys.length > 0 && filteredParcelleKeys.every(k => exportSelection.includes(k)) ? "#fff" : T.textDim, cursor: "pointer" }}>
                Tout Cocher
              </button>
              {filteredParcelleKeys.map(k => (
                <button 
                  key={k} 
                  onClick={() => toggleExportSelection(k)} 
                  style={{ padding: "4px 8px", fontSize: 11, borderRadius: 4, border: `1px solid ${exportSelection.includes(k) ? T.accent : T.border}`, background: exportSelection.includes(k) ? T.accent+"20" : "transparent", color: exportSelection.includes(k) ? T.accent : T.textDim, cursor: "pointer" }}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {allParcelleKeys.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>
          Aucun prélèvement enregistré pour cette année.
        </div>
      ) : filteredParcelleKeys.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>
          Aucune parcelle ne correspond à vos filtres géographiques.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {filteredParcelleKeys.map(name => {
            const records = parcelles[name];
            return (
              <div key={name} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ background: T.surfaceHigh, padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 16, color: T.accentLight, fontWeight: "bold", fontFamily: "monospace", display: "flex", alignItems: "center", gap: 12 }}>
                    {name}
                    <button onClick={() => setGraphData({ title: name, records })} style={{ background: T.accent + "20", border: `1px solid ${T.accent}50`, color: T.accent, borderRadius: 4, padding: "4px 8px", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                      📊 Voir la courbe
                    </button>
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{records.length} prélèvement(s)</div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 90px 60px 60px 80px 1fr 40px", padding: "12px 20px", borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.textDim, textTransform: "uppercase", gap: 10 }}>
                  <div>Date</div><div>Sucre</div><div>TAVP</div><div>Dynamique</div><div>AT</div><div>pH</div><div>Indice</div><div>État Sanitaire</div><div></div>
                </div>

                {records.map((r, i) => {
                  let dynStr = "--";
                  let dynColor = T.textDim;
                  
                  if (i > 0) {
                    const prev = records[i - 1];
                    const days = (new Date(r.date) - new Date(prev.date)) / (1000 * 3600 * 24);
                    if (days > 0 && r.tavp && prev.tavp) {
                      const delta = (r.tavp - prev.tavp) / days;
                      dynStr = `${delta > 0 ? '+' : ''}${delta.toFixed(2)} °/j`;
                      dynColor = delta >= 0.15 ? T.green : (delta > 0 ? T.accent : T.red);
                    }
                  }

                  const indiceMat = (r.sucre && r.at) ? (r.sucre / r.at).toFixed(1) : "--";
                  const hasMaladie = r.maladie && r.maladie !== "Aucune";
                  
                  const sStyle = getSanitaryStyle(r.maladie, r.intensite);

                  return (
                    <div key={r.id} style={{ display: "grid", gridTemplateColumns: "100px 70px 70px 90px 60px 60px 80px 1fr 40px", padding: "12px 20px", alignItems: "center", borderBottom: i < records.length - 1 ? `1px solid ${T.border}` : "none", gap: 10 }}>
                      <div style={{ fontSize: 12, color: T.textDim, fontFamily: "monospace" }}>{new Date(r.date).toLocaleDateString('fr-FR')}</div>
                      <div style={{ fontSize: 13, color: T.textStrong, fontWeight: "bold" }}>{r.sucre ? `${r.sucre}` : "--"}</div>
                      <div style={{ fontSize: 13, color: T.accent, fontWeight: "bold" }}>{r.tavp ? r.tavp.toFixed(1) : "--"}</div>
                      <div style={{ fontSize: 12, color: dynColor, fontWeight: "bold" }}>{dynStr}</div>
                      <div style={{ fontSize: 12, color: T.text }}>{r.at || "--"}</div>
                      <div style={{ fontSize: 12, color: T.text }}>{r.ph || "--"}</div>
                      <div style={{ fontSize: 12, color: T.textDim }}>{indiceMat !== "--" ? `${indiceMat}` : "--"}</div>
                      
                      <div>
                        {hasMaladie ? (
                           <div style={{ 
                            display: "inline-block",
                            color: sStyle.color, 
                            background: sStyle.bg,
                            border: `1px solid ${sStyle.border}`,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "10px",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            letterSpacing: "1px"
                          }}>
                            {`${r.maladie} ${r.intensite ? r.intensite+'%' : ''}`}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: T.green, fontWeight: "bold" }}>Sain</span>
                        )}
                      </div>
                      
                      <div style={{ textAlign: "right" }}>
                        <button onClick={() => setModalData(r)} style={{ background:"transparent", border:"none", cursor:"pointer", fontSize: 14, opacity: 0.7 }} title="Compléter les analyses">✏️</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {modalData && <MaturationModal editData={modalData === "new" ? null : modalData} onClose={() => setModalData(null)} />}
      {graphData && <MaturationGraphModal data={graphData.records} title={graphData.title} onClose={() => setGraphData(null)} />}
    </div>
  );
}

function MaturationGraphModal({ data, title, onClose }) {
  const T = useTheme();
  
  const config = {
    sucre: { label: "Sucre (g/L)", color: "#f59e0b" },
    tavp: { label: "TAVP (°)", color: "#3b82f6" },
    dyn: { label: "Dynamique (°/j)", color: "#10b981", isDashed: true },
    at: { label: "AT", color: "#ec4899" },
    ph: { label: "pH", color: "#8b5cf6" },
    indice: { label: "Indice Mat.", color: "#06b6d4" },
    maladie: { label: "État Sanitaire (%)", color: T.red, isDashed: true } 
  };
  
  const [activeMetrics, setActiveMetrics] = useState(['tavp', 'maladie']);

  const toggleMetric = (m) => {
    if (activeMetrics.includes(m)) setActiveMetrics(activeMetrics.filter(x => x !== m));
    else setActiveMetrics([...activeMetrics, m]);
  };

  const chartData = data.map((r, i) => {
    let dyn = null;
    if (i > 0 && r.tavp && data[i-1].tavp) {
      const prev = data[i - 1];
      const days = (new Date(r.date) - new Date(prev.date)) / (1000 * 3600 * 24);
      if (days > 0) dyn = (parseFloat(r.tavp) - parseFloat(prev.tavp)) / days;
    }

    const isSain = !r.maladie || r.maladie === "Aucune";

    return {
      date: new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      sucre: r.sucre ? parseFloat(r.sucre).toFixed(1) : null,
      tavp: r.tavp ? parseFloat(r.tavp).toFixed(1) : null,
      dyn: dyn ? dyn.toFixed(2) : null,
      at: r.at ? parseFloat(r.at).toFixed(1) : null,
      ph: r.ph ? parseFloat(r.ph).toFixed(2) : null,
      indice: (r.sucre && r.at) ? (parseFloat(r.sucre) / parseFloat(r.at)).toFixed(1) : null,
      maladie: isSain ? 0 : (parseFloat(r.intensite) || 0),
      maladieName: isSain ? "Sain" : r.maladie
    };
  });

  const W = 900; 
  const H = 400;
  const padLeft = 60; 
  const padRight = 60; 
  const padTop = 40; 
  const padBottom = 50; 

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.75)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
      <div style={{ background: T.surface, width: "100%", maxWidth: 900, borderRadius: 8, boxShadow: "0 10px 40px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", border: `1px solid ${T.border}` }}>
        
        <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.surfaceHigh, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: T.textStrong, fontFamily: "'Playfair Display', serif" }}>Graphique : {title}</h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.textDim, fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap", justifyContent: "center" }}>
            {Object.entries(config).map(([key, val]) => {
              const isActive = activeMetrics.includes(key);
              return (
                <button key={key} onClick={() => toggleMetric(key)}
                  style={{ padding: "6px 16px", borderRadius: 20, fontSize: 12, fontWeight: "bold", border: `1px solid ${isActive ? val.color : T.border}`, background: isActive ? val.color + "20" : "transparent", color: isActive ? val.color : T.textDim, cursor: "pointer", transition: "all 0.2s" }}>
                  {isActive ? "✓ " : ""}{val.label}
                </button>
              );
            })}
          </div>

          <div style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 8, padding: "20px 0" }}>
            {chartData.length < 2 ? (
              <div style={{ height: H, display: "flex", alignItems: "center", justifyContent: "center", color: T.textDim }}>Pas assez de prélèvements pour tracer une courbe.</div>
            ) : (
              <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
                
                {[0, 1, 2, 3, 4].map(i => {
                  const y = padTop + (i * (H - padTop - padBottom) / 4);
                  return <line key={`grid-${i}`} x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke={T.border} strokeDasharray="4 4" opacity={0.5} />;
                })}
                
                <line x1={padLeft} y1={padTop - 10} x2={padLeft} y2={H - padBottom} stroke={T.textDim} strokeWidth={1.5} />
                <line x1={padLeft} y1={H - padBottom} x2={W - padRight + 10} y2={H - padBottom} stroke={T.textDim} strokeWidth={1.5} />

                {chartData.map((d, i) => {
                  const x = padLeft + (i * (W - padLeft - padRight) / (chartData.length - 1));
                  return (
                    <g key={`x-${i}`}>
                      <line x1={x} y1={H - padBottom} x2={x} y2={H - padBottom + 6} stroke={T.textDim} strokeWidth={1.5} />
                      <line x1={x} y1={padTop} x2={x} y2={H - padBottom} stroke={T.border} strokeDasharray="2 2" opacity={0.3} />
                      <text x={x} y={H - padBottom + 24} fontSize={12} fill={T.textDim} textAnchor="middle" fontWeight="bold">{d.date}</text>
                    </g>
                  );
                })}

                {/* Tracé de toutes les courbes actives */}
                {activeMetrics.map((metric, mIdx) => {
                  const conf = config[metric];
                  const values = chartData.map(d => parseFloat(d[metric])).filter(v => !isNaN(v));
                  if (values.length < 2) return null;
                  
                  // L'échelle de la maladie part toujours de 0 et monte à au moins 10%
                  const minV = metric === 'maladie' ? 0 : Math.min(...values) * 0.90; 
                  const maxV = metric === 'maladie' ? Math.max(10, ...values) * 1.10 : Math.max(...values) * 1.10;

                  const getPoint = (val, index) => {
                    const x = padLeft + (index * (W - padLeft - padRight) / (chartData.length - 1));
                    const y = (H - padBottom) - ((val - minV) / (maxV - minV)) * (H - padTop - padBottom);
                    return { x, y };
                  };

                  let pathD = "";
                  const points = [];
                  chartData.forEach((d, i) => {
                    if (d[metric] !== null && d[metric] !== undefined) {
                      const pt = getPoint(parseFloat(d[metric]), i);
                      let yOffset = mIdx % 2 === 0 ? -16 : 24; 
                      if (metric === 'maladie' && parseFloat(d[metric]) === 0) yOffset = -12; // Sain s'affiche au-dessus de la ligne 0
                      
                      points.push({ ...pt, val: d[metric], yOffset, maladieName: d.maladieName });
                      pathD += pathD === "" ? `M ${pt.x} ${pt.y} ` : `L ${pt.x} ${pt.y} `;
                    }
                  });

                  return (
                    <g key={`curve-${metric}`}>
                      {/* La ligne directrice */}
                      <path d={pathD} fill="none" stroke={conf.color} strokeWidth={3} strokeLinejoin="round" strokeDasharray={conf.isDashed ? "8 6" : "none"} opacity={metric === 'maladie' ? 0.6 : 1} />
                      
                      {/* Les points et étiquettes */}
                      {points.map((pt, i) => {
                        let ptColor = conf.color;
                        let displayVal = pt.val;

                        // Intelligence spécifique pour la courbe de maladie
                        if (metric === 'maladie') {
                          if (pt.val === 0) {
                            ptColor = T.green;
                            displayVal = "Sain";
                          } else {
                            if (pt.maladieName === "Mildiou") ptColor = "#8c3b3b";
                            else if (pt.maladieName === "Oïdium") ptColor = "#a8a8a8";
                            else ptColor = T.red;
                            
                            let abbr = "";
                            if (pt.maladieName === "Pourriture Grise") abbr = "PG";
                            else if (pt.maladieName === "Mildiou") abbr = "MIL";
                            else if (pt.maladieName === "Oïdium") abbr = "OID";
                            
                            displayVal = `${pt.val}% ${abbr}`;
                          }
                        }

                        return (
                          <g key={`pt-${i}`}>
                            <circle cx={pt.x} cy={pt.y} r={metric === 'maladie' && pt.val === 0 ? 3 : 5} fill={T.surface} stroke={ptColor} strokeWidth={2.5} />
                            <text x={pt.x} y={pt.y + pt.yOffset} fontSize={11} fill={ptColor} fontWeight="bold" textAnchor="middle">
                              {displayVal}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
          
          {/* Légende des maladies */}
          {activeMetrics.includes('maladie') && (
            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: T.red, borderRadius: 2 }} /> Pourriture Grise</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: "#8c3b3b", borderRadius: 2 }} /> Mildiou</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: "#a8a8a8", borderRadius: 2 }} /> Oïdium</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.textDim }}><div style={{ width: 12, height: 12, background: T.green, borderRadius: 2 }} /> Sain</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MODULE DÉGUSTATION (AVEC ARBORESCENCE AROMATIQUE - NIVEAU PRODUCTION)
// =============================================================================

const PHASES_DEGUSTATION = [
  { id: "BAIES", label: "🍇 Baies", desc: "Maturité phénolique sur parcelle" },
  { id: "FERMENTATION", label: "🧪 Fermentation", desc: "Moûts et FA/FML en cours" },
  { id: "VINS_CLAIRS", label: "🍷 Vins Clairs", desc: "Vins de base & Réserve" },
  { id: "DOSAGE", label: "🍾 Essais Dosage", desc: "Tests de liqueur pré-dégorgement" },
  { id: "CHAMPAGNE", label: "🥂 Produit Fini", desc: "Contrôle après vieillissement" } // 👈 Remplacé FINI par CHAMPAGNE
];

// La taxonomie tirée de votre document Word (Arborescence V5 Fizz)
const AROMES_TAXONOMY = {
  "Fruités & Floraux": [
    "Agrume", "Fruit blanc/jaune", "Fruit Exotique", "Fruit rouge/noir", "Floral"
  ],
  "Végétaux & Épicés": [
    "Pl. arom. / Résineux", "Végétal sec", "Végétal frais", "Epice"
  ],
  "Évolués & Pâtissiers": [
    "Lactique", "Boulangerie", "Empyreumatique", "Fruit mûr/cuit confit", "Fruit sec/à coque", "Miellé", "Boisé"
  ],
  "Défauts & Atypiques": [
    "Animal", "Composé Minéral", "Acescence / Solvant", "Acétique", "Carton", "Sous-bois / Champignon", "Moisi", "Terreux", "SO2"
  ]
};

// Descripteurs de Bouche / Saveurs (Inspiré de votre document)
const SAVEURS_TAXONOMY = ["Acide", "Amer", "Sucré", "Salé", "Umami", "Rond", "Astringent", "Huileux"];

function DegustationModal({ onClose, defaultPhase = "BAIES" }) {
  const T = useTheme();
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

  // Gestion des tags cliquables
  const [selectedNez, setSelectedNez] = useState([]);
  const [selectedBouche, setSelectedBouche] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  const toggleTag = (list, setList, tag) => {
    if (list.includes(tag)) setList(list.filter(t => t !== tag));
    else setList([...list, tag]);
  };

  const getTargetOptions = () => {
    if (form.phase === "BAIES") {
      return (state.parcelles || []).map(p => <option key={p.id} value={p.nom}>{p.nom}</option>);
    }
    if (["FERMENTATION", "VINS_CLAIRS"].includes(form.phase)) {
      return (state.lots || []).filter(l => l.volume > 0).map(l => <option key={l.id} value={l.id}>{l.code} ({l.volume} hL)</option>);
    }
    if (["DOSAGE", "CHAMPAGNE"].includes(form.phase)) {
      return (state.bottleLots || []).map(b => <option key={b.id} value={b.id}>{b.code} ({b.currentCount} btl)</option>);
    }
    return null;
  };

  const submit = async () => {
    // Validation frontend basique avant d'envoyer au backend
    if (form.phase === "BAIES" && !form.parcelle) return alert("Veuillez sélectionner une parcelle.");
    if (["FERMENTATION", "VINS_CLAIRS"].includes(form.phase) && !form.lotId) return alert("Veuillez sélectionner un lot de vin.");
    if (["DOSAGE", "CHAMPAGNE"].includes(form.phase) && !form.bottleLotId) return alert("Veuillez sélectionner un lot de bouteilles.");

    setIsSubmitting(true);
    
    try {
      const payload = {
        ...form,
        nez: selectedNez.length > 0 ? selectedNez.join(', ') : undefined,     // On envoie une string propre au backend
        bouche: selectedBouche.length > 0 ? selectedBouche.join(', ') : undefined,
        noteGlobale: form.noteGlobale ? parseFloat(form.noteGlobale) : undefined,
        sucreTest: form.sucreTest ? parseFloat(form.sucreTest) : undefined,
        idempotencyKey
      };

      const res = await fetch('/api/degustations', {
        method: 'POST',
        headers: buildApiHeaders(user),
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la sauvegarde.");
      }

      dispatch({ type: "TOAST_ADD", payload: { msg: "Dégustation enregistrée avec succès !", color: T.green } });
      
      if (refreshData) await refreshData();
      onClose();

    } catch (e) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e.message, color: T.red } });
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title="Nouvelle Dégustation" onClose={onClose}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <FF label="Date">
          <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} disabled={isSubmitting} />
        </FF>
        <FF label="Phase d'élaboration">
          <Select value={form.phase} onChange={e => setForm({...form, phase: e.target.value, parcelle: "", lotId: "", bottleLotId: ""})} disabled={isSubmitting}>
            {PHASES_DEGUSTATION.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </Select>
        </FF>
      </div>

      <div style={{ background: T.surfaceHigh, padding: 16, borderRadius: 6, border: `1px solid ${T.border}`, marginBottom: 20 }}>
        <FF label="Élément dégusté (Cible obligatoire)">
          <Select value={form.phase === "BAIES" ? form.parcelle : (form.phase === "DOSAGE" || form.phase === "CHAMPAGNE" ? form.bottleLotId : form.lotId)} 
                  onChange={e => {
                    const val = e.target.value;
                    if (form.phase === "BAIES") setForm({...form, parcelle: val});
                    else if (["DOSAGE", "CHAMPAGNE"].includes(form.phase)) setForm({...form, bottleLotId: val});
                    else setForm({...form, lotId: val});
                  }} disabled={isSubmitting}>
            <option value="">-- Sélectionner l'élément --</option>
            {getTargetOptions()}
          </Select>
        </FF>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <FF label="👁️ Robe / Visuel (Optionnel)">
          <Input value={form.robe} onChange={e => setForm({...form, robe: e.target.value})} disabled={isSubmitting} placeholder="Ex: Or pâle, reflets verts..." />
        </FF>
        {form.phase === "DOSAGE" && (
          <FF label="Dosage testé (g/L)">
            <Input type="number" step="0.5" value={form.sucreTest} onChange={e => setForm({...form, sucreTest: e.target.value})} disabled={isSubmitting} placeholder="Ex: 5.5" />
          </FF>
        )}
      </div>

      <div style={{ borderTop: `1px dashed ${T.border}`, margin: "20px 0" }} />

      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentLight, marginBottom: 12, textTransform: "uppercase" }}>👃 Analyse Olfactive (Nez)</div>
      {Object.entries(AROMES_TAXONOMY).map(([category, tags]) => (
        <div key={category} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: T.textDim, marginBottom: 6 }}>{category}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {tags.map(tag => {
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
        </div>
      ))}

      <div style={{ borderTop: `1px dashed ${T.border}`, margin: "20px 0" }} />

      <div style={{ fontSize: 13, fontWeight: "bold", color: T.accentLight, marginBottom: 12, textTransform: "uppercase" }}>👄 Analyse Gustative (Bouche)</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {SAVEURS_TAXONOMY.map(tag => {
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

      <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:16, alignItems:"start" }}>
        <FF label="Note Globale (/20)">
          <Input type="number" step="0.5" max="20" min="0" value={form.noteGlobale} onChange={e => setForm({...form, noteGlobale: e.target.value})} disabled={isSubmitting} style={{ fontSize: 18, fontWeight: "bold", textAlign: "center", color: T.accentLight }} />
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

function Degustation() {
  const T = useTheme();
  const { state } = useStore();
  const [modal, setModal] = useState(false);
  const [activePhase, setActivePhase] = useState("BAIES");

  const degustations = state.degustations || [];
  
  // On filtre selon l'onglet actif et on trie de la plus récente à la plus ancienne
  const filteredData = degustations
    .filter(d => d.phase === activePhase)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const getTargetName = (d) => {
    if (d.parcelle) return d.parcelle;
    if (d.lotId) {
      const l = state.lots?.find(x => String(x.id) === String(d.lotId));
      return l ? l.code : `Lot #${d.lotId}`;
    }
    if (d.bottleLotId) {
      const b = state.bottleLots?.find(x => String(x.id) === String(d.bottleLotId));
      return b ? b.code : `Bouteilles #${d.bottleLotId}`;
    }
    return "Cible inconnue";
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Dégustation</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>Carnet de suivi sensoriel standardisé (Arborescence V5 Fizz).</div>
        </div>
        <Btn onClick={() => setModal(true)}>+ Nouvelle Note</Btn>
      </div>

      {/* ONGLETS DES PHASES */}
      <div style={{ display:"flex", gap:10, borderBottom:`1px solid ${T.border}`, paddingBottom:16, marginBottom:24, overflowX:"auto" }}>
        {PHASES_DEGUSTATION.map(p => (
          <button 
            key={p.id} 
            onClick={() => setActivePhase(p.id)}
            style={{ 
              padding:"8px 16px", borderRadius:20, fontSize:13, fontWeight:"bold", cursor:"pointer", transition:"all 0.2s", whiteSpace:"nowrap",
              background: activePhase === p.id ? T.accent+"20" : "transparent",
              color: activePhase === p.id ? T.accent : T.textDim,
              border: `1px solid ${activePhase === p.id ? T.accent : T.border}`
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {filteredData.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center", border:`1px dashed ${T.border}`, borderRadius:4, color:T.textDim }}>
          Aucune dégustation enregistrée pour cette phase.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: 16 }}>
          {filteredData.map(d => {
            const targetName = getTargetName(d);
            return (
              <div key={d.id} style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
                
                {/* En-tête Carte */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `1px dashed ${T.border}`, paddingBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: T.accentLight, fontFamily: "monospace" }}>{targetName}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>Le {new Date(d.date).toLocaleDateString('fr-FR')}</div>
                    {d.sucreTest && <Badge label={`Dosage : ${d.sucreTest} g/L`} color="#d98b2b" style={{ marginTop: 8 }} />}
                  </div>
                  {d.noteGlobale && (
                    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "50%", width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: parseFloat(d.noteGlobale) >= 14 ? T.green : T.accentLight, fontSize: 16, fontFamily: "monospace" }}>
                      {d.noteGlobale}
                    </div>
                  )}
                </div>

                {/* Critères Visuels */}
                {d.robe && (
                  <div style={{ fontSize: 12 }}>
                    <span style={{ color: T.textDim, textTransform: "uppercase", letterSpacing: 1, fontSize: 10 }}>👁️ Robe : </span>
                    <span style={{ color: T.textStrong }}>{d.robe}</span>
                  </div>
                )}

                {/* Critères Aromatiques (Les Tags) */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>👃 Nez</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {d.nez ? d.nez.split(',').map((tag, i) => (
                        <span key={i} style={{ background: T.accent+"15", color: T.accent, border: `1px solid ${T.accent}33`, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: "bold" }}>{tag.trim()}</span>
                      )) : <span style={{ color: T.textDim, fontStyle: "italic", fontSize: 11 }}>Non renseigné</span>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>👄 Bouche</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {d.bouche ? d.bouche.split(',').map((tag, i) => (
                        <span key={i} style={{ background: "#d98b2b15", color: "#d98b2b", border: "1px solid #d98b2b33", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: "bold" }}>{tag.trim()}</span>
                      )) : <span style={{ color: T.textDim, fontStyle: "italic", fontSize: 11 }}>Non renseigné</span>}
                    </div>
                  </div>
                </div>

                {/* Conclusion */}
                {d.notes && (
                  <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${T.border}`, fontSize: 12, color: T.text, fontStyle: "italic", lineHeight: 1.5 }}>
                    « {d.notes} »
                  </div>
                )}
                
                {/* Opérateur */}
                <div style={{ fontSize: 10, color: T.textDim, textAlign: "right", marginTop: d.notes ? 0 : "auto" }}>
                  Saisi par {d.operator}
                </div>
                
              </div>
            );
          })}
        </div>
      )}

      {modal && <DegustationModal onClose={() => setModal(false)} defaultPhase={activePhase} />}
    </div>
  );
}

// =============================================================================
// MAIN APP - NAVIGATION REGROUPÉE
// =============================================================================
const NAV_CATEGORIES = [
  {
    title: "Tableau de bord", 
    id: "dashboard", 
    items: [] 
  },
  {
    title: "Œnologie",
    items: [
      { id:"maturation",  label:"Maturation",      icon:"🍇" },
      { id:"planificateur", label:"Planif. Vendanges", icon:"📅" },
      { id:"tour_fa",     label:"Tour de FA",      icon:"🌡️" },
      { id:"assemblages", label:"Assemblages",     icon:"🧪" },
      { id:"tirage",      label:"Planif. Tirage",  icon:"🍾" },
      { id:"degustation", label:"Dégustation",     icon:"🥂" },
      { id:"analyses",    label:"Analyses",        icon:"🔬" },
    ]
  },
  {
    title: "Chai",
    items: [
      { id:"vendanges",   label:"Pressoirs",       icon:"⚙️" },
      { id:"cuverie",     label:"Cuverie",         icon:"🛢️" },
      { id:"lots",        label:"Lots (Vrac)",     icon:"🍷" },
      { id:"stock",       label:"Cave",            icon:"🍾" },
      { id:"inventaire",  label:"Matières Sèches", icon:"📦" },
    ]
  },
  {
    title: "Gestion",
    items: [
      { id:"admin_wo",    label:"Ordres de Travail", icon:"📋" },
      { id:"tracabilite", label:"Traçabilité",     icon:"🔗" },
      { id:"expeditions", label:"Expéditions",     icon:"🚛" },
      { id:"administratif", label:"Administratif", icon:"📜" },
    ]
  }
];

const ADMIN_NAV = [
  { id:"admin_users", label:"Utilisateurs",    icon:"👥" },
  { id:"admin_logs",  label:"Journal d'audit", icon:"📑" },
];

export default function App() {
  const [themeKey, setThemeKey]     = useState("terroir");
  const [user, setUser]             = useState(null);
  const [nav, setNav]               = useState("dashboard");
  const [selContainer, setSelCont]  = useState(null);
  const [selLot, setSelLot]         = useState(null);
  const [state, dispatch]           = useReducer(storeReducer, initialState);
  
  const [workOrders, setWorkOrders] = useState([]);

  const [showResetModal, setShowResetModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const [openMenus, setOpenMenus] = useState([1, 2, 3]); 
  const [adminOpen, setAdminOpen] = useState(false);     

  const T = THEMES[themeKey];

  const fetchAll = async () => {
    const t = Date.now();
    const opts = { cache: 'no-store' }; 

    try {
      const safeMap = (data, mapFn) => Array.isArray(data) ? data.map(mapFn) : [];

      const fetchSafe = async (url) => {
        try {
          const res = await fetch(url, opts);
          if (!res.ok) return []; 
          const text = await res.text();
          return text ? JSON.parse(text) : []; 
        } catch (e) {
          console.error(`Erreur réseau sur ${url}`);
          return [];
        }
      };

      fetchSafe(`/api/containers?t=${t}`).then(d => {
        dispatch({type:"SET_CONTAINERS", payload: safeMap(d, c=>{const l=c.currentLots?.[0]; return{id:c.id.toString(),name:c.displayName,type:c.type,capacity:c.capacityValue,currentVolume:l?l.currentVolume:0,lotId:l?l.id.toString():null,zone:c.zone||"Cave",status:c.status,notes:c.notes||""};})});
      });
      fetchSafe(`/api/lots?t=${t}`).then(d => {
        dispatch({type:"SET_LOTS", payload: safeMap(d, l=>({id:l.id.toString(),code:l.businessCode,millesime:l.year,cepage:l.mainGrapeCode,lieu:l.placeCode||"",volume:l.currentVolume,containerId:l.currentContainerId?.toString(),status:l.status==="ACTIF"?"FERMENTATION_ALCOOLIQUE":l.status,composition:[{cepage:l.mainGrapeCode,pct:100}],parentIds:[],childIds:[],notes:l.notes||""}))});
      });
      fetchSafe(`/api/bottles?t=${t}`).then(d => {
        dispatch({type:"SET_BOTTLE_LOTS", payload: safeMap(d, b=>({id:b.id.toString(),code:b.businessCode,type:b.type,sourceLotId:b.sourceLotId?.toString(),format:b.formatCode,initialCount:b.initialBottleCount,currentCount:b.currentBottleCount,degorgeCount:0,zone:b.locationZone||"",palette:b.locationPalette||"",tirageDate:b.tirageDate?new Date(b.tirageDate).toISOString().split('T')[0]:"",status:b.status,dosage:b.dosageValue?`${b.dosageValue} ${b.dosageUnit}`:"",notes:""}))});
      });
      fetchSafe(`/api/events?t=${t}`).then(d => {
        dispatch({type:"SET_EVENTS", payload: safeMap(d, e=>{const dD=new Date(e.eventDatetime); return{id:e.id.toString(),type:e.eventType,date:`${dD.toLocaleDateString('fr-FR')} à ${dD.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}`,lotId:e.lots?.[0]?.lotId?.toString(),containerId:e.containers?.[0]?.containerId?.toString(),volumeIn:e.eventType==='CREATION'?e.lots?.[0]?.volumeChange||0:0,volumeOut:e.eventType==='TRANSFERT'?e.lots?.[0]?.volumeChange||0:0,operator: e.operator || "Inconnu",note:e.comment||""};})});
      });
      fetchSafe(`/api/fa?t=${t}`).then(d => dispatch({type:"SET_FA_READINGS", payload: Array.isArray(d) ? d : []}));
      fetchSafe(`/api/pressings?t=${t}`).then(d => dispatch({type:"SET_PRESSINGS", payload: Array.isArray(d) ? d.map(p => ({...p, id: p.id.toString()})) : []}));
      fetchSafe(`/api/users?t=${t}`).then(d => dispatch({type: "SET_USERS", payload: Array.isArray(d) ? d.map(u => ({...u, id: u.id.toString(), initials: u.name ? u.name.substring(0, 2).toUpperCase() : "??"})) : [] }));
      fetchSafe(`/api/maturation?t=${t}`).then(d => dispatch({type:"SET_MATURATIONS", payload: Array.isArray(d) ? d : []}));
      fetchSafe(`/api/parcelles?t=${t}`).then(d => dispatch({type:"SET_PARCELLES", payload: Array.isArray(d)?d:[]}));
      fetchSafe(`/api/degustations?t=${t}`).then(d => dispatch({type:"SET_DEGUSTATIONS", payload: Array.isArray(d)?d:[]}));
      fetchSafe(`/api/pressoirs?t=${t}`).then(d => dispatch({type:"SET_PRESSOIRS", payload: Array.isArray(d)?d:[]}));
      
      // 👇 LES NOUVEAUX FETCHS POUR L'INVENTAIRE SONT LÀ 👇
      fetchSafe(`/api/inventory/products?t=${t}`).then(d => {
        dispatch({type:"SET_PRODUCTS", payload: Array.isArray(d) ? d : []});
      });
      fetchSafe(`/api/inventory/movements?t=${t}`).then(d => {
        dispatch({type:"SET_MOVEMENTS", payload: Array.isArray(d) ? d : []});
      });

    } catch(e) { console.error("Erreur globale de chargement", e); }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const email = session.user.email;
        const name = email.split('@')[0].toUpperCase();
        
        setUser({ 
          id: session.user.id, 
          email: email, 
          name: name, 
          role: "Utilisateur", 
          initials: name.substring(0, 2),
          accessToken: session.access_token,
        });
      }
    };

    const bootstrap = async () => {
      await checkSession();
      await fetchAll();
    };

    bootstrap();
  }, []); 

  const goNav = id => { setNav(id); setSelCont(null); setSelLot(null); };
  const logout = () => { supabase.auth.signOut(); setUser(null); setNav("dashboard"); setSelCont(null); setSelLot(null); };
  
  const isAdmin = user?.role === "Admin" || user?.role === "Chef de cave"; 
  const alertCount = state.containers.filter(c => c.status === "VIDE" && c.notes).length + state.lots.filter(l => l.notes && l.notes.includes("sans suivi")).length + state.bottleLots.filter(b => b.status === "A_DEGORGER").length;

  const handleSelectLot = (lotObj) => {
    setSelCont(null);  
    setNav("lots");    
    setSelLot(lotObj); 
  };

  const handleSelectContainer = (containerObj) => {
    setSelLot(null);           
    setNav("cuverie");         
    setSelCont(containerObj);  
  };

  const renderContent = () => {
    if (nav === "cuverie" && selContainer) return <ContainerDetail container={selContainer} onBack={() => setSelCont(null)} onSelectLot={handleSelectLot} onSelectContainer={setSelCont} />;
    if (nav === "lots"    && selLot)       return <LotDetail       lot={selLot}             onBack={() => setSelLot(null)} onSelectLot={handleSelectLot} />;
    
    switch(nav) {
      case "dashboard":   return <Dashboard setNav={goNav} workOrders={workOrders} setWorkOrders={setWorkOrders} onRefresh={fetchAll} />;
      case "maturation":  return <Maturation />;
      case "planificateur": return <PlanificateurVendanges />;
      case "degustation": return <Degustation />;
      case "tirage":      return <PlanificateurTirage />;
      case "vendanges":   return <Vendanges onSelectContainer={handleSelectContainer} />;
      case "cuverie":     return <Cuverie   onSelectContainer={handleSelectContainer} />;
      case "lots":        return <Lots      onSelectLot={handleSelectLot} />;
      case "tour_fa":     return <TourFA    onSelectLot={handleSelectLot} />;
      case "assemblages": return <Assemblages />;
      case "inventaire":  return <Stocks />;
      case "stock":       return <StockBouteilles onSelectLot={handleSelectLot} />;
      case "expeditions": return <Expeditions onSelectLot={handleSelectLot} />; 
      case "tracabilite": return <Tracabilite onSelectLot={handleSelectLot} />;
      case "analyses":    return <Analyses />;
      case "administratif": return <Administratif />;
      case "admin_wo":    return <WorkOrdersAdmin workOrders={workOrders} setWorkOrders={setWorkOrders} />;
      case "admin_users": return <AdminUsers />;
      case "admin_logs":  return <AdminLogs />;
      case "parametres":  return <Parametres theme={themeKey} setTheme={setThemeKey} />;
      default:            return <Dashboard setNav={goNav} workOrders={workOrders} setWorkOrders={setWorkOrders} onRefresh={fetchAll} />;
    }
  };

  const executeHardReset = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/reset', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur serveur lors du reset");

      dispatch({ type: "TOAST_ADD", payload: { msg: "Base de données remise à zéro. Rechargement...", color: T.green } });
      
      await fetchAll();
      setShowResetModal(false);

    } catch (e) {
      dispatch({ type: "TOAST_ADD", payload: { msg: e.message, color: T.red } });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <ThemeCtx.Provider value={T}>
      <AuthCtx.Provider value={{ user, setUser }}>
        <StoreCtx.Provider value={{ state, dispatch, refreshData: fetchAll }}>
          <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet" />
          <style>{`
            * { box-sizing: border-box; } 
            select option { background: #1a1713; } 
            input:focus, select:focus { border-color: ${T.accent} !important; }
            ::-webkit-calendar-picker-indicator {
              background-image: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📅</text></svg>");
              cursor: pointer; opacity: 1;
            }
          `}</style>
          {!user ? <LoginScreen onLogin={setUser} /> : (
            <div style={{ display:"flex", height:"100vh", background:T.bg, color:T.text, fontFamily:"system-ui,sans-serif" }}>
              
              {/* --- SIDEBAR --- */}
              <div style={{ width:240, background:T.surface, borderRight:`1px solid ${T.border}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
                <div style={{ padding:"24px 20px 20px", borderBottom:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:22, fontFamily:"'Playfair Display', Georgia, serif", color:T.accentLight, letterSpacing:3 }}>CAVE</div>
                  <div style={{ fontSize:9, color:T.textDim, textTransform:"uppercase", letterSpacing:3, marginTop:4 }}>Gestion viticole</div>
                </div>
                <nav style={{ padding:"16px 0", flex:1, overflowY:"auto" }}>
                  {NAV_CATEGORIES.map((cat, catIdx) => {
                    const isOpen = openMenus.includes(catIdx);
                    
                    const handleClick = () => {
                      if (cat.id) goNav(cat.id);
                      else {
                        if (isOpen) setOpenMenus(openMenus.filter(i => i !== catIdx));
                        else setOpenMenus([...openMenus, catIdx]);
                      }
                    };

                    return (
                      <div key={catIdx} style={{ marginBottom: cat.title ? 12 : 0 }}>
                        {cat.title && (
                          <div onClick={handleClick} style={{ margin:"12px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", padding: "4px 0" }}>
                            <span style={{ display:"flex", alignItems:"center", gap:8, fontSize:10, color: nav === cat.id ? T.accentLight : T.textDim, textTransform:"uppercase", letterSpacing:1.5, fontWeight:"bold", transition:"color 0.2s" }}>
                              {cat.title}
                              {cat.id === "dashboard" && alertCount > 0 && (
                                <span style={{ background:T.red, color:"#fff", fontSize:9, padding:"2px 6px", borderRadius:10, letterSpacing:0 }}>{alertCount}</span>
                              )}
                            </span>
                            {!cat.id && (
                              <span style={{ fontSize: 9, color: T.textDim, transition: "transform 0.2s", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
                            )}
                          </div>
                        )}
                        {(!cat.id && isOpen) && cat.items.map(item => (
                          <button key={item.id} onClick={() => goNav(item.id)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"10px 20px", background: nav === item.id ? T.accent+"15" : "none", border:"none", borderLeft:`3px solid ${nav === item.id ? T.accent : "transparent"}`, color: nav === item.id ? T.accentLight : T.textDim, cursor:"pointer", fontSize:13, textAlign:"left", transition:"all .15s", fontFamily:"sans-serif" }}>
                            <span style={{ display:"flex", gap:12, alignItems:"center" }}><span style={{ fontSize:16 }}>{item.icon}</span>{item.label}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })}
                  
                  {isAdmin && (
                    <div style={{ marginBottom: 12 }}>
                      <div onClick={() => setAdminOpen(!adminOpen)} style={{ margin:"20px 20px 6px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", borderTop:`1px solid ${T.border}`, paddingTop:20 }}>
                        <span style={{ fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1.5, fontWeight:"bold" }}>Système</span>
                        <span style={{ fontSize: 9, color: T.textDim, transition: "transform 0.2s", transform: adminOpen ? "rotate(0deg)" : "rotate(-90deg)" }}>▼</span>
                      </div>
                      {adminOpen && ADMIN_NAV.map(item => (
                        <button key={item.id} onClick={() => goNav(item.id)} style={{ display:"flex", alignItems:"center", width:"100%", padding:"10px 20px", background: nav === item.id ? T.accent+"15" : "none", border:"none", borderLeft:`3px solid ${nav === item.id ? T.accent : "transparent"}`, color: nav === item.id ? T.accentLight : T.textDim, cursor:"pointer", fontSize:13, textAlign:"left", transition:"all .15s", fontFamily:"sans-serif" }}>
                          <span style={{ display:"flex", gap:12, alignItems:"center" }}><span style={{ fontSize:16 }}>{item.icon}</span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </nav>
                <div style={{ borderTop:`1px solid ${T.border}` }}>
                  <button onClick={() => goNav("parametres")} style={{ display:"flex", alignItems:"center", width:"100%", padding:"14px 20px", background: nav === "parametres" ? T.accent+"15" : "none", border:"none", borderLeft:`2px solid ${nav === "parametres" ? T.accent : "transparent"}`, color: nav === "parametres" ? T.accentLight : T.textDim, cursor:"pointer", fontSize:13, textAlign:"left", fontFamily:"sans-serif" }}>
                    <span style={{ display:"flex", gap:12, alignItems:"center" }}><span style={{ fontSize:15 }}>⚙️</span>Paramètres</span>
                  </button>
                </div>
                <div style={{ padding:"16px 20px", borderTop:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:36, height:36, borderRadius:"50%", background:T.accent+"33", border:`1px solid ${T.accent}55`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, color:T.accent, fontFamily:"monospace", flexShrink:0 }}>{user.initials}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, color:T.textStrong, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:"bold" }}>{user.name}</div>
                    <div style={{ fontSize:11, color:T.accent, marginTop:2 }}>{user.role}</div>
                  </div>
                  <button onClick={logout} style={{ background:"none", border:`1px solid ${T.border}`, color:T.textDim, cursor:"pointer", fontSize:12, padding:"6px 10px", borderRadius:4, fontFamily:"monospace" }}>Q</button>
                </div>
              </div>
              
              {/* --- MAIN CONTENT AREA --- */}
              <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>
                <div style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"12px 32px", display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
                  <GlobalSearch onNavigate={goNav} onSelectContainer={c => { setSelCont(c); goNav("cuverie"); }} onSelectLot={l => { setSelLot(l); goNav("lots"); }} />
                </div>
                
                <div style={{ flex:1, overflowY:"auto", padding:"40px 48px" }}>

                  {/* BOUTON D'URGENCE (VISIBLE UNIQUEMENT PAR LES ADMINS) */}
                  {isAdmin && (
                    <button 
                      onClick={() => setShowResetModal(true)} 
                      style={{ 
                        width: "100%", background: "#8b1c31", color: "white", padding: "12px", 
                        marginBottom: "24px", borderRadius: "6px", fontWeight: "bold", 
                        cursor: "pointer", border: "1px solid #ff4444", fontFamily: "monospace", letterSpacing: "1px"
                      }}
                    >
                      🚨 BOUTON D'URGENCE : RÉINITIALISER LA BASE DE DONNÉES (LOTS & CUVES) 🚨
                    </button>
                  )}

                  {showResetModal && (
                    <Modal title="⚠️ Réinitialisation de Saison" onClose={() => setShowResetModal(false)}>
                      {/* ... Le contenu de ta modale ... */}
                      <div style={{ padding:"20px 0", color:T.text, lineHeight:1.5 }}>
                        Vous allez préparer l'application pour une nouvelle campagne. <br/><br/>
                        <strong>Ce qui sera conservé :</strong>
                        <ul style={{ marginTop: 8, fontSize: 13, color: T.green }}>
                          <li>🗺️ Vos parcelles (Terroirs)</li>
                          <li>📦 Votre catalogue de produits (Matières sèches)</li>
                          <li>🛢️ Votre plan de cuverie (Capacités/Noms)</li>
                        </ul>
                        <strong>Ce qui sera remis à zéro :</strong>
                        <ul style={{ marginTop: 8, fontSize: 13, color: T.red }}>
                          <li>🍷 Tous les lots de vin et bouteilles</li>
                          <li>📉 Tous les stocks de matières sèches (mis à 0)</li>
                          <li>📋 Tout l'historique de traçabilité et maturation</li>
                        </ul>
                      </div>
                      <div style={{ display:"flex", gap:10, justifyContent:"flex-end", marginTop: 24 }}>
                        <Btn variant="secondary" onClick={() => setShowResetModal(false)} disabled={isResetting}>Annuler</Btn>
                        <Btn onClick={executeHardReset} disabled={isResetting} style={{ background: T.red, color: "#fff", borderColor: T.red }}>
                          {isResetting ? "Nettoyage..." : "Confirmer le Reset"}
                        </Btn>
                      </div>
                    </Modal>
                  )}

                  {/* Le contenu des onglets (Dashboard, Cuverie, etc.) */}
                  {renderContent()}
                  
                </div>
              </div>
              
              {/* Le composant Toast tout en bas, par-dessus tout */}
              <Toast toasts={state.toasts} dispatch={dispatch} />
            </div>
          )}
        </StoreCtx.Provider>
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}
