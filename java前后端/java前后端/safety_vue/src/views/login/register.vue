<template>
	<div class="login-container">
		<div class="bg-bubbles">
			<li v-for="n in 10" :key="n"></li>
		</div>

		<div class="register-box animate__animated animate__fadeIn">
			<div class="title">
				<h2>筑安慧眼</h2>
				<p>注册账号 · 只需姓名、手机号和验证码</p>
			</div>

			<el-form :model="form" :rules="rules" ref="formRef" label-position="top" @submit.prevent>
				<el-form-item prop="name" label="姓名">
					<el-input v-model="form.name" placeholder="请输入真实姓名" prefix-icon="UserFilled" size="large" clearable />
				</el-form-item>

				<el-form-item prop="phone" label="手机号">
					<el-input
						v-model="form.phone"
						placeholder="请输入 11 位手机号"
						prefix-icon="Phone"
						size="large"
						maxlength="11"
						clearable
						@input="onPhoneInput"
					/>
				</el-form-item>

				<el-form-item prop="code" label="验证码">
					<div class="code-row">
						<el-input
							v-model="form.code"
							placeholder="6 位验证码"
							prefix-icon="Key"
							size="large"
							maxlength="6"
							clearable
						/>
						<el-button
							class="code-btn"
							type="primary"
							plain
							size="large"
							:disabled="countdown > 0 || sending"
							:loading="sending"
							@click="sendCode"
						>
							{{ countdown > 0 ? `${countdown}s 后重发` : '获取验证码' }}
						</el-button>
					</div>
				</el-form-item>

				<el-form-item prop="role" label="职位">
					<el-select v-model="form.role" placeholder="请选择职位" size="large" style="width: 100%" teleported>
						<el-option v-for="item in roleOptions" :key="item" :label="item" :value="item" />
					</el-select>
				</el-form-item>

				<el-alert
					v-if="demoTip"
					:title="demoTip"
					type="info"
					:closable="false"
					show-icon
					class="demo-tip"
				/>

				<el-button type="primary" size="large" class="submit-btn" :loading="submitting" @click="submit">
					注 册
				</el-button>

				<div class="login-link">
					已有账号？
					<el-link type="primary" :underline="false" @click="router.push('/login')">去登录</el-link>
				</div>
				<p class="hint">账号自动取姓名全拼；初始密码统一为 123456，登录后请及时在个人中心修改。</p>
			</el-form>
		</div>

		<el-dialog
			v-model="successVisible"
			title="注册成功"
			width="420px"
			:close-on-click-modal="false"
			append-to-body
		>
			<div class="success-body">
				<p>账 号：<b>{{ result.username }}</b></p>
				<p>初始密码：<b>{{ result.password }}</b></p>
				<p class="success-tip">请使用账号和初始密码登录，登录后建议在个人中心修改密码。</p>
			</div>
			<template #footer>
				<el-button type="primary" @click="goLogin">去登录</el-button>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts" name="register">
import { onBeforeUnmount, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { quickRegister, sendPhoneCode } from '/@/api/quickRegister';

const router = useRouter();
const formRef = ref<FormInstance>();
const roleOptions = ['项目经理', '专职安全员', '巡检员', '施工班组长', '现场施工人员'];
const form = reactive({ name: '', phone: '', code: '', role: '现场施工人员' });
const sending = ref(false);
const submitting = ref(false);
const countdown = ref(0);
const demoTip = ref('');
const successVisible = ref(false);
const result = reactive({ username: '', password: '' });
let timer: any = null;

const rules: FormRules = {
	name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
	phone: [
		{ required: true, message: '请输入手机号', trigger: 'blur' },
		{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确', trigger: 'blur' },
	],
	code: [
		{ required: true, message: '请输入验证码', trigger: 'blur' },
		{ len: 6, message: '验证码为 6 位', trigger: 'blur' },
	],
	role: [{ required: true, message: '请选择职位', trigger: 'change' }],
};

const onPhoneInput = () => {
	// 手机号改动后，旧验证码作废，提示重新获取
	demoTip.value = '';
};

const startCountdown = () => {
	countdown.value = 60;
	if (timer) clearInterval(timer);
	timer = setInterval(() => {
		countdown.value--;
		if (countdown.value <= 0) {
			clearInterval(timer);
			timer = null;
		}
	}, 1000);
};

const sendCode = async () => {
	if (countdown.value > 0 || sending.value) return;
	try {
		await formRef.value?.validateField('phone');
	} catch {
		return;
	}
	sending.value = true;
	try {
		const res: any = await sendPhoneCode(form.phone);
		if (res.code == 0) {
			form.code = res.data.code;
			demoTip.value = res.data.message || `演示模式：验证码 ${res.data.code} 已自动填入`;
			startCountdown();
		} else {
			ElMessage.error(res.msg || '验证码发送失败');
		}
	} catch {
		ElMessage.error('验证码发送失败，请检查后端服务');
	} finally {
		sending.value = false;
	}
};

const submit = async () => {
	try {
		await formRef.value?.validate();
	} catch {
		return;
	}
	submitting.value = true;
	try {
		const res: any = await quickRegister({ ...form });
		if (res.code == 0) {
			result.username = res.data.username;
			result.password = res.data.password;
			successVisible.value = true;
		} else {
			ElMessage.error(res.msg || '注册失败');
		}
	} catch {
		ElMessage.error('注册失败，请检查后端服务');
	} finally {
		submitting.value = false;
	}
};

const goLogin = () => {
	successVisible.value = false;
	router.push({ path: '/login', query: { u: result.username, r: form.role } });
};

onBeforeUnmount(() => {
	if (timer) clearInterval(timer);
});
</script>

<style scoped lang="scss">
.login-container {
	position: relative;
	width: 100%;
	min-height: 100vh;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #0d47a1 0%, #1565c0 55%, #1e88e5 100%);
	overflow: hidden;
}
.bg-bubbles {
	position: absolute;
	inset: 0;
	overflow: hidden;
	li {
		position: absolute;
		display: block;
		list-style: none;
		width: 40px;
		height: 40px;
		background: rgba(255, 255, 255, 0.08);
		border-radius: 50%;
		animation: bubble 18s infinite;
		bottom: -120px;
		&:nth-child(1) { left: 8%; width: 70px; height: 70px; animation-delay: 0s; }
		&:nth-child(2) { left: 22%; width: 30px; height: 30px; animation-delay: 3s; }
		&:nth-child(3) { left: 38%; width: 50px; height: 50px; animation-delay: 6s; }
		&:nth-child(4) { left: 52%; width: 36px; height: 36px; animation-delay: 2s; }
		&:nth-child(5) { left: 68%; width: 64px; height: 64px; animation-delay: 8s; }
		&:nth-child(6) { left: 82%; width: 28px; height: 28px; animation-delay: 4s; }
		&:nth-child(7) { left: 92%; width: 48px; height: 48px; animation-delay: 7s; }
		&:nth-child(8) { left: 15%; width: 24px; height: 24px; animation-delay: 10s; }
		&:nth-child(9) { left: 60%; width: 42px; height: 42px; animation-delay: 12s; }
		&:nth-child(10) { left: 75%; width: 32px; height: 32px; animation-delay: 5s; }
	}
}
@keyframes bubble {
	0% { transform: translateY(0) scale(0.8); opacity: 0.5; }
	100% { transform: translateY(-120vh) scale(1.2); opacity: 0; }
}
.register-box {
	position: relative;
	z-index: 2;
	width: 430px;
	max-width: calc(100vw - 32px);
	padding: 34px 36px 24px;
	background: rgba(255, 255, 255, 0.98);
	border-radius: 16px;
	box-shadow: 0 24px 60px rgba(3, 27, 64, 0.35);
}
.title {
	margin-bottom: 22px;
	text-align: center;
	h2 {
		margin: 0;
		font-size: 26px;
		letter-spacing: 4px;
		color: #0d47a1;
	}
	p {
		margin: 8px 0 0;
		font-size: 12px;
		color: #7b8ba3;
	}
}
:deep(.el-form-item__label) {
	font-size: 13px;
	color: #43536b;
	padding-bottom: 4px;
}
.code-row {
	display: flex;
	gap: 10px;
	width: 100%;
	.code-btn {
		flex: 0 0 128px;
	}
}
.demo-tip {
	margin-bottom: 14px;
}
.submit-btn {
	width: 100%;
	height: 44px;
	margin-top: 6px;
	font-size: 16px;
	letter-spacing: 6px;
}
.login-link {
	margin-top: 16px;
	text-align: center;
	font-size: 13px;
	color: #7b8ba3;
}
.hint {
	margin: 12px 0 0;
	font-size: 12px;
	line-height: 1.7;
	color: #93a2b5;
	text-align: center;
}
.success-body {
	p {
		margin: 0 0 10px;
		font-size: 15px;
		color: #33445c;
	}
	b {
		color: #0d47a1;
		font-size: 17px;
		letter-spacing: 1px;
	}
	.success-tip {
		margin-top: 14px;
		font-size: 12px;
		color: #7b8ba3;
	}
}
</style>
