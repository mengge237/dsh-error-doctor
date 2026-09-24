// 装机插件的薄壳。注册面照官方件（dsh-tool-skill:167、dsh-tool-bash:259）：
//   ctx.tools.register(defineTool(toolConfig()))
//
// 一条实测边界：宿主包 @deepseek-ai/dsh-tools 只能从 profile 树内解析到（本机实测）；
// 用 link: 装时 realpath 在树外，静态 import 会让整棵插件树加载失败 —— 所以动态 import 且失败即降级，
// 只留 CLI，绝不把插件树带崩。注册成功不打日志（09-24 本人要求去掉那句噪声）。
import { toolConfig, TOOL_NAME } from "./plugin-config.mjs";

export const name = "dsh-error-doctor";
export const inject = ["tools"];

export async function apply(ctx) {
  let defineTool = null;
  try {
    ({ defineTool } = await import("@deepseek-ai/dsh-tools"));
  } catch (error) {
    const note = "[dsh-error-doctor] 解析不到 @deepseek-ai/dsh-tools，工具面跳过（CLI 仍可用）；用包安装而不是 link: 装才会挂上 " + TOOL_NAME + "。";
    if (ctx && ctx.log && typeof ctx.log.warn === "function") ctx.log.warn(note);
    else console.warn(note);
    return;
  }
  if (!ctx || !ctx.tools || typeof ctx.tools.register !== "function") {
    console.warn("[dsh-error-doctor] ctx.tools 不可用，跳过注册。");
    return;
  }
  ctx.tools.register(defineTool(toolConfig()));
}

export { toolConfig, TOOL_NAME };
