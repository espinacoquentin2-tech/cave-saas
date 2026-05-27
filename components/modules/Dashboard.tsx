"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, KpiCard } from "@/components/ui";
import {
  LOT_STATUSES,
  LOT_STATUS_COLORS,
  useAuth,
  useStore,
  useTheme,
} from "@/lib/store";
import {
  getBottleLotCount,
  getDegorgementEligibility,
  normalizeBottleLotStatus,
} from "@/lib/bottles";
import { formatRoleLabel } from "@/lib/roles";

type DashboardProps = {
  setNav: (nav: string) => void;
  workOrders: any[];
  setWorkOrders: (next: any[]) => void;
  onRefresh: () => Promise<void> | void;
  canShowDatabaseReset: boolean;
  onOpenResetModal: () => void;
  lastResetSummary: any | null;
  TaskExecutionModal: React.ComponentType<{
    task: any;
    onClose: () => void;
    workOrders: any[];
    setWorkOrders: (next: any[]) => void;
    refreshData: () => Promise<void> | void;
  }>;
};

const formatStatus = (s: string | null | undefined) => {
  if (!s) return "";
  if (s === "FERMENTATION_ALCOOLIQUE") return "FA";
  if (s === "FERMENTATION_MALOLACTIQUE") return "FML";
  if (s === "FA_ET_FML") return "FA & FML";
  return s.replace(/_/g, " ");
};

export function Dashboard({ setNav, workOrders, setWorkOrders, onRefresh, canShowDatabaseReset, onOpenResetModal, lastResetSummary, TaskExecutionModal }: DashboardProps) {
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

  const toNum = (value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const totalCapacity = containers.reduce((s: number, c: any) => s + toNum(c.capacityValue ?? c.capacity), 0);
  const totalVol      = containers.reduce((s: number, c: any) => s + toNum(c.currentVolume), 0);
  const lotsActifs    = lots.filter((l: any) => l.status !== "TIRE" && l.status !== "ARCHIVE").length;
  const cuvesPleines  = containers.filter((c: any) => toNum(c.currentVolume) > 0).length;
  const cuvesVides    = containers.filter((c: any) => toNum(c.currentVolume) === 0).length;

  // Utilisation des bons champs BDD (currentBottleCount)
  const surLattes     = bottleLots.filter((b: any) => normalizeBottleLotStatus(b.status, b.type) === "SUR_LATTES").reduce((s: any, b: any) => s + getBottleLotCount(b), 0);
  const prodFinis     = bottleLots.filter((b: any) => normalizeBottleLotStatus(b.status, b.type) === "PRET_EXPEDITION").reduce((s: any, b: any) => s + getBottleLotCount(b), 0);

  const fillRate      = totalCapacity > 0 ? Math.round(totalVol / totalCapacity * 100) : 0;
  const lotsByStatus  = LOT_STATUSES.map((s: any) => ({ s, count: lots.filter((l: any) => l.status === s).length })).filter((x: any) => x.count > 0);

  const pendingTasks = workOrders.filter(w => w.status === "PENDING" || w.status === "BLOCKED").sort((a,b) => {
    if (a.status === "BLOCKED" && b.status !== "BLOCKED") return -1;
    if (a.status !== "BLOCKED" && b.status === "BLOCKED") return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // 🚨 1. ALERTES CUVERIE & LOTS
  const caveAlerts = [
    ...workOrders.filter((w: any) => w.status === "BLOCKED").map((w: any) => ({ level: "red", msg: `Blocage OT: ${w.recette} impossible (Capacité)`, nav: "admin_wo" })),
    ...containers.filter((c: any) => c.status === "VIDE" && c.notes).map((c: any) => ({ level:"warn", msg:`${c.displayName || c.name} : ${c.notes}`, nav:"cuverie" })),
    ...containers.filter((c: any) => c.status === "NETTOYAGE").map((c: any) => ({ level:"info", msg:`${c.displayName || c.name} en nettoyage`, nav:"cuverie" })),
    ...lots.filter((l: any) => l.notes && l.notes.includes("sans suivi")).map((l: any) => ({ level:"warn", msg:`${l.businessCode || l.code} : ${l.notes}`, nav:"lots" })),
    ...bottleLots
      .filter((b: any) => getDegorgementEligibility(b).eligible)
      .map((b: any) => ({ level:"action", msg:`${b.businessCode || b.code} prêt à dégorger (${getBottleLotCount(b).toLocaleString("fr-FR")} btl)`, nav:"stock" })),
  ];

  // 📦 2. ALERTES MATIÈRES SÈCHES (NOUVEAU)
  const stockAlerts = products
    .filter((p: any) => p.currentStock <= p.minStock)
    .map((p: any) => ({
      level: p.currentStock === 0 ? "red" : "warn",
      msg: p.currentStock === 0 ? `RUPTURE : ${p.name}` : `Stock critique : ${p.name} (Reste ${p.currentStock.toLocaleString('fr-FR')} ${p.unit})`,
      nav: "inventaire"
    }));

  const totalAlertsCount = caveAlerts.length + stockAlerts.length;

  const getEventTimestamp = (event: any) => event.eventDatetime || event.createdAt || event.date;
  const recentEvts = [...events].sort((a: any, b: any) => new Date(getEventTimestamp(b)).getTime() - new Date(getEventTimestamp(a)).getTime()).slice(0, 6);
  const getLotCode = (id: any) => lots.find((l: any) => String(l.id) === String(id))?.businessCode || lots.find((l: any) => String(l.id) === String(id))?.code || id;
  const getContainerName = (id: any) => containers.find((c: any) => String(c.id) === String(id))?.displayName || containers.find((c: any) => String(c.id) === String(id))?.name || id;

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
      <div style={{ marginBottom:28, display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:20, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontSize:10, color:T.accent, letterSpacing:4, textTransform:"uppercase", marginBottom:6 }}>Vue d'ensemble</div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Tableau de bord</h1>
          <div style={{ color:T.textDim, fontSize:13, marginTop:4 }}>{new Date().toLocaleDateString("fr-FR", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}<span style={{ marginLeft:16, color:T.accent }}>{user.name}</span><span style={{ marginLeft:8, fontSize:10, color:T.textDim }}>({formatRoleLabel(user.role)})</span></div>
        </div>
        {canShowDatabaseReset && (
          <button
            onClick={onOpenResetModal}
            style={{
              minWidth: 230,
              background: "linear-gradient(135deg, #7a1622, #a71f2f)",
              color: "#fff",
              border: "1px solid #d75a66",
              borderRadius: 8,
              padding: "12px 16px",
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(122,22,34,0.24)",
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.8, marginBottom: 4 }}>Attention</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Reset base de test</div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>Supprime les données métier de développement puis recharge la démo si demandé.</div>
          </button>
        )}
      </div>

      {lastResetSummary && (
        <div style={{ marginBottom: 24, background: T.surface, border: `1px solid ${T.border}`, borderTop: `2px solid ${T.green}`, borderRadius: 6, padding: 20 }}>
          <div style={{ fontSize: 16, color: T.textStrong, fontWeight: 700, marginBottom: 6 }}>Résumé de la dernière réinitialisation</div>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14 }}>
            Mode: <span style={{ color: T.textStrong, fontFamily: "monospace" }}>{lastResetSummary.mode}</span> ·
            Démo rechargée: <span style={{ color: T.textStrong, fontFamily: "monospace" }}>{String(lastResetSummary.reseed)}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Supprimé</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(lastResetSummary.deleted || {})
                  .filter(([, value]) => typeof value === "number" && value > 0)
                  .map(([key, value]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: T.text }}>
                      <span>{key}</span>
                      <span style={{ fontFamily: "monospace", color: T.red }}>{String(value)}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>Recréé</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Object.entries(lastResetSummary.seeded || {})
                  .filter(([, value]) => typeof value === "number" && value > 0)
                  .map(([key, value]) => (
                    <div key={key} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, color: T.text }}>
                      <span>{key}</span>
                      <span style={{ fontFamily: "monospace", color: T.green }}>{String(value)}</span>
                    </div>
                  ))}
                {Object.keys(lastResetSummary.seeded || {}).length === 0 && (
                  <div style={{ fontSize: 12, color: T.textDim }}>Aucune donnée de démo recréée.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
            ) : caveAlerts.map((a: any, i: number) => (
              <div key={i} onClick={() => setNav(a.nav)} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 0", borderBottom:i < caveAlerts.length-1 ? `1px solid ${T.border}` : "none", cursor:"pointer" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:alertColors[a.level as keyof typeof alertColors] || T.accent, flexShrink:0, marginTop:4 }} />
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
            ) : stockAlerts.map((a: any, i: number) => (
              <div key={i} onClick={() => setNav(a.nav)} style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"10px 0", borderBottom:i < stockAlerts.length-1 ? `1px solid ${T.border}` : "none", cursor:"pointer" }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:alertColors[a.level as keyof typeof alertColors] || T.accent, flexShrink:0, marginTop:4 }} />
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
              <div style={{ fontSize:10, color:T.textDim, fontFamily:"monospace" }}>{new Date(getEventTimestamp(e)).toLocaleDateString('fr-FR')}</div>
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
