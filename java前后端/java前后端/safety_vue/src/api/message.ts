import request from '/@/utils/request';

export interface MessageItem {
	id: number;
	userId: string;
	type: string;
	title: string;
	content: string;
	createTime: string;
	isRead: number;
	workOrderId?: number;
}

/** 消息列表（userId 即登录账号 username） */
export const getMessages = (userId: string): Promise<any> =>
	request.get(`/api/message/${encodeURIComponent(userId)}`);

/** 未读数量 */
export const getUnreadCount = (userId: string): Promise<any> =>
	request.get(`/api/message/${encodeURIComponent(userId)}/unreadCount`);

/** 单条已读 */
export const markMessageRead = (id: number): Promise<any> => request.post(`/api/message/${id}/read`);

/** 全部已读 */
export const markAllMessagesRead = (userId: string): Promise<any> =>
	request.post(`/api/message/${encodeURIComponent(userId)}/readAll`);

/** 软删除单条 */
export const deleteMessage = (id: number): Promise<any> => request.delete(`/api/message/${id}`);

/** 软删除全部 */
export const clearMessages = (userId: string): Promise<any> =>
	request.delete(`/api/message/${encodeURIComponent(userId)}/clear`);
