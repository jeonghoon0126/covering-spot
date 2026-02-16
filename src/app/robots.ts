import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/admin/*", "/api/*", "/booking/complete", "/booking/manage"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
