"use client";
// @ts-nocheck

import React, { useRef, useState } from "react";
import { Badge, Btn, FF, Input, Modal, Select } from "@/components/ui";
import { LOT_STATUS_COLORS, useAuth, useStore, useTheme } from "@/lib/store";
import { buildApiHeaders, extractApiErrorMessage, getLotCode, toSafeNumber } from "@/lib/client-app-helpers";
import {
  ASSEMBLAGE_TYPES,
  BOTTLE_FORMAT_TO_HL,
  convertBottleCountToHl,
  convertHlToBottleCount,
  evaluateAssemblageDecision,
  getBottleFormatLabel,
  isAssemblageEligibleLotStatus,
  isAssemblageMainEligibleLotStatus,
  isAssemblageReserveEligibleLotStatus,
  isAssemblageRoseEligibleLotStatus,
} from "@/lib/assemblage";

export function Assemblages() {
  const T = useTheme(); 
  const { user } = useAuth(); 
  const { state, dispatch, refreshData } = useStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assemblageType, setAssemblageType] = useState<any>("BSA");
  const [destinationContainerId, setDestinationContainerId] = useState("");
  const [notes, setNotes] = useState("");
  const [sourceDrafts, setSourceDrafts] = useState<any>({});
  const [adjuvants, setAdjuvants] = useState<any[]>([]);
  const [isCreatingAssemblage, setIsCreatingAssemblage] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const assemblageSubmitLockRef = useRef(false);
  const isSubmitting = isCreatingAssemblage;
  
  const assemblageLabels: Record<string, string> = {
    BSA: "BSA",
    MILLESIME: "Millésimé",
    BLANC_DE_BLANCS: "Blanc de blancs",
    BLANC_DE_NOIRS: "Blanc de noirs",
    ROSE_D_ASSEMBLAGE: "Rosé d'assemblage",
    ASSEMBLAGE_LIBRE: "Assemblage libre",
  };

  const assemblageCodeHints: Record<string, string> = {
    BSA: "BSA",
    MILLESIME: "MIL",
    BLANC_DE_BLANCS: "BDB",
    BLANC_DE_NOIRS: "BDN",
    ROSE_D_ASSEMBLAGE: "ROSE",
    ASSEMBLAGE_LIBRE: "LIBRE",
  };

  const computeDoseQuantityTotal = (doseValue: any, doseUnit: any, treatedVolumeHl: any, productUnit: any) => {
    const dose = parseFloat(doseValue) || 0;
    const treated = parseFloat(treatedVolumeHl) || 0;
    if (!dose || !treated || !doseUnit || !productUnit) return 0;

    const [baseUnitRaw, denominatorRaw] = String(doseUnit).split("/");
    if (!baseUnitRaw || (denominatorRaw || "").toLowerCase() !== "hl") return 0;

    const baseUnit = baseUnitRaw.toLowerCase();
    const targetUnit = String(productUnit).toLowerCase();
    const totalInBaseUnit = dose * treated;

    if (baseUnit === targetUnit) return totalInBaseUnit;
    if (baseUnit === "g" && targetUnit === "kg") return totalInBaseUnit / 1000;
    if (baseUnit === "kg" && targetUnit === "g") return totalInBaseUnit * 1000;
    if (baseUnit === "ml" && targetUnit === "l") return totalInBaseUnit / 1000;
    if (baseUnit === "l" && targetUnit === "ml") return totalInBaseUnit * 1000;
    return 0;
  };

  const buildSourceKey = (source: any) => `${source._type}-${source.id}`;
  const readSourceDraft = (source: any) => sourceDrafts[buildSourceKey(source)] || { selected: false, volumeHl: "", countUsed: "" };
  const updateSourceDraft = (source: any, patch: any) => {
    const key = buildSourceKey(source);
    setSourceDrafts((prev: any) => ({
      ...prev,
      [key]: {
        ...prev[key],
        selected: true,
        ...patch,
      },
    }));
  };

  const mainBulkSources = (state.lots || [])
    .filter((lot: any) => {
      const volume = Number(lot.currentVolume ?? lot.volume ?? 0);
      return volume > 0.001 && isAssemblageMainEligibleLotStatus(lot.status);
    })
    .map((lot: any) => ({
      ...lot,
      _type: "bulk",
      sourceRole: "MAIN",
      sourceCategoryLabel: "Source principale",
      code: lot.businessCode || lot.code,
      availableVolumeHl: Number(lot.currentVolume ?? lot.volume ?? 0),
      currentContainerLabel:
        lot.currentContainer?.displayName ||
        (state.containers || []).find((container: any) => String(container.id) === String(lot.currentContainerId || lot.containerId))?.displayName ||
        "--",
    }));

  const reserveBulkSources = (state.lots || [])
    .filter((lot: any) => {
      const volume = Number(lot.currentVolume ?? lot.volume ?? 0);
      if (volume <= 0.001) return false;
      if (!isAssemblageReserveEligibleLotStatus(lot.status)) return false;
      return lot.status === "RESERVE" || lot.qualiteLot === "RESERVE";
    })
    .map((lot: any) => ({
      ...lot,
      _type: "bulk",
      sourceRole: "RESERVE",
      sourceCategoryLabel: "Réserve",
      code: lot.businessCode || lot.code,
      availableVolumeHl: Number(lot.currentVolume ?? lot.volume ?? 0),
      currentContainerLabel:
        lot.currentContainer?.displayName ||
        (state.containers || []).find((container: any) => String(container.id) === String(lot.currentContainerId || lot.containerId))?.displayName ||
        "--",
    }));

  const roseBulkSources = (state.lots || [])
    .filter((lot: any) => {
      const volume = Number(lot.currentVolume ?? lot.volume ?? 0);
      return volume > 0.001 && isAssemblageRoseEligibleLotStatus(lot.status);
    })
    .map((lot: any) => ({
      ...lot,
      _type: "bulk",
      sourceRole: "ROSE",
      sourceCategoryLabel: "Source rosé",
      code: lot.businessCode || lot.code,
      availableVolumeHl: Number(lot.currentVolume ?? lot.volume ?? 0),
      currentContainerLabel:
        lot.currentContainer?.displayName ||
        (state.containers || []).find((container: any) => String(container.id) === String(lot.currentContainerId || lot.containerId))?.displayName ||
        "--",
    }));

  const reserveBottleSources = (state.bottleLots || [])
    .filter((bottleLot: any) => Number(bottleLot.currentBottleCount || bottleLot.currentCount || 0) > 0 && bottleLot.status === "RESERVE")
    .map((bottleLot: any) => {
      const sourceLot = bottleLot.sourceLot || (state.lots || []).find((lot: any) => String(lot.id) === String(bottleLot.sourceLotId));
      const formatCode = bottleLot.formatCode || bottleLot.format || "75cl";
      const availableCount = Number(bottleLot.currentBottleCount || bottleLot.currentCount || 0);

      return {
        ...bottleLot,
        _type: "bottle",
        sourceRole: "RESERVE",
        sourceCategoryLabel: "Réserve bouteille",
        code: bottleLot.businessCode || bottleLot.code,
        formatCode,
        formatLabel: getBottleFormatLabel(formatCode),
        sourceLot,
        availableCount,
        availableVolumeHl: convertBottleCountToHl(availableCount, formatCode),
        cepage: sourceLot?.mainGrapeCode || sourceLot?.cepage || "MULTI",
        millesime: sourceLot?.year || sourceLot?.millesime || "SA",
        currentContainerLabel: sourceLot?.currentContainer?.displayName || "--",
      };
    });

  const sourceSections = [
    { key: "main", title: "Sources principales", helper: "VIN_DE_BASE, ASSEMBLAGE, ASSEMBLE", items: mainBulkSources },
    { key: "reserve", title: "Réserve", helper: "RESERVE vrac et réserves bouteille / magnum", items: [...reserveBulkSources, ...reserveBottleSources].sort((a: any, b: any) => a.code.localeCompare(b.code)) },
    { key: "rose", title: "Sources rosé", helper: "VIN_ROUGE uniquement", items: roseBulkSources },
  ] as const;

  const sourceCandidates = sourceSections.flatMap((section) => section.items);

  const selectedSources = sourceCandidates
    .map((source: any) => ({ source, draft: readSourceDraft(source) }))
    .filter(({ draft }) => draft.selected);

  const selectedSourceRows = selectedSources.map(({ source, draft }: any) => {
    const isBottle = source._type === "bottle";
    const countUsed = isBottle ? Math.max(0, parseInt(draft.countUsed || "0", 10) || 0) : 0;
    const volumeHl = isBottle
      ? convertBottleCountToHl(countUsed, source.formatCode)
      : Math.max(0, parseFloat(draft.volumeHl || "0") || 0);
    const availableVolumeHl = isBottle ? source.availableVolumeHl : source.availableVolumeHl;
    const components = isBottle
      ? source.sourceLot?.components || [{ grapeCode: source.cepage, percentage: 100 }]
      : source.components || [{ grapeCode: source.cepage, percentage: 100 }];
    const reserveFlag =
      source.status === "RESERVE" ||
      source.qualiteLot === "RESERVE" ||
      source.sourceLot?.status === "RESERVE" ||
      source.sourceLot?.qualiteLot === "RESERVE";
    const redFlag =
      source.status === "VIN_ROUGE" ||
      source.sourceLot?.status === "VIN_ROUGE" ||
      String(source.code || "").toUpperCase().includes("ROUGE") ||
      String(source.sourceLot?.code || source.sourceLot?.businessCode || "").toUpperCase().includes("ROUGE");

    return {
      source,
      isBottle,
      countUsed,
      volumeHl,
      availableVolumeHl,
      isOverAvailable: volumeHl > availableVolumeHl + 0.0001,
      sourceRole: source.sourceRole,
      composition: components.map((component: any) => ({
        grapeCode: component.grapeCode || component.cepage || source.cepage || "INCONNU",
        percentage: Number(component.percentage || component.pct || 0) || 0,
      })),
      vintage: Number(source.year || source.millesime || source.sourceLot?.year || 0) || null,
      isReserve: source.sourceRole === "RESERVE" || reserveFlag,
      isRedWine: source.sourceRole === "ROSE" || redFlag,
    };
  });

  const decisionComponents = selectedSourceRows
    .filter((row: any) => row.volumeHl > 0)
    .map((row: any) => ({
      label: row.source.code,
      volumeHl: row.volumeHl,
      vintage: row.vintage,
      isReserve: row.isReserve,
      isRedWine: row.isRedWine,
      sourceRole: row.sourceRole,
      cepageBreakdown: row.composition,
    }));

  const decision = evaluateAssemblageDecision(decisionComponents, assemblageType as any);
  const totalVolumeHl = decision.totalVolumeHl;
  const compositionEntries = Object.entries(decision.compositionByCepage).sort((a: any, b: any) => b[1] - a[1]);
  const vintageEntries = Object.entries(decision.compositionByVintage).sort((a: any, b: any) => Number(b[0]) - Number(a[0]));
  const primaryGrape = compositionEntries.length === 1 ? compositionEntries[0][0] : "MULTI";
  const finalMillesime = decision.isMillesimeCandidate && vintageEntries.length === 1 ? Number(vintageEntries[0][0]) : "SA";
  const proposedCode = `${new Date().getFullYear()}-${primaryGrape}-${assemblageCodeHints[assemblageType] || "ASSEM"}-${String((state.lots || []).length + 1).padStart(3, "0")}`;
  const compoDetails = [
    compositionEntries.map(([grape, pct]: any) => `${grape} ${Number(pct).toFixed(2)} %`).join(" / "),
    vintageEntries.map(([year, pct]: any) => `${year} ${Number(pct).toFixed(2)} %`).join(" / "),
    selectedSourceRows.map((row: any) => `${row.source.code} ${row.volumeHl.toFixed(2)} hL`).join(" | "),
  ].filter(Boolean).join(" || ");

  const destinationCandidates = (state.containers || [])
    .map((container: any) => {
      const capacity = Number(container.capacityValue || container.capacity || 0);
      const currentVolume = Number(container.currentVolume || 0);
      const availableVolume = Math.max(0, capacity - currentVolume);

      let disabledReason = "";
      if (container.status === "ARCHIVÉE") disabledReason = "Cuve archivée";
      else if (["CUVE_BOURBES", "CUVE_LIES", "CUVE_DEBOURBAGE", "COMPARTIMENT"].includes(container.type)) disabledReason = "Type incompatible";
      else if (currentVolume > 0.0001) disabledReason = "Cuve non vide";
      else if (totalVolumeHl > 0 && availableVolume + 0.0001 < totalVolumeHl) disabledReason = "Capacité insuffisante";

      return {
        ...container,
        capacity,
        currentVolume,
        availableVolume,
        disabledReason,
      };
    })
    .sort((a: any, b: any) => Number(a.disabledReason ? 1 : 0) - Number(b.disabledReason ? 1 : 0) || a.capacity - b.capacity);

  const selectedDestination = destinationCandidates.find((container: any) => String(container.id) === String(destinationContainerId));
  const availableBulkCount = mainBulkSources.length;
  const availableReserveBottleCount = reserveBottleSources.length;
  const redSourceCount = roseBulkSources.length;
  const reserveSourceCount = reserveBulkSources.length + reserveBottleSources.length;

  const resetForm = () => {
    setAssemblageType("BSA");
    setDestinationContainerId("");
    setNotes("");
    setSourceDrafts({});
    setAdjuvants([]);
    setIdempotencyKey(crypto.randomUUID());
  };

  const adjuvantRows = adjuvants.map((row: any, index: number) => {
    const product = (state.products || []).find((candidate: any) => String(candidate.id) === String(row.productId));
    const treatedVolumeHl = parseFloat(row.treatedVolumeHl || totalVolumeHl || 0) || 0;
    const quantityTotal = computeDoseQuantityTotal(row.dose, row.doseUnit, treatedVolumeHl, product?.unit || row.quantityUnit);
    const stockAvailable = Number(product?.currentStock || 0);
    const stockShortage = !!product && quantityTotal > stockAvailable + 0.0001;

    return {
      ...row,
      index,
      product,
      treatedVolumeHl,
      quantityTotal,
      quantityUnit: product?.unit || row.quantityUnit || "",
      stockShortage,
      stockAvailable,
    };
  });

  const validationErrors = [
    ...(decisionComponents.length === 0 ? ["Sélectionnez au moins une source avec un volume positif."] : []),
    ...selectedSourceRows.filter((row: any) => row.isOverAvailable).map((row: any) => `Le volume demandé dépasse le disponible pour ${row.source.code}.`),
    ...selectedSourceRows.filter((row: any) => row.isBottle && row.countUsed <= 0).map((row: any) => `Indiquez un nombre de bouteilles ou magnums pour ${row.source.code}.`),
    ...selectedSourceRows.filter((row: any) => !row.isBottle && row.volumeHl <= 0).map((row: any) => `Indiquez un volume en hL pour ${row.source.code}.`),
    ...((assemblageType !== "ROSE_D_ASSEMBLAGE")
      ? selectedSourceRows
          .filter((row: any) => row.sourceRole === "ROSE")
          .map((row: any) => `${row.source.code} est un VIN_ROUGE et ne peut être utilisé que pour un Rosé d'assemblage.`)
      : []),
    ...(totalVolumeHl <= 0 ? ["Le volume final doit être supérieur à 0 hL."] : []),
    ...(!destinationContainerId ? ["Choisissez une cuve de destination."] : []),
    ...(selectedDestination?.disabledReason ? [`La cuve sélectionnée est invalide: ${selectedDestination.disabledReason}.`] : []),
    ...adjuvantRows
      .filter((row: any) => row.productId)
      .flatMap((row: any) => {
        const issues = [];
        if (!row.product) issues.push(`Produit intrant introuvable pour la ligne ${row.index + 1}.`);
        if (!row.dose || row.quantityTotal <= 0) issues.push(`Dose ou quantité totale invalide pour ${row.product?.name || `l'intrant ${row.index + 1}`}.`);
        if (row.stockShortage) issues.push(`Stock insuffisant pour ${row.product?.name}.`);
        return issues;
      }),
  ];

  const submitAssemblage = async () => {
    if (assemblageSubmitLockRef.current || isCreatingAssemblage) {
      return;
    }

    if (validationErrors.length > 0) {
      alert(validationErrors[0]);
      return;
    }

    assemblageSubmitLockRef.current = true;
    setIsCreatingAssemblage(true);

    try {
      const payload = {
        code: proposedCode,
        assemblageType,
        millesime: finalMillesime,
        cepage: primaryGrape,
        volume: totalVolumeHl,
        components: selectedSourceRows
          .filter((row: any) => row.volumeHl > 0)
          .map((row: any) => row.isBottle
            ? {
                sourceType: "BOTTLE_LOT",
                bottleLotId: parseInt(row.source.id, 10),
                volumeHl: row.volumeHl,
                originUnit: row.source.formatCode,
                originQuantity: row.countUsed,
                formatCode: row.source.formatCode,
                sourceRole: row.sourceRole,
              }
            : {
                sourceType: "LOT",
                lotId: parseInt(row.source.id, 10),
                volumeHl: row.volumeHl,
                originUnit: "hL",
                originQuantity: row.volumeHl,
                sourceRole: row.sourceRole,
              }),
        containerDestinationId: parseInt(destinationContainerId, 10),
        adjuvants: adjuvantRows
          .filter((row: any) => row.productId)
          .map((row: any) => ({
            productId: parseInt(row.productId, 10),
            dose: parseFloat(row.dose),
            doseUnit: row.doseUnit,
            treatedVolumeHl: row.treatedVolumeHl,
            quantityTotal: Number(row.quantityTotal.toFixed(4)),
            quantityUnit: row.quantityUnit,
          })),
        notes,
        compoDetails,
        idempotencyKey,
      };

      const response = await fetch("/api/assemblages", {
        method: "POST",
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload),
      });
      const apiPayload = await response.json().catch(() => ({}));
      if (response.status !== 201) {
        throw new Error(extractApiErrorMessage(apiPayload, "Erreur lors de l'enregistrement de l'assemblage."));
      }

      dispatch({
        type:"TOAST_ADD",
        payload:{ msg:`Assemblage ${proposedCode} enregistré en base.`, color:"#2d6640" },
      });
      resetForm();
      setShowCreateModal(false);
      if (refreshData) await refreshData();
    } catch (error: any) {
      alert(error?.message || "Erreur lors de l'enregistrement de l'assemblage.");
    } finally {
      assemblageSubmitLockRef.current = false;
      setIsCreatingAssemblage(false);
    }
  };

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end", marginBottom:28, gap:16 }}>
        <div>
          <h1 style={{ fontFamily:"'Playfair Display', Georgia, serif", fontSize:32, color:T.textStrong, margin:0 }}>Assemblages</h1>
          <div style={{ marginTop:8, fontSize:13, color:T.textDim, maxWidth:840 }}>
            Le module est désormais raccordé aux lots, réserves bouteilles, cuves de destination et intrants. Les règles de décision sont recalculées en direct avant l'enregistrement.
          </div>
          <div style={{ marginTop:6, fontSize:12, color:T.textDim }}>
            Sources principales : vins de base et vins déjà assemblés. Les réserves et vins rouges restent disponibles dans des sections dédiées.
          </div>
        </div>
        <Btn onClick={() => setShowCreateModal(true)} disabled={sourceCandidates.length === 0}>Créer un assemblage</Btn>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:16, marginBottom:16 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:18 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.textDim, letterSpacing:1, marginBottom:12 }}>Sources exploitables</div>
          <div style={{ fontSize:30, color:T.textStrong, fontFamily:"Georgia, serif" }}>{sourceCandidates.length}</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:8 }}>{availableBulkCount} lots vrac, {availableReserveBottleCount} lots bouteille de réserve.</div>
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:18 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.textDim, letterSpacing:1, marginBottom:12 }}>Réserve et rosé</div>
          <div style={{ fontSize:30, color:T.textStrong, fontFamily:"Georgia, serif" }}>{reserveSourceCount}</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:8 }}>{redSourceCount} source rouge disponible(s) pour un rosé d'assemblage.</div>
        </div>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:18 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.textDim, letterSpacing:1, marginBottom:12 }}>Cuves destination</div>
          <div style={{ fontSize:30, color:T.textStrong, fontFamily:"Georgia, serif" }}>{destinationCandidates.filter((container: any) => !container.disabledReason).length}</div>
          <div style={{ fontSize:12, color:T.textDim, marginTop:8 }}>Compatibles et vides pour accueillir un nouvel assemblage.</div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.3fr 1fr", gap:16 }}>
        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, overflow:"hidden" }}>
          <div style={{ padding:"14px 16px", borderBottom:`1px solid ${T.border}`, fontSize:11, textTransform:"uppercase", color:T.textDim, letterSpacing:1 }}>Lots disponibles par famille</div>
          {sourceCandidates.length === 0 ? (
            <div style={{ padding:"36px 20px", textAlign:"center", color:T.textDim }}>Aucune source n'est actuellement exploitable pour un assemblage.</div>
          ) : (
            <div style={{ display:"grid", gap:16, padding:16 }}>
              {sourceSections.map((section) => (
                <div key={section.key} style={{ border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden" }}>
                  <div style={{ padding:"12px 14px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                    <div>
                      <div style={{ fontSize:12, color:T.textStrong, fontWeight:700 }}>{section.title}</div>
                      <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>{section.helper}</div>
                    </div>
                    <Badge label={String(section.items.length)} color={T.accent} />
                  </div>
                  {section.items.length === 0 ? (
                    <div style={{ padding:"14px", fontSize:12, color:T.textDim }}>Aucune source dans cette section.</div>
                  ) : (
                    <div>
                      {section.items.slice(0, 4).map((source: any, index: number) => (
                        <div key={buildSourceKey(source)} style={{ display:"grid", gridTemplateColumns:"1.5fr 90px 90px 1fr 1fr 100px", gap:10, padding:"12px 14px", borderTop:index === 0 ? "none" : `1px solid ${T.border}`, alignItems:"center" }}>
                          <div>
                            <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:700 }}>{source.code}</div>
                            {source._type === "bottle" && <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>{source.formatLabel} - conversion {BOTTLE_FORMAT_TO_HL[source.formatCode] || 0} hL / unité</div>}
                          </div>
                          <div style={{ fontSize:12, color:T.text }}>{source.cepage || source.mainGrapeCode || source.sourceLot?.mainGrapeCode || "--"}</div>
                          <div style={{ fontSize:12, color:T.text }}>{source.millesime || source.year || "--"}</div>
                          <div style={{ fontSize:12, color:T.textStrong }}>{source._type === "bottle" ? `${source.availableVolumeHl.toFixed(3)} hL` : `${Number(source.availableVolumeHl).toFixed(2)} hL`}</div>
                          <div style={{ fontSize:12, color:T.text }}>{source.currentContainerLabel || "--"}</div>
                          <div><Badge label={source.status} color={LOT_STATUS_COLORS[source.status] || T.textDim} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:4, padding:18 }}>
          <div style={{ fontSize:11, textTransform:"uppercase", color:T.textDim, letterSpacing:1, marginBottom:14 }}>Règles de décision visibles</div>
          <div style={{ display:"grid", gap:10 }}>
            <div style={{ fontSize:12, color:T.text }}>100 % Chardonnay {"=>"} Blanc de blancs.</div>
            <div style={{ fontSize:12, color:T.text }}>100 % Pinot Noir et/ou Meunier {"=>"} Blanc de noirs.</div>
            <div style={{ fontSize:12, color:T.text }}>Un seul millésime sans réserve {"=>"} candidat millésimé.</div>
            <div style={{ fontSize:12, color:T.text }}>Plusieurs millésimes ou présence de réserve {"=>"} BSA / sans année.</div>
            <div style={{ fontSize:12, color:T.text }}>Présence de vin rouge {"=>"} rosé d'assemblage.</div>
          </div>
        </div>
      </div>

      {showCreateModal && (
        <Modal title="Créer un assemblage" onClose={() => { if (!isSubmitting) { setShowCreateModal(false); resetForm(); } }}>
          <div style={{ maxHeight:"78vh", overflowY:"auto", paddingRight:4 }}>
            <div style={{ display:"grid", gap:18 }}>
              <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>A. Type d'assemblage souhaité</div>
                <Select value={assemblageType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAssemblageType(e.target.value)} disabled={isSubmitting}>
                  {ASSEMBLAGE_TYPES.map((type) => (
                    <option key={type} value={type}>{assemblageLabels[type]}</option>
                  ))}
                </Select>
              </div>

              <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>B. Lots sources disponibles</div>
                <div style={{ display:"grid", gap:14, marginTop:12 }}>
                  {sourceSections.map((section) => (
                    <div key={`modal-${section.key}`} style={{ border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden" }}>
                      <div style={{ padding:"12px 14px", borderBottom:`1px solid ${T.border}`, background:T.surface, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
                        <div>
                          <div style={{ fontSize:12, color:T.textStrong, fontWeight:700 }}>{section.title}</div>
                          <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>{section.helper}</div>
                        </div>
                        <Badge label={String(section.items.length)} color={T.accent} />
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"48px 1.5fr 90px 90px 90px 1fr 120px 1.1fr", gap:10, fontSize:10, color:T.textDim, textTransform:"uppercase", letterSpacing:1, padding:"10px 14px", borderBottom:`1px solid ${T.border}` }}>
                        <div>Sélec.</div>
                        <div>Lot</div>
                        <div>Cépage</div>
                        <div>Millésime</div>
                        <div>Type</div>
                        <div>Volume dispo</div>
                        <div>Contenant</div>
                        <div>Analyse</div>
                      </div>
                      <div style={{ display:"grid", gap:0 }}>
                        {section.items.length === 0 ? (
                          <div style={{ padding:"14px", fontSize:12, color:T.textDim }}>Aucune source disponible dans cette section.</div>
                        ) : section.items.map((source: any) => {
                          const draft = readSourceDraft(source);
                          const latestAnalysis = source.analyses?.[0];
                          const isBottle = source._type === "bottle";

                          return (
                            <div key={buildSourceKey(source)} style={{ display:"grid", gridTemplateColumns:"48px 1.5fr 90px 90px 90px 1fr 120px 1.1fr", gap:10, alignItems:"center", padding:"12px 14px", borderBottom:`1px solid ${T.border}66` }}>
                              <div>
                                <input
                                  type="checkbox"
                                  checked={!!draft.selected}
                                  disabled={isSubmitting}
                                  onChange={() => setSourceDrafts((prev: any) => ({
                                    ...prev,
                                    [buildSourceKey(source)]: {
                                      ...readSourceDraft(source),
                                      selected: !draft.selected,
                                    },
                                  }))}
                                  style={{ accentColor: T.accent }}
                                />
                              </div>
                              <div>
                                <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:700 }}>{source.code}</div>
                                <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>
                                  {isBottle ? `${source.availableCount} unités ${source.formatLabel}` : source.qualiteLot || source.notes || source.sourceCategoryLabel}
                                </div>
                              </div>
                              <div style={{ fontSize:12, color:T.text }}>{source.cepage || source.mainGrapeCode || "--"}</div>
                              <div style={{ fontSize:12, color:T.text }}>{source.millesime || source.year || "--"}</div>
                              <div style={{ fontSize:12, color:T.text }}>{isBottle ? "Réserve btle" : source.sourceCategoryLabel}</div>
                              <div style={{ fontSize:12, color:T.textStrong }}>
                                {isBottle ? `${source.availableVolumeHl.toFixed(3)} hL` : `${Number(source.availableVolumeHl).toFixed(2)} hL`}
                              </div>
                              <div style={{ fontSize:12, color:T.text }}>{source.currentContainerLabel || "--"}</div>
                              <div style={{ fontSize:11, color:T.textDim, lineHeight:1.4 }}>
                                {latestAnalysis
                                  ? `alc. ${latestAnalysis.alcohol ?? "--"} | pH ${latestAnalysis.ph ?? "--"} | AT ${latestAnalysis.at ?? "--"}`
                                  : "Aucune analyse"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>C. Sélection des volumes</div>
                {selectedSources.length === 0 ? (
                  <div style={{ fontSize:12, color:T.textDim }}>Sélectionnez au moins une source dans la liste ci-dessus.</div>
                ) : (
                  <div style={{ display:"grid", gap:12 }}>
                    {selectedSourceRows.map((row: any) => (
                      <div key={buildSourceKey(row.source)} style={{ border:`1px solid ${row.isOverAvailable ? T.red : T.border}`, borderRadius:6, padding:12 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", gap:12, marginBottom:10 }}>
                          <div>
                            <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:700 }}>{row.source.code}</div>
                            <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>
                              Disponible: {row.isBottle ? `${row.source.availableCount} unités / ${row.availableVolumeHl.toFixed(3)} hL` : `${row.availableVolumeHl.toFixed(2)} hL`}
                            </div>
                          </div>
                          {row.isBottle && <Badge label={row.source.formatLabel} color={T.accentLight} />}
                        </div>

                        {row.isBottle ? (
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 140px", gap:12 }}>
                            <FF label="Quantité source">
                              <Input
                                type="number"
                                step="1"
                                min="0"
                                value={readSourceDraft(row.source).countUsed || ""}
                                disabled={isSubmitting}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSourceDraft(row.source, { countUsed: e.target.value })}
                                placeholder="Nombre de bouteilles / magnums"
                              />
                            </FF>
                            <FF label="Volume prélevé (hL)">
                              <Input value={row.volumeHl ? row.volumeHl.toFixed(4) : ""} disabled />
                            </FF>
                          </div>
                        ) : (
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 140px", gap:12 }}>
                            <FF label="Volume prélevé (hL)">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={readSourceDraft(row.source).volumeHl || ""}
                                disabled={isSubmitting}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSourceDraft(row.source, { volumeHl: e.target.value })}
                                placeholder="Volume à prélever"
                              />
                            </FF>
                            <FF label="Disponible">
                              <Input value={row.availableVolumeHl.toFixed(2)} disabled />
                            </FF>
                          </div>
                        )}

                        {row.isBottle && row.countUsed > 0 && (
                          <div style={{ fontSize:11, color:T.textDim, marginTop:8 }}>
                            Conversion: {row.countUsed} x {row.source.formatLabel} = {row.volumeHl.toFixed(4)} hL.
                          </div>
                        )}
                        {row.isOverAvailable && (
                          <div style={{ fontSize:11, color:T.red, marginTop:8 }}>
                            Le volume demandé dépasse le stock disponible.
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>D. Cuve destination</div>
                <FF label="Choisir une cuve d'assemblage">
                  <Select value={destinationContainerId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDestinationContainerId(e.target.value)} disabled={isSubmitting}>
                    <option value="">-- Choisir une cuve de réception --</option>
                    {destinationCandidates.map((container: any) => (
                      <option key={container.id} value={container.id} disabled={!!container.disabledReason}>
                        {(container.displayName || container.name)} - cap. {container.capacity} hL - libre {container.availableVolume.toFixed(2)} hL{container.disabledReason ? ` - ${container.disabledReason}` : ""}
                      </option>
                    ))}
                  </Select>
                </FF>
                <div style={{ display:"grid", gap:10, marginTop:12 }}>
                  {destinationCandidates.map((container: any) => (
                    <div key={`dest-${container.id}`} style={{ padding:"10px 12px", border:`1px solid ${String(container.id) === String(destinationContainerId) ? T.accent : T.border}`, borderRadius:4, background:String(container.id) === String(destinationContainerId) ? `${T.accent}11` : "transparent", opacity: container.disabledReason ? 0.65 : 1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
                        <div>
                          <div style={{ fontSize:12, color:T.textStrong }}>{container.displayName || container.name}</div>
                          <div style={{ fontSize:11, color:T.textDim, marginTop:4 }}>
                            Capacité {container.capacity} hL | Volume actuel {container.currentVolume.toFixed(2)} hL | Disponible {container.availableVolume.toFixed(2)} hL
                          </div>
                        </div>
                        <Badge label={container.status} color={container.disabledReason ? T.textDim : T.accent} />
                      </div>
                      {container.disabledReason && <div style={{ fontSize:11, color:T.red, marginTop:8 }}>{container.disabledReason}</div>}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, gap:12 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:T.textStrong }}>E. Adjuvants</div>
                  <Btn variant="secondary" onClick={() => setAdjuvants((prev: any[]) => [...prev, { productId:"", dose:"", doseUnit:"g/hL", treatedVolumeHl: totalVolumeHl ? totalVolumeHl.toFixed(2) : "", quantityUnit:"" }])} disabled={isSubmitting}>
                    Ajouter un adjuvant
                  </Btn>
                </div>
                {adjuvantRows.length === 0 ? (
                  <div style={{ fontSize:12, color:T.textDim }}>Aucun adjuvant prévu pour cet assemblage.</div>
                ) : (
                  <div style={{ display:"grid", gap:12 }}>
                    {adjuvantRows.map((row: any) => (
                      <div key={`adjuvant-${row.index}`} style={{ border:`1px solid ${row.stockShortage ? T.red : T.border}`, borderRadius:6, padding:12 }}>
                        <div style={{ display:"grid", gridTemplateColumns:"1.5fr 100px 110px 110px 130px 48px", gap:10, alignItems:"end" }}>
                          <FF label="Produit">
                            <Select
                              value={row.productId || ""}
                              disabled={isSubmitting}
                              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                const product = (state.products || []).find((candidate: any) => String(candidate.id) === e.target.value);
                                setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, productId: e.target.value, quantityUnit: product?.unit || "" } : candidate));
                              }}
                            >
                              <option value="">-- Produit œnologique --</option>
                              {(state.products || []).filter((product: any) => product.category === "Intrants").map((product: any) => (
                                <option key={product.id} value={product.id}>{product.name} ({Number(product.currentStock || 0).toFixed(2)} {product.unit})</option>
                              ))}
                            </Select>
                          </FF>
                          <FF label="Dose">
                            <Input type="number" step="0.01" value={row.dose || ""} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, dose: e.target.value } : candidate))} />
                          </FF>
                          <FF label="Unité dose">
                            <Select value={row.doseUnit || "g/hL"} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, doseUnit: e.target.value } : candidate))}>
                              {["g/hL", "kg/hL", "mL/hL", "L/hL"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                            </Select>
                          </FF>
                          <FF label="Volume traité">
                            <Input type="number" step="0.01" value={row.treatedVolumeHl || ""} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjuvants((prev: any[]) => prev.map((candidate, idx) => idx === row.index ? { ...candidate, treatedVolumeHl: e.target.value } : candidate))} />
                          </FF>
                          <FF label={`Qté totale (${row.quantityUnit || "--"})`}>
                            <Input value={row.quantityTotal ? row.quantityTotal.toFixed(4) : ""} disabled />
                          </FF>
                          <Btn variant="ghost" onClick={() => setAdjuvants((prev: any[]) => prev.filter((_, idx) => idx !== row.index))} disabled={isSubmitting} style={{ color:T.red, padding:"0 8px" }}>x</Btn>
                        </div>
                        {row.product && (
                          <div style={{ fontSize:11, color:row.stockShortage ? T.red : T.textDim, marginTop:8 }}>
                            Stock disponible: {row.stockAvailable.toFixed(2)} {row.product.unit}{row.stockShortage ? " - stock insuffisant" : ""}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ background:T.surfaceHigh, border:`1px solid ${T.border}`, borderRadius:6, padding:16 }}>
                <div style={{ fontSize:12, fontWeight:700, color:T.textStrong, marginBottom:12 }}>F. Résultat calculé</div>
                <div style={{ display:"grid", gridTemplateColumns:"160px 1fr", gap:18 }}>
                  <div>
                    <div style={{ fontSize:30, color:T.textStrong, fontFamily:"Georgia, serif" }}>{totalVolumeHl.toFixed(2)} hL</div>
                    <div style={{ fontSize:11, color:T.textDim, marginTop:6 }}>Volume final total</div>
                    <div style={{ fontSize:12, color:T.accent, fontFamily:"monospace", fontWeight:700, marginTop:14, wordBreak:"break-all" }}>{proposedCode}</div>
                  </div>
                  <div style={{ display:"grid", gap:10 }}>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <Badge label={`Demandé: ${assemblageLabels[assemblageType]}`} color={T.textDim} />
                      <Badge label={`Suggéré: ${assemblageLabels[decision.suggestedType]}`} color={T.accent} />
                      {decision.isBlancDeBlancs && <Badge label="Blanc de blancs" color="#e6c27a" />}
                      {decision.isBlancDeNoirs && <Badge label="Blanc de noirs" color="#8c7355" />}
                      {decision.isRoseCandidate && <Badge label="Rosé d'assemblage" color={T.red} />}
                      {decision.isMillesimeCandidate && vintageEntries.length === 1 && <Badge label={`Millésime ${vintageEntries[0][0]}`} color={T.blue} />}
                    </div>
                    <div style={{ fontSize:12, color:T.text }}>
                      <strong>Pourcentage par cépage:</strong> {compositionEntries.length > 0 ? compositionEntries.map(([grape, pct]: any) => `${grape} ${Number(pct).toFixed(2)} %`).join(" / ") : "--"}
                    </div>
                    <div style={{ fontSize:12, color:T.text }}>
                      <strong>Pourcentage par millésime:</strong> {vintageEntries.length > 0 ? vintageEntries.map(([year, pct]: any) => `${year} ${Number(pct).toFixed(2)} %`).join(" / ") : "--"}
                    </div>
                    <div style={{ fontSize:12, color:T.text }}>
                      <strong>Vin de réserve:</strong> {decision.reserveShare.toFixed(2)} % | <strong>Vin rouge:</strong> {decision.redWineShare.toFixed(2)} %
                    </div>
                    <FF label="Notes opérateur">
                      <Input value={notes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)} disabled={isSubmitting} placeholder="Commentaires, consignes cave, objectif du lot..." />
                    </FF>
                  </div>
                </div>

                {(decision.warnings.length > 0 || validationErrors.length > 0) && (
                  <div style={{ marginTop:14, padding:14, borderRadius:6, border:`1px solid ${T.red}44`, background:`${T.red}11` }}>
                    <div style={{ fontSize:11, textTransform:"uppercase", color:T.red, fontWeight:700, marginBottom:8 }}>Alertes métier</div>
                    {[...decision.warnings, ...validationErrors].map((warning: any, index: number) => (
                      <div key={`warning-${index}`} style={{ fontSize:12, color:T.text, lineHeight:1.5 }}>{warning}</div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:6 }}>
                <Btn variant="secondary" onClick={() => { if (!isCreatingAssemblage) { setShowCreateModal(false); resetForm(); } }} disabled={isCreatingAssemblage}>Annuler</Btn>
                <Btn onClick={submitAssemblage} disabled={isCreatingAssemblage || validationErrors.length > 0}>
                  {isCreatingAssemblage ? "Enregistrement en cours..." : "Enregistrer l'assemblage"}
                </Btn>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
