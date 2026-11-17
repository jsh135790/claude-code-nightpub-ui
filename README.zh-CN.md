# nightpub-ui

把 NightPub 的深色外观搬到 Claude Code 和 Claude Desktop，外加一块跟着外观走的实时用量面板：三套配色、两个会动的背景，侧边栏里看上下文、花费、限额和活动，输入框上方有一行实时横幅，还有一份同风格的 statusline。所有选项都在面板的设置页里。

[English](README.md) | 简体中文

![配色关闭时的面板，Catppuccin Mocha](docs/screenshot.png)

*配色关闭时的面板，也就是 0.5.0 之前的样子。*

这个插件在 0.4.1 及以前叫 `capsule-panel`，升级说明见[从 capsule-panel 升级](#从-capsule-panel-升级)。

## 外观

**配色（Palette）**：`ink`（墨与纸）、`tavern`（酒馆暖光）、`midnight`（午夜靛蓝），或者 `off`。选了配色，Claude Desktop 整个窗口、面板、横幅和 statusline 都用这套颜色。选 `off` 时插件不设主题，面板用 Catppuccin Mocha，和 0.5.0 之前一样。

**背景（Background）**，只在 Claude Desktop 里画，铺在对话后面：

- `glyph sea`（字符海）：一片很淡的字符缓缓漂移，偶尔有一圈涟漪扫过，把角落里的 NightPub 标记点亮
- `pixel night`（像素夜景）：稀疏的星星，右上角一轮月亮，底边一排小镇的屋顶，几扇窗亮着灯。大约每分钟一次，流星划过或者蝙蝠掠过月亮，两者轮流出现，酒馆的招牌跟着亮一下
- `none`：只有配色的底色

两个背景都不用脚本、字体和图片，没有事件的时候只是一格一格地动，窗口闲着时几乎不占资源。系统开了“减少动态效果”时，Claude Desktop 会把它们显示成静止的画面。

**在终端里**，插件没法给 Claude Code 本身换色，所以三套配色做成了主题：在 `/theme` 里选 `NightPub · 墨与纸`（或者你选的那套）。面板、横幅和 statusline 会自己跟着配色走；Claude 工作时，转圈提示词前面还有一小段背景字符组成的波纹。

配色和背景是所有端、所有会话共用的一份。新装的默认是 `ink` 配 `glyph sea`。

## 面板

侧边栏只有一页，按区块排列。暂时没有数据的区块会自动隐藏，每个区块在设置页里都有开关。新装时显示的是精简版，下面标了“默认关闭”的内容需要时再打开。

- **标题行**：Claude 是否在工作。当前模型和 effort 默认关闭，因为 statusline 一般已经显示了
- **CONTEXT**：上下文窗口占用，按类别分段显示，并标出自动压缩的触发位置。下面一行按最近几轮的增长速度估算还剩几轮触发自动压缩；Claude 空闲时旁边有一个 **compact now** 按钮（3 秒内连按两次才会压缩），压缩之后这一行会显示上下文从多少压到了多少。列出最大几个类别的图例默认关闭
- **CACHE**（默认关闭）：提示缓存命中率和缓存还能保温多久（最后一分钟按秒倒数，过期后显示 `cold`）；读写的 token 数另有一个开关
- **TOKENS / COST**：输入输出 token（每次请求后更新，包含子代理，恢复会话时会接着之前的数）、本次会话花费和每小时花费
- **SPEND**：这台机器上所有 Claude Code 会话今天和本周（从周一算起）一共花了多少。数据是 Claude Code 报告的会话花费（按 API 价格估算），记在插件自己的存储里。最近 7 天每天一根的柱子默认关闭
- **LIMITS**：每个限额窗口的重置倒计时，以及按当前消耗速度预测会不会在重置前用完。只有 Claude 订阅账号才会返回限额数据，没有的时候这一块隐藏，COST 改为显示每小时 token 数。预测到某个窗口会在重置前用完时，会弹一次 toast 提醒，每个窗口只提醒一次，这一块关掉了也照样提醒
- **ACTIVITY**：最近 3 次工具调用的耗时和结果（可选 5 条、3 条或不显示），以及正在运行的子代理。tok/s 火花线默认关闭
- **GIT**：当前分支、领先/落后的提交数、增删行数，以及本次会话里 Claude 改过的文件，最新的 3 个排在前面并标出增删行数（可选 5 个、3 个或不显示；未跟踪的新文件标 `new`）。不在 Git 仓库里时也会列出改过的文件
- **TODO**（默认关闭）：当前 todo 列表的进度和正在进行的步骤
- **底栏**：设置按钮。Claude Code 和 Claude Desktop 的版本号默认关闭

Claude 工作时，新出现的活动条目会先亮一下，一秒内褪回原色；达到 80% 的数字（上下文、限额）会红色呼吸闪动。空闲时面板保持静止。

Claude 工作时，输入框上方还会多出一行横幅：标明当前阶段或工具的胶囊、正在做什么和用了多久，右边是 tok/s、运行中的子代理和本轮用时。空闲时这一行不占位置。

每轮对话结束时，在有播放器的平台上会响一声短提示音。一轮跑了一分钟以上时还会发一条通知：Windows 上是屏幕右下角的系统弹窗，其他平台走 Claude Code 自己的通知通道。这两项在终端里默认打开，在 Claude Desktop 里默认关闭，因为 Desktop 自己会提示。

## 环境要求

- Claude Code 2.1.325 或更新版本，终端和 Claude Desktop 都能用
- 终端里建议使用 [Nerd Font](https://www.nerdfonts.com/) 字体显示图标（开发环境为 Windows Terminal + MartianMono Nerd Font）。没有的话在设置的 Look 页把 Icons 改成 `unicode`，面板会改用普通 Unicode 符号
- Claude Desktop 不需要任何设置，图标和胶囊会自动画成矢量图形

## 安装

在 Claude Code 终端会话的输入框里输入：

```
/plugin install nightpub-ui --marketplace jsh135790/claude-code-nightpub-ui
```

提示添加 marketplace 时输入 `y`，再按回车安装到用户范围，装完立即生效。

在 Claude Desktop 里：点输入框旁边的 +，进 Plugins，添加 marketplace `jsh135790/claude-code-nightpub-ui`，再添加插件。

## 使用

- 在终端里，窗口宽度达到 144 列时面板会自动打开
- 在 Claude Desktop 里，开启对话后面板会自动打开
- 任何宽度下都可以用 `/panel` 打开或关闭面板
- 面板底部的 **settings** 打开设置页，**← back** 回到仪表盘

## 设置

设置页分 **Look**、**Panel**、**Alerts** 三页，列出所有选项，每项旁边的按钮点一下切换到下一个取值。明细缩进排在所属区块下面，区块关掉时明细变灰。

配色和背景所有端共用一份。其余设置终端和 Claude Desktop 各存一份，在哪一端改就只影响哪一端。这些都存在插件自己的存储里，不在 `settings.json`，所以会重写 `settings.json` 的工具（比如供应商切换器）不会把它们冲掉。

### Look

| 设置 | 取值 | 默认 |
| --- | --- | --- |
| Palette（配色） | ink、tavern、midnight、off | ink |
| Background（背景） | glyph sea、pixel night、none | glyph sea |
| Icons（仅终端） | nerd、unicode | nerd |
| Spinner wave（转圈波纹，仅终端） | on、off | on |

- **Palette** 切到 `off` 时，插件设的主题立刻撤掉。之前选的背景会记着，等配色再打开时接着用
- **Icons**：Claude Desktop 始终画矢量图标
- **Spinner wave**：波纹用的是背景的字符，所以要先选了背景才有

### Panel

| 设置 | 取值 | 默认 |
| --- | --- | --- |
| Model & effort（模型和 effort） | on、off | off |
| Context | on、off | on |
| · legend（图例） | on、off | off |
| · compact forecast（压缩预测） | on、off | on |
| Cache | on、off | off |
| · countdown（倒计时） | on、off | on |
| · TTL（缓存时长） | auto、5m、1h | auto |
| · read / write（读写 token） | on、off | off |
| Tokens | on、off | on |
| Cost | on、off | on |
| Spend | on、off | on |
| · 7-day bars（7 天柱状图） | on、off | off |
| Limits | on、off | on |
| Activity | on、off | on |
| · tok/s sparkline（火花线） | on、off | off |
| · recent calls（最近调用） | 5、3、off | 3 |
| Git | on、off | on |
| · changed files（改动文件） | 5、3、off | 3 |
| Todo | on、off | off |
| Versions（版本号） | on、off | off |

- **compact forecast**：还剩几轮的那一行，连同 **compact now** 按钮
- **TTL**：提示缓存能保留多久。`auto` 按 Claude Code 自己的规则判断：Claude 订阅账号是 1 小时，环境变量里设了 API key 或 token 时是 5 分钟，设了 `CLAUDE_CODE_PROMPT_CACHE_TTL` 或 `promptCacheTtl` 设置项时以它为准

### Alerts

| 设置 | 取值 | 终端 | Claude Desktop |
| --- | --- | --- | --- |
| Activity band（横幅） | on、off | on | on |
| Completion sound（完成提示音） | on、off | on | off |
| Long-turn notification（长任务通知） | on、off | on | off |
| · after（通知门槛） | 30s、60s、120s、300s | 60s | 60s |

- **完成提示音**：macOS 用 `afplay` 播放；Windows 和 Linux 终端没有播放器，不会出声

## 可选：同风格 statusline

`extras/statusline/statusline-command.sh` 是一个同样胶囊风格的状态栏，显示模型和 effort、目录、Git 分支、上下文百分比、花费和 vim 模式。依赖 `bash` 4 以上和 `jq`，`git` 可选，支持 `NO_COLOR`。

把它复制到 `~/.claude/statusline-command.sh`，再在 `~/.claude/settings.json` 里加上：

```json
"statusLine": {
  "type": "command",
  "command": "bash \"$HOME/.claude/statusline-command.sh\""
}
```

它会跟着配色走。插件把当前配色的颜色写成一行文本，放在 Claude 配置目录（`~/.claude`，或 `CLAUDE_CONFIG_DIR`）下的 `nightpub-ui/palette` 里，会话启动和换配色时更新。脚本读这一行，确认里面只有它要的那几个颜色才采用；否则用 Catppuccin Mocha，配色是 `off` 或者没装插件时也是这样。用 NightPub 配色时胶囊的色数更少：模型用强调色，目录和花费是素色胶囊。

## 从 capsule-panel 升级

`nightpub-ui` 0.5.0 就是 `capsule-panel` 0.4.1 加上外观，换了个名字。Claude Code 按插件名保存设置和记录，所以：

- 先卸载 `capsule-panel`，再按上面的办法安装 `nightpub-ui`。两个都装会出现两块面板
- 设置从新的默认值开始，显示的内容比 0.4.1 少。0.4.1 显示过的东西都还在，在 Panel 页打开对应开关即可
- 花费记录重新累计。想保留的话，在没有会话运行的时候，把旧插件存储文件里的 `spend/…` 条目抄到新插件的存储文件里：文件在 `~/.claude/plugins/store/`，每个插件一个 JSON 文件，以插件名开头
- 用了 statusline 的话，用新脚本覆盖旧的

## 开发

```
claude --plugin-dir /path/to/claude-code-nightpub-ui
claude plugin validate .
claude plugin test .
npx -y -p typescript@5 tsc -p .
node scripts/preview.mjs /path/to/an/empty/folder
```

`tsconfig.json` 继承自 `.claude-plugin/types/tsconfig.json`，这个文件要等 Claude Code 第一次加载插件时才会生成，所以做类型检查之前先把插件跑一次。生成的类型声明是那个版本自己的，请用 2.1.325 或更新的版本做类型检查。

`scripts/preview.mjs` 生成一个预览页，按 Claude Desktop 的画法显示每个背景在每套配色下的样子，每个背景还有一个事件来得很快的版本，不用干等。`scripts/build-terminal-themes.mjs` 根据 `hooks/palettes.ts` 生成 `themes/`，`scripts/bake-mark.mjs` 把 NightPub 标记烘焙成背景用的字符格。

## 许可证

[MIT](LICENSE)
