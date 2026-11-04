<template>
  <div class="aerial-page">
    <el-card shadow="never" class="hero-card">
      <div class="hero-copy">
        <div class="eyebrow">无人机巡检 · 独立模块</div>
        <h2>航拍堆料检测</h2>
        <p>只检测“堆料在哪里”，占道、临边由规则和人工确认，不自动生成工单。</p>
      </div>
      <div class="hero-tags">
        <el-tag type="success" effect="plain">pile 单类模型</el-tag>
        <el-tag type="warning" effect="plain">预警，不自动派单</el-tag>
      </div>
    </el-card>

    <div class="grid">
      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">
            <span>上传航拍图</span>
            <el-tag size="small" type="info">JPG / PNG</el-tag>
          </div>
        </template>

        <el-upload
          v-model="state.img"
          class="aerial-upload"
          drag
          action="/api/files/upload"
          :show-file-list="false"
          :on-success="onUpload"
          :before-upload="beforeUpload"
        >
          <div v-if="!previewUrl" class="upload-empty">
            <el-icon class="upload-icon"><UploadFilled /></el-icon>
            <div class="upload-title">点击或拖拽航拍图到这里</div>
            <div class="upload-tip">建议使用无人机正射/俯拍图，地面手机照片不适用</div>
          </div>
          <img v-else :src="previewUrl" class="preview-img" alt="航拍预览" />
        </el-upload>

        <div class="actions">
          <el-button type="primary" :loading="state.loading" :disabled="!state.img" @click="runDetect">
            开始航拍检测
          </el-button>
          <el-button :disabled="state.loading || !state.img" @click="reset">清空</el-button>
        </div>

        <el-alert
          class="hint"
          type="info"
          :closable="false"
          show-icon
          title="当前只输出堆料位置和置信度"
          description="占道/临边判断需要通道、临边标注；确认前只作为预警，不进入隐患统计。"
        />
      </el-card>

      <el-card shadow="never" class="panel">
        <template #header>
          <div class="panel-title">
            <span>检测结果</span>
            <el-tag v-if="state.result" size="small" type="success">共 {{ state.result.count }} 处</el-tag>
          </div>
        </template>

        <div v-if="state.result" class="result-wrap">
          <div class="summary">
            <div class="summary-item">
              <span class="summary-value">{{ state.result.count }}</span>
              <span class="summary-label">堆料框</span>
            </div>
            <div class="summary-item">
              <span class="summary-value">{{ state.result.elapsed }}s</span>
              <span class="summary-label">耗时</span>
            </div>
            <div class="summary-item">
              <span class="summary-value">{{ state.result.model }}</span>
              <span class="summary-label">模型</span>
            </div>
          </div>

          <div v-if="state.result.count === 0" class="empty-result">
            未检测到堆料。若图上明显有材料堆，可能是该航次与训练数据差异较大，建议加入样本微调。
          </div>

          <div v-else class="pile-list">
            <div v-for="(p, i) in state.result.piles" :key="i" class="pile-row">
              <div class="pile-index">P{{ i + 1 }}</div>
              <div class="pile-main">
                <div class="pile-title">pile <span>{{ (p.confidence * 100).toFixed(1) }}%</span></div>
                <div class="pile-coord">{{ p.bbox_px.join(', ') }}</div>
              </div>
              <el-progress
                :percentage="Math.round(p.confidence * 100)"
                :stroke-width="6"
                :show-text="false"
                status="success"
              />
            </div>
          </div>
        </div>

        <div v-else class="empty-result">上传航拍图后，结果会显示在这里。</div>
      </el-card>
    </div>

    <el-card v-if="state.result && state.result.count > 0" shadow="never" class="overlay-card">
      <template #header>
        <div class="panel-title">
          <span>框选预览</span>
          <span class="muted">绿框 = 模型检出的堆料</span>
        </div>
      </template>
      <div class="canvas-wrap">
        <img :src="previewUrl" class="canvas-img" alt="航拍检测预览" />
        <div
          v-for="(p, i) in state.result.piles"
          :key="i"
          class="pile-box"
          :style="boxStyle(p)"
        >
          <span>P{{ i + 1 }} {{ (p.confidence * 100).toFixed(0) }}%</span>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="aerialPredict">
import { reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { UploadFilled } from '@element-plus/icons-vue';
import type { UploadProps } from 'element-plus';
import request from '/@/utils/request';

interface Pile {
  label: string;
  confidence: number;
  bbox: number[];
  bbox_px: number[];
}

interface AerialResult {
  count: number;
  piles: Pile[];
  width: number;
  height: number;
  elapsed: number;
  model: string;
}

const previewUrl = ref('');
const state = reactive({
  img: '',
  loading: false,
  result: null as AerialResult | null,
});

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const ok = /image\/(jpeg|png|webp)/.test(file.type);
  if (!ok) ElMessage.error('只支持 JPG / PNG / WebP 航拍图');
  return ok;
};

const onUpload: UploadProps['onSuccess'] = (response, file) => {
  state.img = response.data;
  previewUrl.value = URL.createObjectURL(file.raw!);
  state.result = null;
  ElMessage.success('上传成功');
};

const boxStyle = (p: Pile) => ({
  left: `${p.bbox[0] * 100}%`,
  top: `${p.bbox[1] * 100}%`,
  width: `${(p.bbox[2] - p.bbox[0]) * 100}%`,
  height: `${(p.bbox[3] - p.bbox[1]) * 100}%`,
});

const parseData = (raw: any): AerialResult => {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  return (data?.data ?? data) as AerialResult;
};

const runDetect = () => {
  if (!state.img) return;
  state.loading = true;
  state.result = null;
  request
    .post('/flask/aerial/predict', { inputImg: state.img, conf: 0.25 })
    .then((res: any) => {
      if (String(res.code) !== '0') {
        ElMessage.error(res.msg || res.message || '航拍检测失败');
        return;
      }
      const result = parseData(res.data);
      state.result = result;
      ElMessage.success(`检测完成，共 ${result.count} 处堆料`);
    })
    .catch((err) => {
      ElMessage.error(err?.message || '航拍检测失败');
    })
    .finally(() => {
      state.loading = false;
    });
};

const reset = () => {
  state.img = '';
  state.result = null;
  previewUrl.value = '';
};
</script>

<style scoped lang="scss">
.aerial-page {
  padding: 16px;
}
.hero-card {
  margin-bottom: 16px;
  background: linear-gradient(120deg, #eef7f3 0%, #f7fbf9 55%, #eef3ff 100%);
  border: 1px solid #dcebe4;
}
.hero-copy {
  h2 { margin: 6px 0 8px; color: #1f3b33; font-size: 24px; }
  p { margin: 0; color: #5b6f68; line-height: 1.7; }
}
.eyebrow { color: #2f7d67; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; }
.hero-tags { margin-top: 14px; display: flex; gap: 8px; }
.grid { display: grid; grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr); gap: 16px; }
.panel-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.aerial-upload :deep(.el-upload-dragger) { padding: 0; overflow: hidden; border-radius: 10px; }
.upload-empty { min-height: 300px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; }
.upload-icon { font-size: 38px; color: #7aa99a; margin-bottom: 12px; }
.upload-title { font-weight: 600; color: #334a43; }
.upload-tip { margin-top: 8px; color: #8b9b95; font-size: 12px; }
.preview-img { display: block; width: 100%; max-height: 360px; object-fit: contain; background: #0f1b18; }
.actions { margin-top: 14px; display: flex; gap: 10px; }
.hint { margin-top: 14px; }
.result-wrap { display: flex; flex-direction: column; gap: 12px; }
.summary { display: flex; gap: 20px; padding-bottom: 10px; border-bottom: 1px dashed #e3ebe7; }
.summary-item { display: flex; flex-direction: column; gap: 2px; }
.summary-value { font-size: 22px; font-weight: 700; color: #245843; }
.summary-label { font-size: 12px; color: #8b9b95; }
.empty-result { min-height: 120px; display: flex; align-items: center; justify-content: center; color: #8b9b95; text-align: center; line-height: 1.7; }
.pile-list { display: flex; flex-direction: column; gap: 10px; max-height: 320px; overflow: auto; }
.pile-row { display: grid; grid-template-columns: 52px 1fr 90px; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid #eaf1ee; border-radius: 8px; }
.pile-index { width: 42px; height: 26px; line-height: 26px; text-align: center; background: #e9f5ef; color: #245843; border-radius: 6px; font-weight: 700; font-size: 12px; }
.pile-title { font-weight: 600; color: #334a43; font-size: 13px; span { color: #2f7d67; margin-left: 6px; } }
.pile-coord { color: #9aa9a3; font-size: 11px; margin-top: 2px; }
.overlay-card { margin-top: 16px; }
.muted { color: #8b9b95; font-size: 12px; }
.canvas-wrap { position: relative; display: inline-block; max-width: 100%; background: #0f1b18; }
.canvas-img { display: block; max-width: 100%; max-height: 560px; }
.pile-box { position: absolute; border: 2px solid #32c48d; background: rgba(50, 196, 141, 0.12); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25); }
.pile-box span { position: absolute; top: -22px; left: -2px; padding: 1px 6px; background: #1e8f68; color: #fff; font-size: 11px; white-space: nowrap; border-radius: 4px 4px 4px 0; }
@media (max-width: 960px) {
  .grid { grid-template-columns: 1fr; }
}
</style>
