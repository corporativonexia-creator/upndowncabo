"use strict";

const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const assert = require("node:assert/strict");
const ts = require("typescript");

const source = readFileSync(path.join(__dirname, "../src/components/store/storefront-parity.tsx"), "utf8");
const start = source.indexOf("function repairMojibake(");
const end = source.indexOf("function cartUnitsFromStorage(");
assert.ok(start >= 0 && end > start, "The text-repair helpers must exist");

function textNode(value) {
  const stats = { reads: 0, writes: 0 };
  let current = value;
  return {
    nodeType: 3,
    get nodeValue() { stats.reads++; return current; },
    set nodeValue(next) { stats.writes++; current = next; },
    get value() { return current; },
    stats,
  };
}

function element(...children) {
  return { nodeType: 1, children };
}

const sandbox = {
  Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
  NodeFilter: { SHOW_TEXT: 4 },
  document: {
    createTreeWalker(root, kind) {
      assert.equal(kind, 4);
      const nodes = [];
      const visit = (node) => {
        for (const child of node.children || []) {
          if (child.nodeType === 3) nodes.push(child);
          else visit(child);
        }
      };
      visit(root);
      let next = 0;
      return { nextNode() { return nodes[next++] || null; } };
    },
  },
};
const extracted = source.slice(start, end) + "\nglobalThis.__repairFns = { repairStoreText, repairChangedStoreText };\n";
const compiled = ts.transpileModule(extracted, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
vm.runInNewContext(compiled, sandbox);
const { repairStoreText, repairChangedStoreText } = sandbox.__repairFns;

test("production repairs the initial markup only once; later updates are incremental", () => {
  assert.equal((source.match(/repairStoreText\(root\)/g) || []).length, 1);
  const observer = source.match(/const observer = root \? new MutationObserver\(\(records\) => \{([\s\S]*?)\}\) : null;/);
  assert.ok(observer, "The storefront MutationObserver must exist");
  assert.match(observer[1], /repairChangedStoreText\(records\)/);
  assert.doesNotMatch(observer[1], /repairStoreText\(root\)/);
  assert.match(source, /observer\?\.observe\(root!, \{ childList: true, subtree: true, characterData: true \}\)/);
});

test("a cart update does not rescan unrelated catalog cards", () => {
  const cards = Array.from({ length: 500 }, (_, i) => textNode("Tarjeta " + i));
  const root = element(...cards);
  repairStoreText(root);
  assert.ok(cards.every(card => card.stats.reads === 1));
  const before = cards.map(card => card.stats.reads);
  const changed = textNode("AgregÃ³ una pieza");
  repairChangedStoreText([{ type: "characterData", target: changed, addedNodes: [] }]);
  assert.equal(changed.value, "Agregó una pieza");
  assert.deepEqual(cards.map(card => card.stats.reads), before);
});

test("a newly inserted product subtree is repaired without touching siblings", () => {
  const unchanged = textNode("Tarjeta existente");
  const added = element(textNode("NiÃ±o"), element(textNode("MÃ¡s opciones")));
  repairChangedStoreText([{ type: "childList", target: element(unchanged), addedNodes: [added] }]);
  assert.equal(added.children[0].value, "Niño");
  assert.equal(added.children[1].children[0].value, "Más opciones");
  assert.equal(unchanged.stats.reads, 0);
});

test("a normalized text update never writes again or triggers an update loop", () => {
  const changed = textNode("Más piezas");
  const record = { type: "characterData", target: changed, addedNodes: [] };
  repairChangedStoreText([record]);
  repairChangedStoreText([record]);
  assert.equal(changed.stats.writes, 0);
});
