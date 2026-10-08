"use client";
// @ts-nocheck

import React, { useEffect, useState } from "react";
import { calculateLevainFeeding } from "@/lib/levain";
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
} from "@/lib/tirage";
import { TirageCalculationSummary } from "@/components/modules/tirage/TirageCalculationSummary";
import { TirageCreateAction } from "@/components/modules/tirage/TirageCreateAction";
import { TirageParametersForm } from "@/components/modules/tirage/TirageParametersForm";
import { TirageSourceSelector } from "@/components/modules/tirage/TirageSourceSelector";
import { TirageStockChecklist } from "@/components/modules/tirage/TirageStockChecklist";

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

  const [createLevainKey, setCreateLevainKey] = useState(() => crypto.randomUUID());
  const [feedLevainKey, setFeedLevainKey] = useState(() => crypto.randomUUID());
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
    if (!lot || lot.qualiteLot === "LEVAIN" || n.includes("LEVAIN")) return false;
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
  const feedingParameters = {
    remainingVolumeHl: Number(config.alimVolLevain), finalVolumeHl: Number(config.alimVolFinal),
    previousDensity: Number(config.alimDensiteVeille), currentDensity: Number(config.alimDensiteMatin),
    liqueurSugarGPerL: Number(config.alimLiqueurG), wineAlcoholPct: Number(config.alimAlcVin),
  };
  const feedingCalculation = calculateLevainFeeding(feedingParameters);
  const resAlim = feedingCalculation ? {
    sucreConsomme: feedingCalculation.consumedSugarGPerL.toFixed(1),
    vLiqueur: feedingCalculation.liqueurVolumeHl.toFixed(3),
    vVin: feedingCalculation.wineVolumeHl.toFixed(3),
    vEau: feedingCalculation.waterVolumeHl.toFixed(3),
    dap: feedingCalculation.dapKg.toFixed(2),
  } : null;

  // ===========================================================================
  // ACTIONS DE CUVERIE INTELLIGENTES (SÉCURISÉES)
  // ===========================================================================

  const handleAutoCreateLevain = async () => {
    if (isSubmitting || !createLevainSourceId || !Number.isFinite(maxLevainVol) || maxLevainVol <= 0) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/levains', {
        method: 'POST', headers: buildApiHeaders(user),
        body: JSON.stringify({ sourceContainerId: Number(createLevainSourceId), volumeHl: Number(maxLevainVol.toFixed(3)), idempotencyKey: createLevainKey }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(extractApiErrorMessage(payload, "Impossible de créer le levain."));
      const { levainContainerId, levainVolumeHl } = payload.data;
      setCreateLevainKey(crypto.randomUUID());
      setMixLevainTankId(String(levainContainerId));
      setAlimLevainTankId(String(levainContainerId));
      updateConfig('alimVolLevain', levainVolumeHl);
      updateConfig('alimVolFinal', levainVolumeHl);
      if (refreshData) await refreshData();
      dispatch({ type: "TOAST_ADD", payload: { msg: `Levain enregistré : ${levainVolumeHl.toFixed(3)} hL prélevés sur le vin source.`, color: T.green } });
    } catch (error: any) {
      dispatch({ type: "TOAST_ADD", payload: { msg: error?.message || "Création impossible pour le moment.", color: T.red } });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleValiderAlimentation = async () => {
    if (isSubmitting || !alimSourceTankId || !alimLevainTankId || !feedingCalculation) return;
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/levains/feed', {
        method: 'POST', headers: buildApiHeaders(user),
        body: JSON.stringify({ ...feedingParameters, sourceContainerId: Number(alimSourceTankId), levainContainerId: Number(alimLevainTankId), idempotencyKey: feedLevainKey }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(extractApiErrorMessage(payload, "Impossible d’enregistrer le nourrissage."));
      setFeedLevainKey(crypto.randomUUID());
      updateConfig('alimVolLevain', payload.data.levainVolumeHl);
      if (refreshData) await refreshData();
      dispatch({ type: "TOAST_ADD", payload: { msg: `Alimentation enregistrée : ${payload.data.levainVolumeHl.toFixed(3)} hL dans le levain.`, color: T.green } });
    } catch (error: any) {
      dispatch({ type: "TOAST_ADD", payload: { msg: error?.message || "Nourrissage impossible pour le moment.", color: T.red } });
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
          <Btn variant={activeTab === "MIXTION" ? "primary" : "secondary"} onClick={() => setActiveTab("MIXTION")}>🍷 Simulation mixtion</Btn>
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
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.accentLight, marginBottom: 16 }}>3. Hypothèses de tirage</div>
              <FF label="Cuve de travail (hypothèse)" style={{ marginBottom: 16 }}>
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
              <div style={{ fontSize: 12, color: T.accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: "bold", marginBottom: 24, textAlign: "center" }}>Simulation de préparation mixtion</div>
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
                    <div style={{ fontSize: 12, textTransform: "uppercase", color: T.accentLight, fontWeight: "bold", marginBottom: 16 }}>📦 Estimation tirage & matières sèches</div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 14, color: T.textStrong, fontWeight: "bold" }}>Nombre de cols estimés :</div>
                      <div style={{ fontSize: 22, color: T.textStrong, fontWeight: "bold", fontFamily: "monospace" }}>{(resMix.nbCols ?? 0).toLocaleString('fr-FR')}</div>
                    </div>
                  </div>
                  <div style={{ background: T.surfaceHigh, border: `1px solid ${T.border}`, padding: 16, borderRadius: 6, marginTop: 16, color: T.text, fontSize: 13, lineHeight: 1.5 }}>
                    La mixtion est désormais un calcul de préparation. Pour créer un tirage réel, utilise le bouton Créer le tirage depuis cette planification.
                  </div>
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
              <TirageSourceSelector
                form={planningForm}
                setForm={setPlanningForm}
                isSubmitting={isSubmitting}
                cuvesVinBase={cuvesVinBase}
                getContainerLot={getContainerLot}
                analyses={state.analyses || []}
                planningSourceLotCode={planningSourceLotCode}
                planningSourceLot={planningSourceLot}
                planningAvailableVolumeHl={planningAvailableVolumeHl}
                planningAnalysisResidualSugar={planningAnalysisResidualSugar}
              />
              <TirageParametersForm
                form={planningForm}
                setForm={setPlanningForm}
                isSubmitting={isSubmitting}
                sugarProducts={sugarProducts}
                yeastProducts={yeastProducts}
                adjuvantProducts={adjuvantProducts}
                planningSugarCalculation={planningSugarCalculation}
                planningSugarProduct={planningSugarProduct}
                planningYeastQuantity={planningYeastQuantity}
                planningYeastProduct={planningYeastProduct}
                planningAdjuvantQuantity={planningAdjuvantQuantity}
                planningAdjuvantProduct={planningAdjuvantProduct}
                planningLevainVolumeHl={planningLevainVolumeHl}
                planningLevainPct={planningLevainPct}
                levainStockProduct={levainStockProduct}
              />
            </div>

            <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:8, padding:20, display:"flex", flexDirection:"column", gap:16 }}>
              <TirageCalculationSummary
                isSubmitting={isSubmitting}
                planningIsReady={planningIsReady}
                planningPrimaryIssue={planningPrimaryIssue}
                planningBottleCount={planningBottleCount}
                planningPlanPreview={planningPlanPreview}
                planningSourceLotCode={planningSourceLotCode}
                planningForm={planningForm}
              />
              <TirageStockChecklist
                planningCalculatedItems={planningCalculatedItems}
                tiragePlanningProducts={tiragePlanningProducts}
                planningIssues={planningIssues}
                planningStockShortages={planningStockShortages}
                planningLastError={planningLastError}
                planningLastSuccess={planningLastSuccess}
              />
              <TirageCreateAction
                onCreate={handleCreateTirageFromPlanning}
                isSubmitting={isSubmitting}
                planningIssues={planningIssues}
                planningIsReady={planningIsReady}
                planningPrimaryIssue={planningPrimaryIssue}
              />
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
                    <Select aria-label="Vin source du levain" value={createLevainSourceId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCreateLevainSourceId(e.target.value)} style={{ width: 180, fontSize: 12 }}>
                      <option value="">-- Pomper le vin depuis --</option>
                      {cuvesVinBase.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
                    </Select>
                    <Btn onClick={handleAutoCreateLevain} style={{ fontSize: 12, padding: "8px 16px" }} disabled={isSubmitting || !createLevainSourceId || maxLevainVol <= 0}>{isSubmitting ? "Création..." : "+ Créer le Levain"}</Btn>
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
                <FF label="Volume Restant (hL)"><Input type="number" step="0.1" aria-label="Volume restant du levain (hL)" value={config.alimVolLevain} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimVolLevain', e.target.value)} /></FF>
                <FF label="Volume Visé (hL)"><Input type="number" step="0.1" aria-label="Volume visé du levain (hL)" value={config.alimVolFinal} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimVolFinal', e.target.value)} /></FF>
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>2. Activité des Levures</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Densité VEILLE (ex: 1006)"><Input type="number" aria-label="Densité veille" value={config.alimDensiteVeille} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimDensiteVeille', e.target.value)} /></FF>
                <FF label="Densité CE MATIN (ex: 998)"><Input type="number" aria-label="Densité matin" value={config.alimDensiteMatin} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimDensiteMatin', e.target.value)} /></FF>
              </div>
            </div>
            <div style={{ background: T.surfaceHigh, padding: 20, borderRadius: 8, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 14, fontWeight: "bold", color: T.textStrong, marginBottom: 16 }}>3. Intrants</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FF label="Liqueur (g/L)"><Input type="number" aria-label="Liqueur (g/L)" value={config.alimLiqueurG} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimLiqueurG', e.target.value)} /></FF>
                <FF label="TAV Vin Nourricier (%)"><Input type="number" step="0.1" aria-label="TAV vin nourricier (%)" value={config.alimAlcVin} onChange={(e: React.ChangeEvent<HTMLInputElement>)=>updateConfig('alimAlcVin', e.target.value)} /></FF>
              </div>
            </div>
          </div>

          <div>
            <div style={{ position: "sticky", top: 20, background: T.surface, padding: 32, borderRadius: 8, border: `2px solid ${T.accent}`, boxShadow: `0 10px 30px ${T.accent}22` }}>
              <div style={{ fontSize: 12, color: T.accent, textTransform: "uppercase", letterSpacing: 2, fontWeight: "bold", marginBottom: 24, textAlign: "center" }}>Recette d'Alimentation</div>
              {!resAlim ? (
                <div style={{ textAlign: "center", color: T.textDim, fontStyle: "italic", padding: "40px 0" }}>Vérifiez les volumes, les densités et les paramètres de recette : le volume visé doit dépasser le volume restant et tous les apports calculés doivent être positifs ou nuls.</div>
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
                      <Select aria-label="Vin nourricier" value={alimSourceTankId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAlimSourceTankId(e.target.value)} style={{ fontSize: 12 }}>
                        <option value="">-- Vin nourricier --</option>
                        {cuvesVinBase.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
                      </Select>
                      <Select aria-label="Cuve à levain" value={alimLevainTankId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                          setAlimLevainTankId(e.target.value);
                          const t = cuvesLevain.find((c: any) => String(c.id) === String(e.target.value));
                          if (t) updateConfig('alimVolLevain', t.currentVolume);
                      }} style={{ fontSize: 12 }}>
                        <option value="">-- Cuve à Levain --</option>
                        {cuvesLevain.map((c: any) => <option key={c.id} value={c.id}>{c.displayName || c.name} ({parseFloat(c.currentVolume).toFixed(1)} hL)</option>)}
                      </Select>
                    </div>
                    <Btn onClick={handleValiderAlimentation} disabled={isSubmitting || !alimSourceTankId || !alimLevainTankId || alimSourceTankId === alimLevainTankId} style={{ width: "100%", fontSize: 13 }}>{isSubmitting ? "Enregistrement..." : "Valider l’Alimentation"}</Btn>
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
