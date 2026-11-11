# Lei Wang · 个人网站

网站采用线框名片设计，提供英文与简体中文的首页、关于、项目和探索页面。当前首页为 D 版，沿用 A 版的入场动画。

在这个目录运行本地预览。

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

在浏览器打开 `http://127.0.0.1:8765/`。英文内容在根目录，中文内容在 `zh/`。更新文案时同步对应语言页面。共享样式在 `assets/site.css`，标题文案在两个首页的 `data-titles` 属性中。

站点由 GitHub Pages 从 `main` 分支的 **/ (root)** 发布。

四个版本可在[版本页](https://leonleiwang.github.io/versions/)打开。每份 HTML 都可以单独下载并用浏览器打开。

