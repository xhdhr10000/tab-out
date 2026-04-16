# Tab Out Chrome Extension — 安全审计报告

## 📋 概览

| 项目 | 详情 |
|------|------|
| 扩展名称 | Tab Out |
| 版本 | 1.0.0 |
| Manifest | V3 |
| 权限 | `tabs`, `activeTab`, `storage` |
| 外部依赖 | Google Fonts CDN, Google Favicon Service |
| 数据存储 | `chrome.storage.local`（100% 本地） |
| 后端服务 | **无** |

---

## ✅ 安全亮点（做得好的部分）

### 1. 最小权限原则
扩展只请求了三个权限，且都与其核心功能直接相关：
- `tabs` — 读取/关闭标签页（核心功能）
- `activeTab` — 激活标签页（聚焦跳转）
- `storage` — 保存"稍后阅读"列表

**没有请求**高危权限如 `cookies`、`history`、`downloads`、`webRequest`、`<all_urls>` 等。

### 2. 零后端通信
代码中没有任何 `fetch()`、`XMLHttpRequest`、`WebSocket` 调用。所有数据完全留在本地。

### 3. 安全的存储方式
使用 `chrome.storage.local`，数据不会同步到云端，不会泄露到外部。

### 4. 无动态代码执行
没有 `eval()`、`new Function()`、`setTimeout("string")` 等动态代码执行。

### 5. Service Worker 干净
`background.js` 仅负责更新工具栏徽章数字，不执行任何敏感操作。

---

## ⚠️ 安全风险与建议

### 风险 1：DOM XSS — `innerHTML` 注入（中高风险）

**位置**: `extension/app.js` 多处

**问题描述**: 代码大量使用 `innerHTML` 拼接 HTML，虽然对 `"` 做了转义（`replace(/"/g, '&quot;')`），但**未对 `<` 和 `>` 做转义**。

```javascript
// app.js 中的转义 — 只处理了引号
const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
const safeTitle = label.replace(/"/g, '&quot;');
```

**攻击场景**: 如果用户打开了一个恶意页面，其标题包含 HTML/JS：
```
<title><img src=x onerror=alert(document.cookie)>Free Stuff</title>
```
当这个标签页显示在 Tab Out 中时，`innerHTML` 会将其解析为 HTML 并执行 `onerror` 脚本。

**建议修复**:
```javascript
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const safeUrl   = escapeHTML(tab.url || '');
const safeTitle = escapeHTML(label);
```

---

### 风险 2：Google Favicon 服务的外部请求（低风险）

**位置**: `extension/app.js` 多处

```javascript
const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
```

**问题描述**: 每次渲染都会向 Google 发起请求获取网站图标。虽然这是一个标准做法，但意味着：
- Google 可以知道你正在访问哪些域名（通过 favicon 请求）
- 如果 Google 服务被中间人攻击，可能返回恶意内容

**风险等级**: 低 — 这是 Chrome 扩展的常见做法，且请求不携带用户身份信息。

**建议**: 如需更高隐私，可考虑使用 `chrome://favicons/` 或本地缓存。

---

### 风险 3：外部字体加载（低风险）

**位置**: `extension/index.html`

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">
```

**问题描述**: 从 Google Fonts CDN 加载字体意味着：
- 每次打开新标签页都会向 Google 发起请求
- Google 可以记录 IP 地址和访问时间

**建议**: 如需完全离线运行，可将字体文件下载到本地并在 CSS 中使用 `@font-face` 引用。

---

### 风险 4：`config.local.js` 动态加载（低风险）

**位置**: `extension/index.html`

```html
<script src="config.local.js" onerror="/* no personal config, that's fine */"></script>
```

```javascript
// app.js 中使用
...(typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []),
const customGroups = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : [];
```

**问题描述**: 加载外部 JS 文件存在供应链风险。如果攻击者能在用户的文件系统中放置恶意的 `config.local.js`，可以执行任意代码。

**现状**: 该文件在 `.gitignore` 中，仅由用户本地管理，风险较低。

**建议**: 如果不需要自定义配置功能，可以移除此功能。或者将配置改为 JSON 格式并通过 `fetch` 加载后用 `JSON.parse()` 解析（避免执行任意代码）。

---

### 风险 5：`chrome.tabs.remove` 批量操作（中风险）

**位置**: `extension/app.js` — `closeTabsByUrls()`, `closeDuplicateTabs()`, `closeAllOpenTabs()`

**问题描述**: 扩展可以批量关闭用户的标签页，且操作不可逆。虽然这是核心功能，但需注意：
- 用户可能误点 "Close all" 导致所有标签页丢失
- 没有确认对话框

**建议**: 对于 "Close all N tabs" 操作，添加二次确认。

---

### 风险 6：`target="_blank"` 链接（低风险）

**位置**: `extension/app.js` — `renderDeferredItem()`, `renderArchiveItem()`

```html
<a href="${item.url}" target="_blank" rel="noopener" class="deferred-title">
```

**现状**: 已正确添加 `rel="noopener"`，这是一个好的安全实践。✅

---

## 📊 风险总结

| 风险项 | 等级 | 状态 | 建议优先级 |
|--------|------|------|-----------|
| DOM XSS (innerHTML 注入) | ⚠️ 中高 | 需修复 | 🔴 **立即修复** |
| Google Favicon 外部请求 | 低 | 可接受 | 🟡 可选优化 |
| Google Fonts 外部加载 | 低 | 可接受 | 🟡 可选优化 |
| config.local.js 动态加载 | 低 | 可接受 | 🟢 低优先级 |
| 批量关闭无确认 | 中 | 需关注 | 🟡 建议改进 |
| target="_blank" 安全 | 低 | ✅ 已处理 | — |

---

## 🔒 总体评价

**Tab Out 是一个设计良好的安全扩展。** 核心安全原则（最小权限、本地存储、零后端）执行得很到位。最需要关注的是 **DOM XSS 问题** — 这是唯一可能导致代码执行的漏洞。

**建议的下一步行动**:
1. 立即修复 `innerHTML` 注入问题，将 `replace(/"/g, '&quot;')` 改为完整的 HTML 转义函数
2. 考虑为 "Close all" 操作添加确认提示
3. 如需更高隐私标准，将字体和 favicon 资源本地化