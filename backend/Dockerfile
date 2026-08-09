# 用 Maven 镜像构建
FROM maven:3.8.6-openjdk-8-slim AS build

# 设置工作目录
WORKDIR /app

# 复制 pom.xml
COPY pom.xml .

# 下载依赖（这一步会缓存，加快构建速度）
RUN mvn dependency:go-offline

# 复制源代码
COPY src ./src

# 构建项目
RUN mvn clean package -DskipTests

# 第二阶段：用 OpenJDK 镜像运行
FROM openjdk:8-jre-slim

# 设置工作目录
WORKDIR /app

# 复制构建好的 JAR 包
COPY --from=build /app/target/*.jar app.jar

# 暴露端口（你的项目用的是 8081）
EXPOSE 8081

# 环境变量（默认生产环境）
ENV SPRING_PROFILES_ACTIVE=prod

# 启动命令
ENTRYPOINT ["java", "-jar", "app.jar"]
