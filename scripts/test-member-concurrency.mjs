import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
const project = /^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m.exec(
  readFileSync("supabase/config.toml", "utf8"),
)?.[1];
if (!project) throw new Error("Proyecto local no encontrado.");
const agency = randomUUID(),
  owner = randomUUID(),
  admin = randomUUID(),
  seller = randomUUID();
function session() {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      `supabase_db_${project}`,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-X",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
      "-v",
      "VERBOSITY=verbose",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  let output = "",
    errors = "";
  const waiters = [];
  const done = new Promise((resolve, reject) => {
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
      for (const notify of waiters) notify();
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      errors += chunk;
    });
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", (code) => {
      resolve({ code, output: output.trim(), errors });
      for (const notify of waiters) notify();
    });
  });
  return {
    done,
    send: (source) => child.stdin.write(source + "\n"),
    end: (source = "") => child.stdin.end(source),
    marker: (value) =>
      new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("No se obtuvo la barrera PostgreSQL local.")),
          10000,
        );
        const notify = () => {
          if (output.includes(value)) {
            clearTimeout(timeout);
            resolve();
          } else if (child.exitCode !== null) {
            clearTimeout(timeout);
            reject(new Error("La conexión terminó antes de la barrera."));
          }
        };
        waiters.push(notify);
        notify();
      }),
  };
}
async function sql(source) {
  const connection = session();
  connection.end(source);
  return connection.done;
}
async function checked(source) {
  const result = await sql(source);
  assert.equal(result.code, 0, "Falló una operación del fixture local.");
  return result.output;
}
function authenticated(user, command) {
  return `begin; set local role authenticated; set local request.jwt.claims='{"sub":"${user}","role":"authenticated"}'; ${command}; commit;`;
}
try {
  await checked(`begin;
    insert into auth.users(id,email,email_confirmed_at,encrypted_password) values
      ('${owner}','qa-${owner}@example.test',now(),'synthetic'),('${admin}','qa-${admin}@example.test',now(),'synthetic'),('${seller}','qa-${seller}@example.test',now(),'synthetic');
    insert into public.profiles(id,display_name) values ('${owner}','QA owner'),('${admin}','QA admin'),('${seller}','QA seller');
    insert into public.agencies(id,name,slug,ars_per_usd) values ('${agency}','QA member concurrency','qa-members-${agency}',1000);
    insert into public.memberships(agency_id,user_id,role) values ('${agency}','${owner}','agency_superadmin'),('${agency}','${admin}','admin'),('${agency}','${seller}','seller'); commit;`);
  const sellerMembership = await checked(
    `select id from public.memberships where agency_id='${agency}' and user_id='${seller}';`,
  );
  const adminMembership = await checked(
    `select id from public.memberships where agency_id='${agency}' and user_id='${admin}';`,
  );
  assert.match(sellerMembership, /^[0-9a-f-]{36}$/);
  assert.match(adminMembership, /^[0-9a-f-]{36}$/);
  const command = `select public.set_agency_member_active('${agency}','${sellerMembership}',false,true)`;
  const race = await Promise.all([
    sql(authenticated(owner, command)),
    sql(authenticated(admin, command)),
  ]);
  assert.equal(race.filter((result) => result.code === 0).length, 1);
  assert.ok(race.find((result) => result.code !== 0)?.errors.includes("40001"));
  assert.equal(
    await checked(
      `select count(*) from public.audit_events where membership_id='${sellerMembership}'`,
    ),
    "1",
  );
  const roleCommand = `select public.set_agency_member_role('${agency}','${sellerMembership}','admin','seller',false)`;
  const roleRace = await Promise.all([
    sql(authenticated(owner, roleCommand)),
    sql(authenticated(owner, roleCommand)),
  ]);
  assert.equal(roleRace.filter((result) => result.code === 0).length, 1);
  assert.ok(
    roleRace.find((result) => result.code !== 0)?.errors.includes("40001"),
  );
  assert.equal(
    await checked(
      `select count(*) from public.audit_events where membership_id='${sellerMembership}' and action='membership.role_changed' and previous_role='seller' and new_role='admin'`,
    ),
    "1",
  );
  assert.equal(
    await checked(
      `select is_active from public.memberships where id='${sellerMembership}'`,
    ),
    "f",
  );
  // Both status and role changes must avoid cycles with an in-flight invitation.
  for (const [index, operation] of [
    `select public.set_agency_member_active('${agency}','${adminMembership}',false,true)`,
    `select public.set_agency_member_role('${agency}','${adminMembership}','seller','admin',true)`,
  ].entries()) {
    const revoker = session(),
      inviter = session();
    try {
      revoker.send(
        `begin; select id from public.memberships where user_id='${owner}' and agency_id='${agency}' for share; select id from public.agencies where id='${agency}' for update; select 'revoker_ready';`,
      );
      await revoker.marker("revoker_ready");
      inviter.send(
        `begin; select id from public.memberships where user_id='${admin}' and agency_id='${agency}' for share; select 'inviter_ready'; set local role authenticated; set local request.jwt.claims='{"sub":"${admin}","role":"authenticated"}'; select public.begin_agency_user_invitation('${agency}','qa-recipient-${index}-${agency}@example.test','QA','seller'); commit;`,
      );
      await inviter.marker("inviter_ready");
      revoker.end(
        `set local role authenticated; set local request.jwt.claims='{"sub":"${owner}","role":"authenticated"}'; ${operation}; commit;`,
      );
      const rejected = await revoker.done;
      assert.notEqual(rejected.code, 0);
      assert.ok(rejected.errors.includes("40001"));
      assert.ok(!rejected.errors.includes("40P01"));
      inviter.end();
      assert.equal((await inviter.done).code, 0);
    } finally {
      revoker.end();
      inviter.end();
      await Promise.allSettled([revoker.done, inviter.done]);
    }
  }
  await checked(
    authenticated(
      owner,
      `select public.set_agency_member_active('${agency}','${adminMembership}',false,true)`,
    ),
  );
  assert.equal(
    await checked(
      `select is_active from public.memberships where id='${adminMembership}'`,
    ),
    "f",
  );
  await checked(
    authenticated(
      owner,
      `select public.set_agency_member_role('${agency}','${adminMembership}','seller','admin',false)`,
    ),
  );
  assert.equal(
    await checked(
      `select role from public.memberships where id='${adminMembership}'`,
    ),
    "seller",
  );
  console.log(
    "Concurrencia aprobada: un evento por cambio de estado/rol esperado; conflictos de invitación sin deadlock y reintentos exitosos.",
  );
} finally {
  await checked(
    `begin; delete from public.audit_events where agency_id='${agency}'; delete from public.agency_user_invitations where agency_id='${agency}'; delete from public.memberships where agency_id='${agency}'; delete from public.agencies where id='${agency}'; delete from public.profiles where id in ('${owner}','${admin}','${seller}'); delete from auth.users where id in ('${owner}','${admin}','${seller}'); commit;`,
  );
}
