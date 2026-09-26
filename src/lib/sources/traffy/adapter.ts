import { readFileSync } from 'node:fs';
import { APP } from '@/config/app.config.ts';
import type { IngestPayload, SourceAdapter } from '../types.ts';
import { normalizeTraffy } from './normalize.ts';

/**
 * Traffy Fondue (BMA × NECTEC) adapter. Contract: `docs/sources/traffy.md`.
 *
 * Provenance `official_channel` — citizen-reported, agency-tracked. Hard rule 2:
 * this is neither an official sensor reading nor our own crowd data, and the UI
 * must render it as its own third category.
 */

const ENDPOINT = 'https://publicapi.traffy.in.th/teamchadchart-stat-api/geojson/v1';

/**
 * The default response caps at 300 features ordered by creation time descending.
 * `limit` is a confirmed parameter, so we ask for a wider window than the cap.
 *
 * We deliberately do NOT use the `problem_type` server filter: whether it is an
 * "array contains" or an exact single-tag match is unverified, and flood items
 * are already ~84% of recent traffic so the bandwidth saving is small. Filtering
 * locally against a known predicate is the safer trade.
 */
const LIMIT = 1000;

export const traffyAdapter: SourceAdapter = {
  id: 'traffy',
  provenance: 'official_channel',
  cadenceMinutes: 10,
  attribution: {
    nameTh: 'ทราฟฟี่ ฟองดูว์ — กรุงเทพมหานคร ร่วมกับ เนคเทค สวทช.',
    nameEn: 'Traffy Fondue — Bangkok Metropolitan Administration with NECTEC, NSTDA',
    url: 'https://share.traffy.in.th/teamchadchart',
    terms:
      'No published licence or API terms as of 26 Sep 2026. Public endpoint used with ' +
      'attribution and polite polling pending written confirmation from NECTEC/BMA.',
  },

  async fetchRaw(signal) {
    const url = new URL(ENDPOINT);
    url.searchParams.set('limit', String(LIMIT));

    const response = await fetch(url, {
      signal,
      headers: {
        // Hard rule 13: identify ourselves.
        'user-agent': APP.userAgent,
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`${ENDPOINT} responded ${response.status} ${response.statusText}`);
    }
    return response.json();
  },

  normalize(raw): IngestPayload {
    return normalizeTraffy(raw);
  },

  loadFixture() {
    return JSON.parse(
      readFileSync(new URL('./fixtures/flood-bangkok.json', import.meta.url), 'utf8'),
    );
  },
};
