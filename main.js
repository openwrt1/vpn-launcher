const { app, BrowserWindow, ipcMain } = require('electron');
const { exec } = require('child_process');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const os = require('os');

let win;
let ptyProcess = null;
let appConfig = null;

const userConfigPath = path.join(app.getPath('userData'), 'config.json');
const defaultConfigPath = path.join(__dirname, 'config.json');

function ensureConfigFile() {
    try {
        if (!fs.existsSync(userConfigPath)) {
            console.log(`用户配置文件不存在，正在从 ${defaultConfigPath} 创建...`);
            const defaultConfigData = fs.readFileSync(defaultConfigPath, 'utf8');
            fs.writeFileSync(userConfigPath, defaultConfigData, 'utf8');
            console.log(`成功创建配置文件到: ${userConfigPath}`);
        }
    } catch (error) {
        console.error('初始化配置文件时发生致命错误:', error);
    }
}

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

app.whenReady().then(() => {
    ensureConfigFile();
    createWindow();
});

function getAppConfig() {
    try {
        const configData = fs.readFileSync(userConfigPath, 'utf8');
        appConfig = JSON.parse(configData);
        return appConfig;
    } catch (error) {
        console.error('读取或解析 config.json 失败:', error);
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

    let udp2rawReady = false;

    ptyProcess.on('data', function (data) {
        win.webContents.send('pty-data', data);
        if (!udp2rawReady && data.includes('client_ready')) {
            udp2rawReady = true;
            console.log('udp2raw handshake succeeded.');
            win.webContents.send('vpn-started'); // 发送成功信号到前端
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

ipcMain.on('get-network-interfaces', (event) => {
    const interfaces = os.networkInterfaces();
    const interfaceNames = Object.keys(interfaces);
    event.reply('network-interfaces-data', interfaceNames);
});

ipcMain.on('save-config', (event, newConfig) => {
    try {
        const configData = JSON.stringify(newConfig, null, 2);
        fs.writeFileSync(userConfigPath, configData, 'utf8');
        event.reply('config-saved-success', userConfigPath);
    } catch (error) {
        console.error('写入 config.json 失败:', error);
        event.reply('config-saved-failure', error.message);
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

    let devParam = '';
    if (config.networkInterface && config.networkInterface !== 'auto') {
        devParam = ` --dev ${config.networkInterface}`;
    }

    const udp2rawCmd = `sudo ${binaryPath} -c -l 127.0.0.1:29999 -r ${serverAddress} -k "${key}" --raw-mode easyfaketcp --cipher-mode xor${devParam}\n`;
    
    if (win) {
        win.webContents.send('pty-data', `\n\x1b[34m[CMD] ${udp2rawCmd.trim()}\x1b[0m\n`);
    }

    startVpnProcess(udp2rawCmd);

    if (ptyProcess) {
        ptyProcess.nodeId = nodeId;
    }
});

ipcMain.on('pty-input', (event, data) => {
    if (ptyProcess) {
        ptyProcess.write(data);
    }
});

ipcMain.on('stop-vpn', () => {
    // 直接终止 pty 进程 (udp2raw)
    if (ptyProcess) {
        ptyProcess.kill();
        console.log('PTY process killed.');
    } 
    win.webContents.send('vpn-stopped');

    // 尝试清理任何残留的 udp2raw 进程
    const config = getAppConfig();
    if (config && config.udp2raw_binary_path) {
        const binaryName = path.basename(config.udp2raw_binary_path);
        exec(`sudo pkill -f ${binaryName}`);
        console.log(`Attempted to pkill -f ${binaryName}`);
    }
});

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
