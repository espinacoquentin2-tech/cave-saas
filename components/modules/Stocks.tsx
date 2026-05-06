"use client";
// @ts-nocheck

import React, { useState } from "react";
import { Badge, Btn, Input } from "@/components/ui";
import { useStore, useTheme } from "@/lib/store";

type StocksProps = {
  AddProductModal: React.ComponentType<{ onClose: () => void }>;
  StockMovementModal: React.ComponentType<{
    product: any;
    productsList: any;
    onSelectProduct: any;
    onClose: () => void;
  }>;
};

// =============================================================================
// PAGE INVENTAIRE (STOCKS & COMMANDES)
// =============================================================================
export function Stocks({ AddProductModal, StockMovementModal }: StocksProps) {
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
  const alertsCount = products.filter((p: any) => p.currentStock <= p.minStock).length;

  const filteredProducts = products.filter((p: any) => {
    const matchCat = filterCat === "TOUTES" || p.category === filterCat;
    const matchSubCat = !filterSubCat || p.subCategory === filterSubCat;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSubCat && matchSearch;
  }).sort((a: any,b: any) => a.category.localeCompare(b.category) || a.subCategory.localeCompare(b.subCategory) || a.name.localeCompare(b.name));

  const subtotals: any = {};
  filteredProducts.forEach((p: any) => {
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
            <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Rechercher article..." style={{ minWidth:200 }} />

            <div style={{ display:"flex", gap:6, background:T.surfaceHigh, padding:4, borderRadius:6, border:`1px solid ${T.border}` }}>
              {categoriesKeys.map((c: any) => (
                <button key={c} onClick={() => { setFilterCat(c); setFilterSubCat(""); }} style={{ background: filterCat===c ? T.accent : "transparent", color: filterCat===c ? T.bg : T.textDim, border:"none", padding:"6px 12px", borderRadius:4, cursor:"pointer", fontSize:11, fontFamily:"monospace", transition:"all .2s", fontWeight: filterCat===c ? "bold" : "normal" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {filterCat !== "TOUTES" && CATEGORIES[filterCat as keyof typeof CATEGORIES] && (
            <div style={{ display:"flex", gap:10, marginBottom:20, flexWrap:"wrap", background:T.surfaceHigh, padding:10, borderRadius:6, border:`1px solid ${T.border}` }}>
              <span style={{fontSize:10, color:T.textDim, textTransform:"uppercase", alignSelf:"center", marginRight:10, fontWeight: "bold"}}>Sous-catégories :</span>
	              {CATEGORIES[filterCat as keyof typeof CATEGORIES].map((sc: any) => (
                <button key={sc} onClick={() => setFilterSubCat(filterSubCat === sc ? "" : sc)} style={{ background: filterSubCat===sc ? T.accent : "transparent", color: filterSubCat===sc ? T.bg : T.textDim, border:`1px solid ${filterSubCat===sc ? T.accent : T.border}`, padding:"5px 12px", borderRadius:4, cursor:"pointer", fontSize:10, fontFamily:"monospace", transition:"all 0.2s" }}>
                  {sc}
                </button>
              ))}
            </div>
          )}

          {Object.keys(subtotals).length > 0 && (
            <div style={{ display:"flex", gap:12, marginBottom:16, flexWrap:"wrap" }}>
	              {Object.entries(subtotals).map(([sub, data]: any) => (
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

	            {filteredProducts.map((p: any, i: any) => {
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
	          ) : [...movements].sort((a: any,b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime()).map((m: any, i: any) => {
	            const product = products.find((p: any) => p.id === m.productId);
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
