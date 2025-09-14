const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process'); // 重新引入 exec
const pty = require('node-pty'); // 确保 pty 被引入

// 将 BrowserWindow 实例提升到函数外部，以便在 ipcMain 中访问
let win;
let ptyProcess = null; // 将 ptyProcess 提升到外部作用域

function createWindow() {
    win = new BrowserWindow({
        width: 800,  // 增加主窗口宽度
        height: 600, // 增加主窗口高度
        webPreferences: {
            // preload 脚本已在 renderer.js 中通过 <script> 引入，这里可以移除
            // preload: path.join(__dirname, 'renderer.js'),
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // 加载 index.html 并处理 Promise
    win.loadFile('index.html')
        .then(() => {
            // 文件加载成功后才打开开发者工具
            // win.webContents.openDevTools({ mode: 'detach' }); // 以独立窗口形式打开 DevTools
            console.log('有错误可以打开opendevtools');
        })
        .catch(err => {
            console.error('Failed to load index.html:', err);
        });
}

app.whenReady().then(createWindow);

ipcMain.on('start-vpn', () => {
    // 使用 node-pty 创建一个伪终端来实时捕获输出
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    let vpnStarted = false; // 标志位，防止重复执行

    // 监听伪终端的数据输出
    ptyProcess.on('data', function (data) {
        // 将 pty 的输出数据转发给渲染进程
        win.webContents.send('pty-data', data);

        // 检查日志中是否包含成功启动的关键字
        // 根据用户提供的真实日志，正确的成功关键字是 "client_ready"
        if (!vpnStarted && data.includes('client_ready')) {
            vpnStarted = true;
            console.log('udp2raw handshake succeeded. Starting WireGuard via AppleScript...');
            // 给前端发送一个清晰的提示
            win.webContents.send('pty-data', '\n\n\x1b[32m[INFO] udp2raw 握手成功，正在启动 WireGuard...\x1b[0m\n');
            startWireGuardAppleScript();
        }
    });

    ptyProcess.onExit(() => {
        console.log('PTY process has exited.');
        ptyProcess = null; // 进程退出后清空引用
    });

    // 构造完整的 sudo 命令
    // 注意末尾的 \n，它模拟了在终端中按回车键
    const udp2rawCmd = 'sudo /Users/rocket/Documents/udp2raw_mp_binaries/udp2raw_mp_mac -c -l 127.0.0.1:29999 -r 64.69.34.176:39001 -k "9OtvxqVF4kT2aGAJ" --raw-mode faketcp --cipher-mode xor\n';
    
    // 向伪终端写入命令
    ptyProcess.write(udp2rawCmd);
});

// 监听渲染进程发送过来的用户输入，并写入 pty
// 虽然现在是免密，但保留这个逻辑可以让终端在未来有更强的扩展性
ipcMain.on('pty-input', (event, data) => {
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

function startWireGuardAppleScript() {
    // 2. 使用 osascript 执行你的 AppleScript 脚本来启动 WireGuard
    const wgUpCommand = 'osascript "/Users/rocket/Library/Mobile Documents/com~apple~ScriptEditor2/Documents/wg-up.scpt"';
    exec(wgUpCommand, (error, stdout, stderr) => {
        if (error || stderr) {
            const errorMessage = `启动 WireGuard 失败: ${stderr || error.message}`;
            console.error(errorMessage);
            win.webContents.send('vpn-error', errorMessage);
            // 如果 AppleScript 失败，也应该停掉已经启动的 udp2raw
            if (ptyProcess) {
                ptyProcess.kill(); // 直接杀死伪终端进程
            }
            return;
        }
        console.log('AppleScript (up) stdout:', stdout);
        win.webContents.send('vpn-started'); // 通知界面启动成功
    });
}

ipcMain.on('stop-vpn', () => {
    // 1. 使用 osascript 停止 WireGuard
    const wgDownCommand = 'osascript "/Users/rocket/Library/Mobile Documents/com~apple~ScriptEditor2/Documents/wg-down.applescript.scpt"';
    exec(wgDownCommand, (error, stdout, stderr) => {
        if (error) console.error('AppleScript (down) error:', error.message);
        console.log('AppleScript (down) stdout:', stdout);

        // 优先杀死 pty 进程
        if (ptyProcess) {
            ptyProcess.kill();
            console.log('PTY process killed.');
            win.webContents.send('vpn-stopped'); // 在 pty 进程被杀死后立即通知前端
        } else {
            // 如果 pty 进程不存在，也需要通知前端
            win.webContents.send('vpn-stopped');
        }

        // 2. 停止 udp2raw 进程 (也需要 sudo)
        // 使用 pkill 是最简单的方式
        // 由于 sudoers 已配置免密，直接使用 exec 执行 sudo pkill
        // 这个命令作为双重保险，以防 pty.kill() 失败
        exec('sudo pkill -f udp2raw_mp_mac');
    });
});

// 优雅地关闭应用
app.on('window-all-closed', () => {
    // 在所有平台上，当所有窗口都关闭时，直接退出应用。
    app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});