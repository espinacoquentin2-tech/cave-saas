"use client";

import { useMemo, useState } from "react";
import { LEGAL_CONFIG, LEGAL_DOCUMENTS, LegalDocument, getLegalDocument } from "@/lib/legal-content";
import { useTheme } from "@/lib/store";
import { Btn } from "@/components/ui";

const CARD_TEST_IDS: Record<LegalDocument["slug"], string> = {
  "mentions-legales": "legal-document-card-mentions-legales",
  confidentialite: "legal-document-card-confidentialite",
  "conditions-utilisation": "legal-document-card-cgu",
  securite: "legal-document-card-securite",
  cookies: "legal-document-card-cookies",
};

function LegalDocumentContent({ document }: { document: LegalDocument }) {
  const T = useTheme();

  return (
    <article data-testid="legal-document-content" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "24px 28px", borderBottom: `1px solid ${T.border}`, background: T.surfaceHigh }}>
        <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 8 }}>
          Document juridique
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, color: T.textStrong, margin: 0 }}>
          {document.title}
        </h2>
        <div style={{ marginTop: 10, fontSize: 12, color: T.textDim }}>
          Dernière mise à jour : <span style={{ color: T.accentLight }}>{LEGAL_CONFIG.lastUpdated}</span>
        </div>
      </div>

      <div style={{ padding: "26px 28px", display: "flex", flexDirection: "column", gap: 24 }}>
        {document.sections.map((section) => (
          <section key={section.title}>
            <h3 style={{ margin: "0 0 10px", color: T.accentLight, fontSize: 15, letterSpacing: 0.2 }}>
              {section.title}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} style={{ margin: 0, color: T.text, fontSize: 13, lineHeight: 1.65, overflowWrap: "anywhere" }}>
                  {paragraph}
                </p>
              ))}
            </div>
            {section.bullets && section.bullets.length > 0 && (
              <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: T.text, fontSize: 13, lineHeight: 1.65 }}>
                {section.bullets.map((bullet) => (
                  <li key={bullet} style={{ marginBottom: 4, overflowWrap: "anywhere" }}>{bullet}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </article>
  );
}

export function LegalDocuments() {
  const T = useTheme();
  const [selectedSlug, setSelectedSlug] = useState<LegalDocument["slug"] | null>(null);
  const selectedDocument = useMemo(
    () => (selectedSlug ? getLegalDocument(selectedSlug) : undefined),
    [selectedSlug],
  );

  return (
    <div data-testid="system-legal-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, color: T.textStrong, margin: 0 }}>
            Documents juridiques
          </h1>
          <div style={{ color: T.textDim, fontSize: 13, marginTop: 4 }}>
            Pages légales centralisées pour Ma Cuverie, à compléter avant publication publique.
          </div>
        </div>
        {selectedDocument && (
          <Btn data-testid="legal-back-button" variant="secondary" onClick={() => setSelectedSlug(null)}>
            Retour à la liste
          </Btn>
        )}
      </div>

      {!selectedDocument ? (
        <div data-testid="legal-document-list" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {LEGAL_DOCUMENTS.map((document) => (
            <button
              key={document.slug}
              data-testid={CARD_TEST_IDS[document.slug]}
              onClick={() => setSelectedSlug(document.slug)}
              style={{
                minHeight: 150,
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderTop: `2px solid ${T.accent}`,
                borderRadius: 8,
                padding: 18,
                color: T.text,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: "system-ui, sans-serif",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <span style={{ color: T.accentLight, fontWeight: 700, fontSize: 15 }}>{document.shortTitle}</span>
              <span style={{ color: T.textDim, fontSize: 12, lineHeight: 1.55 }}>{document.summary}</span>
              <span style={{ marginTop: "auto", color: T.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2 }}>
                Mise à jour : {LEGAL_CONFIG.lastUpdated}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <LegalDocumentContent document={selectedDocument} />
      )}
    </div>
  );
}
