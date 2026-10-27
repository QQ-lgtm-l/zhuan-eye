import request from '/@/utils/request';

export interface KnowledgeCategory {
	key: string;
	name: string;
	desc: string;
	count: number;
}

export interface KnowledgeItem {
	id: string;
	name: string;
	category: string;
	categoryName: string;
	risk: string;
	summary?: string;
	basis?: string;
}

/** 手册统计（总条数 + 分类计数） */
export const getKnowledgeStats = (): Promise<any> => request.get('/api/knowledge/stats');

/** 手册条目列表 */
export const getKnowledgeItems = (params: { category?: string; keyword?: string } = {}): Promise<any> =>
	request.get('/api/knowledge/items', { params });

/** 手册条目详情 */
export const getKnowledgeItem = (id: string): Promise<any> => request.get(`/api/knowledge/item/${id}`);
