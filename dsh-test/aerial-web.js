const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');

const OUT = 'D:/workspace/factory/dsh-shots';
const IMG = 'D:/BaiduNetdiskDownload/site_photo/val/DJI_20250120101324_0002_V_441.jpg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: 9222, path: p }, (res) => {
    let d = ''; res.on('data', (c) => (d += c)); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
  }).on('error', reject);
});

(async () => {
  const targets = await getJson('/json/list');
  const page = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl, { perMessageDeflate: false });
  let seq = 0; const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
  });
  await new Promise((r) => ws.on('open', r));
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r && r.result ? r.result.value : null; };
  const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true }); fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(data, 'base64')); };
  const fill = (placeholder, value) => ev(`(()=>{const el=[...document.querySelectorAll('input')].find(e=>e.placeholder===${JSON.stringify(placeholder)});if(!el)return false;const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;s.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);

  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Network.clearBrowserCookies');
  await ev('localStorage.clear(); sessionStorage.clear();');
  await send('Page.navigate', { url: 'http://localhost:8888/#/login' }); await sleep(3000);
  await fill('请输入手机号', '15893646659'); await fill('请输入密码', '123456');
  await ev(`(()=>{const b=document.querySelector('.login-btn');if(b)b.click()})()`); await sleep(4000);

  await ev(`location.hash='#/aerialPredict'`); await sleep(2500);
  const body1 = await ev(`document.body.innerText`);
  console.log('page loaded', body1.includes('航拍堆料检测'));
  console.log('BODY1', body1.slice(0,600));
  console.log('INPUTS', await ev(`document.querySelectorAll('input').length`));

  const doc = await send('DOM.getDocument', { depth: -1 });
  const q = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  console.log('file input node', q.nodeId);
  await send('DOM.setFileInputFiles', { nodeId: q.nodeId, files: [IMG] });
  await sleep(4000);

  const uploaded = await ev(`document.body.innerText`);
  console.log('uploaded', uploaded.includes('开始航拍检测'));
  await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('开始航拍检测'));if(b)b.click()})()`);
  await sleep(8000);
  const body2 = await ev(`document.body.innerText`);
  console.log(body2.slice(-1200));
  await shot('aerial-predict-result');

  const ok = body1.includes('航拍堆料检测') && body2.includes('堆料框') && !body2.includes('检测失败');
  console.log(ok ? 'AERIAL PASS' : 'AERIAL FAIL');
  ws.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
