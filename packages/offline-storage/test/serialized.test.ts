import { describe, expect, it } from 'vitest';
import { openNodeSqlite } from '../src/node-driver';

describe('serialized driver', () => {
  it('does not let outside statements interleave with an open transaction', async () => {
    const db = openNodeSqlite();
    await db.exec('CREATE TABLE log (v TEXT)');
    const order: string[] = [];
    const tx = db.transaction(async (t) => {
      await t.run("INSERT INTO log VALUES ('tx-1')");
      await new Promise((r) => setTimeout(r, 20));
      await t.run("INSERT INTO log VALUES ('tx-2')");
      order.push('tx-done');
      throw new Error('abort');
    });
    const outside = db
      .run("INSERT INTO log VALUES ('outside')")
      .then(() => order.push('outside-done'));
    await expect(tx).rejects.toThrow('abort');
    await outside;
    expect(order).toEqual(['tx-done', 'outside-done']);
    // The rolled-back transaction left nothing; the later statement committed alone.
    expect(await db.all('SELECT v FROM log')).toEqual([{ v: 'outside' }]);
  });
});
