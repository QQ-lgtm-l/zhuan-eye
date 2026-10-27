<template>
	<div class="manual-page layout-pd">
		<!-- 顶部 -->
		<section class="manual-hero">
			<div class="hero-left">
				<div class="hero-title"><el-icon :size="22"><Notebook /></el-icon>安全知识手册</div>
				<div class="hero-sub">房建 22 类隐患 · 通用安全管理 · 可离线查阅</div>
			</div>
			<div class="hero-stats">
				<div class="hero-stat"><b>{{ stats.total || 0 }}</b><span>条知识</span></div>
				<div class="hero-stat"><b>{{ (stats.categories || []).length }}</b><span>个分类</span></div>
				<div class="hero-stat"><b>22</b><span>类隐患</span></div>
			</div>
		</section>

		<el-row :gutter="15">
			<!-- 分类 -->
			<el-col :xs="24" :sm="24" :md="8" :lg="7" :xl="6">
				<div class="manual-card category-card">
					<div class="card-head">隐患分类</div>
					<div
						class="category-item"
						:class="{ active: state.activeCategory === 'all' }"
						@click="selectCategory('all')"
					>
						<div class="category-main">
							<div class="category-name">全部知识</div>
							<div class="category-desc">按分类浏览全部条目</div>
						</div>
						<span class="category-count">{{ stats.total || 0 }}</span>
					</div>
					<div
						v-for="cat in state.categories"
						:key="cat.key"
						class="category-item"
						:class="{ active: state.activeCategory === cat.key }"
						@click="selectCategory(cat.key)"
					>
						<div class="category-main">
							<div class="category-name">{{ cat.name }}</div>
							<div class="category-desc">{{ cat.desc }}</div>
						</div>
						<span class="category-count">{{ cat.count }}</span>
					</div>
				</div>
			</el-col>

			<!-- 条目列表 -->
			<el-col :xs="24" :sm="24" :md="16" :lg="8" :xl="7">
				<div class="manual-card list-card">
					<div class="card-head">
						知识条目
						<span class="card-head-count">{{ filteredItems.length }} 条</span>
					</div>
					<div class="list-search">
						<el-input
							v-model="state.keyword"
							placeholder="搜索隐患名称 / 关键词 / 规范"
							clearable
							prefix-icon="Search"
						/>
					</div>
					<div class="item-list" v-loading="state.itemsLoading">
						<div
							v-for="item in filteredItems"
							:key="item.id"
							class="item-row"
							:class="{ active: state.detail && state.detail.id === item.id }"
							@click="openItem(item)"
						>
							<div class="item-main">
								<div class="item-name">{{ item.name }}</div>
								<div class="item-cat">{{ item.categoryName }}</div>
							</div>
							<el-tag size="small" :type="riskTagType(item.risk)" effect="plain">{{ item.risk }}</el-tag>
						</div>
						<div v-if="!state.itemsLoading && !filteredItems.length" class="list-empty">没有匹配的条目</div>
					</div>
				</div>
			</el-col>

			<!-- 详情 -->
			<el-col :xs="24" :sm="24" :md="24" :lg="9" :xl="11">
				<div class="manual-card detail-card" v-loading="state.detailLoading">
					<template v-if="state.detail">
						<div class="detail-head">
							<div>
								<div class="detail-title">{{ state.detail.name }}</div>
								<div class="detail-tags">
									<el-tag size="small" type="info" effect="plain">{{ state.detail.categoryName }}</el-tag>
									<el-tag size="small" :type="riskTagType(state.detail.risk)" effect="dark">{{ state.detail.risk }}</el-tag>
								</div>
							</div>
							<el-button text size="small" @click="copyDetail">
								<el-icon><CopyDocument /></el-icon>复制
							</el-button>
						</div>

						<div class="detail-section">
							<div class="section-label"><i></i>整改建议</div>
							<p>{{ state.detail.suggestion }}</p>
						</div>
						<div class="detail-section">
							<div class="section-label"><i></i>处理方法</div>
							<p>{{ state.detail.handle }}</p>
						</div>
						<div class="detail-section">
							<div class="section-label"><i></i>预防措施</div>
							<p>{{ state.detail.prevent }}</p>
						</div>
						<div class="detail-section" v-if="state.detail.checkpoints && state.detail.checkpoints.length">
							<div class="section-label"><i></i>现场检查要点</div>
							<ul class="check-list">
								<li v-for="(point, index) in state.detail.checkpoints" :key="index">{{ point }}</li>
							</ul>
						</div>
						<div class="detail-section basis">
							<div class="section-label"><i></i>规范依据</div>
							<p>{{ state.detail.basis }}</p>
						</div>
						<div class="detail-tip">
							内容来自内置《房建安全知识手册》，仅供参考，具体以现行规范原文及项目专项方案为准。
						</div>
					</template>
					<div v-else class="detail-empty">
						<el-icon :size="46"><Reading /></el-icon>
						<div class="empty-title">选择左侧条目查看详情</div>
						<div class="empty-sub">每条包含风险等级、整改建议、处理方法、预防措施与规范依据</div>
					</div>
				</div>
			</el-col>
		</el-row>
	</div>
</template>

<script setup lang="ts" name="manual">
import { computed, onMounted, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { CopyDocument, Notebook, Reading } from '@element-plus/icons-vue';
import { getKnowledgeItem, getKnowledgeItems, getKnowledgeStats, type KnowledgeItem } from '/@/api/knowledge';

const state = reactive({
	categories: [] as any[],
	items: [] as KnowledgeItem[],
	detail: null as any,
	activeCategory: 'all',
	keyword: '',
	itemsLoading: false,
	detailLoading: false,
});

const stats = reactive({ total: 0, categories: [] as any[] });

const filteredItems = computed(() => {
	const keyword = state.keyword.trim().toLowerCase();
	return state.items.filter((item) => {
		// 有搜索词时做全库搜索，不再受左侧分类限制
		if (!keyword && state.activeCategory !== 'all' && item.category !== state.activeCategory) return false;
		if (!keyword) return true;
		return (
			item.name.toLowerCase().includes(keyword) ||
			(item.categoryName || '').toLowerCase().includes(keyword) ||
			(item.summary || '').toLowerCase().includes(keyword) ||
			(item.basis || '').toLowerCase().includes(keyword)
		);
	});
});

const riskTagType = (risk: string) => {
	if (risk === '重大') return 'danger';
	if (risk === '较大') return 'warning';
	if (risk === '一般') return 'info';
	return 'success';
};

const loadStats = () => {
	getKnowledgeStats().then((res: any) => {
		if (res.code == 0 && res.data) {
			stats.total = res.data.total || 0;
			stats.categories = res.data.categories || [];
			state.categories = res.data.categories || [];
		}
	});
};

const loadItems = () => {
	state.itemsLoading = true;
	getKnowledgeItems()
		.then((res: any) => {
			if (res.code == 0) state.items = res.data || [];
		})
		.catch(() => ElMessage.error('知识条目加载失败，请检查后端服务'))
		.finally(() => {
			state.itemsLoading = false;
		});
};

const selectCategory = (key: string) => {
	state.activeCategory = key;
	const list = state.items.filter((item) => key === 'all' || item.category === key);
	if (list.length && (!state.detail || !list.some((item) => item.id === state.detail.id))) {
		openItem(list[0]);
	}
};

const openItem = (item: KnowledgeItem) => {
	if (state.detail && state.detail.id === item.id) return;
	state.detailLoading = true;
	getKnowledgeItem(item.id)
		.then((res: any) => {
			if (res.code == 0) state.detail = res.data;
		})
		.catch(() => ElMessage.error('条目详情加载失败'))
		.finally(() => {
			state.detailLoading = false;
		});
};

const copyDetail = async () => {
	const d = state.detail;
	if (!d) return;
	const text = [
		d.name,
		`类别：${d.categoryName}    风险等级：${d.risk}`,
		`整改建议：${d.suggestion}`,
		`处理方法：${d.handle}`,
		`预防措施：${d.prevent}`,
		d.checkpoints && d.checkpoints.length ? `检查要点：\n- ${d.checkpoints.join('\n- ')}` : '',
		`规范依据：${d.basis}`,
	].filter(Boolean).join('\n\n');
	try {
		await navigator.clipboard.writeText(text);
		ElMessage.success('已复制到剪贴板');
	} catch {
		ElMessage.error('复制失败，请手动选择文本');
	}
};

onMounted(() => {
	loadStats();
	loadItems();
	setTimeout(() => {
		if (!state.detail && state.items.length) openItem(state.items[0]);
	}, 600);
});
</script>

<style scoped lang="scss">
.manual-page {
	padding-bottom: 20px !important;
}

.manual-hero {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;
	padding: 20px 26px;
	margin-bottom: 15px;
	border-radius: 14px;
	color: #fff;
	background: linear-gradient(120deg, #0d47a1 0%, #1565c0 55%, #1e88e5 100%);
	box-shadow: 0 10px 24px rgba(13, 71, 161, 0.24);
	.hero-title {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 22px;
		font-weight: 800;
		letter-spacing: 2px;
	}
	.hero-sub {
		margin-top: 6px;
		font-size: 13px;
		color: rgba(255, 255, 255, 0.82);
	}
	.hero-stats {
		display: flex;
		gap: 28px;
	}
	.hero-stat {
		text-align: center;
		b {
			display: block;
			font-size: 24px;
			font-weight: 700;
			line-height: 1.1;
		}
		span {
			font-size: 12px;
			color: rgba(255, 255, 255, 0.78);
		}
	}
}

.manual-card {
	background: #fff;
	border: 1px solid #e3ecf7;
	border-radius: 12px;
	box-shadow: 0 2px 10px rgba(13, 71, 161, 0.05);
	margin-bottom: 15px;
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 16px;
		font-size: 15px;
		font-weight: 700;
		color: #0d47a1;
		border-bottom: 1px solid #eef3fa;
	}
	.card-head-count {
		font-size: 12px;
		font-weight: 400;
		color: #93a2b5;
	}
}

/* 分类 */
.category-card {
	padding-bottom: 8px;
}
.category-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	margin: 6px 10px;
	padding: 10px 12px;
	border-radius: 8px;
	cursor: pointer;
	border-left: 3px solid transparent;
	transition: all 0.2s ease;
	&:hover {
		background: #f4f8fd;
	}
	&.active {
		background: #e9f2fd;
		border-left-color: #0d47a1;
		.category-name {
			color: #0d47a1;
		}
	}
	.category-name {
		font-size: 14px;
		font-weight: 600;
		color: #33475b;
	}
	.category-desc {
		margin-top: 3px;
		font-size: 11px;
		color: #93a2b5;
		line-height: 1.4;
	}
	.category-count {
		flex-shrink: 0;
		min-width: 26px;
		height: 22px;
		line-height: 22px;
		text-align: center;
		border-radius: 11px;
		font-size: 12px;
		color: #1565c0;
		background: #e9f2fd;
	}
}

/* 列表 */
.list-card {
	display: flex;
	flex-direction: column;
	max-height: 760px;
}
.list-search {
	padding: 12px 14px 6px;
}
.item-list {
	overflow-y: auto;
	padding: 0 8px 8px;
}
.item-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 10px 12px;
	border-radius: 8px;
	cursor: pointer;
	transition: background-color 0.15s ease;
	&:hover {
		background: #f4f8fd;
	}
	&.active {
		background: #e9f2fd;
		.item-name {
			color: #0d47a1;
		}
	}
	.item-name {
		font-size: 13px;
		font-weight: 600;
		color: #33475b;
		line-height: 1.5;
	}
	.item-cat {
		margin-top: 3px;
		font-size: 11px;
		color: #93a2b5;
	}
}
.list-empty {
	padding: 40px 0;
	text-align: center;
	font-size: 13px;
	color: #93a2b5;
}

/* 详情 */
.detail-card {
	min-height: 420px;
	padding: 18px 20px 16px;
}
.detail-head {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 10px;
	padding-bottom: 12px;
	border-bottom: 1px dashed #e6eef9;
}
.detail-title {
	font-size: 17px;
	font-weight: 700;
	color: #0d47a1;
	line-height: 1.4;
}
.detail-tags {
	display: flex;
	gap: 6px;
	margin-top: 8px;
}
.detail-section {
	margin-top: 14px;
	p {
		margin: 6px 0 0;
		font-size: 13px;
		line-height: 1.8;
		color: #4b5b70;
	}
	.section-label {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 13px;
		font-weight: 700;
		color: #1565c0;
		i {
			width: 3px;
			height: 13px;
			border-radius: 2px;
			background: linear-gradient(180deg, #0d47a1, #42a5f5);
		}
	}
	&.basis {
		padding: 10px 12px;
		border-radius: 8px;
		background: #f7faff;
		border: 1px solid #e8f0fa;
		p {
			color: #5b6b80;
			font-size: 12px;
		}
	}
}
.check-list {
	margin: 8px 0 0;
	padding-left: 4px;
	list-style: none;
	li {
		position: relative;
		padding-left: 16px;
		margin: 4px 0;
		font-size: 13px;
		line-height: 1.7;
		color: #4b5b70;
		&::before {
			content: '';
			position: absolute;
			left: 2px;
			top: 9px;
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: #90caf9;
		}
	}
}
.detail-tip {
	margin-top: 16px;
	padding-top: 10px;
	border-top: 1px dashed #e6eef9;
	font-size: 11px;
	color: #a4b1c3;
}
.detail-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 380px;
	color: #c3cfdd;
	.empty-title {
		margin-top: 14px;
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

@media (max-width: 992px) {
	.manual-hero {
		flex-direction: column;
		align-items: flex-start;
		.hero-stats {
			gap: 20px;
		}
	}
	.list-card {
		max-height: 480px;
	}
}
</style>
