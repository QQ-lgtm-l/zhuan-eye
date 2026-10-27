import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Session } from '/@/utils/storage';
import qs from 'qs';

// 配置新建一个 axios 实例
const service: AxiosInstance = axios.create({
	baseURL: import.meta.env.VITE_API_DOMAIN,
	timeout: 500000,
	headers: { 'Content-Type': 'application/json;charset=UTF-8' },
	// withCredentials: true,
});

// 添加请求拦截器
service.interceptors.request.use(
	(config: AxiosRequestConfig) => {
		// 在发送请求之前做些什么 token
		if (Session.get('token')) {
			config.headers!['Authorization'] = `${Session.get('token')}`;
		}
		return config;
	},
	(error) => {
		// 对请求错误做些什么
		return Promise.reject(error);
	}
);

// 添加响应拦截器
service.interceptors.response.use(
	(response) => {
		// 对响应数据做点什么
		const res = response.data;
		if (res.code === 401 || res.code === 4001) {
			Session.clear(); // 清除浏览器全部临时缓存
			window.location.href = '/'; // 去登录页
			ElMessageBox.alert('你已被登出，请重新登录', '提示', {})
				.then(() => {})
				.catch(() => {});
		} else {
			return response.data;
		}
	},
	(error) => {
		// 对响应错误做点什么
		const status = error?.response?.status;
		const backendMsg = error?.response?.data?.msg;
		if (error.message.indexOf('timeout') != -1) {
			ElMessage.error('网络超时，请稍后重试');
		} else if (error.message == 'Network Error') {
			ElMessage.error('无法连接后端服务，请确认后端已在 9999 端口启动');
		} else if (status === 500) {
			ElMessage.error(backendMsg || '服务器内部错误：请检查后端控制台或数据库配置');
		} else if (status === 404) {
			ElMessage.error('接口不存在（404），请确认前后端版本一致');
		} else if (backendMsg) {
			ElMessage.error(backendMsg);
		} else if (error.response?.statusText) {
			ElMessage.error(error.response.statusText);
		} else {
			ElMessage.error('接口请求失败，请检查后端服务');
		}
		return Promise.reject(error);
	}
);

// 导出 axios 实例
export default service;
