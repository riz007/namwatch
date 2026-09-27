import { FloodScreen } from "@/components/flood/FloodScreen.tsx";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

/** Screen 1 — Map + List.. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "map" });
  return { title: t("title") };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <FloodScreen />;
}
