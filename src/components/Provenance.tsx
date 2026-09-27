import { useTranslations } from "next-intl";

/**
 * / official data and crowd data must always look
 * different, and every datum shows its source. There are three levels, not two
 * — Traffy Fondue is citizen-reported through the official BMA queue, which is
 * neither an agency sensor nor our own crowd.
 *
 * The three are distinguished by SHAPE, not colour: colour is fully spent on
 * the depth scale, and a fourth colour language would compete with severity.
 * Official_sensor  ▢ square   — a fixed instrument at a fixed place
 * official_channel ◇ diamond  — a filed case moving through a queue
 * crowd            ○ circle   — a person, standing somewhere
 */
export type ProvenanceLevel = "official_sensor" | "official_channel" | "crowd";

const LABEL_KEY: Record<ProvenanceLevel, string> = {
  official_sensor: "officialSensor",
  official_channel: "officialChannel",
  crowd: "crowd",
};

export function ProvenanceMark({
  level,
  className = "size-3",
}: {
  level: ProvenanceLevel;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true">
      {level === "official_sensor" && (
        <rect x="1.5" y="1.5" width="9" height="9" fill="currentColor" />
      )}
      {level === "official_channel" && (
        <path d="M6 0.8 11.2 6 6 11.2 0.8 6Z" fill="currentColor" />
      )}
      {level === "crowd" && (
        <circle
          cx="6"
          cy="6"
          r="4.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
      )}
    </svg>
  );
}

export function ProvenanceBadge({
  level,
  source,
}: {
  level: ProvenanceLevel;
  source?: string | null;
}) {
  const t = useTranslations("provenance");

  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--text-xs)] text-[var(--color-ink-2)]">
      <ProvenanceMark level={level} className="size-2.5 shrink-0" />
      <span>{t(LABEL_KEY[level])}</span>
      {source && <span className="text-[var(--color-muted)]">· {source}</span>}
    </span>
  );
}
