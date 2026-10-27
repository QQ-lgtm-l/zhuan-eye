<template>
	<div class="message-page layout-pd">
		<div class="message-head">
			<div class="head-title">
				<i></i>消息中心
				<span class="head-sub">WebSocket 实时推送 · 重大 / 较大 / 一般三级预警</span>
			</div>
			<div class="head-actions">
				<el-radio-group v-model="state.tab" size="default">
					<el-radio-button label="all">全部 {{ state.messages.length }}</el-radio-button>
					<el-radio-button label="unread">未读 {{ unreadCount }}</el-radio-button>
				</el-radio-group>
				<el-button size="default" :disabled="unreadCount === 0" @click="onMarkAll">
					<el-icon><Select /></el-icon>
					全部已读
				</el-button>
				<el-button size="default" type="danger" plain :disabled="!state.messages.length" @click="onClearAll">
					<el-icon><Delete /></el-icon>
					清空
				</el-button>
			</div>
		</div>

		<div class="message-list" v-loading="state.loading">
			<div
				v-for="item in filteredMessages"
				:key="item.id"
				class="message-item"
				:class="[typeClass(item.type), { unread: item.isRead === 0, expanded: !!state.expanded[item.id] }]"
				@click="onOpenMessage(item)"
			>
				<div class="item-icon">
					<el-icon><component :is="typeIcon(item.type)" /></el-icon>
				</div>
				<div class="item-main">
					<div class="item-head">
						<span class="item-title">{{ item.title || '安全消息' }}</span>
						<el-tag v-if="item.isRead === 0" size="small" type="danger" effect="dark" class="unread-tag">未读</el-tag>
						<span class="item-time">{{ item.createTime }}</span>
					</div>
					<div class="item-content" :class="{ clamp: !state.expanded[item.id] }" v-html="formatContent(item.content)"></div>
					<div class="item-foot">
						<span v-if="item.workOrderId" class="item-link">
							<el-icon><Document /></el-icon>
							关联工单 #{{ item.workOrderId }} · 点击查看
						</span>
						<span class="item-actions" @click.stop>
							<el-button v-if="state.expanded[item.id] || needExpand(item.content)" text size="small" @click="toggleExpand(item.id)">
								{{ state.expanded[item.id] ? '收起' : '展开' }}
							</el-button>
							<el-button v-if="item.isRead === 0" text size="small" @click="onRead(item)">标为已读</el-button>
							<el-button text size="small" type="danger" @click="onDelete(item)">删除</el-button>
						</span>
					</div>
				</div>
			</div>

			<div v-if="!state.loading && !filteredMessages.length" class="message-empty">
				<el-icon :size="46"><BellFilled /></el-icon>
				<div class="empty-title">{{ state.tab === 'unread' ? '没有未读消息' : '暂无消息' }}</div>
				<div class="empty-sub">隐患预警、督办提醒会实时推送到这里</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts" name="message">
import { computed, onMounted, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { BellFilled, Delete, Document, Select, WarningFilled, InfoFilled, CircleCheckFilled } from '@element-plus/icons-vue';
import {
	clearMessages,
	deleteMessage,
	getMessages,
	markAllMessagesRead,
	markMessageRead,
	type MessageItem,
} from '/@/api/message';
import { useUserInfo } from '/@/stores/userInfo';
import { storeToRefs } from 'pinia';

const router = useRouter();
const stores = useUserInfo();
const { userInfos } = storeToRefs(stores);

const state = reactive({
	loading: false,
	tab: 'all',
	messages: [] as MessageItem[],
	expanded: {} as Record<number, boolean>,
});

const userId = computed(() => userInfos.value.userName || '');
const unreadCount = computed(() => state.messages.filter((m) => m.isRead === 0).length);
const filteredMessages = computed(() =>
	state.tab === 'unread' ? state.messages.filter((m) => m.isRead === 0) : state.messages
);

const typeClass = (type: string) => {
	if (type === 'warning' || type === 'danger') return 'is-warning';
	if (type === 'success') return 'is-success';
	return 'is-info';
};
const typeIcon = (type: string) => {
	if (type === 'warning' || type === 'danger') return WarningFilled;
	if (type === 'success') return CircleCheckFilled;
	return InfoFilled;
};

const formatContent = (content: string) => {
	if (!content) return '';
	return String(content)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\n/g, '<br/>');
};
const needExpand = (content: string) => (content || '').length > 120;
const toggleExpand = (id: number) => {
	state.expanded[id] = !state.expanded[id];
};

const loadMessages = () => {
	if (!userId.value) {
		state.messages = [];
		return;
	}
	state.loading = true;
	getMessages(userId.value)
		.then((res: any) => {
			if (res.code == 0) {
				state.messages = Array.isArray(res.data) ? res.data : [];
			} else {
				ElMessage.error(res.msg || '获取消息失败');
			}
		})
		.catch(() => ElMessage.error('获取消息失败，请检查后端服务'))
		.finally(() => {
			state.loading = false;
		});
};

const onRead = (item: MessageItem) => {
	if (item.isRead !== 0) return;
	markMessageRead(item.id).then(() => {
		item.isRead = 1;
	});
};

const onOpenMessage = (item: MessageItem) => {
	onRead(item);
	if (item.workOrderId) {
		router.push({ path: '/workOrder', query: { id: String(item.workOrderId) } });
	}
};

const onDelete = (item: MessageItem) => {
	ElMessageBox.confirm('删除后其他用户仍可查看该消息，确定删除吗？', '提示', {
		confirmButtonText: '删除',
		cancelButtonText: '取消',
		type: 'warning',
	})
		.then(() => {
			deleteMessage(item.id).then((res: any) => {
				if (res.code == 0) {
					state.messages = state.messages.filter((m) => m.id !== item.id);
					ElMessage.success('已删除');
				} else {
					ElMessage.error(res.msg || '删除失败');
				}
			});
		})
		.catch(() => {});
};

const onMarkAll = () => {
	if (!userId.value) return;
	markAllMessagesRead(userId.value).then((res: any) => {
		if (res.code == 0) {
			state.messages.forEach((m) => (m.isRead = 1));
			ElMessage.success('已全部标为已读');
		} else {
			ElMessage.error(res.msg || '操作失败');
		}
	});
};

const onClearAll = () => {
	if (!userId.value) return;
	ElMessageBox.confirm('确定清空全部消息吗？（仅删除你自己的消息）', '提示', {
		confirmButtonText: '清空',
		cancelButtonText: '取消',
		type: 'warning',
	})
		.then(() => {
			clearMessages(userId.value).then((res: any) => {
				if (res.code == 0) {
					state.messages = [];
					ElMessage.success('已清空');
				} else {
					ElMessage.error(res.msg || '清空失败');
				}
			});
		})
		.catch(() => {});
};

onMounted(loadMessages);
</script>

<style scoped lang="scss">
.message-page {
	padding-bottom: 20px !important;
}

.message-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 12px;
	padding: 16px 20px;
	margin-bottom: 15px;
	border-radius: 12px;
	background: #fff;
	border: 1px solid #e3ecf7;
	box-shadow: 0 4px 14px rgba(13, 71, 161, 0.06);
	.head-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 16px;
		font-weight: 700;
		color: #0d47a1;
		i {
			width: 4px;
			height: 16px;
			border-radius: 2px;
			background: linear-gradient(180deg, #0d47a1, #42a5f5);
		}
	}
	.head-sub {
		margin-left: 6px;
		font-size: 12px;
		font-weight: 400;
		color: #93a2b5;
	}
	.head-actions {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
	}
}

.message-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
	min-height: 200px;
}

.message-item {
	display: flex;
	gap: 14px;
	padding: 16px 18px;
	border-radius: 12px;
	background: #fff;
	border: 1px solid #e6eef8;
	box-shadow: 0 2px 8px rgba(13, 71, 161, 0.04);
	cursor: pointer;
	transition: all 0.2s ease;
	&:hover {
		border-color: #b9d7f7;
		box-shadow: 0 6px 18px rgba(13, 71, 161, 0.1);
		transform: translateY(-1px);
	}
	&.unread {
		border-left: 4px solid #1e88e5;
		background: linear-gradient(90deg, #f4f9ff 0%, #ffffff 60%);
	}
	.item-icon {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 18px;
	}
	&.is-warning .item-icon {
		color: #c62828;
		background: #ffebee;
	}
	&.is-info .item-icon {
		color: #1565c0;
		background: #e3f2fd;
	}
	&.is-success .item-icon {
		color: #2e7d32;
		background: #e8f5e9;
	}
	.item-main {
		flex: 1;
		min-width: 0;
	}
	.item-head {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.item-title {
		font-size: 15px;
		font-weight: 600;
		color: #22344a;
	}
	.unread-tag {
		transform: scale(0.9);
	}
	.item-time {
		margin-left: auto;
		font-size: 12px;
		color: #a4b1c3;
		white-space: nowrap;
	}
	.item-content {
		margin-top: 8px;
		font-size: 13px;
		line-height: 1.75;
		color: #5b6b80;
		overflow-wrap: anywhere;
		&.clamp {
			display: -webkit-box;
			-webkit-line-clamp: 2;
			-webkit-box-orient: vertical;
			overflow: hidden;
		}
	}
	.item-foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-top: 10px;
	}
	.item-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: #1e88e5;
	}
	.item-actions {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		margin-left: auto;
	}
}

.message-empty {
	padding: 70px 0;
	text-align: center;
	color: #c3cfdd;
	.empty-title {
		margin-top: 12px;
		font-size: 15px;
		font-weight: 600;
		color: #8fa3bf;
	}
	.empty-sub {
		margin-top: 6px;
		font-size: 12px;
		color: #b0bccd;
	}
}

@media (max-width: 768px) {
	.message-head {
		flex-direction: column;
		align-items: flex-start;
	}
	.message-item .item-head {
		flex-wrap: wrap;
	}
	.message-item .item-time {
		margin-left: 0;
	}
}
</style>
