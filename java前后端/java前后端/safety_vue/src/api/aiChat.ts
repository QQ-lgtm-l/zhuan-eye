import request from '/@/utils/request';

export type AiRole = 'system' | 'user' | 'assistant';

export interface AiMessage {
	role: AiRole;
	content: string;
}

export interface AiAnswer {
	content: string;
	source: 'coze' | 'online' | 'local';
	model?: string;
	provider?: string;
	degraded?: boolean;
}

export interface AiStatus {
	online: boolean;
	mode: 'coze' | 'online' | 'local';
	model: string;
	provider: string;
	providerLabel?: string;
	configuredProviders?: string[];
	runtimeActive?: boolean;
}

export interface AiProvider {
	id: string;
	name: string;
	baseUrl: string;
	model: string;
	keyEnv: string;
	description: string;
	requiresBot: boolean;
	configured: boolean;
	active: boolean;
}

/** 咨询房建安全问答（后端统一代理在线模型，未配置密钥时返回内置知识库答案） */
export const askAi = (messages: AiMessage[]): Promise<any> => request.post('/api/ai/chat', { messages });

/** 在线模型状态 */
export const getAiStatus = (): Promise<any> => request.get('/api/ai/status');

/** 厂商列表（不返回 Key） */
export const getAiProviders = (): Promise<any> => request.get('/api/ai/providers');

/** 保存模型配置（只存后端内存） */
export const saveAiConfig = (data: {
	provider: string;
	apiKey?: string;
	model?: string;
	baseUrl?: string;
	botId?: string;
	userId?: string;
}): Promise<any> => request.post('/api/ai/config', data);

/** 恢复默认（环境变量 / 知识手册） */
export const resetAiConfig = (): Promise<any> => request.post('/api/ai/reset');
