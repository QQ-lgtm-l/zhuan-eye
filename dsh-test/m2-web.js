// M2 Web 验证：四级等级、筛选、双时限、详情、首页
const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');

const OUT = 'D:/workspace/factory/dsh-shots';
const results = [];
const logs = [];
const add = (id, name, expected, actual, pass) => {
  results.push({ id, name, expected, actual, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${name} | ${actual}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: 9222, path: p }, (res) => {
    let d = '';
    res.on('data', (c) => (d += c));
    res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

(async () => {
  let targets = null;
  for (let i = 0; i < 60; i++) {
    try { targets = await getJson('/json/list'); if (targets && targets.length) break; } catch (e) {}
    await sleep(500);
  }
  if (!targets || !targets.length) throw new Error('CDP 9222 没有页面');
  const page = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let seq = 0;
  const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled' && ['error'].includes(msg.params.type)) {
      logs.push('[console] ' + msg.params.args.map((a) => a.value || a.description || '').join(' ').slice(0, 300));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      logs.push('[exception] ' + (msg.params.exceptionDetails.exception ? msg.params.exceptionDetails.exception.description : msg.params.exceptionDetails.text));
    }
  });
  await new Promise((r) => ws.on('open', r));
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const ev = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r && r.exceptionDetails) throw new Error(r.exceptionDetails.text || 'JS 异常');
    return r && r.result ? r.result.value : null;
  };
  const shot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64'));
  };
  const navHash = async (hash, wait = 2500) => {
    await ev(`location.hash=${JSON.stringify('#' + hash)}`);
    await sleep(wait);
  };
  const text = async () => (await ev(`document.body.innerText`)) || '';
  const fill = async (placeholder, value) => ev(`(()=>{
    const el=[...document.querySelectorAll('input')].find(e=>e.placeholder===${JSON.stringify(placeholder)});
    if(!el)return false;
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Network.clearBrowserCookies');

  await send('Page.navigate', { url: 'http://localhost:8888/#/login' });
  await sleep(3000);
  await fill('请输入手机号', '15893646659');
  await fill('请输入密码', '123456');
  await ev(`(()=>{const b=document.querySelector('.login-btn');if(b)b.click()})()`);
  await sleep(4500);
  const homeText = await text();
  add('M2-01', '管理员登录', '进入首页', homeText.includes('筑安慧眼') ? '已进入' : '未进入', homeText.includes('筑安慧眼'));
  await shot('web-m2-home');

  // 接口验证四级数据
  const counts = await ev(`Promise.all(['Ⅰ级重大','Ⅱ级较大','Ⅲ级一般','Ⅳ级轻微'].map(level =>
    fetch('/api/workOrder?pageNum=1&pageSize=1&level=' + encodeURIComponent(level)).then(r=>r.json()).then(d=>d.data.total)
  ))`);
  const total = counts.reduce((a, b) => a + b, 0);
  add('M2-02', '四级工单数据', '合计119，当前有Ⅰ/Ⅱ/Ⅲ级数据（Ⅳ级可为0）', JSON.stringify(counts),
    total === 119 && counts.slice(0, 3).every((n) => n > 0) && counts.length === 4);

  const one = await ev(`fetch('/api/workOrder?pageNum=1&pageSize=1&level=' + encodeURIComponent('Ⅰ级重大')).then(r=>r.json()).then(d=>d.data.list[0])`);
  add('M2-03', '工单双时限字段', 'responseDeadline/rectifyDeadline 都有值', `${one.responseDeadline} / ${one.rectifyDeadline}`, !!one.responseDeadline && !!one.rectifyDeadline);

  await navHash('/workOrder', 2500);
  const woText = await text();
  const filterExists = woText.includes('隐患等级') && woText.includes('Ⅰ级重大');
  add('M2-04', '工单等级筛选/标签', '页面显示隐患等级筛选项与四级标签', filterExists ? '可见' : '不可见', filterExists);
  await shot('web-m2-workorder');

  // 打开详情，检查响应/整改时限
  const opened = await ev(`(()=>{const b=[...document.querySelectorAll('.el-button')].find(e=>e.textContent.includes('查看详情'));if(!b)return false;b.click();return true})()`);
  await sleep(1500);
  const detailText = await text();
  const detailOk = opened && detailText.includes('响应时限') && detailText.includes('整改时限') && detailText.includes('截止');
  add('M2-05', '工单详情双时限', '详情显示响应时限/整改时限/截止', detailOk ? '已显示' : '缺失', detailOk);
  await shot('web-m2-detail');

  const realErrors = logs.filter((l) => !/favicon|WebSocket|ws:\/\/|ERR_CONNECTION|Failed to load resource/i.test(l));
  add('M2-06', '控制台无业务异常', '0 条', `${realErrors.length} 条`, realErrors.length === 0);
  if (realErrors.length) console.log(realErrors.slice(0, 10).join('\\n'));

  const failed = results.filter((r) => !r.pass);
  console.log('\\n=== M2 SUMMARY ===');
  console.log(JSON.stringify({ total: results.length, failed: failed.length, results, logs: realErrors }, null, 2));
  ws.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('M2 TEST ERROR:', e);
  process.exit(2);
});
