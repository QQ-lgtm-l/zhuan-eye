// M1 Web 回归：登录 -> 首页 -> 用户管理 -> 角色矩阵 -> 工单
// 前提：后端 9999、前端 8888、Edge CDP 9222
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
  const clickText = async (sel, label) => ev(`(()=>{const els=[...document.querySelectorAll(${JSON.stringify(sel)})];const el=els.find(e=>e.textContent.trim().includes(${JSON.stringify(label)}));if(!el)return false;el.click();return true})()`);

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Network.clearBrowserCookies');

  // 1) 登录
  await send('Page.navigate', { url: 'http://localhost:8888/#/login' });
  await sleep(3000);
  const fill = async (placeholder, value) => ev(`(()=>{
    const el=[...document.querySelectorAll('input')].find(e=>e.placeholder===${JSON.stringify(placeholder)});
    if(!el)return false;
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(el,${JSON.stringify(value)});
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
    return true;
  })()`);
  const filledPhone = await fill('请输入手机号', '15893646659');
  const filledPwd = await fill('请输入密码', '123456');
  add('M1-01', '登录页手机号/密码输入', '两个输入框可填', `phone=${filledPhone}, password=${filledPwd}`, filledPhone && filledPwd);
  const clicked = await ev(`(()=>{const b=document.querySelector('.login-btn');if(!b)return false;b.click();return true})()`);
  await sleep(4500);
  const afterLogin = await text();
  const hash = await ev(`location.hash`);
  const loginOk = hash !== '#/login' && (afterLogin.includes('首页') || afterLogin.includes('筑安慧眼'));
  add('M1-02', '管理员登录', '进入首页', `hash=${hash}`, loginOk);
  await shot('web-m1-home');

  // 2) 首页数据
  const homeOk = afterLogin.includes('累计检测记录') && afterLogin.includes('工单风险等级');
  add('M1-03', '首页统计卡/图表渲染', '包含累计检测记录与工单风险等级', homeOk ? '已渲染' : '缺少文案', homeOk);

  // 3) 用户管理列表
  await navHash('/usermanage', 2500);
  const umText = await text();
  const userRoles = await ev(`fetch('/api/user/all').then(r=>r.json()).then(d=>{
    const rows = Array.isArray(d) ? d : (d.data || []);
    return [...new Set(rows.map(u=>u.role))];
  }).catch(()=>[])`);
  const listOk = umText.includes('用户列表') && umText.includes('现场施工人员')
    && userRoles.includes('施工班组长') && userRoles.includes('现场施工人员');
  add('M1-04', '用户管理列表角色数据', '接口返回含施工班组长和现场施工人员', listOk ? `角色=${userRoles.join('、')}` : '角色数据缺失', listOk);
  await shot('web-m1-usermanage');

  // 4) 角色权限矩阵
  const tabClicked = await clickText('.el-tabs__item', '角色权限');
  await sleep(1000);
  const matrixText = await text();
  const roles = ['管理员', '项目经理', '专职安全员', '巡检员', '施工班组长', '现场施工人员'];
  const missing = roles.filter((r) => !matrixText.includes(r));
  add('M1-05', '角色权限矩阵 6 列', '6 个角色列都在', missing.length ? `缺少 ${missing.join('、')}` : '6 个都在', tabClicked && missing.length === 0);
  const headerCount = await ev(`document.querySelectorAll('.el-table__header th').length`);
  add('M1-06', '矩阵表头列数', '7 列（功能+6角色）', `实际 ${headerCount}`, headerCount >= 7);
  await shot('web-m1-role-matrix');

  // 5) 工单台账
  await navHash('/workOrder', 2500);
  const woText = await text();
  const woOk = woText.includes('工单台账') || woText.includes('工单');
  add('M1-07', '工单台账打开', '工单页面有内容', woOk ? '已打开' : '无内容', woOk);
  await shot('web-m1-workorder');

  // 6) 菜单是否有 6 角色相关入口
  const body = await text();
  const menuOk = ['首页', '安全检测', '安全检测记录', '工单台账', '智能问答', '安全知识手册', '消息中心', '用户管理', '个人中心'].every((x) => body.includes(x));
  add('M1-08', '管理员侧边栏完整', '9 个菜单入口', menuOk ? '齐' : '缺菜单', menuOk);

  // 7) 控制台错误（忽略资源加载/WebSocket 断线）
  const realErrors = logs.filter((l) => !/favicon|WebSocket|ws:\/\/|ERR_CONNECTION|Failed to load resource/i.test(l));
  add('M1-09', '控制台无业务异常', '0 条', `${realErrors.length} 条`, realErrors.length === 0);
  if (realErrors.length) console.log(realErrors.slice(0, 10).join('\n'));

  const failed = results.filter((r) => !r.pass);
  console.log('\n=== M1 SUMMARY ===');
  console.log(JSON.stringify({ total: results.length, failed: failed.length, results, logs: realErrors }, null, 2));
  ws.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error('M1 TEST ERROR:', e);
  process.exit(2);
});
