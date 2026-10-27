const WebSocket = require('ws');
const http = require('http');
const get = (p) => new Promise((r, j) => http.get({ host: '127.0.0.1', port: 9222, path: p }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => r(JSON.parse(d))); }).on('error', j));
(async () => {
	const t = (await get('/json/list')).find((x) => x.type === 'page');
	const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
	let id = 0; const p = new Map();
	ws.on('message', (m) => { const j = JSON.parse(m); if (j.id && p.has(j.id)) { p.get(j.id)(j.result); p.delete(j.id); } });
	await new Promise((r) => ws.on('open', r));
	const send = (m, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params })); });
	await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
	const fill = async (ph, txt) => {
		await ev(`(()=>{const el=[...document.querySelectorAll('input')].find(e=>e.placeholder===${JSON.stringify(ph)});if(!el)return false;el.focus();el.select&&el.select();return true})()`);
		await send('Input.insertText', { text: txt });
	};
	await send('Network.clearBrowserCookies');
	await send('Page.navigate', { url: 'http://localhost:8888/?l=' + Date.now() + '#/login' });
	await new Promise((r) => setTimeout(r, 3000));
	console.log('loginSelects', await ev("document.querySelectorAll('.el-select').length"));
	await fill('请输入用户名', 'fanshihao');
	await fill('请输入密码', '111111');
	await ev("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('登 录'));if(b)b.click();return !!b})()");
	await new Promise((r) => setTimeout(r, 2600));
	console.log('hash', await ev('location.hash'));
	ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
