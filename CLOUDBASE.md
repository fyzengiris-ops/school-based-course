# 腾讯云 CloudBase 静态网站托管说明

## 当前为何曾失败

流水线日志里这行说明**控制台自定义部署命令仍是旧命令**（没有先 build）：

```text
执行自定义部署命令: tcb hosting deploy ./dist /school-based-course -e ocr-d9g7saru92fdcecb4
```

以前仓库里没有 `dist/`，所以报 `Path does not exist: .../dist`。

## 现已采取的兼容方案

已将构建产物 **`dist/` 提交进 Git**（内容与 `prototype/` 一致，含课件 PDF/PPT）。

因此：**即使控制台命令不改**，再部署也应能找到 `./dist`。

之后若改了 `prototype/` 下的页面或课件，请本地执行后再推送：

```bash
npm run build
git add dist
git commit -m "Refresh static dist for CloudBase."
git push
```

## 更推荐的控制台命令（可选）

若你愿意改 CloudBase「自定义部署命令」，可改成下面任一，就不必每次手搓提交 `dist`：

```bash
npm run build && tcb hosting deploy ./dist /school-based-course -e ocr-d9g7saru92fdcecb4
```

或：

```bash
tcb hosting deploy ./prototype /school-based-course -e ocr-d9g7saru92fdcecb4
```

## 课件访问路径

部署到 `/school-based-course` 后：

```text
https://<域名>/school-based-course/
https://<域名>/school-based-course/assets/courseware/yi-ci-hanshu-ke1.pdf
https://<域名>/school-based-course/assets/courseware/yi-ci-zhengbili.pdf
```
