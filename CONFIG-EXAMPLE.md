# 项目配置说明

## 环境变量配置

### 生产环境需要配置的环境变量

在腾讯云托管/云函数中配置：

```bash
SPRING_PROFILES_ACTIVE=prod
DB_URL=jdbc:mysql://你的云数据库地址:3306/treehouse?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai&useSSL=false&allowPublicKeyRetrieval=true
DB_USERNAME=你的数据库用户名
DB_PASSWORD=你的数据库密码
JWT_SECRET=生产环境的JWT密钥
WECHAT_TEMPLATE_ID_LETTER=微信订阅消息模板ID
TREEHOUSE_AI_API_KEY=你的AI API密钥
WECHATPAY_MOCK=false
WECHATPAY_MCHID=你的微信支付商户号
WECHATPAY_API_V3_KEY=你的微信支付API V3密钥
WECHATPAY_CERT_SERIAL=你的微信支付证书序列号
WECHATPAY_PRIVATE_KEY_PATH=你的微信支付私钥路径
WECHATPAY_NOTIFY_URL=你的微信支付回调地址
```

### 本地开发环境

- 默认使用 `application-dev.yml`
- 修改本地数据库密码即可

## 切换环境

### 本地开发

```bash
# 方式1：修改 application.yml
spring:
  profiles:
    active: dev

# 方式2：启动时指定
java -jar app.jar --spring.profiles.active=dev
```

### 生产环境

```bash
# 方式1：在云托管控制台配置环境变量
SPRING_PROFILES_ACTIVE=prod

# 方式2：Docker 启动时指定
docker run -e SPRING_PROFILES_ACTIVE=prod -e DB_URL=... app.jar
```
