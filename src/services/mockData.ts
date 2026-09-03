import { Category, DeliveryType, Product, Coordinates } from '../types';

export const MOCK_TEMPLATES: Record<Category, Array<{
    titles: { zh: string; en: string; es: string };
    basePrice: number;
    img: string;
}>> = {
    [Category.Vehicles]: [
        { titles: { zh: "大众 Jetta 2019", en: "Volkswagen Jetta 2019", es: "Volkswagen Jetta 2019 Sportline" }, basePrice: 240000, img: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&q=80" },
        { titles: { zh: "日产 Versa 2020", en: "Nissan Versa 2020", es: "Nissan Versa 2020 Drive" }, basePrice: 190000, img: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80" },
        { titles: { zh: "雪佛兰 Aveo 2018", en: "Chevrolet Aveo 2018", es: "Chevrolet Aveo 2018 LS" }, basePrice: 150000, img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80" },
        { titles: { zh: "吉普 Wrangler 2015", en: "Jeep Wrangler 2015", es: "Jeep Wrangler 2015 4x4" }, basePrice: 450000, img: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80" },
        { titles: { zh: "本田 CR-V 2017", en: "Honda CR-V 2017", es: "Honda CR-V 2017 Turbo" }, basePrice: 320000, img: "https://images.unsplash.com/photo-1568844293986-8d0400bd4745?w=800&q=80" },
        { titles: { zh: "马自达 3 掀背车", en: "Mazda 3 Hatchback", es: "Mazda 3 Hatchback Grand Touring" }, basePrice: 280000, img: "https://images.unsplash.com/photo-1542362567-b07e54358753?w=800&q=80" },
        { titles: { zh: "福特 Mustang GT", en: "Ford Mustang GT", es: "Ford Mustang GT V8" }, basePrice: 650000, img: "https://images.unsplash.com/photo-1584345604476-8ec5e12e42dd?w=800&q=80" },
        { titles: { zh: "丰田 Prius 混动", en: "Toyota Prius Hybrid", es: "Toyota Prius Híbrido Base" }, basePrice: 310000, img: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?w=800&q=80" },
    ],
    [Category.RealEstate]: [
        { titles: { zh: "市中心两室公寓", en: "2 Bedroom Apartment City Center", es: "Depa 2 Recámaras en La Condesa" }, basePrice: 4500000, img: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80" },
        { titles: { zh: "Polanco 豪华公寓", en: "Luxury Apt in Polanco", es: "Departamento de Lujo en Polanco" }, basePrice: 8500000, img: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&q=80" },
        { titles: { zh: "罗马区单间出租", en: "Studio for Rent Roma Norte", es: "Se Renta Loft en Roma Norte" }, basePrice: 12000, img: "https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&q=80" },
        { titles: { zh: "带花园的房子", en: "House with Garden", es: "Casa con Jardín Amplio" }, basePrice: 3200000, img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&q=80" },
        { titles: { zh: "合租卧室", en: "Room for Rent", es: "Cuarto en Renta Coyoacán" }, basePrice: 5500, img: "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800&q=80" },
    ],
    [Category.Electronics]: [
        { titles: { zh: "iPhone 14 Pro Max 256G", en: "iPhone 14 Pro Max 256G", es: "iPhone 14 Pro Max 256G Libre" }, basePrice: 18500, img: "https://images.unsplash.com/photo-1678685888221-a0e279567042?w=800&q=80" },
        { titles: { zh: "Sony WH-1000XM5", en: "Sony WH-1000XM5 Headphones", es: "Audífonos Sony WH-1000XM5" }, basePrice: 5500, img: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=800&q=80" },
        { titles: { zh: "MacBook Air M2", en: "MacBook Air M2", es: "MacBook Air M2 Chip" }, basePrice: 19000, img: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&q=80" },
        { titles: { zh: "任天堂 Switch OLED", en: "Nintendo Switch OLED", es: "Nintendo Switch OLED" }, basePrice: 6200, img: "https://images.unsplash.com/photo-1640955307798-8e652c79f329?w=800&q=80" },
        { titles: { zh: "PlayStation 5", en: "PlayStation 5 Console", es: "Consola PlayStation 5 Edición Disco" }, basePrice: 9500, img: "https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=800&q=80" },
        { titles: { zh: "iPad Air 5", en: "iPad Air 5th Gen", es: "iPad Air 5ta Generación" }, basePrice: 11000, img: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&q=80" },
        { titles: { zh: "三星 Galaxy S23", en: "Samsung Galaxy S23", es: "Samsung Galaxy S23 Ultra" }, basePrice: 21000, img: "https://images.unsplash.com/photo-1610945265078-3858a0828630?w=800&q=80" },
        { titles: { zh: "佳能 EOS R6", en: "Canon EOS R6 Camera", es: "Cámara Canon EOS R6 Cuerpo" }, basePrice: 42000, img: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80" },
    ],
    [Category.Services]: [
        { titles: { zh: "专业英语辅导", en: "Professional English Tutoring", es: "Clases de Inglés Profesionales" }, basePrice: 300, img: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&q=80" },
        { titles: { zh: "家政清洁服务", en: "Home Cleaning Service", es: "Servicio de Limpieza a Domicilio" }, basePrice: 450, img: "https://images.unsplash.com/photo-1581578731117-104f2a41272c?w=800&q=80" },
        { titles: { zh: "电脑维修", en: "Computer Repair", es: "Reparación de Computadoras" }, basePrice: 500, img: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=800&q=80" },
        { titles: { zh: "搬家服务", en: "Moving Service", es: "Fletes y Mudanzas Económicas" }, basePrice: 1500, img: "https://images.unsplash.com/photo-1600518464441-9154a4dea21b?w=800&q=80" },
        { titles: { zh: "私人健身教练", en: "Personal Trainer", es: "Entrenador Personal Gym" }, basePrice: 350, img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80" },
    ],
    [Category.Furniture]: [
        { titles: { zh: "宜家 POÄNG 扶手椅", en: "IKEA POÄNG Chair", es: "Sillón IKEA POÄNG" }, basePrice: 1200, img: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=800&q=80" },
        { titles: { zh: "复古实木咖啡桌", en: "Vintage Coffee Table", es: "Mesa de Centro Vintage" }, basePrice: 1500, img: "https://images.unsplash.com/photo-1532372320572-cda25653a26d?w=800&q=80" },
        { titles: { zh: "双人床架", en: "Queen Size Bed Frame", es: "Base de Cama Queen Size" }, basePrice: 2500, img: "https://images.unsplash.com/photo-1505693416388-b0346efee539?w=800&q=80" },
        { titles: { zh: "办公桌", en: "Office Desk", es: "Escritorio para Home Office" }, basePrice: 1800, img: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&q=80" },
        { titles: { zh: "落地灯", en: "Floor Lamp", es: "Lámpara de Pie Moderna" }, basePrice: 800, img: "https://images.unsplash.com/photo-1507473888900-52e1adad5481?w=800&q=80" },
    ],
    [Category.Clothing]: [
        { titles: { zh: "Nike Air Force 1 板鞋", en: "Nike Air Force 1", es: "Tenis Nike Air Force 1" }, basePrice: 1800, img: "https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&q=80" },
        { titles: { zh: "北面羽绒服", en: "The North Face Jacket", es: "Chamarra The North Face" }, basePrice: 3200, img: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&q=80" },
        { titles: { zh: "Zara 连衣裙", en: "Zara Dress", es: "Vestido Zara Nuevo" }, basePrice: 600, img: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80" },
        { titles: { zh: "Levi's 501 牛仔裤", en: "Levi's 501 Jeans", es: "Jeans Levi's 501 Originales" }, basePrice: 850, img: "https://images.unsplash.com/photo-1542272454374-d41e38747600?w=800&q=80" },
        { titles: { zh: "RayBan 太阳镜", en: "RayBan Sunglasses", es: "Lentes de Sol RayBan Aviator" }, basePrice: 2200, img: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&q=80" },
    ],
    [Category.Sports]: [
        { titles: { zh: "Giant Escape 1 公路车", en: "Giant Escape 1 Bike", es: "Bicicleta Giant Escape 1" }, basePrice: 8500, img: "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&q=80" },
        { titles: { zh: "Adidas Ultraboost", en: "Adidas Ultraboost", es: "Adidas Ultraboost Running" }, basePrice: 2400, img: "https://images.unsplash.com/photo-1587563871167-1ee9c731aefb?w=800&q=80" },
        { titles: { zh: "瑜伽垫", en: "Yoga Mat", es: "Tapete de Yoga Profesional" }, basePrice: 400, img: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=800&q=80" },
        { titles: { zh: "Wilson 网球拍", en: "Wilson Tennis Racket", es: "Raqueta de Tenis Wilson" }, basePrice: 1800, img: "https://images.unsplash.com/photo-1617083934555-563404543d35?w=800&q=80" },
        { titles: { zh: "哑铃套装", en: "Dumbbell Set", es: "Set de Mancuernas Pesas" }, basePrice: 1200, img: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80" },
    ],
    [Category.Books]: [
        { titles: { zh: "哈利波特全集", en: "Harry Potter Set", es: "Colección Harry Potter Libros" }, basePrice: 1500, img: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80" },
        { titles: { zh: "百年孤独", en: "One Hundred Years of Solitude", es: "Cien Años de Soledad Primera Edición" }, basePrice: 300, img: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800&q=80" },
        { titles: { zh: "建筑设计教材", en: "Architecture Textbooks", es: "Libros de Arquitectura" }, basePrice: 800, img: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=800&q=80" },
    ],
    [Category.Other]: [
        { titles: { zh: "原声吉他", en: "Acoustic Guitar", es: "Guitarra Acústica Fender" }, basePrice: 3500, img: "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800&q=80" },
        { titles: { zh: "尤克里里", en: "Ukulele", es: "Ukulele Soprano" }, basePrice: 800, img: "https://images.unsplash.com/photo-1577640905050-83665af216b9?w=800&q=80" },
        { titles: { zh: "工具箱套装", en: "Toolbox Set", es: "Caja de Herramientas Completa" }, basePrice: 1200, img: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=800&q=80" },
    ],
};

export const MOCK_DESCRIPTIONS = {
    zh: [
        "成色很新，功能正常。买了一年多但几乎没怎么用。包装盒都在。因搬家低价转让。",
        "非常好的状态，保养得当。价格可小刀，仅限同城面交。",
        "闲置物品处理，9成新，无划痕。懂的来，手慢无。",
        "急出！搬家带不走，便宜卖了。功能完好，即买即用。",
        "全新未拆封，年会奖品。用不上所以转让。"
    ],
    en: [
        "Mint condition, used gently. Functioning perfectly. Bought it a year ago but hardly used it.",
        "Great condition, well maintained. Price negotiable, pickup only.",
        "Selling this pre-loved item. 9/10 condition, no scratches. First come first serve.",
        "Urgent sale! Moving out, must go. Works perfectly.",
        "Brand new, sealed in box. Won it as a prize, don't need it."
    ],
    es: [
        "En excelentes condiciones, funciona al 100. Lo compré hace un año pero casi no lo uso. Entrego en punto medio.",
        "Muy buen estado, cuidado. Precio a tratar un poco. Solo efectivo.",
        "Vendo por mudanza. Estética de 9.5, sin detalles. Urge vender.",
        "Jala al cien, cualquier prueba. Entrego en metro línea 2 o plaza comercial.",
        "Nuevo en caja cerrada. Me lo gané en una rifa y no lo ocupo."
    ]
};

const getMockDeliveryType = (category: Category): DeliveryType => {
    if (category === Category.Vehicles || category === Category.RealEstate || category === Category.Services || category === Category.Furniture) {
        return DeliveryType.Meetup;
    }
    if (category === Category.Clothing || category === Category.Books) {
        return Math.random() > 0.5 ? DeliveryType.Shipping : DeliveryType.Both;
    }
    return DeliveryType.Both;
};

export const generateMockProducts = (center: Coordinates, lang: string): Product[] => {
    const TOTAL_ITEMS = 20; // REDUCED FROM 400 FOR PERFORMANCE
    const items: Product[] = [];
    const categories = Object.keys(MOCK_TEMPLATES) as Category[];
    const langKey = (lang === 'zh' || lang === 'en' || lang === 'es') ? lang : 'es';

    for (let i = 0; i < TOTAL_ITEMS; i++) {
        const cat = categories[Math.floor(Math.random() * categories.length)];
        const templates = MOCK_TEMPLATES[cat];
        const template = templates[Math.floor(Math.random() * templates.length)];

        const distSeed = Math.random();
        let latOffset, lonOffset;
        if (distSeed < 0.4) {
            latOffset = (Math.random() - 0.5) * 0.036;
            lonOffset = (Math.random() - 0.5) * 0.036;
        } else if (distSeed < 0.8) {
            latOffset = (Math.random() - 0.5) * 0.14;
            lonOffset = (Math.random() - 0.5) * 0.14;
        } else {
            latOffset = (Math.random() - 0.5) * 0.4;
            lonOffset = (Math.random() - 0.5) * 0.4;
        }
        const finalLat = center.latitude + latOffset;
        const finalLon = center.longitude + lonOffset;

        const priceJitter = 0.8 + Math.random() * 0.4;
        const finalPrice = Math.floor(template.basePrice * priceJitter / 10) * 10;

        const descList = MOCK_DESCRIPTIONS[langKey as keyof typeof MOCK_DESCRIPTIONS] || MOCK_DESCRIPTIONS['es'];
        const desc = descList[Math.floor(Math.random() * descList.length)];

        const sellerIndex = Math.floor(Math.random() * 50);

        const isPromoted = Math.random() < 0.08;
        const isSellerVerified = Math.random() < 0.2;

        items.push({
            id: `mock-${i}`,
            seller: {
                id: `user-${sellerIndex}`,
                name: `Usuario ${sellerIndex + 1}`,
                email: `usuario${sellerIndex}@gmail.com`,
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerIndex + 100}`,
                isVerified: isSellerVerified,
            },
            title: template.titles[langKey as keyof typeof template.titles] || template.titles['es'],
            description: desc,
            price: finalPrice,
            currency: lang === 'zh' ? 'CNY' : 'MXN',
            images: [template.img],
            category: cat,
            deliveryType: getMockDeliveryType(cat),
            location: { latitude: finalLat, longitude: finalLon },
            locationName: lang === 'es' ? "CDMX" : "Nearby",
            createdAt: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
            isPromoted: isPromoted,
            country: 'Mexico',
            city: 'Mexico City'
        });
    }
    return items;
};
