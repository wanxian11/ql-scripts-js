# YYB_GO 合集

这组脚本面向 **YYB-Go** 服务，直接调用 `http://<地址>/wxapp/getCode` 取 `wx.login code`，不依赖 `lib/wcs.js`，也不使用 `wx_server_url` / `wx_auth`。

- 63 个 JavaScript（`yyb-go/*.js`）
- 13 个 Python（`yyb-go/py/*.py`）
- 来源：夸克网盘「青龙脚本分享」中的 `YYB-GO青龙脚本` 目录，原上游 `XYtaixu/YYB_GO` 已删除
- 已去掉原文件头部注入的「YYB_GO 统一通知注入」代码块，其余逻辑未改

## 环境变量

| 变量 | 格式 | 示例 |
|---|---|---|
| `YYB_GO` | `地址@openid`，一行一个 | `172.17.0.4:8000@oX7abc...` |

- 不要带 `http://` 前缀
- 不要写容器名，写 IP 或可解析的主机名
- 每个脚本还需要自己的账号变量（见各文件头部），一般与文件名同名

## 依赖

```bash
cd /ql/data/scripts && npm install axios jsrsasign socks-proxy-agent https-proxy-agent http-proxy-agent
```

## 启用方式

默认订阅白名单是 `^(wxapp|daily)/`，不会拉取本目录。要单独拉：

```bash
ql repo "https://github.com/wanxian11/ql-scripts-js.git" "^yyb-go/" "" "" "main" "js py"
```

或在「订阅管理」里把白名单改成 `^yyb-go/`，并关闭「自动添加任务」，这样脚本只进脚本管理，不会一次生成 76 个任务。需要哪个就在定时任务里手动建：

```bash
task <订阅目录>/yyb-go/唯品会.js
```

## 注意

- 这些脚本默认串行取码，多个任务同一分钟启动会排队，建议错开 30–60 秒
- 原文件里的 `cron:` 头保留，手动建任务时可参考
- Python 脚本依赖 `requests`，个别可能用到 `pycryptodome`，按报错补装
