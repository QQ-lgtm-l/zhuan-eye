<template>
	<div class="system-role-container layout-padding">
		<div class="system-role-padding layout-padding-auto layout-padding-view">
			<div class="system-user-search mb15">
				<el-input v-model="state.tableData.param.search1" size="default" placeholder="请输入识别时间" style="max-width: 180px"> </el-input>
				<el-input v-model="state.tableData.param.search3" size="default" placeholder="请输入最低阈值" style="max-width: 180px; margin-left: 15px"></el-input>
				<el-button size="default" type="primary" class="predict-button" @click="getTableData()">
					<el-icon>
						<ele-Search />
					</el-icon>
					查询
				</el-button>
			</div>
			<el-table :data="state.tableData.data" v-loading="state.tableData.loading" style="width: 100%">
				<el-table-column type="expand">
					<template #default="props">
						<div m="4">
							<p style="margin-left: 20px; font-size: 16px; font-weight: 800;">详细检测结果：</p>
							<el-table :data="props.row.family">
								<el-table-column prop="label" label="隐患类型" align="center">
									<template #default="scope">
										<el-tag v-if="scope.row.label && scope.row.label !== '未检测到安全隐患'" type="danger" size="small">{{ decodeUnicode(scope.row.label) }}</el-tag>
										<span v-else style="color: #67C23A;">{{ decodeUnicode(scope.row.label) }}</span>
									</template>
								</el-table-column>
								<el-table-column prop="confidence" label="置信度" show-overflow-tooltip align="center"></el-table-column>
								<el-table-column prop="startTime" label="检测时间" align="center" />
							</el-table>
						</div>
					</template>
				</el-table-column>
				<el-table-column prop="num" label="序号" width="80" align="center" />
				<el-table-column prop="inputVideo" label="原视频" width="180" align="center">
					<template #default="scope">
						<video class="video" controls style="width: 160px; height: 100px;">
							<source :src="scope.row.inputVideo" type="video/mp4" />
						</video>
					</template>
				</el-table-column>
				<el-table-column prop="outVideo" label="处理结果" width="180" align="center">
					<template #default="scope">
						<video class="video" preload="auto" controls style="width: 160px; height: 100px;">
							<source :src="scope.row.outVideo" type="video/mp4" />
						</video>
					</template>
				</el-table-column>
				<el-table-column prop="weight" label="识别权重" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="conf" label="最小阈值" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="label" label="识别结果" show-overflow-tooltip align="center">
					<template #default="scope">
						{{ formatLabel(scope.row.label) }}
					</template>
				</el-table-column>
				<el-table-column prop="confidence" label="置信度" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="hazardLevel" label="隐患等级" show-overflow-tooltip align="center">
					<template #default="scope">
						<el-tag v-if="scope.row.hazardLevel && scope.row.hazardLevel !== ''" :type="getHazardType(scope.row.hazardLevel)" size="small">{{ scope.row.hazardLevel }}</el-tag>
						<span v-else style="color: #67C23A;">无隐患</span>
					</template>
				</el-table-column>
				<el-table-column prop="username" label="识别用户" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="startTime" label="识别时间" width="180" align="center"></el-table-column>
				<el-table-column label="操作" width="100" align="center">
					<template #default="scope">
						<el-button size="small" text type="primary" @click="onRowDel(scope.row)">删除</el-button>
					</template>
				</el-table-column>
			</el-table>
			<el-pagination @size-change="onHandleSizeChange" @current-change="onHandleCurrentChange" class="mt15"
				:pager-count="5" :page-sizes="[10, 20, 30]" v-model:current-page="state.tableData.param.pageNum"
				background v-model:page-size="state.tableData.param.pageSize"
				layout="total, sizes, prev, pager, next, jumper" :total="state.tableData.total">
			</el-pagination>
		</div>
	</div>
</template>

<script setup lang="ts" name="systemRole">
import { reactive, onMounted, ref } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import request from '/@/utils/request';
import { useUserInfo } from '/@/stores/userInfo';
import { storeToRefs } from 'pinia';

const stores = useUserInfo();
const { userInfos } = storeToRefs(stores);

interface SysRoleState {
	tableData: {
		data: any[];
		total: number;
		loading: boolean;
		param: {
			search: string;
			search1: string;
			search2: string;
			search3: string;
			pageNum: number;
			pageSize: number;
		};
	};
}

const state = reactive<SysRoleState>({
	tableData: {
		data: [],
		total: 0,
		loading: false,
		param: {
			search: '',
			search1: '',
			search2: '',
			search3: '',
			pageNum: 1,
			pageSize: 10,
		},
	},
});

// 唯一标识符，动态刷新
const uniqueKey = ref(0);

// Unicode转义字符串解码函数
const decodeUnicode = (str: string): string => {
	if (str == null) return '';
	try {
		// 尝试解析 JSON 数组
		try {
			const parsed = JSON.parse(str);
			if (Array.isArray(parsed)) {
				return parsed.map(item => {
					if (typeof item === 'string') {
						return item.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
					}
					return item;
				}).join('、');
			}
		} catch {
			// 不是 JSON 数组，继续处理
		}
		// 处理普通 Unicode 转义
		return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
	} catch {
		return str;
	}
};

// 格式化标签显示
const formatLabel = (label: string): string => {
	if (!label) return '-';
	try {
		// 尝试解析为 JSON 数组
		const parsed = JSON.parse(label);
		if (Array.isArray(parsed)) {
			return parsed.map(item => {
				if (typeof item === 'string') {
					// 解码可能的 Unicode 转义
					return item.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
				}
				return item;
			}).join('、');
		}
		return decodeUnicode(label);
	} catch {
		return decodeUnicode(label);
	}
};

// 根据隐患等级获取标签类型
const getHazardType = (level: string): string => {
	if (level.includes('重大')) return 'danger';
	if (level.includes('较大')) return 'warning';
	return 'info';
};

// 转换数据以适应表格显示
const transformData = (originalData: any, confidences: string[], labels: string[]) => {
	const family = labels.map((label, index) => {
		const decodedLabel = label.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
		const decodedConf = confidences[index] ? String(confidences[index]).replace('%', '') : '0';
		return {
			label: decodedLabel,
			confidence: decodedConf,
			startTime: originalData.startTime
		};
	});

	return {
		id: originalData.id,
		inputVideo: originalData.inputVideo,
		outVideo: originalData.outVideo,
		weight: originalData.weight,
		conf: originalData.conf,
		label: originalData.label,
		confidence: originalData.confidence,
		hazardLevel: originalData.hazardLevel,
		startTime: originalData.startTime,
		username: originalData.username,
		family: family
	};
};

const getTableData = () => {
	state.tableData.loading = true;
	if (userInfos.value.role !== '管理员') {
		state.tableData.param.search = userInfos.value.userName;
	}
	request
		.get('/api/videoRecords', {
			params: state.tableData.param,
		})
		.then((res) => {
			if (res.code == 0) {
				state.tableData.data = [];
				setTimeout(() => {
					state.tableData.loading = false;
				}, 500);
				const records = res.data.records;
				records.sort((a: any, b: any) => {
					if (!a.startTime) return 1;
					if (!b.startTime) return -1;
					return b.startTime.localeCompare(a.startTime);
				});
				for (let i = 0; i < records.length; i++) {
					let confidences: string[] = [];
					let labels: string[] = [];
					try {
						confidences = JSON.parse(records[i].confidence || '[]');
					} catch {
						confidences = [];
					}
					try {
						labels = JSON.parse(records[i].label || '[]');
					} catch {
						labels = [];
					}
					const transformedData = transformData(records[i], confidences, labels);
					transformedData['num'] = i + 1;
					state.tableData.data[i] = transformedData;
				}
				state.tableData.total = res.data.total;
				uniqueKey.value++;
			} else {
				ElMessage({
					type: 'error',
					message: res.msg,
				});
			}
		});
};

const onRowDel = (row: any) => {
	ElMessageBox.confirm(`此操作将永久删除该信息，是否继续?`, '提示', {
		confirmButtonText: '确认',
		cancelButtonText: '取消',
		type: 'warning',
	})
		.then(() => {
			request.delete('/api/videoRecords/' + row.id).then((res) => {
				if (res.code == 0) {
					ElMessage({
						type: 'success',
						message: '删除成功！',
					});
				} else {
					ElMessage({
						type: 'error',
						message: res.msg,
					});
				}
			});
			setTimeout(() => {
				getTableData();
			}, 500);
		})
		.catch(() => { });
};

const onHandleSizeChange = (val: number) => {
	state.tableData.param.pageSize = val;
	getTableData();
};

const onHandleCurrentChange = (val: number) => {
	state.tableData.param.pageNum = val;
	getTableData();
};

onMounted(() => {
	getTableData();
});
</script>


<style scoped lang="scss">
.system-role-container {
	.system-role-padding {
		padding: 15px;
		.el-table {
			flex: 1;
		}
	}
}

.video {
	width: 100%;
	max-height: 100%;
	height: auto;
	object-fit: contain;
}

.predict-button {
	margin-left: 10px;
	background: #1E88E5;
	border-color: #1E88E5;
	&:hover {
		background: #1565C0;
		border-color: #1565C0;
	}
}

:deep(.el-table) {
	--el-table-header-bg-color: #90CAF9;
	--el-table-row-hover-bg-color: #E3F2FD;
	--el-table-border-color: #90CAF9;
}
</style>
