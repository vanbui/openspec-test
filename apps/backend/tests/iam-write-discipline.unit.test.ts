import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import path from "node:path";
import { checkIdamboxUserWrites, findIdamboxWriteViolations } from "../scripts/idambox-user-write-guard";

function inventory(code: string, extra: Record<string, string> = {}) {
  const files = { "/fixture.ts": `declare const strapi: any; const trx = strapi.db.connection; ${code}`, ...extra };
  const host = ts.createCompilerHost({ noLib: true });
  host.getSourceFile = (file, language) => file in files ? ts.createSourceFile(file, files[file as keyof typeof files], language, true) : undefined;
  host.fileExists = (file) => file in files;
  host.readFile = (file) => files[file as keyof typeof files];
  const program = ts.createProgram(Object.keys(files), { noLib: true, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10 }, host);
  return findIdamboxWriteViolations(program);
}
const uid = '"api::idambox-user.idambox-user"';
for (const [name, code, operation] of [
  ["computed member alias", `const repo=strapi.db.query(${uid}); const op="update"; const write=repo[op]; write({data:{}});`, "update"],
  ["computed const", `const repo=strapi.db.query(${uid}); const op="update"; repo[op]({data:{}});`, "update"],
  ["computed union update", `const repo=strapi.db.query(${uid}); declare const op:"update"|"delete"; repo[op]({data:{}});`, "update"],
  ["computed union delete", `const repo=strapi.db.query(${uid}); declare const op:"update"|"delete"; repo[op]({data:{}});`, "delete"],
  ["unknown receiver method", `const repo=strapi.db.query(${uid}); repo.customWrite({data:{}});`, "unresolved-helper"],
  ["unresolved computed method", `const repo=strapi.db.query(${uid}); declare const op:string; repo[op]({data:{}});`, "unresolved-helper"],
  ["direct", `strapi.db.query(${uid}).create({data:{}});`, "create"],
  ["local alias", `const U=${uid}; const repo=strapi.db.query(U); const alias=repo; alias.update({data:{}});`, "update"],
  ["query factory alias", `const query=strapi.db.query; query(${uid}).update({data:{}});`, "update"],
  ["bulk", `strapi.db.query(${uid}).deleteMany({});`, "deleteMany"],
  ["entity service", `strapi.entityService.update(${uid}, 1, {data:{}});`, "update"],
  ["entity manager", `strapi.db.entityManager.create(${uid}, {data:{}});`, "create"],
  ["Knex", `const table="idambox_users"; trx(table).where({id:1}).update({email:"x"});`, "update"],
  ["raw", 'strapi.db.connection.raw("UPDATE idambox_users SET email = ?", ["x"]);', "raw"],
  ["bound raw", 'trx.raw("DELETE FROM ?? WHERE id = ?", ["idambox_users", 1]);', "raw"],
  ["unresolved SQL", 'declare const sql:string; trx.raw(sql, ["idambox_users"]);', "unresolved-raw"],
  ["inverse role", 'strapi.db.query("api::role.role").update({data:{idamboxUsers:{connect:[1]}}});', "update"],
  ["source binding", 'strapi.db.query("api::identity-source.identity-source").update({data:{serviceUser:1}});', "update"],
  ["outbox binding", 'strapi.db.query("api::keycloak-sync-outbox.keycloak-sync-outbox").update({data:{idamboxUser:1}});', "update"],
  ["generic", `function mutate(uid:string){return strapi.db.query(uid).update({data:{}})} mutate(${uid});`, "update"],
  ["returned repository", `function repository(uid:string){return strapi.db.query(uid)} repository(${uid}).createMany({data:[]});`, "createMany"],
  ["destructured mutation", `const {update:write}=strapi.db.query(${uid}); write({data:{}});`, "update"],
  ["bound mutation", `const repo=strapi.db.query(${uid}); const write=repo.update.bind(repo); write({data:{}});`, "update"],
  ["assigned repository", `let repo; repo=strapi.db.query(${uid}); repo.update({data:{}});`, "update"],
  ["unknown method", `strapi.adapter.save(${uid}, {});`, "unresolved-helper"],
  ["unknown table helper", 'declare function mutate(table:string):void; mutate("idambox_users");', "unresolved-helper"],
  ["service link table", 'trx("identity_sources_service_user_lnk").delete();', "delete"],
  ["unresolved", `declare function save(repo:any):any; save(strapi.db.query(${uid}));`, "unresolved-helper"],
] as const) test(`semantic guard rejects ${name}`, () => {
  const found = inventory(code);
  assert.ok(found.some((item) => item.operation === operation), JSON.stringify(found));
  assert.ok(found.every((item) => item.file.endsWith("fixture.ts") && item.line > 0));
});
test("imported UID and repository helper resolve across modules", () => {
  const found = inventory('import { USER } from "./uid"; const repo = strapi.db.query(USER); repo.delete({});', { "/uid.ts": `export const USER=${uid};` });
  assert.equal(found[0]?.operation, "delete");
});
for (const [name, code] of [
  ["documents", `const U=${uid}; const docs=strapi.documents(U); docs.create({data:{}}); docs.update({data:{}});`],
  ["document factory alias", `const documents=strapi.documents; documents(${uid}).create({data:{}});`],
  ["generic documents", `function repository(uid:string){return strapi.documents(uid)} repository(${uid}).update({data:{}});`],
  ["computed read", `const repo=strapi.db.query(${uid}); const op="findOne"; repo[op]({});`],
  ["query reads", `strapi.db.query(${uid}).findOne({});`],
  ["SELECT lock", 'trx("idambox_users").select("id").where({id:1}).forUpdate();'],
  ["raw SELECT", 'trx.raw("SELECT * FROM idambox_users WHERE id = ? FOR UPDATE", [1]);'],
  ["outbox", 'trx("keycloak_sync_outboxes").where({id:1}).update({attempts:1});'],
  ["outbox expression", 'trx("keycloak_sync_outboxes").update({attempts:trx.raw("?? + 1", ["attempts"])});'],
] as const) test(`semantic guard permits ${name}`, () => assert.deepEqual(inventory(code), []));

for (const [name, target, forbidden] of [
  ["unrelated collection", '"api::information-system.information-system"', false],
  ["user collection", uid, true],
] as const) test(`object-literal factory isolates ${name} methods`, () => {
  const found = inventory(`
    function factory(target:string) {
      const users = strapi.documents(${uid});
      const writer = strapi.db.query(target);
      return {
        read(id:string) { return users.findOne({documentId:id}); },
        update(data:any) { return writer.update({data}); }
      };
    }
    function save(input:any) { input.repository.update({owner:1}); }
    save({repository:factory(${target})});
  `);
  if (forbidden) assert.ok(found.some((item) => item.operation === "update"), JSON.stringify(found));
  else assert.deepEqual(found, []);
});

test("member aliases retain distinct bound factory targets", () => {
  const found = inventory(`
    function factory(target:string) {
      const read = () => strapi.documents(${uid}).findMany({});
      return { read, write: (data:any) => strapi.db.query(target).update({data}) };
    }
    const safe = factory("api::csrm-information-system.csrm-information-system");
    const {write:safeWrite} = safe;
    safeWrite({owner:1});
    const unsafe = factory(${uid});
    const write = unsafe["write"].bind(unsafe);
    write({});
  `);
  assert.equal(found.filter((item) => item.operation === "update").length, 1, JSON.stringify(found));
});

test("recursive and depth-limited helpers receiving user targets fail closed", () => {
  assert.ok(inventory(`function recurse(target:string){return recurse(target)} recurse(${uid});`)
    .some((item) => item.operation === "unresolved-helper"));
  const chain = Array.from({length:30}, (_, i) =>
    `function helper${i}(target:string){return ${i === 29 ? "strapi.documents(target)" : `helper${i + 1}(target)`};}`).join("\n");
  assert.ok(inventory(`${chain} helper0(${uid});`).some((item) => item.operation === "unresolved-helper"));
});

// The ordinary suite enforces it on production code: every IdamBoxUser write goes through the Document Service.
test("production src writes IdamBox users only through the Document Service", (t) => {
  const root = path.resolve(__dirname, "..", "..", "..", "src");
  assert.equal(root, path.resolve(process.cwd(), "src"));
  const started = Date.now();
  let fileCount = 0;
  assert.deepEqual(checkIdamboxUserWrites(root, (count) => { fileCount = count; }), []);
  assert.ok(Date.now() - started < 60_000, "Production inventory exceeded 60 seconds");
  assert.ok(fileCount > 100, `Production inventory covered only ${fileCount} files`);
  t.diagnostic(`Production inventory covered ${fileCount} files in ${Date.now() - started} ms at ${root}`);
});
