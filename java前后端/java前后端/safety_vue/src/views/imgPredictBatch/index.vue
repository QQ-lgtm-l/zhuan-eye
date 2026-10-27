<template>
    <div class="system-predict-container layout-padding" id="id" v-loading="state.loading">
        <div class="system-predict-padding layout-padding-auto layout-padding-view">
            <div class="carousel">
                <div class="section-title"><i></i><span>批量检测</span></div>
            </div>
            <div class="header">
                <div class="weight">
                    <el-select v-model="weight" placeholder="请选择识别模型" size="large" style="width: 220px" filterable teleported>
                        <el-option v-for="item in state.weight_items" :key="item.value" :label="item.label"
                            :value="item.value" />
                    </el-select>
                </div>
                <div class="button-section">
                    <el-button type="primary" @click="triggerImgFolderUpload" class="predict-button">上传图片文件夹</el-button>
                    <input type="file" ref="imgFolder" style="display: none;" webkitdirectory directory multiple
                        accept="image/*" @change="handleImgFolderChange" />
                </div>
                <div class="conf" style="margin-left: 20px;display: flex; flex-direction: row;">
                    <div
                        style="font-size: 14px;margin-right: 20px;display: flex;justify-content: start;align-items: center;color: #1E88E5;">
                        设置最小置信度阈值</div>
                    <el-slider v-model="conf" :format-tooltip="formatTooltip" style="width: 300px;" :min="0" :max="100" />
                </div>
                <div class="button-section" style="margin-left: 20px">
                    <el-button type="primary" @click="startBatchPredict" class="predict-button"
                        :disabled="!state.form.imgFolder.length">
                        开始预测
                    </el-button>
                </div>
            </div>
            <!-- 预测前显示上传提示 -->
            <div v-if="!state.data.length" style="width: 100%; display: flex; flex-direction: column;">
                <el-card shadow="hover" class="card" style="text-align: center;">
                    <p>请上传待检测图片文件夹，然后点击"开始预测"</p>
                </el-card>
            </div>
            <!-- 预测后显示表格+结果 -->
            <div v-if="state.data.length"
                style="width: 100%; display: flex; flex-direction: row; gap: 15px; margin-bottom: 20px; align-items: stretch;">
                <!-- 左侧：批量结果表格 -->
                <el-card shadow="hover" class="card batch-table-card">
                    <el-table :data="state.data" style="width: 100%" height="550"
                        :row-class-name="({row}) => (row.all_detections || []).some((d:any) => d.is_hazard) ? 'hazard-row' : ''"
                        @row-click="selectResult">
                        <el-table-column prop="index" align="center" label="序号" width="60" />
                        <el-table-column align="center" label="识别结果" min-width="150">
                            <template #default="scope">
                                <template v-if="Array.isArray(scope.row.label) && scope.row.label.length > 1">
                                    <div v-for="(lbl, idx) in scope.row.label" :key="idx" style="margin-bottom: 2px;">
                                        <el-tag type="danger" size="small">{{ lbl }}</el-tag>
                                    </div>
                                </template>
                                <template v-else>
                                    <el-tag v-if="scope.row.label[0] !== '未检测到安全隐患'" type="danger" size="small">{{ scope.row.label[0] }}</el-tag>
                                    <span v-else style="color: #909399; font-size: 13px;">{{ scope.row.label[0] }}</span>
                                </template>
                            </template>
                        </el-table-column>
                        <el-table-column align="center" label="置信度" width="100">
                            <template #default="scope">
                                <span v-if="Array.isArray(scope.row.confidence)" style="color: #E6A23C; font-size: 13px;">
                                    {{ scope.row.confidence.join('、') }}
                                </span>
                                <span v-else>{{ scope.row.confidence }}</span>
                            </template>
                        </el-table-column>
                        <el-table-column prop="allTime" align="center" label="总耗时" width="90" />
                        <el-table-column prop="outImg" label="预测图片" width="120" align="center">
                            <template #default="scope">
                                <img :src="scope.row.outImg" width="120" height="60" style="cursor: pointer;" />
                            </template>
                        </el-table-column>
                        <el-table-column label="操作" align="center" width="80">
                            <template #default="{ $index }">
                                <el-button type="primary" size="small" @click.stop="selectResult($index)"
                                    :disabled="$index == state.selectedIndex">
                                    {{ $index == state.selectedIndex ? '已选' : '选择' }}
                                </el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </el-card>
                <!-- 右侧：选中结果详情（与图像检测一致） -->
                <el-card class="result-section" v-if="state.data.length">
                    <div class="bottom">
                        <div class="result-content">
                            <el-card shadow="hover" class="image-card">
                                <img v-if="outputImageUrl" :src="outputImageUrl" style="width: 100%; max-height: 300px; object-fit: contain;" />
                            </el-card>
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
                                        <el-icon class="icon"><Opportunity /></el-icon>
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
                                    <el-table :data="state.allDetections" style="width: 100%" height="280" empty-text="暂无检测结果"
                                        :row-class-name="({row}) => row.is_hazard ? 'hazard-row' : ''">
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
            <!-- 整改建议（与图像检测一致） -->
            <div v-if="state.data.length" class="carousel">
                <div class="section-title"><i></i><span>整改建议</span></div>
            </div>
            <div v-if="state.data.length" class="suggestion-container">
                <div v-if="state.predictionResult.suggestion" class="suggestion-box">
                    <div v-html="state.predictionResult.suggestion" class="markdown-body"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts" name="personal">
import { reactive, ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import request from '/@/utils/request';
import { Loading, Plus, Select, Opportunity, Clock } from '@element-plus/icons-vue';
import { useUserInfo } from '/@/stores/userInfo';
import { storeToRefs } from 'pinia';
import { SocketService } from '/@/utils/socket';
import { marked } from 'marked';
import JSZip from 'jszip';

const outputImageUrl = ref('');
const imgFolder = ref<HTMLInputElement | null>(null);
const conf = ref(50);
const weight = ref('');
const formatTooltip = (val: number) => {
    return `${val / 100}`;
};
const stores = useUserInfo();
const { userInfos } = storeToRefs(stores);
const state = reactive({
    loading: false,
    weight_items: [] as any,
    data: [] as any[],
    selectedIndex: 0,
    allDetections: [] as any,
    activeCollapse: ['detail'] as string[],
    predictionResult: {
        label: '' as any,
        confidence: '' as any,
        allTime: '',
        suggestion: '' as any,
        startTime: '',
    },
    form: {
        username: '',
        imgFolder: [] as File[],
        imgFolderUrl: '',
    },
});

// 上传文件夹触发
const triggerImgFolderUpload = () => {
    if (imgFolder.value) {
        imgFolder.value.click();
    }
};

// 处理文件夹选择
const handleImgFolderChange = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    if (target.files) {
        state.form.imgFolder = Array.from(target.files).filter(file => file.type.startsWith('image/'));
        state.form.imgFolderUrl = await uploadFolderToBackend(state.form.imgFolder, 'img');
        ElMessage.success(`已上传待检测文件夹，包含 ${state.form.imgFolder.length} 张图片`);
    }
};

// 上传文件夹到后端
const uploadFolderToBackend = async (files: File[], type: 'img') => {
    const uploadUrl = '/api/files/uploadFolder';
    const zip = new JSZip();
    const folderName = `${type}${Date.now()}`;

    for (const file of files) {
        zip.file(file.name, file);
    }

    try {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const formData = new FormData();
        formData.append('folder', zipBlob, `${folderName}.zip`);

        const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
        });
        const result = await response.json();

        if (result.code == 0) {
            return result.data;
        } else {
            throw new Error(`上传失败: ${result.msg}`);
        }
    } catch (error) {
        ElMessage.error(`上传图片文件夹失败`);
        return '';
    }
};

// 选择结果
const selectResult = (index: number) => {
    if (typeof index !== 'number') {
        // 来自行点击事件，参数是row对象
        return;
    }
    state.selectedIndex = index;
    const selected = state.data[index];
    state.predictionResult.label = selected.label;
    state.predictionResult.confidence = selected.confidence;
    state.predictionResult.allTime = selected.allTime;
    state.predictionResult.suggestion = marked(selected.Suggestion || '');
    state.predictionResult.startTime = selected.startTime;
    state.allDetections = selected.all_detections || [];
    outputImageUrl.value = selected.outImg;
};

// 开始批量预测
const startBatchPredict = async () => {
    if (!state.form.imgFolder.length) {
        ElMessage.error('请先上传图片文件夹');
        return;
    }

    state.loading = true;
    state.form.username = userInfos.value.userName;

    try {
        const data = {
            username: state.form.username,
            imgFolderUrl: state.form.imgFolderUrl,
            conf: parseFloat(conf.value.toString()) / 100,
            weight: weight.value,
        };

        const res = await request.post('/flask/predictImgBatch', data);

        if (res.code == 0) {
            state.data = res.data.map((item: any, index: number) => ({ ...item, index: index + 1 }));
            for (var i = 0; i < state.data.length; i++) {
                state.data[i].confidence = JSON.parse(state.data[i].confidence);
                state.data[i].label = JSON.parse(state.data[i].label);
            }

            if (state.data.length > 0) {
                // 默认选中第一个结果
                selectResult(0);
                ElMessage.success('批量预测完成！');
            } else {
                ElMessage.warning('预测结果为空！');
            }
        } else {
            ElMessage.error(res.message || '预测失败');
        }
    } catch (error) {
        console.error('批量预测出错:', error);
        ElMessage.error('预测失败，请检查网络或文件格式');
    } finally {
        state.loading = false;
    }
};

const socketService = new SocketService();

socketService.on('message', (data) => {
    console.log('Received message:', data);
    ElMessage({
        message: data,
        type: 'success',
        duration: 3000,
    });
});

onMounted(() => {
    request.get('/api/flask/file_names').then((res) => {
        if (res.code == 0) {
            res.data = JSON.parse(res.data);
            state.weight_items = res.data.weight_items;
        } else {
            ElMessage.error(res.msg);
        }
    });
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
            background: #1E88E5;
            height: 1px;
            width: 100%;
            position: absolute;
            top: 40px;
        }

        span {
            background: #1E88E5;
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
            --el-table-header-bg-color: #90CAF9;
            --el-table-row-hover-bg-color: #E3F2FD;
            --el-table-border-color: #90CAF9;
        }
    }
}

.header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.batch-table-card {
    flex: 1 1 55%;
    min-width: 0;
    border-radius: 10px;
    background: #E3F2FD;
    border: 1px solid #90CAF9;
    :deep(.el-card__body) {
        width: 100%;
        padding: 10px;
    }
}

.card {
    border-radius: 10px;
    display: flex;
    flex-direction: column;
}

.predict-button {
    background: #1E88E5;
    border-color: #1E88E5;
    &:hover {
        background: #1565C0;
        border-color: #1565C0;
    }
}

.result-section {
    flex: 1 1 45%;
    min-width: 0;
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

    .image-card {
        width: 100%;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 12px;
    }

    .info-card {
        padding: 20px;
        border-radius: 8px;
        background: #BBDEFB;
        box-shadow: 0 2px 12px 0 rgba(30, 136, 229, 0.1);
    }

    .info-item {
        margin: 12px 0;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 8px 0;
        border-bottom: 1px solid #90CAF9;

        &:last-child {
            border-bottom: none;
        }

        .info-label {
            display: flex;
            align-items: center;
            color: #1565C0;
            font-size: 14px;

            .icon {
                margin-right: 8px;
                font-size: 16px;
                color: #1E88E5;
            }
        }

        .info-value {
            font-size: 16px;
            font-weight: 500;
            color: #1565C0;
            flex: 1;
            margin-left: 16px;

            &.highlight {
                color: #1E88E5;
                font-weight: 600;
            }

            &.accent {
                color: #64B5F6;
            }
        }
    }
}

.detail-collapse {
    margin-top: 16px;
    border: 1px solid #90CAF9;
    border-radius: 8px;
    width: 100%;
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

.button-section {
    display: flex;
    justify-content: center;
}

:deep(.el-slider__bar) {
    background-color: #1E88E5;
}

:deep(.el-slider__button) {
    border-color: #1E88E5;
}

/* 表格图片 */
.el-table {
    img {
        width: 120px;
        height: 60px;
        object-fit: cover;
        border-radius: 4px;
    }
}
</style>
