const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');
const OUT = 'D:\\workspace\\factory\\dsh-shots';
const PORT = 9222;
const getJson = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port: PORT, path: p }, (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(JSON.parse(d))); }).on('error', rej));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const add = (id, name, expected, actual, pass) => { results.push({ id, name, expected, actual, pass }); console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} | ${actual}`); };

(async () => {
	let targets = null;
	for (let i = 0; i < 60; i++) { try { targets = await getJson('/json/list'); if (targets && targets.length) break; } catch (e) {} await sleep(500); }
	const page = targets.find((t) => t.type === 'page') || targets[0];
	const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
	let seq = 0; const pending = new Map(); const logs = []; let send = null;
	ws.on('message', (raw) => {
		const msg = JSON.parse(raw.toString());
		if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); return; }
		if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(msg.params.type)) logs.push(`[${msg.params.type}] ` + msg.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300));
		if (msg.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (msg.params.exceptionDetails.exception ? msg.params.exceptionDetails.exception.description : msg.params.exceptionDetails.text));
	});
	await new Promise((r) => ws.on('open', r));
	send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
	await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
	await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
	const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r && r.result ? r.result.value : null; };
	const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64')); };
	const nav = async (hash, wait = 3000) => { await send('Page.navigate', { url: `http://localhost:8888/?u=${Date.now()}#${hash}` }); await sleep(wait); };
	const fill = async (placeholder, text) => {
		const ok = await ev(`(()=>{const el=[...document.querySelectorAll('input,textarea')].find(e=>e.placeholder===${JSON.stringify(placeholder)});if(!el)return false;el.focus();if(el.select)el.select();return true})()`);
		if (!ok) return false;
		await send('Input.insertText', { text });
		return true;
	};
	const clickEl = async (selector, index = 0) => {
		const rect = await ev(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})];const el=els[${index}];if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
		if (!rect) return false;
		for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
		return true;
	};
	const clickText = async (selector, text) => ev(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(selector)})];const el=els.find(e=>e.textContent.trim().includes(${JSON.stringify(text)}));if(!el)return false;el.click();return true})()`);
	const pickOption = async (selectIndex, optionText) => {
		await clickEl('.el-select', selectIndex);
		await sleep(500);
		return ev(`(()=>{const items=[...document.querySelectorAll('.el-select-dropdown__item')];const el=items.find(e=>e.textContent.trim()===${JSON.stringify(optionText)});if(!el)return false;el.click();return true})()`);
	};
	const toastText = async () => (await ev(`[...document.querySelectorAll('.el-message__content')].map(e=>e.textContent.trim()).join(' | ')`)) || '';

	await send('Network.clearBrowserCookies');
	const suffix = Date.now().toString().slice(-6);
	const username = `uiqa${suffix}`;
	const tel = `196${suffix}00`;
	const uniqueEmail = `uiqa${suffix}@example.com`;

	// ---------- UI-01 重复邮箱注册 ----------
	await nav('/register', 3200);
	await fill('请输入用户名', username);
	await fill('请输入密码', 'Test1234');
	await fill('请确认密码', 'Test1234');
	await fill('请输入姓名', 'UI测试');
	await fill('请输入邮箱', '3456642104@qq.com');
	await clickText('button', '获取验证码');
	await sleep(1400);
	let code1 = await ev(`document.querySelector('input[placeholder="请输入邮箱验证码"]')?.value || ''`);
	if (code1.length !== 6) {
		// 上一次测试可能刚发过验证码，等待后端 60 秒冷却结束再重试
		const tip = await toastText();
		const matched = tip.match(/(\d+)\s*秒/);
		const waitSec = matched ? Number(matched[1]) + 2 : 62;
		console.log(`cooldown wait ${waitSec}s`);
		await sleep(waitSec * 1000);
		await clickText('button', '获取验证码');
		await sleep(1600);
		code1 = await ev(`document.querySelector('input[placeholder="请输入邮箱验证码"]')?.value || ''`);
	}
	add('UI-01', '重复邮箱：验证码演示模式自动填入', '6 位验证码', code1, code1.length === 6);
	await fill('请输入手机号', tel);
	await pickOption(0, '男');
	await pickOption(1, '巡检员');
	await sleep(300);
	await clickText('button', '注册');
	await sleep(1500);
	const dupToast = await toastText();
	add('UI-02', '重复邮箱注册被页面拦截并提示', '提示包含 邮箱', dupToast, dupToast.includes('邮箱'));
	await shot('60-ui-duplicate-email');
	const stillRegister = (await ev('location.hash')) || '';
	add('UI-03', '重复邮箱失败后停留在注册页', '#/register', stillRegister, stillRegister.includes('/register'));

	// ---------- UI-04 换唯一邮箱正常注册（刷新页面重置 60 秒倒计时） ----------
	await nav('/register', 3200);
	await fill('请输入用户名', username);
	await fill('请输入密码', 'Test1234');
	await fill('请确认密码', 'Test1234');
	await fill('请输入姓名', 'UI测试');
	await fill('请输入邮箱', uniqueEmail);
	await fill('请输入手机号', tel);
	await pickOption(0, '男');
	await pickOption(1, '巡检员');
	await sleep(300);
	await clickText('button', '获取验证码');
	await sleep(1600);
	await shot('61-ui-register-code');
	await clickText('button', '注册');
	await sleep(1800);
	const okToast = await toastText();
	add('UI-04', '唯一邮箱注册成功', '提示包含 注册成功', okToast, okToast.includes('注册成功'));
	const afterReg = (await ev('location.hash')) || '';
	add('UI-05', '注册成功后跳转登录页', '#/login', afterReg, afterReg.includes('/login'));
	await shot('62-ui-register-ok');

	// ---------- UI-06 用新账号登录 ----------
	await fill('请输入用户名', username);
	await fill('请输入密码', 'Test1234');
	await pickOption(0, '巡检员');
	await clickText('button', '登 录');
	await sleep(2200);
	const afterLogin = (await ev('location.hash')) || '';
	add('UI-06', '新账号登录成功进入首页', '#/home', afterLogin, afterLogin.includes('/home'));
	await shot('62-ui-login-home');

	// ---------- UI-07 页面回归 ----------
	await nav('/manual', 3000);
	const kbTitle = await ev(`document.querySelector('.hero-title')?.textContent.trim() || ''`);
	add('UI-07', '知识手册页面正常渲染', '包含 安全知识手册', kbTitle, kbTitle.includes('安全知识手册'));
	// 切换到管理员身份查看用户管理
	for (const c of [
		{ name: 'userName', value: 'fanshihao' },
		{ name: 'role', value: '管理员' },
	]) await send('Network.setCookie', { ...c, domain: 'localhost', path: '/', url: 'http://localhost:8888/' });
	await nav('/usermanage', 3200);
	const userRows = await ev(`document.querySelectorAll('.el-table__body tr').length`);
	add('UI-08', '用户管理列表正常渲染（管理员）', '行数 > 0', String(userRows), Number(userRows) > 0);
	await shot('63-ui-usermanage');

	// ---------- 清理测试账号 ----------
	const loginHash = afterLogin;
	let cleanup = 'skip';
	if (loginHash.includes('/home')) {
		// 用接口查询并删除 UI 测试账号
		await nav('/home', 1200);
		const userJson = await ev(`fetch('/api/user/${username}').then(r=>r.json()).then(j=>JSON.stringify(j))`);
		try {
			const parsed = JSON.parse(userJson);
			if (parsed && parsed.data && parsed.data.id) {
				const del = await ev(`fetch('/api/user/${parsed.data.id}',{method:'DELETE'}).then(r=>r.json()).then(j=>JSON.stringify(j))`);
				cleanup = del;
			}
		} catch (e) { cleanup = 'parse-fail'; }
	}
	add('UI-09', 'UI 测试账号清理', '删除返回 code=0', String(cleanup).slice(0, 120), String(cleanup).includes('"code":"0"'));

	const pass = results.filter((r) => r.pass).length;
	const fail = results.length - pass;
	const lines = [];
	lines.push(`UI 端到端测试报告 (${new Date().toLocaleString('zh-CN')})`);
	lines.push(`测试账号：${username} / Test1234（测试后已删除）`);
	lines.push('-'.repeat(100));
	for (const r of results) lines.push(`${r.pass ? 'PASS' : 'FAIL'}  ${r.id}  ${r.name}  预期=${r.expected}  实际=${r.actual}`);
	lines.push('-'.repeat(100));
	lines.push(`合计：${results.length} 条，通过 ${pass} 条，失败 ${fail} 条`);
	lines.push(`控制台告警/错误：${logs.length ? logs.join('\n') : '无'}`);
	fs.writeFileSync('D:\\workspace\\factory\\dsh-test\\ui-test-report.txt', lines.join('\r\n'), 'utf8');
	console.log(lines.join('\n'));
	ws.close();
	process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FAIL', e && e.stack ? e.stack : e); process.exit(2); });
