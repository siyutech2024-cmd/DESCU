import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { AdminProduct } from '../types/admin';

export const exportToCSV = (products: AdminProduct[], filename: string = 'products') => {
    // 准备导出数据
    const exportData = products.map(product => ({
        '商品ID': product.id,
        '标题': product.title,
        '描述': product.description || '',
        '价格': product.price,
        '币种': product.currency || 'MXN',
        '分类': getCategoryName(product.category),
        '配送方式': getDeliveryType(product.delivery_type),
        '位置': product.location_name || '',
        '卖家姓名': product.seller_name || '',
        '卖家邮箱': product.seller_email || '',
        '状态': getStatusName(product.status),
        '是否推荐': product.is_promoted ? '是' : '否',
        '浏览量': product.views_count || 0,
        '举报次数': product.reported_count || 0,
        '创建时间': product.created_at ? new Date(product.created_at).toLocaleString('zh-CN') : '',
        '更新时间': product.updated_at ? new Date(product.updated_at).toLocaleString('zh-CN') : '',
    }));

    // 创建工作表
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    // 设置列宽
    const columnWidths = [
        { wch: 30 }, // 商品ID
        { wch: 40 }, // 标题
        { wch: 50 }, // 描述
        { wch: 10 }, // 价格
        { wch: 8 },  // 币种
        { wch: 12 }, // 分类
        { wch: 12 }, // 配送方式
        { wch: 20 }, // 位置
        { wch: 15 }, // 卖家姓名
        { wch: 25 }, // 卖家邮箱
        { wch: 10 }, // 状态
        { wch: 10 }, // 是否推荐
        { wch: 10 }, // 浏览量
        { wch: 10 }, // 举报次数
        { wch: 20 }, // 创建时间
        { wch: 20 }, // 更新时间
    ];
    worksheet['!cols'] = columnWidths;

    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '商品列表');

    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // 下载文件
    const timestamp = new Date().toISOString().split('T')[0];
    saveAs(data, `${filename}_${timestamp}.xlsx`);
};

// 辅助函数
const getCategoryName = (category: string): string => {
    const categoryMap: { [key: string]: string } = {
        'electronics': '电子产品',
        'furniture': '家具',
        'clothing': '服装',
        'books': '图书',
        'sports': '运动',
        'vehicles': '车辆',
        'real_estate': '房产',
        'services': '服务',
        'other': '其他'
    };
    return categoryMap[category] || category;
};

const getDeliveryType = (type: string): string => {
    const typeMap: { [key: string]: string } = {
        'meetup': '见面交易',
        'shipping': '快递配送',
        'both': '两者皆可'
    };
    return typeMap[type] || type;
};

const getStatusName = (status: string): string => {
    const statusMap: { [key: string]: string } = {
        'active': '在售',
        'inactive': '已下架',
        'pending_review': '待审核',
        'deleted': '已删除'
    };
    return statusMap[status] || status;
};
