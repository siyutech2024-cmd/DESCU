import { Request, Response, NextFunction } from 'express';
import { supabase } from '../index';

export interface AdminRequest extends Request {
    admin?: {
        id: string;
        email: string;
        role: string;
        permissions?: string[];
    };
}

/**
 * 管理员认证中间件
 * 验证请求者是否为管理员
 */
export const requireAdmin = async (
    req: AdminRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        // 获取 Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: '未授权',
                message: '缺少认证Token'
            });
        }

        // 提取 token
        const token = authHeader.replace('Bearer ', '');

        // 验证 token 并获取用户信息
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                error: '未授权',
                message: '无效的Token'
            });
        }

        // 检查用户是否具有管理员角色
        const userMetadata = user.user_metadata || {};
        const role = userMetadata.role;

        if (role !== 'admin' && role !== 'super_admin') {
            return res.status(403).json({
                error: '权限不足',
                message: '需要管理员权限才能访问此资源'
            });
        }

        // 将管理员信息附加到请求对象
        req.admin = {
            id: user.id,
            email: user.email || '',
            role: role,
            permissions: userMetadata.permissions || []
        };

        next();
    } catch (error) {
        console.error('管理员认证错误:', error);
        return res.status(500).json({
            error: '服务器错误',
            message: '认证过程中发生错误'
        });
    }
};

/**
 * 检查特定权限
 * @param permission 需要的权限
 */
export const requirePermission = (permission: string) => {
    return (req: AdminRequest, res: Response, next: NextFunction) => {
        if (!req.admin) {
            return res.status(401).json({
                error: '未授权',
                message: '请先通过管理员认证'
            });
        }

        // Super admin 拥有所有权限
        if (req.admin.role === 'super_admin') {
            return next();
        }

        // 检查权限列表
        const permissions = req.admin.permissions || [];
        if (!permissions.includes(permission)) {
            return res.status(403).json({
                error: '权限不足',
                message: `需要 ${permission} 权限`
            });
        }

        next();
    };
};

/**
 * 可选的管理员认证
 * 如果提供了有效的管理员Token，则附加管理员信息
 * 否则继续执行但不附加管理员信息
 */
export const optionalAdmin = async (
    req: AdminRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (!error && user && user.user_metadata?.role === 'admin') {
            req.admin = {
                id: user.id,
                email: user.email || '',
                role: user.user_metadata.role,
                permissions: user.user_metadata.permissions || []
            };
        }

        next();
    } catch (error) {
        // 静默失败，继续执行
        next();
    }
};
