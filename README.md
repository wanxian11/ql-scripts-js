# ql-scripts-js

青龙 / 呆呆 / Arcadia 可用的 **JS 脚本集**（当前 10 个脚本）。收录 `smallfawn/QLScriptPublic` 最近更新的脚本，并把其中最近一次改动的 Python 脚本移植为 JS。

## 收录清单

| 文件 | 上游更新时间 | 上游提交 | 类型 |
|---|---|---|---|
| `wxapp/aima.js` | 2026-10-15 | 爱玛会员俱乐部：签到活动ID改为查询 | 上游 JS，原样收录 |
| `wxapp/mfd.js` | 2026-10-14 | 麦富迪会员：请求头增加 X-Token 参数 | 上游 JS，原样收录 |
| `wxapp/jyk.js` | 2026-10-16 | 旧衣客：增加可用积分打印 | 上游 JS，原样收录 |
| `daily/yht.js` | 2026-10-14 | 益禾堂：修改签到 token 取值和签到活动 ID | 上游 JS，原样收录 |
| `wxapp/bjhqbwz.js` | 2026-08-17 | bjhqbwz 会话失效走 HTTP 401 时进不去重登分支 | **由 `bjhqbwz.py` 移植为 JS** |
| `wxapp/guyu.js` | 2026-09-21 | 谷雨：增加缓存机制、修复签到报错 | 上游 JS，原样收录 |
| `wxapp/youzan.js` | 2026-09-18 | 有赞：修复 CK 有效判断、补 Extra-Data 头 | 上游 JS，原样收录 |
| `wxapp/qqhyjlb.js` | 2026-09-05 | 洽洽：改微信登录、修复签到、校验缓存 | 上游 JS，原样收录 |
| `wxapp/trsj.js` | 2026-09-05 | 甜润世界：CK 失效重登、石斛阅读任务 | 上游 JS，原样收录 |
| `wxapp/pddgy-gzh.js` | 2026-09-02 | 拼多多果园公众号版参数区分 | 上游 JS，原样收录（原文件名 `pddgy-公众号版.js`） |

`lib/env.js`、`lib/sendNotify.js`、`lib/wcs.js` 是上述脚本的公共依赖，放在白名单之外，不会被青龙当成任务创建。

## 拉库

```bash
ql repo "https://github.com/wanxian11/ql-scripts-js.git" "^(wxapp|daily)/" "" "^lib/" "main" "js"
```

或在青龙「订阅管理」中填：

- 链接：`https://github.com/wanxian11/ql-scripts-js.git`
- 分支：`main`
- 白名单：`^(wxapp|daily)/`
- 依赖文件：`^lib/`（公共库只复制，不建任务）
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
| `guyu` | guyu.js | wx_server 中的 openid，多账号 `&` |
| `youzan` | youzan.js | `openid#appid#kdtId#checkinId[#备注]`，每行一个 |
| `qqhyjlb` | qqhyjlb.js | openid / 账号标识，多账号 `&` 或换行 |
| `trsj` | trsj.js | openid / 账号标识，多账号 `&` 或换行 |
| `pddgy` | pddgy-gzh.js | openid / 账号标识，多账号 `&` 或换行 |

## 依赖

- Node.js >= 18（内置 `fetch`、`AbortSignal.timeout`；青龙 2.24 为 Node 24）
- `aima.js`、`mfd.js`、`jyk.js`、`yht.js` 依赖 `axios`：

```bash
npm install -g axios
```

青龙「依赖管理」里装 Node 依赖 `axios`；或直接装到脚本根目录：

```bash
cd /ql/data/scripts && npm install axios
```

`lib/wcs.js` 和四个上游脚本都依赖 `axios`，缺了会报 `Cannot find module 'axios'`。

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
└── lib/
    ├── env.js
    ├── sendNotify.js
    └── wcs.js
```

## bjhqbwz.js 移植说明

- 原脚本：`wxapp/bjhqbwz.py`（2026-08-17）
- 签名保持一致：`SHA-256` digest + `HMAC-SHA1` 的 `Authorization` 头
- 接口、会话失效重登、奖池门槛、实名拦截、token 缓存逻辑逐段对照移植
- 缓存文件：`wxapp/bjhqbwz_token_cache.json`（首次运行生成）
- 失败退出码：全部账号失败时 `exit 1`，方便青龙判定任务状态

## 来源

脚本来自 [`smallfawn/QLScriptPublic`](https://github.com/smallfawn/QLScriptPublic)，版权归原作者所有。本仓库只做 JS 整理与移植，不保证接口长期可用，使用前先用小号跑一次日志。
