/* 三角洲靶场 · Electron 独立窗口主进程
   自带渲染引擎，直接加载内嵌页面，不再调用 Edge/Chrome 等系统浏览器 */
"use strict";
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

let win = null;

function createWindow(){
  win = new BrowserWindow({
    width: 1600,
    height: 900,
    useContentSize: true,
    minWidth: 1100,
    minHeight: 640,
    title: "三角洲行动 · 改枪靶场复刻",
    autoHideMenuBar: true,
    backgroundColor: "#111214",
    webPreferences: {
      preload: path.join(__dirname, "app", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,          // preload 使用 contextBridge，无需 sandbox 外能力
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "app", "index.html"));
  win.on("closed", () => { win = null; });
}

/* preload.js: dfNative.reportSelftest -> 主进程输出 */
ipcMain.on("selftest-result", (e, s) => {
  console.log("SELFTEST " + s);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => app.quit());
