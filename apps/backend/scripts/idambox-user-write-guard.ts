import ts from "typescript";
import path from "node:path";
import { readdirSync } from "node:fs";

export type WriteViolation = { file: string; line: number; operation: string; reason: string };
const USER = "api::idambox-user.idambox-user";
const mutations = new Set(["create", "update", "delete", "createMany", "updateMany", "deleteMany", "insert", "del", "truncate", "increment", "decrement", "attachRelations", "updateRelations", "deleteRelations"]);
type Facts = Set<string>;
type Bindings = Map<ts.Symbol, Facts>;
const union = (...sets: Facts[]): Facts => new Set(sets.flatMap((set) => [...set]));
const protectedTarget = (facts: Facts) => [...facts].some((v) => v === USER || /idambox_users|identity_sources_service_user_lnk|keycloak_sync_outboxes_idambox_user_lnk/.test(v) || v === "userTable" || v === "userRoleTable");

/** Semantic inventory: symbols, call arguments and return values carry receiver provenance. */
export function findIdamboxWriteViolations(program: ts.Program, sources = program.getSourceFiles().filter((s) => !s.isDeclarationFile && !s.fileName.includes("node_modules"))): WriteViolation[] {
  const checker = program.getTypeChecker();
  const violations = new Map<string, WriteViolation>();
  const maxDepth = 24;
  const ids = new Map<ts.Node | ts.Symbol, number>();
  const id = (value: ts.Node | ts.Symbol) => {
    if (!ids.has(value)) ids.set(value, ids.size + 1);
    return ids.get(value)!;
  };
  // Stable bound-fact signatures distinguish call contexts without copying a path set per node.
  const contexts = new Map<string, number>();
  const context = (env: Bindings) => {
    const signature = JSON.stringify([...env].map(([sym, values]) =>
      [id(sym), [...values].sort()] as const).sort((a, b) => a[0] - b[0]));
    if (!contexts.has(signature)) contexts.set(signature, contexts.size + 1);
    return contexts.get(signature)!;
  };
  const factCache = new Map<string, Facts>();
  const factActive = new Set<string>();
  const inspectionCache = new Set<string>();
  const inspectionActive = new Set<string>();
  const shapes = new Map<string, { node: ts.ObjectLiteralExpression; env: Bindings }>();
  const functions = new Map<string, { node: ts.FunctionLikeDeclaration; env: Bindings }>();
  const scopeCache = new Map<ts.Node, Set<ts.Node>>();
  function scopes(node: ts.Node): Set<ts.Node> {
    if (!scopeCache.has(node)) {
      const result = new Set<ts.Node>();
      for (let current: ts.Node | undefined = node; current; current = current.parent) {
        if (ts.isFunctionLike(current)) result.add(current);
      }
      scopeCache.set(node, result);
    }
    return scopeCache.get(node)!;
  }
  // Caller-local bindings cannot affect an unrelated callee. Retain lexical captures.
  function relevant(node: ts.Node, env: Bindings): Bindings {
    const visible = scopes(node);
    return new Map([...env].filter(([sym]) => {
      const decl = sym.valueDeclaration;
      const owner = decl && [...scopes(decl)][0];
      return !owner || visible.has(owner);
    }));
  }
  function functionFacts(node: ts.FunctionLikeDeclaration, env: Bindings): Facts {
    env = relevant(node, env);
    const key = `function:${id(node)}:${context(env)}`;
    if (!functions.has(key)) functions.set(key, { node, env: new Map(env) });
    return new Set([key]);
  }
  const returnCache = new Map<ts.FunctionLikeDeclaration, ts.Expression[]>();
  function returns(fn: ts.FunctionLikeDeclaration): ts.Expression[] {
    if (returnCache.has(fn)) return returnCache.get(fn)!;
    const result: ts.Expression[] = [];
    function read(child: ts.Node) {
      if (ts.isReturnStatement(child) && child.expression) result.push(child.expression);
      else if (!ts.isFunctionLike(child)) ts.forEachChild(child, read);
    }
    if (fn.body && ts.isBlock(fn.body)) read(fn.body);
    else if (fn.body) result.push(fn.body as ts.Expression);
    returnCache.set(fn, result);
    return result;
  }
  function bind(fn: ts.FunctionLikeDeclaration, env: Bindings, args: Facts[]): Bindings {
    const bindings = new Map(env);
    fn.parameters.forEach((param, i) => {
      const sym = symbol(param.name);
      if (sym) bindings.set(sym, args[i] ?? facts(param.initializer, env));
    });
    return bindings;
  }
  function member(base: Facts, name: string, depth: number): Facts | undefined {
    const selected: Facts[] = [];
    for (const value of base) {
      const shape = shapes.get(value);
      if (!shape) continue;
      for (const prop of shape.node.properties) {
        if (ts.isSpreadAssignment(prop)) {
          const spread = member(facts(prop.expression, shape.env, depth), name, depth);
          if (spread) selected.push(spread);
        } else if (prop.name?.getText().replace(/["']/g, "") === name) {
          if (ts.isMethodDeclaration(prop)) selected.push(functionFacts(prop, shape.env));
          else if (ts.isPropertyAssignment(prop)) selected.push(facts(prop.initializer, shape.env, depth));
          else if (ts.isShorthandPropertyAssignment(prop)) {
            const sym = checker.getShorthandAssignmentValueSymbol(prop);
            const decl = sym?.valueDeclaration;
            selected.push(sym && shape.env.has(sym) ? shape.env.get(sym)! :
              decl && ts.isVariableDeclaration(decl) ? facts(decl.initializer, shape.env, depth) : new Set());
          }
        }
      }
    }
    return selected.length ? union(...selected) : undefined;
  }
  const symbol = (node: ts.Node) => {
    let result = checker.getSymbolAtLocation(node);
    if (result && result.flags & ts.SymbolFlags.Alias) result = checker.getAliasedSymbol(result);
    return result;
  };
  function report(node: ts.Node, operation: string, reason: string) {
    const source = node.getSourceFile();
    const line = source.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const file = path.relative(process.cwd(), source.fileName).split("\\").join("/");
    violations.set(`${file}:${node.pos}:${operation}`, { file, line, operation, reason });
  }
  function declaration(node: ts.Node): ts.FunctionLikeDeclaration | undefined {
    const decl = symbol(node)?.valueDeclaration;
    if (decl && ts.isFunctionLike(decl)) return decl as ts.FunctionLikeDeclaration;
    if (decl && ts.isVariableDeclaration(decl) && decl.initializer && ts.isFunctionLike(decl.initializer)) return decl.initializer as ts.FunctionLikeDeclaration;
    return undefined;
  }
  function platformReadOrDefinition(node: ts.CallExpression, receiver: Facts): boolean {
    if (!ts.isPropertyAccessExpression(node.expression)) return false;
    const decls = symbol(node.expression.name)?.declarations ?? [];
    // Standard-library collection/serialization operations consume data, not persistence handles.
    if (decls.some((decl) => /\/typescript\/lib\/lib\.[^/]+\.d\.ts$/.test(decl.getSourceFile().fileName.replace(/\\/g, "/")))) return true;
    // Strapi's exported definition factories register the framework API boundary.
    // Derive this from the imported namespace, never an application helper's name.
    const base = symbol(node.expression.expression);
    const imported = checker.getSymbolAtLocation(node.expression.expression)?.declarations;
    const namespace = imported?.find(ts.isImportSpecifier);
    const module = namespace?.parent.parent.parent;
    if (namespace && (namespace.propertyName ?? namespace.name).text === "factories" && module && ts.isImportDeclaration(module)
      && ts.isStringLiteral(module.moduleSpecifier) && module.moduleSpecifier.text === "@strapi/strapi"
      && base && decls.length > 0) return true;
    return node.expression.name.text === "get" && receiver.has("metadata");
  }
  function facts(node: ts.Node | undefined, env: Bindings, depth = 0): Facts {
    if (!node) return new Set();
    env = relevant(node, env);
    const key = `${id(node)}:${depth}:${context(env)}`;
    if (factCache.has(key)) return factCache.get(key)!;
    if (factActive.has(key)) return new Set(["unresolved"]);
    factActive.add(key);
    const result = readFacts(node, env, depth);
    factActive.delete(key);
    factCache.set(key, result);
    return result;
  }
  function readFacts(node: ts.Node, env: Bindings, depth: number): Facts {
    if (ts.isObjectLiteralExpression(node)) {
      const key = `object:${id(node)}:${context(env)}`;
      if (!shapes.has(key)) shapes.set(key, { node, env: new Map(env) });
      return new Set([key]);
    }
    if (ts.isFunctionExpression(node) || ts.isArrowFunction(node) || ts.isMethodDeclaration(node)) return functionFacts(node, env);
    if (ts.isStringLiteralLike(node)) return new Set([node.text]);
    if (ts.isPropertyAssignment(node)) return union(new Set([node.name.getText().replace(/["']/g, "")]), facts(node.initializer, env, depth));
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isNonNullExpression(node) || ts.isAwaitExpression(node)) return facts(node.expression, env, depth);
    if (ts.isIdentifier(node)) {
      const sym = symbol(node);
      if (sym && env.has(sym)) return env.get(sym)!;
      const decl = sym?.valueDeclaration;
      const type = checker.getTypeAtLocation(node);
      if (["Transaction", "Knex"].includes(type.getSymbol()?.getName() ?? type.aliasSymbol?.getName() ?? "")) return new Set(["knexFactory"]);
      if (decl && ts.isVariableDeclaration(decl)) {
        if (decl.initializer) return facts(decl.initializer, env, depth);
      }
      if (decl && ts.isFunctionLike(decl)) return functionFacts(decl as ts.FunctionLikeDeclaration, env);
      if (decl && ts.isBindingElement(decl)) {
        const name = decl.propertyName?.getText().replace(/["']/g, "") ?? decl.name.getText();
        const base = facts(decl.parent.parent, env, depth);
        return member(base, name, depth) ?? union(base, new Set([name]));
      }
      return type.isStringLiteral() ? new Set([type.value]) : type.isUnion()
        ? new Set(type.types.filter((item): item is ts.StringLiteralType => item.isStringLiteral()).map((item) => item.value)) : new Set();
    }
    if (ts.isVariableDeclaration(node)) return facts(node.initializer, env, depth);
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const names = ts.isPropertyAccessExpression(node) ? [node.name.text] : [...facts(node.argumentExpression, env, depth)];
      const base = facts(node.expression, env, depth);
      const selected = names.map((name) => member(base, name, depth)).filter((value): value is Facts => value !== undefined);
      if (selected.length) return union(...selected);
      const name = names[0] ?? "";
      if (["userTable", "outboxTable", "userRoleTable"].includes(name)) return new Set([name]);
      if (name === "connection") return new Set(["knexFactory", "databaseReceiver"]);
      if (name === "documents") return new Set(["documentFactory"]);
      if (name === "query" || name === "createQueryBuilder") return new Set(["queryFactory"]);
      const decl = symbol(ts.isPropertyAccessExpression(node) ? node.name : node)?.valueDeclaration;
      if (decl && ts.isPropertyAssignment(decl)) return facts(decl.initializer, env, depth);
      // A known literal has no provenance from its unrelated siblings.
      if ([...base].some((value) => shapes.has(value))) return new Set([name]);
      return union(base, new Set([name]));
    }
    if (ts.isCallExpression(node)) {
      const args = node.arguments.map((arg) => facts(arg, env, depth));
      const receiver = facts(node.expression, env, depth);
      const method = ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : receiver.has("documentFactory") ? "documents" : receiver.has("queryFactory") ? "query" : "";
      if (method === "bind" && ts.isPropertyAccessExpression(node.expression)) return facts(node.expression.expression, env, depth);
      const targets = callTargets(node.expression, receiver, env);
      if (targets.length) {
        if (depth >= maxDepth) {
          if (protectedTarget(expanded(union(...args)))) report(node, "unresolved-helper", "Interprocedural depth limit receives a user persistence target");
          return union(...args, new Set(["unresolved"]));
        }
        return union(...targets.flatMap(({ node: fn, env: closure }) => {
          const bindings = bind(fn, closure, args);
          return returns(fn).map((expr) => facts(expr, bindings, depth + 1));
        }));
      }
      if (["documents", "query", "createQueryBuilder", "getConnection", "connection", "table", "from"].includes(method)) {
        return union(...args, new Set([method === "documents" ? "documentReceiver" : "databaseReceiver"]));
      }
      if (platformReadOrDefinition(node, receiver)) return new Set();
      return union(receiver, ...args);
    }
    const children: Facts[] = [];
    ts.forEachChild(node, (child) => { children.push(facts(child, env, depth)); });
    return union(...children);
  }
  function callTargets(expr: ts.Expression, receiver: Facts, env: Bindings) {
    if (ts.isPropertyAccessExpression(expr) && expr.name.text === "bind") return [];
    const targets = [...receiver].flatMap((value) => functions.has(value) ? [functions.get(value)!] : []);
    const fn = declaration(expr);
    if (!targets.length && fn?.body && !fn.getSourceFile().fileName.includes("node_modules")) targets.push({ node: fn, env });
    return targets.filter(({ node }) => !!node.body && !node.getSourceFile().fileName.includes("node_modules"));
  }
  function expanded(values: Facts, seen = new Set<string>()): Facts {
    const result = new Set(values);
    for (const value of values) {
      const shape = shapes.get(value);
      if (!shape || seen.has(value)) continue;
      seen.add(value);
      for (const prop of shape.node.properties) {
        if (ts.isMethodDeclaration(prop)) continue;
        const nested = ts.isSpreadAssignment(prop) ? facts(prop.expression, shape.env) : facts(prop, shape.env);
        for (const item of expanded(nested, seen)) result.add(item);
      }
    }
    return result;
  }
  function inspectFunction(fn: ts.FunctionLikeDeclaration, env: Bindings, depth: number, call: ts.CallExpression, targets: Facts) {
    env = relevant(fn, env);
    const key = `${id(fn)}:${context(env)}`;
    if (depth >= maxDepth || inspectionActive.has(key)) {
      if (protectedTarget(expanded(targets))) report(call, "unresolved-helper", "Interprocedural depth limit receives a user persistence target");
      return;
    }
    if (inspectionCache.has(key)) return;
    inspectionActive.add(key);
    inspect(fn.body!, new Map(env), depth + 1);
    inspectionActive.delete(key);
    inspectionCache.add(key);
  }
  function inspect(node: ts.Node, env: Bindings, depth = 0) {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) {
      const sym = symbol(node.left); if (sym) env.set(sym, union(env.get(sym) ?? new Set(), facts(node.right, env)));
    }
    if (ts.isCallExpression(node)) {
      const receiver = ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression) ? facts(node.expression.expression, env) : facts(node.expression, env);
      const methods = ts.isElementAccessExpression(node.expression)
        ? [...facts(node.expression.argumentExpression, env)]
        : [ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : receiver.has("documentFactory") ? "documents" : receiver.has("queryFactory") ? "query" : receiver.has("knexFactory") ? "connection" : [...receiver].find((fact) => mutations.has(fact)) ?? ""];
      const method = methods[0] ?? "";
      const args = node.arguments.map((arg) => facts(arg, env));
      const inverse = [...receiver].some((v) => ["api::role.role", "api::identity-source.identity-source", "api::keycloak-sync-outbox.keycloak-sync-outbox"].includes(v))
        && args.some((arg) => { const all = expanded(arg); return all.has("idamboxUsers") || all.has("serviceUser") || all.has("idamboxUser"); });
      for (const method of methods) if (mutations.has(method) && (protectedTarget(receiver) || inverse || ((receiver.has("entityService") || receiver.has("entityManager")) && args.some(protectedTarget)))) {
        if (!receiver.has("documentReceiver") || receiver.has("databaseReceiver") || receiver.has("entityService")) report(node, method, "User persistence requires Document Service");
      }
      if (method === "raw") {
        const sql = node.arguments[0];
        const sqlFacts = facts(sql, env);
        const statements = [...sqlFacts];
        const writes = statements.some((value) => /\b(insert|update|delete|replace|truncate|merge)\b/i.test(value.replace(/\bfor\s+update\b/ig, "")));
        const userTarget = protectedTarget(sqlFacts) || args.slice(1).some(protectedTarget);
        if (writes && userTarget) report(node, "raw", "Raw user mutation");
        else if (userTarget && !statements.some((value) => /^\s*select\b/i.test(value))) report(node, "unresolved-raw", "Unresolved SQL receives a user persistence target");
      }
      const targets = callTargets(node.expression, facts(node.expression, env), env);
      if (targets.length) {
        for (const { node: fn, env: closure } of targets) inspectFunction(fn, bind(fn, closure, args), depth, node, union(receiver, ...args));
      } else if (!platformReadOrDefinition(node, receiver) && (methods.length === 0 || methods.some((method) => ![...mutations, "documents", "query", "createQueryBuilder", "getConnection", "connection", "table", "from", "findOne", "findMany", "findFirst", "count", "select", "raw", "ref", "where", "whereRaw", "forUpdate", "leftJoin"].includes(method)))
        && ((receiver.has("databaseReceiver") && protectedTarget(receiver))
          || args.some((arg) => { const all = expanded(arg); return protectedTarget(all) && !all.has("documentReceiver"); }))) {
        report(node, "unresolved-helper", "Unresolved helper receives a user persistence target");
      }
    }
    ts.forEachChild(node, (child) => inspect(child, env, depth));
  }
  for (const source of sources) inspect(source, new Map());
  return [...violations.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}

export function checkIdamboxUserWrites(root = path.resolve(process.cwd(), "src"), coverage?: (fileCount: number) => void): WriteViolation[] {
  root = path.resolve(root);
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? files(path.join(directory, entry.name)) : entry.name.endsWith(".ts") ? [path.join(directory, entry.name)] : []);
  const config = ts.findConfigFile(path.dirname(root), ts.sys.fileExists);
  if (!config) throw new Error("WRITE_GUARD_CONFIG_MISSING");
  const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(config, ts.sys.readFile).config, ts.sys, path.dirname(config));
  const program = ts.createProgram(files(root), parsed.options);
  // TypeScript reports forward-slash file names; compare resolved native paths so Windows scans too.
  const sources = program.getSourceFiles().filter((s) => !s.isDeclarationFile && path.resolve(s.fileName).startsWith(root + path.sep));
  // An empty inventory would pass vacuously.
  if (sources.length === 0) throw new Error("WRITE_GUARD_NO_SOURCES");
  coverage?.(sources.length);
  return findIdamboxWriteViolations(program, sources);
}
if (require.main === module && process.argv.includes("--check")) {
  const violations = checkIdamboxUserWrites();
  for (const violation of violations) process.stderr.write(`${violation.file}:${violation.line} ${violation.operation}: ${violation.reason}\n`);
  if (violations.length) process.exitCode = 1;
  else process.stdout.write("IdamBox user write inventory passed.\n");
}
