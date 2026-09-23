// 工具的纯配置与实现：不 import 任何宿主包，所以能离线测。
// lib/index.js 只负责把它交给 ctx.tools.register(defineTool(...))。
import { findRoot, probeInstall } from "./probe.mjs";

export const TOOL_NAME = "dsh_error_doctor";

export const TOOL_DESCRIPTION = "只读体检：这台机器上安装的 DSH，403 的额度类回包会不会被判成 API 密钥无效。"
  + "返回两个站点的实际判定（QUOTA 或 AUTH）与结论。不写文件、不改产物、不发消息。";

export function toolConfig(deps) {
  const d = deps || {};
  const find = d.findRoot || findRoot;
  const probe = d.probeInstall || probeInstall;
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    parameters: {
      root: {
        type: "string",
        required: false,
        description: "DSH 安装目录（含 lib/ 的那一层）。省略则自己从 PATH 与环境变量 DSH_INSTALL_ROOT 找。",
      },
    },
    output: {
      schema: { type: "string" },
      render(_args, value) {
        return [{ type: "text", text: String(value) }];
      },
    },
    async execute(args) {
      const given = args && args.root ? args.root : null;
      const root = find(given);
      if (!root) {
        return "找不到 DSH 安装目录。显式传 root，或设环境变量 DSH_INSTALL_ROOT。";
      }
      const r = probe(root);
      if (r.error) {
        return "读不出来（不猜）：" + r.error + "\n安装目录: " + root;
      }
      const map = { patched: "已修：额度判定在前", pristine: "出厂形状：403 先被吞成 AUTH", unknown: "形状不认识" };
      const lines = [
        "DSH 安装: " + r.root + "  (版本 " + r.version + ")",
        "  classifyPiAiError  -> 403 额度报文判成 " + r.sites.piAi.verdict,
        "  httpErrorCode      -> 403 额度报文判成 " + r.sites.deepseek.verdict,
        "  站点一: " + (map[r.verdicts[0]] || r.verdicts[0]),
        "  站点二: " + (map[r.verdicts[1]] || r.verdicts[1]),
      ];
      if (r.verdicts.length === 2 && r.verdicts.every((x) => x === "patched")) {
        lines.push("结论: 两处都不再把额度用完判成密钥无效。");
      } else if (r.verdicts.every((x) => x === "pristine")) {
        lines.push("结论: 两处都还是出厂形状 —— 升级多半把补丁静默冲掉了，重打后再体检。");
      } else {
        lines.push("结论: 两边不一致或读不出来，别硬打补丁，先核对版本。");
      }
      return lines.join("\n");
    },
  };
}
