<template>
	<div class="chat-page">
		<div class="chat-shell">
			<!-- 顶部 -->
			<div class="chat-head">
				<div class="chat-head-left">
					<div class="chat-logo"><el-icon :size="20"><ChatDotRound /></el-icon></div>
					<div>
						<div class="chat-title">工地安全智能问答</div>
						<div class="chat-sub">房建 22 类隐患 · JGJ 规范依据 · 整改建议</div>
					</div>
				</div>
				<div class="chat-head-right">
					<span class="ai-status" :class="status.mode">
						<i></i>{{ statusLabel }}
						<em v-if="status.mode !== 'local'">{{ status.model }}</em>
					</span>
					<el-button text @click="router.push('/manual')">
						<el-icon><Notebook /></el-icon>
						知识手册
					</el-button>
					<el-button text @click="openSettings">
						<el-icon><Setting /></el-icon>
						模型设置
					</el-button>
					<el-button text :disabled="messages.length <= 1" @click="onClear">
						<el-icon><Delete /></el-icon>
						清空对话
					</el-button>
				</div>
			</div>

			<!-- 消息区 -->
			<div class="chat-body" ref="listRef" @scroll="onScroll">
				<div class="chat-inner">
					<div
						v-for="(msg, index) in messages"
						:key="index"
						class="message-row"
						:class="msg.role === 'user' ? 'is-user' : 'is-assistant'"
					>
						<div class="msg-avatar">
							<el-icon v-if="msg.role === 'user'"><User /></el-icon>
							<el-icon v-else><MagicStick /></el-icon>
						</div>
						<div class="msg-main">
							<div class="msg-meta">
								<span>{{ msg.role === 'user' ? '我' : '安全助手' }}</span>
								<span class="msg-time">{{ msg.time }}</span>
								<el-tag v-if="msg.source" size="small" :type="sourceTagType(msg.source)" class="msg-source">
									{{ sourceLabel(msg.source) }}
								</el-tag>
								<el-button
									v-if="msg.role === 'assistant' && !msg.error"
									class="msg-copy"
									text
									size="small"
									@click="copyMessage(msg.content)"
								>
									复制
								</el-button>
							</div>
							<div class="msg-bubble" :class="{ 'is-error': msg.error }">
								<div class="markdown-body" v-html="renderMarkdown(msg.content)"></div>
								<div v-if="msg.error" class="msg-retry">
									<el-button size="small" type="primary" plain @click="retry">重新提问</el-button>
								</div>
							</div>
						</div>
					</div>

					<!-- 思考中 -->
					<div v-if="loading" class="message-row is-assistant">
						<div class="msg-avatar"><el-icon><MagicStick /></el-icon></div>
						<div class="msg-main">
							<div class="msg-meta"><span>安全助手</span></div>
							<div class="msg-bubble typing">
								<span></span><span></span><span></span>
							</div>
						</div>
					</div>

					<!-- 猜你想问 -->
					<div v-if="messages.length <= 1 && !loading" class="suggest-wrap">
						<div class="suggest-title">猜你想问</div>
						<div class="suggest-list">
							<div v-for="question in suggestedQuestions" :key="question" class="suggest-item" @click="askQuestion(question)">
								<el-icon><ChatLineRound /></el-icon>
								{{ question }}
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- 输入区 -->
			<div class="chat-foot">
				<div class="chat-input">
					<el-input
						v-model="input"
						type="textarea"
						:rows="3"
						:autosize="{ minRows: 3, maxRows: 8 }"
						resize="none"
						placeholder="请输入你的安全问题，例如：高处作业安全带系挂有哪些要求？"
						@keydown="onKeydown"
					/>
					<div class="chat-input-bar">
						<span class="input-hint"><b>Enter</b> 发送 · <b>Shift + Enter</b> 换行</span>
						<el-button type="primary" :loading="loading" :disabled="!input.trim()" @click="send">
							<el-icon v-if="!loading"><Position /></el-icon>
							发送
						</el-button>
					</div>
				</div>
				<div class="chat-tip">回答由大模型生成，规范条文请以现行标准原文及项目专项方案为准。</div>
			</div>
		</div>

		<!-- 模型设置 -->
		<el-dialog
			v-model="settingsVisible"
			title="模型设置"
			width="560px"
			:close-on-click-modal="false"
			append-to-body
			class="ai-settings-dialog"
		>
			<el-form label-width="92px">
				<el-form-item label="模型厂商">
					<el-select v-model="settingsForm.provider" style="width: 100%" @change="onProviderChange">
						<el-option v-for="item in providers" :key="item.id" :label="item.name" :value="item.id">
							<span>{{ item.name }}</span>
							<el-tag
								size="small"
								:type="item.configured ? 'success' : 'info'"
								style="float: right; margin-left: 8px"
							>
								{{ item.configured ? '已配置' : '未配置' }}
							</el-tag>
						</el-option>
					</el-select>
				</el-form-item>
				<el-form-item label="API Key" v-if="settingsForm.provider !== 'local'">
					<el-input
						v-model="settingsForm.apiKey"
						type="password"
						show-password
						clearable
						:placeholder="currentProvider?.configured ? '已通过环境变量配置，可留空' : '请输入 API Key'"
					/>
					<div class="settings-tip">
						留空则读取环境变量 {{ currentProvider?.keyEnv || '—' }}；页面填写的 Key 只存后端内存，重启失效，不会写入代码或数据库。
					</div>
				</el-form-item>
				<el-form-item label="模型名" v-if="settingsForm.provider !== 'local'">
					<el-input v-model="settingsForm.model" placeholder="例如 qwen-plus / deepseek-chat" />
				</el-form-item>
				<el-form-item label="Base URL" v-if="settingsForm.provider !== 'local'">
					<el-input v-model="settingsForm.baseUrl" placeholder="OpenAI 兼容接口地址" />
				</el-form-item>
				<template v-if="settingsForm.provider === 'coze'">
					<el-form-item label="Bot ID">
						<el-input v-model="settingsForm.botId" placeholder="扣子 Bot ID，可留空使用 COZE_BOT_ID" />
					</el-form-item>
					<el-form-item label="User ID">
						<el-input v-model="settingsForm.userId" placeholder="可留空，默认 zhuan-eye-web" />
					</el-form-item>
				</template>
				<el-alert
					type="info"
					:closable="false"
					show-icon
					title="优先级：页面内存配置 > 环境变量 > 内置知识手册；演示结束后可恢复默认。"
				/>
				<div v-if="testResult" class="test-result">{{ testResult }}</div>
			</el-form>
			<template #footer>
				<el-button text type="danger" @click="resetModel">恢复默认</el-button>
				<el-button @click="settingsVisible = false">取 消</el-button>
				<el-button :loading="testing" @click="testModel">保存并测试</el-button>
				<el-button type="primary" :loading="settingsSaving" @click="saveSettings">保 存</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts" name="smartChat">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { marked } from 'marked';
import {
	ChatDotRound,
	ChatLineRound,
	Delete,
	MagicStick,
	Notebook,
	Position,
	Setting,
	User,
} from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';
import { askAi, getAiProviders, getAiStatus, resetAiConfig, saveAiConfig } from '/@/api/aiChat';

interface ChatItem {
	role: 'user' | 'assistant';
	content: string;
	time: string;
	source?: 'coze' | 'online' | 'local';
	error?: boolean;
}

const router = useRouter();
const listRef = ref<HTMLElement>();
const input = ref('');
const loading = ref(false);
const messages = ref<ChatItem[]>([]);
const status = reactive({
	mode: 'local',
	online: false,
	model: '内置房建安全知识手册',
	provider: 'local',
	providerLabel: '',
});

const statusLabel = computed(() => {
	if (status.mode === 'coze') return '扣子智能体';
	if (status.mode === 'online') return status.providerLabel || '在线模型';
	return '知识手册';
});
const sourceLabel = (source?: string) =>
	source === 'coze' ? '扣子智能体' : source === 'online' ? '在线模型' : '知识手册';
const sourceTagType = (source?: string) =>
	source === 'online' ? 'success' : source === 'coze' ? '' : 'info';

// ---------- 模型设置 ----------
const settingsVisible = ref(false);
const settingsSaving = ref(false);
const testing = ref(false);
const testResult = ref('');
const providers = ref<any[]>([]);
const settingsForm = reactive({
	provider: 'local',
	apiKey: '',
	model: '',
	baseUrl: '',
	botId: '',
	userId: '',
});
const currentProvider = computed(() => providers.value.find((item) => item.id === settingsForm.provider));

const applyStatus = (data: any) => {
	if (!data) return;
	status.mode = data.mode || 'local';
	status.online = !!data.online;
	status.model = data.model || status.model;
	status.provider = data.provider || 'local';
	status.providerLabel = data.providerLabel || '';
};

const loadProviders = async () => {
	try {
		const res: any = await getAiProviders();
		if (res.code == 0) providers.value = res.data || [];
	} catch {
		providers.value = [];
	}
};

const fillForm = (provider: any) => {
	settingsForm.provider = provider?.id || 'local';
	settingsForm.model = provider?.model || '';
	settingsForm.baseUrl = provider?.baseUrl || '';
	settingsForm.apiKey = '';
	settingsForm.botId = '';
	settingsForm.userId = '';
};

const openSettings = async () => {
	await loadProviders();
	const active =
		providers.value.find((item) => item.active) ||
		providers.value.find((item) => item.configured) ||
		providers.value[0];
	fillForm(active);
	testResult.value = '';
	settingsVisible.value = true;
};

const onProviderChange = (id: string) => {
	const provider = providers.value.find((item) => item.id === id);
	fillForm(provider);
};

const saveSettings = async () => {
	settingsSaving.value = true;
	try {
		const res: any = await saveAiConfig({ ...settingsForm });
		if (res.code == 0) {
			applyStatus(res.data);
			ElMessage.success('模型配置已保存（仅当前后端进程有效）');
			settingsVisible.value = false;
		} else {
			ElMessage.error(res.msg || '保存失败');
		}
	} catch {
		ElMessage.error('保存失败，请检查后端服务');
	} finally {
		settingsSaving.value = false;
	}
};

const testModel = async () => {
	testing.value = true;
	testResult.value = '';
	try {
		const saved: any = await saveAiConfig({ ...settingsForm });
		if (saved.code != 0) {
			testResult.value = saved.msg || '配置保存失败';
			return;
		}
		applyStatus(saved.data);
		const res: any = await askAi([{ role: 'user', content: '你好，请用一句话介绍你自己' }]);
		if (res.code == 0 && res.data?.content) {
			const source = res.data.source === 'local' ? '内置知识手册' : res.data.provider || res.data.model || '在线模型';
			testResult.value = `测试成功（${source}）：${String(res.data.content).slice(0, 100)}`;
		} else {
			testResult.value = res.msg || '测试失败';
		}
	} catch (error: any) {
		testResult.value = error?.message === 'Network Error' ? '无法连接后端服务' : error?.message || '测试失败';
	} finally {
		testing.value = false;
	}
};

const resetModel = async () => {
	try {
		const res: any = await resetAiConfig();
		if (res.code == 0) {
			applyStatus(res.data);
			settingsForm.apiKey = '';
			ElMessage.success('已恢复为环境变量 / 内置知识手册');
		}
	} catch {
		ElMessage.error('恢复失败');
	}
};

const WELCOME =
	'你好，我是**筑安慧眼**工地安全智能助手 👷\n\n' +
	'我可以帮你：\n' +
	'- 查询房建安全规范条文与判定依据\n' +
	'- 判断隐患风险等级（重大 / 较大 / 一般）\n' +
	'- 生成整改建议、处理方法与预防措施\n\n' +
	'直接输入问题，或点击下方「猜你想问」快速开始。';

const suggestedQuestions = [
	'未佩戴安全帽属于什么风险等级，如何整改？',
	'高处作业安全带系挂有哪些要求？',
	'施工现场临时用电配电箱防护有何规定？',
	'脚手架连墙件缺失怎么处置？',
	'消防通道堵塞的整改与预防措施？',
	'基坑临边防护缺失如何闭环管理？',
];

const now = () => {
	const d = new Date();
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const escapeHtml = (text: string) =>
	String(text || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');

const renderMarkdown = (text: string) => marked.parse(escapeHtml(text)) as string;

const onScroll = () => {
	// 用户上翻阅读历史时不强制拉回底部，滚动逻辑在 ask 完成时判断
};
const scrollToBottom = (smooth = true) => {
	nextTick(() => {
		const el = listRef.value;
		if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
	});
};

const pushAssistant = (content: string, extra: Partial<ChatItem> = {}) => {
	messages.value.push({ role: 'assistant', content, time: now(), ...extra });
};

const buildPayload = () => {
	const list = messages.value.filter((m) => !m.error && m.content.trim());
	// 开场欢迎语只是界面文案，不要发给模型，否则会被当成上下文续写导致响应很慢
	if (list.length && list[0].role === 'assistant' && list[0].content.includes('我是**筑安慧眼**')) {
		list.shift();
	}
	return list
		.slice(-8)
		.map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
};

const ask = async (question: string) => {
	const text = question.trim();
	if (!text || loading.value) return;
	if (input.value.trim() === text) input.value = '';
	messages.value.push({ role: 'user', content: text, time: now() });
	loading.value = true;
	scrollToBottom();
	try {
		const res: any = await askAi(buildPayload());
		if (res && res.code == 0 && res.data && res.data.content) {
			const source: 'coze' | 'online' | 'local' =
				res.data.source === 'coze' ? 'coze' : res.data.source === 'online' ? 'online' : 'local';
			pushAssistant(res.data.content, { source });
			status.mode = source;
			status.online = source !== 'local';
			if (res.data.model) status.model = res.data.model;
			if (typeof res.data.provider === 'string') status.providerLabel = res.data.provider;
			if (res.data.degraded) ElMessage.warning('模型暂不可用，已使用内置知识库回答');
		} else {
			pushAssistant(`**回答失败**：${res?.msg || '服务返回异常，请稍后重试'}`, { error: true });
		}
	} catch (error: any) {
		const detail =
			error?.message === 'Network Error'
				? '网络连接异常，请确认后端服务已启动'
				: error?.response?.data?.msg || error?.message || '请求超时，请稍后重试';
		pushAssistant(`**回答失败**：${detail}`, { error: true });
	} finally {
		loading.value = false;
		scrollToBottom();
	}
};

const send = () => {
	const text = input.value.trim();
	if (!text) return;
	input.value = '';
	ask(text);
};

const askQuestion = (question: string) => ask(question);

const onKeydown = (event: KeyboardEvent) => {
	if (event.key !== 'Enter') return;
	// 中文输入法组合态不触发发送
	if (event.isComposing || (event as any).keyCode === 229) return;
	// Shift + Enter 换行
	if (event.shiftKey) return;
	// Enter 直接发送（Ctrl/Cmd + Enter 同样发送）
	event.preventDefault();
	send();
};

const retry = () => {
	const last = [...messages.value].reverse().find((m) => m.role === 'user');
	if (!last || loading.value) return;
	while (messages.value.length && messages.value[messages.value.length - 1].error) {
		messages.value.pop();
	}
	ask(last.content);
};

const copyMessage = async (content: string) => {
	try {
		await navigator.clipboard.writeText(content);
		ElMessage.success('已复制');
	} catch {
		ElMessage.error('复制失败，请手动选择文本');
	}
};

const onClear = () => {
	ElMessageBox.confirm('确定清空当前对话记录吗？', '提示', {
		confirmButtonText: '清空',
		cancelButtonText: '取消',
		type: 'warning',
	})
		.then(() => {
			messages.value = [];
			initWelcome();
		})
		.catch(() => {});
};

const initWelcome = () => {
	messages.value.push({ role: 'assistant', content: WELCOME, time: now() });
};

onMounted(async () => {
	initWelcome();
	try {
		const res: any = await getAiStatus();
		if (res && res.code == 0 && res.data) {
			applyStatus(res.data);
		}
	} catch {
		status.mode = 'local';
		status.online = false;
	}
});
</script>

<style scoped lang="scss">
.chat-page {
	height: calc(100vh - 51px);
	padding: 0;
	background:
		radial-gradient(1200px 400px at 10% -10%, rgba(30, 136, 229, 0.1), transparent 60%),
		linear-gradient(180deg, #f4f8fd 0%, #eef4fb 100%);
	display: flex;
	justify-content: center;
}

.chat-shell {
	width: 100%;
	max-width: 1080px;
	height: 100%;
	margin: 0 auto;
	padding: 18px 20px 14px;
	display: flex;
	flex-direction: column;
}

/* 顶部 */
.chat-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	padding: 12px 16px;
	border-radius: 12px;
	background: #fff;
	border: 1px solid #e3ecf7;
	box-shadow: 0 4px 14px rgba(13, 71, 161, 0.06);
	.chat-head-left {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.chat-logo {
		width: 40px;
		height: 40px;
		border-radius: 11px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #fff;
		background: linear-gradient(135deg, #0d47a1, #1e88e5);
		box-shadow: 0 4px 10px rgba(13, 71, 161, 0.25);
	}
	.chat-title {
		font-size: 16px;
		font-weight: 700;
		color: #0d47a1;
	}
	.chat-sub {
		margin-top: 2px;
		font-size: 12px;
		color: #93a2b5;
	}
	.chat-head-right {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.ai-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 20px;
		font-size: 12px;
		color: #1565c0;
		background: #e9f2fd;
		border: 1px solid #d6e7fb;
		i {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: #26a69a;
		}
		em {
			font-style: normal;
			color: #7b8ba1;
			max-width: 160px;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		&.local i {
			background: #f9a825;
		}
		&.coze {
			color: #0f766e;
			background: #e6fffb;
			border-color: #b2f5ea;
			i {
				background: #14b8a6;
			}
		}
	}
}

/* 消息区 */
.chat-body {
	flex: 1;
	overflow-y: auto;
	margin: 12px 0;
	padding: 4px 6px 4px 2px;
	scroll-behavior: smooth;
	&::-webkit-scrollbar {
		width: 6px;
	}
	&::-webkit-scrollbar-thumb {
		background: #c5d6ea;
		border-radius: 3px;
	}
}
.chat-inner {
	max-width: 920px;
	margin: 0 auto;
}

.message-row {
	display: flex;
	gap: 10px;
	margin-bottom: 18px;
	&.is-user {
		flex-direction: row-reverse;
		.msg-meta {
			justify-content: flex-end;
		}
		.msg-bubble {
			background: linear-gradient(135deg, #0d47a1, #1976d2);
			color: #fff;
			border: none;
		}
		.msg-avatar {
			background: linear-gradient(135deg, #42a5f5, #90caf9);
		}
	}
}
.msg-avatar {
	width: 34px;
	height: 34px;
	border-radius: 50%;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #fff;
	background: linear-gradient(135deg, #0d47a1, #1e88e5);
	box-shadow: 0 2px 8px rgba(13, 71, 161, 0.2);
}
.msg-main {
	min-width: 0;
	max-width: 78%;
	display: flex;
	flex-direction: column;
}
.msg-meta {
	display: flex;
	align-items: center;
	gap: 8px;
	margin-bottom: 5px;
	font-size: 12px;
	color: #93a2b5;
	.msg-time {
		color: #b3bfcd;
	}
	.msg-source {
		transform: scale(0.92);
	}
	.msg-copy {
		margin-left: auto;
		color: #8fa3bf;
		padding: 0;
		height: auto;
	}
}
.msg-bubble {
	padding: 12px 16px;
	border-radius: 12px;
	background: #fff;
	border: 1px solid #e6eef8;
	box-shadow: 0 2px 10px rgba(13, 71, 161, 0.05);
	line-height: 1.75;
	font-size: 14px;
	color: #2c3e50;
	overflow-wrap: anywhere;
	&.is-error {
		border-color: #ffcdd2;
		background: #fff7f7;
	}
	&.typing {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 14px 18px;
		span {
			width: 7px;
			height: 7px;
			border-radius: 50%;
			background: #90caf9;
			animation: typing 1.2s infinite ease-in-out;
			&:nth-child(2) {
				animation-delay: 0.15s;
			}
			&:nth-child(3) {
				animation-delay: 0.3s;
			}
		}
	}
}
.msg-retry {
	margin-top: 10px;
}
@keyframes typing {
	0%,
	80%,
	100% {
		transform: translateY(0);
		opacity: 0.5;
	}
	40% {
		transform: translateY(-4px);
		opacity: 1;
	}
}

/* 猜你想问 */
.suggest-wrap {
	margin: 6px 0 18px 44px;
	.suggest-title {
		font-size: 13px;
		font-weight: 600;
		color: #5b6b80;
		margin-bottom: 8px;
	}
	.suggest-list {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.suggest-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		border-radius: 20px;
		font-size: 13px;
		color: #1565c0;
		background: #fff;
		border: 1px solid #d9e8fb;
		cursor: pointer;
		transition: all 0.2s ease;
		&:hover {
			color: #fff;
			background: linear-gradient(135deg, #0d47a1, #1e88e5);
			border-color: transparent;
			transform: translateY(-1px);
			box-shadow: 0 6px 14px rgba(13, 71, 161, 0.2);
		}
	}
}

/* 输入区 */
.chat-foot {
	.chat-input {
		padding: 10px 12px 8px;
		border-radius: 12px;
		background: #fff;
		border: 1px solid #e3ecf7;
		box-shadow: 0 4px 14px rgba(13, 71, 161, 0.06);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		&:focus-within {
			border-color: #90caf9;
			box-shadow: 0 6px 18px rgba(13, 71, 161, 0.12);
		}
	}
	:deep(.el-textarea__inner) {
		border: none;
		box-shadow: none !important;
		padding: 2px 4px;
		font-size: 14px;
		line-height: 1.7;
		background: transparent;
	}
	.chat-input-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-top: 6px;
		padding-top: 6px;
		border-top: 1px dashed #eef3fa;
	}
	.input-hint {
		font-size: 12px;
		color: #a4b1c3;
		b {
			color: #7b8ba1;
			font-weight: 600;
		}
	}
	.chat-tip {
		margin-top: 8px;
		text-align: center;
		font-size: 12px;
		color: #a4b1c3;
	}
}

/* Markdown */
.markdown-body {
	:deep(h1),
	:deep(h2),
	:deep(h3) {
		margin: 0.6em 0 0.4em;
		font-size: 15px;
		font-weight: 700;
		color: #0d47a1;
	}
	:deep(h1:first-child),
	:deep(h2:first-child),
	:deep(h3:first-child) {
		margin-top: 0;
	}
	:deep(p) {
		margin: 0.35em 0;
	}
	:deep(ul),
	:deep(ol) {
		margin: 0.35em 0;
		padding-left: 1.3em;
	}
	:deep(li) {
		margin: 0.2em 0;
	}
	:deep(strong) {
		color: #1565c0;
	}
	:deep(blockquote) {
		margin: 0.5em 0;
		padding: 6px 12px;
		border-left: 3px solid #90caf9;
		background: #f4f8fd;
		border-radius: 0 6px 6px 0;
		color: #5b6b80;
	}
	:deep(code) {
		padding: 1px 5px;
		border-radius: 4px;
		font-size: 13px;
		background: #eef4fb;
		color: #c2185b;
	}
	:deep(pre) {
		margin: 0.5em 0;
		padding: 12px;
		border-radius: 8px;
		background: #0f2440;
		overflow-x: auto;
		code {
			background: transparent;
			color: #d6e6ff;
			padding: 0;
		}
	}
	:deep(table) {
		width: 100%;
		margin: 0.5em 0;
		border-collapse: collapse;
		font-size: 13px;
	}
	:deep(th),
	:deep(td) {
		padding: 6px 8px;
		border: 1px solid #e3ecf7;
		text-align: left;
	}
	:deep(th) {
		background: #f4f8fd;
		color: #1565c0;
	}
	:deep(a) {
		color: #1e88e5;
	}
}
.message-row.is-user .markdown-body {
	:deep(h1),
	:deep(h2),
	:deep(h3),
	:deep(strong) {
		color: #fff;
	}
	:deep(blockquote) {
		background: rgba(255, 255, 255, 0.12);
		color: #eaf3ff;
		border-left-color: rgba(255, 255, 255, 0.6);
	}
	:deep(code) {
		background: rgba(255, 255, 255, 0.16);
		color: #fff;
	}
}

@media (max-width: 768px) {
	.chat-page {
		height: calc(100vh - 50px);
	}
	.chat-shell {
		padding: 10px;
	}
	.chat-head .chat-head-right .ai-status em {
		display: none;
	}
	.msg-main {
		max-width: 86%;
	}
	.suggest-wrap {
		margin-left: 0;
	}
}
.settings-tip {
	margin-top: 6px;
	font-size: 12px;
	color: #8a99ab;
	line-height: 1.6;
	white-space: normal;
}
.test-result {
	margin-top: 12px;
	padding: 10px 12px;
	border-radius: 8px;
	background: #f5f9ff;
	color: #1f3b63;
	font-size: 13px;
	line-height: 1.6;
	word-break: break-all;
}
</style>
