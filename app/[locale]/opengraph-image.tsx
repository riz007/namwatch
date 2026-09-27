import { routing } from "@/i18n/routing.ts";
import { getTranslations } from "next-intl/server";
import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "NamWatch";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Share card. Built from shapes and text only, so it needs no bundled font file. */
export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "app" });

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#12141A",
        color: "#F2F4F7",
        padding: 72,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <svg width="82" height="82" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7.5" fill="#5B72D8" />
          <rect x="14.6" y="5.5" width="2.8" height="16" rx="1.2" fill="#fff" />
          <rect
            x="10.4"
            y="8.4"
            width="3.6"
            height="1.9"
            rx="0.95"
            fill="#fff"
            opacity="0.9"
          />
          <rect
            x="10.4"
            y="12.6"
            width="2.4"
            height="1.9"
            rx="0.95"
            fill="#fff"
            opacity="0.9"
          />
          <rect
            x="10.4"
            y="16.8"
            width="3.6"
            height="1.9"
            rx="0.95"
            fill="#fff"
            opacity="0.9"
          />
          <path
            d="M1.5 21.4q3.8-2.1 7.6 0t7.6 0t7.6 0t7.6 0v5.1a5.5 5.5 0 0 1-5.5 5.5H7a5.5 5.5 0 0 1-5.5-5.5Z"
            fill="#fff"
            opacity="0.34"
          />
          <path
            d="M1.5 21.4q3.8-2.1 7.6 0t7.6 0t7.6 0t7.6 0"
            stroke="#fff"
            strokeWidth="2.1"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: -1 }}>
          {t("name")}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1.5,
          }}
        >
          {t("tagline")}
        </div>
        <div style={{ fontSize: 31, color: "#A3ACBD", lineHeight: 1.4 }}>
          {t("description")}
        </div>
      </div>

      {/* The depth scale, as the identity of the product. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {["#FCE3A6", "#DEAE34", "#B47B24", "#8E4714", "#66110E"].map((c) => (
          <div
            key={c}
            style={{ width: 132, height: 14, borderRadius: 7, background: c }}
          />
        ))}
      </div>
    </div>,
    size,
  );
}
