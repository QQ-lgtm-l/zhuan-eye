import request from '/@/utils/request';
import axios from 'axios';

// 获取正确的baseURL（兼容.env中VITE_API_URL或VITE_API_DOMAIN）
function getBaseUrl() {
	const env = import.meta.env as any;
	return env.VITE_API_DOMAIN || env.VITE_API_URL || 'http://localhost:8888/';
}

export function getWorkOrderList(params: any) {
    return request({
        url: '/api/workOrder',
        method: 'get',
        params
    });
}

export function getWorkOrderById(id: number) {
    return request({
        url: `/api/workOrder/${id}`,
        method: 'get'
    });
}

export function createWorkOrder(data: any) {
    return request({
        url: '/api/workOrder',
        method: 'post',
        data
    });
}

export function updateWorkOrder(id: number, data: any) {
    return request({
        url: `/api/workOrder/${id}`,
        method: 'put',
        data
    });
}

export function processWorkOrder(id: number) {
    return request({
        url: `/api/workOrder/${id}/process`,
        method: 'put'
    });
}

export function completeWorkOrder(id: number) {
    return request({
        url: `/api/workOrder/${id}/complete`,
        method: 'put'
    });
}

export function closeWorkOrder(id: number) {
    return request({
        url: `/api/workOrder/${id}/close`,
        method: 'put'
    });
}

export function deleteWorkOrder(id: number) {
    return request({
        url: `/api/workOrder/${id}`,
        method: 'delete'
    });
}

// Excel台账导出
export function exportWorkOrder(params: any) {
    return request({
        url: '/api/workOrder/export',
        method: 'get',
        params,
        responseType: 'blob'
    });
}

// 工单审核意见
export function auditWorkOrder(id: number, data: { auditOpinion: string; auditUser: string }) {
    return request({
        url: `/api/workOrder/${id}/audit`,
        method: 'put',
        data
    });
}

// 工单督办提醒
export function remindWorkOrder(id: number, data: { remindUser: string }) {
    return request({
        url: `/api/workOrder/${id}/remind`,
        method: 'put',
        data
    });
}

// AI二次复核（支持上传文件）
export function recheckWorkOrder(id: number, formData: FormData) {
    const baseUrl = getBaseUrl();
    // 去除末尾多余的斜杠
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const url = `${normalizedBase}/api/workOrder/${id}/recheck`;
    return axios.post(url, formData, {
        timeout: 500000,
    });
}
// 兼容旧的URL方式
export function recheckWorkOrderByUrl(id: number, data: { rectifyImg: string }) {
    return request({
        url: `/api/workOrder/${id}/recheck`,
        method: 'post',
        params: data
    });
}
