<template>
	<div class="system-role-dialog-container">
		<el-dialog
			:title="state.dialog.title"
			v-model="state.dialog.isShowDialog"
			width="720px"
			class="user-dialog"
			:close-on-click-modal="false"
			destroy-on-close
		>
			<div class="avatar-section">
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
						<img v-if="imageUrl" :src="imageUrl" class="avatar-img" @error="onImageError" />
						<div v-else class="avatar-empty">
							<el-icon><Plus /></el-icon>
							<span>上传头像</span>
						</div>
						<div class="avatar-mask">
							<el-icon><Camera /></el-icon>
							<span>更换头像</span>
						</div>
					</div>
				</el-upload>
				<div class="avatar-tip">支持 JPG / PNG / WEBP，建议 200×200，不超过 2MB</div>
			</div>

			<el-form ref="roleDialogFormRef" :model="state.form" :rules="rules" size="default" label-width="90px">
				<el-row :gutter="20">
					<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
						<el-form-item label="账号" prop="username">
							<el-input v-model="state.form.username" placeholder="请输入账号" clearable :disabled="state.dialog.title === '修改信息'" />
						</el-form-item>
					</el-col>
					<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
						<el-form-item label="密码" prop="password">
							<el-input
								v-model="state.form.password"
								type="password"
								show-password
								autocomplete="new-password"
								:placeholder="state.dialog.title === '修改信息' ? '留空则不修改' : '请输入密码'"
								clearable
							/>
						</el-form-item>
					</el-col>
					<el-col :xs="24" :sm="12" :md="12" :lg="12" :xl="12">
						<el-form-item label="姓名">
							<el-input v-model="state.form.name" placeholder="请输入姓名" clearable />
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
							<el-input v-model="state.form.tel" placeholder="请输入手机号码" maxlength="11" clearable />
						</el-form-item>
					</el-col>
					<el-col :xs="24" :sm="24" :md="24" :lg="24" :xl="24">
						<el-form-item label="角色">
							<el-select v-model="state.form.role" placeholder="请选择角色" style="width: 100%" teleported filterable>
								<el-option v-for="item in option" :key="item.id" :label="item.label" :value="item.role" />
							</el-select>
						</el-form-item>
					</el-col>
				</el-row>
			</el-form>
			<template #footer>
				<span class="dialog-footer">
					<el-button @click="onCancel" size="default">取 消</el-button>
					<el-button type="primary" @click="onSubmit" size="default" :loading="state.submitting">{{ state.dialog.submitTxt }}</el-button>
				</span>
			</template>
		</el-dialog>
	</div>
</template>

<script setup lang="ts" name="systemRoleDialog">
import { nextTick, reactive, ref } from 'vue';
import type { FormInstance, UploadInstance, UploadProps } from 'element-plus';
import { ElMessage } from 'element-plus';
import { Plus, Camera } from '@element-plus/icons-vue';
import request from '/@/utils/request';
import { resolveAvatar } from '/@/utils/avatar';

// 定义子组件向父组件传值/事件
const emit = defineEmits(['refresh']);

const imageUrl = ref('');
const uploadFile = ref<UploadInstance>();
const roleDialogFormRef = ref<FormInstance>();
// 走 Vite 代理，避免写死 localhost（换机器 / 局域网访问也能上传）
const uploadAction = '/api/files/upload';

const rules = {
	username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
	password: [
		{
			validator: (_rule: any, value: string, callback: any) => {
				if (state.dialog.title !== '修改信息' && !value) return callback(new Error('请输入密码'));
				if (value && !/^(?=.*[A-Za-z])(?=.*\d)\S{6,30}$/.test(value)) {
					return callback(new Error('密码需 6-30 位，且同时包含字母和数字'));
				}
				callback();
			},
			trigger: 'blur',
		},
	],
	tel: [{ pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号码', trigger: 'blur' }],
};

const option = [
	{ id: 1, label: '管理员', role: '管理员' },
	{ id: 2, label: '项目经理', role: '项目经理' },
	{ id: 3, label: '专职安全员', role: '专职安全员' },
	{ id: 4, label: '巡检员', role: '巡检员' },
	{ id: 5, label: '施工班组长', role: '施工班组长' },
	{ id: 6, label: '现场施工人员', role: '现场施工人员' },
];

// 定义变量内容
const state = reactive({
	form: {} as any,
	submitting: false,
	dialog: {
		isShowDialog: false,
		type: '',
		title: '',
		submitTxt: '',
	},
});

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
	if (response && (String(response.code) === '0' || String(response.code) === '200')) {
		const url = response.data || response.msg || '';
		state.form.avatar = url;
		imageUrl.value = resolveAvatar(url, state.form.name, state.form.username);
		ElMessage.success('头像上传成功');
	} else {
		ElMessage.error(response?.msg || '头像上传失败');
	}
};
const handleAvatarError = () => {
	ElMessage.error('头像上传失败，请检查后端服务');
};
const onImageError = () => {
	imageUrl.value = resolveAvatar(null, state.form.name, state.form.username);
};

// 打开弹窗
const openDialog = (type: string, row: RowRoleType) => {
	state.form = { sex: '', role: '', ...(type === 'edit' ? row : {}) } as any;
	// 密码不回显（保密）
	state.form.password = '';
	imageUrl.value = type === 'edit' ? resolveAvatar(state.form.avatar, state.form.name, state.form.username) : '';
	state.dialog.title = type === 'edit' ? '修改信息' : '新增信息';
	state.dialog.submitTxt = type === 'edit' ? '修 改' : '新 增';
	if (type !== 'edit') {
		nextTick(() => uploadFile.value?.clearFiles());
	}
	state.dialog.isShowDialog = true;
};
// 关闭弹窗
const closeDialog = () => {
	state.dialog.isShowDialog = false;
};
// 取消
const onCancel = () => {
	closeDialog();
};
// 提交
const onSubmit = () => {
	roleDialogFormRef.value?.validate((valid) => {
		if (!valid) return;
		state.submitting = true;
		const payload: any = { ...state.form };
		// 未填写密码则不提交该字段，避免把原密码清空
		if (!payload.password) delete payload.password;
		const isEdit = state.dialog.title === '修改信息';
		const req = isEdit ? request.post('/api/user/update', payload) : request.post('/api/user/', payload);
		req
			.then((res: any) => {
				if (res.code == 0) {
					ElMessage.success(isEdit ? '修改成功！' : '添加成功！');
					closeDialog();
					emit('refresh');
				} else {
					ElMessage.error(res.msg || '操作失败');
				}
			})
			.catch(() => ElMessage.error('操作失败，请稍后重试'))
			.finally(() => {
				state.submitting = false;
			});
	});
};

// 暴露变量
defineExpose({
	openDialog,
});
</script>

<style scoped lang="scss">
.avatar-section {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-bottom: 8px;
}

.avatar-uploader {
	:deep(.el-upload) {
		border-radius: 50%;
	}
}

.avatar-box {
	position: relative;
	width: 108px;
	height: 108px;
	border-radius: 50%;
	overflow: hidden;
	cursor: pointer;
	border: 3px solid #e3f2fd;
	background: #f4f8fd;
	box-shadow: 0 4px 14px rgba(13, 71, 161, 0.12);
	transition: box-shadow 0.2s ease;
	&:hover {
		box-shadow: 0 6px 20px rgba(13, 71, 161, 0.22);
		.avatar-mask {
			opacity: 1;
		}
	}
}

.avatar-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.avatar-empty {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4px;
	color: #90a4c0;
	font-size: 12px;
	.el-icon {
		font-size: 24px;
	}
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

.avatar-tip {
	margin-top: 8px;
	font-size: 12px;
	color: #93a2b5;
}

.dialog-footer {
	display: flex;
	justify-content: flex-end;
	gap: 10px;
}
</style>
