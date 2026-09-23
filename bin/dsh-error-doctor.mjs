#!/usr/bin/env node
import { findRoot, probeInstall } from "../lib/probe.mjs";
const argv = process.argv.slice(2);
const gi = argv.indexOf("--root");
const root = findRoot(gi >= 0 ? argv[gi + 1] : null);
if (!root) { console.log("找不到 DSH 安装目录：用 --root <路径> 或设 DSH_INSTALL_ROOT"); process.exit(2); }
const r = probeInstall(root);
if (argv.indexOf("--json") >= 0) console.log(JSON.stringify(r, null, 2));
else {
  console.log("DSH 安装: " + r.root + "  (版本 " + r.version + ")");
  if (r.error) console.log("  读不出来: " + r.error);
  for (const k of ["piAi", "deepseek"]) {
    if (r.sites[k]) console.log("  403 额度报文在 " + k + " 被判成 -> " + r.sites[k].verdict);
  }
}
const s = r.verdicts || [];
let code = 2;
if (s.length === 2 && s.every((x) => x === "patched")) code = 0;
else if (s.length === 2 && s.every((x) => x === "pristine")) code = 1;
console.log(code === 0 ? "结论: 两处都不再把「额度用完」判成密钥无效。"
  : code === 1 ? "结论: 两处都还是出厂形状 —— 升级把补丁静默冲掉了，重打后再体检一次。"
  : "结论: 两个站点不一致或读不出来，别硬打，先核对版本。");
process.exit(code);
