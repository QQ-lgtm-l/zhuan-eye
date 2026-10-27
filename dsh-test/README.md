# 测试工具说明

本目录保存本次测试的脚本、原始记录与报告。

| 文件 | 说明 |
|---|---|
| `测试报告.md` | 测试计划、用例、缺陷、风险与结论 |
| `api-test-report.txt` | 接口测试原始输出（32 条） |
| `ui-test-report.txt` | UI 端到端测试原始输出（9 条） |
| `api-tests.ps1` | 接口测试脚本（PowerShell 5.1 + curl.exe） |
| `ui-tests.js` | UI 端到端测试脚本（Node + Edge Headless + CDP） |

## 运行前提

1. 后端运行在 `http://localhost:9999`，MySQL `yoloai` 已导入数据；
2. 前端运行在 `http://localhost:8888`；
3. 基线数据中存在管理员 `fanshihao`（邮箱 `3456642104@qq.com`、手机 `15893646659`），脚本用它做重复校验；
4. 邮箱验证码为演示模式（未配置 SMTP）时，脚本才能拿到回显验证码。

## 接口测试

```powershell
powershell -ExecutionPolicy Bypass -File api-tests.ps1
```

- 会自动创建 `qa<时间戳>` 测试账号，结束后通过接口删除；
- 报告写入同目录 `api-test-report.txt`，全部通过时退出码 0。

## UI 测试

先启动带调试端口的 Edge：

```powershell
& 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' `
  --headless=new --remote-debugging-port=9222 `
  --user-data-dir="$env:TEMP\edge-ui-test" `
  --no-first-run --disable-gpu about:blank
```

再执行（NODE_PATH 指向前端依赖）：

```powershell
$env:NODE_PATH='D:\workspace\factory\java前后端\java前后端\safety_vue\node_modules'
node ui-tests.js
```

- 会自动注册 `uiqa<时间戳>` 账号，登录后删除；
- 截图写到 `..\dsh-shots\`（60~63 开头）；
- 验证码 60 秒冷却会自动等待后重试。

## 注意

- 脚本会真实写入测试账号，请勿在生产库执行；
- 重复邮箱用例使用基线账号的邮箱/手机号，不会修改其数据；
- 历史重复数据（见测试报告 OBS-01）不在自动清理范围内。
