"use client";
// @ts-nocheck

import React, { useEffect, useState } from "react";
import { Btn, FF, Input, Select } from "@/components/ui";
import { useAuth, useStore, useTheme } from "@/lib/store";
import { buildApiHeaders, buildTirageStockItems, extractApiErrorMessage, getLotCode, toSafeNumber } from "@/lib/client-app-helpers";
import {
  calculateAdjuvantQuantity,
  calculateBottleCount,
  calculateLevainVolume,
  calculateMixtionVolumes,
  calculateSugarDose,
  calculateTiragePlan,
  calculateYeastQuantity,
  isTirageEligibleLotStatus,
  normalizeTirageBouchage,
} from "@/lib/tirage";
import { getBottleFormatLabel } from "@/lib/assemblage";

export function PlanificateurTirage() {
  const T = useTheme();
  const { user } = useAuth();
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

  useEffect(() => {
    const products = state.products || [];
    if (products.length === 0) return;

    const findStock = (predicate: (product: any) => boolean) => {
      const product = products.find(predicate);
      return product ? toSafeNumber(product.currentStock) : 0;
    };

    setTirageStocks({
      bouteilles: findStock((product: any) => product.subCategory === "Bouteilles" && (product.name || "").includes("75cl")),
      magnums: findStock((product: any) => product.subCategory === "Bouteilles" && (product.name || "").includes("150cl")),
      bidules: findStock((product: any) => product.subCategory === "Bidules"),
      capsules: findStock((product: any) => product.subCategory === "Capsules"),
      bouchonsLiege: findStock((product: any) => product.subCategory === "Bouchons"),
      agrafes: findStock((product: any) => product.subCategory === "Agrafes"),
    });
  }, [state.products]);

  useEffect(() => {
    const products = state.products || [];
    if (products.length === 0) return;

    const sugarProduct = products.find((product: any) => product.subCategory === "Sucres");
    const yeastProduct = products.find((product: any) => product.subCategory === "Levures" && (product.name || "").toLowerCase().includes("prise de mousse"))
      || products.find((product: any) => product.subCategory === "Levures");
    const adjuvantProduct = products.find((product: any) => product.subCategory === "Adjuvants");

    setPlanningForm((prev) => ({
      ...prev,
      sugarProductId: prev.sugarProductId || (sugarProduct ? String(sugarProduct.id) : ""),
      yeastProductId: prev.yeastProductId || (yeastProduct ? String(yeastProduct.id) : ""),
      adjuvantProductId: prev.adjuvantProductId || (adjuvantProduct ? String(adjuvantProduct.id) : ""),
    }));
  }, [state.products]);

  const [config, setConfig] = useState({
    mixTargetPressure: 6.0, mixLevainPct: 3.0, mixLevainSugar: 20,
    mixSugarSource: "LIQUEUR", mixLiqueurSugar: 530,
    tirageFormat: 0.75, tirageBouchage: "CAPSULE",
    levainTemp: 16,
    alimVolLevain: 18.6, alimVolFinal: 23.8,
    alimDensiteVeille: 1005, alimDensiteMatin: 998, alimLiqueurG: 530, alimAlcVin: 11.0
  });

  const updateConfig = (key: any, value: any) => { setConfig(prev => ({ ...prev, [key]: value })); };

  // --- ÉTATS VOLATILES (Sélections actuelles de cuves) ---
  const [mixBaseTankId, setMixBaseTankId] = useState("");
  const [mixLevainTankId, setMixLevainTankId] = useState("");
  const [mixDestTankId, setMixDestTankId] = useState("");
  const [mixVolVinSaisi, setMixVolVinSaisi] = useState("");

  const [createLevainSourceId, setCreateLevainSourceId] = useState("");
  const [alimSourceTankId, setAlimSourceTankId] = useState("");
  const [alimLevainTankId, setAlimLevainTankId] = useState("");
  const [planningForm, setPlanningForm] = useState({
    sourceContainerId: "",
    requestedVolumeHl: "1",
    format: "75cl",
    bouchage: "CAPSULE",
    pressureTargetBars: "6",
    wineTemperatureC: "",
    residualSugarGPerL: "",
    note: "",
    includeSugar: true,
    sugarProductId: "",
    includeYeast: false,
    yeastProductId: "",
    yeastDose: "10",
    yeastDoseUnit: "g/hL",
    includeAdjuvant: false,
    adjuvantProductId: "",
    adjuvantDose: "10",
    adjuvantDoseUnit: "mL/hL",
  });
  const [planningLastSuccess, setPlanningLastSuccess] = useState<any | null>(null);
  const [planningLastError, setPlanningLastError] = useState<string | null>(null);

  useEffect(() => {
    setPlanningLastError(null);
  }, [
    planningForm.sourceContainerId,
    planningForm.requestedVolumeHl,
    planningForm.format,
    planningForm.bouchage,
    planningForm.pressureTargetBars,
    planningForm.sugarProductId,
    planningForm.yeastProductId,
    planningForm.yeastDose,
    planningForm.adjuvantProductId,
    planningForm.adjuvantDose,
  ]);

  // ===========================================================================
  // FILTRAGE DES CUVES
  // ===========================================================================
  const getContainerLot = (c: any) =>
    state.lots?.find((l: any) =>
      String(l.id) === String(c.lotId || c.currentLots?.[0]?.id || c.currentContainerId),
    );

  const cuvesVinBase = (state.containers || []).filter((c: any) => {
    if (parseFloat(c.currentVolume) <= 0) return false;
    const t = (c.type || "").toUpperCase();
    const n = (c.displayName || c.name || "").toUpperCase();
    if (t.includes("BOURBE") || t.includes("LIE") || t.includes("REBECHE")) return false;
    if (n.includes("BOURBE") || n.includes("LIE") || n.includes("REBECHE")) return false;
    const lot = getContainerLot(c);
    if (!lot) return false;
    if (!isTirageEligibleLotStatus(lot.status)) return false;
    return true;
  });

  const cuvesTirage = (state.containers || []).filter((c: any) => {
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

  const cuvesLevain = (state.containers || []).filter((c: any) => {
    const t = (c.type || "").toUpperCase();
    const n = (c.displayName || c.name || "").toUpperCase();
    return t.includes("LEVAIN") || n.includes("LEVAIN");
  });

  // ===========================================================================
  // CALCULS : MIXTION (PRÉVISUALISATION FRONTEND)
  // ===========================================================================
  const selectedBaseTank = cuvesVinBase.find((c: any) => String(c.id) === String(mixBaseTankId));
  const baseVol = mixVolVinSaisi !== "" ? parseFloat(mixVolVinSaisi) : (selectedBaseTank ? parseFloat(selectedBaseTank.currentVolume) : 0);

  const calcMixtionPreview = () => {
    if (!baseVol || baseVol <= 0) return null;
    const mixResult = calculateMixtionVolumes({
      baseVolumeHl: baseVol,
      targetPressureBars: parseFloat(String(config.mixTargetPressure)),
      levainPct: parseFloat(String(config.mixLevainPct)),
      levainSugarGPerL: parseFloat(String(config.mixLevainSugar)),
      sugarSource: (config.mixSugarSource === "LIQUEUR" ? "LIQUEUR" : "SUCRE") as "LIQUEUR" | "SUCRE",
      liqueurSugarGPerL: parseFloat(String(config.mixLiqueurSugar)),
    });

    if ('error' in mixResult) return { error: mixResult.error };

    const nbCols = calculateBottleCount(mixResult.volMixtion, config.tirageFormat === 0.75 ? "75cl" : "150cl");

    return {
      volVin: baseVol.toFixed(2), volLevain: mixResult.volLevain.toFixed(2),
      volLiqueur: mixResult.volLiqueur > 0 ? mixResult.volLiqueur.toFixed(3) : null,
      poidsSucre: mixResult.poidsSucre > 0 ? mixResult.poidsSucre.toFixed(1) : null,
      volMixtion: mixResult.volMixtion.toFixed(2), deltaRho: mixResult.deltaRho.toFixed(1),
      targetSugar: mixResult.targetSugarGF.toFixed(1), nbCols
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

    const cascadeResult: any[] = [];
    let volNextDayLevain = 0; 
    
    let cBtls = config.tirageFormat === 0.75 ? tirageStocks.bouteilles : tirageStocks.magnums;
    let cF1 = config.tirageBouchage === "CAPSULE" ? tirageStocks.bidules : tirageStocks.bouchonsLiege;
    let cF2 = config.tirageBouchage === "CAPSULE" ? tirageStocks.capsules : tirageStocks.agrafes;

    const levainNeeds = [...tirageDays].reverse().map((day: any, index: number) => {
      const vVin = parseFloat(String(day.vinBaseVolume)) || 0;
      const besoinLevain = vVin * (config.mixLevainPct / 100);
      let volToFeed = index === 0 ? 0 : volNextDayLevain * taux; 
      let totalLevainCuveMatin = volToFeed + besoinLevain;
      let alimentation = index === 0 ? 0 : volNextDayLevain - volToFeed;
      volNextDayLevain = totalLevainCuveMatin; 
      return { ...day, besoinLevain, totalLevainCuveMatin, resteCuve: volToFeed, alimentation };
    }).reverse(); 

    levainNeeds.forEach((day: any) => {
      const vVin = parseFloat(String(day.vinBaseVolume)) || 0;
      const vLevain = day.besoinLevain;
      let volMixtion = 0;
      
      if (vVin > 0) {
        const mixResult = calculateMixtionVolumes({
          baseVolumeHl: vVin,
          targetPressureBars: parseFloat(String(config.mixTargetPressure)),
          levainPct: parseFloat(String(config.mixLevainPct)),
          levainSugarGPerL: parseFloat(String(config.mixLevainSugar)),
          sugarSource: (config.mixSugarSource === "LIQUEUR" ? "LIQUEUR" : "SUCRE") as "LIQUEUR" | "SUCRE",
          liqueurSugarGPerL: parseFloat(String(config.mixLiqueurSugar)),
        });
        if (!('error' in mixResult)) {
          volMixtion = mixResult.volMixtion;
        }
      }

      const nbColsTires = calculateBottleCount(volMixtion, config.tirageFormat === 0.75 ? "75cl" : "150cl");
      cBtls -= nbColsTires; cF1 -= nbColsTires; cF2 -= nbColsTires;

      cascadeResult.push({
        ...day, volMixtion, nbColsTires, stockBouteilles: cBtls, stockF1: cF1, stockF2: cF2
      });
    });

    return cascadeResult;
  };
  const cascade = calcWeeklyPlanning();
  const maxLevainVol = cascade.length > 0 ? Math.max(...cascade.map(r => r.totalLevainCuveMatin)) : 0;

  const tiragePlanningProducts = state.products || [];
  const sugarProducts = tiragePlanningProducts.filter((product: any) => product.subCategory === "Sucres");
  const yeastProducts = tiragePlanningProducts.filter((product: any) => product.subCategory === "Levures");
  const adjuvantProducts = tiragePlanningProducts.filter((product: any) => product.subCategory === "Adjuvants");
  const levainStockProduct = tiragePlanningProducts.find((product: any) => (product.name || "").toLowerCase().includes("levain")) || null;

  const planningSourceContainer = cuvesVinBase.find((container: any) => String(container.id) === String(planningForm.sourceContainerId));
  const planningSourceLot = planningSourceContainer ? getContainerLot(planningSourceContainer) : null;
  const planningSourceLotCode = planningSourceLot ? getLotCode(planningSourceLot) : "";
  const planningSourceLotAnalyses = planningSourceLot
    ? (state.analyses || [])
        .filter((analysis: any) => String(analysis.lotId) === String(planningSourceLot.id))
        .sort((a: any, b: any) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime())
    : [];
  const planningLatestAnalysis = planningSourceLotAnalyses[0] || null;
  const planningAnalysisResidualSugar = planningLatestAnalysis?.extraData?.sucresResiduel != null
    ? toSafeNumber(planningLatestAnalysis.extraData.sucresResiduel)
    : null;

  const planningRequestedVolumeHl = toSafeNumber(planningForm.requestedVolumeHl);
  const planningAvailableVolumeHl = planningSourceLot ? toSafeNumber(planningSourceLot.currentVolume ?? planningSourceLot.volume) : 0;
  const planningPressureTargetBars = planningForm.pressureTargetBars === "" ? 0 : toSafeNumber(planningForm.pressureTargetBars);
  const planningWineTemperatureC = planningForm.wineTemperatureC === "" ? null : toSafeNumber(planningForm.wineTemperatureC);
  const planningResidualSugarGPerL = planningForm.residualSugarGPerL !== ""
    ? toSafeNumber(planningForm.residualSugarGPerL)
    : planningAnalysisResidualSugar;
  const planningPlanPreview = calculateTiragePlan({
    requestedVolumeHl: planningRequestedVolumeHl,
    formatCode: planningForm.format,
  });
  const planningBottleCount = planningPlanPreview.bottleCount;
  const planningPackagingStock = buildTirageStockItems(
    tiragePlanningProducts,
    planningForm.format,
    planningForm.bouchage,
    planningBottleCount,
  );
  const planningSugarProduct = sugarProducts.find((product: any) => String(product.id) === String(planningForm.sugarProductId)) || null;
  const planningYeastProduct = yeastProducts.find((product: any) => String(product.id) === String(planningForm.yeastProductId)) || null;
  const planningAdjuvantProduct = adjuvantProducts.find((product: any) => String(product.id) === String(planningForm.adjuvantProductId)) || null;
  const planningLevainPct = toSafeNumber(config.mixLevainPct);
  const planningLevainVolumeHl = calculateLevainVolume(planningRequestedVolumeHl, planningLevainPct);
  const planningSugarCalculation =
    planningForm.includeSugar && planningSugarProduct && planningPressureTargetBars > 0
      ? calculateSugarDose({
          volumeHl: planningRequestedVolumeHl,
          targetPressureBars: planningPressureTargetBars,
          residualSugarGPerL: planningResidualSugarGPerL ?? 0,
          quantityUnit: planningSugarProduct.unit,
        })
      : null;
  const planningYeastDose = toSafeNumber(planningForm.yeastDose);
  const planningYeastQuantity =
    planningForm.includeYeast && planningYeastProduct && planningYeastDose > 0
      ? calculateYeastQuantity({
          treatedVolumeHl: planningRequestedVolumeHl,
          dose: planningYeastDose,
          doseUnit: planningForm.yeastDoseUnit,
          quantityUnit: planningYeastProduct.unit,
        })
      : 0;
  const planningAdjuvantDose = toSafeNumber(planningForm.adjuvantDose);
  const planningAdjuvantQuantity =
    planningForm.includeAdjuvant && planningAdjuvantProduct && planningAdjuvantDose > 0
      ? calculateAdjuvantQuantity({
          treatedVolumeHl: planningRequestedVolumeHl,
          dose: planningAdjuvantDose,
          doseUnit: planningForm.adjuvantDoseUnit,
          quantityUnit: planningAdjuvantProduct.unit,
        })
      : 0;

  const planningCalculatedItems = [
    planningPackagingStock.bottleProduct && planningBottleCount > 0
      ? {
          kind: "PACKAGING_BOTTLE",
          productId: planningPackagingStock.bottleProduct.id,
          quantity: planningBottleCount,
          unit: planningPackagingStock.bottleProduct.unit,
          label: `Bouteilles ${planningForm.format}`,
          treatedVolumeHl: planningRequestedVolumeHl,
          consumeStock: true,
        }
      : null,
    planningPackagingStock.primaryClosureProduct && planningBottleCount > 0
      ? {
          kind: "PACKAGING_PRIMARY_CLOSURE",
          productId: planningPackagingStock.primaryClosureProduct.id,
          quantity: planningBottleCount,
          unit: planningPackagingStock.primaryClosureProduct.unit,
          label: planningForm.bouchage === "CAPSULE" ? "Capsules tirage" : "Bouchons liege tirage",
          treatedVolumeHl: planningRequestedVolumeHl,
          consumeStock: true,
        }
      : null,
    planningPackagingStock.secondaryClosureProduct && planningBottleCount > 0
      ? {
          kind: "PACKAGING_SECONDARY_CLOSURE",
          productId: planningPackagingStock.secondaryClosureProduct.id,
          quantity: planningBottleCount,
          unit: planningPackagingStock.secondaryClosureProduct.unit,
          label: planningForm.bouchage === "CAPSULE" ? "Bidules" : "Agrafes tirage",
          treatedVolumeHl: planningRequestedVolumeHl,
          consumeStock: true,
        }
      : null,
    planningSugarCalculation && planningSugarProduct && planningSugarCalculation.quantityTotal > 0
      ? {
          kind: "SUGAR",
          productId: planningSugarProduct.id,
          quantity: planningSugarCalculation.quantityTotal,
          unit: planningSugarProduct.unit,
          label: planningSugarProduct.name,
          dose: planningSugarCalculation.additionDoseGPerL,
          doseUnit: "g/L",
          treatedVolumeHl: planningRequestedVolumeHl,
          consumeStock: true,
        }
      : null,
    planningForm.includeYeast && planningYeastProduct && planningYeastQuantity > 0
      ? {
          kind: "YEAST",
          productId: planningYeastProduct.id,
          quantity: planningYeastQuantity,
          unit: planningYeastProduct.unit,
          label: planningYeastProduct.name,
          dose: planningYeastDose,
          doseUnit: planningForm.yeastDoseUnit,
          treatedVolumeHl: planningRequestedVolumeHl,
          consumeStock: true,
        }
      : null,
    planningForm.includeAdjuvant && planningAdjuvantProduct && planningAdjuvantQuantity > 0
      ? {
          kind: "ADJUVANT",
          productId: planningAdjuvantProduct.id,
          quantity: planningAdjuvantQuantity,
          unit: planningAdjuvantProduct.unit,
          label: planningAdjuvantProduct.name,
          dose: planningAdjuvantDose,
          doseUnit: planningForm.adjuvantDoseUnit,
          treatedVolumeHl: planningRequestedVolumeHl,
          consumeStock: true,
        }
      : null,
    planningRequestedVolumeHl > 0 && planningLevainPct > 0
      ? {
          kind: "LEVAIN",
          quantity: planningLevainVolumeHl,
          unit: "hL",
          label: levainStockProduct ? levainStockProduct.name : "Levain de process",
          dose: planningLevainPct,
          doseUnit: "%",
          treatedVolumeHl: planningRequestedVolumeHl,
          consumeStock: false,
          note: levainStockProduct
            ? "TODO métier: produit levain détecté mais non branché au stock de tirage."
            : "Levain calculé mais non consommé faute de produit stock dédié.",
        }
      : null,
  ].filter(Boolean);

  const planningStockItems = planningCalculatedItems
    .filter((item: any) => item.consumeStock !== false && item.productId)
    .map((item: any) => ({
      productId: item.productId,
      kind: item.kind,
      quantity: item.quantity,
      unit: item.unit,
      label: item.label,
      dose: item.dose ?? null,
      doseUnit: item.doseUnit ?? null,
      treatedVolumeHl: item.treatedVolumeHl ?? null,
    }));

  const planningStockShortages = planningStockItems
    .map((item: any) => {
      const product = tiragePlanningProducts.find((candidate: any) => String(candidate.id) === String(item.productId));
      const available = product ? toSafeNumber(product.currentStock) : 0;
      return {
        ...item,
        product,
        available,
        missingQuantity: Math.max(0, item.quantity - available),
        isShortage: available + 0.0001 < item.quantity,
      };
    })
    .filter((item: any) => item.isShortage);

  const planningIssues = [
    !planningForm.sourceContainerId ? "Sélectionnez une cuve source pour préparer le tirage." : null,
    planningSourceLot == null ? "La cuve sélectionnée ne contient aucun lot éligible au tirage." : null,
    planningSourceLot && !isTirageEligibleLotStatus(planningSourceLot.status)
      ? `Ce lot n'est pas éligible au tirage. Statut actuel : ${planningSourceLot.status}.`
      : null,
    planningRequestedVolumeHl <= 0 ? "Saisissez un volume à tirer strictement positif." : null,
    planningSourceLot && planningRequestedVolumeHl > planningAvailableVolumeHl
      ? `Le volume demandé dépasse le disponible du lot (${planningAvailableVolumeHl.toFixed(3)} hL).`
      : null,
    !planningForm.format ? "Sélectionnez un format bouteille valide." : null,
    planningBottleCount <= 0 ? "Le volume saisi ne permet pas de produire de bouteilles avec ce format." : null,
    planningPackagingStock.missing.length > 0
      ? `Produits d'emballage introuvables: ${planningPackagingStock.missing.join(", ")}.`
      : null,
    planningForm.includeSugar && !planningSugarProduct ? "Sélectionnez un produit sucre de tirage." : null,
    planningForm.includeSugar && planningPressureTargetBars <= 0 ? "La pression cible est requise pour calculer le sucre de tirage." : null,
    planningForm.includeYeast && !planningYeastProduct ? "Sélectionnez une levure de prise de mousse." : null,
    planningForm.includeYeast && planningYeastDose <= 0 ? "Saisissez une dose levure valide." : null,
    planningForm.includeAdjuvant && !planningAdjuvantProduct ? "Sélectionnez un adjuvant de remuage." : null,
    planningForm.includeAdjuvant && planningAdjuvantDose <= 0 ? "Saisissez une dose adjuvant valide." : null,
    planningStockShortages.length > 0 ? "Les stocks disponibles sont insuffisants pour au moins un intrant du tirage." : null,
  ].filter((issue): issue is string => Boolean(issue));
  const planningPrimaryIssue = planningIssues[0] || null;
  const planningIsReady =
    !isSubmitting &&
    planningIssues.length === 0 &&
    planningSourceLot != null &&
    planningSourceContainer != null &&
    planningBottleCount > 0;

  const handleCreateTirageFromPlanning = async () => {
    if (planningIssues.length > 0 || !planningSourceLot || !planningSourceContainer) {
      setPlanningLastError(planningIssues[0] || "La planification n'est pas encore prête pour un tirage réel.");
      dispatch({ type: "TOAST_ADD", payload: { msg: planningIssues[0] || "La planification n'est pas encore prête pour un tirage réel.", color: T.red } });
      return;
    }

    setIsSubmitting(true);
    setPlanningLastSuccess(null);
    setPlanningLastError(null);

    try {
      const payload = {
        lotId: planningSourceLot.id,
        sourceContainerId: planningSourceContainer.id,
        format: planningForm.format,
        count: planningBottleCount,
        volume: planningRequestedVolumeHl,
        bouchage: planningForm.bouchage,
        zone: planningSourceContainer.zone || null,
        tirageDate: new Date().toISOString(),
        note: planningForm.note?.trim() || `Créé depuis la planification tirage (${planningSourceLotCode})`,
        isTranquille: false,
        pressureTargetBars: planningPressureTargetBars || null,
        wineTemperatureC: planningWineTemperatureC,
        residualSugarGPerL: planningResidualSugarGPerL,
        stockItems: planningStockItems,
        calculatedItems: planningCalculatedItems,
        planningMeta: {
          source: "PLANNING",
          requestedVolumeHl: planningRequestedVolumeHl,
          theoreticalConsumedVolumeHl: planningPlanPreview.consumedVolumeHl,
          theoreticalRemainderHl: planningPlanPreview.remainderVolumeHl,
          sourceLotCode: planningSourceLotCode,
        },
        idempotencyKey,
      };

      const res = await fetch('/api/tirage', {
        method: 'POST',
        headers: buildApiHeaders(user),
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(extractApiErrorMessage(data, "Erreur lors de la création du tirage depuis la planification."));
      }

      setPlanningLastSuccess({
        ...data,
        sourceLotCode: planningSourceLotCode,
        requestedVolumeHl: planningRequestedVolumeHl,
      });
      setPlanningLastError(null);
      dispatch({
        type: "TOAST_ADD",
        payload: { msg: `Tirage créé depuis la planification: ${data.bottleLotCode}`, color: T.green }
      });
      if (refreshData) await refreshData();
    } catch (error: any) {
      const message = error?.message || "Erreur lors de la création du tirage planifié.";
      setPlanningLastError(message);
      dispatch({
        type: "TOAST_ADD",
        payload: { msg: message, color: T.red }
      });
    } finally {
      setIsSubmitting(false);
      setIdempotencyKey(crypto.randomUUID());
    }
  };

  // ===========================================================================
  // CALCULS : ALIMENTATION (Page 3)
  // ===========================================================================
  const calcAlimentation = () => {
    const vLevain = parseFloat(String(config.alimVolLevain)) || 0;
    const vFinal = parseFloat(String(config.alimVolFinal)) || 0;
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
    
    const sourceTank = state.containers.find((c: any) => String(c.id) === String(createLevainSourceId));
    if (!sourceTank || parseFloat(sourceTank.currentVolume) < maxLevainVol) {
      dispatch({ type: "TOAST_ADD", payload: { msg: `Volume insuffisant dans la cuve source. Il vous faut au moins ${maxLevainVol.toFixed(1)} hL.`, color: T.red } });
      return;
    }

    setIsSubmitting(true);
    const suggestedCap = Math.ceil(maxLevainVol * 1.2);
    try {
      const res = await fetch('/api/containers', { 
        method: 'POST', 
        headers: buildApiHeaders(undefined),
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
        payload: state.containers.map((c: any) => c.id === sourceTank.id ? { ...c, currentVolume: newSourceVol } : c)
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

    const sourceTank = state.containers.find((c: any) => String(c.id) === String(alimSourceTankId));
    const levainTank = state.containers.find((c: any) => String(c.id) === String(alimLevainTankId));

    const vVinNeeded = parseFloat(resAlim.vVin);
    if (parseFloat(sourceTank.currentVolume) < vVinNeeded) {
      dispatch({ type: "TOAST_ADD", payload: { msg: `Volume insuffisant dans la cuve source. Il vous faut ${vVinNeeded.toFixed(2)} hL.`, color: T.red } });
      return;
    }

    // Ici on applique la mise à jour optimiste frontend (en attendant ton API d'alimentation dédiée)
    const newSourceVol = Math.max(0, parseFloat(sourceTank.currentVolume) - vVinNeeded);
    const newLevainVol = parseFloat(String(config.alimVolFinal));

    dispatch({
      type: "SET_CONTAINERS",
      payload: state.containers.map((c: any) => {
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
        targetPressure: parseFloat(String(config.mixTargetPressure)),
        levainPct: parseFloat(String(config.mixLevainPct)),
        levainSugar: parseFloat(String(config.mixLevainSugar)),
        sugarSource: config.mixSugarSource,
        liqueurSugar: parseFloat(String(config.mixLiqueurSugar)),
        tirageFormat: parseFloat(String(config.tirageFormat)),
        tirageBouchage: config.tirageBouchage,
        idempotencyKey: idempotencyKey || crypto.randomUUID()
      };

      const res = await fetch('/api/mixtion/execute', {
        method: 'POST',
        headers: buildApiHeaders(undefined),
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
                  <Select value={mixBaseTankId} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setMixBaseTankId(e.target.value);
                    if (e.target.value) {
                      const c = cuvesVinBase.find((x: any) => String(x.id) === String(e.target.value));
                      if (c) setMixVolVinSaisi(c.currentVolume);
                    } else { setMixVolVinSaisi(""); }
                  }}>
                    <option value="">-- Mode Libre (Manuelle) --</option>
                    {cuvesVinBase.map((c: any) => {
                      const lot = getContainerLot(c);
                      const codeDisplay = lot ? `[${lot.code}]` : "";
                      return <option key={c.id} value={c.id}>{c.displayName || c.name} {codeDisplay} - {parseFloat(c.currentVolume).toFixed(2)} hL</option>
                    })}
                  </Select>
                </FF>
                <FF label="Volume de vin à tirer (hL)">
                  <Input type="number" step="0.1" value={mixVolVinSaisi} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMixVolVinSaisi(e.target.value)} />
                </FF>
              </div>
              <FF label="Cuve de Levain (Mère)">
                <Select value={mixLevainTankId} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMixLevainTankId(e.target.value)} style={{ borderColor: !mixLevainTankId ? T.accent : T.border }}>
                  <option value="">-- Sélectionner le levain actif --</option>
                  {cuvesLevain.length === 0 && <option disabled>Aucune cuve à levain détectée en cuverie.</option>}
                  {cuvesLevain.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name} - {parseFloat(c.currentVolume).toFixed(2)} hL dispo</option>)}
                </Select>
              </FF>
            </div>

            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>2. Objectifs & Sucrage</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                <FF label="Pression visée (Bars)"><Input type="number" step="0.1" value={config.mixTargetPressure} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('mixTargetPressure', e.target.value)} /></FF>
                <FF label="% de Levain"><Input type="number" step="0.1" value={config.mixLevainPct} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('mixLevainPct', e.target.value)} /></FF>
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
                  <Input type="number" value={config.mixLiqueurSugar} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('mixLiqueurSugar', e.target.value)} />
                </FF>
              )}
            </div>

            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.accent}55` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.accentLight, marginBottom: 16 }}>3. Embouteillage</div>
              <FF label="Cuve de Destination (Mixtion & Tirage)" style={{ marginBottom: 16 }}>
                <Select value={mixDestTankId} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMixDestTankId(e.target.value)} style={{ borderColor: !mixDestTankId ? T.accent : T.border }}>
                  <option value="">-- Sélectionner une cuve de tirage vide --</option>
                  {cuvesTirage.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name}</option>)}
                </Select>
              </FF>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Format Bouteille">
                  <Select value={config.tirageFormat} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateConfig('tirageFormat', parseFloat(e.target.value))}>
                    <option value={0.75}>Champenoise (75 cl)</option>
                    <option value={1.5}>Magnum (1.5 L)</option>
                  </Select>
                </FF>
                <FF label="Type Bouchage">
                  <Select value={config.tirageBouchage} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateConfig('tirageBouchage', e.target.value)}>
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
                      <div style={{ fontSize: 22, color: T.textStrong, fontWeight: "bold", fontFamily: "monospace" }}>{(resMix.nbCols ?? 0).toLocaleString('fr-FR')}</div>
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
          <div style={{ background:T.accent+"11", border:`1px solid ${T.accent}33`, borderRadius:8, padding:"14px 18px" }}>
            <div style={{ fontSize:12, color:T.textStrong, fontWeight:"bold", marginBottom:4 }}>Planification tirage</div>
            <div style={{ fontSize:12, color:T.textDim, lineHeight:1.5 }}>
              Le planning hebdomadaire reste un simulateur de préparation, mais ce module permet désormais de créer un tirage réel vers le même backend sécurisé que le tirage direct depuis un lot.
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr", gap:24 }}>
            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20, display:"flex", flexDirection:"column", gap:16 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:"bold", color:T.textStrong, marginBottom:4 }}>Créer le tirage depuis cette planification</div>
                <div style={{ fontSize:12, color:T.textDim, lineHeight:1.5 }}>
                  Cette préparation appelle <code>/api/tirage</code> avec les mêmes règles d'éligibilité, de volume et de stock que le tirage direct.
                </div>
              </div>

              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
                <FF label="Cuve source">
                  <Select
                    value={planningForm.sourceContainerId}
                    disabled={isSubmitting}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const nextContainerId = e.target.value;
                      const nextContainer = cuvesVinBase.find((container: any) => String(container.id) === String(nextContainerId));
                      const nextLot = nextContainer ? getContainerLot(nextContainer) : null;
                      const nextAnalyses = nextLot
                        ? (state.analyses || [])
                            .filter((analysis: any) => String(analysis.lotId) === String(nextLot.id))
                            .sort((a: any, b: any) => new Date(b.analysisDate).getTime() - new Date(a.analysisDate).getTime())
                        : [];
                      const nextResidualSugar = nextAnalyses[0]?.extraData?.sucresResiduel;
                      setPlanningForm((prev) => ({
                        ...prev,
                        sourceContainerId: nextContainerId,
                        residualSugarGPerL:
                          nextResidualSugar != null && prev.residualSugarGPerL === ""
                            ? String(nextResidualSugar)
                            : prev.residualSugarGPerL,
                      }));
                    }}
                  >
                    <option value="">-- Sélectionner une cuve source --</option>
                    {cuvesVinBase.map((container: any) => {
                      const lot = getContainerLot(container);
                      return (
                        <option key={container.id} value={container.id}>
                          {(container.displayName || container.name)} · {lot ? getLotCode(lot) : "Lot introuvable"} · {parseFloat(container.currentVolume || lot?.currentVolume || 0).toFixed(1)} hL
                        </option>
                      );
                    })}
                  </Select>
                </FF>
                <FF label="Lot source détecté">
                  <Input value={planningSourceLotCode || "--"} disabled={true} />
                </FF>
                <FF label="Volume à tirer (hL)">
                  <Input type="number" step="0.1" value={planningForm.requestedVolumeHl} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanningForm((prev) => ({ ...prev, requestedVolumeHl: e.target.value }))} />
                </FF>
                <FF label="Volume disponible">
                  <Input value={planningSourceLot ? `${planningAvailableVolumeHl.toFixed(3)} hL` : "--"} disabled={true} />
                </FF>
                <FF label="Format bouteille">
                  <Select value={planningForm.format} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanningForm((prev) => ({ ...prev, format: e.target.value }))}>
                    {["37.5cl", "75cl", "150cl", "300cl"].map((format) => (
                      <option key={format} value={format}>{getBottleFormatLabel(format)}</option>
                    ))}
                  </Select>
                </FF>
                <FF label="Type de bouchage">
                  <Select value={planningForm.bouchage} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanningForm((prev) => ({ ...prev, bouchage: e.target.value }))}>
                    <option value="CAPSULE">Capsule + Bidule</option>
                    <option value="LIEGE">Liège + Agrafe</option>
                  </Select>
                </FF>
                <FF label="Pression cible (bar)">
                  <Input type="number" step="0.1" value={planningForm.pressureTargetBars} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanningForm((prev) => ({ ...prev, pressureTargetBars: e.target.value }))} />
                </FF>
                <FF label="Température vin (°C)">
                  <Input type="number" step="0.1" value={planningForm.wineTemperatureC} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanningForm((prev) => ({ ...prev, wineTemperatureC: e.target.value }))} placeholder="Optionnel" />
                </FF>
                <FF label="Sucres résiduels (g/L)">
                  <Input type="number" step="0.1" value={planningForm.residualSugarGPerL} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanningForm((prev) => ({ ...prev, residualSugarGPerL: e.target.value }))} placeholder={planningAnalysisResidualSugar != null ? `Analyse: ${planningAnalysisResidualSugar} g/L` : "Optionnel"} />
                </FF>
                <FF label="Note opérateur">
                  <Input value={planningForm.note} disabled={isSubmitting} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanningForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Ex: tirage préparé depuis le planning hebdo" />
                </FF>
              </div>

              <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:16, display:"flex", flexDirection:"column", gap:12 }}>
                <div style={{ fontSize:12, textTransform:"uppercase", letterSpacing:1, color:T.textDim, fontWeight:"bold" }}>Intrants calculés et confirmés</div>

                <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 140px", gap:12, alignItems:"center" }}>
                  <input type="checkbox" checked={planningForm.includeSugar} disabled={isSubmitting} onChange={(e) => setPlanningForm((prev) => ({ ...prev, includeSugar: e.target.checked }))} />
                  <Select value={planningForm.sugarProductId} disabled={isSubmitting || !planningForm.includeSugar} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanningForm((prev) => ({ ...prev, sugarProductId: e.target.value }))}>
                    <option value="">-- Sucre de tirage --</option>
                    {sugarProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name} ({toSafeNumber(product.currentStock).toFixed(3)} {product.unit})</option>)}
                  </Select>
                  <Input value={planningSugarCalculation ? `${planningSugarCalculation.quantityTotal.toFixed(3)} ${planningSugarProduct?.unit || ""}` : "--"} disabled={true} />
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"auto 1.2fr 110px 110px 120px", gap:12, alignItems:"center" }}>
                  <input type="checkbox" checked={planningForm.includeYeast} disabled={isSubmitting} onChange={(e) => setPlanningForm((prev) => ({ ...prev, includeYeast: e.target.checked }))} />
                  <Select value={planningForm.yeastProductId} disabled={isSubmitting || !planningForm.includeYeast} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanningForm((prev) => ({ ...prev, yeastProductId: e.target.value }))}>
                    <option value="">-- Levure prise de mousse --</option>
                    {yeastProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name} ({toSafeNumber(product.currentStock).toFixed(3)} {product.unit})</option>)}
                  </Select>
                  <Input type="number" step="0.1" value={planningForm.yeastDose} disabled={isSubmitting || !planningForm.includeYeast} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanningForm((prev) => ({ ...prev, yeastDose: e.target.value }))} />
                  <Select value={planningForm.yeastDoseUnit} disabled={isSubmitting || !planningForm.includeYeast} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanningForm((prev) => ({ ...prev, yeastDoseUnit: e.target.value }))}>
                    {["g/hL", "kg/hL", "mL/hL", "L/hL"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </Select>
                  <Input value={planningForm.includeYeast && planningYeastQuantity > 0 ? `${planningYeastQuantity.toFixed(3)} ${planningYeastProduct?.unit || ""}` : "--"} disabled={true} />
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"auto 1.2fr 110px 110px 120px", gap:12, alignItems:"center" }}>
                  <input type="checkbox" checked={planningForm.includeAdjuvant} disabled={isSubmitting} onChange={(e) => setPlanningForm((prev) => ({ ...prev, includeAdjuvant: e.target.checked }))} />
                  <Select value={planningForm.adjuvantProductId} disabled={isSubmitting || !planningForm.includeAdjuvant} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanningForm((prev) => ({ ...prev, adjuvantProductId: e.target.value }))}>
                    <option value="">-- Adjuvant de remuage --</option>
                    {adjuvantProducts.map((product: any) => <option key={product.id} value={product.id}>{product.name} ({toSafeNumber(product.currentStock).toFixed(3)} {product.unit})</option>)}
                  </Select>
                  <Input type="number" step="0.1" value={planningForm.adjuvantDose} disabled={isSubmitting || !planningForm.includeAdjuvant} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanningForm((prev) => ({ ...prev, adjuvantDose: e.target.value }))} />
                  <Select value={planningForm.adjuvantDoseUnit} disabled={isSubmitting || !planningForm.includeAdjuvant} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanningForm((prev) => ({ ...prev, adjuvantDoseUnit: e.target.value }))}>
                    {["mL/hL", "L/hL", "g/hL", "kg/hL"].map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </Select>
                  <Input value={planningForm.includeAdjuvant && planningAdjuvantQuantity > 0 ? `${planningAdjuvantQuantity.toFixed(3)} ${planningAdjuvantProduct?.unit || ""}` : "--"} disabled={true} />
                </div>

                <div style={{ fontSize:12, color:T.textDim, lineHeight:1.5 }}>
                  Levain calculé: <strong>{planningLevainVolumeHl.toFixed(3)} hL</strong> à {planningLevainPct.toFixed(1)} %.
                  {levainStockProduct
                    ? " Produit levain détecté mais non consommé automatiquement: TODO métier explicite à confirmer."
                    : " Aucun produit stock dédié n'est présent dans le seed: levain traité comme donnée de process non stockée."}
                </div>
              </div>
            </div>

            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20, display:"flex", flexDirection:"column", gap:16 }}>
              <div style={{ fontSize:14, fontWeight:"bold", color:T.textStrong }}>Synthèse du tirage préparé</div>
              <div style={{
                background: planningIsReady ? T.green+"11" : T.surfaceHigh,
                border: `1px solid ${planningIsReady ? T.green+"33" : planningPrimaryIssue ? T.red+"33" : T.border}`,
                borderRadius: 6,
                padding: 14,
              }}>
                <div style={{ fontSize:12, fontWeight:"bold", color: planningIsReady ? T.green : planningPrimaryIssue ? T.red : T.textStrong, marginBottom:6 }}>
                  {isSubmitting
                    ? "Création du tirage en cours"
                    : planningIsReady
                      ? "Planification prête pour un tirage réel"
                      : "Action en attente de validation"}
                </div>
                <div style={{ fontSize:12, color: planningPrimaryIssue ? T.red : T.textDim, lineHeight:1.5 }}>
                  {isSubmitting
                    ? "Le bouton reste verrouillé pendant l'enregistrement pour éviter tout double submit."
                    : planningIsReady
                      ? `${planningBottleCount.toLocaleString('fr-FR')} bouteilles seront créées et ${planningPlanPreview.consumedVolumeHl.toFixed(3)} hL seront consommés sur ${planningSourceLotCode}.`
                      : planningPrimaryIssue || "Complétez la planification pour activer la création du tirage."}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Cols calculés</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{planningBottleCount.toLocaleString('fr-FR')}</div></div>
                <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Volume réel consommé</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{planningPlanPreview.consumedVolumeHl.toFixed(3)} hL</div></div>
                <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Reliquat théorique</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{planningPlanPreview.remainderVolumeHl.toFixed(3)} hL</div></div>
                <div><div style={{ fontSize:10, color:T.textDim, textTransform:"uppercase" }}>Bouchage</div><div style={{ fontSize:20, fontFamily:"monospace", color:T.textStrong }}>{normalizeTirageBouchage(planningForm.bouchage)}</div></div>
              </div>

              <div style={{ border:`1px solid ${T.border}`, borderRadius:6, overflow:"hidden" }}>
                <div style={{ padding:"10px 14px", background:T.surfaceHigh, fontSize:11, color:T.textDim, textTransform:"uppercase", fontWeight:"bold" }}>Détail des intrants</div>
                <div style={{ display:"flex", flexDirection:"column" }}>
                  {planningCalculatedItems.length === 0 ? (
                    <div style={{ padding:14, fontSize:12, color:T.textDim }}>Aucun intrant calculé pour le moment.</div>
                  ) : (
                    planningCalculatedItems.map((item: any, index: number) => {
                      const product = item.productId ? tiragePlanningProducts.find((candidate: any) => String(candidate.id) === String(item.productId)) : null;
                      const available = product ? toSafeNumber(product.currentStock) : 0;
                      const isShortage = !!product && available + 0.0001 < item.quantity;
                      return (
                        <div key={`${item.kind}-${index}`} style={{ display:"grid", gridTemplateColumns:"1.4fr 100px 110px 1fr", gap:12, padding:"12px 14px", borderTop:index === 0 ? "none" : `1px solid ${T.border}`, background:isShortage ? T.red+"11" : "transparent" }}>
                          <div>
                            <div style={{ fontSize:12, color:T.textStrong, fontWeight:"bold" }}>{item.label}</div>
                            <div style={{ fontSize:11, color:T.textDim }}>
                              {item.dose != null && item.doseUnit ? `${item.dose} ${item.doseUnit}` : item.consumeStock === false ? "Process non stocké" : "Consommation stock"}
                            </div>
                          </div>
                          <div style={{ fontSize:12, fontFamily:"monospace", color:T.textStrong }}>{item.quantity.toFixed(3)} {item.unit}</div>
                          <div style={{ fontSize:12, fontFamily:"monospace", color:product ? (isShortage ? T.red : T.textDim) : T.textDim }}>
                            {product ? `${available.toFixed(3)} ${product.unit}` : "--"}
                          </div>
                          <div style={{ fontSize:11, color:isShortage ? T.red : T.textDim }}>
                            {item.note || (isShortage ? `Manque ${(item.quantity - available).toFixed(3)} ${item.unit}` : "OK")}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {planningIssues.length > 0 && (
                <div style={{ background:T.red+"11", border:`1px solid ${T.red}44`, borderRadius:6, padding:14 }}>
                  <div style={{ fontSize:12, fontWeight:"bold", color:T.red, marginBottom:8 }}>Planification incomplète</div>
                  <ul style={{ margin:0, paddingLeft:18, color:T.red, fontSize:12, lineHeight:1.6 }}>
                    {planningIssues.map((issue: string) => <li key={issue}>{issue}</li>)}
                  </ul>
                </div>
              )}

              {planningStockShortages.length > 0 && (
                <div style={{ background:T.red+"11", border:`1px solid ${T.red}33`, borderRadius:6, padding:14 }}>
                  <div style={{ fontSize:12, fontWeight:"bold", color:T.red, marginBottom:8 }}>Stocks insuffisants</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {planningStockShortages.map((item: any) => (
                      <div key={`shortage-${item.productId}`} style={{ fontSize:12, color:T.red }}>
                        {item.label}: disponible {item.available.toFixed(3)} {item.unit}, requis {item.quantity.toFixed(3)} {item.unit}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {planningLastError && (
                <div style={{ background:T.red+"11", border:`1px solid ${T.red}33`, borderRadius:6, padding:14 }}>
                  <div style={{ fontSize:12, fontWeight:"bold", color:T.red, marginBottom:6 }}>Dernière erreur backend</div>
                  <div style={{ fontSize:12, color:T.red, lineHeight:1.5 }}>{planningLastError}</div>
                </div>
              )}

              {planningLastSuccess && (
                <div style={{ background:T.green+"11", border:`1px solid ${T.green}33`, borderRadius:6, padding:14 }}>
                  <div style={{ fontSize:12, fontWeight:"bold", color:T.green, marginBottom:6 }}>Tirage créé en base</div>
                  <div style={{ fontSize:12, color:T.textStrong }}>
                    {planningLastSuccess.bottleLotCode} · {planningLastSuccess.bottleCount} bouteilles · volume restant {planningLastSuccess.remainingVolume?.toFixed ? planningLastSuccess.remainingVolume.toFixed(3) : planningLastSuccess.remainingVolume} hL sur {planningLastSuccess.sourceLotCode}
                  </div>
                  <div style={{ fontSize:11, color:T.textDim, marginTop:6 }}>
                    Les données ont été rafraîchies après création pour remettre à jour le lot source, les stocks et les BottleLots.
                  </div>
                </div>
              )}

              <Btn
                onClick={handleCreateTirageFromPlanning}
                disabled={isSubmitting || planningIssues.length > 0}
                style={{ width:"100%", height:48, fontSize:14 }}
              >
                {isSubmitting ? "Création du tirage en cours..." : "Créer le tirage depuis cette planification"}
              </Btn>
              <div style={{ fontSize:11, color:planningIsReady ? T.textDim : T.red, lineHeight:1.5 }}>
                {planningIsReady
                  ? "Le flux utilisera la même route /api/tirage que le tirage direct depuis un lot."
                  : `Bouton désactivé tant que la planification n'est pas complète${planningPrimaryIssue ? ` : ${planningPrimaryIssue}` : "."}`}
              </div>
            </div>
          </div>

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
                <div style={{ display:"flex", justifyContent:"space-between", fontSize: 12 }}><span>Bouteilles:</span> <Input type="number" value={tirageStocks.bouteilles} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setTirageStocks({...tirageStocks, bouteilles: parseInt(e.target.value)||0})} style={{width: 70, height: 24, fontSize:11}} /></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize: 12 }}><span>Bidules:</span> <Input type="number" value={tirageStocks.bidules} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setTirageStocks({...tirageStocks, bidules: parseInt(e.target.value)||0})} style={{width: 70, height: 24, fontSize:11}} /></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize: 12 }}><span>Capsules:</span> <Input type="number" value={tirageStocks.capsules} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>setTirageStocks({...tirageStocks, capsules: parseInt(e.target.value)||0})} style={{width: 70, height: 24, fontSize:11}} /></div>
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
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTirageDays(tirageDays.map((d: any) => d.id === day.id ? { ...d, vinBaseVolume: e.target.value } : d))}
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
                {cascade.map((p: any, i: number) => (
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
                    <Select value={createLevainSourceId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateLevainSourceId(e.target.value)} style={{ width: 180, fontSize: 12 }}>
                      <option value="">-- Pomper le vin depuis --</option>
                      {cuvesVinBase.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
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
                {cascade.map((p: any, i: number) => {
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
                <FF label="Volume Restant (hL)"><Input type="number" step="0.1" value={config.alimVolLevain} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimVolLevain', e.target.value)} /></FF>
                <FF label="Volume Visé (hL)"><Input type="number" step="0.1" value={config.alimVolFinal} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimVolFinal', e.target.value)} /></FF>
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>2. Activité des Levures</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Densité VEILLE (ex: 1006)"><Input type="number" value={config.alimDensiteVeille} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimDensiteVeille', e.target.value)} /></FF>
                <FF label="Densité CE MATIN (ex: 998)"><Input type="number" value={config.alimDensiteMatin} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimDensiteMatin', e.target.value)} /></FF>
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>3. Intrants</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Liqueur (g/L)"><Input type="number" value={config.alimLiqueurG} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimLiqueurG', e.target.value)} /></FF>
                <FF label="TAV Vin Nourricier (%)"><Input type="number" step="0.1" value={config.alimAlcVin} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimAlcVin', e.target.value)} /></FF>
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
                      <Select value={alimSourceTankId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAlimSourceTankId(e.target.value)} style={{ fontSize: 12 }}>
                        <option value="">-- Vin nourricier --</option>
                        {cuvesVinBase.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
                      </Select>
                      <Select value={alimLevainTankId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setAlimLevainTankId(e.target.value);
                          const t = cuvesLevain.find((c: any) => String(c.id) === String(e.target.value));
                          if (t) updateConfig('alimVolLevain', t.currentVolume);
                      }} style={{ fontSize: 12 }}>
                        <option value="">-- Cuve à Levain --</option>
                        {cuvesLevain.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
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
