#!/usr/bin/env node
/*
北京环球度假区互动福利站 - 每日签到
cron: 15 9 * * *

变量名: bjhqbwz        wx_server 中的 openid，多账号用 & 或换行，可 #备注
依赖:   wx_server_url   默认 http://192.168.31.196:8787
        wx_auth         wx_server 鉴权值（必填）
可选:   bjhqbwz_pool    首次签到前的抽奖奖池: ticket1 | ticket2 | hotel | none
                       默认 ticket2，置空/none 关闭自动选池

原脚本: smallfawn/QLScriptPublic wxapp/bjhqbwz.py (2026-08-17)
本文件为 JS 移植，签名/接口/分支逻辑保持一致。
*/
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MINI_APP_ID = 'wx21f6790118783b83';
const BASE_URL = 'https://bmp.app.universalbeijingresort.com';
const PATH_PREFIX = '/2026_ubr_yunyingqiu';
const ACTIVITY_CODE = '2026_UBR_YUNYINGQIU';
const HMAC_USERNAME = 'ubr-bmp';
const HMAC_SECRET = 'aK@AtX5#Ck5x';
const SUCCESS_CODE = 200;
const SESSION_CODES = [401, 403];
const NEED_GOV_CODE = 60002;
const NEED_CERT_CODE = 60003;
const POOL_GATE_HINT = '奖池';

const WX_SERVER_URL = (process.env.wx_server_url || 'http://192.168.31.196:8787').replace(/\/+$/, '');
const WX_AUTH = process.env.wx_auth || '';
const POOL_CHOICE = (process.env.bjhqbwz_pool || 'ticket2').trim().toLowerCase();
const POOL_LABELS = {
  ticket1: '指定日门票5折优惠券',
  ticket2: '门票+环球优速通套餐5折优惠券',
  hotel: '度假区酒店5折优惠券',
};
const POOL_GATE_MSG =
  '本期开启了『连续签到5天抽门票』玩法, 首次签到前需选择一个奖池' +
  '(①指定日门票5折 ②门票+优速通套餐5折 ③酒店5折)。当前未启用自动选池' +
  '(bjhqbwz_pool 为空), 请在小程序「北京环球度假区互动福利站」首页弹窗中' +
  '选定奖池后再运行, 或设置环境变量 bjhqbwz_pool=ticket2 由脚本自动选定。';

const TOKEN_CACHE_PATH = path.join(__dirname, 'bjhqbwz_token_cache.json');
const DEFAULT_UA =
  'Mozilla/5.0 (Linux; Android 13; SM-G9910 Build/TP1A.220624.014) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 ' +
  'MicroMessenger/8.0.49.2600(0x28003137) NetType/WIFI Language/zh_CN ' +
  'miniProgram/' + MINI_APP_ID;

const sleep = ms => new Promise(r => setTimeout(r, ms));

function bjToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function mask(value) {
  if (!value) return '';
  const s = String(value);
  return s.length <= 12 ? s.slice(0, 2) + '***' : s.slice(0, 6) + '***' + s.slice(-4);
}

function readTokenCache() {
  try {
    if (!fs.existsSync(TOKEN_CACHE_PATH)) return {};
    return JSON.parse(fs.readFileSync(TOKEN_CACHE_PATH, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeTokenCache(cache) {
  try {
    fs.writeFileSync(TOKEN_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.log(`⚠️ 写入token缓存失败: ${e.message}`);
  }
}

function getCachedEntity(accountId) {
  return readTokenCache()[accountId] || {};
}

function saveCachedEntity(accountId, entity) {
  const cache = readTokenCache();
  cache[accountId] = {
    token: entity.token,
    id: entity.id,
    uid: entity.uid,
    identity: entity.identity,
    identityCard: entity.identityCard,
    updatedAt: Math.floor(Date.now() / 1000),
  };
  writeTokenCache(cache);
}

function removeCachedEntity(accountId) {
  const cache = readTokenCache();
  if (accountId in cache) {
    delete cache[accountId];
    writeTokenCache(cache);
  }
}

async function getWxCode(accountId) {
  if (!WX_AUTH) throw new Error('缺少 wx_auth, 无法从 wx_server 获取 code');
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    auth: WX_AUTH,
  };
  const body = JSON.stringify({ appid: MINI_APP_ID, openid: accountId });
  let lastMsg = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) {
      try {
        await fetch(`${WX_SERVER_URL}/wx/refresh`, {
          method: 'POST', headers, body, signal: AbortSignal.timeout(30000),
        });
      } catch {}
      await sleep(3000);
    }
    const res = await fetch(`${WX_SERVER_URL}/wx/code`, {
      method: 'POST', headers, body, signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`wx_server HTTP ${res.status}`);
    const data = await res.json();
    if (data && data.status === false) {
      lastMsg = data.message || '获取失败';
      continue;
    }
    const code = data.code || (data.data && data.data.code);
    if (code) return code;
    lastMsg = 'wx_server 未返回 code';
  }
  throw new Error(`wx_server 获取 code 失败(已重试): ${lastMsg}`);
}

function signHeaders(bodyStr, token, userId) {
  const xDate = new Date().toUTCString();
  const digest = 'SHA-256=' + crypto.createHash('sha256').update(bodyStr, 'utf8').digest('base64');
  const signingString = `x-date: ${xDate}\ndigest: ${digest}`;
  const signature = crypto.createHmac('sha1', HMAC_SECRET).update(signingString, 'utf8').digest('base64');

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-date': xDate,
    Digest: digest,
    Authorization:
      `hmac username="${HMAC_USERNAME}", algorithm="hmac-sha1", ` +
      `headers="x-date digest", signature="${signature}"`,
    'User-Agent': DEFAULT_UA,
    Referer: `https://servicewechat.com/${MINI_APP_ID}/0/page-frame.html`,
  };
  if (token !== undefined && token !== null) {
    headers.ArrowAuthorization = token || '';
    headers.userId = String(userId === undefined || userId === null ? '' : userId);
  }
  return headers;
}

async function apiPost(apiPath, body, token, userId) {
  const bodyStr = JSON.stringify(body);
  const headers = signHeaders(bodyStr, token, userId);
  const res = await fetch(`${BASE_URL}${apiPath}`, {
    method: 'POST', headers, body: bodyStr, signal: AbortSignal.timeout(30000),
  });
  if (SESSION_CODES.includes(res.status)) {
    let data = {};
    try { data = await res.json(); } catch {}
    if (!data || typeof data !== 'object') data = {};
    data.code = res.status;
    return data;
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function envelopeEntity(resp) {
  const data = resp && typeof resp === 'object' ? resp.data : null;
  if (data && typeof data === 'object' && data.entity && typeof data.entity === 'object') return data.entity;
  if (resp && typeof resp === 'object' && resp.entity && typeof resp.entity === 'object') return resp.entity;
  return {};
}

function respCode(resp) {
  if (!resp || typeof resp !== 'object') return -1;
  for (const k of ['code', 'status']) {
    if (resp[k] !== undefined && resp[k] !== null) {
      const n = Number(resp[k]);
      if (!Number.isNaN(n)) return n;
    }
  }
  return -1;
}

function isMember(entity) {
  return !!entity && String(entity.id ?? '-1') !== '-1' && !!entity.uid;
}

async function login(accountId) {
  const code = await getWxCode(accountId);
  const body = { code, registerSource: '', activityCode: ACTIVITY_CODE };
  const resp = await apiPost(`${PATH_PREFIX}/ubr/user/login`, body);
  if (respCode(resp) !== SUCCESS_CODE) {
    throw new Error(`登录失败: ${resp.message || resp.msg || JSON.stringify(resp)}`);
  }
  let entity = envelopeEntity(resp);
  if (!entity || String(entity.id ?? '-1') === '-1') {
    entity = { id: '-1', uid: '', identity: 'NONMEMBER' };
  }
  return entity;
}

async function getEntityForAccount(accountId, index, force = false) {
  if (!force) {
    const cached = getCachedEntity(accountId);
    if (cached.token && isMember(cached)) {
      console.log(`账号 ${index} 使用缓存 token: ${mask(cached.token)}`);
      return cached;
    }
  }
  const entity = await login(accountId);
  if (isMember(entity)) {
    saveCachedEntity(accountId, entity);
    console.log(`账号 ${index} code 登录成功: 会员 ${mask(entity.token)}`);
  } else {
    removeCachedEntity(accountId);
    console.log(`账号 ${index} code 登录成功: 未注册会员 (NONMEMBER)`);
  }
  return entity;
}

const activityDetail = (token, userId) =>
  apiPost(`${PATH_PREFIX}/business/activityRecord/detail`,
    { userId, activityCode: ACTIVITY_CODE, prePrizeIds: [] }, token, userId);

const signInRecord = (token, userId, month) =>
  apiPost(`${PATH_PREFIX}/business/yunyingqiu/signInRecord`,
    { userId, activityCode: ACTIVITY_CODE, month }, token, userId);

const completeQuest = (token, userId, templateId) =>
  apiPost(`${PATH_PREFIX}/business/activityRecord/completeQuest`,
    { userId, activityCode: ACTIVITY_CODE, questTemplateId: templateId }, token, userId);

const selectSurprise5Pool = (token, userId, prize) =>
  apiPost(`${PATH_PREFIX}/business/surpriseFivePhase/selectedPrize`,
    { selectedPrize: [prize], userId }, token, userId);

function findSignInTemplateId(detailResp) {
  const entity = envelopeEntity(detailResp);
  for (const quest of entity.questList || []) {
    if (quest.templateCode === 'SIGN_IN') return quest.templateId;
  }
  return null;
}

function alreadySignedToday(recordResp) {
  const entity = envelopeEntity(recordResp);
  const today = bjToday();
  for (const info of entity.signInInfos || []) {
    if (info.day === today && info.signIn) return true;
  }
  return false;
}

async function runAccount(accountId, index) {
  const lines = [`【账号 ${index}】`];
  let entity = await getEntityForAccount(accountId, index);

  if (!isMember(entity)) {
    const msg = '该账号尚未注册, 需先在小程序「北京环球度假区互动福利站→签到」完成手机号授权注册后才能签到';
    console.log(`⚠️ 账号 ${index} ${msg}`);
    lines.push(`⚠️ ${msg}`);
    return { text: lines.join('\n'), ok: false };
  }

  let token = entity.token;
  let userId = entity.id;
  if (!token) {
    const msg = '登录未返回会话凭证 (token), 需在小程序内重新登录一次以生成会话后再运行';
    console.log(`⚠️ 账号 ${index} ${msg}`);
    lines.push(`⚠️ ${msg}`);
    return { text: lines.join('\n'), ok: false };
  }

  let detail = await activityDetail(token, userId);
  if (SESSION_CODES.includes(respCode(detail))) {
    console.log(`账号 ${index} 会话失效, 重新登录...`);
    removeCachedEntity(accountId);
    entity = await getEntityForAccount(accountId, index, true);
    token = entity.token;
    userId = entity.id;
    detail = await activityDetail(token, userId);
  }

  const dcode = respCode(detail);
  if ([NEED_GOV_CODE, NEED_CERT_CODE].includes(dcode)) {
    const msg = '需先在小程序内完成实名/身份证信息后才能签到';
    console.log(`⚠️ 账号 ${index} ${msg} (code=${dcode})`);
    lines.push(`⚠️ ${msg}`);
    return { text: lines.join('\n'), ok: false };
  }
  if (dcode !== SUCCESS_CODE) {
    const msg = detail.message || detail.msg || `获取活动详情失败 code=${dcode}`;
    console.log(`❌ 账号 ${index} ${msg}`);
    lines.push(`❌ ${msg}`);
    return { text: lines.join('\n'), ok: false };
  }

  const templateId = findSignInTemplateId(detail);
  if (!templateId) {
    const msg = '未找到签到任务(SIGN_IN), 活动可能已结束';
    console.log(`⚠️ 账号 ${index} ${msg}`);
    lines.push(`⚠️ ${msg}`);
    return { text: lines.join('\n'), ok: false };
  }

  const month = bjToday().slice(0, 7);
  try {
    const record = await signInRecord(token, userId, month);
    if (respCode(record) === SUCCESS_CODE && alreadySignedToday(record)) {
      const msg = '今日已签到, 无需重复';
      console.log(`✅ 账号 ${index} ${msg}`);
      lines.push(`✅ ${msg}`);
      return { text: lines.join('\n'), ok: true };
    }
  } catch (e) {
    console.log(`账号 ${index} 签到记录预检失败(忽略, 继续签到): ${e.message}`);
  }

  let result = await completeQuest(token, userId, templateId);
  let rcode = respCode(result);

  if (rcode !== SUCCESS_CODE && (result.message || result.msg || '').includes(POOL_GATE_HINT)) {
    if (POOL_LABELS[POOL_CHOICE]) {
      const label = POOL_LABELS[POOL_CHOICE];
      console.log(`账号 ${index} 检测到奖池门槛, 按授权自动选定奖池「${label}」...`);
      const sel = await selectSurprise5Pool(token, userId, POOL_CHOICE);
      if (respCode(sel) === SUCCESS_CODE) {
        console.log(`账号 ${index} 奖池已选定「${label}」, 重试签到...`);
        lines.push(`已选定奖池「${label}」`);
        result = await completeQuest(token, userId, templateId);
        rcode = respCode(result);
      } else {
        const smsg = sel.message || sel.msg || `code=${respCode(sel)}`;
        console.log(`⚠️ 账号 ${index} 选择奖池失败: ${smsg}`);
        lines.push(`⚠️ 选择奖池失败(${smsg})。${POOL_GATE_MSG}`);
        return { text: lines.join('\n'), ok: false };
      }
    } else {
      console.log(`⚠️ 账号 ${index} ${POOL_GATE_MSG}`);
      lines.push(`⚠️ ${POOL_GATE_MSG}`);
      return { text: lines.join('\n'), ok: false };
    }
  }

  if ([NEED_GOV_CODE, NEED_CERT_CODE].includes(rcode)) {
    const msg = '需先在小程序内完成实名/身份证信息后才能签到';
    console.log(`⚠️ 账号 ${index} ${msg} (code=${rcode})`);
    lines.push(`⚠️ ${msg}`);
    return { text: lines.join('\n'), ok: false };
  }
  if (rcode !== SUCCESS_CODE) {
    const rawMsg = result.message || result.msg || '';
    if (rawMsg.includes(POOL_GATE_HINT)) {
      console.log(`⚠️ 账号 ${index} ${POOL_GATE_MSG}`);
      lines.push(`⚠️ ${POOL_GATE_MSG}`);
      return { text: lines.join('\n'), ok: false };
    }
    const msg = rawMsg || `签到失败 code=${rcode}`;
    console.log(`❌ 账号 ${index} ${msg}`);
    lines.push(`❌ ${msg}`);
    return { text: lines.join('\n'), ok: false };
  }

  const rentity = envelopeEntity(result);
  const total = rentity.signInTotal;
  const chances = rentity.chanceList || [];
  let msg = '签到成功';
  if (total !== undefined && total !== null) msg += `, 连续签到 ${total} 天`;
  if (chances.length) msg += `, 获得 ${chances.length} 次抽奖机会(请在小程序内手动抽奖)`;
  console.log(`🎉 账号 ${index} ${msg}`);
  lines.push(`🎉 ${msg}`);
  return { text: lines.join('\n'), ok: true };
}

function loadNotify() {
  for (const p of ['../tools/sendNotify', './sendNotify', '/ql/scripts/sendNotify']) {
    try {
      const mod = require(p);
      const fn = typeof mod === 'function' ? mod : mod.sendNotify;
      if (typeof fn === 'function') return fn;
    } catch {}
  }
  return null;
}

(async () => {
  const raw = process.env.bjhqbwz || '';
  const accounts = raw.replace(/&/g, '\n').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  if (!accounts.length) {
    console.log('❌ 未检测到账号信息(环境变量 bjhqbwz), 退出。');
    process.exit(1);
  }
  if (!WX_AUTH) {
    console.log('❌ 未配置 wx_auth, 无法获取 code, 退出。');
    process.exit(1);
  }

  console.log('=============== 北京环球 签到开始 ===============');
  const summaries = [];
  let okCount = 0;

  for (let i = 0; i < accounts.length; i++) {
    const parts = accounts[i].split('#');
    const account = parts[0].trim();
    const remark = parts[1] ? parts[1].trim() : '';
    console.log(`\n-------------- 账号 ${i + 1}${remark ? '/' + remark : ''} --------------`);
    try {
      const { text, ok } = await runAccount(account, i + 1);
      summaries.push(text);
      if (ok) okCount++;
    } catch (e) {
      console.log(`❌ 账号 ${i + 1} 执行异常: ${e.message}`);
      summaries.push(`【账号 ${i + 1}】\n❌ 执行异常: ${e.message}`);
    }
    await sleep(1000);
  }

  console.log('\n=============== 北京环球 签到结束 ===============');
  const title = `北京环球签到 ${okCount}/${accounts.length} 成功`;
  const notify = loadNotify();
  if (notify) {
    try { await notify(title, summaries.join('\n\n')); } catch (e) { console.log(`⚠️ 通知发送失败: ${e.message}`); }
  } else {
    console.log(`\n===== ${title} =====\n${summaries.join('\n\n')}`);
  }
  if (okCount === 0) process.exitCode = 1;
})();
