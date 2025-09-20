const { ipcRenderer } = require('electron');
const { Terminal } = require('xterm');
const { FitAddon } = require('xterm-addon-fit');

// --- 全局变量 ---
let appConfig = null;
const term = new Terminal({ cursorBlink: true, convertEol: true, fontFamily: `"Cascadia Code", Menlo, Monaco, "Courier New", monospace`, fontSize: 14, theme: { background: '#2b2b2b', foreground: '#dcdcdc' } });
const fitAddon = new FitAddon();

// --- 国旗映射表 (全球版) ---
const flagMap = {
    '阿富汗': '🇦🇫', '奥兰群岛': '🇦🇽', '阿尔巴尼亚': '🇦🇱', '阿尔及利亚': '🇩🇿', '美属萨摩亚': '🇦🇸',
    '安道尔': '🇦🇩', '安哥拉': '🇦🇴', '安圭拉': '🇦🇮', '南极洲': '🇦🇶', '安提瓜和巴布达': '🇦🇬',
    '阿根廷': '🇦🇷', '亚美尼亚': '🇦🇲', '阿鲁巴': '🇦🇼', '澳大利亚': '🇦🇺', '奥地利': '🇦🇹',
    '阿塞拜疆': '🇦🇿', '巴哈马': '🇧🇸', '巴林': '🇧🇭', '孟加拉国': '🇧🇩', '巴巴多斯': '🇧🇧',
    '白俄罗斯': '🇧🇾', '比利时': '🇧🇪', '伯利兹': '🇧🇿', '贝宁': '🇧🇯', '百慕大': '🇧🇲',
    '不丹': '🇧🇹', '玻利维亚': '🇧🇴', '波黑': '🇧🇦', '博茨瓦纳': '🇧🇼', '布维岛': '🇧🇻',
    '巴西': '🇧🇷', '英属印度洋领地': '🇮🇴', '文莱': '🇧🇳', '保加利亚': '🇧🇬', '布基纳法索': '🇧🇫',
    '布隆迪': '🇧🇮', '柬埔寨': '🇰🇭', '喀麦隆': '🇨🇲', '加拿大': '🇨🇦', '佛得角': '🇨🇻',
    '开曼群岛': '🇰🇾', '中非': '🇨🇫', '乍得': '🇹🇩', '智利': '🇨🇱', '中国': '🇨🇳',
    '圣诞岛': '🇨🇽', '科科斯（基林）群岛': '🇨🇨', '哥伦比亚': '🇨🇴', '科摩罗': '🇰🇲', '刚果（布）': '🇨🇬',
    '刚果（金）': '🇨🇩', '库克群岛': '🇨🇰', '哥斯达黎加': '🇨🇷', '科特迪瓦': '🇨🇮', '克罗地亚': '🇭🇷',
    '古巴': '🇨🇺', '库拉索': '🇨🇼', '塞浦路斯': '🇨🇾', '捷克': '🇨🇿', '丹麦': '🇩🇰',
    '吉布提': '🇩🇯', '多米尼克': '🇩🇲', '多米尼加': '🇩🇴', '厄瓜多尔': '🇪🇨', '埃及': '🇪🇬',
    '萨尔瓦多': '🇸🇻', '赤道几内亚': '🇬🇶', '厄立特里亚': '🇪🇷', '爱沙尼亚': '🇪🇪', '埃塞俄比亚': '🇪🇹',
    '福克兰群岛': '🇫🇰', '法罗群岛': '🇫🇴', '斐济': '🇫🇯', '芬兰': '🇫🇮', '法国': '🇫🇷',
    '法属圭亚那': '🇬🇫', '法属波利尼西亚': '🇵🇫', '法属南部领地': '🇹🇫', '加蓬': '🇬🇦', '冈比亚': '🇬🇲',
    '格鲁吉亚': '🇬🇪', '德国': '🇩🇪', '加纳': '🇬🇭', '直布罗陀': '🇬🇮', '希腊': '🇬🇷',
    '格陵兰': '🇬🇱', '格林纳达': '🇬🇩', '瓜德罗普': '🇬🇵', '关岛': '🇬🇺', '危地马拉': '🇬🇹',
    '根西': '🇬🇬', '几内亚': '🇬🇳', '几内亚比绍': '🇬🇼', '圭亚那': '🇬🇾', '海地': '🇭🇹',
    '赫德岛和麦克唐纳群岛': '🇭🇲', '梵蒂冈': '🇻🇦', '洪都拉斯': '🇭🇳', '香港': '🇭🇰', '匈牙利': '🇭🇺',
    '冰岛': '🇮🇸', '印度': '🇮🇳', '印度尼西亚': '🇮🇩', '伊朗': '🇮🇷', '伊拉克': '🇮🇶',
    '爱尔兰': '🇮🇪', '马恩岛': '🇮🇲', '以色列': '🇮🇱', '意大利': '🇮🇹', '牙买加': '🇯🇲',
    '日本': '🇯🇵', '泽西': '🇯🇪', '约旦': '🇯🇴', '哈萨克斯坦': '🇰🇿', '肯尼亚': '🇰🇪',
    '基里巴斯': '🇰🇮', '朝鲜': '🇰🇵', '韩国': '🇰🇷', '科威特': '🇰🇼', '吉尔吉斯斯坦': '🇰🇬',
    '老挝': '🇱🇦', '拉脱维亚': '🇱🇻', '黎巴嫩': '🇱🇧', '莱索托': '🇱🇸', '利比里亚': '🇱🇷',
    '利比亚': '🇱🇾', '列支敦士登': '🇱🇮', '立陶宛': '🇱🇹', '卢森堡': '🇱🇺', '澳门': '🇲🇴',
    '马其顿': '🇲🇰', '马达加斯加': '🇲🇬', '马拉维': '🇲🇼', '马来西亚': '🇲🇾', '马尔代夫': '🇲🇻',
    '马里': '🇲🇱', '马耳他': '🇲🇹', '马绍尔群岛': '🇲🇭', '马提尼克': '🇲🇶', '毛里塔尼亚': '🇲🇷',
    '毛里求斯': '🇲🇺', '马约特': '🇾🇹', '墨西哥': '🇲🇽', '密克罗尼西亚': '🇫🇲', '摩尔多瓦': '🇲🇩',
    '摩纳哥': '🇲🇨', '蒙古': '🇲🇳', '黑山': '🇲🇪', '蒙特塞拉特': '🇲🇸', '摩洛哥': '🇲🇦',
    '莫桑比克': '🇲🇿', '缅甸': '🇲🇲', '纳米比亚': '🇳🇦', '瑙鲁': '🇳🇷', '尼泊尔': '🇳🇵',
    '荷兰': '🇳🇱', '新喀里多尼亚': '🇳🇨', '新西兰': '🇳🇿', '尼加拉瓜': '🇳🇮', '尼日尔': '🇳🇪',
    '尼日利亚': '🇳🇬', '纽埃': '🇳🇺', '诺福克岛': '🇳🇫', '北马里亚纳群岛': '🇲🇵', '挪威': '🇳🇴',
    '阿曼': '🇴🇲', '巴基斯坦': '🇵🇰', '帕劳': '🇵🇼', '巴勒斯坦': '🇵🇸', '巴拿马': '🇵🇦',
    '巴布亚新几内亚': '🇵🇬', '巴拉圭': '🇵🇾', '秘鲁': '🇵🇪', '菲律宾': '🇵🇭', '皮特凯恩群岛': '🇵🇳',
    '波兰': '🇵🇱', '葡萄牙': '🇵🇹', '波多黎各': '🇵🇷', '卡塔尔': '🇶🇦', '留尼汪': '🇷🇪',
    '罗马尼亚': '🇷🇴', '俄罗斯': '🇷🇺', '卢旺达': '🇷🇼', '圣巴泰勒米': '🇧🇱', '圣赫勒拿': '🇸🇭',
    '圣基茨和尼维斯': '🇰🇳', '圣卢西亚': '🇱🇨', '圣马丁': '🇲🇫', '圣皮埃尔和密克隆': '🇵🇲',
    '圣文森特和格林纳丁斯': '🇻🇨', '萨摩亚': '🇼🇸', '圣马力诺': '🇸🇲', '圣多美和普林西比': '🇸🇹',
    '沙特阿拉伯': '🇸🇦', '塞内加尔': '🇸🇳', '塞尔维亚': '🇷🇸', '塞舌尔': '🇸🇨', '塞拉利昂': '🇸🇱',
    '新加坡': '🇸🇬', '荷属圣马丁': '🇸🇽', '斯洛伐克': '🇸🇰', '斯洛文尼亚': '🇸🇮', '所罗门群岛': '🇸🇧',
    '索马里': '🇸🇴', '南非': '🇿🇦', '南乔治亚和南桑威奇群岛': '🇬🇸', '南苏丹': '🇸🇸', '西班牙': '🇪🇸',
    '斯里兰卡': '🇱🇰', '苏丹': '🇸🇩', '苏里南': '🇸🇷', '斯瓦尔巴和扬马延': '🇸🇯', '斯威士兰': '🇸🇿',
    '瑞典': '🇸🇪', '瑞士': '🇨🇭', '叙利亚': '🇸🇾', '台湾': '🇹🇼', '塔吉克斯坦': '🇹🇯',
    '坦桑尼亚': '🇹🇿', '泰国': '🇹🇭', '东帝汶': '🇹🇱', '多哥': '🇹🇬', '托克劳': '🇹🇰',
    '汤加': '🇹🇴', '特立尼达和多巴哥': '🇹🇹', '突尼斯': '🇹🇳', '土耳其': '🇹🇷', '土库曼斯坦': '🇹🇲',
    '特克斯和凯科斯群岛': '🇹🇨', '图瓦卢': '🇹🇻', '乌干达': '🇺🇬', '乌克兰': '🇺🇦', '阿联酋': '🇦🇪',
    '英国': '🇬🇧', '美国': '🇺🇸', '美国本土外小岛屿': '🇺🇲', '乌拉圭': '🇺🇾', '乌兹别克斯坦': '🇺🇿',
    '瓦努阿图': '🇻🇺', '委内瑞拉': '🇻🇪', '越南': '🇻🇳', '英属维尔京群岛': '🇻🇬', '美属维尔京群岛': '🇻🇮',
    '瓦利斯和富图纳': '🇼🇫', '西撒哈拉': '🇪🇭', '也门': '🇾🇪', '赞比亚': '🇿🇲', '津巴布韦': '🇿🇼',
    '英格兰': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '苏格兰': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '威尔士': '🏴󠁧󠁢󠁷󠁬󠁳󠁿'
};

// --- 初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();
    window.addEventListener('resize', () => fitAddon.fit());
    setupIPCListeners();
    ipcRenderer.send('get-config');
});

// --- IPC 通信 ---
function setupIPCListeners() {
    ipcRenderer.on('pty-data', (event, data) => term.write(data));
    ipcRenderer.on('vpn-started', () => term.write('\n\n\x1b[32m✅ WireGuard 启动成功！\x1b[0m\n'));
    ipcRenderer.on('vpn-stopped', () => term.write('\n\n\x1b[31m🛑 VPN 已停止。\x1b[0m\n'));
    ipcRenderer.on('vpn-error', (event, msg) => term.write(`\n\n\x1b[31m❌ 操作失败: ${msg}\x1b[0m\n`));
    term.onData(data => ipcRenderer.send('pty-input', data));

    ipcRenderer.on('config-data', (event, config) => {
        appConfig = config;
        updateUI();
    });

    ipcRenderer.on('config-saved-success', () => {
        alert('配置已成功保存！');
        ipcRenderer.send('get-config'); // 重新获取配置以刷新整个 UI
    });
}

// --- 核心工具函数 (BUG 修复版) ---
function getCleanName(name) {
    if (!name) return '';
    let cleanName = name.trim();
    let flagFound;
    do {
        flagFound = false;
        for (const flag of Object.values(flagMap)) {
            if (cleanName.startsWith(flag)) {
                cleanName = cleanName.substring(flag.length).trim();
                flagFound = true;
                break; // 找到并移除一个后，从头开始重新扫描
            }
        }
    } while (flagFound);
    return cleanName;
}

function getNodeDisplayName(nodeName) {
    const cleanName = getCleanName(nodeName);
    for (const keyword in flagMap) {
        if (cleanName.includes(keyword)) {
            return `${flagMap[keyword]} ${cleanName}`;
        }
    }
    return cleanName; // 如果没找到匹配的，就返回清理后的名称
}

// --- UI 更新 ---
function updateUI() {
    if (!appConfig) return;
    populateNodeSelector();
    updateStartButtons();
    renderSettingsTable();
}

function populateNodeSelector() {
    const selector = document.getElementById('node-selector');
    selector.innerHTML = '';
    appConfig.nodes.forEach(node => {
        const option = document.createElement('option');
        option.value = node.id;
        option.textContent = getNodeDisplayName(node.name);
        selector.appendChild(option);
    });
    selector.removeEventListener('change', updateStartButtons);
    selector.addEventListener('change', updateStartButtons);
}

function updateStartButtons() {
    const container = document.getElementById('start-buttons-container');
    const selector = document.getElementById('node-selector');
    container.innerHTML = '';
    const selectedNodeId = selector.value;
    const node = appConfig.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    if (node.ipv4_server) {
        const btn = document.createElement('button');
        btn.className = 'control-button start-button';
        btn.textContent = `🚀 启动 IPv4`;
        btn.onclick = () => startVPN(selectedNodeId, 'ipv4');
        container.appendChild(btn);
    }
    if (node.ipv6_server) {
        const btn = document.createElement('button');
        btn.className = 'control-button start-button';
        btn.textContent = `🚀 启动 IPv6`;
        btn.onclick = () => startVPN(selectedNodeId, 'ipv6');
        container.appendChild(btn);
    }
}

function renderSettingsTable() {
    const tbody = document.getElementById('nodes-table-body');
    tbody.innerHTML = '';
    appConfig.nodes.forEach(node => {
        const row = document.createElement('tr');
        row.setAttribute('data-id', node.id);
        const cleanName = getCleanName(node.name);
        row.innerHTML = `
            <td><input type="text" class="node-name" value="${cleanName}"></td>
            <td><input type="text" class="node-ipv4" value="${node.ipv4_server || ''}"></td>
            <td><input type="text" class="node-ipv6" value="${node.ipv6_server || ''}"></td>
            <td><input type="text" class="node-key" value="${node.key || ''}"></td>
            <td><button class="action-button delete-btn" onclick="this.closest('tr').remove()">删除</button></td>
        `;
        tbody.appendChild(row);
    });
}

// --- 用户操作 ---
function startVPN(nodeId, ipVersion) {
    term.clear();
    ipcRenderer.send('start-vpn', { nodeId, ipVersion });
}

function stopVPN() {
    ipcRenderer.send('stop-vpn');
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`.tab-button[onclick="showTab('${tabName}')"]`).classList.add('active');
}

function addNewNodeRow() {
    const tbody = document.getElementById('nodes-table-body');
    const newId = `node_${Date.now()}`;
    const row = document.createElement('tr');
    row.setAttribute('data-id', newId);
    row.innerHTML = `
        <td><input type="text" class="node-name" placeholder="例如: 日本节点"></td>
        <td><input type="text" class="node-ipv4" placeholder="1.2.3.4:39001"></td>
        <td><input type="text" class="node-ipv6" placeholder="[::1]:39002"></td>
        <td><input type="text" class="node-key" placeholder="连接密码"></td>
        <td><button class="action-button delete-btn" onclick="this.closest('tr').remove()">删除</button></td>
    `;
    tbody.appendChild(row);
}

function saveConfig() {
    const newNodes = [];
    const rows = document.querySelectorAll('#nodes-table-body tr');
    rows.forEach(row => {
        const nameInput = row.querySelector('.node-name').value.trim();
        if (!nameInput) return; // 如果名字为空，则忽略此行
        
        const cleanName = getCleanName(nameInput);

        newNodes.push({
            id: row.getAttribute('data-id'),
            name: cleanName, // 保存清理后的名称
            ipv4_server: row.querySelector('.node-ipv4').value.trim(),
            ipv6_server: row.querySelector('.node-ipv6').value.trim(),
            key: row.querySelector('.node-key').value.trim(),
        });
    });

    const newConfig = { ...appConfig, nodes: newNodes };
    ipcRenderer.send('save-config', newConfig);
}
