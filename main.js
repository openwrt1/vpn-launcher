const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');

let win;
let ptyProcess = null;
let appConfig = null; // 在内存中缓存配置

function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html')
        .catch(err => {
            console.error('Failed to load index.html:', err);
        });
}

app.whenReady().then(createWindow);

function getAppConfig() {
    // 不再缓存，总是从文件读取以获取最新信息
    try {
        const configPath = path.join(__dirname, 'config.json');
        const configData = fs.readFileSync(configPath, 'utf8');
        appConfig = JSON.parse(configData);
        return appConfig;
    } catch (error) {
        console.error('Error reading or parsing config.json:', error);
        if (win) {
            win.webContents.send('vpn-error', `读取配置文件 config.json 失败: ${error.message}`);
        }
        return null;
    }
}

function startVpnProcess(command) {
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/sh';
    ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-color',
        cols: 80,
        rows: 30,
        cwd: process.env.HOME,
        env: process.env
    });

    let vpnStarted = false;

    ptyProcess.on('data', function (data) {
        win.webContents.send('pty-data', data);
        if (!vpnStarted && data.includes('client_ready')) {
            vpnStarted = true;
            console.log('udp2raw handshake succeeded. Starting WireGuard via AppleScript...');
            const node = appConfig.nodes.find(n => n.id === ptyProcess.nodeId);
            win.webContents.send('pty-data', `\n\n\x1b[32m[INFO] udp2raw 握手成功，正在启动 WireGuard 隧道: ${node.name}...\x1b[0m\n`);
            startWireGuardAppleScript(node.name);
        }
    });

    ptyProcess.onExit(() => {
        console.log('PTY process has exited.');
        ptyProcess = null;
    });

    ptyProcess.write(command);
}

// --- IPC 事件监听器 ---

ipcMain.on('get-config', (event) => {
    const config = getAppConfig();
    if (config) {
        event.reply('config-data', config);
    }
});

ipcMain.on('save-config', (event, newConfig) => {
    try {
        const configPath = path.join(__dirname, 'config.json');
        // 使用 JSON.stringify 的第三个参数来格式化输出，使其更具可读性
        const configData = JSON.stringify(newConfig, null, 2);
        fs.writeFileSync(configPath, configData, 'utf8');
        event.reply('config-saved-success');
    } catch (error) {
        console.error('Error writing config.json:', error);
        win.webContents.send('vpn-error', `保存配置文件失败: ${error.message}`);
    }
});

ipcMain.on('start-vpn', (event, { nodeId, ipVersion }) => {
    const config = getAppConfig();
    if (!config) return;

    const node = config.nodes.find(n => n.id === nodeId);
    if (!node) {
        win.webContents.send('vpn-error', `未在 config.json 中找到 ID 为 ${nodeId} 的节点`);
        return;
    }

    const serverAddress = ipVersion === 'ipv4' ? node.ipv4_server : node.ipv6_server;
    if (!serverAddress) {
        win.webContents.send('vpn-error', `节点 ${node.name} 没有配置 ${ipVersion} 地址`);
        return;
    }

    const { key } = node;
    const binaryPath = config.udp2raw_binary_path;

    const udp2rawCmd = `sudo ${binaryPath} -c -l 127.0.0.1:29999 -r ${serverAddress} -k "${key}" --raw-mode easyfaketcp --cipher-mode xor\n`;
    
    startVpnProcess(udp2rawCmd);

    // 将 nodeId 附加到 ptyProcess 对象上，以便稍后查找节点名称
    // 必须在 startVpnProcess 创建了 ptyProcess 之后再执行
    if (ptyProcess) {
        ptyProcess.nodeId = nodeId;
    }
});

ipcMain.on('pty-input', (event, data) => {
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

function startWireGuardAppleScript(tunnelName) {
    // 将隧道名称作为参数传递给 AppleScript
    const wgUpCommand = `osascript "/Users/rocket/Library/Mobile Documents/com~apple~ScriptEditor2/Documents/wg-up.scpt" "${tunnelName}"`;
    exec(wgUpCommand, (error, stdout, stderr) => {
        if (error || stderr) {
            const errorMessage = `启动 WireGuard 失败: ${stderr || error.message}`;
            console.error(errorMessage);
            win.webContents.send('vpn-error', errorMessage);
            if (ptyProcess) { ptyProcess.kill(); }
            return;
        }
        console.log('AppleScript (up) stdout:', stdout);
        win.webContents.send('vpn-started');
    });
}

ipcMain.on('stop-vpn', () => {
    const wgDownCommand = 'osascript "/Users/rocket/Library/Mobile Documents/com~apple~ScriptEditor2/Documents/wg-down.applescript.scpt"';
    exec(wgDownCommand, (error, stdout, stderr) => {
        if (error) console.error('AppleScript (down) error:', error.message);
        console.log('AppleScript (down) stdout:', stdout);

        if (ptyProcess) {
            ptyProcess.kill();
            console.log('PTY process killed.');
        } 
        win.webContents.send('vpn-stopped');

        const config = getAppConfig();
        if (config && config.udp2raw_binary_path) {
            const binaryName = path.basename(config.udp2raw_binary_path);
            exec(`sudo pkill -f ${binaryName}`);
        }
    });
});

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
