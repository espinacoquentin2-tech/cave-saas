"use client";
// @ts-nocheck

import { useTheme } from "@/lib/store";
import { toSafeNumber } from "@/lib/client-app-helpers";

export function TirageStockChecklist({
  planningCalculatedItems,
  tiragePlanningProducts,
  planningIssues,
  planningStockShortages,
  planningLastError,
  planningLastSuccess,
}: any) {
  const T = useTheme();

  return (
    <>
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
    </>
  );
}
