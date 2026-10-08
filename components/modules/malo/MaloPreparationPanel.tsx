"use client";
import { useState } from "react";
import { Input, Select, Btn } from "@/components/ui";
import type {
  MaloWorkspace,
  MaloDossierView,
  MaloRole,
} from "@/lib/malo-types";
import { MaloProductFields, initialProducts } from "./MaloProductFields";
import { MaloSourceSelector } from "./MaloSourceSelector";
import {
  Field,
  grid,
  MaloSection,
  volume,
  localTime,
  type Submit,
} from "./fields";
export function MaloPreparationPanel({
  data,
  dossier,
  submit,
  initialContainerId,
  initialRole,
}: {
  data: MaloWorkspace;
  dossier: MaloDossierView;
  submit: Submit;
  initialContainerId?: number;
  initialRole?: MaloRole;
}) {
  const [role, setRole] = useState<MaloRole>(initialRole ?? "MR"),
    [container, setContainer] = useState(initialContainerId ?? 0),
    [source, setSource] = useState(0),
    [sourceVolume, setSourceVolume] = useState(0),
    [water, setWater] = useState(0),
    [products, setProducts] = useState(initialProducts),
    [date, setDate] = useState(localTime),
    [notes, setNotes] = useState(""),
    [step, setStep] = useState("");
  const l = dossier.lots.find((l) => l.role === role),
    s = data.sources.find((x) => x.id === source);
  const recipe = {
    sources:
      sourceVolume > 0
        ? [
            {
              lotId: source,
              volumeHl: sourceVolume,
              expectedVolumeHl: s?.volumeHl ?? 0,
            },
          ]
        : [],
    waterVolumeHl: water,
    products: products.filter((p) => p.quantity > 0),
  };
  const added =
      sourceVolume +
      water +
      recipe.products.reduce((n, p) => n + p.addedVolumeHl, 0),
    usedTank = data.containers.find((c) => c.id === container);
  const save = async () => {
    if (
      await submit(l ? "inputs" : "prepare", {
        ...(l
          ? { snapshot: l.snapshot }
          : {
              role,
              name: `${dossier.name} ${role}`,
              destinationContainerId: container,
            }),
        recipe,
        performedAt: new Date(date).toISOString(),
        notes,
      })
    ) {
      setSourceVolume(0);
      setWater(0);
      setProducts(initialProducts());
    }
  };
  return (
    <>
      <MaloSection title="Préparation et apports">
        <div style={grid}>
          <Field label="Préparation suivie">
            <Select
              aria-label="Préparation suivie"
              value={role}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setRole(e.target.value as MaloRole);
                setStep("");
              }}
            >
              <option value="MR">MR · Milieu de réactivation</option>
              <option value="PCM">PCM · Pied de cuve malo</option>
            </Select>
          </Field>
          {!l && (
            <Field label="Contenant de préparation">
              <Select
                aria-label="Contenant de préparation"
                value={container || ""}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setContainer(Number(e.target.value))
                }
              >
                <option value="">Choisir un contenant vide</option>
                {data.containers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {volume(c.capacityHl)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Date du geste">
            <Input
              aria-label="Date du geste"
              type="datetime-local"
              step="0.001"
              value={date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setDate(e.target.value)
              }
            />
          </Field>
        </div>
        {l && (
          <p>
            {l.name} · {l.containerName} · {volume(l.volumeHl)} ·{" "}
            {l.status.replaceAll("_", " ")}
          </p>
        )}
        <MaloSourceSelector
          sources={data.sources}
          value={source}
          onChange={setSource}
        />
        <div style={grid}>
          <Field label="Moût ou vin prélevé (hL)">
            <Input
              aria-label="Moût ou vin prélevé (hL)"
              type="number"
              min="0"
              step="0.001"
              value={sourceVolume || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSourceVolume(Number(e.target.value))
              }
            />
          </Field>
          <Field label="Eau ajoutée (hL)">
            <Input
              aria-label="Eau ajoutée (hL)"
              type="number"
              min="0"
              step="0.001"
              value={water || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setWater(Number(e.target.value))
              }
            />
          </Field>
        </div>
        <MaloProductFields
          value={products}
          products={data.products}
          onChange={setProducts}
        />
        <p>
          Volume ajouté : {volume(added)} · Volume après :{" "}
          {volume((l?.volumeHl ?? 0) + added)} · Capacité :{" "}
          {volume(l?.capacityHl ?? usedTank?.capacityHl ?? 0)}
        </p>
        <Field label="Observations de préparation">
          <Input
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setNotes(e.target.value)
            }
          />
        </Field>
        <Btn
          onClick={save}
          disabled={
            (!l && !container) ||
            (!added && !recipe.products.length) ||
            (!!l && l.volumeHl <= 0)
          }
        >
          {l ? "Enregistrer les apports" : `Préparer un ${role}`}
        </Btn>
      </MaloSection>
      {l && (
        <MaloSection title="Étape et observations">
          <Field label="État de préparation">
            <Select
              value={step}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setStep(e.target.value)
              }
            >
              <option value="">Observation seule</option>
              {(role === "MR"
                ? ["MR_EN_PREPARATION", "MR_EN_REACTIVATION"]
                : ["PCM_EN_PREPARATION", "PCM_EN_FA", "PCM_EN_DEVELOPPEMENT"]
              ).map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Btn
            onClick={() =>
              submit("steps", {
                snapshot: l.snapshot,
                ...(step ? { state: step } : {}),
                observation: notes,
                performedAt: new Date(date).toISOString(),
              })
            }
            disabled={!step && !notes}
          >
            Enregistrer l’étape
          </Btn>
        </MaloSection>
      )}
    </>
  );
}
