<template>
	<div class="system-role-container layout-padding">
		<div class="system-role-padding layout-padding-auto layout-padding-view">
			<div class="system-user-search mb15">
				<el-input
					v-model="state.tableData.param.search"
					size="default"
					placeholder="请输入用户名"
					clearable
					prefix-icon="Search"
					style="max-width: 200px"
					@keyup.enter="getTableData()"
					@clear="getTableData()"
				>
				</el-input>
				<el-button size="default" type="primary" class="predict-button" style="margin-left: 10px;" @click="getTableData()">
					<el-icon>
						<ele-Search />
					</el-icon>
					查询
				</el-button>
				<el-button size="default" type="success" class="predict-button" @click="onOpenAddRole('add')">
					<el-icon>
						<ele-FolderAdd />
					</el-icon>
					添加
				</el-button>
			</div>
			<el-table :data="state.tableData.data" v-loading="state.tableData.loading" style="width: 100%">
				<el-table-column prop="num" label="序号" width="80" align="center" />
				<el-table-column prop="username" label="账号" show-overflow-tooltip width="130" align="center"></el-table-column>

				<el-table-column prop="name" label="姓名" show-overflow-tooltip width="100" align="center"></el-table-column>
				<el-table-column prop="sex" label="性别" show-overflow-tooltip width="80" align="center"></el-table-column>
				<el-table-column prop="email" label="邮箱" align="center" />
				<el-table-column prop="tel" label="手机号码" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="role" label="角色" show-overflow-tooltip align="center"></el-table-column>
				<el-table-column prop="avatar" label="头像" align="center" width="100">
					<template #default="scope">
						<el-image
							class="user-avatar"
							:src="resolveAvatar(scope.row.avatar, scope.row.name, scope.row.username)"
							:preview-src-list="[resolveAvatar(scope.row.avatar, scope.row.name, scope.row.username)]"
							:preview-teleported="true"
							:hide-on-click-modal="true"
							fit="cover"
						>
							<template #error>
								<div class="avatar-fallback">{{ (scope.row.name || scope.row.username || '?').slice(0, 1) }}</div>
							</template>
						</el-image>
					</template>
				</el-table-column>
				<el-table-column label="操作" width="150">
					<template #default="scope">
						<el-button size="small" text type="primary" @click="onOpenEditRole('edit', scope.row)">修改</el-button>
						<el-button size="small" text type="primary" @click="onRowDel(scope.row)">删除</el-button>
					</template>
				</el-table-column>
			</el-table>
			<el-pagination
				@size-change="onHandleSizeChange"
				@current-change="onHandleCurrentChange"
				class="mt15"
				:pager-count="5"
				:page-sizes="[10, 20, 30]"
				v-model:current-page="state.tableData.param.pageNum"
				background
				v-model:page-size="state.tableData.param.pageSize"
				layout="total, sizes, prev, pager, next, jumper"
				:total="state.tableData.total"
			>
			</el-pagination>
		</div>
		<RoleDialog ref="roleDialogRef" @refresh="getTableData()" />
	</div>
</template>

<script setup lang="ts" name="systemRole">
import { defineAsyncComponent, reactive, onMounted, ref } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import request from '/@/utils/request';
import { resolveAvatar } from '/@/utils/avatar';

// 引入组件
const RoleDialog = defineAsyncComponent(() => import('./dialog.vue'));

// 定义变量内容
const roleDialogRef = ref();
const state = reactive<SysRoleState>({
	tableData: {
		data: [] as any,
		total: 0,
		loading: false,
		param: {
			search: '',
			pageNum: 1,
			pageSize: 10,
		},
	},
});

const getTableData = () => {
	state.tableData.loading = true;
	request
		.get('/api/user', {
			params: state.tableData.param,
		})
		.then((res) => {
			if (res.code == 0) {
				state.tableData.data = [];
				setTimeout(() => {
					state.tableData.loading = false;
				}, 500);
				for (let i = 0; i < res.data.records.length; i++) {
					state.tableData.data[i] = res.data.records[i];
					state.tableData.data[i]['num'] = i + 1;
				}
				state.tableData.total = res.data.total;
			} else {
				ElMessage({
					type: 'error',
					message: res.msg,
				});
			}
		});
};

// 打开新增角色弹窗
const onOpenAddRole = (type: string) => {
	roleDialogRef.value.openDialog(type);
};
// 打开修改角色弹窗
const onOpenEditRole = (type: string, row: Object) => {
	roleDialogRef.value.openDialog(type, row);
};

// 删除角色
const onRowDel = (row: any) => {
	ElMessageBox.confirm(`此操作将永久删除该信息，是否继续?`, '提示', {
		confirmButtonText: '确认',
		cancelButtonText: '取消',
		type: 'warning',
	})
		.then(() => {
			console.log(row);
			request.delete('/api/user/' + row.id).then((res) => {
				if (res.code == 0) {
					console.log(res.data);
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
		.catch(() => {});
};
// 分页改变
const onHandleSizeChange = (val: number) => {
	state.tableData.param.pageSize = val;
	getTableData();
};
// 分页改变
const onHandleCurrentChange = (val: number) => {
	state.tableData.param.pageNum = val;
	getTableData();
};

// 页面加载时
onMounted(() => {
	getTableData();
});
</script>

<style scoped lang="scss">
.predict-button {
	background: #1E88E5;
    border-color: #1E88E5;
    &:hover {
        background: #1565C0;
        border-color: #1565C0;
    }
}
.system-role-container {
	.system-role-padding {
		padding: 15px;
		.el-table {
			flex: 1;
		}
	}
}

.user-avatar {
	width: 42px;
	height: 42px;
	border-radius: 50%;
	border: 2px solid #e3f2fd;
	box-shadow: 0 2px 6px rgba(13, 71, 161, 0.12);
	background: #f4f8fd;
	cursor: zoom-in;
	transition: transform 0.2s ease, box-shadow 0.2s ease;
	&:hover {
		transform: scale(1.06);
		box-shadow: 0 4px 12px rgba(13, 71, 161, 0.22);
	}
}

.avatar-fallback {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 14px;
	font-weight: 600;
	color: #fff;
	background: linear-gradient(135deg, #1565c0, #42a5f5);
}
</style>
