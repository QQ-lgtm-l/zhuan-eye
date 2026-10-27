const WebSocket = require('ws');
const http = require('http');
const get = (p) => new Promise((r, j) => http.get({ host: '127.0.0.1', port: 9222, path: p }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => r(JSON.parse(d))); }).on('error', j));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	const list = await get('/json/list');
	const t = list.find((x) => x.type === 'page');
	const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
	let id = 0; const p = new Map(); const logs = [];
	ws.on('message', (m) => {
		const j = JSON.parse(m);
		if (j.id && p.has(j.id)) { p.get(j.id)(j.result); p.delete(j.id); return; }
		if (j.method === 'Runtime.consoleAPICalled' && j.params.type === 'error') logs.push(j.params.args.map((a) => a.value || '').join(' ').slice(0, 160));
		if (j.method === 'Runtime.exceptionThrown') logs.push('EX: ' + (j.params.exceptionDetails.text || ''));
	});
	await new Promise((r) => ws.on('open', r));
	const send = (m, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params })); });
	await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
	for (const c of [
		{ name: 'token', value: 'demo-token' },
		{ name: 'userName', value: 'fanshihao' },
		{ name: 'role', value: '管理员' },
	]) await send('Network.setCookie', { ...c, domain: 'localhost', path: '/', url: 'http://localhost:8888/' });
	await send('Page.navigate', { url: 'http://localhost:8888/?ai=' + Date.now() + '#/smartChat' });
	await sleep(3500);
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
	console.log('status', await ev("document.querySelector('.ai-status')?.textContent.trim() || ''"));
	await ev("(()=>{const t=document.querySelector('.chat-input textarea');if(!t)return false;t.focus();return true})()");
	await send('Input.insertText', { text: '临边防护怎么做？简短回答' });
	await sleep(300);
	await ev("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('发送'));if(b)b.click();return !!b})()");
	const start = Date.now();
	let state = {};
	for (let i = 0; i < 40; i++) {
		await sleep(1000);
		state = await ev(`(()=>({rows:document.querySelectorAll('.message-row').length, loading:!!document.querySelector('.chat-input .el-button.is-loading'), assistant:[...document.querySelectorAll('.message-row.is-assistant .msg-bubble')].slice(-1)[0]?.textContent.slice(0,80)||''}))()`);
		if (!state.loading && state.assistant) break;
	}
	console.log('waited', Math.round((Date.now() - start) / 1000) + 's', JSON.stringify(state));
	console.log('errors', logs.length ? logs.join(' | ') : 'none');
	ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
