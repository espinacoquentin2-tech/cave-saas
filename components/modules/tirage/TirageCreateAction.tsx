"use client";
// @ts-nocheck

import { Btn } from "@/components/ui";
import { useTheme } from "@/lib/store";

export function TirageCreateAction({
  onCreate,
  isSubmitting,
  planningIssues,
  planningIsReady,
  planningPrimaryIssue,
}: any) {
  const T = useTheme();

  return (
    <>
      <Btn
        onClick={onCreate}
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
    </>
  );
}
