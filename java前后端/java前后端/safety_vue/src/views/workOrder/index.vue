<template>
	<div class="system-role-container layout-padding">
		<div class="system-role-padding layout-padding-auto layout-padding-view">
			<div class="system-user-search mb15">
				<el-input v-model="state.tableData.param.search1" size="default" placeholder="请输入工单编号"
					clearable style="max-width: 180px" @keyup.enter="getTableData()" @clear="getTableData()"> </el-input>
				<el-input v-model="state.tableData.param.search2" size="default" placeholder="搜隐患类型 / 描述 / 位置"
					clearable style="max-width: 200px; margin-left: 15px" @keyup.enter="getTableData()" @clear="getTableData()">
				</el-input>
				<el-select v-model="state.tableData.param.status" placeholder="请选择状态" size="default" clearable teleported
					style="width: 160px; margin-left: 15px">
					<el-option label="待处理" value="pending"></el-option>
					<el-option label="处理中" value="processing"></el-option>
					<el-option label="已完成" value="completed"></el-option>
					<el-option label="超时完成" value="timeout"></el-option>
					<el-option label="已关闭" value="closed"></el-option>
				</el-select>
				<el-button size="default" type="primary" class="predict-button" @click="getTableData()">
					<el-icon>
						<Search />
					</el-icon>
					搜索
				</el-button>
				<el-button size="default" type="success" class="export-button" @click="exportExcel()"
					v-if="state.canExport">
					<el-icon>
						<Download />
					</el-icon>
					导出Excel台账
				</el-button>
			</div>
			<el-table :data="state.tableData.data" size="small" class="order-table" style="width: 100%">
				<el-table-column prop="num" label="序号" width="60" align="center" />
				<el-table-column prop="orderNo" label="工单编号" width="160" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="hiddenType" label="隐患类型" width="120" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="level" label="隐患等级" width="100" align="center">
					<template #default="scope">
						<el-tag :type="getLevelType(scope.row.level)">{{ scope.row.level }}</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="location" label="隐患位置" width="110" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="description" label="隐患描述" width="140" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="responsible" label="责任人" width="100" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="status" label="状态" width="100" align="center">
					<template #default="scope">
						<el-tag :type="getStatusType(scope.row.status)">{{ getStatusText(scope.row.status) }}</el-tag>
					</template>
				</el-table-column>
				<el-table-column prop="recheckStatus" label="AI复核" width="100" align="center">
					<template #default="scope">
						<el-tag :type="getRecheckType(scope.row.recheckStatus)" v-if="scope.row.recheckStatus">{{ getRecheckText(scope.row.recheckStatus) }}</el-tag>
						<span v-else>-</span>
					</template>
				</el-table-column>
				<el-table-column prop="remindCount" label="督办" width="80" align="center">
					<template #default="scope">
						<span v-if="scope.row.remindCount > 0" style="color: #F56C6C; font-weight: bold;">{{ scope.row.remindCount }}次</span>
						<span v-else>-</span>
					</template>
				</el-table-column>
				<el-table-column prop="deadline" label="整改时限" width="185" align="center">
					<template #default="scope">
						<div class="deadline-cell" :class="{ 'deadline-overdue': isOverdue(scope.row) }">
							<div class="deadline-raw">
								{{ scope.row.deadline || '-' }}
								<el-tag v-if="isOverdue(scope.row)" size="small" type="danger" effect="dark" class="overdue-tag">逾期</el-tag>
							</div>
							<div class="deadline-due" v-if="deadlineText(scope.row)">截止 {{ deadlineText(scope.row) }}</div>
						</div>
					</template>
				</el-table-column>
				<el-table-column prop="createTime" label="创建时间" width="160" align="center" />
				<el-table-column label="操作" width="160" align="center" fixed="right">
					<template #default="scope">
						<el-button size="small" text type="primary" @click="viewDetail(scope.row)">查看详情</el-button>
						<el-button size="small" text type="success" @click="handleOrder(scope.row)"
							v-if="scope.row.status === 'pending'">处理</el-button>
						<el-button size="small" text type="warning" @click="closeOrder(scope.row)"
							v-if="scope.row.status === 'completed' || scope.row.status === 'timeout'">关闭</el-button>
					</template>
				</el-table-column>
			</el-table>
			<el-pagination @size-change="handleSizeChange" @current-change="handleCurrentChange"
				:current-page="state.tableData.pageNum" :page-sizes="[5, 10, 20, 50]" :page-size="state.tableData.pageSize"
				layout="total,sizes,prev,pager,next,jumper" :total="state.tableData.total">
			</el-pagination>
		</div>
		<el-dialog v-model="state.dialogVisible" title="工单详情" width="850px" :max-height="700" class="order-dialog">
			<el-form :model="state.orderDetail" label-width="100px">
				<el-form-item label="工单编号">
					{{ state.orderDetail.orderNo }}
				</el-form-item>
				<el-form-item label="隐患类型">
					{{ state.orderDetail.hiddenType }}
				</el-form-item>
				<el-form-item label="隐患等级">
					<el-tag :type="getLevelType(state.orderDetail.level)">{{ state.orderDetail.level }}</el-tag>
				</el-form-item>
				<el-form-item label="隐患位置">
					{{ state.orderDetail.location }}
				</el-form-item>
				<el-form-item label="隐患描述">
					{{ state.orderDetail.description }}
				</el-form-item>
				<el-form-item label="责任人">
					{{ state.orderDetail.responsible }}
				</el-form-item>
				<el-form-item label="整改建议">
					<el-input
						:model-value="state.orderDetail.suggestion"
						type="textarea"
						:rows="4"
						readonly
						class="suggestion-textarea"
					/>
				</el-form-item>
				<el-form-item label="整改时限">
					{{ state.orderDetail.deadline || '-' }}
					<span v-if="deadlineText(state.orderDetail)" class="detail-due">（截止 {{ deadlineText(state.orderDetail) }}）</span>
				</el-form-item>
				<el-form-item label="当前状态">
					<el-tag :type="getStatusType(state.orderDetail.status)">{{ getStatusText(state.orderDetail.status) }}</el-tag>
				</el-form-item>

				<!-- AI二次复核区域 -->
				<el-divider content-position="left">AI二次复核</el-divider>
				<el-form-item label="复核状态" v-if="state.orderDetail.recheckStatus">
					<el-tag :type="getRecheckType(state.orderDetail.recheckStatus)">{{ getRecheckText(state.orderDetail.recheckStatus) }}</el-tag>
				</el-form-item>
				<el-form-item label="复核结果" v-if="state.orderDetail.recheckResult">
					<el-input :model-value="state.orderDetail.recheckResult" type="textarea" :rows="3" readonly class="suggestion-textarea" />
				</el-form-item>
				<el-form-item label="整改图片" v-if="rectifyImgBlobUrl">
					<el-image :src="rectifyImgBlobUrl" style="width: 200px; height: 150px" fit="cover" :preview-src-list="[rectifyImgBlobUrl]"></el-image>
				</el-form-item>
				<el-form-item label="复核时间" v-if="state.orderDetail.recheckTime">
					{{ state.orderDetail.recheckTime }}
				</el-form-item>
				<el-form-item label="整改图上传" v-if="state.canRecheck && state.orderDetail.status !== 'closed'">
					<el-upload
						drag
						:auto-upload="false"
						:show-file-list="true"
						:limit="1"
						:file-list="state.recheckFileList"
						accept="image/*"
						:on-change="onRecheckFileChange"
						:on-remove="onRecheckFileRemove"
						class="recheck-uploader"
					>
						<el-icon class="el-icon--upload"><upload-filled /></el-icon>
						<div class="el-upload__text">
							点击或拖拽整改图片到此处进行上传（<em>仅支持图片格式</em>）
						</div>
						<template #tip>
							<div class="el-upload__tip">
								支持 jpg/png/jpeg 格式，上传后点击下方"AI复核"按钮开始检测
							</div>
						</template>
					</el-upload>
					<el-button size="default" type="primary" @click="doRecheck()" :loading="state.recheckLoading" style="margin-top: 15px; width: 150px; height: 40px; font-size: 15px;">
						AI复核
					</el-button>
				</el-form-item>

				<!-- 审核意见区域 -->
				<el-divider content-position="left">审核意见</el-divider>
				<el-form-item label="审核状态" v-if="state.orderDetail.auditOpinion">
					<div style="width: 100%">
						<el-input :model-value="state.orderDetail.auditOpinion" type="textarea" :rows="3" readonly class="suggestion-textarea" />
						<div style="margin-top: 5px; color: #909399; font-size: 12px;">
							审核人：{{ state.orderDetail.auditUser }} | 审核时间：{{ state.orderDetail.auditTime }}
						</div>
					</div>
				</el-form-item>
				<el-form-item label="填写意见" v-if="state.canAudit">
					<el-input v-model="state.auditOpinion" type="textarea" :rows="3" placeholder="请输入审核意见" style="max-width: 500px"></el-input>
					<el-button size="default" type="warning" @click="doAudit()" style="margin-left: 10px">提交审核</el-button>
				</el-form-item>

				<!-- 督办提醒区域 -->
				<el-divider content-position="left">督办提醒</el-divider>
				<el-form-item label="督办次数">
					<span v-if="state.orderDetail.remindCount > 0" style="color: #F56C6C; font-weight: bold;">已督办 {{ state.orderDetail.remindCount }} 次</span>
					<span v-else style="color: #909399;">暂无督办记录</span>
					<span v-if="state.orderDetail.lastRemindTime" style="margin-left: 15px; color: #909399; font-size: 12px;">最后督办：{{ state.orderDetail.lastRemindTime }}</span>
				</el-form-item>
				<el-form-item label="督办操作" v-if="state.canRemind && state.orderDetail.status !== 'closed'">
					<el-button size="default" type="danger" @click="doRemind()" :loading="state.remindLoading">发送督办提醒</el-button>
				</el-form-item>

				<el-divider content-position="left">时间信息</el-divider>
				<el-form-item label="创建时间">
					{{ state.orderDetail.createTime }}
				</el-form-item>
				<el-form-item label="更新时间">
					{{ state.orderDetail.updateTime }}
				</el-form-item>
			</el-form>
			<div slot="footer">
				<el-button @click="state.dialogVisible = false">关闭</el-button>
				<el-button type="primary" @click="handleOrder(state.orderDetail)"
					v-if="state.orderDetail.status === 'pending'">确认处理</el-button>
				<el-button type="success" @click="completeOrder(state.orderDetail)"
					v-if="state.orderDetail.status === 'processing'">处理完成</el-button>
				<el-button type="warning" @click="closeOrder(state.orderDetail)"
					v-if="state.orderDetail.status === 'completed' || state.orderDetail.status === 'timeout'">关闭工单</el-button>
			</div>
		</el-dialog>
	</div>
</template>

<script lang="ts">
import { reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Search, Download, UploadFilled } from '@element-plus/icons-vue';
import Cookies from 'js-cookie';
import {
	getWorkOrderList, getWorkOrderById, processWorkOrder, completeWorkOrder, closeWorkOrder,
	exportWorkOrder, auditWorkOrder, remindWorkOrder, recheckWorkOrder
} from '/@/api/workOrder';

export default {
	name: 'workOrder',
	setup() {
		// 权限控制
		const userRole = Cookies.get('role');
		const route = useRoute();
		const canExport = ['管理员', '项目经理', '专职安全员'].includes(userRole);
		const canAudit = ['管理员', '项目经理'].includes(userRole);
		const canRemind = ['管理员', '项目经理', '专职安全员'].includes(userRole);
		const canRecheck = ['管理员', '项目经理', '专职安全员'].includes(userRole);

		const state = reactive({
			tableData: {
				data: [],
				total: 0,
				pageNum: 1,
				pageSize: 10,
				param: {
					search1: '',
					search2: '',
					status: '',
				},
			},
			dialogVisible: false,
			orderDetail: {} as any,
			recheckFileList: [] as any[],
			auditOpinion: '',
			recheckLoading: false,
			remindLoading: false,
			canExport,
			canAudit,
			canRemind,
			canRecheck,
		});

		const getTableData = () => {
			getWorkOrderList({
				pageNum: state.tableData.pageNum,
				pageSize: state.tableData.pageSize,
				...state.tableData.param,
			}).then((res: any) => {
				if (res.code == 0) {
					state.tableData.data = res.data.list || [];
					state.tableData.data.forEach((item: any, index: number) => {
						item.num = (state.tableData.pageNum - 1) * state.tableData.pageSize + index + 1;
					});
					state.tableData.total = res.data.total || 0;
				} else {
					ElMessage.error(res.msg || '获取工单列表失败');
				}
			}).catch(() => {
				ElMessage.error('获取工单列表失败');
			});
		};

		const handleSizeChange = (val: number) => {
			state.tableData.pageSize = val;
			state.tableData.pageNum = 1;
			getTableData();
		};

		const handleCurrentChange = (val: number) => {
			state.tableData.pageNum = val;
			getTableData();
		};

		const getLevelType = (level: string) => {
			const types: Record<string, string> = {
				'重大隐患': 'danger',
				'较大隐患': 'warning',
				'一般隐患': 'info',
				'轻微隐患': 'success',
			};
			return types[level] || 'info';
		};

		const getStatusType = (status: string) => {
			const types: Record<string, string> = {
				'pending': 'warning',
				'processing': 'info',
				'completed': 'success',
				'timeout': 'danger',
				'closed': '',
			};
			return types[status] ?? '';
		};

		const getStatusText = (status: string) => {
			const texts: Record<string, string> = {
				'pending': '待处理',
				'processing': '处理中',
				'completed': '已完成',
				'timeout': '超时完成',
				'closed': '已关闭',
			};
			return texts[status] || status;
		};

		const getRecheckType = (status: string) => {
			const types: Record<string, string> = {
				'pending': 'warning',
				'passed': 'success',
				'failed': 'danger',
			};
			return types[status] || 'info';
		};

		const getRecheckText = (status: string) => {
			const texts: Record<string, string> = {
				'pending': '待复核',
				'passed': '复核通过',
				'failed': '复核不通过',
			};
			return texts[status] || status;
		};

		// 整改时限兼容两种格式：日期（2026-08-26）或时长（2小时 / 24小时 / 1天）
		const pad2 = (n: number) => String(n).padStart(2, '0');
		const parseDue = (row: any): string => {
			const raw = String(row?.deadline || '').trim();
			if (!raw) return '';
			if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.replace('T', ' ').slice(0, 16);
			const matched = raw.match(/^(\d+(?:\.\d+)?)\s*(小时|天|分钟)/);
			if (matched && row.createTime) {
				const base = new Date(String(row.createTime).replace(/-/g, '/'));
				if (!isNaN(base.getTime())) {
					const value = parseFloat(matched[1]);
					const minutes = matched[2] === '天' ? value * 1440 : matched[2] === '小时' ? value * 60 : value;
					const due = new Date(base.getTime() + minutes * 60000);
					return `${due.getFullYear()}-${pad2(due.getMonth() + 1)}-${pad2(due.getDate())} ${pad2(due.getHours())}:${pad2(due.getMinutes())}`;
				}
			}
			return '';
		};
		const deadlineText = (row: any) => parseDue(row);
		const isOverdue = (row: any) => {
			if (!row) return false;
			if (['completed', 'timeout', 'closed'].includes(row.status)) return false;
			const due = parseDue(row);
			if (!due) return false;
			const now = new Date();
			const nowText = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
			return due < nowText;
		};

		const viewDetail = (row: any) => {
			state.orderDetail = row;
			state.recheckFileList = [];
			state.auditOpinion = '';
			state.dialogVisible = true;
			// 加载整改图片
			loadRectifyImg(row.rectifyImg);
		};

		// 整改图片文件处理
		const onRecheckFileChange = (file: any, fileList: any[]) => {
			state.recheckFileList = fileList.slice(-1);
		};
		const onRecheckFileRemove = (_file: any, fileList: any[]) => {
			state.recheckFileList = fileList;
		};

		const handleOrder = (row: any) => {
			processWorkOrder(row.id).then((res: any) => {
				if (res.code == 0) {
					ElMessage.success('工单已开始处理');
					row.status = 'processing';
					state.dialogVisible = false;
					getTableData();
				} else {
					ElMessage.error(res.msg || '操作失败');
				}
			}).catch(() => {
				ElMessage.error('操作失败');
			});
		};

		const completeOrder = (row: any) => {
			completeWorkOrder(row.id).then((res: any) => {
				if (res.code == 0) {
					ElMessage.success(res.msg || '工单处理完成');
					state.dialogVisible = false;
					getTableData();
				} else {
					ElMessage.error(res.msg || '操作失败');
				}
			}).catch(() => {
				ElMessage.error('操作失败');
			});
		};

		const closeOrder = (row: any) => {
			closeWorkOrder(row.id).then((res: any) => {
				if (res.code == 0) {
					ElMessage.success('工单已关闭');
					row.status = 'closed';
					state.dialogVisible = false;
					getTableData();
				} else {
					ElMessage.error(res.msg || '操作失败');
				}
			}).catch(() => {
				ElMessage.error('操作失败');
			});
		};

		// Excel导出
		const exportExcel = () => {
			exportWorkOrder(state.tableData.param).then((res: any) => {
				const blob = new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
				const url = window.URL.createObjectURL(blob);
				const link = document.createElement('a');
				link.href = url;
				link.download = '安全台账_' + new Date().getTime() + '.xlsx';
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				window.URL.revokeObjectURL(url);
				ElMessage.success('导出成功');
			}).catch(() => {
				ElMessage.error('导出失败');
			});
		};

		// 审核意见
		const doAudit = () => {
			if (!state.auditOpinion || state.auditOpinion.trim() === '') {
				ElMessage.warning('请输入审核意见');
				return;
			}
			const userName = Cookies.get('userName') || '';
			auditWorkOrder(state.orderDetail.id, {
				auditOpinion: state.auditOpinion,
				auditUser: userName,
			}).then((res: any) => {
				if (res.code == 0) {
					ElMessage.success('审核意见已提交');
					state.orderDetail.auditOpinion = state.auditOpinion;
					state.orderDetail.auditUser = userName;
					state.orderDetail.auditTime = new Date().toLocaleString();
					state.auditOpinion = '';
					getTableData();
				} else {
					ElMessage.error(res.msg || '提交失败');
				}
			}).catch(() => {
				ElMessage.error('提交失败');
			});
		};

		// 督办提醒
		const doRemind = () => {
			ElMessageBox.confirm('确定要向责任人发送督办提醒吗？', '提示', {
				confirmButtonText: '确定',
				cancelButtonText: '取消',
				type: 'warning',
			}).then(() => {
				state.remindLoading = true;
				const userName = Cookies.get('userName') || '';
				remindWorkOrder(state.orderDetail.id, { remindUser: userName }).then((res: any) => {
					state.remindLoading = false;
					if (res.code == 0) {
						ElMessage.success(res.msg || '督办提醒已发送');
						state.orderDetail.remindCount = (state.orderDetail.remindCount || 0) + 1;
						state.orderDetail.lastRemindTime = new Date().toLocaleString();
						getTableData();
					} else {
						ElMessage.error(res.msg || '督办失败');
					}
				}).catch(() => {
					state.remindLoading = false;
					ElMessage.error('督办失败');
				});
			}).catch(() => {});
		};

		// AI二次复核（上传文件方式）
		const doRecheck = () => {
			if (!state.recheckFileList || state.recheckFileList.length === 0) {
				ElMessage.warning('请选择整改图片');
				return;
			}
			const file = state.recheckFileList[0].raw;
			if (!file) {
				ElMessage.warning('请选择有效的整改图片文件');
				return;
			}
			state.recheckLoading = true;
			const formData = new FormData();
			formData.append('rectifyImgFile', file);
			recheckWorkOrder(state.orderDetail.id, formData).then((axiosRes: any) => {
				state.recheckLoading = false;
				const res = axiosRes.data;
				if (res.code == 0) {
					const data = res.data;
					state.orderDetail.recheckStatus = data.recheckStatus;
					state.orderDetail.recheckResult = data.recheckResult;
					state.orderDetail.recheckTime = data.recheckTime;
					// rectifyImg字段使用后端返回的URL，并加载为Blob URL
					if (data.rectifyImg) {
						state.orderDetail.rectifyImg = data.rectifyImg;
						loadRectifyImg(data.rectifyImg);
					}
					if (data.recheckStatus === 'passed') {
						ElMessage.success('AI复核通过：隐患已消除');
					} else {
						ElMessage.warning(data.recheckResult || 'AI复核不通过');
					}
					state.recheckFileList = [];
					getTableData();
				} else {
					ElMessage.error(res.msg || '复核失败');
				}
			}).catch((err: any) => {
				state.recheckLoading = false;
				console.error(err);
				ElMessage.error('复核失败，请确认检测服务已启动');
			});
		};

		getTableData();

		// 从消息中心跳转过来时，直接打开对应工单详情
		if (route.query.id) {
			const orderId = Number(route.query.id);
			if (orderId) {
				getWorkOrderById(orderId)
					.then((res: any) => {
						if (res.code == 0 && res.data) viewDetail(res.data);
					})
					.catch(() => ElMessage.error('工单详情加载失败'));
			}
		}

		// 转换图片URL，将后端完整URL转换为通过代理访问的路径
		const getImageUrl = (url: string) => {
			if (!url) return url;
			// 将 http://localhost:9999/files/xxx 转换为 /api/files/xxx
			return url.replace(/https?:\/\/localhost:9999/, '/api');
		};

		// 存储整改图片的Blob URL
		const rectifyImgBlobUrl = ref('');

		// 加载整改图片为Blob URL
		const loadRectifyImg = async (url: string) => {
			if (!url) {
				rectifyImgBlobUrl.value = '';
				return;
			}
			try {
				const proxyUrl = getImageUrl(url);
				const response = await fetch(proxyUrl);
				if (response.ok) {
					const blob = await response.blob();
					rectifyImgBlobUrl.value = URL.createObjectURL(blob);
				} else {
					rectifyImgBlobUrl.value = '';
				}
			} catch (e) {
				console.error('加载整改图片失败:', e);
				rectifyImgBlobUrl.value = '';
			}
		};

		return {
			state,
			getTableData,
			getImageUrl,
			rectifyImgBlobUrl,
			loadRectifyImg,
			handleSizeChange,
			handleCurrentChange,
			getLevelType,
			getStatusType,
			getStatusText,
			isOverdue,
			deadlineText,
			getRecheckType,
			getRecheckText,
			viewDetail,
			handleOrder,
			completeOrder,
			closeOrder,
			exportExcel,
			doAudit,
			doRemind,
			doRecheck,
			onRecheckFileChange,
			onRecheckFileRemove,
			Search,
			Download,
			UploadFilled,
		};
	},
};
</script>

<style scoped lang="scss">
.predict-button {
	margin-left: 10px;
	background: #1E88E5;
	border-color: #1E88E5;

	&:hover {
		background: #1565C0;
		border-color: #1565C0;
	}
}

.export-button {
	margin-left: 10px;
	background: #43A047;
	border-color: #43A047;

	&:hover {
		background: #2E7D32;
		border-color: #2E7D32;
	}
}

.system-role-container {
	.system-role-padding {
		padding: 15px;
		background: #fff;
		border-radius: 8px;
	}
}

:deep(.el-table) {
	--el-table-header-bg-color: #F4F7FC;
	--el-table-row-hover-bg-color: #E9F2FD;
	--el-table-border-color: #E3ECF7;
}

.deadline-overdue {
	color: #D32F2F;
	font-weight: 600;
}

.deadline-cell {
	line-height: 1.4;
	.deadline-raw {
		font-size: 13px;
	}
	.deadline-due {
		margin-top: 2px;
		font-size: 11px;
		color: #93A2B5;
	}
	&.deadline-overdue .deadline-due {
		color: #E57373;
	}
}

.detail-due {
	color: #93A2B5;
	font-size: 12px;
	margin-left: 4px;
}

.overdue-tag {
	margin-left: 6px;
	transform: scale(0.9);
}

.suggestion-textarea {
	:deep(.el-textarea__inner) {
		resize: vertical;
		background-color: #f8f9fa;
		color: #333;
		line-height: 1.6;
	}
}

.order-dialog {
	:deep(.el-dialog__body) {
		max-height: 600px;
		overflow-y: auto;
	}

	:deep(.el-divider__text) {
		font-weight: bold;
		color: #1E88E5;
	}
}
</style>
