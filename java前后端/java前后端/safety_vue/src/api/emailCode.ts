import request from '/@/utils/request';

export type EmailScene = 'register' | 'reset';

/** 发送邮箱验证码 */
export const sendEmailCode = (email: string, scene: EmailScene = 'register'): Promise<any> =>
	request.post('/api/user/email-code', { email, scene });

/** 校验邮箱验证码 */
export const verifyEmailCode = (email: string, code: string, scene: EmailScene = 'register'): Promise<any> =>
	request.post('/api/user/verify-code', { email, code, scene });

/** 忘记密码：邮箱验证码重置 */
export const resetPasswordByEmail = (email: string, code: string, newPassword: string): Promise<any> =>
	request.post('/api/user/reset-password', { email, code, newPassword });
