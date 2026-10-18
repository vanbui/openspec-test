import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import path from "node:path";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import { loadAnalystAssessmentOwnerLabels } from "../src/api/csrm-risk/services/risk-workflow";
import { resolvePeople } from "../src/api/csrm-assessment-request/services/request-people";

const harnessPromise = startAuthorizationHttpHarness();
const USER = "api::idambox-user.idambox-user";
const SOURCE = "api::identity-source.identity-source";
let serviceId: string;
let sourceId: string;
let protectedId: string;
let ordinaryId: string;
let requestId: string;
let assessmentId: string;
let riskId: string;
let controlId: string;
let implementationId: string;

before(async () => {
  const h = await harnessPromise;
  await h.withBackendFixture(async (backend) => {
    const root = path.resolve(__dirname, "../../..");
    const { registerIdentitySource } = require(path.join(root, "dist/src/iam/identity/source-registration")) as typeof import("../src/iam/identity/source-registration");
    const { runManualProtection } = require(path.join(root, "dist/src/iam/identity/write-context")) as typeof import("../src/iam/identity/write-context");
    const source = await registerIdentitySource(backend, {
      name: "Selector source", username: "selector-service", email: "selector-service@idambox.test", displayName: "Selector 00 Service",
    });
    serviceId = source.serviceUser.documentId;
    sourceId = source.documentId;
    const roles = await backend.documents("api::role.role").findMany({ filters: { name: "Security Analyst" } });
    await assert.rejects(backend.documents(USER).update({ documentId: serviceId, data: { roles: [roles[0]!.documentId] } }), /IAM_SOURCE_SERVICE_INVARIANT/);
    protectedId = (await backend.documents(USER).create({ data: {
      username: "selector-protected", email: "selector-protected@idambox.test", displayName: "Selector 01 Protected",
      accountStatus: "active", protected: false, roles: [roles[0]!.documentId],
    } })).documentId;
    await runManualProtection(backend, protectedId, true);
  });
  ordinaryId = await h.createUserFixture({ username: "selector-ordinary", email: "selector-ordinary@idambox.test", displayName: "Selector 02 Ordinary", accountStatus: "active" });
  for (let index = 3; index <= 21; index++) await h.createUserFixture({
    username: `selector-${index}`, email: `selector-${index}@idambox.test`, displayName: `Selector ${String(index).padStart(2, "0")} Human`, accountStatus: "active",
  });
  requestId = await h.createAssessmentRequestFixture({ requestNumber: "SELECTOR-01", title: "Selector assignment", requestStatus: "submitted", requestor: "owner" });
  assessmentId = await h.createAssessmentFixture({ assessmentNumber: "SELECTOR-AS-01", assessmentStatus: "draft", assessmentRequest: requestId });
  await h.setRequestStatusFixture(requestId, "risk-assessment-drafted");
  const fixtures = await h.seedAssessmentWorkflowFixtures();
  controlId = fixtures.aggregate.control;
  riskId = await h.createRiskRegisterFixture(assessmentId, { riskNumber: "SELECTOR-RISK-01", riskStatement: "Selector risk" });
  implementationId = await h.createRiskRegisterMitigationFixture(riskId, controlId, "Planned");
});
after(async () => (await harnessPromise).close());

async function request(path: string, method = "GET", data?: unknown, wrapped = false) {
  const h = await harnessPromise;
  return h.request({ path, identity: h.identities.analyst, init: {
    method, ...(data === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(wrapped ? { data } : data) }),
  } });
}
async function people(path: string) {
  const response = await request(path);
  assert.equal(response.status, 200, await response.clone().text());
  const body = await response.json() as { data: Array<{ documentId: string; displayName: string }> };
  for (const row of body.data) assert.deepEqual(Object.keys(row).sort(), ["displayName", "documentId"]);
  return body.data;
}
async function assertOwnerRefused(response: Response, message: string) {
  assert.equal(response.status, 400, await response.clone().text());
  assert.equal((await response.json() as { error: { message: string } }).error.message, message);
}

test("shared owner search excludes services before its 20-person boundary and preserves protected and ordinary people", async () => {
  const rows = await people("/api/v1/users?search=Selector");
  assert.equal(rows.length, 20);
  assert.equal(rows.some((row) => row.documentId === serviceId), false);
  assert.ok(rows.some((row) => row.documentId === protectedId));
  assert.ok(rows.some((row) => row.documentId === ordinaryId));
  assert.equal(rows.at(-1)?.displayName, "Selector 20 Human");
  assert.deepEqual(await people("/api/v1/users?search=Selector%2000%20Service"), []);
});

test("assignable analysts exclude a bound service after a refused human grant, and direct assignment refuses it", async () => {
  const path = `/api/v1/assessment_requests/${requestId}`;
  const rows = await people(`${path}/assignable_analysts?q=Selector`);
  assert.deepEqual(rows.map((row) => row.documentId), [protectedId]);
  const before = await (await harnessPromise).getRequestAssignment(requestId);
  const refused = await request(`${path}/assignee`, "PUT", { analyst: serviceId, expectedAnalyst: null }, true);
  assert.equal(refused.status, 409);
  assert.deepEqual((await refused.json() as { error: { details: unknown } }).error.details, { reason: "ASSIGNEE_NOT_ELIGIBLE" });
  assert.deepEqual(await (await harnessPromise).getRequestAssignment(requestId), before);
  assert.equal((await request(`${path}/assignee`, "PUT", { analyst: protectedId, expectedAnalyst: null }, true)).status, 200);
});

test("registered services cannot consume the 200-candidate analyst search window", async () => {
  const h = await harnessPromise;
  const ids: string[] = [];
  try {
    await h.withBackendFixture(async (backend) => {
      await backend.documents(USER).update({ documentId: serviceId, data: { displayName: "Boundary 000 Service" } });
    });
    // These active automation-role holders meet the database candidate filter but fail human eligibility.
    // The only eligible person lies exactly beyond the window if the service consumes its first position.
    for (let index = 1; index <= 200; index++) ids.push(await h.createUserFixture({
      username: `boundary-${index}`, email: `boundary-${index}@idambox.test`, displayName: `Boundary ${String(index).padStart(3, "0")} Person`,
      accountStatus: "active", roles: index === 200 ? ["Security Analyst"] : ["Security Analyst", "Security Analyst Agent"],
    }));
    assert.deepEqual((await people(`/api/v1/assessment_requests/${requestId}/assignable_analysts?q=Boundary`)).map((row) => row.documentId), [ids.at(-1)]);
  } finally {
    await h.withBackendFixture(async (backend) => {
      await backend.documents(USER).update({ documentId: serviceId, data: { displayName: "Selector 00 Service" } });
      for (const documentId of ids) await backend.documents(USER).delete({ documentId });
    });
  }
});

test("risk and treatment owner creates and updates reject services and keep persisted owners unchanged", async () => {
  const h = await harnessPromise;
  for (const field of ["riskOwner", "treatmentOwner"]) {
    const count = await h.countRisksForAssessment(assessmentId);
    await assertOwnerRefused(await request(`/api/v1/risk_assessments/${assessmentId}/risks`, "POST", { riskStatement: "Refused owner", [field]: serviceId }), "CSRM Risk reference is invalid.");
    assert.equal(await h.countRisksForAssessment(assessmentId), count);
    const before = await h.getRisk(riskId);
    await assertOwnerRefused(await request(`/api/v1/risks/${riskId}`, "PATCH", { [field]: serviceId }), "CSRM Risk reference is invalid.");
    assert.deepEqual(await h.getRisk(riskId), before);
    assert.equal((await request(`/api/v1/risks/${riskId}`, "PATCH", { [field]: protectedId })).status, 200);
    assert.equal((await request(`/api/v1/risks/${riskId}`, "PATCH", { [field]: ordinaryId })).status, 200);
  }
});

test("control owner creates and updates refuse services without writes and accept protected people", async () => {
  const h = await harnessPromise;
  const count = await h.countControlImplementationsForRisk(riskId);
  await assertOwnerRefused(await request(`/api/v1/risks/${riskId}/control_implementations`, "POST", { control: controlId, controlOwner: serviceId, controlStatus: "Planned" }), "CSRM ControlImplementation owner is invalid.");
  assert.equal(await h.countControlImplementationsForRisk(riskId), count);
  const before = await h.getControlImplementation(implementationId);
  await assertOwnerRefused(await request(`/api/v1/control_implementations/${implementationId}`, "PATCH", { controlOwner: serviceId }), "CSRM ControlImplementation owner is invalid.");
  assert.deepEqual(await h.getControlImplementation(implementationId), before);
  assert.equal((await request(`/api/v1/control_implementations/${implementationId}`, "PATCH", { controlOwner: protectedId })).status, 200);
  assert.equal((await request(`/api/v1/control_implementations/${implementationId}`, "PATCH", { controlOwner: ordinaryId })).status, 200);
});

test("administration system owner creates and updates reject services without changing counts or records", async () => {
  const h = await harnessPromise;
  const data = { name: "Selector system", owner: serviceId };
  const count = await h.countAdministrationRecords("information-systems");
  assert.equal((await request("/api/v1/information_systems", "POST", data, false)).status, 400);
  assert.equal(await h.countAdministrationRecords("information-systems"), count);
  const created = await request("/api/v1/information_systems", "POST", { ...data, owner: protectedId }, false);
  assert.equal(created.status, 201, await created.clone().text());
  const id = (await created.json() as { data: { documentId: string } }).data.documentId;
  const before = await h.getAdministrationRecord("information-systems", id);
  assert.equal((await request(`/api/v1/information_systems/${id}`, "PATCH", data, false)).status, 400);
  assert.deepEqual(await h.getAdministrationRecord("information-systems", id), before);
  assert.equal((await request(`/api/v1/information_systems/${id}`, "PATCH", { ...data, owner: ordinaryId }, false)).status, 200);
});

test("binding changes are read freshly, inactive sources remain excluded, and historical people retain safe labels", async () => {
  const h = await harnessPromise;
  await h.withBackendFixture(async (backend) => {
    await backend.documents(SOURCE).update({ documentId: sourceId, data: { sourceStatus: "inactive" } });
  });
  assert.deepEqual(await people("/api/v1/users?search=Selector%2000%20Service"), []);
  await h.withBackendFixture(async (backend) => {
    const labels = await loadAnalystAssessmentOwnerLabels(backend as never, [{ riskOwner: { documentId: serviceId }, treatmentOwner: { documentId: protectedId } }]);
    assert.deepEqual(new Set(labels.map((row) => row.documentId)), new Set([serviceId, protectedId]));
    for (const label of labels) assert.deepEqual(Object.keys(label).sort(), ["displayName", "documentId"]);
    const people = await resolvePeople(backend as never, [serviceId, protectedId]);
    assert.equal(people.get(serviceId)?.displayName, "Selector 00 Service");
    await assert.rejects(backend.documents(SOURCE).delete({ documentId: sourceId }), /IAM_IDENTITY_FORBIDDEN/);
  });
  assert.deepEqual(await people("/api/v1/users?search=Selector%2000%20Service"), []);
});
