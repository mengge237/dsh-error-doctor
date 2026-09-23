// 离线测试：不碰宿主包，所以能在任何机器上跑。
import test from "node:test";
import assert from "node:assert/strict";
import { toolConfig, TOOL_NAME } from "../lib/plugin-config.mjs";
import { makeTree } from "./make-tree.mjs";

const pristine = makeTree(false);
const patched = makeTree(true);
const tool = toolConfig();

test("工具配置形状齐（name/description/parameters/output/execute）", () => {
  assert.equal(tool.name, TOOL_NAME);
  assert.ok(tool.description.length > 20);
  assert.deepEqual(tool.parameters, {}, "参数必须是空对象：宿主 schema 不接受 required:false");
  assert.ok(!JSON.stringify(tool.parameters).includes("required"));
  assert.equal(typeof tool.execute, "function");
  assert.deepEqual(tool.output.render({}, "x"), [{ type: "text", text: "x" }]);
});

test("execute 在出厂形状上报「出厂」", async () => {
  const out = await tool.execute.call(null, { root: pristine });
  assert.match(out, /出厂形状/);
  assert.match(out, /判成 AUTH/);
});

test("execute 在已修形状上报「已修」", async () => {
  const out = await tool.execute.call(null, { root: patched });
  assert.match(out, /不再把额度用完判成密钥无效/);
  assert.match(out, /判成 QUOTA/);
});

test("找不到目录时给人话，不抛异常", async () => {
  const out = await toolConfig({
    findRoot: () => null,
    probeInstall: () => ({ error: "x" }),
  }).execute({});
  assert.match(out, /找不到 DSH 安装目录/);
});

test("读不出来时明说，不给绿色结论", async () => {
  const t = toolConfig({
    findRoot: () => "/somewhere",
    probeInstall: () => ({ error: "产物里没有 function classifyPiAiError(" }),
  });
  const out = await t.execute({});
  assert.match(out, /读不出来/);
  assert.doesNotMatch(out, /结论: 两处都不再/);
});
