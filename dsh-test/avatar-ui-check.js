const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const get = (p) => new Promise((r, j) => http.get({ host: '127.0.0.1', port: 9222, path: p }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => r(JSON.parse(d))); }).on('error', j));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	const t = (await get('/json/list')).find((x) => x.type === 'page');
	const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
	let id = 0; const p = new Map(); const logs = [];
	ws.on('message', (m) => {
		const j = JSON.parse(m);
		if (j.id && p.has(j.id)) { p.get(j.id)(j.result); p.delete(j.id); return; }
		if (j.method === 'Runtime.consoleAPICalled' && j.params.type === 'error') logs.push(j.params.args.map((a) => a.value || '').join(' ').slice(0, 150));
	});
	await new Promise((r) => ws.on('open', r));
	const send = (m, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params })); });
	await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('DOM.enable');
	await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	for (const c of [
		{ name: 'token', value: 'demo-token' },
		{ name: 'userName', value: 'fanshihao' },
		{ name: 'role', value: '管理员' },
	]) await send('Network.setCookie', { ...c, domain: 'localhost', path: '/', url: 'http://localhost:8888/' });
	await send('Page.navigate', { url: 'http://localhost:8888/?a=' + Date.now() + '#/usermanage' });
	await sleep(3500);
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
	console.log('rows', await ev("document.querySelectorAll('.el-table__body tr').length"));
	console.log('rowButtons', JSON.stringify(await ev("[...document.querySelectorAll('.el-table__body tr:first-child button')].map(b=>b.textContent.trim())")));
	// 打开第一行修改
	const opened = await ev("(()=>{const b=[...document.querySelectorAll('.el-table__body tr:first-child button')].find(x=>x.textContent.includes('修改')||x.textContent.includes('编辑'));if(!b)return false;b.click();return true})()");
	console.log('openDialog', opened);
	await sleep(900);
	console.log('dialogTitle', await ev("document.querySelector('.el-dialog__title')?.textContent || ''"));
	console.log('hasEmail', await ev("!!document.querySelector('.el-dialog .el-form-item__label') && [...document.querySelectorAll('.el-dialog .el-form-item__label')].some(e=>e.textContent.includes('Email'))"));
	console.log('fileInputs', await ev("document.querySelectorAll('.el-dialog input[type=file]').length"));
	const doc = await send('DOM.getDocument', { depth: -1 });
	const q = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '.el-dialog input[type=file]' });
	console.log('fileNode', q.nodeId);
	const file = 'D:\\workspace\\factory\\dsh-shots\\80-register-simple.png';
	await send('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [file] });
	await sleep(2500);
	console.log('toast', await ev("[...document.querySelectorAll('.el-message__content')].map(e=>e.textContent.trim()).join(' | ')"));
	console.log('avatarSrc', await ev("document.querySelector('.el-dialog .avatar-img')?.getAttribute('src') || ''"));
	const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
	fs.writeFileSync('D:\\workspace\\factory\\dsh-shots\\90-avatar-upload.png', Buffer.from(data, 'base64'));
	// 保存
	await ev("[...document.querySelectorAll('.el-dialog button')].find(b=>b.textContent.includes('修 改')||b.textContent.includes('修改'))?.click()");
	await sleep(2000);
	console.log('afterSaveToast', await ev("[...document.querySelectorAll('.el-message__content')].map(e=>e.textContent.trim()).join(' | ')"));
	console.log('tableImg', await ev("document.querySelector('.el-table__body tr:first-child .el-avatar img, .el-table__body tr:first-child img')?.getAttribute('src') || ''"));
	console.log('errors', logs.length ? logs.join(' | ') : 'none');
	ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
