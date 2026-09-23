// 断言的是判据本身：出厂形状必须报 pristine，改过的必须报 patched，而且探针全程只读。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { probeInstall } from "../lib/probe.mjs";
import { makeTree } from "./make-tree.mjs";

const pristineRoot = makeTree(false);
const patchedRoot = makeTree(true);

test("出厂形状：403 的额度报文在两个站点都被判成 AUTH", () => {
  const r = probeInstall(pristineRoot);
  assert.equal(r.sites.piAi.verdict, "AUTH");
  assert.equal(r.sites.deepseek.verdict, "AUTH");
  assert.deepEqual(r.verdicts, ["pristine", "pristine"]);
});

test("已修形状：同一报文两处都判成 QUOTA", () => {
  const r = probeInstall(patchedRoot);
  assert.deepEqual(r.verdicts, ["patched", "patched"]);
});

test("只读：跑完探针之后产物字节不变", () => {
  const f = path.join(path.dirname(pristineRoot), "dsh-llm-pi-ai", "lib", "index.js");
  const before = fs.readFileSync(f);
  probeInstall(pristineRoot);
  assert.deepEqual(fs.readFileSync(f), before);
});

test("形状不认识时不猜：报错而不是给个绿色", () => {
  const dir = fs.mkdtempSync(path.join(fs.mkdtempSync("/tmp/"), "empty-"));
  const r = probeInstall(dir);
  assert.ok(r.error, "应该带 error 字段");
  assert.equal(r.verdicts.length, 0);
});
