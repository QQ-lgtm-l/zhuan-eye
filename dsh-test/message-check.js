const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const get = (p) => new Promise((r, j) => http.get({ host: '127.0.0.1', port: 9222, path: p }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => r(JSON.parse(d))); }).on('error', j));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	const t = (await get('/json/list')).find((x) => x.type === 'page');
	const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
	let id = 0; const p = new Map(); const send = (m, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params })); });
	ws.on('message', (m) => { const j = JSON.parse(m); if (j.id && p.has(j.id)) { p.get(j.id)(j.result); p.delete(j.id); } });
	await new Promise((r) => ws.on('open', r));
	await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
	await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	for (const c of [
		{ name: 'token', value: 'demo-token' },
		{ name: 'userName', value: 'fanshihao' },
		{ name: 'role', value: '管理员' },
	]) await send('Network.setCookie', { ...c, domain: 'localhost', path: '/', url: 'http://localhost:8888/' });
	await send('Page.navigate', { url: 'http://localhost:8888/?m=' + Date.now() + '#/message' });
	await sleep(3200);
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
	console.log('items', await ev("document.querySelectorAll('.msg-item, .message-item, .el-card, .msg-card').length"));
	console.log('bodySnippet', (await ev('document.body.innerText')).replace(/\s+/g, ' ').slice(0, 220));
	console.log('unreadBadge', await ev("document.querySelector('.el-badge__content')?.textContent || ''"));
	const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
	fs.writeFileSync('D:\\workspace\\factory\\dsh-shots\\92-message-center.png', Buffer.from(data, 'base64'));
	ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
