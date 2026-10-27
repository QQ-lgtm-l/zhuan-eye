<template>
	<div class="system-predict-container layout-padding" id="id" v-loading="state.loading">
		<div class="system-predict-padding layout-padding-auto layout-padding-view">
			<div class="carousel">
				<div class="section-title"><i></i><span>安全隐患检测</span></div>
			</div>
			<div class="header">
				<div class="weight">
					<el-select v-model="weight" placeholder="请选择识别模型" size="large" style="width: 220px" filterable teleported>
						<el-option v-for="item in state.weight_items" :key="item.value" :label="item.label"
							:value="item.value" />
					</el-select>
				</div>
				<div class="conf" style="margin-left: 20px;display: flex; flex-direction: row;">
					<div
						style="font-size: 14px;margin-right: 20px;display: flex;justify-content: start;align-items: center;color: #1E88E5;">
						设置最小置信度阈值</div>
					<el-slider v-model="conf" :format-tooltip="formatTooltip" style="width: 300px;" />
				</div>
				<div class="button-section" style="margin-left: 20px">
					<el-button type="primary" @click="upData" class="predict-button">开始预测</el-button>
				</div>
				<div class="button-section" style="margin-left: 20px">
					<el-button type="primary" @click="() => htmlToPDF('id', '安全检测报告')"
						class="predict-button">PDF导出</el-button>
				</div>
			</div>
			<div style="width: 100%; display: flex; flex-direction: row; gap: 15px; margin-bottom: 20px; margin-top: 15px; align-items: stretch;">
			<el-card shadow="hover" class="card">
				<el-upload v-model="state.img" ref="uploadFile" class="avatar-uploader"
					action="/api/files/upload" :show-file-list="false"
					:on-success="handleAvatarSuccessone">
					<div class="avatar-uploader-icon-wrapper" v-if="!imageUrl">
						<el-icon class="avatar-uploader-icon">
							<Plus />
						</el-icon>
						<div class="upload-tip">点击或拖拽上传图片</div>
					</div>
					<img v-else :src="imageUrl" class="avatar" />
				</el-upload>
			</el-card>
			<el-card class="result-section" v-if="state.predictionResult.label">
					<div class="bottom">
						<div class="result-content">
							<el-card shadow="never" class="info-card">
								<div class="info-item">
									<div class="info-label">
										<el-icon class="icon"><Select /></el-icon>
										<span>识别结果</span>
									</div>
									<div class="info-value highlight">
										<template v-if="Array.isArray(state.predictionResult.label) && state.predictionResult.label.length > 1">
											<div v-for="(lbl, idx) in state.predictionResult.label" :key="idx" style="margin-bottom: 4px;">
												<el-tag type="danger" size="small">{{ lbl }}</el-tag>
												<span style="margin-left: 8px; color: #E6A23C; font-size: 13px;">置信度: {{ state.predictionResult.confidence[idx] }}</span>
											</div>
										</template>
										<template v-else>
											{{ Array.isArray(state.predictionResult.label) ? state.predictionResult.label.join('、') : state.predictionResult.label || '-' }}
										</template>
									</div>
								</div>
								<div class="info-item">
									<div class="info-label">
										<el-icon class="icon">
											<Opportunity />
										</el-icon>
										<span>总耗时</span>
									</div>
									<div class="info-value">{{ state.predictionResult.allTime ?
										`${state.predictionResult.allTime}` : '-' }}</div>
								</div>
							</el-card>
						</div>
						<el-collapse v-model="state.activeCollapse" class="detail-collapse">
						<el-collapse-item name="detail">
							<template #title>
								<span class="collapse-title">检测详情（所有检测结果，共 {{ state.allDetections.length }} 项）</span>
							</template>
							<div style="width: 100%; max-height: 300px; overflow-y: auto;">
								<el-table :data="state.allDetections" style="width: 100%" height="280" empty-text="暂无检测结果" :row-class-name="({row}) => row.is_hazard ? 'hazard-row' : ''">
									<el-table-column label="类别" align="center" width="120">
										<template #default="scope">
											<el-tag v-if="scope.row.is_hazard" type="danger" size="small">{{ scope.row.hazard_type }}</el-tag>
											<el-tag v-else-if="scope.row.category === 'normal'" type="success" size="small">{{ scope.row.class_name }}</el-tag>
											<el-tag v-else type="info" size="small">{{ scope.row.class_name }}</el-tag>
										</template>
									</el-table-column>
									<el-table-column prop="confidence" label="置信度" align="center" width="80" />
									<el-table-column label="类型" align="center" width="80">
										<template #default="scope">
											<span v-if="scope.row.is_hazard" style="color: #F56C6C; font-weight: bold;">⚠️隐患</span>
											<span v-else-if="scope.row.category === 'normal'" style="color: #67C23A;">✅正常</span>
											<span v-else style="color: #909399;">➖中性</span>
										</template>
									</el-table-column>
									<el-table-column label="来源" align="center" width="90">
										<template #default="scope">
											<el-tag v-if="scope.row.inferred" type="warning" size="small" effect="plain">🔍推断</el-tag>
											<el-tag v-else-if="scope.row.source === 'coco'" type="info" size="small" effect="plain">COCO</el-tag>
											<el-tag v-else type="primary" size="small" effect="plain">主模型</el-tag>
										</template>
									</el-table-column>
									<el-table-column label="检测框" align="center">
										<template #default="scope">
											<div v-if="scope.row.bbox" style="font-size: 11px; color: #909399;">
												[{{ scope.row.bbox.map((n:number) => n.toFixed(0)).join(', ') }}]
											</div>
											<span v-else>-</span>
										</template>
									</el-table-column>
								</el-table>
							</div>
						</el-collapse-item>
					</el-collapse>
					</div>
				</el-card>
			</div>
			<div class="carousel">
				<div class="section-title"><i></i><span>整改建议</span></div>
			</div>
			<div class="suggestion-container">
				<div v-if="state.predictionResult.suggestion" class="suggestion-box">
					<div v-html="state.predictionResult.suggestion" class="markdown-body"></div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts" name="personal">
import { reactive, ref, onMounted } from 'vue';
import type { UploadInstance, UploadProps } from 'element-plus';
import { ElMessage } from 'element-plus';
import request from '/@/utils/request';
import { Loading, Plus } from '@element-plus/icons-vue';
import { useUserInfo } from '/@/stores/userInfo';
import { storeToRefs } from 'pinia';
import { formatDate } from '/@/utils/formatTime';
import { htmlToPDF } from '/@/utils/pdf';
import { marked } from "marked";
import { SocketService } from '/@/utils/socket';
import { resolveMediaUrl } from '/@/utils/media';

const imageUrl = ref('');
const conf = ref(50);
const weight = ref('');
const uploadFile = ref<UploadInstance>();
const stores = useUserInfo();
const { userInfos } = storeToRefs(stores);
const state = reactive({
	loading: false,
	weight_items: [] as any,
	img: '',
	data: [] as any,
	allDetections: [] as any,
	activeCollapse: ['detail'] as string[],
	predictionResult: {
		label: [] as string[],
		confidence: [] as string[],
		allTime: '',
		suggestion: '' as any
	},
	form: {
		username: '',
		inputImg: null as any,
		weight: '',
		conf: null as any,
		startTime: ''
	},
});

const formatTooltip = (val: number) => {
	return val / 100;
};

const socketService = new SocketService();

socketService.on('message', (data) => {
	console.log('Received message:', data);
	ElMessage({
		message: data,
		type: 'success',
		duration: 3000
	});
});

const handleAvatarSuccessone: UploadProps['onSuccess'] = (response, uploadFile) => {
	imageUrl.value = URL.createObjectURL(uploadFile.raw!);
	state.img = response.data;
};

const getData = () => {
	request.get('/api/flask/file_names').then((res) => {
		if (res.code == 0) {
			res.data = JSON.parse(res.data);
			state.weight_items = res.data.weight_items;
		} else {
			ElMessage.error(res.msg);
		}
	});
};

const transformData = (rawData: any): any => {
	return rawData.label.map((label, index) => ({
		allTime: rawData.allTime,
		confidence: rawData.confidence[index],
		label: label,
	}));
};

const upData = () => {
	state.loading = true;
	state.form.weight = weight.value;
	state.form.conf = parseFloat(conf.value.toString()) / 100,
		state.form.username = userInfos.value.userName;
	state.form.inputImg = state.img;
	state.form.startTime = formatDate(new Date(), 'YYYY-mm-dd HH:MM:SS');
	request.post('/api/flask/predict', state.form).then((res) => {
		if (res.code == 0) {
			try {
				state.loading = false;
				res.data = JSON.parse(res.data);
				// label 和 confidence 现在是数组
				let labels = res.data.label;
				let confidences = res.data.confidence;
				if (typeof labels === 'string') {
					try { labels = JSON.parse(labels); } catch { labels = [labels]; }
				}
				if (typeof confidences === 'string') {
					try { confidences = JSON.parse(confidences); } catch { confidences = [confidences]; }
				}
				if (!Array.isArray(labels)) labels = [labels];
				if (!Array.isArray(confidences)) confidences = [confidences];
				
				state.predictionResult.label = labels;
				state.predictionResult.confidence = confidences;
				state.predictionResult.allTime = res.data.allTime;
				state.predictionResult.suggestion = marked(res.data.suggestion || '');
				state.allDetections = res.data.all_detections || [];
				if (res.data.outImg) {
					imageUrl.value = resolveMediaUrl(res.data.outImg);
				}
			} catch (error) {
				console.error('解析 JSON 时出错:', error);
			}
			ElMessage.success('预测成功！');
		} else {
			state.loading = false;
			ElMessage.error(res.msg);
		}
	});
};

onMounted(() => {
	getData();
});
</script>

<style scoped lang="scss">
.carousel {
	width: 100%;

	.section-title {
		margin-bottom: 50px;
		font-size: 20px;
		text-align: center;
		position: relative;
		padding: 20px 0;
		display: flex;
		justify-content: center;
		justify-items: center;

		i {
			background: #1E88E5; // 蓝色分割线
			height: 1px;
			width: 100%;
			position: absolute;
			top: 40px;
		}

		span {
			background: #1E88E5; // 蓝色标题背景
			line-height: 40px;
			position: absolute;
			width: 120px;
			left: 50%;
			margin-left: -60px;
			color: #fff;
		}
	}
}

.suggestion-container {
	width: 100%;
	margin-bottom: 20px;
	padding: 0 100px;
	display: flex;
	justify-content: center;
}

.suggestion-box {
	width: 100%;
	max-width: 900px;
	padding: 20px 40px;
	border-radius: 10px;
	min-height: 80px;
	max-height: 400px;
	border: 1px solid #90CAF9;
	background: #fff;
	overflow-y: auto;

	&::-webkit-scrollbar {
		width: 8px;
	}

	&::-webkit-scrollbar-thumb {
		background: #90CAF9;
		border-radius: 4px;
	}

	&::-webkit-scrollbar-track {
		background: #E3F2FD;
		border-radius: 4px;
	}
}

.markdown-body {
	line-height: 1.8;
	font-size: 16px;
	color: #333;
	white-space: pre-wrap;
	word-break: break-word;
}

.markdown-body p {
	margin: 10px 0;
}

.markdown-body ul,
.markdown-body ol {
	margin-left: 20px;
	padding-left: 0;
}

.markdown-body li {
	margin: 5px 0;
}

.markdown-body strong {
	color: #1E88E5;
}

.markdown-body pre {
	background: #E3F2FD;
	padding: 15px;
	border-radius: 8px;
	overflow-x: auto;
	margin: 10px 0;
}

.markdown-body code {
	background: #E3F2FD;
	padding: 2px 6px;
	border-radius: 3px;
	font-size: 14px;
}

.system-predict-container {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: auto;

	.system-predict-padding {
		padding: 0 100px;
		overflow-y: auto;

		.el-table {
			flex: 1;
			--el-table-header-bg-color: #90CAF9; // 蓝色表头
			--el-table-row-hover-bg-color: #E3F2FD; // 浅蓝色悬浮
			--el-table-border-color: #90CAF9; // 蓝色边框
		}
	}
}

.header {
	width: 100%;
	height: 5%;
	display: flex;
	justify-content: start;
	align-items: center;
	font-size: 20px;
}

.card {
	flex: 1 1 55%;
	min-width: 0;
	border-radius: 10px;
	display: flex;
	flex-direction: column;
	background: #E3F2FD;
	border: 1px solid #90CAF9;
	:deep(.el-card__body) {
		width: 100%;
		padding: 10px;
		display: flex;
		flex-direction: column;
	}
	:deep(.el-upload) {
		width: 100%;
	}
}

.avatar-uploader {
	width: 100%;
	height: 550px;
	display: flex;
	justify-content: center;
	align-items: center;
}

.avatar-uploader .avatar {
	max-width: 100%;
	max-height: 550px;
	object-fit: contain;
}

.avatar-uploader-icon-wrapper {
	width: 100%;
	height: 550px;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	cursor: pointer;
	border: 2px dashed #90CAF9;
	border-radius: 8px;
	transition: border-color 0.3s;
	box-sizing: border-box;
	&:hover {
		border-color: #1E88E5;
		background: #BBDEFB;
	}
}

.avatar-uploader-icon {
	font-size: 48px;
	color: #64B5F6;
}

.upload-tip {
	margin-top: 12px;
	font-size: 14px;
	color: #909399;
}

.el-icon.avatar-uploader-icon {
	display: flex;
	justify-content: center;
	align-items: center;
}

.button-section {
	display: flex;
	justify-content: center;
}

.detail-collapse {
	margin-top: 16px;
	border: 1px solid #90CAF9;
	border-radius: 8px;
	:deep(.el-collapse-item__header) {
		font-weight: 500;
		color: #1565C0;
		background: #E3F2FD;
		border-bottom: none;
	}
	:deep(.el-collapse-item__content) {
		padding: 10px;
	}
}

.collapse-title {
	font-size: 14px;
	color: #1565C0;
}

.hazard-row {
	--el-table-tr-bg-color: #FFF2F0;
}

.predict-button {
	background: #1E88E5; // 蓝色按钮
	border-color: #1E88E5;
	width: 100%;

	&:hover {
		background: #1565C0; // 稍深的蓝色
		border-color: #1565C0;
	}
}

.result-section {
	flex: 1 1 45%;
	min-width: 0;
	margin-left: 0;
	text-align: center;
	display: flex;
	flex-direction: column;
	border-radius: 6px;
	background: #E3F2FD;
	border: 1px solid #90CAF9;
	:deep(.el-card__body) {
		width: 100%;
		padding: 10px;
	}
}

.bottom {
	width: 100%;
	font-size: 18px;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
}

.result-content {
	width: 100%;
	margin-top: 16px;

	.info-card {
		padding: 20px;
		border-radius: 8px;
		background: #BBDEFB; // 浅蓝色背景
		box-shadow: 0 2px 12px 0 rgba(30, 136, 229, 0.1); // 蓝色阴影
	}

	.info-item {
		margin: 12px 0;
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 8px 0;
		border-bottom: 1px solid #90CAF9; // 蓝色分割线

		&:last-child {
			border-bottom: none;
		}

		.info-label {
			display: flex;
			align-items: center;
			color: #1565C0; // 深蓝色文字
			font-size: 14px;

			.icon {
				margin-right: 8px;
				font-size: 16px;
				color: #1E88E5; // 蓝色图标
			}
		}

		.info-value {
			font-size: 16px;
			font-weight: 500;
			color: #1565C0; // 深蓝色文字
			flex: 1;
			margin-left: 16px;

			&.highlight {
				color: #1E88E5; // 蓝色高亮
				font-weight: 600;
			}

			&.accent {
				color: #64B5F6; // 浅蓝色
			}

			&::-webkit-scrollbar {
				width: 6px;
			}

			&::-webkit-scrollbar-thumb {
				background: #90CAF9; // 蓝色滚动条
				border-radius: 4px;
			}

			&::-webkit-scrollbar-track {
				background: #E3F2FD; // 浅蓝色轨道
				border-radius: 4px;
			}
		}
	}
}

:deep(.el-slider__bar) {
	background-color: #1E88E5; // 滑块进度条
}

:deep(.el-slider__button) {
	border-color: #1E88E5; // 滑块按钮
}
</style>