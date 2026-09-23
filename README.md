# dsh-error-doctor

只读体检：你这台机器上装的 DSH，**403 的额度类回包会不会被判成「API 密钥无效」**。

DSH 的适配器把 `403` 并进了鉴权那一支，排在额度判定之前 —— 于是"免费额度用完即停"这类失败在界面上只说密钥有问题，原始原因看不见。本件不替你改代码，它回答一个问题：**你现在的产物判成了什么**。

## 用法

```bash
node bin/dsh-error-doctor.mjs            # 自己从 PATH 找 DSH 安装目录
node bin/dsh-error-doctor.mjs --json     # 机器可读
```

退出码就是判据：

| 码 | 意思 |
| --- | --- |
| 0 | 两处都已修（额度判定在前） |
| 1 | 两处都还是出厂形状 —— 多半是升级把补丁**静默**冲掉了 |
| 2 | 读不出来或两边不一致：**别硬打补丁**，先核对版本 |

为什么需要它：DSH 升级会覆盖安装目录，补丁消失是不打日志、不报错的。所以"最近还能用"不算证据，跑一次这条命令才算。

## 判据为什么不是"读源码"

这条是本件最值钱的部分，因为第一版就是按"源码里 403 与额度判定谁先出现"写的，实测连错三次：

1. 补丁自己的注释里写着 `…then 403`，静态扫字符串把已修的产物读成没修；
2. 有一类正确修法是把额度判定**放进 403 分支内部**（`if (status === 403) { if (isQuota(...)) return QUOTA; … }`）—— 文字上 403 在前，语义上已经修好；
3. 同一个产物文件里还有另一处 `status === 401 || status === 403`，那是 Files API 的错误构造器，与分类无关；"取文件里第一个匹配"会直接改错地方（造对照夹具时真踩了）。

所以现在的做法是：把已安装产物里的 `classifyPiAiError` 与 `httpErrorCode`（0.1.7 线叫 `providerError`，会把判定链抠进同名壳子）连同 `isQuotaExceededError` 一起抠出来，**喂一条真实的 403 额度报文，看它返回 QUOTA 还是 AUTH**。不认注释、不认行号、不认版本 —— 别人打的补丁照样认得出。

## 当插件装：给 agent 一个工具面

```bash
dsh plugin --profile web add dsh-error-doctor      # 装完要完全重启 dsh web
dsh plugin --profile web remove dsh-error-doctor
```

工具名 `dsh_error_doctor`，参数只有一个可选的 `root`。

一条实测边界值得写下来：**宿主包 `@deepseek-ai/dsh-tools` 只能从 profile 树内解析到**。用 `link:` 把仓库原地链进插件树时，Node 顺着 realpath 往上找不到它，而静态 import 会把整棵插件树加载带崩（cordis include 那类失败法）。所以 `lib/index.js` 走动态 import 且**失败即降级**：解析不到就留一条 warn、不注册工具、CLI 照常可用。要工具面就用包安装，别用 link。

## 当库用

```js
import { findRoot, probeInstall } from "dsh-error-doctor";
import { toolConfig } from "dsh-error-doctor/plugin-config";
```

`plugin-config` 不 import 任何宿主包，所以能在没有 DSH 的机器上测。

## 测试

```bash
npm test        # 9 例：体检 4 例 + 插件面 5 例
```

夹具由 `test/make-tree.mjs` 在临时目录合成（两种形状的假装机树），因此**不需要装 DSH**，仓库里也不放上游产物副本。其中一例专门钉"跑完探针之后产物字节不变"，一例钉"读不出来必须报错、不给绿色结论"。

## 边界

- 只读：不写文件、不发网络请求、不碰会话存档、不读密钥。
- 认不出的形状一律报 2 并说明原因。
- 实证过的形状：0.1.5-rc.2 的 `httpErrorCode`、0.1.7-alpha.2 与 0.1.7-rc.1 的 `providerError`。上游再改形状的话它会拒绝判断，而不是给你一个假结论。
- 关于上游：`0.1.7-rc.1` 的产物里 403 仍排在额度判定之前。同一形状在上游被报过 #3222 / #5715 / #3073 / #1127 / #1631，措辞表那条是我自己开的 #7649。

MIT。个人项目，与上游无关。
