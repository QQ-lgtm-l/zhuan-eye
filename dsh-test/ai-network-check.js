const WebSocket = require('ws');
const http = require('http');
const get = (p) => new Promise((r, j) => http.get({ host: '127.0.0.1', port: 9222, path: p }, (x) => { let d = ''; x.on('data', (c) => (d += c)); x.on('end', () => r(JSON.parse(d))); }).on('error', j));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
	const t = (await get('/json/list')).find((x) => x.type === 'page');
	const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false });
	let id = 0; const p = new Map(); const events = [];
	ws.on('message', (m) => {
		const j = JSON.parse(m);
		if (j.id && p.has(j.id)) { p.get(j.id)(j.result); p.delete(j.id); return; }
		if (j.method === 'Network.requestWillBeSent' && /ai\//.test(j.params.request.url)) events.push(['REQ', j.params.request.method, j.params.request.url, JSON.stringify(j.params.request.postData || '').slice(0, 200)]);
		if (j.method === 'Network.responseReceived' && /ai\//.test(j.params.response.url)) events.push(['RES', j.params.response.status, j.params.response.url]);
		if (j.method === 'Network.loadingFailed' && /ai\//.test(j.params.requestId)) events.push(['FAIL', j.params.errorText]);
	});
	await new Promise((r) => ws.on('open', r));
	const send = (m, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params })); });
	await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
	await send('Page.navigate', { url: 'http://localhost:8888/?n=' + Date.now() + '#/smartChat' });
	await sleep(3000);
	const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result.value;
	await ev("(()=>{const t=document.querySelector('.chat-input textarea');t.focus();return true})()");
	await send('Input.insertText', { text: '临边防护怎么做？' });
	await ev("(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('发送'));if(b)b.click();return true})()");
	await sleep(12000);
	console.log(events.map((e) => e.join(' | ')).join('\n'));
	console.log('body', (await ev("document.querySelector('.chat-input textarea')?.value || ''")));
	ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
