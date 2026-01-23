/**
 * 分类映射服务
 * 提供主分类和子类目的映射关系及工具函数
 */

import { Category } from '../types';

// 子类目类型定义
export type Subcategory =
    // Electronics
    | 'phones' | 'laptops' | 'tablets' | 'cameras' | 'audio' | 'gaming' | 'wearables' | 'accessories'
    // Vehicles
    | 'cars' | 'motorcycles' | 'bicycles' | 'trucks' | 'parts'
    // RealEstate
    | 'apartments' | 'houses' | 'land' | 'commercial' | 'rentals'
    // Furniture
    | 'sofas' | 'beds' | 'tables' | 'storage' | 'office'
    // Clothing
    | 'women' | 'men' | 'kids' | 'shoes' | 'fashion_accessories'
    // Sports
    | 'fitness' | 'outdoor' | 'team_sports' | 'water_sports' | 'winter_sports'
    // Services
    | 'repair' | 'cleaning' | 'teaching' | 'beauty' | 'moving'
    // Books
    | 'fiction' | 'textbooks' | 'children' | 'magazines' | 'comics'
    // Other
    | 'collectibles' | 'pets' | 'food' | 'plants';

// 主分类到子类目的映射
export const SUBCATEGORY_MAP: Record<Category, Subcategory[]> = {
    [Category.Electronics]: ['phones', 'laptops', 'tablets', 'cameras', 'audio', 'gaming', 'wearables', 'accessories'],
    [Category.Vehicles]: ['cars', 'motorcycles', 'bicycles', 'trucks', 'parts'],
    [Category.RealEstate]: ['apartments', 'houses', 'land', 'commercial', 'rentals'],
    [Category.Furniture]: ['sofas', 'beds', 'tables', 'storage', 'office'],
    [Category.Clothing]: ['women', 'men', 'kids', 'shoes', 'fashion_accessories'],
    [Category.Sports]: ['fitness', 'outdoor', 'team_sports', 'water_sports', 'winter_sports'],
    [Category.Services]: ['repair', 'cleaning', 'teaching', 'beauty', 'moving'],
    [Category.Books]: ['fiction', 'textbooks', 'children', 'magazines', 'comics'],
    [Category.Other]: ['collectibles', 'pets', 'food', 'plants'],
};

// 子类目到父分类的反向映射
const PARENT_CATEGORY_MAP: Record<Subcategory, Category> = {} as Record<Subcategory, Category>;
Object.entries(SUBCATEGORY_MAP).forEach(([category, subcategories]) => {
    subcategories.forEach(sub => {
        PARENT_CATEGORY_MAP[sub] = category as Category;
    });
});

/**
 * 获取子类目的父分类
 */
export const getParentCategory = (subcategory: Subcategory): Category => {
    return PARENT_CATEGORY_MAP[subcategory] || Category.Other;
};

/**
 * AI 识别结果到子类目的映射
 * 支持模糊匹配和多语言关键词
 */
export const mapSubcategoryFromAI = (aiSubcategory: string): Subcategory | null => {
    const normalized = aiSubcategory.toLowerCase().trim().replace(/[\s_-]+/g, '_');

    const mapping: Record<string, Subcategory> = {
        // Electronics
        'phone': 'phones', 'phones': 'phones', 'smartphone': 'phones', 'iphone': 'phones', 'android': 'phones', 'celular': 'phones', '手机': 'phones',
        'laptop': 'laptops', 'laptops': 'laptops', 'notebook': 'laptops', 'macbook': 'laptops', 'portatil': 'laptops', '笔记本': 'laptops',
        'tablet': 'tablets', 'tablets': 'tablets', 'ipad': 'tablets', '平板': 'tablets',
        'camera': 'cameras', 'cameras': 'cameras', 'camara': 'cameras', '相机': 'cameras',
        'audio': 'audio', 'speaker': 'audio', 'headphone': 'audio', 'earphone': 'audio', 'bocina': 'audio', '音响': 'audio',
        'gaming': 'gaming', 'game': 'gaming', 'console': 'gaming', 'playstation': 'gaming', 'xbox': 'gaming', 'nintendo': 'gaming', '游戏': 'gaming',
        'wearable': 'wearables', 'wearables': 'wearables', 'smartwatch': 'wearables', 'watch': 'wearables', '手表': 'wearables',
        'accessory': 'accessories', 'accessories': 'accessories', 'charger': 'accessories', 'cable': 'accessories', '配件': 'accessories',

        // Vehicles
        'car': 'cars', 'cars': 'cars', 'auto': 'cars', 'coche': 'cars', 'carro': 'cars', '汽车': 'cars',
        'motorcycle': 'motorcycles', 'motorcycles': 'motorcycles', 'moto': 'motorcycles', '摩托车': 'motorcycles',
        'bicycle': 'bicycles', 'bicycles': 'bicycles', 'bike': 'bicycles', 'bicicleta': 'bicycles', '自行车': 'bicycles',
        'truck': 'trucks', 'trucks': 'trucks', 'camion': 'trucks', '卡车': 'trucks',
        'parts': 'parts', 'part': 'parts', 'refaccion': 'parts', '零件': 'parts', 'autoparts': 'parts',

        // RealEstate
        'apartment': 'apartments', 'apartments': 'apartments', 'departamento': 'apartments', 'depa': 'apartments', '公寓': 'apartments',
        'house': 'houses', 'houses': 'houses', 'casa': 'houses', '别墅': 'houses', '房子': 'houses',
        'land': 'land', 'terreno': 'land', '土地': 'land',
        'commercial': 'commercial', 'local': 'commercial', 'office_space': 'commercial', '商铺': 'commercial',
        'rental': 'rentals', 'rentals': 'rentals', 'renta': 'rentals', '出租': 'rentals',

        // Furniture
        'sofa': 'sofas', 'sofas': 'sofas', 'couch': 'sofas', '沙发': 'sofas',
        'bed': 'beds', 'beds': 'beds', 'cama': 'beds', 'mattress': 'beds', '床': 'beds',
        'table': 'tables', 'tables': 'tables', 'chair': 'tables', 'desk': 'tables', 'mesa': 'tables', '桌椅': 'tables',
        'storage': 'storage', 'closet': 'storage', 'shelf': 'storage', '储物': 'storage',
        'office_furniture': 'office', 'escritorio': 'office', '办公': 'office',

        // Clothing
        'women': 'women', 'female': 'women', 'mujer': 'women', 'dama': 'women', '女装': 'women',
        'men': 'men', 'male': 'men', 'hombre': 'men', 'caballero': 'men', '男装': 'men',
        'kids': 'kids', 'children': 'kids', 'ninos': 'kids', '童装': 'kids',
        'shoes': 'shoes', 'shoe': 'shoes', 'zapatos': 'shoes', '鞋类': 'shoes',
        'fashion_accessories': 'fashion_accessories', 'bag': 'fashion_accessories', 'bolsa': 'fashion_accessories', '配饰': 'fashion_accessories',

        // Sports
        'fitness': 'fitness', 'gym': 'fitness', 'ejercicio': 'fitness', '健身': 'fitness',
        'outdoor': 'outdoor', 'camping': 'outdoor', 'hiking': 'outdoor', '户外': 'outdoor',
        'team_sports': 'team_sports', 'soccer': 'team_sports', 'football': 'team_sports', 'basketball': 'team_sports', '球类': 'team_sports',
        'water_sports': 'water_sports', 'swimming': 'water_sports', 'surf': 'water_sports', '水上': 'water_sports',
        'winter_sports': 'winter_sports', 'ski': 'winter_sports', 'snowboard': 'winter_sports', '冬季': 'winter_sports',

        // Services
        'repair': 'repair', 'reparacion': 'repair', '维修': 'repair',
        'cleaning': 'cleaning', 'limpieza': 'cleaning', '清洁': 'cleaning',
        'teaching': 'teaching', 'tutor': 'teaching', 'clases': 'teaching', '教学': 'teaching',
        'beauty': 'beauty', 'belleza': 'beauty', '美容': 'beauty',
        'moving': 'moving', 'mudanza': 'moving', '搬家': 'moving',

        // Books
        'fiction': 'fiction', 'novel': 'fiction', 'novela': 'fiction', '小说': 'fiction',
        'textbook': 'textbooks', 'textbooks': 'textbooks', 'libro_texto': 'textbooks', '教材': 'textbooks',
        'children_books': 'children', 'infantil': 'children', '儿童': 'children',
        'magazine': 'magazines', 'magazines': 'magazines', 'revista': 'magazines', '杂志': 'magazines',
        'comic': 'comics', 'comics': 'comics', 'manga': 'comics', '漫画': 'comics',

        // Other
        'collectible': 'collectibles', 'collectibles': 'collectibles', 'coleccion': 'collectibles', '收藏品': 'collectibles',
        'pet': 'pets', 'pets': 'pets', 'mascota': 'pets', '宠物': 'pets',
        'food': 'food', 'comida': 'food', '食品': 'food',
        'plant': 'plants', 'plants': 'plants', 'planta': 'plants', '植物': 'plants',
    };

    return mapping[normalized] || null;
};

/**
 * 获取指定分类的所有子类目选项（用于下拉菜单）
 */
export const getSubcategoriesForCategory = (category: Category): Subcategory[] => {
    return SUBCATEGORY_MAP[category] || [];
};

/**
 * 验证子类目是否属于指定分类
 */
export const isValidSubcategory = (category: Category, subcategory: Subcategory): boolean => {
    const validSubcategories = SUBCATEGORY_MAP[category];
    return validSubcategories?.includes(subcategory) || false;
};

/**
 * 所有子类目的完整列表（用于 AI schema）
 */
export const ALL_SUBCATEGORIES: Subcategory[] = Object.values(SUBCATEGORY_MAP).flat();
