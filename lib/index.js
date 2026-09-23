// 装机插件的薄壳。注册面照官方件（dsh-tool-skill:167、dsh-tool-bash:259）：
//   ctx.tools.register(defineTool(toolConfig()))
//
// 一条实测边界：宿主包 @deepseek-ai/dsh-tools 只能**从 profile 树内**解析到（本机实测），
// 用 link: 装的话 realpath 在树外，静态 import 会让整个插件树加载失败（cordis include 那类炸法）。
// 所以这里走动态 import 且失败即降级：工具面没有就只留 CLI，绝不把插件树带崩。
import { toolConfig, TOOL_NAME } from "./plugin-config.mjs";

export const name = "dsh-error-doctor";
export const inject = ["tools"];

export async function apply(ctx) {
  let defineTool = null;
  try {
    ({ defineTool } = await import("@deepseek-ai/dsh-tools"));
  } catch (error) {
    const note = "[dsh-error-doctor] 解析不到 @deepseek-ai/dsh-tools，工具面跳过（CLI 仍可用）。"
      + " 用包安装而不是 link: 装，才会挂上 " + TOOL_NAME + "。";
    if (ctx && ctx.log && typeof ctx.log.warn === "function") ctx.log.warn(note);
    else console.warn(note);
    return;
  }
  if (!ctx || !ctx.tools || typeof ctx.tools.register !== "function") {
    console.warn("[dsh-error-doctor] ctx.tools 不可用，跳过注册。");
    return;
  }
  ctx.tools.register(defineTool(toolConfig()));
  if (ctx.log && typeof ctx.log.info === "function") ctx.log.info("[dsh-error-doctor] 已注册工具 " + TOOL_NAME);
}

export { toolConfig, TOOL_NAME };
