import { resolveMediaUrl } from '/@/utils/media';

/** 系统默认头像（所有人共用），识别到这些地址时改为按人生成不同头像 */
const DEFAULT_PATTERNS = [
	'wpimg.wallstcn.com',
	'f778738c-e4f8-4870-b634-56703b4acafe.gif',
	'data:image/svg+xml',
];

/** 头像渐变配色（按用户名哈希取色，保证同一用户颜色固定） */
const GRADIENTS: Array<[string, string]> = [
	['#0D47A1', '#42A5F5'],
	['#00695C', '#4DB6AC'],
	['#6A1B9A', '#BA68C8'],
	['#EF6C00', '#FFB74D'],
	['#AD1457', '#F06292'],
	['#283593', '#7986CB'],
	['#2E7D32', '#81C784'],
	['#4527A0', '#9575CD'],
	['#00838F', '#4DD0E1'],
	['#C62828', '#EF9A9A'],
];

const hashOf = (value: string) => {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (hash * 31 + value.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
};

export const isDefaultAvatar = (url?: string | null) => {
	if (!url) return true;
	const value = String(url);
	return DEFAULT_PATTERNS.some((pattern) => value.includes(pattern));
};

/** 根据姓名/账号生成不同的 SVG 头像（首字 + 固定渐变色，离线可用） */
export function generateAvatar(name?: string, username?: string): string {
	const seed = `${username || ''}|${name || ''}`;
	const [from, to] = GRADIENTS[hashOf(seed) % GRADIENTS.length];
	const text = (name || username || '?').trim().slice(0, 1).toUpperCase();
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">` +
		`<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
		`<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>` +
		`</linearGradient></defs>` +
		`<rect width="120" height="120" fill="url(#g)"/>` +
		`<text x="60" y="62" font-size="52" font-family="PingFang SC,Microsoft YaHei,sans-serif" ` +
		`fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${text}</text></svg>`;
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 统一头像入口：真实头像走代理地址，默认头像/空值按人生成 */
export function resolveAvatar(url?: string | null, name?: string, username?: string): string {
	if (isDefaultAvatar(url)) return generateAvatar(name, username);
	return resolveMediaUrl(url) || generateAvatar(name, username);
}
