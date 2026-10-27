import { defineStore } from 'pinia';
import Cookies from 'js-cookie';
import { Session } from '/@/utils/storage';

/**
 * 用户信息
 * @methods setUserInfos 设置用户信息
 */
export const useUserInfo = defineStore('userInfo', {
	state: (): UserInfosState => ({
		userInfos: {
			userName: '',
			role: '',
			photo: '',
			time: 0,
			roles: [],
			authBtnList: [],
		},
	}),
	actions: {
		async setUserInfos() {
			// 存储用户信息到浏览器缓存
			if (Session.get('userInfo')) {
				this.userInfos = Session.get('userInfo');
				// console.log(this.userInfos);
			} else {
				const userInfos: any = await this.getApiUserInfo();
				this.userInfos = userInfos;
				// console.log(this.userInfos);
			}
		},
		// 模拟接口数据
		// https://gitee.com/lyt-top/vue-next-admin/issues/I5F1HP
		async getApiUserInfo() {
			return new Promise((resolve) => {
				setTimeout(() => {
					const role = Cookies.get('role');
					let defaultRoles: Array<string> = [];
					let defaultAuthBtnList: Array<string> = [];
					let adminRoles: Array<string> = ['admin'];
					let adminAuthBtnList: Array<string> = ['btn.add', 'btn.del', 'btn.edit', 'btn.link'];
					let projectManagerRoles: Array<string> = ['projectManager'];
					let projectManagerAuthBtnList: Array<string> = ['btn.add', 'btn.del', 'btn.edit', 'btn.link'];
					let safetyOfficerRoles: Array<string> = ['safetyOfficer'];
					let safetyOfficerAuthBtnList: Array<string> = ['btn.add', 'btn.del', 'btn.edit', 'btn.link'];
					let inspectorRoles: Array<string> = ['inspector'];
					let inspectorAuthBtnList: Array<string> = ['btn.add', 'btn.edit', 'btn.link'];
					let foremanRoles: Array<string> = ['foreman'];
					let foremanAuthBtnList: Array<string> = ['btn.add', 'btn.link'];
					let workerRoles: Array<string> = ['worker'];
					let workerAuthBtnList: Array<string> = ['btn.add', 'btn.link'];
					if (role === '管理员') {
						defaultRoles = adminRoles;
						defaultAuthBtnList = adminAuthBtnList;
					} else if (role === '项目经理') {
						defaultRoles = projectManagerRoles;
						defaultAuthBtnList = projectManagerAuthBtnList;
					} else if (role === '专职安全员') {
						defaultRoles = safetyOfficerRoles;
						defaultAuthBtnList = safetyOfficerAuthBtnList;
					} else if (role === '巡检员') {
						defaultRoles = inspectorRoles;
						defaultAuthBtnList = inspectorAuthBtnList;
					} else if (role === '施工班组长') {
						defaultRoles = foremanRoles;
						defaultAuthBtnList = foremanAuthBtnList;
					} else if (role === '现场施工人员') {
						defaultRoles = workerRoles;
						defaultAuthBtnList = workerAuthBtnList;
					} else if (role === 'admin') {
						defaultRoles = adminRoles;
						defaultAuthBtnList = adminAuthBtnList;
					} else if (role === 'common') {
						defaultRoles = workerRoles;
						defaultAuthBtnList = workerAuthBtnList;
					}

					const userInfos = {
						userName: Cookies.get('userName'),
						role: role,
						photo:
							role === '管理员' || role === 'admin'
								? 'https://img2.baidu.com/it/u=1978192862,2048448374&fm=253&fmt=auto&app=138&f=JPEG?w=504&h=500'
								: 'https://img2.baidu.com/it/u=2370931438,70387529&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=500',
						time: new Date().getTime(),
						roles: defaultRoles,
						authBtnList: defaultAuthBtnList,
					};
					resolve(userInfos);
				}, 0);
			});
		},
	},
});
