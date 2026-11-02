# 腾讯云 CloudBase 静态网站托管说明

本仓库是**纯静态原型**（无 webpack/vite 打包）。CloudBase 流水线若执行：

```bash
tcb hosting deploy ./dist /school-based-course -e <envId>
```

必须先生成 `dist`，否则会报：`Path does not exist: .../dist`。

## 1. 流水线建议配置

| 项 | 建议值 |
|----|--------|
| 构建命令 | `npm run build` |
| 部署命令 | `tcb hosting deploy ./dist /school-based-course -e <你的环境ID>`（可保持现有） |

`npm run build` 会把 `prototype/` 完整复制到 `dist/`（含 `assets/courseware` 下的 PDF/PPT）。

本地也可自测：

```bash
npm run build
# 确认 dist/index.html、dist/assets/courseware/*.pdf 存在后再 deploy
```

## 2. 课件访问路径

部署到云端路径 `/school-based-course` 后，页面与课件约为：

```text
https://<域名>/school-based-course/
https://<域名>/school-based-course/assets/courseware/yi-ci-hanshu-ke1.pdf
https://<域名>/school-based-course/assets/courseware/yi-ci-zhengbili.pdf
```

代码使用相对路径 `./assets/courseware/...`，只要打开的是 `dist` 里的 `index.html`（即上述站点根），预览/下载即可用。

## 3. 仓库内课件文件

| 用途 | 路径（构建后在 dist 下同相对路径） |
|------|----------|
| 教务审核 / 资源库预览 | `assets/courseware/yi-ci-hanshu-ke1.pdf` / `.ppt` |
| 学生端第一份课件 | `assets/courseware/yi-ci-zhengbili.pdf` / `.pptx` |

## 4. MIME 说明

- `.pdf`：浏览器内嵌预览
- `.ppt` / `.pptx`：多为下载或本地 Office 打开
