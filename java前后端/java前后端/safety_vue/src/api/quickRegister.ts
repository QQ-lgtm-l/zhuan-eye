import request from '/@/utils/request';

/** 发送手机验证码（演示模式会直接返回验证码） */
export const sendPhoneCode = (phone: string): Promise<any> =>
	request.post('/api/user/phone-code', { phone });

/** 极简注册：姓名 + 手机号 + 验证码 */
export const quickRegister = (data: { name: string; phone: string; code: string }): Promise<any> =>
	request.post('/api/user/quick-register', data);
