"use client";

import React, { createContext, useContext } from "react";

// =============================================================================
// THEMES
// =============================================================================
export const THEMES: any = {
  terroir: {
    name: "Terroir", desc: "Chaleureux, tons dorés sur fond sombre",
    bg: "#0f0d0a", surface: "#1a1713", surfaceHigh: "#242018",
    border: "#2e2a22", borderLight: "#3d3830",
    accent: "#c9a84c", accentLight: "#e2c47a", accentDim: "#7a6330",
    text: "#e8dcc8", textDim: "#8a7d6a", textStrong: "#f0e8d8",
    red: "#c44444", green: "#4a9960", blue: "#4a7ab5",
    loginBg: "linear-gradient(135deg,#0f0d0a 0%,#1e1a14 60%,#0a0807 100%)",
  },
  blanc: {
    name: "Blanc", desc: "Épuré, fond clair professionnel",
    bg: "#f5f3ef", surface: "#ffffff", surfaceHigh: "#f0ede8",
    border: "#e0dbd2", borderLight: "#ccc6bb",
    accent: "#8b6318", accentLight: "#5a3e0e", accentDim: "#c9a870",
    text: "#2a2520", textDim: "#7a7268", textStrong: "#1a1510",
    red: "#b03333", green: "#2d7040", blue: "#2a5a8b",
    loginBg: "linear-gradient(135deg,#f5f3ef 0%,#ede8df 60%,#f0ece6 100%)",
  },
  nuit: {
    name: "Bleu nuit", desc: "Bleu nuit, ambiance cave moderne",
    bg: "#090d16", surface: "#0f1624", surfaceHigh: "#18213a",
    border: "#1c2d44", borderLight: "#243d5c",
    accent: "#4a9fd4", accentLight: "#6abde8", accentDim: "#2a6a94",
    text: "#c0d4e8", textDim: "#5a7a9a", textStrong: "#e0eef8",
    red: "#e05555", green: "#3da870", blue: "#4a9fd4",
    loginBg: "linear-gradient(135deg,#060a12 0%,#0b1422 60%,#06090f 100%)",
  },
  noir: {
    name: "Noir", desc: "Minimaliste absolu, contraste maximal",
    bg: "#000000", surface: "#0a0a0a", surfaceHigh: "#111111",
    border: "#1c1c1c", borderLight: "#2a2a2a",
    accent: "#d0d0d0", accentLight: "#ffffff", accentDim: "#888888",
    text: "#b0b0b0", textDim: "#555555", textStrong: "#ffffff",
    red: "#cc4444", green: "#44aa66", blue: "#4488cc",
    loginBg: "linear-gradient(135deg,#000 0%,#080808 100%)",
  },
};

// --- AJOUT DES CUVES À BOURBES / LIES / REBECHES ---
export const CONTAINER_TYPES: string[] = [
  "CUVE_INOX","CUVE_BETON","CUVE_EMAIL","CUVE_FIBRE","CUVE_PLASTIQUE",
  "BARRIQUE","FOUDRE","CUVE_DEBOURBAGE","CUVE_BOURBES","CUVE_LIES",
  "CUVE_REBECHES", 
  "CITERNE","AUTRE"
];

export const CONTAINER_TYPE_COLORS: any = {
  CUVE_INOX:"#4a7ab5", CUVE_BETON:"#7a6a50", CUVE_EMAIL:"#4a9960",
  BARRIQUE:"#8b6340", FOUDRE:"#6b4a2a", CUVE_FIBRE:"#7a7a50",
  CUVE_PLASTIQUE:"#5a7a5a", CUVE_DEBOURBAGE:"#8c7355", 
  CUVE_BOURBES:"#5e4a3d", CUVE_LIES:"#a39171", 
  CUVE_REBECHES:"#8c3b3b", 
  CITERNE:"#4f5d73", AUTRE:"#8a7d6a"
};

// --- AJOUT DES STATUTS POUR LES ROUGES ET MACÉRATIONS ---
export const LOT_STATUSES: string[] = [
  "MOUT_NON_DEBOURBE",
  "MOUT_DEBOURBE",
  "MACERATION", 
  "FERMENTATION_ALCOOLIQUE",
  "FERMENTATION_MALOLACTIQUE",
  "FA_ET_FML",
  "VIN_DE_BASE", 
  "VIN_ROUGE",   
  "RESERVE",
  "ASSEMBLAGE",
  "BOURBES",
  "LIES",
  "REBECHES", 
  "TIRE",
  "MIS_EN_BOUTEILLE", 
  "ARCHIVE"
];

export const LOT_STATUS_COLORS: any = {
  "MOUT_NON_DEBOURBE": "#6b543c", 
  "MOUT_DEBOURBE": "#9c8452",     
  "MACERATION": "#8b1c31",        
  "FERMENTATION_ALCOOLIQUE": "#d48b35", 
  "FERMENTATION_MALOLACTIQUE": "#e6a15c", 
  "FA_ET_FML": "#d46235",         
  "VIN_DE_BASE": "#2d6640",
  "VIN_ROUGE": "#660011",         
  "RESERVE": "#8B5A2B",       
  "ASSEMBLAGE": "#357abd",
  "BOURBES": "#5e4a3d",
  "LIES": "#a39171",  
  "REBECHES": "#8c3b3b",     
  "TIRE": "#666666",   
  "MIS_EN_BOUTEILLE": "#4a7ab5",  
  "ARCHIVE": "#333333"            
};

export const BOTTLE_STATUSES: string[] = ["SUR_LATTES", "EN_REMUAGE", "SUR_POINTES", "EN_CAVE", "A_DEGORGER", "DEGORGE", "HABILLE", "PRET_EXPEDITION", "EXPEDIE"];
export const BOTTLE_STATUS_COLORS: any = {
  SUR_LATTES:"#4a7ab5", EN_REMUAGE:"#d48b35", SUR_POINTES:"#e6a15c", EN_CAVE: "#8b1c31", 
  A_DEGORGER:"#c9a84c", DEGORGE:"#4a9fd4", HABILLE:"#9960aa", PRET_EXPEDITION:"#4a9960", EXPEDIE:"#555555",
};

export const CEPAGES: string[] = [
  "CH", "PN", "PM", "Arbane", "Petit Meslier", "Pinot Blanc", "Voltis", "Chardonnay Rose", "MULTI"
];

export const MOCK_USERS: any[] = [
  { id:1, email:"admin@cave.fr",   password:"admin123", name:"Marie Laurent",  role:"Admin",        initials:"ML" },
  { id:2, email:"chef@cave.fr",    password:"chef123",  name:"Jean Dupont",    role:"Chef de cave", initials:"JD" },
  { id:3, email:"caviste@cave.fr", password:"cave123",  name:"Pierre Martin",  role:"Caviste",      initials:"PM" },
  { id:4, email:"lecture@cave.fr", password:"read123",  name:"Sophie Bernard", role:"Lecture seule",initials:"SB" },
];

export const MOCK_WORK_ORDERS: any[] = [];

// 👈 CORRECTION DES TYPAGES TS EXPLICITES :
export const getFillPct    = (c: any) => c.capacity > 0 ? Math.round((c.currentVolume / c.capacity) * 100) : 0;
export const formatVol     = (v: any) => Number(v).toLocaleString("fr-FR", {minimumFractionDigits: 0, maximumFractionDigits: 2}) + " hL";
export const formatVolShort= (v: any) => Number(v).toLocaleString("fr-FR", {minimumFractionDigits: 0, maximumFractionDigits: 2}) + " hL";
export const getTypeColor  = (type: string) => CONTAINER_TYPE_COLORS[type] || "#888";
export const getStatusColor= (s: string, map: any) => map[s] || "#888";
export const newId         = () => Math.random().toString(36).slice(2, 9);
export const today         = () => new Date().toISOString().slice(0, 10);
export const roleColor     = (T: any, role: string) => ({"Admin": T.accent, "Chef de cave": T.blue, "Caviste": T.green, "Lecture seule": T.textDim} as any)[role] || T.accent;

export const INIT_CONTAINERS: any[] = [];
export const INIT_LOTS: any[] = []; 
export const INIT_EVENTS: any[] = [];
export const INIT_BOTTLE_LOTS: any[] = [];
export const INIT_ANALYSES: any[] = [];
export const INIT_PRESSINGS: any[] = []; 

export const initialState = {
  containers:  INIT_CONTAINERS,
  lots:        INIT_LOTS,
  events:      INIT_EVENTS,
  bottleLots:  INIT_BOTTLE_LOTS,
  analyses:    INIT_ANALYSES,
  pressings:   INIT_PRESSINGS, 
  toasts:      [] as any[],
  pressoirs: [] as any[],
  maturations: [] as any[],
  parcelles: [] as any[],
  faReadings:  [] as any[],
  users:       MOCK_USERS,
  products:       [] as any[],
  stockMovements: [] as any[],
};

// 👈 CORRECTION DES TYPAGES TS EXPLICITES POUR LE REDUCER :
export function storeReducer(state: any, action: any) {
  switch (action.type) {
    case "SET_CONTAINERS": return { ...state, containers: action.payload };
    case "SET_LOTS": return { ...state, lots: action.payload };
    case "SET_EVENTS": return { ...state, events: action.payload };
    case "SET_BOTTLE_LOTS": return { ...state, bottleLots: action.payload };
    case "SET_FA_READINGS": return { ...state, faReadings: action.payload };
    case "SET_USERS": return { ...state, users: action.payload };
    case "SET_PRESSINGS": return { ...state, pressings: action.payload }; 
    
    // --- NOUVELLES ACTIONS : GESTION DES STOCKS ---
    case "SET_PRODUCTS": return { ...state, products: action.payload };
    case "SET_MOVEMENTS": return { ...state, stockMovements: action.payload };
    
    case "ADD_MOVEMENT": {
      const movement = { ...action.payload, id: newId(), date: today() };
      
      const currentProducts = state.products || [];
      const currentMovements = state.stockMovements || [];
      
      const products = currentProducts.map((p: any) => {
        if (p.id === movement.productId) {
          const newStock = movement.type === "IN" 
            ? p.currentStock + movement.quantity 
            : p.currentStock - movement.quantity;
          return { ...p, currentStock: Math.max(0, newStock) };
        }
        return p;
      });

      return { 
        ...state, 
        stockMovements: [movement, ...currentMovements],
        products 
      };
    }
    case "ADD_PRODUCT": {
      const currentProducts = state.products || [];
      const newProduct = { ...action.payload, id: `P${currentProducts.length + 1}` };
      return { ...state, products: [...currentProducts, newProduct] };
    }
    // ----------------------------------------------
    case "SET_PRESSOIRS": return { ...state, pressoirs: action.payload };
    case "ADD_PRESSOIR": return { ...state, pressoirs: [...state.pressoirs, action.payload] };
    case "UPDATE_PRESSOIR": return { ...state, pressoirs: state.pressoirs.map((p: any) => p.id === action.payload.id ? action.payload : p) };
    
    case "ADD_PRESSING": return { ...state, pressings: [action.payload, ...(state.pressings || [])] };
    
    case "UPDATE_PRESSING":
      return {
        ...state,
        pressings: (state.pressings || []).map((p: any) => 
          p.id === action.payload.id 
            ? { ...p, status: action.payload.status, weight: action.payload.weight !== undefined ? action.payload.weight : p.weight } 
            : p
        )
      };

    case "ADD_CONTAINER": {
      const c = { id: action.payload.id, currentVolume: 0, lotId: null, ...action.payload };
      return { ...state, containers: [...state.containers, c] };
    }
    case "UPDATE_CONTAINER": {
      return { ...state, containers: state.containers.map((c: any) => c.id === action.payload.id ? { ...c, ...action.payload } : c) };
    }
    case "DELETE_CONTAINER": {
      return { ...state, containers: state.containers.filter((c: any) => c.id !== action.payload) };
    }
    case "CREATE_LOT": {
      const { lot, containerId, operator } = action.payload;
      const newLot = { ...lot, id: lot.id || newId(), childIds: [], parentIds: [], volume: lot.volume || 0 };
      const containers = state.containers.map((c: any) =>
        c.id === containerId ? { ...c, lotId: newLot.id, currentVolume: (c.currentVolume || 0) + (lot.volume || 0), status: "PLEINE" } : c
      );
      return { ...state, lots: [...state.lots, newLot], containers };
    }

    case "TRANSFER": {
      const { lotId, fromId, destinations, toId, volume, operator, note, remainderType, date } = action.payload;
      
      const sourceContainer = state.containers.find((c: any) => c.id === fromId);
      const sourceLot = state.lots.find((l: any) => l.id === lotId);

      if (!sourceContainer || !sourceLot) return state;

      const dests = destinations || [{ toId, volume: parseFloat(volume) }];
      const totalTransferVol = dests.reduce((sum: any, d: any) => sum + (parseFloat(d.volume) || 0), 0);
      
      const remainingVolume = Math.max(0, sourceContainer.currentVolume - totalTransferVol);
      const isPartial = remainingVolume > 0;

      let newLots = [...state.lots];
      let newContainers = [...state.containers];
      let newEvents = [...state.events];

      let finalStatus = sourceLot.status;
      if (sourceContainer.type === "CUVE_DEBOURBAGE" && sourceLot.status === "MOUT_NON_DEBOURBE") {
          finalStatus = "MOUT_DEBOURBE";
      }

      if (isPartial && !remainderType) {
        newLots = newLots.map((l: any) => l.id === lotId ? { ...l, volume: remainingVolume, status: finalStatus } : l);
        newContainers = newContainers.map((c: any) => c.id === fromId ? { ...c, currentVolume: remainingVolume, status: "PLEINE" } : c);
        
        dests.forEach((dest: any, i: number) => {
          const cloneId = newId();
          newLots.push({ ...sourceLot, id: cloneId, code: `${sourceLot.code}-T${i+1}`, volume: parseFloat(dest.volume), containerId: dest.toId, status: finalStatus });
          newContainers = newContainers.map((c: any) => c.id === dest.toId ? { ...c, currentVolume: (c.currentVolume||0) + parseFloat(dest.volume), lotId: cloneId, status: "PLEINE" } : c);
        });
      } else {
        const firstDest = dests[0];
        
        newLots = newLots.map((l: any) => l.id === lotId ? { ...l, containerId: firstDest.toId, volume: parseFloat(firstDest.volume), status: finalStatus } : l);
        newContainers = newContainers.map((c: any) => c.id === firstDest.toId ? { ...c, currentVolume: (c.currentVolume||0) + parseFloat(firstDest.volume), lotId: sourceLot.id, status: "PLEINE" } : c);

        for (let i = 1; i < dests.length; i++) {
          const dest = dests[i];
          const cloneId = newId();
          newLots.push({ ...sourceLot, id: cloneId, code: `${sourceLot.code}-T${i}`, volume: parseFloat(dest.volume), containerId: dest.toId, status: finalStatus });
          newContainers = newContainers.map((c: any) => c.id === dest.toId ? { ...c, currentVolume: (c.currentVolume||0) + parseFloat(dest.volume), lotId: cloneId, status: "PLEINE" } : c);
        }

        if (remainingVolume > 0 && remainderType) {
          const remId = newId();
          newLots.push({ ...sourceLot, id: remId, code: `${sourceLot.code}-${remainderType.charAt(0)}`, volume: remainingVolume, containerId: fromId, status: remainderType, notes: `Reste de soutirage (${remainderType})` });
          newContainers = newContainers.map((c: any) => c.id === fromId ? { ...c, currentVolume: remainingVolume, lotId: remId, status: "PLEINE" } : c);
        } else {
          newContainers = newContainers.map((c: any) => c.id === fromId ? { ...c, currentVolume: 0, lotId: null, status: "VIDE" } : c);
        }
      }

      const evtDate = date || today();
      const evtOut = { id: newId(), type: "TRANSFERT_OUT", date: evtDate, lotId: sourceLot.id, containerId: fromId, volumeIn: 0, volumeOut: totalTransferVol, operator, note: note || "Soutirage/Éclatement" };
      newEvents.unshift(evtOut);
      dests.forEach((d: any) => {
         newEvents.unshift({ id: newId(), type: "TRANSFERT_IN", date: evtDate, lotId: sourceLot.id, containerId: d.toId, volumeIn: d.volume, volumeOut: 0, operator, note: "Réception fraction" });
      });

      return { ...state, containers: newContainers, lots: newLots, events: newEvents };
    }

    case "DECUVAGE": {
      const { sourceLotId, sourceContainerId, volGoutte, cuveGoutteId, volPresse, cuvePresseId, finalStatus, notes, operator } = action.payload;
      
      const sourceLot = state.lots.find((l: any) => l.id === sourceLotId);
      if (!sourceLot) return state;

      let newLots = state.lots.map((l: any) => l.id === sourceLotId ? { ...l, status: "ARCHIVE", volume: 0 } : l);
      let newContainers = state.containers.map((c: any) => c.id === sourceContainerId ? { ...c, currentVolume: 0, status: "VIDE", lotId: null } : c);
      let newEvents = [...state.events];

      const evtDate = today();

      // Création du Vin de Goutte
      if (volGoutte > 0) {
        const cloneGId = newId();
        newLots.push({ ...sourceLot, id: cloneGId, code: `${sourceLot.code}-G`, volume: volGoutte, containerId: cuveGoutteId, status: finalStatus, notes: `Vin de Goutte. ${notes}` });
        newContainers = newContainers.map((c: any) => c.id === cuveGoutteId ? { ...c, currentVolume: (c.currentVolume||0) + volGoutte, lotId: cloneGId, status: "PLEINE" } : c);
        newEvents.unshift({ id: newId(), type: "TRANSFERT_IN", date: evtDate, lotId: cloneGId, containerId: cuveGoutteId, volumeIn: volGoutte, volumeOut: 0, operator, note: "Écoulage Goutte (Décuvage)" });
      }

      // Création du Vin de Presse
      if (volPresse > 0) {
        const clonePId = newId();
        newLots.push({ ...sourceLot, id: clonePId, code: `${sourceLot.code}-P`, volume: volPresse, containerId: cuvePresseId, status: finalStatus, notes: `Vin de Presse. ${notes}` });
        newContainers = newContainers.map((c: any) => c.id === cuvePresseId ? { ...c, currentVolume: (c.currentVolume||0) + volPresse, lotId: clonePId, status: "PLEINE" } : c);
        newEvents.unshift({ id: newId(), type: "TRANSFERT_IN", date: evtDate, lotId: clonePId, containerId: cuvePresseId, volumeIn: volPresse, volumeOut: 0, operator, note: "Pressurage marc (Décuvage)" });
      }

      newEvents.unshift({ id: newId(), type: "TRANSFERT_OUT", date: evtDate, lotId: sourceLot.id, containerId: sourceContainerId, volumeIn: 0, volumeOut: sourceLot.volume, operator, note: "Décuvage" });

      return { ...state, containers: newContainers, lots: newLots, events: newEvents };
    }

    case "DECLARE_LOSS": {
      const { entityType, entityId, amount, operator, note } = action.payload;
      let newLots = [...state.lots];
      let newBottleLots = [...state.bottleLots];
      let newEvents = [...state.events];

      if (entityType === "BULK") {
        const lot = state.lots.find((l: any) => l.id === entityId);
        newLots = newLots.map((l: any) => l.id === entityId ? { ...l, volume: Math.max(0, l.volume - parseFloat(amount)) } : l);
        newEvents.unshift({ id: newId(), type: "PERTE", date: today(), lotId: entityId, containerId: lot?.containerId, volumeIn: 0, volumeOut: parseFloat(amount), operator, note: `Perte de ${amount} hL. ${note}` });
      } else {
        const bl = state.bottleLots.find((b: any) => b.id === entityId);
        newBottleLots = newBottleLots.map((b: any) => b.id === entityId ? { ...b, currentCount: Math.max(0, b.currentCount - parseInt(amount)) } : b);
        newEvents.unshift({ id: newId(), type: "CASSE", date: today(), lotId: bl?.sourceLotId, containerId: null, volumeIn: 0, volumeOut: 0, operator, note: `Casse de ${amount} btl. ${note}` });
      }
      
      return { ...state, lots: newLots, bottleLots: newBottleLots, events: newEvents };
    }

    case "ADD_ANALYSE": return { ...state, analyses: [{ ...action.payload, id: newId() }, ...state.analyses] };
    case "UPDATE_ANALYSE": return { ...state, analyses: state.analyses.map((a: any) => a.id === action.payload.id ? { ...a, ...action.payload } : a) };
    case "DELETE_ANALYSE": return { ...state, analyses: state.analyses.filter((a: any) => a.id !== action.payload) };
    case "IMPORT_ANALYSES": return { ...state, analyses: [...action.payload.map((a: any) => ({ ...a, id: newId() })), ...state.analyses] };
    
    case "TIRAGE": {
      const { lotId, format, count, volume, operator, dosage, isTranquille } = action.payload;
      
      // MAGIE : Le code, le type et le statut s'adaptent selon le type de vin !
      const typeCode = isTranquille ? "MISE" : "TIRAGE";
      const targetStatus = isTranquille ? "EN_CAVE" : "SUR_LATTES";
      
      const bl = { 
        id: newId(), 
        code: `${typeCode}-${new Date().getFullYear()}-${String(state.bottleLots.length + 1).padStart(3,"0")}`, 
        type: typeCode, 
        sourceLotId: lotId, 
        format, 
        initialCount: count, 
        currentCount: count, 
        degorgeCount: 0, 
        zone: "", palette: "", rack: "", 
        tirageDate: today(), 
        status: targetStatus, 
        dosage: "", notes: "" 
      };
      
      const lots = state.lots.map((l: any) => l.id === lotId ? { ...l, status:"TIRE", volume: Math.max(0, l.volume - volume), childIds:[...l.childIds, bl.id] } : l);
      const evt = { id: newId(), type: typeCode, date: today(), lotId, containerId: null, volumeIn: 0, volumeOut: volume, operator, note: `${count} btl ${format} (${typeCode})` };
      
      return { ...state, lots, bottleLots: [...state.bottleLots, bl], events: [evt, ...state.events] };
    }

    case "DEGORGER": {
      const { blId, count, dosage, operator } = action.payload;
      const src = state.bottleLots.find((b: any) => b.id === blId);
      const degId = newId();
      const deg = { id: degId, code: `DEG-${new Date().getFullYear()}-${String(state.bottleLots.length + 1).padStart(3,"0")}`, type:"DEGORGE", sourceLotId: blId, format: src.format, initialCount: count, currentCount: count, degorgeCount: count, zone: src.zone, palette:"", rack:"", tirageDate: src.tirageDate, degorgDate: today(), status:"DEGORGE", dosage, notes:"" };
      const bottleLots = state.bottleLots.map((b: any) => b.id === blId ? { ...b, currentCount: b.currentCount - count, degorgeCount: b.degorgeCount + count, status: b.currentCount - count <= 0 ? "EXPEDIE" : b.status } : b);
      const evt = { id: newId(), type:"DEGORGEMENT", date: today(), lotId: src.sourceLotId, containerId: null, volumeIn:0, volumeOut:0, operator, note: `${count} btl / ${dosage}` };
      return { ...state, bottleLots: [...bottleLots, deg], events: [evt, ...state.events] };
    }

    case "HABILLER": {
      const { blId, count, operator, notes } = action.payload;
      const src = state.bottleLots.find((b: any) => b.id === blId);
      const habId = newId();
      
      // On crée le lot final Prêt à l'expédition
      const hab = { ...src, id: habId, code: `HAB-${new Date().getFullYear()}-${String(state.bottleLots.length + 1).padStart(3,"0")}`, type: "HABILLAGE", sourceBottleLotId: blId, initialCount: count, currentCount: count, status: "PRET_EXPEDITION", notes: notes || "" };
      
      const bottleLots = state.bottleLots.map((b: any) => b.id === blId ? { ...b, currentCount: b.currentCount - count, status: b.currentCount - count <= 0 ? "ARCHIVE" : b.status } : b);
      const evt = { id: newId(), type: "HABILLAGE", date: today(), lotId: src.sourceLotId, containerId: null, volumeIn: 0, volumeOut: 0, operator, note: `${count} btl habillées` };
      
      return { ...state, bottleLots: [...bottleLots, hab], events: [evt, ...state.events] };
    }

    case "EXPEDIER": {
      const { blId, count, operator } = action.payload;
      const bottleLots = state.bottleLots.map((b: any) => b.id === blId ? { ...b, currentCount: b.currentCount - count, status: b.currentCount - count <= 0 ? "EXPEDIE" : b.status } : b);
      const bl = state.bottleLots.find((b: any) => b.id === blId);
      const evt = { id: newId(), type:"EXPEDITION", date: today(), lotId: bl.sourceLotId, containerId: null, volumeIn:0, volumeOut:0, operator, note: `${count} btl expediées` };
      return { ...state, bottleLots, events: [evt, ...state.events] };
    }

    case "UPDATE_BOTTLE_STATUS": {
      const { blId, status, location, operator, note } = action.payload;
      const bottleLots = state.bottleLots.map((b: any) => b.id === blId ? { ...b, status, zone: location || b.zone } : b);
      const bl = state.bottleLots.find((b: any) => b.id === blId);
      const evt = { id: newId(), type: "MOUVEMENT_CAVE", date: today(), lotId: bl.sourceLotId, containerId: null, volumeIn:0, volumeOut:0, operator, note: note || `Passage en ${status.replace('_', ' ')}` };
      return { ...state, bottleLots, events: [evt, ...state.events] };
    }

    case "ADD_USER": return { ...state, users: [...state.users, action.payload] };
    case "UPDATE_USER": return { ...state, users: state.users.map((u: any) => u.id === action.payload.id ? action.payload : u) };
    
    case "TOAST_ADD": return { ...state, toasts: [...state.toasts, { id: newId(), msg: action.payload.msg, color: action.payload.color }] };
    case "TOAST_REMOVE": return { ...state, toasts: state.toasts.filter((t: any) => t.id !== action.payload) };
    
    case "SET_MATURATIONS": return { ...state, maturations: action.payload };
    case "ADD_MATURATION": return { ...state, maturations: [...state.maturations, action.payload] };
    case "UPDATE_MATURATION": return { ...state, maturations: state.maturations.map((m: any) => m.id === action.payload.id ? action.payload : m) };
    
    case "SET_PARCELLES": return { ...state, parcelles: action.payload };
    case "ADD_PARCELLE": return { ...state, parcelles: [...state.parcelles, action.payload].sort((a: any, b: any)=>a.nom.localeCompare(b.nom)) };

    case "SET_DEGUSTATIONS": return { ...state, degustations: action.payload };
    case "ADD_DEGUSTATION": return { ...state, degustations: [...state.degustations, action.payload] };

    default: return state;
  }
}

export const ThemeCtx = createContext<any>(null);
export const AuthCtx  = createContext<any>(null);
export const StoreCtx = createContext<any>(null);

export const useTheme = () => useContext(ThemeCtx);
export const useAuth  = () => useContext(AuthCtx);
export const useStore = () => useContext(StoreCtx);