"use client";
// @ts-nocheck

import React from "react";
import { Badge, Btn, Modal, Select } from "@/components/ui";
import { useTheme } from "@/lib/store";
import { ASSEMBLAGE_TYPES } from "@/lib/assemblage";
import { AssemblageAdjuvants } from "@/components/modules/assemblages/AssemblageAdjuvants";
import { AssemblageDecisionSummary } from "@/components/modules/assemblages/AssemblageDecisionSummary";
import { AssemblageDestinationSelector } from "@/components/modules/assemblages/AssemblageDestinationSelector";
import { AssemblageVolumeInputs } from "@/components/modules/assemblages/AssemblageVolumeInputs";

export function CreateAssemblageModal({
  isSubmitting,
  isCreatingAssemblage,
  onClose,
  resetForm,
  assemblageType,
  setAssemblageType,
  assemblageLabels,
  sourceSections,
  buildSourceKey,
  readSourceDraft,
  setSourceDrafts,
  selectedSources,
  selectedSourceRows,
  updateSourceDraft,
  destinationContainerId,
  setDestinationContainerId,
  destinationCandidates,
  adjuvantRows,
  setAdjuvants,
  products,
  totalVolumeHl,
  proposedCode,
  decision,
  vintageEntries,
  compositionEntries,
  notes,
  setNotes,
  validationErrors,
  submitAssemblage,
}: any) {
  const T = useTheme();

  const closeIfIdle = () => {
    if (!isSubmitting) {
      onClose();
      resetForm();
    }
  };

  return (
    <Modal title="Créer un assemblage" onClose={closeIfIdle}>
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
              {sourceSections.map((section: any) => (
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

          <AssemblageVolumeInputs
            selectedSources={selectedSources}
            selectedSourceRows={selectedSourceRows}
            buildSourceKey={buildSourceKey}
            readSourceDraft={readSourceDraft}
            updateSourceDraft={updateSourceDraft}
            isSubmitting={isSubmitting}
          />
          <AssemblageDestinationSelector
            destinationContainerId={destinationContainerId}
            setDestinationContainerId={setDestinationContainerId}
            destinationCandidates={destinationCandidates}
            isSubmitting={isSubmitting}
          />
          <AssemblageAdjuvants
            adjuvantRows={adjuvantRows}
            setAdjuvants={setAdjuvants}
            products={products}
            totalVolumeHl={totalVolumeHl}
            isSubmitting={isSubmitting}
          />
          <AssemblageDecisionSummary
            totalVolumeHl={totalVolumeHl}
            proposedCode={proposedCode}
            assemblageLabels={assemblageLabels}
            assemblageType={assemblageType}
            decision={decision}
            vintageEntries={vintageEntries}
            compositionEntries={compositionEntries}
            notes={notes}
            setNotes={setNotes}
            validationErrors={validationErrors}
            isSubmitting={isSubmitting}
          />

          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, marginTop:6 }}>
            <Btn variant="secondary" onClick={() => { if (!isCreatingAssemblage) { onClose(); resetForm(); } }} disabled={isCreatingAssemblage}>Annuler</Btn>
            <Btn onClick={submitAssemblage} disabled={isCreatingAssemblage || validationErrors.length > 0}>
              {isCreatingAssemblage ? "Enregistrement en cours..." : "Enregistrer l'assemblage"}
            </Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}
