# ql-scripts-js

青龙 / 呆呆 / Arcadia 可用的 **JS 脚本集**。收录 `smallfawn/QLScriptPublic` 最近更新的脚本，并把其中最近一次改动的 Python 脚本移植为 JS。

## 收录清单

| 文件 | 上游更新时间 | 上游提交 | 类型 |
|---|---|---|---|
| `wxapp/aima.js` | 2026-10-15 | 爱玛会员俱乐部：签到活动ID改为查询 | 上游 JS，原样收录 |
| `wxapp/mfd.js` | 2026-10-14 | 麦富迪会员：请求头增加 X-Token 参数 | 上游 JS，原样收录 |
| `wxapp/jyk.js` | 2026-10-16 | 旧衣客：增加可用积分打印 | 上游 JS，原样收录 |
| `daily/yht.js` | 2026-10-14 | 益禾堂：修改签到 token 取值和签到活动 ID | 上游 JS，原样收录 |
| `wxapp/bjhqbwz.js` | 2026-08-17 | bjhqbwz 会话失效走 HTTP 401 时进不去重登分支 | **由 `bjhqbwz.py` 移植为 JS** |

`tools/env.js`、`tools/sendNotify.js`、`wxapp/wcs.js` 是上述脚本的公共依赖。

## 拉库

```bash
ql repo "https://github.com/wanxian11/ql-scripts-js.git" "^(wxapp|daily|tools)/" "" "" "main" "js"
```

或在青龙「订阅管理」中填：

- 链接：`https://github.com/wanxian11/ql-scripts-js.git`
- 分支：`main`
- 白名单：`^(wxapp|daily|tools)/`
- 文件后缀：`js`
- 定时规则：`0 4 * * *`

## 环境变量

| 变量 | 适用脚本 | 说明 |
|---|---|---|
| `aima` | aima.js | 账号标识 / openid，多账号 `&` 或换行 |
| `mfd` | mfd.js | 账号标识 / openid |
| `jyk` | jyk.js | 账号标识 / openid |
| `yht` | yht.js | 益禾堂账号 token / openid |
| `bjhqbwz` | bjhqbwz.js | wx_server 中的 openid，多账号 `&` 或换行，可 `#备注` |
| `wx_server_url` | 全部 wxapp | wx_server 地址，例如 `http://127.0.0.1:8788` |
| `wx_auth` | 全部 wxapp | wx_server 鉴权值 |
| `bjhqbwz_pool` | bjhqbwz.js | 可选，`ticket1` / `ticket2` / `hotel` / `none`，默认 `ticket2` |

## 依赖

- Node.js >= 18（内置 `fetch`、`AbortSignal.timeout`；青龙 2.24 为 Node 24）
- `aima.js`、`mfd.js`、`jyk.js`、`yht.js` 依赖 `axios`：

```bash
npm install -g axios
```

青龙「依赖管理」里装 Node 依赖 `axios` 即可。

## 目录结构

```text
ql-scripts-js/
├── wxapp/
│   ├── aima.js
│   ├── mfd.js
│   ├── jyk.js
│   ├── bjhqbwz.js
│   └── wcs.js
├── daily/
│   └── yht.js
└── tools/
    ├── env.js
    └── sendNotify.js
```

## bjhqbwz.js 移植说明

- 原脚本：`wxapp/bjhqbwz.py`（2026-08-17）
- 签名保持一致：`SHA-256` digest + `HMAC-SHA1` 的 `Authorization` 头
- 接口、会话失效重登、奖池门槛、实名拦截、token 缓存逻辑逐段对照移植
- 缓存文件：`wxapp/bjhqbwz_token_cache.json`（首次运行生成）
- 失败退出码：全部账号失败时 `exit 1`，方便青龙判定任务状态

## 来源

脚本来自 [`smallfawn/QLScriptPublic`](https://github.com/smallfawn/QLScriptPublic)，版权归原作者所有。本仓库只做 JS 整理与移植，不保证接口长期可用，使用前先用小号跑一次日志。
