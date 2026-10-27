<template>
	<div class="personal-container layout-pd">
		<el-row :gutter="15">
			<!-- 左侧：头像与身份 -->
			<el-col :xs="24" :sm="24" :md="8" :lg="7" :xl="7">
				<div class="profile-card">
					<div class="profile-bg"></div>
					<el-upload
						ref="uploadFile"
						class="avatar-uploader"
						:action="uploadAction"
						:show-file-list="false"
						:before-upload="beforeAvatarUpload"
						:on-success="handleAvatarSuccess"
						:on-error="handleAvatarError"
						accept="image/png,image/jpeg,image/webp"
					>
						<div class="avatar-box">
							<img :src="imageUrl || resolveAvatar(null, state.form.name, state.form.username)" class="avatar-img" @error="onImageError" />
							<div class="avatar-mask">
								<el-icon><Camera /></el-icon>
								<span>更换头像</span>
							</div>
						</div>
					</el-upload>
					<div class="profile-name">{{ state.form.name || state.form.username || '未设置姓名' }}</div>
					<el-tag class="profile-role" effect="dark" round>{{ state.form.role || '未分配角色' }}</el-tag>
					<div class="profile-account">账号：{{ state.form.username || '-' }}</div>
					<div class="profile-divider"></div>
					<div class="profile-meta">
						<div class="meta-item">
							<span>手机</span>
							<b>{{ state.form.tel || '未填写' }}</b>
						</div>
						<div class="meta-item">
							<span>性别</span>
							<b>{{ state.form.sex || '未填写' }}</b>
						</div>
						<div class="meta-item">
							<span>创建时间</span>
							<b>{{ formatTime(state.form.time) }}</b>
						</div>
					</div>
					<div class="profile-tip">头像支持 JPG / PNG / WEBP，不超过 2MB</div>
				</div>
			</el-col>

			<!-- 右侧：资料编辑 -->
			<el-col :xs="24" :sm="24" :md="16" :lg="17" :xl="17">
				<div class="form-card">
					<div class="form-card-head">
						<div class="form-card-title"><i></i>个人资料</div>
						<div class="form-card-sub">账号与角色由管理员分配，如需调整请联系系统管理员</div>
					</div>
					<el-form ref="formRef" :model="state.form" :rules="rules" label-width="92px" class="personal-form">
						<el-row :gutter="20">
							<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
								<el-form-item label="账号">
									<el-input v-model="state.form.username" disabled />
								</el-form-item>
							</el-col>
							<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
								<el-form-item label="角色">
									<el-input v-model="state.form.role" disabled />
								</el-form-item>
							</el-col>
							<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
								<el-form-item label="姓名" prop="name">
									<el-input v-model="state.form.name" placeholder="请输入姓名" clearable maxlength="20" />
								</el-form-item>
							</el-col>
							<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
								<el-form-item label="性别">
									<el-select v-model="state.form.sex" placeholder="请选择性别" style="width: 100%" teleported clearable>
										<el-option label="男" value="男" />
										<el-option label="女" value="女" />
									</el-select>
								</el-form-item>
							</el-col>
							<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
								<el-form-item label="手机号码" prop="tel">
									<el-input v-model="state.form.tel" placeholder="请输入手机号码" clearable maxlength="11" />
								</el-form-item>
							</el-col>
							<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
								<el-form-item label="密码" prop="password">
									<el-input
										v-model="state.form.password"
										type="password"
										show-password
										autocomplete="new-password"
										placeholder="留空则不修改密码"
										maxlength="30"
										clearable
									/>
									<div class="field-tip">
										<el-icon><Lock /></el-icon>
										密码不会明文回显；如需修改请输入新密码（6-30 位），不修改请留空
									</div>
								</el-form-item>
							</el-col>
						</el-row>
						<div class="form-actions">
							<el-button @click="resetForm" size="default">重 置</el-button>
							<el-button type="primary" size="default" :loading="state.saving" @click="onSave">保存修改</el-button>
						</div>
					</el-form>
				</div>
			</el-col>
		</el-row>
	</div>
</template>

<script setup lang="ts" name="personal">
import { onMounted, reactive, ref } from 'vue';
import type { FormInstance, UploadInstance, UploadProps } from 'element-plus';
import { ElMessage } from 'element-plus';
import { Camera, Lock } from '@element-plus/icons-vue';
import request from '/@/utils/request';
import { useUserInfo } from '/@/stores/userInfo';
import { storeToRefs } from 'pinia';
import { resolveAvatar } from '/@/utils/avatar';
import { formatDate } from '/@/utils/formatTime';
import mittBus from '/@/utils/mitt';

const imageUrl = ref('');
const uploadFile = ref<UploadInstance>();
const formRef = ref<FormInstance>();
const uploadAction = '/api/files/upload';
const stores = useUserInfo();
const { userInfos } = storeToRefs(stores);

const state = reactive({
	form: {} as any,
	saving: false,
});

const rules = {
	name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
	tel: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }],
	password: [
		{
			validator: (_rule: any, value: string, callback: any) => {
				if (!value) return callback();
				if (!/^(?=.*[A-Za-z])(?=.*\d)\S{6,30}$/.test(value)) {
					return callback(new Error('密码需 6-30 位，且同时包含字母和数字'));
				}
				callback();
			},
			trigger: 'blur',
		},
	],
};

const formatTime = (value: any) => {
	if (!value) return '-';
	try {
		return formatDate(new Date(value), 'YYYY-mm-dd HH:MM:SS');
	} catch {
		return String(value);
	}
};

const beforeAvatarUpload: UploadProps['beforeUpload'] = (file) => {
	const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
	if (!isImage) {
		ElMessage.error('头像仅支持 JPG / PNG / WEBP 格式');
		return false;
	}
	if (file.size / 1024 / 1024 > 2) {
		ElMessage.error('头像大小不能超过 2MB');
		return false;
	}
	return true;
};

const handleAvatarSuccess: UploadProps['onSuccess'] = (response: any) => {
	if (response && (response.code === 0 || response.code === 200)) {
		const url = response.data || response.msg || '';
		state.form.avatar = url;
		imageUrl.value = resolveAvatar(url, state.form.name, state.form.username);
		ElMessage.success('头像上传成功，保存后生效');
	} else {
		ElMessage.error(response?.msg || '头像上传失败');
	}
};
const handleAvatarError = () => ElMessage.error('头像上传失败，请检查后端服务');
const onImageError = () => {
	imageUrl.value = resolveAvatar(null, state.form.name, state.form.username);
};

// 初始化数据
const getTableData = () => {
	request.get('/api/user/' + encodeURIComponent(userInfos.value.userName)).then((res: any) => {
		if (res.code == 0 && res.data) {
			state.form = { ...res.data };
			// 密码不回显
			state.form.password = '';
			imageUrl.value = resolveAvatar(res.data.avatar, res.data.name, res.data.username);
		} else {
			ElMessage.error(res.msg || '获取个人信息失败');
		}
	});
};

const resetForm = () => {
	getTableData();
	nextTickReset();
};
const nextTickReset = () => {
	setTimeout(() => formRef.value?.clearValidate(), 50);
};

const onSave = () => {
	formRef.value?.validate((valid) => {
		if (!valid) return;
		state.saving = true;
		const payload: any = { ...state.form };
		// 未填写密码不提交，避免清空原密码
		if (!payload.password) delete payload.password;
		request
			.post('/api/user/update', payload)
			.then((res: any) => {
				if (res.code == 0) {
					ElMessage.success('修改成功！');
					mittBus.emit('userAvatarUpdated', resolveAvatar(payload.avatar, payload.name, payload.username));
					getTableData();
				} else {
					ElMessage.error(res.msg || '修改失败');
				}
			})
			.catch(() => ElMessage.error('修改失败，请稍后重试'))
			.finally(() => {
				state.saving = false;
			});
	});
};

onMounted(() => {
	getTableData();
});
</script>

<style scoped lang="scss">
.personal-container {
	padding-bottom: 20px !important;
}

/* 左侧资料卡 */
.profile-card {
	position: relative;
	padding: 28px 22px 24px;
	margin-bottom: 15px;
	border-radius: 14px;
	background: #fff;
	border: 1px solid #e3ecf7;
	box-shadow: 0 4px 16px rgba(13, 71, 161, 0.06);
	text-align: center;
	overflow: hidden;
	.profile-bg {
		position: absolute;
		inset: 0 0 auto;
		height: 96px;
		background: linear-gradient(120deg, #0d47a1 0%, #1565c0 55%, #1e88e5 100%);
	}
	.avatar-uploader {
		position: relative;
		z-index: 1;
		display: inline-block;
	}
	.avatar-box {
		position: relative;
		width: 104px;
		height: 104px;
		border-radius: 50%;
		overflow: hidden;
		cursor: pointer;
		border: 4px solid #fff;
		background: #f4f8fd;
		box-shadow: 0 6px 18px rgba(13, 71, 161, 0.18);
		&:hover .avatar-mask {
			opacity: 1;
		}
	}
	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.avatar-mask {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 4px;
		color: #fff;
		font-size: 12px;
		background: rgba(13, 71, 161, 0.62);
		opacity: 0;
		transition: opacity 0.2s ease;
		.el-icon {
			font-size: 20px;
		}
	}
	.profile-name {
		position: relative;
		margin-top: 12px;
		font-size: 18px;
		font-weight: 700;
		color: #22344a;
	}
	.profile-role {
		margin-top: 6px;
		background: linear-gradient(135deg, #0d47a1, #1e88e5);
		border: none;
	}
	.profile-account {
		margin-top: 8px;
		font-size: 13px;
		color: #93a2b5;
	}
	.profile-divider {
		height: 1px;
		margin: 18px 0 14px;
		background: #eef3fa;
	}
	.profile-meta {
		display: flex;
		flex-direction: column;
		gap: 10px;
		text-align: left;
	}
	.meta-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		font-size: 13px;
		span {
			color: #93a2b5;
		}
		b {
			font-weight: 600;
			color: #33475b;
			max-width: 68%;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
	.profile-tip {
		margin-top: 16px;
		font-size: 12px;
		color: #b0bccd;
	}
}

/* 右侧表单卡 */
.form-card {
	padding: 22px 26px 18px;
	margin-bottom: 15px;
	border-radius: 14px;
	background: #fff;
	border: 1px solid #e3ecf7;
	box-shadow: 0 4px 16px rgba(13, 71, 161, 0.06);
	.form-card-head {
		margin-bottom: 22px;
	}
	.form-card-title {
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
	.form-card-sub {
		margin-top: 6px;
		font-size: 12px;
		color: #93a2b5;
	}
	.personal-form {
		max-width: 820px;
	}
	.field-tip {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 4px;
		font-size: 12px;
		line-height: 1.5;
		color: #93a2b5;
	}
	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 8px;
		padding-top: 16px;
		border-top: 1px dashed #e6eef9;
	}
}

@media (max-width: 768px) {
	.profile-card {
		padding: 24px 18px;
	}
	.form-card {
		padding: 18px;
	}
}
</style>
