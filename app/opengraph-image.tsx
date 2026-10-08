import { ImageResponse } from "next/og";

export const alt = "Ma Cuverie — gestion de cave champenoise, du raisin au tirage";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: 72, background: "#fbf7ef", color: "#2a2520", borderTop: "16px solid #7f1d34" }}>
      <div style={{ display: "flex", fontSize: 56, color: "#7f1d34", fontWeight: 700 }}>Ma Cuverie</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.08, fontWeight: 700 }}>Pilotez votre cuverie du raisin au tirage</div>
        <div style={{ display: "flex", fontSize: 28, color: "#62584d" }}>Gestion de cave champenoise · Traçabilité · Aide à la décision</div>
      </div>
      <div style={{ display: "flex", fontSize: 24, color: "#7f1d34" }}>Une vision claire de vos vins, volumes et opérations.</div>
    </div>,
    size,
  );
}
