'use client';

import { useLocale, useTranslations } from 'next-intl';
import { DepthChip } from '../DepthChip.tsx';
import { Freshness } from '../Freshness.tsx';
import { ProvenanceBadge, ProvenanceMark } from '../Provenance.tsx';
import { isDepthBand } from '@/config/depth-bands.ts';
import { isExternal, isReport, isStation, type MapFeature } from '@/lib/api/map-types.ts';

/**
 * The List view. Hard rule 22 / SPEC §8.1: a peer of the Map, not a fallback —
 * it is the no-WebGL path and it must carry the same information.
 *
 * Every row shows severity (colour + pictogram + text), provenance and age.
 */
const STATION_CADENCE = 10;
const TRAFFY_CADENCE = 10;

export function FloodList({ features }: { features: readonly MapFeature[] }) {
  const t = useTranslations();
  const locale = useLocale();

  if (features.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="font-semibold text-[var(--color-ink)]">{t('list.empty')}</p>
        <p className="pt-1 text-[var(--text-sm)] text-[var(--color-muted)]">
          {t('map.emptyHint')}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[var(--color-rule-2)]">
      {features.map((f, i) => {
        const p = f.properties;

        return (
          <li
            key={`${p.layer}-${p.id}`}
            className="ink-on flex items-start gap-3 px-4 py-3"
            // One orchestrated entrance, capped so a long list does not ripple.
            style={{ animationDelay: `${Math.min(i, 8) * 28}ms` }}
          >
            <span
              className="mt-1 shrink-0 text-[var(--color-ink-2)]"
              title={t(
                `provenance.${p.provenance === 'official_sensor' ? 'officialSensor' : p.provenance === 'official_channel' ? 'officialChannel' : 'crowd'}`,
              )}
            >
              <ProvenanceMark level={p.provenance} className="size-3" />
            </span>

            <div className="min-w-0 flex-1">
              {isStation(p) && (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold text-[var(--color-ink)]">
                      {(locale === 'th' ? p.nameTh : p.nameEn) ?? p.nameTh ?? p.nameEn ?? p.id}
                    </span>
                    <StationStatus status={p.status} />
                  </div>
                  <p className="tabular pt-0.5 text-[var(--text-sm)] text-[var(--color-ink-2)]">
                    {p.value !== null && (
                      <>
                        {t('station.waterLevel')} {p.value.toFixed(2)} m
                      </>
                    )}
                    {p.value !== null && p.bankLevelM !== null && (
                      <>
                        {' · '}
                        {p.value >= p.bankLevelM
                          ? t('station.aboveBank', { meters: (p.value - p.bankLevelM).toFixed(2) })
                          : t('station.belowBank', { meters: (p.bankLevelM - p.value).toFixed(2) })}
                      </>
                    )}
                  </p>
                </>
              )}

              {isReport(p) && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {isDepthBand(p.depthBand) && <DepthChip band={p.depthBand} size="sm" />}
                    <span className="text-[var(--text-sm)] text-[var(--color-ink-2)]">
                      {t(`kind.${p.kind}`)}
                    </span>
                  </div>
                  {p.note && (
                    <p className="pt-1 text-[var(--text-sm)] text-[var(--color-ink-2)]">{p.note}</p>
                  )}
                </>
              )}

              {isExternal(p) && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--color-ink)]">
                      {p.description ?? t('kind.road')}
                    </span>
                    {p.state && (
                      <span className="rounded-[var(--radius-sm)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-1.5 py-0.5 text-[var(--text-xs)] text-[var(--color-ink-2)]">
                        {p.state}
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pt-1">
                <ProvenanceBadge
                  level={p.provenance}
                  source={isStation(p) || isExternal(p) ? p.source : null}
                />
                <span aria-hidden="true" className="text-[var(--color-rule)]">
                  ·
                </span>
                <Freshness
                  at={
                    isStation(p)
                      ? p.observedAt
                      : isExternal(p)
                        ? p.observedAt
                        : p.createdAt
                  }
                  cadenceMinutes={
                    isStation(p) ? STATION_CADENCE : isExternal(p) ? TRAFFY_CADENCE : undefined
                  }
                  className="text-[var(--text-xs)] text-[var(--color-muted)]"
                />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Station status: never colour alone — a word plus a tinted band. */
function StationStatus({ status }: { status: string }) {
  const t = useTranslations('station.status');
  const key = ['normal', 'watch', 'warning', 'critical', 'unknown'].includes(status)
    ? status
    : 'unknown';

  // Maps onto the spec-owned depth ramp so the two languages agree: an overbank
  // canal reads in the same colour as a deep road report.
  const token =
    key === 'critical' ? 'depth-4' : key === 'warning' ? 'depth-2' : key === 'watch' ? 'depth-1' : null;

  return (
    <span
      className="inline-flex items-center rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[var(--text-xs)] font-semibold"
      style={
        token
          ? {
              backgroundColor: `var(--color-${token})`,
              color: `var(--color-${token}-on)`,
              borderColor: `var(--color-${token}-border)`,
            }
          : {
              borderColor: 'var(--color-rule)',
              color: 'var(--color-muted)',
            }
      }
    >
      {t(key)}
    </span>
  );
}
