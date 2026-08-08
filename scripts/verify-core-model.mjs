import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const readSchema = (apiName, contentTypeName = apiName) =>
  JSON.parse(
    readFileSync(
      join(
        root,
        "apps",
        "backend",
        "src",
        "api",
        apiName,
        "content-types",
        contentTypeName,
        "schema.json",
      ),
      "utf8",
    ),
  );
const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};
const assertRelation = (schema, attributeName, expected) => {
  const attribute = schema.attributes[attributeName];
  assert(attribute, `${attributeName} relation must exist`);
  for (const [key, value] of Object.entries(expected)) {
    assert(
      attribute[key] === value,
      `${attributeName}.${key} must equal ${JSON.stringify(value)}`,
    );
  }
};

const application = readSchema("application");
const platformFunction = readSchema("function");
const functionApi = readSchema("function-api");
const role = readSchema("role");
const idamboxUser = readSchema("idambox-user");

for (const [name, schema] of Object.entries({
  Application: application,
  Function: platformFunction,
  FunctionApi: functionApi,
  Role: role,
  "IdamBox User": idamboxUser,
})) {
  assert(schema.kind === "collectionType", `${name} must be a collection type`);
}

assert(application.attributes.name?.type === "string", "Application name must be a string");
assert(application.attributes.name?.required === true, "Application name must be required");
assert(application.attributes.slug?.type === "uid", "Application slug must be a UID");
assert(application.attributes.slug?.required === true, "Application slug must be required");
assert(
  application.attributes.applicationStatus?.type === "enumeration",
  "Application must use applicationStatus enum",
);
assert(
  application.attributes.applicationStatus?.required === true,
  "Application status must be required",
);

assert(platformFunction.attributes.name?.type === "string", "Function name must be a string");
assert(platformFunction.attributes.name?.required === true, "Function name must be required");
assert(
  platformFunction.attributes.description?.type === "text",
  "Function description must be text",
);
assert(platformFunction.attributes.menuPath?.type === "text", "Function menuPath must be text");

assert(functionApi.attributes.name?.type === "string", "FunctionApi name must be a string");
assert(functionApi.attributes.name?.required === true, "FunctionApi name must be required");
assert(functionApi.attributes.description?.type === "text", "FunctionApi description must be text");
assert(functionApi.attributes.url?.type === "string", "FunctionApi URL must be a string");
assert(functionApi.attributes.url?.required === true, "FunctionApi URL must be required");

assert(role.attributes.name?.type === "string", "Role name must be a string");
assert(role.attributes.name?.required === true, "Role name must be required");
assert(role.attributes.name?.unique === true, "Role name must be unique");
assert(idamboxUser.attributes.email?.type === "email", "IdamBox User email must be an email");
assert(idamboxUser.attributes.email?.required === true, "IdamBox User email must be required");
assert(idamboxUser.attributes.email?.unique === true, "IdamBox User email must be unique");
assert(idamboxUser.attributes.username?.type === "string", "IdamBox User username must be a string");
assert(idamboxUser.attributes.username?.required === true, "IdamBox User username must be required");
assert(idamboxUser.attributes.username?.unique === true, "IdamBox User username must be unique");
assert(idamboxUser.attributes.displayName?.required === true, "IdamBox User displayName must be required");
assert(
  idamboxUser.attributes.accountStatus?.type === "enumeration",
  "IdamBox User must use accountStatus enum",
);
assert(
  idamboxUser.attributes.accountStatus?.required === true,
  "IdamBox User accountStatus must be required",
);

assertRelation(application, "functions", {
  relation: "oneToMany",
  target: "api::function.function",
  mappedBy: "application",
});
assertRelation(platformFunction, "application", {
  relation: "manyToOne",
  target: "api::application.application",
  inversedBy: "functions",
  required: true,
});
assertRelation(role, "functions", {
  relation: "manyToMany",
  target: "api::function.function",
  inversedBy: "roles",
});
assertRelation(platformFunction, "functionApis", {
  relation: "oneToMany",
  target: "api::function-api.function-api",
});
assert(
  !functionApi.attributes.function,
  "FunctionApi must retain its one-way Function relation",
);
assertRelation(idamboxUser, "roles", {
  relation: "manyToMany",
  target: "api::role.role",
  inversedBy: "idamboxUsers",
});

console.log("IdamBox core Function model verification passed");
