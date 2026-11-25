import { getClinicalDatabase } from "@/lib/mongodb";

export type SitePageContent = Record<string, unknown>;
export async function getSitePage(slug: "home" | "about" | "privacy") {
  try {
    const db = await getClinicalDatabase();
    const page = await db.collection("platform_site_pages").findOne(
      { slug, status: "published" },
      { projection: { _id: 0, slug: 1, content: 1, updatedAt: 1 } },
    );
    return page && page.content && typeof page.content === "object" ? {
      slug,
      content: page.content as SitePageContent,
      updatedAt: page.updatedAt instanceof Date ? page.updatedAt.toISOString() : null,
    } : null;
  } catch {
    return null;
  }
}
