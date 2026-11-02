// 媒体加载检查：登录 -> 图片记录 -> 视频记录
const WebSocket = require('ws');
const fs = require('fs');
const http = require('http');
const path = require('path');
const OUT = 'D:/workspace/factory/dsh-shots';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = (p) => new Promise((resolve, reject) => {
  http.get({ host: '127.0.0.1', port: 9222, path: p }, (res) => {
    let d = ''; res.on('data', (c) => (d += c));
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
  let seq = 0; const pending = new Map();
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  await new Promise((r) => ws.on('open', r));
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq; pending.set(id, { resolve, reject });
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
  const fill = async (placeholder, value) => ev(`(()=>{
    const el=[...document.querySelectorAll('input')].find(e=>e.placeholder===${JSON.stringify(placeholder)});
    if(!el)return false;
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Network.clearBrowserCookies');
  await send('Page.navigate', { url: 'http://localhost:8888/#/login' });
  await sleep(3000);
  await fill('请输入手机号', '15893646659');
  await fill('请输入密码', '123456');
  await ev(`document.querySelector('.login-btn').click()`);
  await sleep(4500);

  await send('Page.navigate', { url: 'http://localhost:8888/#/imgRecord' });
  await sleep(3500);
  const img = await ev(`(()=>{
    const imgs=[...document.querySelectorAll('.el-image img')];
    return imgs.slice(0,10).map(i=>({src:i.currentSrc||i.src,ok:i.complete&&i.naturalWidth>0,w:i.naturalWidth,h:i.naturalHeight}));
  })()`);
  console.log('IMG', JSON.stringify(img, null, 2));
  await shot('media-img-record');

  await send('Page.navigate', { url: 'http://localhost:8888/#/videoRecord' });
  await sleep(3500);
  const vids = await ev(`(()=>{
    const vs=[...document.querySelectorAll('video')];
    return vs.slice(0,10).map(v=>({src:v.currentSrc||v.querySelector('source')?.src,ready:v.readyState,err:v.error&&v.error.code,duration:v.duration}));
  })()`);
  console.log('VID', JSON.stringify(vids, null, 2));
  await shot('media-video-record');
  ws.close();
})().catch((e) => { console.error(e); process.exit(1); });
