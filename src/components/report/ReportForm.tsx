"use client";

import { NOTE_MAX_LENGTH } from "@/config/app.config.ts";
import { DEPTH_BANDS, type DepthBandValue } from "@/config/depth-bands.ts";
import { BANGKOK_REGION_ID, districtsOf } from "@/config/regions.ts";
import { REPORT_KINDS } from "@/config/reports.ts";
import { Link } from "@/i18n/navigation.ts";
import { track } from "@/lib/analytics.ts";
import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { DepthPictogram } from "../DepthPictogram.tsx";
import { useGeolocation } from "../flood/useGeolocation.ts";
import { HelpNotice } from "./HelpNotice.tsx";
import { Turnstile, type TurnstileHandle } from "./Turnstile.tsx";

type Kind = (typeof REPORT_KINDS)[number];
type Vehicle = "motorbike" | "car" | "pickup" | "none";

const VEHICLES: readonly Vehicle[] = ["motorbike", "car", "pickup", "none"];

/**
 * One scrolling form, not a wizard. During a flood people abandon multi-step
 * flows, and every step is another chance to lose the report.
 */
export function ReportForm({ siteKey }: { siteKey: string | null }) {
  const t = useTranslations();
  const locale = useLocale() as "th" | "en";
  const geo = useGeolocation();

  const [depth, setDepth] = useState<DepthBandValue | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [districtTh, setDistrictTh] = useState("");
  const [roadName, setRoadName] = useState("");
  const [note, setNote] = useState("");
  const [passable, setPassable] = useState<Vehicle[]>([]);
  const [state, setState] = useState<"editing" | "sending" | "sent" | "error">(
    "editing",
  );
  const [problem, setProblem] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle | null>(null);

  const position = geo.state.status === "ready" ? geo.state : null;
  const missing = !position
    ? "location"
    : depth === null
      ? "depth"
      : kind === null
        ? "kind"
        : null;
  const blocked = siteKey === null;

  const started = useRef(false);
  const noteStarted = (): void => {
    if (!started.current) {
      started.current = true;
      track("report_started");
    }
  };

  const toggleVehicle = (v: Vehicle): void =>
    setPassable((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (missing !== null || !position || depth === null || kind === null)
      return;
    if (blocked) return;

    setState("sending");
    setProblem(null);
    try {
      // Run the challenge now, so the token is fresh when the server checks it.
      const token = await turnstile.current?.getToken();
      if (!token) {
        setProblem(t("report.verifyFailed"));
        setState("error");
        return;
      }

      const response = await fetch("/api/v1/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          depthBand: depth,
          lon: position.lon,
          lat: position.lat,
          note: note.trim() || undefined,
          districtTh: districtTh || undefined,
          roadName: roadName.trim() || undefined,
          locale,
          passableBy: passable.length > 0 ? passable : undefined,
          turnstileToken: token,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: { message_th: string; message_en: string };
        } | null;
        setProblem(
          body?.error
            ? locale === "th"
              ? body.error.message_th
              : body.error.message_en
            : null,
        );
        setState("error");
        track("report_failed");
        // The token is single-use, so a retry needs a fresh one.
        turnstile.current?.reset();
        return;
      }
      const body = (await response.json().catch(() => null)) as {
        id?: string;
      } | null;
      setNewId(body?.id ?? null);
      setState("sent");
      track("report_submitted", { depth_band: depth, report_kind: kind });
    } catch {
      setState("error");
      turnstile.current?.reset();
    }
  }

  if (state === "sent")
    return <Success isHelp={kind === "help"} reportId={newId} />;

  return (
    <form onSubmit={submit} className="space-y-7 pb-4">
      {blocked && (
        <p
          role="status"
          className="rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-3 py-2 text-[var(--text-sm)] text-[var(--color-ink-2)]"
        >
          {t("report.unavailable")}
        </p>
      )}

      <Step n={1} title={t("report.locationStep")}>
        <button
          type="button"
          onClick={geo.locate}
          disabled={geo.state.status === "locating"}
          className="btn press w-full border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] hover:bg-[color-mix(in_oklab,var(--color-accent-soft)_80%,var(--color-accent))] disabled:opacity-60"
        >
          <LocateGlyph />
          {geo.state.status === "locating"
            ? t("common.loading")
            : t("report.useGps")}
        </button>

        {position && (
          <p className="tabular pt-2 text-[var(--text-sm)] text-[var(--color-ink-2)]">
            {position.lat.toFixed(5)}, {position.lon.toFixed(5)}
            <span className="text-[var(--color-muted)]">
              {" "}
              · ±{Math.round(position.accuracyM)} m
            </span>
          </p>
        )}
        {(geo.state.status === "denied" ||
          geo.state.status === "unavailable") && (
          <p className="pt-2 text-[var(--text-sm)] text-[var(--color-ink-2)]">
            {t("report.gpsDenied")}
          </p>
        )}

        {/* No upstream source carries road geometry, and Traffy's address is
            subdistrict-level for flood cases — so the only reliable source for
            the road name is the person standing on it. */}
        <div className="pt-3">
          <label
            htmlFor="road"
            className="block pb-1.5 text-[var(--text-sm)] font-semibold text-[var(--color-ink)]"
          >
            {t("report.roadStep")}
          </label>
          <input
            id="road"
            type="text"
            inputMode="text"
            value={roadName}
            onChange={(e) => setRoadName(e.target.value.slice(0, 120))}
            placeholder={t("report.roadPlaceholder")}
            autoComplete="off"
            className="min-h-[var(--size-touch)] w-full rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 text-[var(--color-ink)] placeholder:text-[var(--color-muted)] hover:border-[var(--color-accent)] focus-visible:border-[var(--color-accent)]"
          />
          <p className="pt-1.5 text-[var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
            {t("report.roadHint")}
          </p>
        </div>

        {/* A coordinate alone is hard to act on. The district is how agencies,
            hotline operators and neighbours actually name a place, and we have
            no boundary polygons to derive it from — so the person reporting,
            who knows where they are standing, is the best source. */}
        <div className="pt-3">
          <label
            htmlFor="district"
            className="block pb-1.5 text-[var(--text-sm)] font-semibold text-[var(--color-ink)]"
          >
            {t("report.districtStep")}
          </label>
          <select
            id="district"
            value={districtTh}
            onChange={(e) => setDistrictTh(e.target.value)}
            data-touch
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 text-[var(--color-ink)] hover:border-[var(--color-accent)] focus-visible:border-[var(--color-accent)]"
          >
            <option value="">{t("report.districtUnsure")}</option>
            {districtsOf(BANGKOK_REGION_ID).map((r) => (
              <option key={r.id} value={r.nameTh}>
                {locale === "th" ? r.nameTh : `${r.nameEn} / ${r.nameTh}`}
              </option>
            ))}
          </select>
          <p className="pt-1.5 text-[var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
            {t("report.districtHint")}
          </p>
        </div>
      </Step>

      <Step n={2} title={t("report.depthStep")}>
        <div
          role="radiogroup"
          aria-label={t("report.depthStep")}
          className="grid gap-2.5"
        >
          {DEPTH_BANDS.map((b) => {
            const active = depth === b.band;
            return (
              <button
                key={b.band}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  noteStarted();
                  setDepth(b.band);
                }}
                className="press flex min-h-[calc(var(--size-touch)+0.5rem)] items-center gap-3 rounded-[var(--radius-md)] px-3.5 py-2.5 text-left"
                style={{
                  backgroundColor: `var(--color-${b.token})`,
                  color: `var(--color-${b.token}-on)`,
                  boxShadow: active
                    ? "0 0 0 2.5px var(--color-ink), 0 4px 12px rgb(0 0 0 / 0.2)"
                    : `inset 0 0 0 1.5px var(--color-${b.token}-border)`,
                }}
              >
                <DepthPictogram band={b.band} className="size-7 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">
                    {t(`depth.${b.band}.label`)}
                  </span>
                  <span className="block text-[var(--text-xs)] opacity-80">
                    {t(`depth.${b.band}.range`)} ·{" "}
                    {t(`depth.${b.band}.passability`)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Step>

      <Step n={3} title={t("report.kindStep")}>
        <div
          role="radiogroup"
          aria-label={t("report.kindStep")}
          className="grid grid-cols-2 gap-2.5"
        >
          {REPORT_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={
                "btn press " +
                (kind === k
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)] shadow-[0_0_0_1px_var(--color-accent)]"
                  : "btn-secondary")
              }
            >
              {t(`kind.${k}`)}
            </button>
          ))}
        </div>

        {kind === "help" && <HelpNotice />}
      </Step>

      <Step n={4} title={t("report.noteStep")} optional>
        <div className="space-y-3">
          <div>
            <span className="block pb-1.5 text-[var(--text-sm)] text-[var(--color-ink-2)]">
              {t("report.passableStep")}
            </span>
            <div className="flex flex-wrap gap-2.5">
              {VEHICLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={passable.includes(v)}
                  onClick={() => toggleVehicle(v)}
                  className="chip press"
                >
                  {t(`vehicle.${v}`)}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="sr-only">{t("report.noteStep")}</span>
            <textarea
              value={note}
              onChange={(e) =>
                setNote(e.target.value.slice(0, NOTE_MAX_LENGTH))
              }
              rows={3}
              placeholder={t("report.notePlaceholder")}
              className="w-full rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper)] p-3 text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
            />
            {/* The note is published verbatim. Under the PDPA a name, phone
                number or health detail typed here is personal data we never
                asked for and cannot un-publish, so say so before it is typed
                rather than in a notice further down. */}
            <span className="flex items-start justify-between gap-3 pt-1">
              <span className="text-[var(--text-xs)] leading-relaxed text-[var(--color-muted)]">
                {t("report.noteNoPersonal")}
              </span>
              <span className="tabular shrink-0 text-[var(--text-xs)] text-[var(--color-muted)]">
                {note.length} / {NOTE_MAX_LENGTH}
              </span>
            </span>
          </label>
        </div>
      </Step>

      <p className="text-[var(--text-sm)] text-[var(--color-muted)]">
        {t("report.privacyNote")}
      </p>

      {state === "error" && (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] border-2 border-[var(--color-alert)] bg-[var(--color-paper-2)] px-3 py-2"
        >
          <strong className="block text-[var(--color-ink)]">
            {t("report.errorTitle")}
          </strong>
          <span className="text-[var(--text-sm)] text-[var(--color-ink-2)]">
            {problem ?? t("report.errorBody")}
          </span>
        </p>
      )}

      {siteKey !== null && (
        <Turnstile
          siteKey={siteKey}
          onError={(reason) =>
            setProblem(`${t("report.verifyFailed")} (${reason})`)
          }
          handleRef={turnstile}
        />
      )}

      {/* A solid bar, not a floating button: the transparent version sat on top
          of the fields below it and hid them. */}
      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-[var(--color-rule)] bg-[var(--color-paper)] px-4 pt-3 pb-4">
        <button
          type="submit"
          disabled={missing !== null || state === "sending" || blocked}
          className="flex min-h-[calc(var(--size-touch)+4px)] w-full items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-[var(--text-lg)] font-semibold text-[var(--color-accent-ink)] shadow-[0_2px_10px_rgb(0_0_0/0.18)] transition-transform duration-[var(--dur-fast)] active:translate-y-px disabled:opacity-45"
        >
          {state === "sending"
            ? t("report.submitting")
            : kind === "help"
              ? t("report.submitHelp")
              : t("report.submit")}
        </button>
        {missing !== null && (
          <p className="text-center text-[var(--text-sm)] text-[var(--color-muted)]">
            {t(
              missing === "location"
                ? "report.locationRequired"
                : missing === "depth"
                  ? "report.depthRequired"
                  : "report.kindRequired",
            )}
          </p>
        )}
      </div>
    </form>
  );
}

const LocateGlyph = () => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" fill="currentColor" />
    <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M12 1.4v3.2M12 19.4v3.2M22.6 12h-3.2M4.6 12H1.4"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>
);

function Step({
  n,
  title,
  optional,
  children,
}: {
  n: number;
  title: string;
  optional?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <section className="space-y-2.5">
      <h2 className="flex items-center gap-2 text-[var(--text-lg)] font-bold text-[var(--color-ink)]">
        <span className="tabular inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-paper-3)] text-[var(--text-xs)] text-[var(--color-ink-2)]">
          {n}
        </span>
        {title}
        {optional === true && (
          <span className="text-[var(--text-xs)] font-normal text-[var(--color-muted)]">
            ({t("optional")})
          </span>
        )}
      </h2>
      {children}
    </section>
  );
}

function Success({
  isHelp,
  reportId,
}: {
  isHelp: boolean;
  reportId: string | null;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-5 text-center">
      {/* A help report is not a rescue request. Say so first, again. */}
      {isHelp && (
        <div className="text-left">
          <HelpNotice />
        </div>
      )}
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--color-accent-soft)]">
        <svg
          viewBox="0 0 24 24"
          className="size-7 text-[var(--color-accent)]"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m5 12.5 4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-[var(--text-xl)] font-bold text-[var(--color-ink)]">
          {isHelp ? t("report.successHelpTitle") : t("report.successTitle")}
        </h2>
        <p className="pt-1 text-[var(--color-ink-2)]">
          {isHelp ? t("report.successHelpBody") : t("report.successBody")}
        </p>
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] p-4 text-left">
        <h3 className="font-semibold text-[var(--color-ink)]">
          {t("report.traffyTitle")}
        </h3>
        <p className="pt-1 text-[var(--text-sm)] text-[var(--color-ink-2)]">
          {t("report.traffyBody")}
        </p>
        <a
          href="https://share.traffy.in.th/teamchadchart"
          target="_blank"
          rel="noreferrer noopener"
          data-touch
          className="mt-2 inline-flex min-h-[var(--size-touch)] items-center font-medium text-[var(--color-accent)] underline underline-offset-4"
        >
          {t("report.traffyCta")}
        </a>
      </div>

      {/* A 12 px dot among a thousand points is not findable by scanning, and
          "did it work?" is the first thing anyone asks after submitting. The
          id goes in the query, never the coordinates — those stay off the URL
          (hard rule: no personal data in query strings). */}
      <Link
        href={reportId ? { pathname: "/", query: { report: reportId } } : "/"}
        data-touch
        className="btn btn-primary press w-full"
      >
        {reportId ? t("report.seeOnMap") : t("report.backToMap")}
      </Link>
    </div>
  );
}
