"use client";
import { Input, Select, Btn } from "@/components/ui";
import type { MaloProductInput, MaloWorkspace } from "@/lib/malo-types";
import { Field, grid } from "./fields";
const names = {
  BACTERIES: "Bactéries",
  ACTIVATEUR: "Activateur",
  LSA: "LSA",
  AUTRE: "Produit complémentaire",
};
export const initialProducts = (): MaloProductInput[] =>
  ["BACTERIES", "ACTIVATEUR", "LSA"].map((role) => ({
    role: role as MaloProductInput["role"],
    productId: 0,
    quantity: 0,
    unit: "g",
    addedVolumeHl: 0,
  }));
export function MaloProductFields({
  value,
  products,
  onChange,
}: {
  value: MaloProductInput[];
  products: MaloWorkspace["products"];
  onChange: (v: MaloProductInput[]) => void;
}) {
  const change = (i: number, p: Partial<MaloProductInput>) =>
    onChange(value.map((v, n) => (n === i ? { ...v, ...p } : v)));
  let extra = 0;
  return (
    <div>
      <p>
        Choisissez les intrants réellement utilisés dans vos stocks. Les
        quantités restent à renseigner.
      </p>
      {value.map((v, i) => {
        const label =
          v.role === "AUTRE"
            ? `Produit complémentaire ${++extra}`
            : `Produit ${names[v.role]}`;
        const product = products.find((p) => p.id === v.productId);
        const demand = product
          ? value
              .filter((x) => x.productId === product.id)
              .reduce(
                (n, x) =>
                  n +
                  (x.quantity *
                    (x.unit.toLowerCase() === "g"
                      ? 0.001
                      : x.unit.toLowerCase() === "l"
                        ? 0.01
                        : 1)) /
                    (product.unit.toLowerCase() === "g"
                      ? 0.001
                      : product.unit.toLowerCase() === "l"
                        ? 0.01
                        : 1),
                0,
              )
          : 0;
        return (
          <div
            key={i}
            style={{
              borderBottom: "1px solid #8883",
              marginBottom: 12,
              paddingBottom: 8,
            }}
          >
            <div style={grid}>
              <Field label={label}>
                <Select
                  aria-label={label}
                  value={v.productId || ""}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    change(i, {
                      productId: Number(e.target.value),
                      quantity: 0,
                      addedVolumeHl: 0,
                      unit:
                        products.find((p) => p.id === Number(e.target.value))
                          ?.unit === "L"
                          ? "L"
                          : products.find(
                                (p) => p.id === Number(e.target.value),
                              )?.unit === "hL"
                            ? "hL"
                            : "g",
                    })
                  }
                >
                  <option value="">Non utilisé / choisir un produit</option>
                  {products
                    .filter((p) => ["g", "kg", "L", "hL"].includes(p.unit))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.currentStock} {p.unit}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label={`Quantité ${names[v.role]} ${i + 1}`}>
                <Input
                  aria-label={`Quantité ${names[v.role]} ${i + 1}`}
                  type="number"
                  min="0"
                  step="any"
                  value={v.quantity || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    change(i, { quantity: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label={`Unité produit ${i + 1}`}>
                <Select
                  aria-label={`Unité produit ${i + 1}`}
                  value={v.unit}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    change(i, {
                      unit: e.target.value as MaloProductInput["unit"],
                    })
                  }
                >
                  {(product && ["L", "hL"].includes(product.unit)
                    ? ["L", "hL"]
                    : ["g", "kg"]
                  ).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
              {["L", "hL"].includes(v.unit) && (
                <Field label={`Volume ajouté produit ${i + 1} (hL)`}>
                  <Input
                    type="number"
                    step="0.001"
                    min="0"
                    value={v.addedVolumeHl || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      change(i, { addedVolumeHl: Number(e.target.value) })
                    }
                  />
                </Field>
              )}
            </div>
            {product && (
              <p
                style={{
                  fontSize: 12,
                  color: demand > product.currentStock ? "#c44" : undefined,
                }}
              >
                Disponible : {product.currentStock} {product.unit} · Besoin
                cumulé :{" "}
                {demand.toLocaleString("fr-FR", { maximumFractionDigits: 3 })} ·
                Reste :{" "}
                {(product.currentStock - demand).toLocaleString("fr-FR", {
                  maximumFractionDigits: 3,
                })}{" "}
                {product.unit}
              </p>
            )}
            {v.role === "AUTRE" && (
              <Btn
                variant="secondary"
                onClick={() => onChange(value.filter((_, n) => n !== i))}
              >
                Retirer cette ligne
              </Btn>
            )}
          </div>
        );
      })}
      <Btn
        variant="secondary"
        onClick={() =>
          onChange([
            ...value,
            {
              productId: 0,
              role: "AUTRE",
              quantity: 0,
              unit: "g",
              addedVolumeHl: 0,
            },
          ])
        }
      >
        + Ajouter un produit
      </Btn>
    </div>
  );
}
