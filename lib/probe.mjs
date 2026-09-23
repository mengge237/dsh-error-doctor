import fs from "node:fs";
import path from "node:path";
const NL = String.fromCharCode(10);

// 只读体检：把已安装产物里的两个分类器抠出来、真的调用它们。
// 不用「比字符串先后」判：补丁会把额度判定放进 403 分支内部，文字顺序会骗人。
export function findRoot(cliRoot) {
  if (cliRoot) return cliRoot;
  if (process.env.DSH_INSTALL_ROOT) return process.env.DSH_INSTALL_ROOT;
  const cands = [];
  for (const d of (process.env.PATH || "").split(path.delimiter)) {
    const p = path.join(d, "dsh");
    let isFile = false;
    try { isFile = fs.statSync(p).isFile(); } catch (e) {}
    if (!isFile) continue;
    cands.push(path.join(path.dirname(p), "node_modules", "@deepseek-ai", "dsh"));
    try { cands.push(path.join(path.dirname(fs.realpathSync(p)), "node_modules", "@deepseek-ai", "dsh")); } catch (e) {}
  }
  for (const c of cands) { if (fs.existsSync(path.join(c, "lib"))) return c; }
  return null;
}

function pickPkg(root, pkg) {
  const nested = path.join(root, "node_modules", "@deepseek-ai", pkg, "lib", "index.js");
  if (fs.existsSync(nested)) return nested;
  const hoisted = path.join(path.dirname(root), pkg, "lib", "index.js");
  if (fs.existsSync(hoisted)) return hoisted;
  throw new Error("两种布局都找不到 " + pkg);
}

function grab(text, sig) {
  const i = text.indexOf(sig);
  if (i < 0) throw new Error("产物里没有 " + sig);
  const j = text.indexOf(NL + "}", i);
  if (j < 0) throw new Error(sig + " 的结尾形状不认识");
  return text.slice(i, j + 2);
}

function dsClassifier(src) {
  if (src.indexOf("function httpErrorCode(") >= 0) return grab(src, "function httpErrorCode(");
  const i = src.indexOf("function providerError(");
  if (i < 0) throw new Error("既没有 httpErrorCode 也没有 providerError：形状又变了");
  const lines = src.slice(i).split(NL);
  const start = lines.findIndex(function (l) { return l.trim() === "let code;"; });
  if (start < 0) throw new Error("providerError 里找不到 let code; 那行");
  let end = start;
  while (end < lines.length && lines[end].trim().indexOf("else code =") !== 0) end++;
  if (end >= lines.length) throw new Error("providerError 判定链的结尾形状变了");
  const parts = [
    "function httpErrorCode(status, error) {",
    "  const e = (error && typeof error === \"object\") ? error : {};",
    "  const type = typeof e.type === \"string\" ? e.type : \"\";",
    "  const detail = [e.code, type, e.message].filter(Boolean).join(\" \");",
    "  " + lines.slice(start, end + 1).join(NL),
    "  return code;",
    "}",
  ];
  return parts.join(NL);
}

export function buildClassifiers(root) {
  const core = fs.readFileSync(pickPkg(root, "dsh-llm"), "utf8");
  const pi = fs.readFileSync(pickPkg(root, "dsh-llm-pi-ai"), "utf8");
  const ds = fs.readFileSync(pickPkg(root, "dsh-llm-deepseek"), "utf8");
  const code = [
    grab(core, "function isQuotaExceededError("),
    grab(core, "function isContextWindowExceededError("),
    "const QUOTA_EXCEEDED_CODE = \"QUOTA\";",
    "const CONTEXT_WINDOW_EXCEEDED_CODE = \"CONTEXT_WINDOW_EXCEEDED\";",
    grab(pi, "function classifyPiAiError("),
    dsClassifier(ds),
    "return { classifyPiAiError: classifyPiAiError, httpErrorCode: httpErrorCode };",
  ].join(NL);
  return new Function(code)();
}

export const SAMPLE_403_QUOTA = "403: {\"message\":\"Free quota exhausted. To continue accessing the model on a paid basis, please add funds or disable the free-tier-only mode\",\"type\":\"insufficient_quota\",\"code\":\"insufficient_quota\"}";

export function probeInstall(root) {
  const out = { root: root, version: "?", sites: {}, verdicts: [] };
  try { out.version = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version || "?"; } catch (e) {}
  let f;
  try { f = buildClassifiers(root); } catch (e) { out.error = String(e && e.message ? e.message : e); return out; }
  const call = function (name, ffn) {
    try { return ffn(); } catch (e) { return "extract-failed"; }
  };
  out.sites.piAi = { verdict: call("pi", function () { return f.classifyPiAiError(SAMPLE_403_QUOTA); }) };
  out.sites.deepseek = { verdict: call("ds", function () { return f.httpErrorCode(403, { code: "insufficient_quota", type: "insufficient_quota", message: "Free quota exhausted. To continue accessing the model on a paid basis" }); }) };
  for (const k of ["piAi", "deepseek"]) {
    const v = out.sites[k].verdict;
    out.verdicts.push(v === "QUOTA" ? "patched" : v === "AUTH" ? "pristine" : "unknown");
  }
  return out;
}
