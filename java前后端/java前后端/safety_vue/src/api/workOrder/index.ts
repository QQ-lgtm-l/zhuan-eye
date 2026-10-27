import request from '/@/utils/request';

export const getWorkOrderList = (params: any) => {
	return request({
		url: '/api/workOrder/list',
		method: 'get',
		params,
	});
};

export const getWorkOrderDetail = (id: number) => {
	return request({
		url: `/api/workOrder/${id}`,
		method: 'get',
	});
};

export const updateWorkOrderStatus = (id: number, status: string) => {
	return request({
		url: `/api/workOrder/${id}/status`,
		method: 'put',
		data: { status },
	});
};
