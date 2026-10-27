<template>
	<div class="layout-navbars-breadcrumb-user pr15" :style="{ flex: layoutUserFlexNum }">
		<el-dropdown :show-timeout="70" :hide-timeout="50" trigger="click" @command="onComponentSizeChange" class="custom-dropdown">
			<div class="layout-navbars-breadcrumb-user-icon">
				<i class="iconfont icon-ziti" :title="$t('message.user.title0')"></i>
			</div>
			<template #dropdown>
				<el-dropdown-menu>
					<el-dropdown-item command="large" :disabled="state.disabledSize === 'large'">{{ $t('message.user.dropdownLarge') }}</el-dropdown-item>
					<el-dropdown-item command="default" :disabled="state.disabledSize === 'default'">{{ $t('message.user.dropdownDefault') }}</el-dropdown-item>
					<el-dropdown-item command="small" :disabled="state.disabledSize === 'small'">{{ $t('message.user.dropdownSmall') }}</el-dropdown-item>
				</el-dropdown-menu>
			</template>
		</el-dropdown>
		<div class="layout-navbars-breadcrumb-user-icon" @click="onSearchClick">
			<el-icon :title="$t('message.user.title2')">
				<ele-Search />
			</el-icon>
		</div>
		<div class="layout-navbars-breadcrumb-user-icon" @click="onLayoutSetingClick">
			<i class="icon-skin iconfont" :title="$t('message.user.title3')"></i>
		</div>
		<!-- <div class="layout-navbars-breadcrumb-user-icon">
			<el-popover placement="bottom" trigger="click" transition="el-zoom-in-top" :width="300" :persistent="false">
				<template #reference>
					<el-badge :is-dot="true">
						<el-icon :title="$t('message.user.title4')">
							<ele-Bell />
						</el-icon>
					</el-badge>
				</template>
				<template #default>
					<UserNews />
				</template>
			</el-popover>
		</div> -->
		<div class="layout-navbars-breadcrumb-user-icon" @click="onMessageClick" title="消息中心">
			<el-badge :value="state.unread" :hidden="state.unread === 0" :max="99" class="user-bell-badge">
				<el-icon><ele-Bell /></el-icon>
			</el-badge>
		</div>
		<div class="layout-navbars-breadcrumb-user-icon mr10" @click="onScreenfullClick">
			<i
				class="iconfont"
				:title="state.isScreenfull ? $t('message.user.title6') : $t('message.user.title5')"
				:class="!state.isScreenfull ? 'icon-fullscreen' : 'icon-tuichuquanping'"
			></i>
		</div>
		<el-dropdown :show-timeout="70" :hide-timeout="50" @command="onHandleCommandClick" class="custom-dropdown">
			<span class="layout-navbars-breadcrumb-user-link">
				<img :src="avatarUrl" class="layout-navbars-breadcrumb-user-link-photo mr5" @error="onAvatarError" />
				<span class="user-account">{{ userName || '未登录' }}</span>
				<span class="user-role" v-if="roleName">{{ roleName }}</span>
				<el-icon class="el-icon--right">
					<ele-ArrowDown />
				</el-icon>
			</span>
			<template #dropdown>
				<el-dropdown-menu>
					<el-dropdown-item command="/personal">{{ $t('message.user.dropdown2') }}</el-dropdown-item>
					<el-dropdown-item command="/">首页</el-dropdown-item>
					<el-dropdown-item divided command="logOut">{{ $t('message.user.dropdown5') }}</el-dropdown-item>
				</el-dropdown-menu>
			</template>
		</el-dropdown>
		<Search ref="searchRef" />
	</div>
</template>

<script setup lang="ts" name="layoutBreadcrumbUser">
import { defineAsyncComponent, ref, computed, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox, ElMessage } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';
import { useUserInfo } from '/@/stores/userInfo';
import { useThemeConfig } from '/@/stores/themeConfig';
import other from '/@/utils/other';
import request from '/@/utils/request';
import { Session, Local } from '/@/utils/storage';
import { generateAvatar, resolveAvatar } from '/@/utils/avatar';
import Cookies from 'js-cookie';
import screenfull from 'screenfull';
import mittBus from '/@/utils/mitt';
// 引入组件
// const UserNews = defineAsyncComponent(() => import('/@/layout/navBars/breadcrumb/userNews.vue'));
const Search = defineAsyncComponent(() => import('/@/layout/navBars/breadcrumb/search.vue'));

// 定义变量内容
const { locale, t } = useI18n();
const route = useRoute();
const router = useRouter();
const stores = useUserInfo();
const storesThemeConfig = useThemeConfig();
const { userInfos } = storeToRefs(stores);
const { themeConfig } = storeToRefs(storesThemeConfig);
const searchRef = ref();
const state = reactive({
	img: '',
	unread: 0,
	isScreenfull: false,
	disabledI18n: 'zh-cn',
	disabledSize: 'large',
});

// 当前登录账号 / 角色（从登录态计算，保证响应式刷新）
const userName = computed(() => userInfos.value.userName || Cookies.get('userName') || '');
const roleName = computed(() => userInfos.value.role || Cookies.get('role') || '');
const avatarUrl = computed(() => state.img || generateAvatar(userName.value, userName.value));
const onAvatarError = () => {
	state.img = generateAvatar(userName.value, userName.value);
};

// 设置分割样式
const layoutUserFlexNum = computed(() => {
	let num: string | number = '';
	const { layout, isClassicSplitMenu } = themeConfig.value;
	const layoutArr: string[] = ['defaults', 'columns'];
	if (layoutArr.includes(layout) || (layout === 'classic' && !isClassicSplitMenu)) num = '1';
	else num = '';
	return num;
});
// 布局配置 icon 点击时
const onLayoutSetingClick = () => {
	mittBus.emit('openSetingsDrawer');
};
// 下拉菜单点击时
const onHandleCommandClick = (path: string) => {
	if (path === 'logOut') {
		ElMessageBox({
			closeOnClickModal: false,
			closeOnPressEscape: false,
			title: t('message.user.logOutTitle'),
			message: t('message.user.logOutMessage'),
			showCancelButton: true,
			confirmButtonText: t('message.user.logOutConfirm'),
			cancelButtonText: t('message.user.logOutCancel'),
			buttonSize: 'default',
			beforeClose: (action, instance, done) => {
				if (action === 'confirm') {
					instance.confirmButtonLoading = true;
					instance.confirmButtonText = t('message.user.logOutExit');
					setTimeout(() => {
						done();
						setTimeout(() => {
							instance.confirmButtonLoading = false;
						}, 300);
					}, 700);
				} else {
					done();
				}
			},
		})
			.then(async () => {
				// 清除缓存/token等
				Session.clear();
				// 使用 reload 时，不需要调用 resetRoute() 重置路由
				window.location.reload();
			})
			.catch(() => {});
	} else {
		router.push(path);
	}
};
// 菜单搜索点击
const onSearchClick = () => {
	searchRef.value.openSearch();
};
// 组件大小改变
const onComponentSizeChange = (size: string) => {
	Local.remove('themeConfig');
	themeConfig.value.globalComponentSize = size;
	Local.set('themeConfig', themeConfig.value);
	initI18nOrSize('globalComponentSize', 'disabledSize');
	window.location.reload();
};
// 全屏点击时
const onScreenfullClick = () => {
	if (!screenfull.isEnabled) {
		ElMessage.warning('暂不不支持全屏');
		return false;
	}
	screenfull.toggle();
	screenfull.on('change', () => {
		if (screenfull.isFullscreen) state.isScreenfull = true;
		else state.isScreenfull = false;
	});
};
// 语言切换
const onLanguageChange = (lang: string) => {
	Local.remove('themeConfig');
	themeConfig.value.globalI18n = lang;
	Local.set('themeConfig', themeConfig.value);
	locale.value = lang;
	other.useTitle();
	initI18nOrSize('globalI18n', 'disabledI18n');
};
// 初始化组件大小/i18n
const initI18nOrSize = (value: string, attr: string) => {
	state[attr] = Local.get('themeConfig')[value];
};
const getTableData = () => {
	if (!userName.value) return;
	request.get('/api/user/' + encodeURIComponent(userName.value)).then((res) => {
		if (res.code == 0 && res.data) {
			state.img = resolveAvatar(res.data.avatar, res.data.name, userName.value);
		}
	});
};
// 未读消息数（顶栏铃铛）
const getUnread = () => {
	if (!userName.value) {
		state.unread = 0;
		return;
	}
	request
		.get('/api/message/' + encodeURIComponent(userName.value) + '/unreadCount')
		.then((res) => {
			if (res.code == 0) state.unread = Number(res.data?.count || 0);
		})
		.catch(() => {});
};
// 打开消息中心
const onMessageClick = () => {
	router.push('/message');
};
// 个人中心修改头像后同步顶栏
const onUserAvatarUpdated = (url: string) => {
	if (url) state.img = url;
};
let unreadTimer: ReturnType<typeof setInterval> | null = null;
// 页面加载时
onMounted(() => {
	getTableData();
	getUnread();
	unreadTimer = setInterval(getUnread, 60000);
	mittBus.on('userAvatarUpdated', onUserAvatarUpdated);
	if (Local.get('themeConfig')) {
		initI18nOrSize('globalComponentSize', 'disabledSize');
		initI18nOrSize('globalI18n', 'disabledI18n');
	}
});
onBeforeUnmount(() => {
	if (unreadTimer) clearInterval(unreadTimer);
	mittBus.off('userAvatarUpdated', onUserAvatarUpdated);
});
// 进入消息中心后回来刷新未读数
watch(
	() => route.path,
	(path) => {
		if (path !== '/message') getUnread();
	}
);
</script>

<style scoped lang="scss">
.tile {
	width: 100%;
	height: 100%;
	color: black;
	font-size: 20px;
	font-weight: 600;
	margin-left: -150px;
	display: flex;
	justify-content: flex-start;
	align-items: center;
	text-align: center;
}
.layout-navbars-breadcrumb-user {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	&-link {
		height: 100%;
		display: flex;
		align-items: center;
		white-space: nowrap;
		padding: 4px 6px 4px 4px;
		border-radius: 20px;
		transition: background-color 0.2s ease;
		&:hover {
			background: rgba(255, 255, 255, 0.12);
		}
		&-photo {
			width: 32px;
			height: 32px;
			border-radius: 100%;
			margin-right: 8px;
			object-fit: cover;
			border: 2px solid rgba(255, 255, 255, 0.55);
			background: #e3f2fd;
			flex-shrink: 0;
		}
	}
	.user-account {
		font-weight: 600;
		letter-spacing: 0.5px;
	}
	.user-role {
		margin-left: 8px;
		padding: 0 8px;
		height: 20px;
		line-height: 20px;
		border-radius: 10px;
		font-size: 12px;
		color: #fff;
		background: rgba(255, 255, 255, 0.18);
		border: 1px solid rgba(255, 255, 255, 0.3);
	}
	&-icon {
		padding: 0 9px;
		cursor: pointer;
		color: rgba(255, 255, 255, 0.92) !important;
		height: 50px;
		line-height: 50px;
		display: flex;
		align-items: center;
		transition: background-color 0.2s ease, color 0.2s ease;
		&:hover {
			background: rgba(255, 255, 255, 0.14) !important;
			color: #fff !important;
			i {
				display: inline-block;
			}
		}
		i {
			font-size: 16px;
		}
	}
	:deep(.el-dropdown) {
		color: var(--next-bg-topBarColor);
	}
	:deep(.el-badge) {
		height: 40px;
		line-height: 40px;
		display: flex;
		align-items: center;
	}
	:deep(.el-badge__content.is-fixed) {
		top: 12px;
	}
	.user-bell-badge {
		:deep(.el-badge__content) {
			top: 10px;
			right: 8px;
			height: 15px;
			line-height: 15px;
			padding: 0 4px;
			font-size: 10px;
			border: none;
			background: #f56c6c;
		}
	}
}
.custom-dropdown {
	/* 自定义 el-dropdown 的样式 */
	.el-dropdown-link {
		color: #fff; /* 修改字体颜色 */
		background-color: #409eff; /* 修改背景色 */
		padding: 10px 20px;
		border-radius: 4px;
		transition: background-color 0.3s, box-shadow 0.3s;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		cursor: pointer;
	}

	.el-dropdown-link:hover {
		background-color: #66b1ff; /* 悬停时的背景色 */
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
	}

	.el-dropdown-menu {
		background-color: #ffffff;
		border: 1px solid #dcdcdc;
		border-radius: 10px;
		box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
		overflow: hidden;
		padding: 5px;
	}

	.el-dropdown-item {
		color: #000000 !important;
		padding: 12px 20px;
		transition: background-color 0.3s, color 0.3s;
		display: flex;
		align-items: center;
		justify-content: center;
		&:hover {
			background-color: #f0f0f0 !important;
		}
	}

	.el-dropdown-item i {
		margin-right: 8px;
	}

	.el-dropdown-item:active {
		background-color: #e6f7ff;
	}
}
</style>
