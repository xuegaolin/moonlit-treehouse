# 重启 dev 实例（8081）操作卡

> 今晚（8/3）所有成果都在编译产物里，但 8081 跑的是 **8/1 23:53** 的旧代码。
> 重启后用户才能看到。此操作会中断 8081 服务，**需用户点头**。

## 一键执行

```
cd D:/clawd_workspace/projects/moonlit-treehouse
node tools/restart-dev.js
```

脚本已内置全部要点，不需要手敲。

## 脚本做了什么（为什么每一步都必要）

| 步骤 | 原因 |
|------|------|
| `taskkill /T /F` 杀进程树 | `shell:true` 下 `child.kill()` 只杀壳不杀孙进程（8/2 教训） |
| 杀完主动探端口 | 「杀了」不等于「端口释放了」，必须实测（8/2 教训） |
| 注入 `TREEHOUSE_AI_API_KEY` | 不注入则 AI 静默回落静态模板，用户看到的还是假 AI |
| 注入专用 truststore | JDK 8 (1.8.0_302) cacerts 缺火山引擎根证书，否则 AI 调用 PKIX 失败（8/1 教训） |
| `NODE_NO_WARNINGS=1` | DEP0190 警告写 stderr 会被 PowerShell 当错误污染 exit code |
| 启动后轮询健康检查 | 「启动了」不等于「能服务了」，Spring Boot 要几十秒 |

## 重启后必须复核三件

```
node tools/verify-after-restart.js
```

1. `/checkin/status` 返回 **200**（现在是 404 —— 这是旧代码的铁证）
2. 摆烂理由是 **LLM 文案**，不是 REASON_POOL 静态模板
3. 原有 **19 个接口回归全绿**

三件全过才算重启成功。任一失败要看日志定位，不要嘴报「应该好了」。

## 回滚

旧 jar 在 `backend/target/` 下有备份时间戳。
真出问题：杀掉新进程，用旧 jar 启回去，再排查。
