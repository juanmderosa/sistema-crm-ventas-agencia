import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

// Local Docker/PostgreSQL only. No remote connection or service key is accepted.
const config = readFileSync("supabase/config.toml", "utf8");
const project = /^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m.exec(config)?.[1];
if (!project) throw new Error("No se encontró el proyecto Supabase local.");
const agency = randomUUID();
const owner = randomUUID();
const admin = randomUUID();
const target = randomUUID();
const email = `qa-concurrency-${target}@example.test`;

function sql(source) {
  return new Promise((resolve, reject) => {
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
    let output = "";
    let errors = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      errors += chunk;
    });
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", (code) =>
      resolve({ code, output: output.trim(), errors }),
    );
    child.stdin.end(source);
  });
}

async function checked(source) {
  const result = await sql(source);
  assert.equal(result.code, 0, "La operación SQL local no se completó.");
  return result.output;
}

function asUser(user, command) {
  return `begin; set local role authenticated;
    set local request.jwt.claims='{"sub":"${user}","role":"authenticated"}';
    ${command}; select pg_sleep(0.2); commit;`;
}

function assertSingleWinner(results) {
  assert.equal(results.filter((result) => result.code === 0).length, 1);
  const rejected = results.find((result) => result.code !== 0);
  assert.ok(
    rejected?.errors.includes("P0001"),
    "El segundo intento debe fallar por conflicto de negocio.",
  );
}

try {
  await checked(`begin;
    insert into auth.users(id,email,email_confirmed_at,encrypted_password,invited_at) values
      ('${owner}','qa-owner-${owner}@example.test',now(),'synthetic',now()),
      ('${admin}','qa-admin-${admin}@example.test',now(),'synthetic',now()),
      ('${target}','${email}',now(),'synthetic',now());
    insert into public.profiles(id,display_name) values
      ('${owner}','QA owner'),('${admin}','QA admin'),('${target}','QA recipient');
    insert into public.agencies(id,name,slug,ars_per_usd) values
      ('${agency}','QA concurrency','qa-concurrency-${agency}',1000);
    insert into public.memberships(agency_id,user_id,role) values
      ('${agency}','${owner}','agency_superadmin'),('${agency}','${admin}','admin');
    commit;`);
  const reserve = `select public.begin_agency_user_invitation('${agency}','${email}','QA','seller')`;
  assertSingleWinner(
    await Promise.all([
      sql(asUser(owner, reserve)),
      sql(asUser(admin, reserve)),
    ]),
  );
  assert.equal(
    await checked(
      `select count(*) from public.agency_user_invitations where agency_id='${agency}'`,
    ),
    "1",
  );
  const invitation = await checked(
    `select id from public.agency_user_invitations where agency_id='${agency}'`,
  );
  assert.match(invitation, /^[0-9a-f-]{36}$/);
  await checked(
    `select public.finish_agency_user_invitation('${invitation}','${target}',true)`,
  );
  const accept = `select public.accept_agency_user_invitation('${invitation}')`;
  assertSingleWinner(
    await Promise.all([
      sql(asUser(target, accept)),
      sql(asUser(target, accept)),
    ]),
  );
  assert.equal(
    await checked(
      `select count(*) from public.memberships where agency_id='${agency}' and user_id='${target}' and role='seller' and is_active`,
    ),
    "1",
  );
  assert.equal(
    await checked(
      `select count(*) from public.audit_events where agency_id='${agency}' and user_invitation_id='${invitation}'`,
    ),
    "3",
  );
  console.log(
    "Concurrencia local aprobada: una reserva, una membresía y tres eventos de auditoría.",
  );
} finally {
  await checked(`begin;
    delete from public.audit_events where agency_id='${agency}';
    delete from public.agency_user_invitations where agency_id='${agency}';
    delete from public.memberships where agency_id='${agency}';
    delete from public.agencies where id='${agency}';
    delete from public.profiles where id in ('${owner}','${admin}','${target}');
    delete from auth.users where id in ('${owner}','${admin}','${target}');
    commit;`);
}
