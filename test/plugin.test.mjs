// 离线测试：不碰宿主包，所以能在任何机器上跑。
// 断的是内核 diagnose（root 可注入）；工具面 execute() 走的是同一个函数，不再各写一套输出。
import test from "node:test";
import assert from "node:assert/strict";
import { toolConfig, diagnose, formatReport, TOOL_NAME } from "../lib/plugin-config.mjs";
import { makeTree } from "./make-tree.mjs";

const pristine = makeTree(false);
const patched = makeTree(true);
const tool = toolConfig();

test("工具配置形状齐，且参数必须是空对象（宿主 schema 不接受 required:false）", () => {
  assert.equal(tool.name, TOOL_NAME);
  assert.ok(tool.description.length > 20);
  assert.deepEqual(tool.parameters, {});
  assert.ok(!JSON.stringify(tool.parameters).includes("required"));
  assert.equal(typeof tool.execute, "function");
  assert.deepEqual(tool.output.render({}, "x"), [{ type: "text", text: "x" }]);
});

test("出厂形状：报 pristine 且两站都判成 AUTH", () => {
  const out = diagnose(pristine);
  assert.match(out, /出厂形状/);
  assert.match(out, /判成 AUTH/);
  assert.match(out, /两处都还是出厂形状/);
});

test("已修形状：报 patched 且两站都判成 QUOTA", () => {
  const out = diagnose(patched);
  assert.match(out, /判成 QUOTA/);
  assert.match(out, /两处都不再把额度用完判成密钥无效/);
});

test("CLI 与工具面共用同一个输出函数（防措辞漂移，09-24 实测漂过一次）", async () => {
  const a = await tool.execute();
  assert.equal(typeof formatReport, "function");
  assert.notEqual(a.indexOf("DSH 安装"), -1);
  const b = diagnose(patched);
  assert.equal(b.split("\n")[0].startsWith("DSH 安装:"), true);
  assert.equal(/站点一|站点二/.test(b), true);
});

test("找不到目录时给人话，不抛异常", () => {
  const out = diagnose(null, { findRoot: () => null, probeInstall: () => ({}) });
  assert.match(out, /找不到 DSH 安装目录/);
});

test("读不出来时明说，不给绿色结论", () => {
  const out = diagnose("/somewhere", { findRoot: (x) => x, probeInstall: () => ({ root: "/somewhere", version: "?", error: "产物里没有 classifyPiAiError" }) });
  assert.match(out, /读不出来/);
  assert.doesNotMatch(out, /都不再把额度用完/);
});
