import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { migrate, RepositoryError, SqliteProgressRepository } from '../src';
import { openNodeSqlite } from '../src/node-driver';
import { attempt, deps, freshRepo, T0 } from './helpers';

const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('ProgressRepository', () => {
  it('creates children with default parent settings and NFC names', async () => {
    const { repo, db } = await freshRepo();
    const id = await repo.createChild({
      displayName: '  سَارَة '.normalize('NFD'),
      ageBand: '7-9',
    });
    const [child] = await repo.listChildren();
    expect(child).toMatchObject({
      id,
      displayName: 'سَارَة',
      ageBand: '7-9',
      avatarId: 'faseeh_default',
    });
    expect(child?.displayName).toBe(child?.displayName.normalize('NFC'));
    expect(
      await db.first('SELECT daily_play_limit_min, optional_data_collection FROM parent_settings'),
    ).toEqual({
      daily_play_limit_min: 20,
      optional_data_collection: 0,
    });
  });

  it('validates profile input', async () => {
    const { repo } = await freshRepo();
    await expect(repo.createChild({ displayName: '   ', ageBand: '4-6' })).rejects.toThrow(
      RepositoryError,
    );
    await expect(
      repo.createChild({ displayName: 'x', ageBand: '10-12' as '4-6' }),
    ).rejects.toThrow();
  });

  it('requires an active content pack to start a session', async () => {
    const db = openNodeSqlite();
    await migrate(db);
    const repo = new SqliteProgressRepository(deps(db));
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    await expect(repo.startSession(child, 1)).rejects.toMatchObject({ code: 'no_active_pack' });
  });

  it('keeps exactly one active content pack', async () => {
    const { repo, db } = await freshRepo();
    await repo.activateContentPack({
      packId: 'ar-foundations-v1',
      version: '1.0.1',
      schemaVersion: 1,
      checksumSha256: 'b'.repeat(64),
    });
    expect(await db.all('SELECT version FROM content_packs WHERE is_active = 1')).toEqual([
      { version: '1.0.1' },
    ]);
    expect(await repo.getActiveContentPack()).toMatchObject({ version: '1.0.1' });
  });

  it('writes attempt, evidence and mastery atomically', async () => {
    const { repo, db } = await freshRepo();
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const session = await repo.startSession(child, 42);
    expect(await repo.recordAttempt(attempt(child, session, 'att-1'))).toBe('recorded');
    const mastery = await repo.getMastery(child);
    expect(mastery.map((m) => [m.skillId, m.mastery, m.correct])).toEqual([
      ['decode.cvcvc_fatha', 0.33, 1],
      ['letter.qaf.sound', 0.33, 1],
    ]);
    expect(await db.first('SELECT COUNT(*) AS n FROM skill_evidence')).toEqual({ n: 2 });
  });

  it('rolls back the attempt when the mastery write fails', async () => {
    const db = openNodeSqlite();
    await migrate(db);
    const failing = {
      ...deps(db),
      mastery: {
        initialState: deps(db).mastery.initialState,
        update: () => {
          throw new Error('boom');
        },
      },
    };
    const repo = new SqliteProgressRepository(failing);
    await repo.activateContentPack({
      packId: 'p',
      version: '1.0.0',
      schemaVersion: 1,
      checksumSha256: 'c'.repeat(64),
    });
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const session = await repo.startSession(child, 1);
    await expect(repo.recordAttempt(attempt(child, session, 'att-x'))).rejects.toThrow('boom');
    expect(await db.first('SELECT COUNT(*) AS n FROM activity_attempts')).toEqual({ n: 0 });
    expect(await db.first('SELECT COUNT(*) AS n FROM skill_evidence')).toEqual({ n: 0 });
  });

  it('treats a duplicate attemptId as a no-op', async () => {
    const { repo } = await freshRepo();
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const session = await repo.startSession(child, 1);
    expect(await repo.recordAttempt(attempt(child, session, 'att-1'))).toBe('recorded');
    expect(await repo.recordAttempt(attempt(child, session, 'att-1'))).toBe('duplicate');
    expect((await repo.getMastery(child))[0]).toMatchObject({ exposures: 1, correct: 1 });
  });

  it('is idempotent under concurrent duplicate submissions (double-tap)', async () => {
    const { repo } = await freshRepo();
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const session = await repo.startSession(child, 1);
    const outcomes = await Promise.all(
      Array.from({ length: 5 }, () => repo.recordAttempt(attempt(child, session, 'tap'))),
    );
    expect(outcomes.filter((o) => o === 'recorded')).toHaveLength(1);
    expect((await repo.getMastery(child))[0]?.exposures).toBe(1);
  });

  it('indeterminate evidence never lowers mastery', async () => {
    const { repo } = await freshRepo();
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const session = await repo.startSession(child, 1);
    await repo.recordAttempt(
      attempt(child, session, 'a1', {
        status: 'indeterminate',
        provenance: 'hybrid',
        scoreDelta: 0,
      }),
    );
    expect((await repo.getMastery(child)).map((m) => m.mastery)).toEqual([0.25, 0.25]);
  });

  it('rejects attempts for a session owned by another child, or a closed session', async () => {
    const { repo } = await freshRepo();
    const a = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const b = await repo.createChild({ displayName: 'b', ageBand: '4-6' });
    const session = await repo.startSession(a, 1);
    await expect(repo.recordAttempt(attempt(b, session, 'x'))).rejects.toMatchObject({
      code: 'session_child_mismatch',
    });
    await repo.endSession(session, 'complete');
    await expect(repo.recordAttempt(attempt(a, session, 'y'))).rejects.toMatchObject({
      code: 'session_closed',
    });
    expect(await repo.getMastery(a)).toEqual([]);
  });

  it('rejects malformed evaluation results at the boundary', async () => {
    const { repo } = await freshRepo();
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const session = await repo.startSession(child, 1);
    await expect(
      repo.recordAttempt(attempt(child, session, 'z', { targetSkillIds: [] })),
    ).rejects.toMatchObject({
      code: 'invalid_input',
    });
  });

  it('deleting a child cascades to every child-derived table', async () => {
    const { repo, db } = await freshRepo();
    const keep = await repo.createChild({ displayName: 'keep', ageBand: '4-6' });
    const gone = await repo.createChild({ displayName: 'gone', ageBand: '4-6' });
    for (const child of [keep, gone]) {
      const s = await repo.startSession(child, 1);
      await repo.recordAttempt(attempt(child, s, `att-${child}`));
    }
    await repo.deleteChildData(gone);
    const counts = await db.first<Record<string, number>>(`SELECT
      (SELECT COUNT(*) FROM child_profiles WHERE id = '${gone}') AS profiles,
      (SELECT COUNT(*) FROM parent_settings WHERE child_id = '${gone}') AS settings,
      (SELECT COUNT(*) FROM learning_sessions WHERE child_id = '${gone}') AS sessions,
      (SELECT COUNT(*) FROM activity_attempts WHERE child_id = '${gone}') AS attempts,
      (SELECT COUNT(*) FROM skill_evidence WHERE attempt_id = 'att-${gone}') AS evidence,
      (SELECT COUNT(*) FROM skill_mastery WHERE child_id = '${gone}') AS mastery`);
    expect(counts).toEqual({
      profiles: 0,
      settings: 0,
      sessions: 0,
      attempts: 0,
      evidence: 0,
      mastery: 0,
    });
    expect(await repo.getMastery(keep)).toHaveLength(2);
  });

  it('survives an app kill mid-session and recovers stale sessions on relaunch', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'huroofi-kill-'));
    dirs.push(dir);
    const path = join(dir, 'db.sqlite');
    const first = await freshRepo(path);
    const child = await first.repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const session = await first.repo.startSession(child, 9);
    await first.repo.recordAttempt(attempt(child, session, 'before-kill'));
    await first.db.close(); // simulated kill: no endSession

    const db = openNodeSqlite(path);
    await migrate(db);
    const repo = new SqliteProgressRepository(deps(db, T0 + 60 * 60_000));
    expect(await repo.abandonStaleSessions(T0 + 30 * 60_000)).toBe(1);
    const [s] = await repo.listRecentSessions(child, 5);
    expect(s).toMatchObject({ id: session, status: 'abandoned', attemptCount: 1 });
    expect((await repo.getMastery(child))[0]?.correct).toBe(1);
    await db.close();
  });

  it('stores UTC epoch ms independent of device timezone', async () => {
    const original = process.env.TZ;
    try {
      const { repo } = await freshRepo();
      const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
      process.env.TZ = 'Asia/Riyadh';
      const s1 = await repo.startSession(child, 1);
      await repo.recordAttempt(attempt(child, s1, 'riyadh', {}, T0));
      process.env.TZ = 'America/Los_Angeles';
      const s2 = await repo.startSession(child, 2);
      await repo.recordAttempt(attempt(child, s2, 'la', {}, T0 + 1000));
      const sessions = await repo.listRecentSessions(child, 10);
      expect(sessions.map((s) => s.id)).toEqual([s2, s1]);
      expect((await repo.getMastery(child))[0]?.lastPracticedAtMs).toBe(T0 + 1000);
    } finally {
      process.env.TZ = original;
    }
  });

  it('language/device setting changes do not touch learner progress', async () => {
    const { repo } = await freshRepo();
    const child = await repo.createChild({ displayName: 'a', ageBand: '4-6' });
    const s = await repo.startSession(child, 1);
    await repo.recordAttempt(attempt(child, s, 'a1'));
    const before = await repo.getMastery(child);
    await repo.setDeviceSetting('ui.locale', 'ar');
    await repo.setDeviceSetting('ui.locale', 'en');
    expect(await repo.getDeviceSetting('ui.locale')).toBe('en');
    expect(await repo.getMastery(child)).toEqual(before);
  });

  it('handles 10k synthetic attempts within a generous Node budget', async () => {
    const { repo } = await freshRepo();
    const child = await repo.createChild({ displayName: 'load', ageBand: '7-9' });
    const sessions = await Promise.all(
      Array.from({ length: 50 }, (_, i) => repo.startSession(child, i)),
    );
    const writeStart = performance.now();
    for (let i = 0; i < 10_000; i++) {
      await repo.recordAttempt(
        attempt(
          child,
          sessions[i % 50] as string,
          `load-${i}`,
          {
            status: i % 3 === 0 ? 'incorrect' : 'correct',
            targetSkillIds: [`letter.s${i % 28}.sound`],
          },
          T0 + i,
        ),
      );
    }
    const writeMs = performance.now() - writeStart;
    const readStart = performance.now();
    const mastery = await repo.getMastery(child);
    const recent = await repo.listRecentSessions(child, 7);
    const readMs = performance.now() - readStart;
    expect(mastery).toHaveLength(28);
    expect(mastery.reduce((n, m) => n + m.exposures, 0)).toBe(10_000);
    expect(recent).toHaveLength(7);
    // Node-on-CI sanity bounds only; device budgets are measured in M4 device benchmarks.
    expect(readMs).toBeLessThan(250);
    expect(writeMs).toBeLessThan(30_000);
    console.info(
      `[perf] 10k attempts: write ${writeMs.toFixed(0)} ms, read ${readMs.toFixed(1)} ms (node:sqlite, in-memory)`,
    );
  }, 60_000);
});
