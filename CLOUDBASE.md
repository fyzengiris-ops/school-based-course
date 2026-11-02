# 腾讯云 CloudBase 静态网站托管说明

本仓库通过 GitHub 拉取后，用 CloudBase「静态网站托管」发布时，请按下面配置，保证课件 PDF/PPT 链接可访问。

## 1. 部署目录（关键）

请将静态托管的**根目录 / 构建产出目录**设为：

```text
prototype
```

这样线上打开的是 `prototype/index.html`，页面内相对路径会正确解析到：

```text
/assets/courseware/yi-ci-hanshu-ke1.pdf
/assets/courseware/yi-ci-hanshu-ke1.ppt
/assets/courseware/yi-ci-zhengbili.pdf
/assets/courseware/yi-ci-zhengbili.pptx
```

若误把仓库根目录当网站根，请改为 `prototype`，或访问时带 `/prototype/` 前缀。

## 2. 课件文件位置（已入库）

| 用途 | 仓库路径 |
|------|----------|
| 教务审核 / 资源库预览 | `prototype/assets/courseware/yi-ci-hanshu-ke1.pdf`（预览）及 `.ppt`（下载） |
| 学生端第一份课件「去学习」 | `prototype/assets/courseware/yi-ci-zhengbili.pdf`（预览）及 `.pptx`（原件） |

代码里使用相对路径 `./assets/courseware/...`，不依赖本机绝对路径，适合 CloudBase / CDN。

## 3. 建议检查

部署完成后在浏览器直接打开：

- `https://你的域名/assets/courseware/yi-ci-hanshu-ke1.pdf`
- `https://你的域名/assets/courseware/yi-ci-zhengbili.pdf`

能打开即说明静态资源已挂上；再在产品里点「预览 / 去学习」验证 iframe 与下载。

## 4. MIME 说明

- `.pdf`：浏览器内嵌预览（教务预览、学生看课件）
- `.ppt` / `.pptx`：一般会触发下载或用本地 Office 打开（下载链路仍可用）
