const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const SHOT_DIR = 'D:\\workspace\\factory\\dsh-shots';
const REPORT = 'D:\\workspace\\factory\\e2e-multi-account.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: 9222, path: p }, (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => resolve(JSON.parse(data)));
  }).on('error', reject);
});

(async () => {
  const targets = await get('/json/list');
  const target = targets.find((t) => t.type === 'page');
  if (!target) throw new Error('no CDP page');
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false });
  let id = 0;
  const pending = new Map();
  ws.on('message', (m) => {
    const j = JSON.parse(m);
    if (j.id && pending.has(j.id)) {
      pending.get(j.id)(j.result);
      pending.delete(j.id);
    }
  });
  await new Promise((r) => ws.on('open', r));
  const send = (method, params = {}) => new Promise((r) => {
    const i = ++id;
    pending.set(i, r);
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'eval error');
    return r.result ? r.result.value : undefined;
  };
  const shot = async (name) => {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const p = path.join(SHOT_DIR, name);
    fs.writeFileSync(p, Buffer.from(r.data, 'base64'));
    return p;
  };
  const setVal = async (placeholder, text) => ev(`(() => {
    const el = [...document.querySelectorAll('input')].find(e => e.placeholder === ${JSON.stringify(placeholder)});
    if (!el) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const accounts = [
    { role: '管理员', phone: '15893646659', password: '123456' },
    { role: '项目经理', phone: '19930535965', password: '123456' },
    { role: '专职安全员', phone: '19935590301', password: '123456' },
    { role: '巡检员', phone: '19923573989', password: '123456' },
    { role: '施工班组长', phone: '19976095731', password: '123456' },
    { role: '现场施工人员', phone: '19984391840', password: '123456' },
  ];
  const results = [];

  for (const a of accounts) {
    await send('Network.clearBrowserCookies');
    await send('Page.navigate', { url: `http://localhost:8888/?e2e=${Date.now()}#/login` });
    await sleep(2600);
    const filledPhone = await setVal('请输入手机号', a.phone);
    const filledPwd = await setVal('请输入密码', a.password);
    await ev("(() => { const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('登 录')); if(b)b.click(); return !!b; })()");
    await sleep(3800);
    const login = {
      filledPhone,
      filledPwd,
      hash: await ev('location.hash'),
      account: await ev("document.querySelector('.user-account')?.textContent.trim() || ''"),
      role: await ev("document.querySelector('.user-role, .role-tag')?.textContent.trim() || ''"),
    };

    await send('Page.navigate', { url: `http://localhost:8888/?e2e=${Date.now()}#/workOrder` });
    await sleep(3200);
    const orders = {
      rowCount: await ev("document.querySelectorAll('.el-table__body tr').length"),
      buttons: await ev("[...document.querySelectorAll('.el-table__body button, .el-table__body .el-button')].map(e=>e.textContent.trim()).filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i)"),
      totalText: await ev("document.querySelector('.el-pagination__total')?.textContent.trim() || ''"),
      tableText: await ev("document.querySelector('.el-table__body')?.innerText.slice(0,1200) || ''"),
      screenshot: await shot(`e2e-${a.role}-orders.png`),
    };

    await send('Page.navigate', { url: `http://localhost:8888/?e2e=${Date.now()}#/message` });
    await sleep(2800);
    const messages = {
      itemCount: await ev("document.querySelectorAll('.msg-item, .message-item, .msg-card').length"),
      unreadText: await ev("document.body.innerText.split('\\n').filter(x=>x.includes('未读')).slice(0,5).join(' | ')"),
      bodyText: await ev("document.body.innerText.slice(0,900)"),
      screenshot: await shot(`e2e-${a.role}-messages.png`),
    };

    results.push({ account: a, login, orders, messages });
    console.log(JSON.stringify({ role: a.role, login, orders: { rowCount: orders.rowCount, totalText: orders.totalText, buttons: orders.buttons }, messages: { itemCount: messages.itemCount, unreadText: messages.unreadText } }, null, 2));
  }

  fs.writeFileSync(REPORT, JSON.stringify(results, null, 2), 'utf8');
  console.log('REPORT', REPORT);
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
