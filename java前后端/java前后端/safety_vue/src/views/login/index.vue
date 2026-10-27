<template>
	<div class="login-container">
		<div class="bg-bubbles">
			<li v-for="n in 10" :key="n"></li>
		</div>

		<div class="login-box animate__animated animate__fadeIn">
			<div class="title">
				<h2>筑安慧眼</h2>
				<p>基于视觉驱动多Agent的房建施工现场隐患闭环协同管控系统</p>
			</div>

			<el-form :model="ruleForm" :rules="registerRules" ref="ruleFormRef" @submit.prevent>
				<el-form-item prop="username">
					<el-input
						v-model="ruleForm.username"
						placeholder="请输入用户名"
						prefix-icon="User"
						class="custom-input"
						clearable
						@keyup.enter="submitForm(ruleFormRef)"
					/>
				</el-form-item>

				<el-form-item prop="password">
					<el-input
						v-model="ruleForm.password"
						type="password"
						placeholder="请输入密码"
						prefix-icon="Lock"
						show-password
						class="custom-input"
						@keyup.enter="submitForm(ruleFormRef)"
					/>
				</el-form-item>

				<el-form-item>
					<el-button type="primary" class="login-btn" :loading="loading" @click="submitForm(ruleFormRef)">
						{{ loading ? '登录中...' : '登 录' }}
					</el-button>
				</el-form-item>
			</el-form>

			<div class="options">
				<router-link to="/register">注册账号</router-link>
				<span>|</span>
				<a href="#" @click.prevent="openForgot">忘记密码</a>
			</div>
		</div>

		<!-- 忘记密码：邮箱验证码重置 -->
		<el-dialog v-model="forgotVisible" title="找回密码" width="460px" :close-on-click-modal="false" append-to-body class="forgot-dialog">
			<el-form ref="forgotRef" :model="forgotForm" :rules="forgotRules" label-width="88px">
				<el-form-item label="邮箱" prop="email">
					<el-input v-model="forgotForm.email" placeholder="请输入注册邮箱" prefix-icon="Message" clearable @input="forgotDemoTip = ''" />
				</el-form-item>
				<el-form-item label="验证码" prop="code">
					<div class="code-row">
						<el-input v-model="forgotForm.code" placeholder="6 位验证码" maxlength="6" clearable />
						<el-button :disabled="forgotCountdown > 0 || forgotSending" :loading="forgotSending" @click="sendForgotCode">
							{{ forgotCountdown > 0 ? `${forgotCountdown}s 后重发` : '获取验证码' }}
						</el-button>
					</div>
				</el-form-item>
				<el-form-item v-if="forgotDemoTip">
					<el-alert :title="forgotDemoTip" type="info" :closable="false" show-icon />
				</el-form-item>
				<el-form-item label="新密码" prop="newPassword">
					<el-input v-model="forgotForm.newPassword" type="password" show-password placeholder="6-30 位，需包含字母和数字" />
				</el-form-item>
				<el-form-item label="确认密码" prop="confirm">
					<el-input v-model="forgotForm.confirm" type="password" show-password placeholder="请再次输入新密码" />
				</el-form-item>
			</el-form>
			<template #footer>
				<el-button @click="forgotVisible = false">取 消</el-button>
				<el-button type="primary" :loading="forgotSubmitting" @click="submitForgot">确认重置</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script lang="ts" setup>
import {computed, onBeforeUnmount, reactive, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import type {FormInstance, FormRules} from 'element-plus';
import {ElMessage, ElNotification} from 'element-plus';
import {useI18n} from 'vue-i18n';
import Cookies from 'js-cookie';
import {storeToRefs} from 'pinia';
import {useThemeConfig} from '/@/stores/themeConfig';
import {initFrontEndControlRoutes} from '/@/router/frontEnd';
import {initBackEndControlRoutes} from '/@/router/backEnd';
import {Session} from '/@/utils/storage';
import {formatAxis} from '/@/utils/formatTime';
import {NextLoading} from '/@/utils/loading';
import request from '/@/utils/request';
import {sendEmailCode, resetPasswordByEmail} from '/@/api/emailCode';

// 定义变量内容
const { t } = useI18n();
const storesThemeConfig = useThemeConfig();
const { themeConfig } = storeToRefs(storesThemeConfig);
const route = useRoute();
const router = useRouter();
const formSize = ref('default');
const ruleFormRef = ref<FormInstance>();
const loading = ref(false);

// ---------- 忘记密码 ----------
const forgotVisible = ref(false);
const forgotRef = ref<FormInstance>();
const forgotSending = ref(false);
const forgotDemoTip = ref('');
const forgotSubmitting = ref(false);
const forgotCountdown = ref(0);
let forgotTimer: ReturnType<typeof setInterval> | null = null;
const forgotForm = reactive({ email: '', code: '', newPassword: '', confirm: '' });
const forgotRules = reactive<FormRules>({
	email: [
		{ required: true, message: '请输入邮箱', trigger: 'blur' },
		{ type: 'email', message: '邮箱格式不正确', trigger: 'blur' },
	],
	code: [
		{ required: true, message: '请输入验证码', trigger: 'blur' },
		{ pattern: /^\d{6}$/, message: '验证码为 6 位数字', trigger: 'blur' },
	],
	newPassword: [
		{ required: true, message: '请输入新密码', trigger: 'blur' },
		{ pattern: /^(?=.*[A-Za-z])(?=.*\d)\S{6,30}$/, message: '密码需 6-30 位且包含字母和数字', trigger: 'blur' },
	],
	confirm: [
		{ required: true, message: '请确认新密码', trigger: 'blur' },
		{
			validator: (_rule: any, value: string, callback: any) => {
				if (value !== forgotForm.newPassword) callback(new Error('两次密码不一致'));
				else callback();
			},
			trigger: 'blur',
		},
	],
});

const openForgot = () => {
	forgotForm.email = '';
	forgotForm.code = '';
	forgotForm.newPassword = '';
	forgotForm.confirm = '';
	forgotDemoTip.value = '';
	forgotVisible.value = true;
	setTimeout(() => forgotRef.value?.clearValidate(), 50);
};

const startForgotCountdown = () => {
	forgotCountdown.value = 60;
	if (forgotTimer) clearInterval(forgotTimer);
	forgotTimer = setInterval(() => {
		forgotCountdown.value -= 1;
		if (forgotCountdown.value <= 0 && forgotTimer) {
			clearInterval(forgotTimer);
			forgotTimer = null;
		}
	}, 1000);
};

const sendForgotCode = () => {
	const email = forgotForm.email.trim();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		ElMessage.warning('请先输入正确的邮箱地址');
		return;
	}
	forgotSending.value = true;
	sendEmailCode(email, 'reset')
		.then((res: any) => {
			if (res.code == 0) {
				ElMessage.success(res.data?.message || '验证码已发送');
				if (res.data?.mock && res.data?.code) {
					forgotForm.code = res.data.code;
					forgotDemoTip.value = `演示模式：当前未配置邮箱服务，验证码 ${res.data.code} 已自动填入（生产环境会发送到用户邮箱）`;
				} else {
					forgotDemoTip.value = '';
					ElMessage.success('验证码已发送到邮箱，请查收');
				}
				startForgotCountdown();
			} else {
				ElMessage.error(res.msg || '验证码发送失败');
			}
		})
		.catch(() => ElMessage.error('验证码发送失败，请检查后端服务'))
		.finally(() => {
			forgotSending.value = false;
		});
};

const submitForgot = () => {
	forgotRef.value?.validate((valid) => {
		if (!valid) return;
		forgotSubmitting.value = true;
		resetPasswordByEmail(forgotForm.email.trim(), forgotForm.code.trim(), forgotForm.newPassword)
			.then((res: any) => {
				if (res.code == 0) {
					ElMessage.success(res.msg || '密码重置成功，请使用新密码登录');
					forgotVisible.value = false;
					ruleForm.username = forgotForm.email;
				} else {
					ElMessage.error(res.msg || '重置失败');
				}
			})
			.catch(() => ElMessage.error('重置失败，请检查后端服务'))
			.finally(() => {
				forgotSubmitting.value = false;
			});
	});
};

onBeforeUnmount(() => {
	if (forgotTimer) clearInterval(forgotTimer);
});

const ruleForm = reactive({
	username: '',
	password: '',
});

// 从注册页带过来的账号，自动填入
if (route.query.u) {
	ruleForm.username = String(route.query.u);
}

const registerRules = reactive<FormRules>({
	username: [
		{ required: true, message: '请输入账号', trigger: 'blur' },
		{ min: 3, max: 20, message: '长度在3-20个字符', trigger: 'blur' },
	],
	password: [
		{ required: true, message: '请输入密码', trigger: 'blur' },
		{ min: 6, max: 30, message: '长度在6-30个字符', trigger: 'blur' },
	],
});

const currentTime = computed(() => {
	return formatAxis(new Date());
});

const onSignIn = async () => {
	Session.set('token', Math.random().toString(36).substr(0));
	Cookies.set('userName', ruleForm.username);
	if (!themeConfig.value.isRequestRoutes) {
		const isNoPower = await initFrontEndControlRoutes();
		signInSuccess(isNoPower);
	} else {
		const isNoPower = await initBackEndControlRoutes();
		signInSuccess(isNoPower);
	}
};

const signInSuccess = (isNoPower: boolean | undefined) => {
	if (isNoPower) {
		ElMessage.warning('抱歉，您没有登录权限');
		Session.clear();
	} else {
		// 连接Spring Boot WebSocket接收实时消息
		import('/@/utils/springWs').then(({ springWsService }) => {
			const userName = Cookies.get('userName');
			if (userName) {
				springWsService.connect(userName);
				springWsService.onMessage((message: any) => {
					ElNotification({
						title: message.title || '安全预警',
						message: message.content || '您有一条新的安全消息',
						type: 'warning',
						duration: 5000,
						showClose: true,
					});
				});
			}
		});

		let currentTimeInfo = currentTime.value;
		if (route.query?.redirect) {
			router.push({
				path: <string>route.query?.redirect,
				query: Object.keys(<string>route.query?.params).length > 0 ? JSON.parse(<string>route.query?.params) : '',
			});
		} else {
			router.push('/');
		}
		const signInText = t('message.signInText');
		ElMessage.success(`${currentTimeInfo}，${signInText}`);
		NextLoading.start();
	}
};

const submitForm = (formEl: FormInstance | undefined) => {
	if (!formEl || loading.value) return;
	ruleForm.username = ruleForm.username.trim();
	formEl.validate((valid) => {
		if (!valid) return;
		loading.value = true;
		request
			.post('/api/user/login', ruleForm)
			.then((res: any) => {
				if (res.code == 0) {
					Cookies.set('role', res.data.role);
					onSignIn();
				} else {
					ElMessage({
						type: 'error',
						message: res.msg || '登录失败，请检查账号密码',
					});
				}
			})
			.catch(() => {
				ElMessage.error('登录失败，请检查网络或后端服务');
			})
			.finally(() => {
				loading.value = false;
			});
	});
};
</script>

<style scoped>
.login-container {
	min-height: 100vh;
	height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #0D47A1 0%, #1E88E5 50%, #42A5F5 100%);
	padding: 20px;
	overflow-y: auto;
}

.title {
	text-align: center;
	margin-bottom: 35px;
}

.title h2 {
	font-size: 36px;
	color: #0d47a1;
	margin-bottom: 12px;
	font-weight: 800;
	letter-spacing: 6px;
	text-shadow: 0 2px 4px rgba(13, 71, 161, 0.15), 0 0 20px rgba(30, 136, 229, 0.12);
}

.title p {
	font-size: 15px;
	color: #5b6b80;
	letter-spacing: 2px;
	font-weight: 500;
	text-shadow: none;
	opacity: 1;
}

.role-select {
	width: 100%;
}

:deep(.role-select .el-input__wrapper) {
	padding: 4px 15px;
}

:deep(.custom-input .el-input__wrapper) {
	box-shadow: 0 2px 8px rgba(30, 136, 229, 0.15); /* 蓝色阴影 */
	border-radius: 8px;
	padding: 12px 15px;
	background: rgba(255, 255, 255, 0.9); /* 白色背景 */
}

:deep(.custom-input .el-input__wrapper:hover) {
	box-shadow: 0 2px 12px rgba(30, 136, 229, 0.25);
}

:deep(.custom-input .el-input__wrapper.is-focus) {
	box-shadow: 0 0 0 2px #1E88E5; /* 深蓝色焦点边框 */
	background: #FFFFFF;
}

:deep(.custom-input .el-input__prefix .el-icon) {
	color: #1E88E5; /* 深蓝色图标 */
}

:deep(.custom-input .el-input__inner) {
	color: #303133; /* 深色文字 */
	font-size: 15px;
}

:deep(.custom-input .el-input__wrapper) ::placeholder {
	color: #909399; /* 灰色placeholder */
	font-size: 14px;
}

.login-btn {
	width: 100%;
	padding: 12px 0;
	font-size: 16px;
	font-weight: 500;
	letter-spacing: 1px;
	border-radius: 8px;
	background: linear-gradient(135deg, #1E88E5 0%, #1565C0 100%); /* 深蓝色渐变按钮 */
	border: none;
	margin-top: 10px;
	transition: transform 0.3s ease;
	color: #FFFFFF;
}

.login-btn:hover {
	transform: translateY(-2px);
	background: linear-gradient(135deg, #1976D2 0%, #0D47A1 100%); /* 稍深蓝色 */
	opacity: 0.9;
}

.options {
	margin-top: 25px;
	text-align: center;
}

.options a {
	color: #1E88E5; /* 深蓝色链接 */
	text-decoration: none;
	font-size: 15px;
	transition: all 0.3s ease;
	font-weight: 500;
}

.options span {
	color: #979595; /* 灰色分隔符，提高对比度 */
	margin: 0 15px;
}

.options a:hover {
	color: #42A5F5; /* 浅蓝色悬浮 */
	text-decoration: underline;
}

/* 矮屏时顶部对齐，避免卡片被裁切 */
@media (max-height: 720px) {
	.login-container {
		align-items: flex-start;
	}
	.login-box {
		margin-top: 8px;
	}
}

/* 响应式适配 */
@media (max-width: 768px) {
	.login-box {
		width: 90%;
		padding: 30px 20px;
	}

	.title h2 {
		font-size: 24px;
	}

	.title p {
		font-size: 14px;
	}
}

/* 添加背景气泡动画 */
.bg-bubbles {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	overflow: hidden;
}

.bg-bubbles li {
	position: absolute;
	list-style: none;
	display: block;
	width: 40px;
	height: 40px;
	background-color: rgba(255, 255, 255, 0.1); /* 白色半透明气泡 */
	bottom: -160px;
	animation: square 25s infinite;
	transition-timing-function: linear;
}

.bg-bubbles li:nth-child(1) {
	left: 10%;
	width: 80px;
	height: 80px;
	animation-delay: 0s;
}

.bg-bubbles li:nth-child(2) {
	left: 20%;
	width: 90px;
	height: 90px;
	animation-delay: 2s;
	animation-duration: 17s;
}

.bg-bubbles li:nth-child(3) {
	left: 25%;
	animation-delay: 4s;
}

.bg-bubbles li:nth-child(4) {
	left: 40%;
	width: 60px;
	height: 60px;
	animation-duration: 22s;
}

.bg-bubbles li:nth-child(5) {
	left: 70%;
	width: 120px;
	height: 120px;
}

.bg-bubbles li:nth-child(6) {
	left: 80%;
	width: 90px;
	height: 90px;
	animation-delay: 3s;
}

.bg-bubbles li:nth-child(7) {
	left: 32%;
	width: 60px;
	height: 60px;
	animation-delay: 7s;
}

.bg-bubbles li:nth-child(8) {
	left: 55%;
	width: 20px;
	height: 20px;
	animation-delay: 15s;
	animation-duration: 40s;
}

.bg-bubbles li:nth-child(9) {
	left: 25%;
	width: 10px;
	height: 10px;
	animation-delay: 2s;
	animation-duration: 40s;
}

.bg-bubbles li:nth-child(10) {
	left: 90%;
	width: 160px;
	height: 160px;
	animation-delay: 11s;
}

@keyframes square {
	0% {
		transform: translateY(0) rotate(0deg);
		opacity: 1;
	}
	100% {
		transform: translateY(-1000px) rotate(600deg);
		opacity: 0;
	}
}

.login-box {
	position: relative;
	z-index: 2;
	transform: translateY(20px);
	animation: slideUp 0.8s forwards;
	opacity: 0;
	width: 100%;
	max-width: 480px;
	padding: 40px 40px;
	margin-top: 0;
	background: rgba(255, 255, 255, 0.9);
	border-radius: 16px;
	box-shadow: 0 15px 40px rgba(0, 0, 0, 0.2);
	backdrop-filter: blur(10px);
}

@keyframes slideUp {
	from {
		transform: translateY(20px);
		opacity: 0;
	}
	to {
		transform: translateY(0);
		opacity: 1;
	}
}

/* 修改输入框动画部分 */
:deep(.el-form-item) {
	opacity: 0;
}

:deep(.el-form-item:nth-child(odd)) {
	transform: translateX(-50px);
	animation: slideRightIn 0.5s forwards;
}

:deep(.el-form-item:nth-child(even)) {
	transform: translateX(50px);
	animation: slideLeftIn 0.5s forwards;
}

:deep(.el-form-item:nth-child(1)) {
	animation-delay: 0.2s;
}
:deep(.el-form-item:nth-child(2)) {
	animation-delay: 0.4s;
}
:deep(.el-form-item:nth-child(3)) {
	animation-delay: 0.6s;
}
:deep(.el-form-item:nth-child(4)) {
	animation-delay: 0.8s;
}

@keyframes slideRightIn {
	from {
		transform: translateX(-50px);
		opacity: 0;
	}
	to {
		transform: translateX(0);
		opacity: 1;
	}
}

@keyframes slideLeftIn {
	from {
		transform: translateX(50px);
		opacity: 0;
	}
	to {
		transform: translateX(0);
		opacity: 1;
	}
}

/* 按钮悬浮效果增强 */
.login-btn {
	transition: all 0.3s ease;
}

.login-btn:hover {
	transform: translateY(-3px);
	box-shadow: 0 7px 14px rgba(30, 136, 229, 0.3), 0 3px 6px rgba(30, 136, 229, 0.2); /* 蓝色阴影 */
}

.login-btn:active {
	transform: translateY(-1px);
}

/* 输入框焦点动画 */
:deep(.el-input__wrapper.is-focus) {
	animation: pulse 0.3s ease-in-out;
}

@keyframes pulse {
	0% {
		transform: scale(1);
	}
	50% {
		transform: scale(1.02);
	}
	100% {
		transform: scale(1);
	}
}

/* 忘记密码弹窗（注意：本页 style 为纯 CSS，不要用嵌套写法） */
.code-row {
	display: flex;
	gap: 8px;
	width: 100%;
}
.code-row :deep(.el-input) {
	flex: 1;
	min-width: 0;
}
.code-row :deep(.el-button) {
	width: 122px;
	flex-shrink: 0;
}
</style>