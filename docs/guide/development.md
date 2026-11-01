# 安装、测试、构建与部署

## 环境与安装

- 支持 Vite 6 的 Node.js 与 npm；本次验证使用 **Node.js 22.14.0**。
- 支持 WebGL2 的现代浏览器。冒险、城镇、战斗和模型预览都使用真实 3D 渲染。
- 游戏不需要账号、后端、环境变量或密钥。Three.js 是运行时依赖，Vite/TypeScript/Vitest 是开发依赖。

```bash
npm ci
npm run dev
```

`npm ci` 按 `package-lock.json` 安装依赖。开发服务器默认绑定 `127.0.0.1`，Vite 默认端口为 5173，基础路径为 `/vcmik3/`；若端口被占用，以终端输出为准。

## 中文文档生成与校验

```bash
npm run docs:generate
npm run docs:check
```

生成器 `scripts/generate-content-docs.mjs` 通过 Vite SSR 加载真实 TypeScript 注册表，创建默认地图及全部中立模型，再输出 `docs/README.md` 和 `docs/generated/*.md`。

它会断言：13 阵营、57 建筑及模型、72 兵种、20 宝物、19 法术、10 资源、10 地标类型、20 中立模型，以及固定遭遇数量和 ID 集合。`docs:check` 不写文件，而是重新生成并逐字比较提交结果，同时检查每个注册 ID 的覆盖块和会话摘要。新增/删除注册内容或手工改动生成文件后，校验会失败；应更新生成器中的预期数量或中文映射，再重新生成。

## 自动化验证

```bash
npm test
npm run test:modules
npm run build
npm run test:e2e
```

- `npm test`：使用 `tests/vitest.config.ts`，运行 `src/**/*.test.ts` 与 `tests/**/*.test.ts`。
- `npm run test:modules`：依次运行默认游戏测试及 adventure、battle、ui 模块配置。
- `npm run build`：先运行 `tsc --noEmit`，再以 Vite 生成生产包到 `dist/`。
- `npm run test:e2e`：重新构建，并运行 `tests/browser-smoke.mjs`。覆盖生产入口、13 城及建筑交互、72 兵种阵容、20 中立模型、全部地标效果、桌面/移动 WebGL、存读档与战斗交接。

端到端测试默认寻找 macOS Chrome：

```text
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
```

其他平台或自定义安装位置用 `CHROME_BIN=/path/to/chrome npm run test:e2e`。软件渲染环境可用 `H3_CHROME_ANGLE` 调整 ANGLE 后端。测试会创建临时浏览器配置并在结束时删除。

## 生产部署

```bash
npm ci
npm run build
```

将 **`dist/` 内的全部文件**部署到静态站点的 `/vcmik3/` 路径。`vite.config.ts` 设置了 `base: '/vcmik3/'`，因此 HTML 中的脚本与样式引用已经带此前缀。不要只上传源码或 `index.html`，也不要遗漏生成的资源分块。

若部署到其他前缀，需要相应修改 Vite `base` 并重新构建/测试。站点应把未知应用路由回退到 `index.html`；静态资源按自身内容类型返回。游戏进度和自定义内容只保存在访问者浏览器的本地存储中，服务器无需数据库，也不会跨域名/端口同步存档。

## 交付前清理

- `dist/`、依赖目录和测试输出不是文档提交内容。
- 浏览器测试临时目录通常自动删除；若异常中断，应检查 `.browser-smoke-*`。
- 文档生成不创建临时副本；`docs:check` 必须在生成后无差异地通过。
- 最后用 `git status --short` 确认没有日志、截图、运行时或其他临时产物混入提交。
