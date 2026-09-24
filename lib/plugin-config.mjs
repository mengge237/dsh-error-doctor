// 工具的纯配置与实现：不 import 任何宿主包，所以能离线测。
// lib/index.js 只负责把它交给 ctx.tools.register(defineTool(...))。
import { findRoot, probeInstall } from "./probe.mjs";

export const TOOL_NAME = "dsh_error_doctor";

export const TOOL_DESCRIPTION = "只读体检：这台机器上安装的 DSH，403 的额度类回包会不会被判成 API 密钥无效。"
  + "返回两个站点的实际判定（QUOTA 或 AUTH）与结论。不写文件、不改产物、不发消息。";

const MAP = { patched: "已修：额度判定在前", pristine: "出厂形状：403 先被吞成 AUTH", unknown: "形状不认识" };

// 单一输出来源：CLI 与工具面共用这一个函数，避免两边措辞漂移（09-24 实测就漂了）。
export function verdictCode(verdicts) {
  const s = verdicts || [];
  if (s.length === 2 && s.every((x) => x === "patched")) return 0;
  if (s.length === 2 && s.every((x) => x === "pristine")) return 1;
  return 2;
}

export function formatReport(r) {
  const lines = [
    "DSH 安装: " + r.root + "  (版本 " + r.version + ")",
  ];
  if (r.error) {
    lines.push("  读不出来（不猜）：" + r.error);
    lines.push("结论: 读不出来，别硬打补丁，先核对版本。");
    return lines.join("\n");
  }
  lines.push("  classifyPiAiError  -> 403 额度报文判成 " + r.sites.piAi.verdict);
  lines.push("  httpErrorCode      -> 403 额度报文判成 " + r.sites.deepseek.verdict);
  lines.push("  站点一: " + (MAP[r.verdicts[0]] || r.verdicts[0]));
  lines.push("  站点二: " + (MAP[r.verdicts[1]] || r.verdicts[1]));
  const code = verdictCode(r.verdicts);
  lines.push(code === 0
    ? "结论: 两处都不再把额度用完判成密钥无效。"
    : code === 1
      ? "结论: 两处都还是出厂形状 —— 升级多半把补丁静默冲掉了，重打后再体检一次。"
      : "结论: 两边不一致或读不出来，别硬打补丁，先核对版本。");
  return lines.join("\n");
}

// 内核：root 可注入（测试喂夹具树），工具面本身不暴露参数。
export function diagnose(explicitRoot, deps) {
  const d = deps || {};
  const find = d.findRoot || findRoot;
  const probe = d.probeInstall || probeInstall;
  const root = find(explicitRoot || null);
  if (!root) {
    return "找不到 DSH 安装目录：命令行用 --root <路径>，或设环境变量 DSH_INSTALL_ROOT。";
  }
  return formatReport(probe(root));
}

export function toolConfig(deps) {
  const d = deps || {};
  return {
    name: TOOL_NAME,
    description: TOOL_DESCRIPTION,
    // 宿主 schema 不接受 required:false（实测报 "parameters.root.required must be
    // true when present"），可选参数只能整键省略 —— 所以这个工具无参数，
    // 安装目录自己找；要指路的场景交给 CLI 的 --root。
    parameters: {},
    output: {
      schema: { type: "string" },
      render(_args, value) {
        return [{ type: "text", text: String(value) }];
      },
    },
    async execute() {
      return diagnose(null, d);
    },
  };
}
