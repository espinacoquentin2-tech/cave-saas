import Link from "next/link";
import { notFound } from "next/navigation";
import { LEGAL_CONFIG, LEGAL_DOCUMENTS, getLegalDocument } from "@/lib/legal-content";

type PublicLegalPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return LEGAL_DOCUMENTS.map((document) => ({ slug: document.slug }));
}

export async function generateMetadata({ params }: PublicLegalPageProps) {
  const { slug } = await params;
  const document = getLegalDocument(slug);

  if (!document) {
    return {
      title: `Document juridique - ${LEGAL_CONFIG.productName}`,
    };
  }

  return {
    title: `${document.title} - ${LEGAL_CONFIG.productName}`,
    description: document.summary,
  };
}

export default async function PublicLegalPage({ params }: PublicLegalPageProps) {
  const { slug } = await params;
  const document = getLegalDocument(slug);

  if (!document) notFound();

  return (
    <main
      data-testid="public-legal-page"
      style={{
        minHeight: "100vh",
        background: "#0f0d0a",
        color: "#e8dcc8",
        padding: "32px 20px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ width: "100%", maxWidth: 880, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ color: "#8a7d6a", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>
            {LEGAL_CONFIG.productName}
          </div>
          <h1
            data-testid="public-legal-title"
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 38,
              lineHeight: 1.1,
              color: "#f0e8d8",
              margin: 0,
            }}
          >
            {document.title}
          </h1>
          <p style={{ color: "#8a7d6a", fontSize: 13, margin: "12px 0 0", lineHeight: 1.6 }}>
            Dernière mise à jour : <span style={{ color: "#e2c47a" }}>{LEGAL_CONFIG.lastUpdated}</span>
          </p>
        </div>

        <article style={{ background: "#1a1713", border: "1px solid #2e2a22", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "28px 30px", display: "flex", flexDirection: "column", gap: 26 }}>
            {document.sections.map((section) => (
              <section key={section.title}>
                <h2 style={{ margin: "0 0 10px", color: "#e2c47a", fontSize: 17 }}>
                  {section.title}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} style={{ margin: 0, color: "#e8dcc8", fontSize: 14, lineHeight: 1.7, overflowWrap: "anywhere" }}>
                      {paragraph}
                    </p>
                  ))}
                </div>
                {section.bullets && section.bullets.length > 0 && (
                  <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#e8dcc8", fontSize: 14, lineHeight: 1.7 }}>
                    {section.bullets.map((bullet) => (
                      <li key={bullet} style={{ marginBottom: 4, overflowWrap: "anywhere" }}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>

        <Link
          data-testid="back-to-login-link"
          href="/app"
          style={{
            display: "inline-flex",
            marginTop: 22,
            color: "#c9a84c",
            textDecoration: "none",
            border: "1px solid #c9a84c66",
            borderRadius: 4,
            padding: "10px 14px",
            fontSize: 12,
            fontFamily: "monospace",
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Retour à la connexion
        </Link>
      </div>
    </main>
  );
}
