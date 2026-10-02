import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createControlSeeds,
  parseControlTitles,
  readControlLibrary,
  type ControlCatalogue,
  type ControlSeed,
} from "../src/bootstrap/seed-csrm-data";

/*
 * D-46 (operator decision 15): every seeded control whose catalogue gives no label takes a title from the
 * CSRM title file beside the vendored catalogues. Annex A controls carry the standard's own control names
 * and no control text; the stored name keeps the `{number} — {title}` form the D-36 label rule reads.
 */

const appRoot = path.resolve(__dirname, "..", "..", "..");
const TITLE_FILE = "csrm-control-titles.json";
const ISO_FILE = "iso-iec-27001-2022-annex-a.json";
const PRIVACY_FILE = "privacy-act-app-ndb-2026-06-04.json";
const CPS_234_FILE = "apra-cps-234-2019.json";

type ControlLibrary = { catalogues: ControlCatalogue[]; titles: Map<string, string> };

let libraryPromise: Promise<ControlLibrary> | undefined;

function library(): Promise<ControlLibrary> {
  return (libraryPromise ??= readControlLibrary(appRoot));
}

async function titledSeeds(): Promise<ControlSeed[]> {
  const { catalogues, titles } = await library();
  return createControlSeeds(catalogues, titles);
}

function seedsFrom(seeds: ControlSeed[], sourceFile: string): ControlSeed[] {
  return seeds.filter((seed) => seed.sourceData.sourceFile === sourceFile);
}

function seedFor(seeds: ControlSeed[], controlNumber: string): ControlSeed {
  const seed = seeds.find((candidate) => candidate.controlNumber === controlNumber);
  assert.ok(seed, `${controlNumber} is seeded`);
  return seed;
}

test("ADMIN-05 D-46 an Annex A control carries the standard's control name", async () => {
  const seeds = await titledSeeds();
  assert.equal(seedFor(seeds, "5.1").name, "5.1 — Policies for information security");
  assert.equal(seedFor(seeds, "8.11").name, "8.11 — Data masking");
  assert.equal(seedFor(seeds, "8.34").name, "8.34 — Protection of information systems during audit testing");
});

test("ADMIN-05 D-46 every Annex A control is named, by theme, and none carries ISO text", async () => {
  const annexA = seedsFrom(await titledSeeds(), ISO_FILE);
  assert.equal(annexA.length, 93);
  const byTheme = new Map<string, number>();
  for (const seed of annexA) {
    assert.ok(seed.name.startsWith(`${seed.controlNumber} — `), `${seed.controlNumber} is named: ${seed.name}`);
    assert.ok(seed.name.length > `${seed.controlNumber} — `.length + 2, `${seed.controlNumber} has a title`);
    assert.equal(seed.description, undefined, `${seed.controlNumber} carries no ISO control text`);
    assert.equal((seed.sourceData.control as { statement: unknown }).statement, null, `${seed.controlNumber} keeps the vendored null statement`);
    const theme = String((seed.sourceData.control as { theme: unknown }).theme);
    byTheme.set(theme, (byTheme.get(theme) ?? 0) + 1);
  }
  assert.deepEqual(Object.fromEntries(byTheme), { Organizational: 37, People: 8, Physical: 14, Technological: 34 });
});

test("ADMIN-05 D-46 a title changes only the name of a control its catalogue leaves untitled", async () => {
  const { catalogues, titles } = await library();
  const untitled = createControlSeeds(catalogues, new Map());
  const titled = createControlSeeds(catalogues, titles);
  assert.equal(titled.length, 2_646);
  assert.equal(untitled.length, titled.length);
  const titledFiles = new Set(["iso-iec-27001-2022-annex-a.json", "apra-cps-230-2026.json", CPS_234_FILE, "pspf-release-2026.json"]);
  titled.forEach((seed, index) => {
    const before = untitled[index];
    assert.equal(seed.controlNumber, before.controlNumber);
    if (!titledFiles.has(String(seed.sourceData.sourceFile))) {
      assert.deepEqual(seed, before, `${seed.controlNumber} is seeded exactly as before`);
      return;
    }
    if (seed.name !== before.name) {
      assert.equal(before.name, before.controlNumber, `${seed.controlNumber} was untitled before`);
    }
    assert.deepEqual({ ...seed, name: "" }, { ...before, name: "" }, `${seed.controlNumber} changes only its name`);
  });
});

/* The seed refuses a malformed title file, naming the file and the control (D-46, T-10-61). */

function validTitleFile() {
  return {
    description: "Titles for seeded controls whose catalogue gives none (D-46).",
    sources: { [ISO_FILE]: { basis: "framework", note: "The standard's control names; no control text." } },
    titles: { [ISO_FILE]: { "5.1": "Policies for information security" } } as Record<string, Record<string, unknown>>,
  };
}

async function parse(file: unknown): Promise<Map<string, string>> {
  const { catalogues } = await library();
  return parseControlTitles(TITLE_FILE, typeof file === "string" ? file : JSON.stringify(file), catalogues);
}

test("ADMIN-05 D-46 a well-formed title file gives each control its title", async () => {
  assert.deepEqual([...(await parse(validTitleFile())).entries()], [["5.1", "Policies for information security"]]);
  for (const title of ["Abc", "A".repeat(100)]) {
    const file = validTitleFile();
    file.titles[ISO_FILE] = { "5.1": title };
    assert.equal((await parse(file)).get("5.1"), title, `a title of ${title.length} characters is accepted`);
  }
});

test("ADMIN-05 D-46 the seed refuses a title file that is not a JSON object", async () => {
  for (const source of ["[]", "not json", "null"]) {
    await assert.rejects(parse(source), /csrm-control-titles\.json/);
  }
});

test("ADMIN-05 D-46 the seed refuses a title file for an unknown catalogue", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, unknown> };
  file.sources["unknown-catalogue.json"] = { basis: "descriptive", note: "Not a vendored catalogue." };
  file.titles["unknown-catalogue.json"] = { "X-1": "Unknown requirement" };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && /unknown-catalogue\.json/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses sources and titles that list different catalogues", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, unknown> };
  file.sources[CPS_234_FILE] = { basis: "descriptive", note: "CSRM's words." };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && /apra-cps-234-2019\.json/.test(error.message));
  const missingSource = validTitleFile();
  missingSource.titles[CPS_234_FILE] = { "CPS-234-15": "Information security policy framework" };
  await assert.rejects(parse(missingSource), (error: Error) => /csrm-control-titles\.json/.test(error.message) && /apra-cps-234-2019\.json/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a source basis other than framework or descriptive", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, { basis: string; note: string }> };
  file.sources[ISO_FILE] = { basis: "official", note: "Unknown basis." };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(ISO_FILE) && /basis/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a control its catalogue does not hold", async () => {
  const file = validTitleFile();
  file.titles[ISO_FILE] = { "5.99": "Imaginary control" };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(ISO_FILE) && /5\.99/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a title for a control its catalogue already labels", async () => {
  const file = validTitleFile() as ReturnType<typeof validTitleFile> & { sources: Record<string, unknown> };
  file.sources[PRIVACY_FILE] = { basis: "descriptive", note: "CSRM's words." };
  file.titles[PRIVACY_FILE] = { "APP-11": "Securing personal information" };
  await assert.rejects(parse(file), (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(PRIVACY_FILE) && /APP-11/.test(error.message));
});

test("ADMIN-05 D-46 the seed refuses a title outside the form rules", async () => {
  const malformed: Array<[string, unknown]> = [
    ["two characters", "Ab"],
    ["101 characters", "A".repeat(101)],
    ["an em dash", "Policies — information security"],
    ["an en dash", "Policies – information security"],
    ["a line break", "Policies for\ninformation security"],
    ["a carriage return", "Policies for\rinformation security"],
    ["a trailing full stop", "Policies for information security."],
    ["its own control id", "5.1 Policies for information security"],
    ["untrimmed text", " Policies for information security"],
    ["a value that is not a string", 51],
  ];
  for (const [rule, title] of malformed) {
    const file = validTitleFile();
    file.titles[ISO_FILE] = { "5.1": title };
    await assert.rejects(
      parse(file),
      (error: Error) => /csrm-control-titles\.json/.test(error.message) && error.message.includes(ISO_FILE) && /\b5\.1\b/.test(error.message),
      `a title with ${rule} is refused`,
    );
  }
});

/*
 * D-46: every seeded control carries a title. The paragraph-level requirements of APRA CPS 234, CPS 230
 * and the PSPF take short descriptive titles in CSRM's words; each must share a specific word with its
 * own paragraph (the anchor check), so a shifted or unrelated title fails.
 */

const DESCRIPTIVE_FILES = ["apra-cps-230-2026.json", CPS_234_FILE, "pspf-release-2026.json"] as const;
const ANCHOR_STOP_WORDS = new Set([
  "with", "from", "that", "this", "their", "into", "must", "shall", "each", "such",
  "which", "where", "when", "have", "than", "also", "only", "under", "other",
]);

function letterRuns(text: string): string[] {
  return text.toLowerCase().match(/[a-z]+/g) ?? [];
}

function countedStems(title: string): string[] {
  return [...new Set(letterRuns(title)
    .filter((word) => word.length >= 4 && !ANCHOR_STOP_WORDS.has(word))
    .map((word) => word.slice(0, 5)))];
}

function paragraphOf(seed: ControlSeed): string {
  return String((seed.sourceData.control as { statement: unknown }).statement);
}

function titleOf(seed: ControlSeed): string {
  return seed.name.slice(`${seed.controlNumber} — `.length);
}

test("ADMIN-05 D-46 the title file holds a title for each of the 386 untitled controls", async () => {
  const { readFile } = await import("node:fs/promises");
  const file = JSON.parse(await readFile(path.join(appRoot, "src", "bootstrap", "controls", TITLE_FILE), "utf8")) as {
    sources: Record<string, { basis: string }>;
    titles: Record<string, Record<string, string>>;
  };
  const counts = Object.fromEntries(Object.entries(file.titles).map(([sourceFile, titles]) => [sourceFile, Object.keys(titles).length]));
  assert.deepEqual(counts, {
    "iso-iec-27001-2022-annex-a.json": 93,
    "apra-cps-230-2026.json": 51,
    [CPS_234_FILE]: 24,
    "pspf-release-2026.json": 218,
  });
  assert.deepEqual(Object.keys(file.sources).sort(), Object.keys(file.titles).sort());
  assert.equal(file.sources[ISO_FILE].basis, "framework");
  for (const sourceFile of DESCRIPTIVE_FILES) assert.equal(file.sources[sourceFile].basis, "descriptive", sourceFile);
  assert.equal((await library()).titles.size, 386);
});

test("ADMIN-05 D-46 no seeded control is untitled", async () => {
  const seeds = await titledSeeds();
  assert.equal(seeds.length, 2_646);
  const untitled = seeds.filter((seed) => seed.name.length <= seed.controlNumber.length || seed.name === seed.controlNumber);
  assert.deepEqual(untitled.map((seed) => seed.controlNumber), []);
});

test("ADMIN-05 D-46 titles are unique within each framework", async () => {
  const seeds = await titledSeeds();
  for (const sourceFile of [ISO_FILE, ...DESCRIPTIVE_FILES]) {
    const titles = seedsFrom(seeds, sourceFile).map((seed) => titleOf(seed).toLowerCase());
    const repeated = titles.filter((title, index) => titles.indexOf(title) !== index);
    assert.deepEqual(repeated, [], `${sourceFile} repeats a title`);
  }
});

/*
 * A title never narrows its paragraph (10-23 walkthrough fix 3): it may run a little longer to cover every
 * limb, up to 12 words and the title file's 100-character bound, so the stored name stays well inside the
 * Controls contract's 255.
 */
test("ADMIN-05 D-46 descriptive titles are short noun phrases in the CSRM voice", async () => {
  const seeds = await titledSeeds();
  for (const sourceFile of DESCRIPTIVE_FILES) {
    for (const seed of seedsFrom(seeds, sourceFile)) {
      const title = titleOf(seed);
      const words = title.split(/\s+/);
      assert.ok(words.length >= 2 && words.length <= 12, `${seed.controlNumber} has 2 to 12 words: ${title}`);
      assert.ok(title.length <= 100, `${seed.controlNumber} is at most 100 characters: ${title}`);
      assert.match(title, /^[A-Z0-9]/, `${seed.controlNumber} starts with a capital: ${title}`);
      assert.doesNotMatch(title, /\b(must|shall)\b/i, `${seed.controlNumber} states no obligation verb: ${title}`);
      assert.ok(!paragraphOf(seed).toLowerCase().startsWith(title.toLowerCase()), `${seed.controlNumber} does not copy its paragraph's opening: ${title}`);
    }
  }
});

test("ADMIN-05 D-46 each descriptive title shares a specific word with its own paragraph", async () => {
  const seeds = await titledSeeds();
  for (const sourceFile of DESCRIPTIVE_FILES) {
    const framework = seedsFrom(seeds, sourceFile);
    const paragraphs = framework.map((seed) => letterRuns(paragraphOf(seed)));
    const isGeneric = (stem: string) =>
      paragraphs.filter((words) => words.some((word) => word.startsWith(stem))).length > paragraphs.length / 2;
    const unanchored = framework.filter((seed, index) => !countedStems(titleOf(seed))
      .some((stem) => !isGeneric(stem) && paragraphs[index].some((word) => word.startsWith(stem))));
    assert.deepEqual(unanchored.map((seed) => `${seed.controlNumber}: ${titleOf(seed)}`), [], `${sourceFile} titles that share no specific word with their paragraph`);
  }
});

test("ADMIN-05 D-46 a title word finds its control on the picker's first page", async () => {
  const matches = (await titledSeeds()).filter((seed) =>
    [seed.controlNumber, seed.name, seed.framework].some((value) => value.toLowerCase().includes("masking")));
  assert.ok(matches.length >= 1 && matches.length <= 10, `masking matches ${matches.length} controls`);
  assert.ok(matches.some((seed) => seed.controlNumber === "8.11"), "8.11 is among them");
});

/*
 * 10-23 walkthrough fix 3: a descriptive title never misstates or narrows its paragraph. The pilot found
 * CPS-230-34 dropping "or its role in the financial system" and CPS-230-57 dropping "or is not documented in
 * a formal agreement"; the audit of every CPS 230 and CPS 234 title and 39 PSPF titles corrected these 72.
 * Each row is the catalogue, the control, the title 10-22 seeded and the corrected title.
 */
const CORRECTED_TITLES: ReadonlyArray<readonly [string, string, string, string]> = [
  ["apra-cps-230-2026.json", "CPS-230-34", "Critical operations defined by adverse customer impact", "Critical operations defined by material harm to customers or the financial system"],
  ["apra-cps-230-2026.json", "CPS-230-57", "Relief for listed providers on standardised terms", "Partial relief for listed providers on standardised terms or no formal agreement"],
  ["apra-cps-230-2026.json", "CPS-230-11", "Operational risk, critical operations and service provider risks", "Operational risk, conduct and compliance standards, critical operations and providers"],
  ["apra-cps-230-2026.json", "CPS-230-13", "Preventing and recovering from disruption to critical operations", "Preventing, withstanding and recovering from critical operation disruption where practicable"],
  ["apra-cps-230-2026.json", "CPS-230-14", "Service provider reliance within prudential obligations", "Service provider reliance only with obligations met and risks managed"],
  ["apra-cps-230-2026.json", "CPS-230-16", "Periodic review of operational risk management", "Operational risk management within the required framework reviews"],
  ["apra-cps-230-2026.json", "CPS-230-17", "Integrating operational risk into overall risk management", "Operational risk integration and BCP consistency with recovery and exit plans"],
  ["apra-cps-230-2026.json", "CPS-230-18", "APRA actions on operational risk weaknesses", "APRA actions on material operational risk weaknesses"],
  ["apra-cps-230-2026.json", "CPS-230-19", "Board accountability for operational risk oversight", "Board accountability for overseeing operational risk, continuity and providers"],
  ["apra-cps-230-2026.json", "CPS-230-20", "Senior manager roles for operational risk", "Board-ensured senior manager roles for operational risk, continuity and providers"],
  ["apra-cps-230-2026.json", "CPS-230-21", "Board approval of BCP, tolerances and provider policy", "Board oversight and approval for operational risk, BCP, tolerances and providers"],
  ["apra-cps-230-2026.json", "CPS-230-22", "Briefing the Board on impacts to critical operations", "Senior management briefing the Board on decisions affecting critical operations"],
  ["apra-cps-230-2026.json", "CPS-230-23", "Managing the full range of operational risks", "Full range of operational risks, with end-to-end senior management responsibility"],
  ["apra-cps-230-2026.json", "CPS-230-24", "IT capability and information asset health", "IT capability, information asset age and health, and CPS 234 security"],
  ["apra-cps-230-2026.json", "CPS-230-25", "Operational risk impact of business decisions", "Business and strategic decision impacts on operational risk and resilience"],
  ["apra-cps-230-2026.json", "CPS-230-27", "Risk assessment before providing a material service", "Risk assessment before providing a material service, and APRA-required stronger controls"],
  ["apra-cps-230-2026.json", "CPS-230-28", "Designing and embedding operational risk controls", "Operational risk controls designed and embedded within appetite and compliance obligations"],
  ["apra-cps-230-2026.json", "CPS-230-29", "Monitoring and testing control effectiveness", "Risk-based control monitoring and testing, senior management reporting and timely rectification"],
  ["apra-cps-230-2026.json", "CPS-230-30", "Remediating control gaps and weaknesses", "Timely root-cause remediation of material weaknesses, tracked in the risk profile"],
  ["apra-cps-230-2026.json", "CPS-230-31", "Recording and addressing incidents and near misses", "Timely incident and near miss handling, reflected in risk and control assessments"],
  ["apra-cps-230-2026.json", "CPS-230-32", "Notifying APRA of operational incidents within 72 hours", "Notifying APRA within 72 hours of material operational risk incidents"],
  ["apra-cps-230-2026.json", "CPS-230-35", "Minimum critical operations by entity type", "Minimum critical operations by entity type, unless justified otherwise"],
  ["apra-cps-230-2026.json", "CPS-230-36", "APRA power to classify critical operations", "APRA power to require critical operation classification"],
  ["apra-cps-230-2026.json", "CPS-230-38", "APRA review and setting of tolerance levels", "APRA-required tolerance reviews, and APRA-set tolerances for heightened risk or weakness"],
  ["apra-cps-230-2026.json", "CPS-230-40", "BCP capabilities and tolerance level monitoring", "BCP capabilities, tolerance monitoring and Board reporting of failures with remediation"],
  ["apra-cps-230-2026.json", "CPS-230-41", "Notifying APRA of critical disruptions within 24 hours", "Notifying APRA within 24 hours of a critical operation disruption beyond tolerance"],
  ["apra-cps-230-2026.json", "CPS-230-43", "Severe but plausible test scenarios", "Tailored severe but plausible test scenarios, including any APRA-determined scenario"],
  ["apra-cps-230-2026.json", "CPS-230-44", "Annual update of the BCP", "Annual BCP update as needed for changes and review or testing shortcomings"],
  ["apra-cps-230-2026.json", "CPS-230-45", "Internal audit review of the BCP", "Internal audit review and Board assurance on the BCP and its testing"],
  ["apra-cps-230-2026.json", "CPS-230-47", "Provider policy on agreements, exits and fourth parties", "Provider policy on agreement lifecycle, material provider risks and fourth parties"],
  ["apra-cps-230-2026.json", "CPS-230-48", "Register of material service providers", "Register of material service providers and management of their risks"],
  ["apra-cps-230-2026.json", "CPS-230-49", "Minimum material service providers by entity type", "Minimum material service providers by entity type, unless justified otherwise"],
  ["apra-cps-230-2026.json", "CPS-230-50", "Annual submission of the provider register", "Annual submission of the material provider register to APRA"],
  ["apra-cps-230-2026.json", "CPS-230-51", "APRA power to classify providers as material", "APRA power to require providers or arrangements to be classified material"],
  ["apra-cps-230-2026.json", "CPS-230-52", "Due diligence before a material arrangement", "Due diligence and risk assessment before a material arrangement or material change"],
  ["apra-cps-230-2026.json", "CPS-230-54", "APRA access rights in provider agreements", "APRA access and non-obstruction terms in provider agreements"],
  ["apra-cps-230-2026.json", "CPS-230-56", "APRA-directed changes to provider arrangements", "APRA-required review and change of provider arrangements on prudential concerns"],
  ["apra-cps-230-2026.json", "CPS-230-58", "APRA written exemption for unlisted arrangements", "APRA written exemption for arrangements outside the paragraph 57 relief"],
  ["apra-cps-230-2026.json", "CPS-230-59", "Monitoring material arrangements and provider performance", "Monitoring and senior management reporting on material arrangements"],
  ["apra-cps-230-2026.json", "CPS-230-60", "Notifying APRA of critical and offshoring arrangements", "Notifying APRA of critical service agreements and material offshoring, including changes"],
  ["apra-cps-230-2026.json", "CPS-230-61", "Internal audit of critical outsourcing arrangements", "Internal audit review of proposed critical outsourcing and Board compliance reporting"],
  ["apra-cps-234-2019.json", "CPS-234-15", "Information security capability proportionate to threats", "Information security capability proportionate to threats and supporting sound operation"],
  ["apra-cps-234-2019.json", "CPS-234-16", "Third-party information security capability assessment", "Proportionate assessment of related and third-party information security capability"],
  ["apra-cps-234-2019.json", "CPS-234-17", "Keeping capability current with changing threats", "Keeping capability current with changing vulnerabilities and threats"],
  ["apra-cps-234-2019.json", "CPS-234-22", "Third-party control design evaluation", "Evaluating the design of related and third-party security controls"],
  ["apra-cps-234-2019.json", "CPS-234-28", "Reliance on third-party control testing", "Assessing reliance on related or third-party control testing"],
  ["apra-cps-234-2019.json", "CPS-234-29", "Escalating unremediated control deficiencies", "Escalating control deficiencies that cannot be remediated in time"],
  ["apra-cps-234-2019.json", "CPS-234-31", "Annual review of testing program sufficiency", "Reviewing testing program sufficiency annually and on material change"],
  ["apra-cps-234-2019.json", "CPS-234-34", "Internal audit of third-party control assurance", "Internal audit of related or third-party assurance it relies on, where material"],
  ["apra-cps-234-2019.json", "CPS-234-35", "Notifying APRA of material incidents within 72 hours", "Notifying APRA within 72 hours of material or regulator-notified incidents"],
  ["apra-cps-234-2019.json", "CPS-234-36", "Notifying APRA of material control weaknesses", "Notifying APRA of material control weaknesses not remediable in time"],
  ["pspf-release-2026.json", "PSPF-008", "Appointing a Chief Security Officer", "Appointing and empowering a Chief Security Officer"],
  ["pspf-release-2026.json", "PSPF-016", "Approved security governance arrangements", "Accountable Authority approval of tailored security governance arrangements"],
  ["pspf-release-2026.json", "PSPF-038", "Impact of risk decisions on other entities", "Considering risk decision impacts on other entities and sharing risk information"],
  ["pspf-release-2026.json", "PSPF-046", "Foreign ownership, control or influence in procurement", "Foreign ownership, control or influence risks in procurement and contracts"],
  ["pspf-release-2026.json", "PSPF-048", "Use of secure, verifiable third-party vendors", "Use of secure, verifiable third parties, with CISO-approved business exceptions"],
  ["pspf-release-2026.json", "PSPF-053", "Documenting decisions to vary requirements", "Documenting exceptional-circumstance variations in the security plan"],
  ["pspf-release-2026.json", "PSPF-077", "Agreement before sharing outside government", "Agreement before sharing outside government, except returned external information"],
  ["pspf-release-2026.json", "PSPF-080", "AUSTEO information withheld from non-citizens", "AUSTEO information withheld from non-citizens unless exempted"],
  ["pspf-release-2026.json", "PSPF-091", "TikTok removal from government devices", "Blocking and removing TikTok on government devices without a legitimate business reason"],
  ["pspf-release-2026.json", "PSPF-098", "Maintaining a cyber security strategy and uplift plan", "ISM-aligned cyber security strategy and uplift plan with Zero Trust culture"],
  ["pspf-release-2026.json", "PSPF-114", "IRAP-assessed gateway capabilities", "Gateways with an IRAP or ASD assessment in the last 24 months"],
  ["pspf-release-2026.json", "PSPF-137", "ASD approval for overseas TOP SECRET remote access", "ASD approval for overseas TOP SECRET remote access outside PSPF facilities"],
  ["pspf-release-2026.json", "PSPF-144", "Clearances issued only with sponsorship", "Clearances issued only when sponsored or authorised by government"],
  ["pspf-release-2026.json", "PSPF-149", "Approving citizenship eligibility waivers", "Approving and recording citizenship eligibility waivers"],
  ["pspf-release-2026.json", "PSPF-151", "Approving checkable background eligibility waivers", "Approving and recording checkable background eligibility waivers"],
  ["pspf-release-2026.json", "PSPF-152", "Vetting agency advice on uncheckable backgrounds", "Uncheckable backgrounds: vetting agency advice and Accountable Authority waiver"],
  ["pspf-release-2026.json", "PSPF-167", "Sponsoring entity sharing of relevant concerns", "Sponsoring Entity sharing of relevant concerns where appropriate"],
  ["pspf-release-2026.json", "PSPF-189", "Security integrated into facility planning", "Security integrated into facility planning, selection, design and modification"],
  ["pspf-release-2026.json", "PSPF-204", "Construction and securing of perimeter doors", "Construction and securing of perimeter doors and hardware"],
  ["pspf-release-2026.json", "PSPF-212", "Post-quantum cryptography on new equipment", "Post-quantum cryptography on newly procured equipment and software"],
  ["pspf-release-2026.json", "PSPF-219", "Training on foreign interference and espionage", "Training on foreign interference, espionage, cultivation and exploitation"],
];

test("ADMIN-05 D-46 fix 3: a corrected title covers every limb of its paragraph", async () => {
  const seeds = await titledSeeds();
  assert.equal(CORRECTED_TITLES.length, 72);
  const wrong = CORRECTED_TITLES
    .filter(([, controlNumber, , title]) => seedFor(seeds, controlNumber).name !== `${controlNumber} — ${title}`)
    .map(([, controlNumber]) => `${controlNumber}: ${seedFor(seeds, controlNumber).name}`);
  assert.deepEqual(wrong, [], "controls still seeded under a title that narrows their paragraph");
});

/*
 * A seeded start renames a control only when its stored name is one the seed wrote, so the title file keeps
 * every title an earlier seed stored for a control (supersededTitles) beside the current one.
 */
test("ADMIN-05 D-46 fix 3: each title an earlier seed wrote stays listed as superseded", async () => {
  const { readFile } = await import("node:fs/promises");
  const file = JSON.parse(await readFile(path.join(appRoot, "src", "bootstrap", "controls", TITLE_FILE), "utf8")) as {
    supersededTitles?: Record<string, Record<string, string[]>>;
  };
  const missing = CORRECTED_TITLES
    .filter(([sourceFile, controlNumber, earlier]) => !(file.supersededTitles?.[sourceFile]?.[controlNumber] ?? []).includes(earlier))
    .map(([, controlNumber, earlier]) => `${controlNumber}: ${earlier}`);
  assert.deepEqual(missing, [], "earlier seeded titles the seed could not recognise");
});

function titleFileWithSuperseded(superseded: unknown) {
  return { ...validTitleFile(), supersededTitles: superseded };
}

test("ADMIN-05 D-46 fix 3: a well-formed superseded title list is accepted", async () => {
  const titles = await parse(titleFileWithSuperseded({ [ISO_FILE]: { "5.1": ["Information security policies"] } }));
  assert.deepEqual([...titles.entries()], [["5.1", "Policies for information security"]]);
});

test("ADMIN-05 D-46 fix 3: the seed refuses a malformed superseded title list", async () => {
  const malformed: Array<[string, unknown, RegExp]> = [
    ["a list that is not an object", ["5.1"], /supersededTitles/],
    ["a catalogue the file does not title", { [PRIVACY_FILE]: { "APP-11": ["Security of personal"] } }, new RegExp(PRIVACY_FILE.replace(/\./g, "\."))],
    ["a control the file does not title", { [ISO_FILE]: { "5.2": ["Security roles"] } }, /\b5\.2\b/],
    ["titles that are not a list", { [ISO_FILE]: { "5.1": "Information security policies" } }, /\b5\.1\b/],
    ["an empty list", { [ISO_FILE]: { "5.1": [] } }, /\b5\.1\b/],
    ["a superseded title outside the form rules", { [ISO_FILE]: { "5.1": ["Information security policies."] } }, /\b5\.1\b/],
    ["the current title listed as superseded", { [ISO_FILE]: { "5.1": ["Policies for information security"] } }, /\b5\.1\b/],
  ];
  for (const [rule, superseded, names] of malformed) {
    await assert.rejects(
      parse(titleFileWithSuperseded(superseded)),
      (error: Error) => /csrm-control-titles\.json/.test(error.message) && names.test(error.message),
      `${rule} is refused`,
    );
  }
});
