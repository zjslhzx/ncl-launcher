# ncl-launcher · 三角洲风格 3D 打靶训练场

一个自研的 3D 打靶训练应用（Three.js 渲染 + Electron 独立窗口），用于压枪 / 弹道 / 距离感练习。

**本仓库不含任何游戏内资产**：场景、靶子、枪械外观均为程序化几何体原创建模；武器数值为社区公开资料整理的数值表。与任何游戏官方无关，仅供练习用途。

## 功能

- 3D 靶场：固定靶、左右移动靶、25/50/100/150/200 米距离标记
- 第一人称射击：鼠标视角、弹道下坠、距离衰减、部位伤害（头/胸/腹/四肢）、护甲与头盔减伤
- 后坐力与压枪练习：全自动/半开火模式、可调灵敏度
- 改枪模拟：配件选择实时影响 射速/初速/后坐/有效射程/穿深 等数值
- 计分与 TTK 统计、WebAudio 合成音效（无音频文件）

## 使用

直接运行 `dist/三角洲靶场.exe`（Electron 便携版，自带渲染内核，**不依赖系统浏览器**）。

按键：左键射击 / R 换弹 / 1-5 切换距离 / Tab 数据面板（详见应用内说明）。

## 从源码运行

```bash
cd electron
npm install
npm start          # 开发运行
npm run dist       # 重新打包 portable exe（输出 electron/dist）
```

## SEA 单文件版（可选）

`sea/` 目录提供 Node SEA 单文件构建（`build_exe.bat`，产物约 74MB）。注意：SEA 版体积更小，但会以 `--app` 模式调用系统 Edge/Chrome 打开窗口，不如 Electron 版独立。

## 目录结构

```
app/       前端（index.html + three.min.js + range3d.js + keybinds.js）
electron/  Electron 主进程与打包配置
sea/       Node SEA 单文件启动器（备选方案）
dist/      预编译便携版 exe
```

## License

MIT
