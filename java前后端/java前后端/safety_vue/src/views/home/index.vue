<template>
	<div class="home-container layout-pd">
		<!-- 顶部横幅：主色取自顶栏 #0D47A1 -->
		<section class="home-hero">
			<div class="hero-main">
				<div class="hero-kicker"><i class="hero-dot"></i>视觉驱动 · 多 Agent 协同 · 隐患闭环</div>
				<h1 class="hero-title">筑安慧眼</h1>
				<p class="hero-sub">基于视觉驱动多Agent的房建施工现场隐患闭环协同管控系统</p>
				<div class="hero-tags">
					<span>YOLOv8-s 轻量化检测</span>
					<span>房建垂直 RAG 知识库</span>
					<span>LangGraph 五智能体</span>
					<span>Web + 小程序双端</span>
				</div>
			</div>
			<div class="hero-side">
				<div class="hero-stats">
					<div class="hero-stat" v-for="item in heroStats" :key="item.label">
						<b>{{ item.value }}</b>
						<span>{{ item.label }}</span>
					</div>
				</div>
				<div class="hero-actions">
					<button v-for="act in quickActions" :key="act.path" class="hero-action" @click="onQuickAction(act.path)">
						<el-icon><component :is="act.icon" /></el-icon>
						{{ act.label }}
					</button>
				</div>
				<div class="hero-update" @click="refreshData">
					<el-icon :class="{ spinning: refreshing }"><Refresh /></el-icon>
					数据更新于 {{ updatedText }} · 每 30 秒自动刷新
				</div>
			</div>
		</section>

		<!-- KPI -->
		<el-row :gutter="15" class="kpi-row">
			<el-col v-for="item in kpiCards" :key="item.label" :xs="12" :sm="12" :md="6" :lg="6" :xl="6">
				<div class="kpi-card">
					<div class="kpi-icon" :style="{ background: item.bg, color: item.color }">
						<el-icon :size="22"><component :is="item.icon" /></el-icon>
					</div>
					<div class="kpi-body">
						<div class="kpi-value">
							{{ item.value }}<small v-if="item.unit">{{ item.unit }}</small>
						</div>
						<div class="kpi-label">{{ item.label }}</div>
						<div class="kpi-hint">{{ item.hint }}</div>
					</div>
				</div>
			</el-col>
		</el-row>

		<!-- 趋势 + 四大类 -->
		<el-row :gutter="15" class="chart-row">
			<el-col :xs="24" :sm="24" :md="24" :lg="16" :xl="16">
				<div class="panel-card">
					<div class="panel-head">
						<div class="panel-title"><i></i>近十日隐患检测趋势</div>
						<div class="panel-extra">单位：次</div>
					</div>
					<div class="panel-chart" ref="trendRef"></div>
				</div>
			</el-col>
			<el-col :xs="24" :sm="24" :md="24" :lg="8" :xl="8">
				<div class="panel-card">
					<div class="panel-head">
						<div class="panel-title"><i></i>房建 22 类隐患四大类分布</div>
					</div>
					<div class="panel-chart" ref="categoryRef"></div>
				</div>
			</el-col>
		</el-row>

		<!-- 高频隐患 + 风险等级 + 人员 -->
		<el-row :gutter="15" class="chart-row">
			<el-col :xs="24" :sm="24" :md="24" :lg="10" :xl="10">
				<div class="panel-card">
					<div class="panel-head">
						<div class="panel-title"><i></i>高频隐患类型 TOP8</div>
					</div>
					<div class="panel-chart" ref="labelRef"></div>
				</div>
			</el-col>
			<el-col :xs="24" :sm="24" :md="24" :lg="7" :xl="7">
				<div class="panel-card">
					<div class="panel-head">
						<div class="panel-title"><i></i>工单风险等级</div>
						<div class="panel-extra">闭环率 {{ orderStats.closedRate }}%</div>
					</div>
					<div class="panel-chart" ref="levelRef"></div>
					<div class="status-chips">
						<span v-for="s in statusChips" :key="s.key" class="status-chip" :class="s.key">
							{{ s.label }} <b>{{ s.value }}</b>
						</span>
					</div>
				</div>
			</el-col>
			<el-col :xs="24" :sm="24" :md="24" :lg="7" :xl="7">
				<div class="panel-card">
					<div class="panel-head">
						<div class="panel-title"><i></i>检测人员 TOP6</div>
					</div>
					<div class="panel-chart" ref="userRef"></div>
				</div>
			</el-col>
		</el-row>

		<!-- 五智能体闭环链路 -->
		<div class="panel-card agent-card">
			<div class="panel-head">
				<div class="panel-title"><i></i>LangGraph 五智能体协同闭环链路</div>
				<div class="panel-extra">现场图像 → 视觉检测 → 智能研判 → 分级派单 → 协同沟通 → 台账归档</div>
			</div>
			<div class="agent-chain">
				<div v-for="(agent, index) in agents" :key="agent.name" class="agent-step">
					<div class="agent-index">{{ String(index + 1).padStart(2, '0') }}</div>
					<div class="agent-body">
						<div class="agent-name">{{ agent.name }}</div>
						<div class="agent-desc">{{ agent.desc }}</div>
					</div>
					<el-icon v-if="index < agents.length - 1" class="agent-arrow"><Right /></el-icon>
				</div>
			</div>
		</div>

		<!-- 最新检测 + 待办工单 -->
		<el-row :gutter="15" class="chart-row">
			<el-col :xs="24" :sm="24" :md="24" :lg="14" :xl="14">
				<div class="panel-card">
					<div class="panel-head">
						<div class="panel-title"><i></i>实时检测信息</div>
						<div class="panel-extra">共 {{ totalRecords }} 条记录</div>
					</div>
					<el-table :data="latestRecords" style="width: 100%" height="300" empty-text="暂无检测记录">
						<el-table-column prop="username" label="用户名" align="center" show-overflow-tooltip>
							<template #default="scope">
								<div class="table-user">
									<span class="table-avatar">{{ displayName(scope.row.username).slice(0, 1) }}</span>
									{{ displayName(scope.row.username) }}
								</div>
							</template>
						</el-table-column>
						<el-table-column prop="weight" label="识别权重" align="center" show-overflow-tooltip>
							<template #default="scope">
								<el-tag size="small" effect="plain">{{ scope.row.weight || '-' }}</el-tag>
							</template>
						</el-table-column>
						<el-table-column prop="conf" label="最小阈值" align="center" width="100" />
						<el-table-column prop="startTime" label="时间" align="center" width="170" />
					</el-table>
				</div>
			</el-col>
			<el-col :xs="24" :sm="24" :md="24" :lg="10" :xl="10">
				<div class="panel-card">
					<div class="panel-head">
						<div class="panel-title"><i></i>待办整改工单</div>
						<div class="panel-extra">
							<span class="overdue-text" v-if="orderStats.overdue > 0">逾期 {{ orderStats.overdue }} 单</span>
							<span v-else>共 {{ state.orderTotal }} 单</span>
						</div>
					</div>
					<div class="todo-list" v-if="todoOrders.length">
						<div
							v-for="order in todoOrders"
							:key="order.id"
							class="todo-item"
							:class="{ overdue: isOverdue(order) }"
							@click="goWorkOrder(order)"
						>
							<div class="todo-main">
								<div class="todo-title">{{ order.hiddenType || '未命名隐患' }}</div>
								<div class="todo-meta">
									<span>{{ order.orderNo }}</span>
									<span>{{ order.responsible || '待指派' }}</span>
								</div>
							</div>
							<div class="todo-side">
								<el-tag size="small" :type="getLevelType(order.level)">{{ order.level || '一般隐患' }}</el-tag>
								<div class="todo-deadline" :class="{ danger: isOverdue(order) }">
									{{ isOverdue(order) ? '已逾期 · ' : '截止 ' }}{{ deadlineLabel(order) }}
								</div>
							</div>
						</div>
					</div>
					<div v-else class="todo-empty">暂无待办工单</div>
				</div>
			</el-col>
		</el-row>
	</div>
</template>

<script setup lang="ts" name="home">
import { computed, markRaw, nextTick, onActivated, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { storeToRefs } from 'pinia';
import { useThemeConfig } from '/@/stores/themeConfig';
import request from '/@/utils/request';
import {
	Picture,
	User,
	WarningFilled,
	Document,
	ChatDotRound,
	Right,
	Odometer,
	CircleCheck,
	Refresh,
} from '@element-plus/icons-vue';
import Cookies from 'js-cookie';

const router = useRouter();
const storesThemeConfig = useThemeConfig();
const { themeConfig } = storeToRefs(storesThemeConfig);

// ---------- 主题色（顶部横栏 #0D47A1 为主） ----------
const NAVY = '#0D47A1';
const BLUE_800 = '#1565C0';
const BLUE_600 = '#1E88E5';
const BLUE_400 = '#42A5F5';
const BLUE_300 = '#64B5F6';
const BLUE_200 = '#90CAF9';
const BLUE_50 = '#E3F2FD';
const CHART_COLORS = [NAVY, BLUE_800, BLUE_600, BLUE_400, BLUE_300, BLUE_200];
const RISK_COLOR: Record<string, string> = {
	重大隐患: '#D32F2F',
	较大隐患: '#F9A825',
	一般隐患: '#1976D2',
	轻微隐患: '#26A69A',
};

const trendRef = ref();
const categoryRef = ref();
const labelRef = ref();
const levelRef = ref();
const userRef = ref();
let charts: any = { trend: null, category: null, label: null, level: null, user: null };

const state = reactive({
	records: [] as any[],
	orders: [] as any[],
	users: [] as any[],
	orderTotal: 0,
});

// 数据刷新状态
const updatedText = ref('--:--:--');
const refreshing = ref(false);
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let mountedOnce = false;

const heroStats = [
	{ value: '22', label: '类房建隐患' },
	{ value: '4', label: '大隐患类别' },
	{ value: '5', label: '个协同智能体' },
	{ value: '6', label: '类岗位角色' },
];

const allQuickActions = [
	{ label: '发起检测', path: '/imgPredict', icon: Picture },
	{ label: '工单台账', path: '/workOrder', icon: Document },
	{ label: '智能问答', path: '/smartChat', icon: ChatDotRound },
	{ label: '用户管理', path: '/usermanage', icon: User },
];
const quickActions = computed(() => {
	const role = Cookies.get('role') || '';
	const canDetect = ['管理员', '项目经理', '专职安全员', '巡检员'].includes(role);
	return allQuickActions.filter((item) => {
		if (item.path === '/usermanage') return role === '管理员';
		if (item.path === '/imgPredict') return canDetect;
		return true;
	});
});

const agents = [
	{ name: '巡检感知 Agent', desc: '清洗视觉检测结果，过滤无效画面，结构化隐患数据包' },
	{ name: '隐患分级 Agent', desc: '检索房建 RAG 规范库，按住建 37 号令划分重大/较大/一般' },
	{ name: '整改派单 Agent', desc: '按风险等级与责任岗位生成差异化整改工单' },
	{ name: '协同沟通 Agent', desc: '生成跨岗位协同通知，重大隐患双端预警直达责任人' },
	{ name: '台账生成 Agent', desc: '汇总全生命周期数据，自动归档并可一键导出 Excel' },
];

// ---------- 数据解析 ----------
const parseList = (value: any): string[] => {
	if (Array.isArray(value)) return value.map((v) => String(v));
	if (typeof value === 'string' && value.trim()) {
		try {
			const parsed = JSON.parse(value);
			if (Array.isArray(parsed)) return parsed.map((v) => String(v));
			if (parsed === null || parsed === undefined) return [];
			return [String(parsed)];
		} catch {
			return [value];
		}
	}
	return [];
};

const parsedRecords = computed(() =>
	state.records.map((item) => {
		const labels = parseList(item.label);
		const confidences = parseList(item.confidence)
			.map((v) => {
				const num = parseFloat(v);
				return num > 1 ? num / 100 : num;
			})
			.filter((n) => !isNaN(n));
		const startTime = String(item.startTime || '');
		return { ...item, labels, confidences, day: startTime.slice(0, 10), startTime };
	})
);

const totalRecords = computed(() => state.records.length);
const userCount = computed(() => new Set(state.records.map((r) => r.username).filter(Boolean)).size);
const hazardLabelCount = computed(() => parsedRecords.value.reduce((sum, r) => sum + r.labels.length, 0));
const avgConfidence = computed(() => {
	const all = parsedRecords.value.flatMap((r) => r.confidences);
	if (!all.length) return '-';
	const avg = all.reduce((s, n) => s + n, 0) / all.length;
	return (avg * 100).toFixed(1);
});

const kpiCards = computed(() => [
	{
		label: '累计检测记录',
		value: totalRecords.value,
		hint: '图像 / 视频隐患检测总数',
		icon: Odometer,
		bg: '#E3F2FD',
		color: NAVY,
	},
	{
		label: '参与检测人员',
		value: userCount.value,
		hint: '去重后的检测发起人数',
		icon: User,
		bg: '#E8F5E9',
		color: '#2E7D32',
	},
	{
		label: '累计隐患标签',
		value: hazardLabelCount.value,
		hint: '按识别标签累计计数',
		icon: WarningFilled,
		bg: '#FFF3E0',
		color: '#EF6C00',
	},
	{
		label: '平均识别置信度',
		value: avgConfidence.value,
		unit: '%',
		hint: '全部检测框平均置信度',
		icon: CircleCheck,
		bg: '#EDE7F6',
		color: '#4527A0',
	},
]);

// 四类隐患关键词映射（严格对齐文档 22 类 / 4 大类）
const CATEGORY_RULES = [
	{
		name: '高处作业类',
		keys: ['安全带', '临边', '洞口', '脚手架', '悬挑', '连墙件', '高处', '模板支撑', '卸料平台', '基坑'],
	},
	{ name: '个体防护类', keys: ['安全帽', '反光背心', '防滑鞋', '口罩', '护目镜'] },
	{ name: '临时用电类', keys: ['线缆', '电缆', '配电箱', '电线', '开关箱', '用电', '电箱'] },
	{ name: '场地消防与文明施工类', keys: ['消防', '器材', '占道', '废料', '通道', '材料堆放', '垃圾'] },
];
const categoryOf = (label: string) => {
	const rule = CATEGORY_RULES.find((item) => item.keys.some((key) => label.includes(key)));
	return rule ? rule.name : '其他隐患';
};

const categoryData = computed(() => {
	const map: Record<string, number> = {};
	parsedRecords.value.forEach((r) => {
		r.labels.forEach((label) => {
			const cat = categoryOf(label);
			map[cat] = (map[cat] || 0) + 1;
		});
	});
	return Object.keys(map).map((name) => ({ name, value: map[name] }));
});

const labelTopData = computed(() => {
	const map: Record<string, number> = {};
	parsedRecords.value.forEach((r) => r.labels.forEach((label) => (map[label] = (map[label] || 0) + 1)));
	return Object.entries(map)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([name, value]) => ({ name, value }));
});

const userTopData = computed(() => {
	const map: Record<string, number> = {};
	state.records.forEach((r) => {
		if (r.username) map[r.username] = (map[r.username] || 0) + 1;
	});
	return Object.entries(map)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 6)
		.map(([name, value]) => ({ name: displayName(name), value }));
});

const dayTrend = computed(() => {
	const map: Record<string, number> = {};
	parsedRecords.value.forEach((r) => {
		if (r.day) map[r.day] = (map[r.day] || 0) + 1;
	});
	const days = Object.keys(map).sort().slice(-10);
	return { days, values: days.map((d) => map[d]) };
});

const pad2 = (n: number) => String(n).padStart(2, '0');
// 后端 deadline 有两种格式：日期（2026-08-26）或时长（2小时 / 24小时 / 1天）
const parseDue = (order: any): string => {
	const raw = String(order?.deadline || '').trim();
	if (!raw) return '';
	if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.replace('T', ' ').slice(0, 16);
	const matched = raw.match(/^(\d+(?:\.\d+)?)\s*(小时|天|分钟)/);
	if (matched && order.createTime) {
		const base = new Date(String(order.createTime).replace(/-/g, '/'));
		if (!isNaN(base.getTime())) {
			const value = parseFloat(matched[1]);
			const minutes = matched[2] === '天' ? value * 1440 : matched[2] === '小时' ? value * 60 : value;
			const due = new Date(base.getTime() + minutes * 60000);
			return `${due.getFullYear()}-${pad2(due.getMonth() + 1)}-${pad2(due.getDate())} ${pad2(due.getHours())}:${pad2(due.getMinutes())}`;
		}
	}
	return '';
};
const deadlineLabel = (order: any) => parseDue(order) || String(order?.deadline || '-');

const orderStats = computed(() => {
	const levelMap: Record<string, number> = { 重大隐患: 0, 较大隐患: 0, 一般隐患: 0, 轻微隐患: 0 };
	const statusMap: Record<string, number> = { pending: 0, processing: 0, completed: 0, timeout: 0, closed: 0 };
	state.orders.forEach((order) => {
		if (levelMap[order.level] !== undefined) levelMap[order.level] += 1;
		if (statusMap[order.status] !== undefined) statusMap[order.status] += 1;
	});
	const total = state.orders.length;
	const done = statusMap.closed + statusMap.completed;
	const overdue = state.orders.filter((o) => isOverdue(o)).length;
	return {
		levelMap,
		statusMap,
		total,
		overdue,
		closedRate: total ? Math.round((done / total) * 100) : 0,
	};
});

const statusChips = computed(() => [
	{ key: 'pending', label: '待处理', value: orderStats.value.statusMap.pending },
	{ key: 'processing', label: '处理中', value: orderStats.value.statusMap.processing },
	{ key: 'completed', label: '已完成', value: orderStats.value.statusMap.completed },
	{ key: 'timeout', label: '超时完成', value: orderStats.value.statusMap.timeout },
	{ key: 'closed', label: '已关闭', value: orderStats.value.statusMap.closed },
]);

const latestRecords = computed(() =>
	[...parsedRecords.value].sort((a, b) => (b.startTime || '').localeCompare(a.startTime || '')).slice(0, 8)
);

const todoOrders = computed(() =>
	state.orders
		.filter((o) => o.status === 'pending' || o.status === 'processing')
		.sort((a, b) => String(parseDue(a) || a.deadline || '').localeCompare(String(parseDue(b) || b.deadline || '')))
		.slice(0, 5)
);

function isOverdue(order: any) {
	if (!order) return false;
	if (['closed', 'completed', 'timeout'].includes(order.status)) return false;
	const due = parseDue(order);
	if (!due) return false;
	const now = new Date();
	const nowText = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
	return due < nowText;
}

const getLevelType = (level: string) => {
	const map: Record<string, string> = { 重大隐患: 'danger', 较大隐患: 'warning', 一般隐患: '', 轻微隐患: 'success' };
	return map[level] || 'info';
};

const onQuickAction = (path: string) => router.push(path);
const goWorkOrder = (order: any) => router.push({ path: '/workOrder', query: { orderNo: order.orderNo } });

// ---------- ECharts ----------
const isDark = computed(() => themeConfig.value.isIsDark);
const axisColor = () => (isDark.value ? '#8FA3BF' : '#6B7C93');
const splitColor = () => (isDark.value ? 'rgba(255,255,255,.08)' : '#EDF3FA');

const emptyOption = (text = '暂无数据') => ({
	title: {
		text,
		left: 'center',
		top: 'middle',
		textStyle: { color: axisColor(), fontSize: 14, fontWeight: 400 },
	},
});

const disposeChart = (key: string) => {
	if (charts[key]) {
		charts[key].dispose();
		charts[key] = null;
	}
};

const renderTrend = () => {
	disposeChart('trend');
	if (!trendRef.value) return;
	charts.trend = markRaw(echarts.init(trendRef.value));
	const { days, values } = dayTrend.value;
	if (!days.length) {
		charts.trend.setOption(emptyOption('暂无检测数据'));
		return;
	}
	charts.trend.setOption({
		grid: { top: 24, right: 24, bottom: 30, left: 44 },
		tooltip: { trigger: 'axis' },
		xAxis: {
			type: 'category',
			data: days,
			boundaryGap: false,
			axisLine: { lineStyle: { color: splitColor() } },
			axisTick: { show: false },
			axisLabel: { color: axisColor(), fontSize: 12 },
		},
		yAxis: {
			type: 'value',
			minInterval: 1,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: axisColor(), fontSize: 12 },
			splitLine: { lineStyle: { type: 'dashed', color: splitColor() } },
		},
		series: [
			{
				name: '检测次数',
				type: 'line',
				smooth: true,
				symbol: 'circle',
				symbolSize: 7,
				data: values,
				lineStyle: {
					width: 3,
					color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
						{ offset: 0, color: NAVY },
						{ offset: 1, color: BLUE_400 },
					]),
				},
				itemStyle: { color: NAVY, borderColor: '#fff', borderWidth: 2 },
				areaStyle: {
					color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
						{ offset: 0, color: 'rgba(21,101,192,0.28)' },
						{ offset: 1, color: 'rgba(21,101,192,0.02)' },
					]),
				},
			},
		],
	});
};

const renderCategory = () => {
	disposeChart('category');
	if (!categoryRef.value) return;
	charts.category = markRaw(echarts.init(categoryRef.value));
	const data = categoryData.value;
	if (!data.length) {
		charts.category.setOption(emptyOption());
		return;
	}
	charts.category.setOption({
		tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 次（{d}%）' },
		legend: {
			bottom: 0,
			left: 'center',
			icon: 'circle',
			itemWidth: 8,
			itemHeight: 8,
			textStyle: { color: axisColor(), fontSize: 12 },
		},
		color: CATEGORY_RULES.map((_, i) => CHART_COLORS[i]).concat(['#B0BEC5']),
		series: [
			{
				type: 'pie',
				radius: ['46%', '68%'],
				center: ['50%', '44%'],
				avoidLabelOverlap: true,
				itemStyle: { borderColor: isDark.value ? '#141414' : '#fff', borderWidth: 2 },
				label: { show: true, formatter: '{d}%', color: axisColor(), fontSize: 12 },
				labelLine: { length: 8, length2: 8 },
				data,
			},
		],
	});
};

const renderLabel = () => {
	disposeChart('label');
	if (!labelRef.value) return;
	charts.label = markRaw(echarts.init(labelRef.value));
	const data = labelTopData.value;
	if (!data.length) {
		charts.label.setOption(emptyOption());
		return;
	}
	const names = data.map((d) => d.name).reverse();
	const values = data.map((d) => d.value).reverse();
	charts.label.setOption({
		grid: { top: 16, right: 42, bottom: 16, left: 96 },
		tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
		xAxis: {
			type: 'value',
			minInterval: 1,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: axisColor(), fontSize: 12 },
			splitLine: { lineStyle: { type: 'dashed', color: splitColor() } },
		},
		yAxis: {
			type: 'category',
			data: names,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: axisColor(), fontSize: 12, width: 84, overflow: 'truncate' },
		},
		series: [
			{
				type: 'bar',
				data: values,
				barWidth: 12,
				itemStyle: {
					borderRadius: [0, 8, 8, 0],
					color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
						{ offset: 0, color: NAVY },
						{ offset: 1, color: BLUE_400 },
					]),
				},
				label: { show: true, position: 'right', color: axisColor(), fontSize: 12 },
			},
		],
	});
};

const renderLevel = () => {
	disposeChart('level');
	if (!levelRef.value) return;
	charts.level = markRaw(echarts.init(levelRef.value));
	const levelMap = orderStats.value.levelMap;
	const data = Object.keys(levelMap)
		.filter((key) => levelMap[key] > 0)
		.map((key) => ({ name: key, value: levelMap[key], itemStyle: { color: RISK_COLOR[key] } }));
	if (!data.length) {
		charts.level.setOption(emptyOption('暂无工单'));
		return;
	}
	charts.level.setOption({
		tooltip: { trigger: 'item', formatter: '{b}<br/>{c} 单（{d}%）' },
		legend: {
			bottom: 0,
			left: 'center',
			icon: 'circle',
			itemWidth: 8,
			itemHeight: 8,
			textStyle: { color: axisColor(), fontSize: 12 },
		},
		series: [
			{
				type: 'pie',
				radius: ['48%', '70%'],
				center: ['50%', '44%'],
				itemStyle: { borderColor: isDark.value ? '#141414' : '#fff', borderWidth: 2 },
				label: { show: false },
				data,
			},
		],
	});
};

const renderUser = () => {
	disposeChart('user');
	if (!userRef.value) return;
	charts.user = markRaw(echarts.init(userRef.value));
	const data = userTopData.value;
	if (!data.length) {
		charts.user.setOption(emptyOption());
		return;
	}
	charts.user.setOption({
		grid: { top: 16, right: 42, bottom: 16, left: 76 },
		tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
		xAxis: {
			type: 'value',
			minInterval: 1,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: axisColor(), fontSize: 12 },
			splitLine: { lineStyle: { type: 'dashed', color: splitColor() } },
		},
		yAxis: {
			type: 'category',
			data: data.map((d) => d.name).reverse(),
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: axisColor(), fontSize: 12, overflow: 'truncate', width: 64 },
		},
		series: [
			{
				type: 'bar',
				data: data.map((d) => d.value).reverse(),
				barWidth: 12,
				itemStyle: {
					borderRadius: [0, 8, 8, 0],
					color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
						{ offset: 0, color: BLUE_800 },
						{ offset: 1, color: BLUE_300 },
					]),
				},
				label: { show: true, position: 'right', color: axisColor(), fontSize: 12 },
			},
		],
	});
};

const renderAll = () => {
	renderTrend();
	renderCategory();
	renderLabel();
	renderLevel();
	renderUser();
};

const resizeAll = () => {
	Object.keys(charts).forEach((key) => charts[key] && charts[key].resize());
};

const loadData = async () => {
	try {
		const res: any = await request.get('/api/imgRecords/all');
		if (res && res.code == 0) state.records = Array.isArray(res.data) ? res.data : [];
	} catch {
		state.records = [];
	}
	try {
		const res: any = await request.get('/api/workOrder', { params: { pageNum: 1, pageSize: 1000 } });
		if (res && res.code == 0) {
			state.orders = res.data?.list || [];
			state.orderTotal = res.data?.total || 0;
		}
	} catch {
		state.orders = [];
	}
	try {
		const res: any = await request.get('/api/user/all');
		if (res && res.code == 0) state.users = Array.isArray(res.data) ? res.data : [];
	} catch {
		state.users = [];
	}
};

const displayName = (username?: string) => {
	if (!username) return '-';
	const user = state.users.find((u: any) => u.username === username);
	return user?.name || username;
};

const timeText = () => {
	const d = new Date();
	return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

const refreshData = async () => {
	if (refreshing.value) return;
	refreshing.value = true;
	try {
		await loadData();
		updatedText.value = timeText();
		await nextTick();
		renderAll();
	} finally {
		refreshing.value = false;
	}
};

const onVisibilityChange = () => {
	if (!document.hidden) refreshData();
};

onMounted(async () => {
	await nextTick();
	// 先按空数据渲染一次，保证接口异常时也有空态而不是白板
	setTimeout(renderAll, 60);
	await refreshData();
	window.addEventListener('resize', resizeAll);
	document.addEventListener('visibilitychange', onVisibilityChange);
	refreshTimer = setInterval(refreshData, 30000);
	mountedOnce = true;
});

onActivated(() => {
	if (mountedOnce) refreshData();
	setTimeout(resizeAll, 60);
});

onBeforeUnmount(() => {
	if (refreshTimer) clearInterval(refreshTimer);
	window.removeEventListener('resize', resizeAll);
	document.removeEventListener('visibilitychange', onVisibilityChange);
	Object.keys(charts).forEach((key) => disposeChart(key));
});

watch(
	() => themeConfig.value.isIsDark,
	() => {
		nextTick(() => setTimeout(renderAll, 120));
	}
);
</script>

<style scoped lang="scss">
.home-container {
	padding-bottom: 20px !important;
	animation: homeFadeIn 0.4s ease both;
}

@keyframes homeFadeIn {
	from {
		opacity: 0;
		transform: translateY(8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes spin {
	to {
		transform: rotate(360deg);
	}
}

/* ---------- Hero ---------- */
.home-hero {
	position: relative;
	display: flex;
	justify-content: space-between;
	gap: 24px;
	padding: 26px 30px;
	margin-bottom: 15px;
	border-radius: 14px;
	color: #fff;
	background: linear-gradient(120deg, #0d47a1 0%, #1565c0 46%, #1e88e5 100%);
	box-shadow: 0 12px 28px rgba(13, 71, 161, 0.28);
	overflow: hidden;

	&::after {
		content: '';
		position: absolute;
		right: -60px;
		top: -80px;
		width: 260px;
		height: 260px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.08);
	}

	.hero-main {
		position: relative;
		z-index: 1;
		min-width: 0;
	}
	.hero-kicker {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 4px 12px;
		border-radius: 20px;
		font-size: 12px;
		letter-spacing: 1px;
		background: rgba(255, 255, 255, 0.16);
		border: 1px solid rgba(255, 255, 255, 0.26);
	}
	.hero-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #7cf5c4;
		box-shadow: 0 0 0 4px rgba(124, 245, 196, 0.22);
	}
	.hero-title {
		margin: 14px 0 6px;
		font-size: 34px;
		font-weight: 800;
		letter-spacing: 6px;
		line-height: 1.1;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
	}
	.hero-sub {
		margin: 0;
		font-size: 14px;
		letter-spacing: 1px;
		color: rgba(255, 255, 255, 0.86);
	}
	.hero-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 16px;
		span {
			padding: 4px 10px;
			border-radius: 6px;
			font-size: 12px;
			color: #eaf3ff;
			background: rgba(255, 255, 255, 0.12);
			border: 1px solid rgba(255, 255, 255, 0.18);
		}
	}
	.hero-side {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 18px;
		flex-shrink: 0;
	}
	.hero-stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(78px, 1fr));
		gap: 18px;
		text-align: center;
	}
	.hero-stat {
		b {
			display: block;
			font-size: 28px;
			font-weight: 700;
			line-height: 1.1;
			letter-spacing: 1px;
		}
		span {
			font-size: 12px;
			color: rgba(255, 255, 255, 0.78);
		}
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: flex-end;
	}
	.hero-update {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		margin-top: 10px;
		font-size: 12px;
		color: rgba(255, 255, 255, 0.78);
		cursor: pointer;
		user-select: none;
		&:hover {
			color: #fff;
		}
		.el-icon {
			font-size: 13px;
		}
		.spinning {
			animation: spin 0.9s linear infinite;
		}
	}
	.hero-action {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 14px;
		border-radius: 8px;
		font-size: 13px;
		color: #fff;
		cursor: pointer;
		border: 1px solid rgba(255, 255, 255, 0.32);
		background: rgba(255, 255, 255, 0.14);
		transition: all 0.2s ease;
		&:hover {
			background: #fff;
			color: #0d47a1;
			transform: translateY(-1px);
		}
	}
}

/* ---------- KPI ---------- */
.kpi-row {
	.kpi-card {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 18px;
		margin-bottom: 15px;
		border-radius: 12px;
		background: #fff;
		border: 1px solid #e3ecf7;
		box-shadow: 0 2px 10px rgba(13, 71, 161, 0.05);
		transition: all 0.25s ease;
		&:hover {
			transform: translateY(-2px);
			box-shadow: 0 8px 22px rgba(13, 71, 161, 0.12);
		}
	}
	.kpi-icon {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.kpi-value {
		font-size: 26px;
		font-weight: 700;
		line-height: 1.1;
		color: #0d47a1;
		small {
			margin-left: 2px;
			font-size: 13px;
			font-weight: 500;
		}
	}
	.kpi-label {
		margin-top: 4px;
		font-size: 13px;
		font-weight: 600;
		color: #33475b;
	}
	.kpi-hint {
		margin-top: 2px;
		font-size: 12px;
		color: #93a2b5;
	}
}

/* ---------- 面板 ---------- */
.chart-row {
	.panel-card {
		margin-bottom: 15px;
	}
}
.panel-card {
	padding: 16px 18px 12px;
	border-radius: 12px;
	background: #fff;
	border: 1px solid #e3ecf7;
	box-shadow: 0 2px 10px rgba(13, 71, 161, 0.05);
	.panel-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: 6px;
	}
	.panel-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 15px;
		font-weight: 700;
		color: #0d47a1;
		i {
			width: 4px;
			height: 15px;
			border-radius: 2px;
			background: linear-gradient(180deg, #0d47a1, #42a5f5);
		}
	}
	.panel-extra {
		font-size: 12px;
		color: #93a2b5;
		white-space: nowrap;
	}
	.panel-chart {
		width: 100%;
		height: 300px;
	}
}

/* ---------- 状态 chips ---------- */
.status-chips {
	display: grid;
	grid-template-columns: repeat(5, minmax(0, 1fr));
	gap: 6px;
	padding: 4px 0 8px;
	.status-chip {
		min-width: 0;
		text-align: center;
		padding: 6px 2px;
		border-radius: 8px;
		font-size: 11px;
		color: #5b6b80;
		background: #f4f7fc;
		white-space: nowrap;
		b {
			display: block;
			margin-top: 2px;
			font-size: 14px;
			color: #0d47a1;
		}
		&.pending b {
			color: #ef6c00;
		}
		&.processing b {
			color: #1565c0;
		}
		&.completed b,
		&.closed b {
			color: #2e7d32;
		}
	}
}

/* ---------- 智能体链路 ---------- */
.agent-card {
	.agent-chain {
		display: flex;
		align-items: stretch;
		gap: 8px;
		padding: 10px 0 6px;
		overflow-x: auto;
	}
	.agent-step {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 1;
		min-width: 190px;
		padding: 14px 16px;
		border-radius: 10px;
		background: linear-gradient(180deg, #f7faff 0%, #eef5fd 100%);
		border: 1px solid #e3ecf7;
		transition: all 0.2s ease;
		&:hover {
			border-color: #90caf9;
			box-shadow: 0 6px 18px rgba(13, 71, 161, 0.1);
		}
	}
	.agent-index {
		width: 30px;
		height: 30px;
		flex-shrink: 0;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 700;
		color: #fff;
		background: linear-gradient(135deg, #0d47a1, #1e88e5);
	}
	.agent-name {
		font-size: 13px;
		font-weight: 700;
		color: #0d47a1;
		white-space: nowrap;
	}
	.agent-desc {
		margin-top: 3px;
		font-size: 12px;
		line-height: 1.5;
		color: #7b8ba1;
	}
	.agent-arrow {
		position: absolute;
		right: -13px;
		top: 50%;
		transform: translateY(-50%);
		color: #90caf9;
		font-size: 14px;
		z-index: 1;
	}
}

/* ---------- 表格 / 待办 ---------- */
.table-user {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	.table-avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		font-weight: 600;
		color: #fff;
		background: linear-gradient(135deg, #1565c0, #42a5f5);
	}
}
.todo-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
	height: 300px;
	overflow-y: auto;
	padding-right: 4px;
}
.todo-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 10px;
	padding: 12px 14px;
	border-radius: 10px;
	background: #f7faff;
	border: 1px solid #e8f0fa;
	cursor: pointer;
	transition: all 0.2s ease;
	&:hover {
		border-color: #90caf9;
		background: #eef5fd;
	}
	&.overdue {
		background: #fff5f5;
		border-color: #ffcdd2;
	}
	.todo-title {
		font-size: 14px;
		font-weight: 600;
		color: #33475b;
	}
	.todo-meta {
		display: flex;
		gap: 12px;
		margin-top: 4px;
		font-size: 12px;
		color: #93a2b5;
	}
	.todo-side {
		text-align: right;
		flex-shrink: 0;
	}
	.todo-deadline {
		margin-top: 6px;
		font-size: 12px;
		color: #93a2b5;
		&.danger {
			color: #d32f2f;
			font-weight: 600;
		}
	}
}
.todo-empty {
	height: 300px;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #93a2b5;
	font-size: 13px;
	background: #f7faff;
	border-radius: 10px;
}
.overdue-text {
	color: #d32f2f;
	font-weight: 600;
}

@media (max-width: 1200px) {
	.home-hero {
		flex-direction: column;
		.hero-side {
			align-items: flex-start;
		}
		.hero-actions {
			justify-content: flex-start;
		}
	}
}
@media (max-width: 768px) {
	.home-hero {
		padding: 20px;
		.hero-title {
			font-size: 26px;
			letter-spacing: 4px;
		}
		.hero-stats {
			grid-template-columns: repeat(2, 1fr);
			gap: 12px;
		}
	}
}
</style>
