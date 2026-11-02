# 腾讯云 CloudBase 静态网站托管说明

## 本次部署失败原因

流水线日志里只有「部署命令」，**没有执行构建**，却直接跑：

```bash
tcb hosting deploy ./dist /school-based-course -e ocr-d9g7saru92fdcecb4
```

仓库里没有现成的 `dist/`（需要先 `npm run build` 从 `prototype` 生成），所以报错：

```text
Path does not exist: .../dist
```

## 你需要改控制台这一处（必做）

打开 CloudBase / CNB 里该应用的**自定义部署命令**，把原来的：

```bash
tcb hosting deploy ./dist /school-based-course -e ocr-d9g7saru92fdcecb4
```

**整行替换为下面任意一种：**

### 方案 A（推荐，一条命令搞定）

```bash
npm run build && tcb hosting deploy ./dist /school-based-course -e ocr-d9g7saru92fdcecb4
```

### 方案 B（更简单，不建 dist）

```bash
tcb hosting deploy ./prototype /school-based-course -e ocr-d9g7saru92fdcecb4
```

### 方案 C（用仓库脚本）

```bash
bash scripts/cnb-deploy.sh
```

> 只改「构建命令」填 `npm run build`、部署命令仍只 deploy `./dist`——若流水线**根本没有构建步骤**（你上次日志就是这样），改构建命令无效，必须改**部署命令本身**。

## 课件路径（部署成功后）

站点挂在 `/school-based-course` 时：

```text
https://<域名>/school-based-course/
https://<域名>/school-based-course/assets/courseware/yi-ci-hanshu-ke1.pdf
https://<域名>/school-based-course/assets/courseware/yi-ci-zhengbili.pdf
```

## 本地自测

```bash
npm run build
# 确认 dist/index.html 与 dist/assets/courseware/*.pdf 存在
```
