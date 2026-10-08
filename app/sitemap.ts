import type { MetadataRoute } from "next";
import { LEGAL_DOCUMENTS } from "@/lib/legal-content";
import { SITE_ORIGIN } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", ...LEGAL_DOCUMENTS.map(document => `/legal/${document.slug}`)].map(path => ({
    url: `${SITE_ORIGIN}${path}`,
  }));
}
