import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { app, BrowserWindow, Menu, shell } from "electron";
import { startServer } from "../server.mjs";

let mainWindow = null;
let localServer = null;
let localOrigin = "";

function resolveGrokBinary() {
  const candidates = [
    process.env.GROK_BIN,
    join(homedir(), ".local", "bin", "grok"),
    join(homedir(), ".grok", "bin", "grok"),
    "/opt/homebrew/bin/grok",
    "/usr/local/bin/grok",
  ].filter(Boolean);
  return candidates.find(existsSync) || "grok";
}

function installMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: "about", label: `关于${app.name}` },
        { type: "separator" },
        { role: "hide", label: "隐藏" },
        { role: "hideOthers", label: "隐藏其他" },
        { role: "unhide", label: "全部显示" },
        { type: "separator" },
        { role: "quit", label: `退出${app.name}` },
      ],
    },
    {
      label: "编辑",
      submenu: [
        { role: "undo", label: "撤销" },
        { role: "redo", label: "重做" },
        { type: "separator" },
        { role: "cut", label: "剪切" },
        { role: "copy", label: "复制" },
        { role: "paste", label: "粘贴" },
        { role: "selectAll", label: "全选" },
      ],
    },
    {
      label: "显示",
      submenu: [
        { role: "reload", label: "重新载入" },
        { role: "togglefullscreen", label: "进入全屏幕" },
      ],
    },
    {
      label: "窗口",
      submenu: [
        { role: "minimize", label: "最小化" },
        { role: "zoom", label: "缩放" },
        { role: "close", label: "关闭窗口" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  const started = await startServer({
    port: 0,
    root: app.getAppPath(),
    grokBin: resolveGrokBinary(),
    grokCwd: app.getPath("userData"),
  });
  localServer = started.server;
  localOrigin = started.url;

  mainWindow = new BrowserWindow({
    title: "周易宇宙观卦",
    width: 1440,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: "#050b12",
    show: false,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(localOrigin)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", event => {
    const target = event.url;
    if (!target.startsWith(localOrigin)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("closed", () => {
    mainWindow = null;
    localServer?.close();
    localServer = null;
    localOrigin = "";
  });
  await mainWindow.loadURL(localOrigin);
}

app.setName("周易宇宙观卦");
app.whenReady().then(async () => {
  installMenu();
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(error => console.error(error));
    }
  });
}).catch(error => {
  console.error(error);
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  localServer?.close();
  localServer = null;
});
