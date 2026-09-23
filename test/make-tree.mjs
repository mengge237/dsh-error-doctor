// 在临时目录里拼一棵最小假装机树：出厂 / 已修 两种形状各一份。
// 刻意不提交上游产物副本 —— 体积小、没有再分发问题，也不依赖任何人的盘符。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const B = String.fromCharCode(92);
const Q = String.fromCharCode(34);

const CORE = [
  "function isQuotaExceededError(m) {",
  "  return /free quota|quota exhausted|insufficient_quota|exceeded your current quota|insufficient balance|never purchased credits/i.test(m);",
  "}",
  "function isContextWindowExceededError(m) {",
  "  return /maximum context length|context length/i.test(m);",
  "}",
  "",
].join("\n");

function piAi(patched) {
  const first = patched
    ? "  if (/" + B + "b401" + B + "b/.test(message)) return " + Q + "AUTH" + Q + ";"
    : "  if (/" + B + "b(?:401|403)" + B + "b/.test(message)) return " + Q + "AUTH" + Q + ";";
  const last = patched
    ? "  if (/" + B + "b403" + B + "b/.test(message)) return " + Q + "AUTH" + Q + ";"
    : "  // 出厂件里 403 已经在第一行被吞掉了";
  return [
    "function classifyPiAiError(message) {",
    first,
    "  if (isQuotaExceededError(message)) return QUOTA_EXCEEDED_CODE;",
    "  if (/" + B + "b429" + B + "b|rate.?limit/i.test(message)) return " + Q + "RATE_LIMIT" + Q + ";",
    last,
    "  return " + Q + "UNKNOWN" + Q + ";",
    "}",
    "",
  ].join("\n");
}

function deepseek(patched) {
  const branch = patched
    ? [
      "  if (status === 401 || type === " + Q + "authentication_error" + Q + ") return " + Q + "AUTH" + Q + ";",
      "  if (isQuotaExceededError(detail) || status === 402) return QUOTA_EXCEEDED_CODE;",
      "  if (status === 429) return " + Q + "RATE_LIMIT" + Q + ";",
      "  if (status === 403) return " + Q + "AUTH" + Q + ";",
    ]
    : [
      "  if (status === 401 || status === 403) return " + Q + "AUTH" + Q + ";",
      "  if (isQuotaExceededError(detail) || status === 402) return QUOTA_EXCEEDED_CODE;",
      "  if (status === 429) return " + Q + "RATE_LIMIT" + Q + ";",
    ];
  return [
    "function httpErrorCode(status, error) {",
    "  const e = (error && typeof error === " + Q + "object" + Q + ") ? error : {};",
    "  const type = typeof e.type === " + Q + "string" + Q + " ? e.type : " + Q + Q + ";",
    "  const detail = [e.code, type, e.message].filter(Boolean).join(" + Q + " " + Q + ");",
  ].concat(branch).concat([
    "  return status >= 500 ? " + Q + "SERVER" + Q + " : " + Q + "HTTP_" + Q + " + status;",
    "}",
    "",
  ]).join("\n");
}

export function makeTree(patched) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-doctor-"));
  const ai = path.join(dir, "node_modules", "@deepseek-ai");
  const dsh = path.join(ai, "dsh");
  const files = [["dsh-llm", CORE], ["dsh-llm-pi-ai", piAi(patched)], ["dsh-llm-deepseek", deepseek(patched)]];
  for (const pair of files) {
    const one = path.join(ai, pair[0], "lib");
    fs.mkdirSync(one, { recursive: true });
    fs.writeFileSync(path.join(one, "index.js"), pair[1]);
  }
  fs.mkdirSync(path.join(dsh, "lib"), { recursive: true });
  fs.writeFileSync(path.join(dsh, "package.json"), JSON.stringify({ name: "@deepseek-ai/dsh", version: "fixture" }));
  fs.writeFileSync(path.join(dsh, "lib", "index.js"), "");
  return dsh;
}
