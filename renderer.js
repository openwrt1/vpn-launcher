const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');

// --- 初始化 Xterm.js ---
const term = new Terminal({
    cursorBlink: true,
    convertEol: true, // 启用时，光标将转到下一行的开头
});
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);

// 将终端挂载到 HTML 元素上
term.open(document.getElementById('terminal'));

// 使终端尺寸适应其容器
fitAddon.fit();
window.addEventListener('resize', () => fitAddon.fit());

// --- 设置与主进程 pty 的双向通信 ---

// 监听来自主进程 pty 的数据，并将其写入前端终端
ipcRenderer.on('pty-data', (event, data) => {
    term.write(data);
});

// 监听前端终端的用户输入，并将其发送给主进程的 pty
term.onData(data => {
    ipcRenderer.send('pty-input', data);
});


function startVPN() {
    term.clear(); // 清空终端
    ipcRenderer.send('start-vpn');
}

function stopVPN() {
    ipcRenderer.send('stop-vpn');
}

// --- 添加以下监听器 ---

// 监听主进程返回的成功消息
ipcRenderer.on('vpn-started', (event, arg) => {
    term.write('\n\n\x1b[32m✅ WireGuard 启动成功！\x1b[0m\n');
});

// 监听主进程返回的停止消息
ipcRenderer.on('vpn-stopped', (event, arg) => {
    term.write('\n\n\x1b[31m🛑 VPN 已停止。\x1b[0m\n');
});

// 监听主进程返回的错误消息
ipcRenderer.on('vpn-error', (event, errorMessage) => {
    term.write(`\n\n\x1b[31m❌ 操作失败: ${errorMessage}\x1b[0m\n`);
});
