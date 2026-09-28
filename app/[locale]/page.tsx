import { FloodScreen } from "@/components/flood/FloodScreen.tsx";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

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
  // The screen reads `?report=` to reveal a just-submitted report, and
  // `useSearchParams` opts the tree out of prerendering unless it sits behind
  // a boundary. Without this the production build fails outright.
  return (
    <Suspense>
      <FloodScreen />
    </Suspense>
  );
}
