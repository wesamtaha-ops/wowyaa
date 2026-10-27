import type { ActivityItem, AgeBand, MasteryState, Skill } from '@huroofi/content-schema';
import { createRng, deriveSeed } from '@huroofi/game-core';
import { MASTERY_CONFIG_V1, type MasteryConfig } from './config';
import { SCHEDULER_CONFIG_V1, type SchedulerConfig } from './scheduler-config';

/**
 * Adaptive scheduler v1 (plan §10): explicit, auditable heuristics. Every pick carries
 * `reasonCodes` so a parent screen or a reviewer can see why it was chosen.
 */

export type SkillStatus =
  | 'review_due'
  | 'remediation'
  | 'weak_skill'
  | 'new_skill'
  | 'mastered'
  | 'locked'
  | 'out_of_age_band';

export interface SkillView {
  skillId: string;
  status: SkillStatus;
  mastery: number;
  reasonCodes: string[];
}

export interface PlannedItem {
  activityId: string;
  reasonCodes: string[];
}

export interface SessionPlan {
  algorithmVersion: string;
  items: PlannedItem[];
  /** Activities not eligible this session, with why (locked, age band). */
  excluded: Array<{ activityId: string; reasonCodes: string[] }>;
}

export interface SchedulerInput {
  skills: readonly Skill[];
  /** Already filtered to what this device can run (capabilities, assets). */
  activities: readonly ActivityItem[];
  states: readonly MasteryState[];
  ageBand: AgeBand;
  sessionSeed: number;
  nowMs: number;
  length: number;
}

export function createScheduler(
  config: SchedulerConfig = SCHEDULER_CONFIG_V1,
  mastery: MasteryConfig = MASTERY_CONFIG_V1,
) {
  function skillViews(
    input: Omit<SchedulerInput, 'sessionSeed' | 'length'>,
  ): Map<string, SkillView> {
    const byId = new Map(input.skills.map((s) => [s.skillId, s]));
    const stateOf = new Map(input.states.map((s) => [s.skillId, s]));
    const practicable = new Set(input.activities.flatMap((a) => a.targetSkillIds));

    const mastered = (skill: Skill) => {
      const s = stateOf.get(skill.skillId);
      return (
        !!s && s.mastery >= skill.passPolicy.minMastery && s.correct >= skill.passPolicy.minCorrect
      );
    };
    // Skills that need remediation because a dependent skill keeps failing.
    const remediate = new Set<string>();
    for (const s of input.states) {
      if (lastWasIncorrect(s) && s.incorrect >= 2) {
        for (const r of byId.get(s.skillId)?.remediationSkillIds ?? []) remediate.add(r);
      }
    }

    const views = new Map<string, SkillView>();
    for (const skill of input.skills) {
      const s = stateOf.get(skill.skillId);
      const m = s?.mastery ?? mastery.startingMastery;
      const view = (status: SkillStatus, ...codes: string[]): SkillView => ({
        skillId: skill.skillId,
        status,
        mastery: m,
        reasonCodes: codes,
      });
      if (!skill.targetAgeBand.includes(input.ageBand)) {
        views.set(skill.skillId, view('out_of_age_band', `age_band:${input.ageBand}`));
        continue;
      }
      // A prerequisite with no playable activity can't produce evidence on this device;
      // treating it as blocking would lock the whole curriculum, so it counts as met.
      const unmet = skill.prerequisites.filter((p) => {
        const pre = byId.get(p);
        return pre !== undefined && practicable.has(p) && !mastered(pre);
      });
      if (unmet.length > 0) {
        views.set(skill.skillId, view('locked', ...unmet.map((p) => `needs:${p}`)));
        continue;
      }
      if (!s || s.exposures === 0) {
        views.set(skill.skillId, view(remediate.has(skill.skillId) ? 'remediation' : 'new_skill'));
      } else if (s.nextReviewAtMs !== null && s.nextReviewAtMs <= input.nowMs && mastered(skill)) {
        views.set(skill.skillId, view('review_due'));
      } else if (remediate.has(skill.skillId) || lastWasIncorrect(s)) {
        views.set(skill.skillId, view('remediation'));
      } else if (!mastered(skill)) {
        views.set(skill.skillId, view('weak_skill'));
      } else {
        views.set(skill.skillId, view('mastered'));
      }
    }
    return views;
  }

  function weightOf(view: SkillView): number {
    const w = config.weights;
    switch (view.status) {
      case 'review_due':
        return w.reviewDue;
      case 'remediation':
        return w.remediation;
      case 'weak_skill':
        return w.weak * (1 - view.mastery) + config.minWeight;
      case 'new_skill':
        return w.newSkill;
      case 'mastered':
        return w.confidence;
      default:
        return 0;
    }
  }

  function plan(input: SchedulerInput): SessionPlan {
    const views = skillViews(input);
    const candidates: Candidate[] = [];
    const excluded: SessionPlan['excluded'] = [];

    for (const item of input.activities) {
      const targets = item.targetSkillIds.map((id) => views.get(id));
      const blocked = targets.flatMap((v) =>
        v && (v.status === 'locked' || v.status === 'out_of_age_band') ? v.reasonCodes : [],
      );
      if (blocked.length > 0) {
        excluded.push({ activityId: item.activityId, reasonCodes: [...new Set(blocked)] });
        continue;
      }
      // The strongest reason among the item's skills drives its weight.
      let best: SkillView | undefined;
      for (const v of targets) if (v && (!best || weightOf(v) > weightOf(best))) best = v;
      if (!best) {
        excluded.push({ activityId: item.activityId, reasonCodes: ['no_known_skill'] });
        continue;
      }
      const factor = item.purpose === 'assessment' ? config.assessmentFactor : 1;
      candidates.push({
        item,
        weight: Math.max(config.minWeight, weightOf(best) * factor),
        reasons: [best.status, `skill:${best.skillId}`],
      });
    }

    // Sorting first makes the weighted draw independent of input order.
    candidates.sort((a, b) => a.item.activityId.localeCompare(b.item.activityId));
    const rng = createRng(deriveSeed(input.sessionSeed, config.version));
    const items: PlannedItem[] = [];
    const types: string[] = [];
    const pool = candidates.slice();
    const isPriority = (c: Candidate) =>
      c.reasons[0] === 'review_due' || c.reasons[0] === 'remediation';
    const prioritySlots = Math.ceil(input.length * config.priorityShare);

    while (items.length < input.length && pool.length > 0) {
      // Tier 1: overdue reviews and remediation get the first slots (plan §10 step 3).
      const tier =
        items.length < prioritySlots && pool.some(isPriority) ? pool.filter(isPriority) : pool;
      // Variety cap: avoid a long run of one type while another type is available.
      const recent = types.slice(-config.maxSameTypeRun);
      const runType =
        recent.length === config.maxSameTypeRun && recent.every((t) => t === recent[0])
          ? recent[0]
          : null;
      const varied = runType ? tier.filter((c) => c.item.type !== runType) : tier;
      const choices = varied.length > 0 ? varied : tier;

      const total = choices.reduce((sum, c) => sum + c.weight, 0);
      let r = rng() * total;
      let picked = choices[choices.length - 1] as Candidate;
      for (const c of choices) {
        if (r < c.weight) {
          picked = c;
          break;
        }
        r -= c.weight;
      }
      pool.splice(pool.indexOf(picked), 1);
      types.push(picked.item.type);
      items.push({
        activityId: picked.item.activityId,
        reasonCodes: [
          ...picked.reasons,
          ...(tier !== pool && isPriority(picked) ? ['priority_slot'] : []),
          ...(runType && picked.item.type === runType ? ['variety_unavailable'] : []),
          `weight:${round(picked.weight)}`,
        ],
      });
    }
    return { algorithmVersion: config.version, items, excluded };
  }

  return {
    version: config.version,
    skillViews,
    plan,
    /** The single-pick form of the plan §6.2 `selectNext` contract. */
    selectNext(input: Omit<SchedulerInput, 'length'>): PlannedItem | null {
      return plan({ ...input, length: 1 }).items[0] ?? null;
    },
  };
}

export const schedulerV1 = createScheduler();

interface Candidate {
  item: ActivityItem;
  weight: number;
  reasons: string[];
}

/** mastery-v1 sets nextReviewAtMs to the attempt time on a miss (due immediately). */
function lastWasIncorrect(s: MasteryState): boolean {
  return s.consecutiveCorrect === 0 && s.incorrect > 0 && s.nextReviewAtMs === s.lastPracticedAtMs;
}

const round = (n: number) => Math.round(n * 1000) / 1000;
