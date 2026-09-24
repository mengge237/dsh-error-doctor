#!/usr/bin/env node
// CLI 与工具面共用 lib/plugin-config.mjs 里的 formatReport —— 输出只有一份来源。
import { findRoot, probeInstall } from "../lib/probe.mjs";
import { formatReport, verdictCode } from "../lib/plugin-config.mjs";
const argv = process.argv.slice(2);
const gi = argv.indexOf("--root");
const root = findRoot(gi >= 0 ? argv[gi + 1] : null);
if (!root) {
  console.log("找不到 DSH 安装目录：用 --root <路径> 或设环境变量 DSH_INSTALL_ROOT");
  process.exit(2);
}
const r = probeInstall(root);
if (argv.indexOf("--json") >= 0) {
  console.log(JSON.stringify(r, null, 2));
} else {
  console.log(formatReport(r));
}
process.exit(verdictCode(r.verdicts));
