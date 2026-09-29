"use client";

import type {
  RiverDamState,
  RiverGaugeState,
  RiverResponse,
} from "@/lib/api/river-types.ts";
import type { HiiWarning } from "@/lib/sources/hii-warning/parse.ts";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import useSWR from "swr";
import { Freshness } from "../Freshness.tsx";
import { StationStatus } from "../flood/FloodList.tsx";
import { riverRows, type RiverRow } from "./layout.ts";

/**
 * The upstream picture: is more water coming?
 *
 * The street map answers "where is it flooded now". This answers the question
 * behind it, and the one Bangkok follows in the news every wet season: how
 * much water is moving down the Chao Phraya, and how full are the dams that
 * feed it. North is at the top and Bangkok at the bottom, because that is the
 * direction the water travels.
 */
type WarningsResponse = {
  warnings: HiiWarning[];
  otherCount: number;
  degraded: boolean;
};

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<T>;
}

export function RiverView() {
  const t = useTranslations("river");
  const river = useSWR<RiverResponse>("/api/v1/river", fetcher, {
    refreshInterval: 120_000,
    keepPreviousData: true,
  });
  const warnings = useSWR<WarningsResponse>("/api/v1/warnings", fetcher, {
    refreshInterval: 300_000,
    keepPreviousData: true,
  });

  if (river.isLoading && !river.data) return <RiverSkeleton />;

  if (!river.data) {
    return (
      <p
        role="alert"
        className="px-4 py-10 text-center text-[var(--color-ink-2)]"
      >
        {t("error")}
      </p>
    );
  }

  const { gauges, dams, meta } = river.data;
  const rows = riverRows(gauges, dams);
  const newest = gauges
    .map((g) => g.observedAt)
    .filter((x): x is string => x !== null)
    .sort()
    .at(-1);

  return (
    <div className="mx-auto max-w-[42rem] px-4 pt-4 pb-24">
      <Headline gauges={gauges} />
      <p className="max-w-[60ch] pt-2 text-[var(--text-sm)] leading-relaxed text-[var(--color-ink-2)]">
        {t("howToRead")}
      </p>
      {newest && (
        <p className="pt-1 text-[var(--text-xs)] text-[var(--color-muted)]">
          <Freshness at={newest} />
        </p>
      )}

      <Warnings data={warnings.data} failed={!!warnings.error} />

      {meta.degraded.includes("gauges") && (
        <p
          role="status"
          className="mt-4 text-[var(--text-sm)] text-[var(--color-ink-2)]"
        >
          {t("gaugesDown")}
        </p>
      )}

      <ol className="mt-6" aria-label={t("title")}>
        {rows.map((row) =>
          row.kind === "inlet" ? (
            <InletRow key={row.key} row={row} />
          ) : (
            <GaugeRow key={row.key} row={row} />
          ),
        )}
      </ol>

      {meta.degraded.includes("dams") && (
        <p
          role="status"
          className="mt-2 text-[var(--text-sm)] text-[var(--color-ink-2)]"
        >
          {t("damsMissing")}
        </p>
      )}

      <p className="mt-8 max-w-[60ch] border-t border-[var(--color-rule-2)] pt-4 text-[var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
        {t("sources")}
      </p>
    </div>
  );
}

/** A plain sentence built from the data, never a number without a subject. */
function Headline({ gauges }: { gauges: RiverGaugeState[] }) {
  const t = useTranslations("river");
  const reading = gauges.filter(
    (g) => g.valueM !== null && g.status !== "unknown",
  );
  const over = reading.filter((g) => g.status === "critical").length;
  const rising = reading.filter((g) => g.trend === "rising").length;

  let text: string;
  if (reading.length === 0) text = t("headNoData");
  else if (over > 0)
    text = t("headOver", { count: over, total: reading.length });
  else text = t("headNone");

  return (
    <h2 className="max-w-[28ch] text-[var(--text-xl)] leading-snug font-semibold text-[var(--color-ink)]">
      {text}
      {reading.length > 0 && rising > 0 && (
        <span className="block pt-1 text-[var(--text-base)] font-medium text-[var(--color-ink-2)]">
          {t("headRising", { count: rising })}
        </span>
      )}
    </h2>
  );
}

/* ---- The river --------------------------------------------------------- */

function Rail({
  widthPx,
  measured = true,
  children,
  head = false,
}: {
  widthPx: number;
  measured?: boolean;
  children?: React.ReactNode;
  head?: boolean;
}) {
  return (
    <div className="river-rail" aria-hidden="true">
      <span
        className="river-seg"
        data-measured={measured}
        data-head={head}
        style={{ width: widthPx }}
      />
      {children}
    </div>
  );
}

function GaugeRow({ row }: { row: Extract<RiverRow, { kind: "gauge" }> }) {
  const t = useTranslations("river");
  const locale = useLocale();
  const g = row.gauge;
  const place = locale === "th" ? g.placeTh : g.placeEn;
  const number = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-GB");
  const over = g.freeboardM !== null && g.freeboardM < 0;

  return (
    <li className="river-row">
      <Rail widthPx={row.widthPx} measured={row.measured}>
        <span className="river-node" data-status={g.status} />
      </Rail>

      <div className="min-w-0 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h3 className="font-semibold text-[var(--color-ink)]">{place}</h3>
          <span className="text-[var(--text-xs)] text-[var(--color-muted)]">
            {g.code}
          </span>
        </div>

        {g.valueM === null ? (
          <p className="pt-1 text-[var(--text-sm)] text-[var(--color-muted)]">
            {t("noReading")}
          </p>
        ) : (
          <>
            {g.dischargeM3s !== null && (
              <p className="pt-1 text-[var(--text-lg)] font-semibold text-[var(--color-ink)] tabular-nums">
                {t("flow", { value: number.format(g.dischargeM3s) })}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1.5">
              <StationStatus status={g.status} />
              <span
                className={
                  "text-[var(--text-sm)] tabular-nums " +
                  (over
                    ? "font-semibold text-[var(--color-ink)]"
                    : "text-[var(--color-ink-2)]")
                }
              >
                {g.freeboardM === null
                  ? t("noBank")
                  : over
                    ? t("overBank", { m: Math.abs(g.freeboardM).toFixed(2) })
                    : t("belowBank", { m: g.freeboardM.toFixed(2) })}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 pt-1 text-[var(--text-xs)] text-[var(--color-muted)]">
              <TrendText gauge={g} />
              {g.observedAt && (
                <Freshness at={g.observedAt} cadenceMinutes={10} />
              )}
            </p>
          </>
        )}

        {/* The one place the line's meaning changes: say so where it happens. */}
        {!row.measured && g.dischargeM3s === null && g.valueM !== null && (
          <p className="pt-1 text-[var(--text-xs)] text-[var(--color-muted)]">
            {t("flowNotMeasured")}
          </p>
        )}
      </div>
    </li>
  );
}

function TrendText({ gauge: g }: { gauge: RiverGaugeState }) {
  const t = useTranslations("river");
  if (g.trend === null || g.deltaM === null) return null;
  const cm = Math.round(Math.abs(g.deltaM) * 100);
  const arrow = g.trend === "rising" ? "↑" : g.trend === "falling" ? "↓" : "→";
  return (
    <span
      className={
        g.trend === "rising"
          ? "font-medium text-[var(--color-ink-2)]"
          : undefined
      }
    >
      <span aria-hidden="true">{arrow} </span>
      {g.trend === "steady" ? t("steady") : t(g.trend, { cm })}
    </span>
  );
}

function InletRow({ row }: { row: Extract<RiverRow, { kind: "inlet" }> }) {
  const t = useTranslations("river");
  const locale = useLocale();
  const first = row.dams[0]!;
  const joins = locale === "th" ? first.joinsTh : first.joinsEn;
  const day = row.dams.map((d) => d.observedOn).find((x) => x !== null);
  const date = day
    ? new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Bangkok",
      }).format(new Date(`${day}T12:00:00+07:00`))
    : null;

  return (
    <li className="river-row">
      <Rail widthPx={row.widthPx} head={row.head}>
        <span className="river-inlet" />
      </Rail>
      <div className="pb-6">
        {/* Where they join, and the units, belong to the group: said once. */}
        <p className="pb-2 text-[var(--text-sm)] font-semibold text-[var(--color-ink)]">
          {t("inletJoins", { place: joins })}
        </p>
        <ul className="grid gap-2.5">
          {row.dams.map((d) => (
            <DamCard key={d.id} dam={d} />
          ))}
        </ul>
        <p className="pt-2 text-[var(--text-xs)] text-[var(--color-muted)]">
          {t("damUnit")}
          {date && <> {t("damDate", { date })}</>}
        </p>
      </div>
    </li>
  );
}

/**
 * A dam, and how full it is.
 *
 * The bar's scale runs to 120 % so that a reservoir over capacity visibly
 * spills past its 100 % mark. Clamping at full would hide the one fact that
 * forces a release. Over-capacity is carried by the hatching and the words,
 * not by a new colour — severity colours belong to water on the ground.
 */
function DamCard({ dam: d }: { dam: RiverDamState }) {
  const t = useTranslations("river");
  const locale = useLocale();
  const name = (locale === "th" ? d.nameTh : (d.nameEn ?? d.nameTh)) ?? d.id;
  const river = locale === "th" ? d.riverTh : d.riverEn;
  const one = new Intl.NumberFormat(locale === "th" ? "th-TH" : "en-GB", {
    maximumFractionDigits: 1,
  });

  const pct = d.storagePct;
  const scale = 120;
  const fill = pct === null ? 0 : Math.min(pct, 100);
  const spill = pct === null ? 0 : Math.max(0, Math.min(pct, scale) - 100);
  const over = pct !== null && pct > 100;

  return (
    <li className="rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper)] p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold text-[var(--color-ink)]">{name}</h3>
        {pct !== null && (
          <span className="text-[var(--text-sm)] font-semibold text-[var(--color-ink)] tabular-nums">
            {t("damFull", { pct: one.format(pct) })}
          </span>
        )}
      </div>
      <p className="pt-0.5 text-[var(--text-xs)] text-[var(--color-muted)]">
        {river}
      </p>

      {pct !== null ? (
        <div
          className="dam-bar mt-2.5"
          role="img"
          aria-label={t("damFull", { pct: one.format(pct) })}
        >
          <span
            className="dam-fill"
            style={{ width: `${(fill / scale) * 100}%` }}
          />
          {spill > 0 && (
            <span
              className="dam-spill"
              style={{
                left: `${(100 / scale) * 100}%`,
                width: `${(spill / scale) * 100}%`,
              }}
            />
          )}
          <span
            className="dam-full-mark"
            style={{ left: `${(100 / scale) * 100}%` }}
          />
        </div>
      ) : null}
      {over && (
        <p className="pt-1.5 text-[var(--text-xs)] font-semibold text-[var(--color-ink)]">
          {t("damOver")}
        </p>
      )}
      {pct === null ? (
        <p className="pt-2 text-[var(--text-sm)] text-[var(--color-muted)]">
          {t("damsMissing")}
        </p>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 pt-2.5 text-[var(--text-xs)]">
        <div>
          <dt className="text-[var(--color-muted)]">{t("damIn")}</dt>
          <dd className="font-semibold text-[var(--color-ink)] tabular-nums">
            {d.inflowMcm === null ? "—" : one.format(d.inflowMcm)}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">{t("damOut")}</dt>
          <dd className="font-semibold text-[var(--color-ink)] tabular-nums">
            {d.releasedMcm === null ? "—" : one.format(d.releasedMcm)}
          </dd>
        </div>
      </dl>
    </li>
  );
}

/* ---- Warnings ---------------------------------------------------------- */

/**
 * HII's own statements, as HII wrote them. Not translated: a machine
 * translation of an official warning is a new claim we would be making.
 */
function Warnings({
  data,
  failed,
}: {
  data: WarningsResponse | undefined;
  failed: boolean;
}) {
  const t = useTranslations("river");
  const locale = useLocale();
  const [all, setAll] = useState(false);

  const down = failed || data?.degraded;
  const list = data?.warnings ?? [];
  const shown = all ? list : list.slice(0, 3);

  return (
    <section
      aria-labelledby="hii-warnings"
      className="mt-5 rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-3"
    >
      <h3
        id="hii-warnings"
        className="text-[var(--text-sm)] font-semibold text-[var(--color-ink)]"
      >
        {t("warningsTitle")}
      </h3>

      {down ? (
        <p className="pt-1 text-[var(--text-sm)] text-[var(--color-ink-2)]">
          {t("warningsDown")}
        </p>
      ) : !data ? (
        <p className="pt-1 text-[var(--text-sm)] text-[var(--color-muted)]">
          …
        </p>
      ) : list.length === 0 ? (
        <p className="pt-1 text-[var(--text-sm)] text-[var(--color-ink-2)]">
          {t("warningsNone")}
        </p>
      ) : (
        <>
          {locale !== "th" && (
            <p className="pt-0.5 text-[var(--text-xs)] text-[var(--color-muted)]">
              {t("warningsThaiOnly")}
            </p>
          )}
          <ul className="divide-y divide-[var(--color-rule-2)] pt-1">
            {shown.map((w) => (
              <li key={w.id} className="py-2">
                <p
                  lang="th"
                  className="text-[var(--text-sm)] leading-relaxed text-[var(--color-ink)]"
                >
                  {w.messageTh}
                </p>
                <Freshness
                  at={w.issuedAt}
                  className="text-[var(--text-xs)] text-[var(--color-muted)]"
                />
              </li>
            ))}
          </ul>
          {list.length > 3 && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              aria-expanded={all}
              className="press mt-1 text-[var(--text-sm)] font-semibold text-[var(--color-accent)]"
            >
              {all
                ? t("warningsLess")
                : t("warningsMore", { count: list.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function RiverSkeleton() {
  return (
    <div className="mx-auto max-w-[42rem] px-4 pt-4" aria-hidden="true">
      <div className="h-6 w-3/4 rounded bg-[var(--color-paper-3)]" />
      <div className="mt-3 h-3 w-1/2 rounded bg-[var(--color-paper-3)]" />
      <div className="mt-8 grid gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[3rem_1fr] gap-3">
            <div className="mx-auto h-16 w-2 rounded bg-[var(--color-paper-3)]" />
            <div className="space-y-2">
              <div className="h-3 w-2/5 rounded bg-[var(--color-paper-3)]" />
              <div className="h-3 w-3/5 rounded bg-[var(--color-paper-3)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
