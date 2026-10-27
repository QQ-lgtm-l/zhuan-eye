/**
 * 媒体地址归一化（筑安慧眼）
 * 后端返回的图片地址可能写死为 http://127.0.0.1:9999/...，
 * 换机器或局域网访问时会失效；统一改写成走 Vite / Nginx 代理的相对地址。
 */
export function resolveMediaUrl(url?: string | null): string {
	if (!url) return '';
	let value = String(url).trim();
	if (!value) return '';
	// 后端文件服务 9999 -> /api（vite 代理会去掉 /api 前缀），兼容局域网 IP
	value = value.replace(/^https?:\/\/[^/]+:9999/i, '/api');
	// Flask 推理服务 5000 -> /flask
	value = value.replace(/^https?:\/\/(127\.0\.0\.1|localhost):5000/i, '/flask');
	return value;
}

export default { resolveMediaUrl };
