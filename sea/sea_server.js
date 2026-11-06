/* 三角洲靶场 单文件启动器（Node SEA）
   内嵌全部前端资源 -> 本地 HTTP 服务 -> 以 Edge/Chrome --app 窗口打开 */
"use strict";
const http = require("node:http");
const { getAsset } = require("node:sea");
const { spawn } = require("node:child_process");
const os = require("node:os");

// 收集嵌入资源：sea-config 中 assets 形如 "app/index.html"
const ASSETS = {};
try {
  // node:sea 只提供 getAsset；遍历用 getAssetNames?（v22+：sea.getAssetNames 不存在）
  // 因此 sea-config 中以 JSON 清单资源 "assetlist.json" 提供文件名列表
  const list = JSON.parse(getAsset("assetlist.json", "utf8"));
  for (const name of list) {
    ASSETS[name] = Buffer.from(getAsset(name));
  }
} catch (e) {
  console.error("asset load fail", e);
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".json": "application/json", ".ico": "image/x-icon", ".wasm": "application/wasm",
};

const server = http.createServer((req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/" || p === "") p = "/index.html";
    const key = "app" + p.replace(/\\/g, "/");
    if (!ASSETS[key]) {
      // 目录式回退 /index.html
      const alt = "app/index.html";
      if (ASSETS[alt]) {
        res.writeHead(200, { "Content-Type": MIME[".html"], "Cache-Control": "no-store" });
        res.end(ASSETS[alt]);
        return;
      }
      res.writeHead(404); res.end("not found"); return;
    }
    const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(ASSETS[key]);
  } catch (e) {
    res.writeHead(500); res.end(String(e));
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE" && !server._retried) {
    server._retried = true;
    server.listen(0, "127.0.0.1");
  }
});
server.listen(24775, "127.0.0.1", () => {
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/`;
  console.log("DFRANGE_SERVING " + url);
  try {
    require("node:fs").writeFileSync(
      require("node:path").join(os.tmpdir(), "df_range_url.txt"), url);
  } catch (e) {}
  openWindow(url, 0);
});

function openWindow(url, attempt) {
  if (attempt > 3) { // 兜底：默认浏览器
    try { spawn("rundll32", ["url.dll,FileProtocolHandler", url], { detached: true, stdio: "ignore" }).unref(); } catch (e) {}
    return;
  }
  const candidates = [
    ["msedge.exe", ["--app=" + url, "--window-size=1600,900", "--disable-extensions"]],
    ["chrome.exe", ["--app=" + url, "--window-size=1600,900", "--disable-extensions"]],
  ];
  const [exe, args] = candidates[attempt];
  const paths = [
    exe,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\" + exe,
    "C:\\Program Files\\Microsoft\\Edge\\Application\\" + exe,
    "C:\\Program Files\\Google\\Chrome\\Application\\" + exe,
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\" + exe,
  ];
  for (const p of paths) {
    try {
      if (!require("node:fs").existsSync(p)) continue;
      const c = spawn(p, args, { detached: true, stdio: "ignore" });
      c.on("error", () => openWindow(url, attempt + 1));
      c.unref();
      console.log("DFRANGE_OPENED " + p);
      return;
    } catch (e) {}
  }
  openWindow(url, attempt + 1);
}

// 保活；Ctrl+C 退出
process.on("SIGINT", () => process.exit(0));
setInterval(() => {}, 1 << 30);
