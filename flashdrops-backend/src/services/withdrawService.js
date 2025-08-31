'use strict';

const db = require('../db');

/**
 * Создаём/чиним схему withdraw_queue и даём воркеру понятные логи,
 * чтобы было видно, что он тикает и что он делает.
 */
async function ensureSchema() {
  const sql = `
    create table if not exists withdraw_queue (
      id           bigserial primary key,
      user_id      bigint,
      item_name    text,
      amount_rub   numeric(12,2) default 0,
      status       text not null default 'queued', -- queued|processing|done|error
      error_msg    text,
      created_at   timestamptz not null default now(),
      updated_at   timestamptz not null default now()
    );

    create index if not exists withdraw_queue_status_idx on withdraw_queue(status);

    alter table withdraw_queue add column if not exists user_id    bigint;
    alter table withdraw_queue add column if not exists item_name  text;
    alter table withdraw_queue add column if not exists amount_rub numeric(12,2) default 0;
    alter table withdraw_queue add column if not exists status     text not null default 'queued';
    alter table withdraw_queue add column if not exists error_msg  text;
    alter table withdraw_queue add column if not exists created_at timestamptz not null default now();
    alter table withdraw_queue add column if not exists updated_at timestamptz not null default now();

    do $$
    begin
      if exists(
        select 1 from information_schema.columns
        where table_name='withdraw_queue' and column_name='item'
      )
      and not exists(
        select 1 from information_schema.columns
        where table_name='withdraw_queue' and column_name='item_name'
      )
      then
        execute 'alter table withdraw_queue rename column "item" to item_name';
      end if;
    end$$;

    do $$
    begin
      if exists(
        select 1 from information_schema.columns
        where table_name='withdraw_queue' and column_name='amount'
      )
      and not exists(
        select 1 from information_schema.columns
        where table_name='withdraw_queue' and column_name='amount_rub'
      )
      then
        execute 'alter table withdraw_queue rename column "amount" to amount_rub';
      end if;
    end$$;

    alter table withdraw_queue
      alter column status set default 'queued';

    do $$
    begin
      if not exists(
        select 1 from pg_trigger where tgname = 'trg_withdraw_queue_updated_at'
      ) then
        create or replace function set_withdraw_queue_updated_at()
        returns trigger as $body$
        begin
          new.updated_at := now();
          return new;
        end
        $body$ language plpgsql;

        create trigger trg_withdraw_queue_updated_at
        before update on withdraw_queue
        for each row execute function set_withdraw_queue_updated_at();
      end if;
    end$$;
  `;
  await db.query(sql);
}

const VERBOSE = (process.env.WITHDRAW_VERBOSE || '').toLowerCase() === 'true';

async function tickWithdrawBatch() {
  let client;
  const startedAt = new Date();
  try {
    client = await db.getClient();
    await client.query('begin');

    const q = `
      select id, user_id, item_name, amount_rub
        from withdraw_queue
       where status = 'queued'
       order by id
       for update skip locked
       limit 20
    `;
    const { rows } = await client.query(q);

    if (VERBOSE) {
      console.log(`[withdraw] tick @${startedAt.toISOString()} queued=${rows.length}`);
    }

    if (rows.length) {
      const ids = rows.map(r => r.id);
      await client.query(
        `update withdraw_queue
            set status='processing', updated_at=now()
          where id = any($1::bigint[])`,
        [ids]
      );

      // Здесь должен быть реальный вызов провайдера/бота. Сейчас — мгновенно done.
      await client.query(
        `update withdraw_queue
            set status='done', updated_at=now()
          where id = any($1::bigint[])`,
        [ids]
      );

      console.log(`[withdraw] processed ${ids.length} item(s): [${ids.join(', ')}]`);
    } else {
      // чтобы было видно, что тик идёт, даже когда задач нет
      console.log('[withdraw] tick: no tasks');
    }

    await client.query('commit');
  } catch (e) {
    if (client) await client.query('rollback');
    console.warn('[withdraw] worker tick error:', e.message);
  } finally {
    if (client) client.release();
  }
}

function startWithdrawWorker(intervalMs = 5000) {
  (async () => {
    try {
      await ensureSchema();
      console.log(`✔ withdraw worker started (every ${intervalMs}ms)`);
    } catch (e) {
      console.warn('[withdraw] ensure schema error:', e.message);
    }
  })();

  setInterval(tickWithdrawBatch, intervalMs);
}

module.exports = { startWithdrawWorker };
