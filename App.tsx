
import React, { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { ProductCard } from './components/ProductCard';
import { SellModal } from './components/SellModal';
import { CartDrawer } from './components/CartDrawer';
import { ProductDetails } from './components/ProductDetails';
import { UserProfile } from './components/UserProfile';
import { ChatList } from './components/ChatList';
import { ChatWindow } from './components/ChatWindow';
import { User, Product, Coordinates, Category, Language, DeliveryType, Conversation, ViewState } from './types';
import { MapPinOff, RefreshCw, SearchX, Car, Home, Smartphone, Briefcase, Armchair, Shirt, Book, Trophy, Package } from 'lucide-react';
import { calculateDistance } from './services/utils';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { supabase } from './services/supabase';
import { API_BASE_URL } from './services/apiConfig';
import { createOrGetConversation, sendMessage as sendMessageApi, getUserConversations, subscribeToConversations } from './services/chatService';


// --- EXPANDED MOCK DATA TEMPLATES ---
const MOCK_TEMPLATES: Record<Category, Array<{
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
  ]
};

const MOCK_DESCRIPTIONS = {
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

// Generate 400 items
const generateMockProducts = (center: Coordinates, lang: Language): Product[] => {
  const TOTAL_ITEMS = 400;
  const items: Product[] = [];
  const categories = Object.keys(MOCK_TEMPLATES) as Category[];

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

    const descList = MOCK_DESCRIPTIONS[lang] || MOCK_DESCRIPTIONS['es'];
    const desc = descList[Math.floor(Math.random() * descList.length)];

    const sellerIndex = Math.floor(Math.random() * 50);

    // Monetization Mock
    const isPromoted = Math.random() < 0.08; // 8% chance of being promoted
    const isSellerVerified = Math.random() < 0.2; // 20% chance of being verified

    items.push({
      id: `mock-${i}`,
      seller: {
        id: `user-${sellerIndex}`,
        name: `Usuario ${sellerIndex + 1}`,
        email: `usuario${sellerIndex}@gmail.com`,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerIndex + 100}`,
        isVerified: isSellerVerified,
      },
      title: template.titles[lang] || template.titles['es'],
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
    });
  }
  return items;
};

// --- MAIN CONTENT COMPONENT ---
// This component consumes the Language Context
const AppContent: React.FC = () => {
  const { t, language } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingLoc, setIsLoadingLoc] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [currentView, setCurrentView] = useState<ViewState>({ type: 'home' });
  const [cart, setCart] = useState<Product[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Loading and Error States
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);

  useEffect(() => {
    document.title = "DESCU";
  }, [language]);

  // Supabase Auth State Listener
  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          avatar: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
          isVerified: false,
        });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
          email: session.user.email || '',
          avatar: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
          isVerified: false,
        });
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login Handler - now triggers Google OAuth
  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('登录失败:', error);
      alert('登录失败，请重试');
    }
  };


  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleVerifyUser = () => {
    if (user) {
      setUser({ ...user, isVerified: true });
    }
  };

  const handleBoostProduct = (productId: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, isPromoted: true };
      }
      return p;
    }));
  };

  // Geolocation and Load Products
  useEffect(() => {
    const fallbackCDMX = { latitude: 19.4326, longitude: -99.1332 };

    const loadProductsFromAPI = async (coords: Coordinates) => {
      try {
        // 从数据库加载真实商品
        const response = await fetch(`${API_BASE_URL}/api/products`);
        if (response.ok) {
          const dbProducts = await response.json();

          // 转换数据库格式到应用格式
          const convertedProducts: Product[] = dbProducts.map((p: any) => ({
            id: p.id,
            seller: {
              id: p.seller_id,
              name: p.seller_name,
              email: p.seller_email,
              avatar: p.seller_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.seller_id}`,
              isVerified: p.seller_verified || false,
            },
            title: p.title,
            description: p.description,
            price: p.price,
            currency: p.currency,
            images: p.images || [],
            category: p.category,
            deliveryType: p.delivery_type,
            location: {
              latitude: p.latitude || coords.latitude,
              longitude: p.longitude || coords.longitude,
            },
            locationName: p.location_name || 'Unknown',
            createdAt: new Date(p.created_at).getTime(),
            isPromoted: p.is_promoted || false,
          }));

          // 生成一些mock商品填充列表
          const mocks = generateMockProducts(coords, language);

          // 合并数据库商品和mock商品
          setProducts([...convertedProducts, ...mocks]);
        } else {
          // 如果API失败，只使用mock数据
          const mocks = generateMockProducts(coords, language);
          setProducts(mocks);
        }
      } catch (error) {
        console.error('加载商品失败:', error);
        // 失败时使用mock数据
        const mocks = generateMockProducts(coords, language);
        setProducts(mocks);
      }
    };

    const updateProducts = (coords: Coordinates) => {
      setLocation(coords);
      loadProductsFromAPI(coords);
    };

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(coords);
          setIsLoadingLoc(false);
          updateProducts(coords);
        },
        (error) => {
          console.error("Error getting location", error);
          setPermissionDenied(true);
          setIsLoadingLoc(false);
          setLocation(fallbackCDMX);
          updateProducts(fallbackCDMX);
        }
      );
    } else {
      setIsLoadingLoc(false);
      setPermissionDenied(true);
      setLocation(fallbackCDMX);
      updateProducts(fallbackCDMX);
    }
  }, [language]);

  // Load conversations and subscribe to updates
  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    // 1. Load initial conversations
    const loadConversations = async () => {
      try {
        const data = await getUserConversations(user.id);
        // DEBUG: 临时调试弹窗，确认数据是否到达
        // DEBUG: 数据已确认到达，移除弹窗以免阻塞渲染

        // Map backend data to frontend model
        const mappedConversations: Conversation[] = data.map((c: any) => {
          //Determine if current user is buyer or seller
          const isBuyer = user.id === c.user1_id;

          // Construct other user info
          let otherUser;
          // Check for sellerInfo (camelCase from new backend) or seller_info (legacy)
          const sellerInfo = c.sellerInfo || c.seller_info;

          if (isBuyer && sellerInfo) {
            // If I am buyer, other user is seller
            otherUser = {
              id: sellerInfo.id,
              name: sellerInfo.name,
              email: '', // Not returned by API for privacy
              avatar: sellerInfo.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
              isVerified: false
            };
          } else {
            // If I am seller, other user is buyer (info not fully available yet)
            // Or fallback if sellerInfo is missing
            otherUser = {
              id: isBuyer ? c.user2_id : c.user1_id,
              name: isBuyer ? 'Seller' : 'Buyer', // Placeholder
              email: '',
              avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
              isVerified: false
            };
          }

          return {
            id: c.id,
            productId: c.product_id,
            productTitle: c.productTitle || c.product_title || 'Product',
            productImage: c.productImage || c.product_image || '',
            otherUser,
            lastMessageTime: new Date(c.updated_at).getTime(),
            messages: []
          };
        });

        setConversations(mappedConversations);
      } catch (error: any) {
        console.error('Failed to load conversations', error);
        alert(`❌ 加载对话列表失败\n错误: ${error.message}\nAPI: ${API_BASE_URL}`);
      }
    };

    loadConversations();

    // 2. Subscribe to real-time updates
    const unsubscribe = subscribeToConversations(user.id, (payload) => {
      // Handle update
      console.log('Conversation update:', payload);
      loadConversations(); // Simplest strategy: reload list
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Handlers
  const handleSellClick = () => {
    if (!user) {
      handleLogin();
    } else {
      setIsSellModalOpen(true);
    }
  };

  const handleProductSubmit = async (newProductData: Omit<Product, 'id' | 'createdAt' | 'distance'>) => {
    if (!user) {
      alert('请先登录');
      return;
    }

    setIsCreatingProduct(true);

    try {
      // 调用后端 API 创建商品
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          seller_id: user.id,
          seller_name: user.name,
          seller_email: user.email,
          seller_avatar: user.avatar,
          seller_verified: user.isVerified || false,
          title: newProductData.title,
          description: newProductData.description,
          price: newProductData.price,
          currency: newProductData.currency,
          images: newProductData.images,
          category: newProductData.category,
          delivery_type: newProductData.deliveryType,
          latitude: newProductData.location.latitude,
          longitude: newProductData.location.longitude,
          location_name: newProductData.locationName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '商品发布失败');
      }

      const savedProduct = await response.json();

      // 转换数据库格式到应用格式
      const productForApp: Product = {
        id: savedProduct.id,
        seller: {
          id: savedProduct.seller_id,
          name: savedProduct.seller_name,
          email: savedProduct.seller_email,
          avatar: savedProduct.seller_avatar || user.avatar,
          isVerified: savedProduct.seller_verified || false,
        },
        title: savedProduct.title,
        description: savedProduct.description,
        price: savedProduct.price,
        currency: savedProduct.currency,
        images: savedProduct.images || [],
        category: savedProduct.category,
        deliveryType: savedProduct.delivery_type,
        location: {
          latitude: savedProduct.latitude,
          longitude: savedProduct.longitude,
        },
        locationName: savedProduct.location_name,
        createdAt: new Date(savedProduct.created_at).getTime(),
        isPromoted: savedProduct.is_promoted || false,
      };

      // 更新本地状态
      setProducts(prev => [productForApp, ...prev]);
      setIsSellModalOpen(false);
      setCurrentView({ type: 'home' });

      alert('🎉 商品发布成功！');
    } catch (error) {
      console.error('商品创建失败:', error);
      alert(`❌ 商品发布失败: ${error instanceof Error ? error.message : '请稍后重试'}`);
    } finally {
      setIsCreatingProduct(false);
    }
  };

  const addToCart = (product: Product) => {
    if (!user) {
      handleLogin();
      return;
    }
    if (!cart.some(item => item.id === product.id)) {
      setCart(prev => [...prev, product]);
      setIsCartOpen(true);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  const handleCheckout = () => {
    setCart([]);
  };

  // Chat Logic
  const handleContactSeller = async (product: Product) => {
    if (!user) {
      handleLogin();
      return;
    }

    // 检查是否已有对话
    let existingConv = conversations.find(
      c => c.otherUser.id === product.seller.id && c.productId === product.id
    );

    if (existingConv) {
      setCurrentView({ type: 'chat-window', conversationId: existingConv.id });
      return;
    }

    setIsLoadingChat(true);
    try {
      // 调用 API 创建或获取对话
      const conversation = await createOrGetConversation(
        product.id,
        user.id,
        product.seller.id
      );

      // 创建本地对话对象
      const newConversation: Conversation = {
        id: conversation.id || conversation.conversation?.id, // 处理不同的响应格式
        otherUser: product.seller,
        productId: product.id,
        productTitle: product.title,
        productImage: product.images[0],
        messages: [],
        lastMessageTime: Date.now(),
      };

      setConversations(prev => [...prev, newConversation]);
      setCurrentView({ type: 'chat-window', conversationId: newConversation.id });
    } catch (error) {
      console.error('创建对话失败:', error);
      alert('❌ 无法打开聊天，请稍后重试');
    } finally {
      setIsLoadingChat(false);
    }
  };

  const handleSendMessage = async (conversationId: string, text: string) => {
    if (!user) return;
    if (!text.trim()) return;

    const timestamp = Date.now();
    const tempMessageId = `msg-temp-${timestamp}`;

    // 先添加到本地UI（乐观更新）
    const tempMessage = {
      id: tempMessageId,
      senderId: user.id,
      text,
      timestamp,
      isRead: true,
    };

    setConversations(prev => prev.map(c => {
      if (c.id === conversationId) {
        return {
          ...c,
          messages: [...c.messages, tempMessage],
          lastMessageTime: timestamp,
        };
      }
      return c;
    }));

    try {
      // 调用 API 发送消息
      const savedMessage = await sendMessageApi(conversationId, user.id, text);

      // 用真实ID替换临时ID
      setConversations(prev => prev.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === tempMessageId
                ? { ...m, id: savedMessage.id || savedMessage.message?.id }
                : m
            ),
          };
        }
        return c;
      }));
    } catch (error) {
      console.error('发送消息失败:', error);
      // 从UI移除失败的消息
      setConversations(prev => prev.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            messages: c.messages.filter(m => m.id !== tempMessageId),
          };
        }
        return c;
      }));
      alert('❌ 消息发送失败，请重试');
    }
  };

  // --- DEBOUNCE HOOK ---
  function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
      const handler = setTimeout(() => {
        setDebouncedValue(value);
      }, delay);
      return () => {
        clearTimeout(handler);
      };
    }, [value, delay]);
    return debouncedValue;
  }

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // Sorting & Filtering
  const sortedProducts = useMemo(() => {
    let filtered = products;

    if (debouncedSearchQuery.trim()) {
      const lowerQ = debouncedSearchQuery.toLowerCase();
      const translatedCategory = Object.values(Category).find(c => t(`cat.${c}`).toLowerCase().includes(lowerQ));

      filtered = products.filter(p =>
        p.title.toLowerCase().includes(lowerQ) ||
        p.description.toLowerCase().includes(lowerQ) ||
        (translatedCategory && p.category === translatedCategory) ||
        p.category.toLowerCase().includes(lowerQ)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    if (!location) return filtered;

    const withDistance = filtered.map(p => ({
      ...p,
      distance: calculateDistance(location, p.location)
    }));

    return withDistance.sort((a, b) => {
      // 1. Promoted items first
      if (a.isPromoted && !b.isPromoted) return -1;
      if (!a.isPromoted && b.isPromoted) return 1;

      // 2. Nearby items (within 5km)
      const aIsClose = a.distance! <= 5;
      const bIsClose = b.distance! <= 5;

      if (aIsClose && !bIsClose) return -1;
      if (!aIsClose && bIsClose) return 1;

      // 3. Distance ascending
      return a.distance! - b.distance!;
    });
  }, [products, location, debouncedSearchQuery, selectedCategory, t]);

  const CATEGORIES = [
    { id: 'all', icon: RefreshCw, label: 'cat.all' },
    { id: Category.Vehicles, icon: Car, label: 'cat.vehicles' },
    { id: Category.RealEstate, icon: Home, label: 'cat.real_estate' },
    { id: Category.Electronics, icon: Smartphone, label: 'cat.electronics' },
    { id: Category.Services, icon: Briefcase, label: 'cat.services' },
    { id: Category.Furniture, icon: Armchair, label: 'cat.furniture' },
    { id: Category.Clothing, icon: Shirt, label: 'cat.clothing' },
    { id: Category.Sports, icon: Trophy, label: 'cat.sports' },
    { id: Category.Books, icon: Book, label: 'cat.books' },
    { id: Category.Other, icon: Package, label: 'cat.other' },
  ];

  const unreadCount = useMemo(() => {
    if (!user) return 0;
    return conversations.reduce((acc, c) => {
      return acc + c.messages.filter(m => !m.isRead && m.senderId !== user.id).length;
    }, 0);
  }, [conversations, user]);

  const renderContent = () => {
    switch (currentView.type) {
      case 'product':
        const product = products.find(p => p.id === (currentView as any).productId);
        if (!product) return <div className="p-8 text-center text-gray-500">Product not found</div>;
        return (
          <ProductDetails
            product={product}
            onBack={() => setCurrentView({ type: 'home' })}
            onAddToCart={addToCart}
            onContactSeller={handleContactSeller}
            isInCart={cart.some(p => p.id === product.id)}
          />
        );
      case 'chat-list':
        if (!user) return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
            <h2 className="text-xl font-bold mb-4">{t('nav.login')}</h2>
            <button onClick={handleLogin} className="bg-brand-600 text-white px-8 py-3 rounded-full font-bold shadow-lg">Google Login</button>
          </div>
        );
        return (
          <ChatList
            conversations={conversations}
            currentUser={user}
            onSelectConversation={(id) => setCurrentView({ type: 'chat-window', conversationId: id })}
          />
        );
      case 'chat-window':
        const activeConv = conversations.find(c => c.id === (currentView as any).conversationId);
        if (!activeConv || !user) {
          setTimeout(() => setCurrentView({ type: 'chat-list' }), 0);
          return <div className="p-4 text-center">Loading chat...</div>;
        }
        return (
          <div className="flex-1 sm:py-8 sm:px-4 flex justify-center bg-gray-50">
            <div className="w-full max-w-4xl h-full sm:h-[85vh] bg-white sm:rounded-2xl shadow-xl overflow-hidden">
              <ChatWindow
                conversation={activeConv}
                currentUser={user}
                onBack={() => setCurrentView({ type: 'chat-list' })}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        );
      case 'profile':
        if (!user) return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
            <h2 className="text-xl font-bold mb-4">{t('nav.login')}</h2>
            <button
              onClick={handleLogin}
              className="bg-brand-600 text-white px-8 py-3 rounded-full font-bold shadow-lg"
            >
              Google Login
            </button>
          </div>
        );
        const userProducts = products.filter(p => p.seller.id === user.id);
        return (
          <UserProfile
            user={user}
            userProducts={userProducts}
            onUpdateUser={handleUpdateUser}
            onBack={() => setCurrentView({ type: 'home' })}
            onProductClick={(p) => setCurrentView({ type: 'product', productId: p.id })}
            onVerifyUser={handleVerifyUser}
            onBoostProduct={handleBoostProduct}
          />
        );
      case 'home':
      default:
        return (
          <main className="max-w-5xl mx-auto px-4 pb-24">
            {/* DESCU Brand Header with Updated Logo */}
            <div className="flex flex-col items-center justify-center pt-10 pb-8">
              <div className="flex items-center gap-3 animate-fade-in-up">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-brand-600 text-white flex items-center justify-center rounded-2xl shadow-xl shadow-brand-500/30 transform hover:scale-105 transition-transform backdrop-blur-sm bg-opacity-90">
                  <svg viewBox="0 0 100 100" className="w-8 h-8 md:w-10 md:h-10 fill-none stroke-white" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
                    {/* Stylized 'D' + Tag hook */}
                    <path d="M30 20 H50 C70 20 85 35 85 50 C85 65 70 80 50 80 H30 Z" />
                    <circle cx="45" cy="40" r="5" fill="white" stroke="none" />
                    <path d="M30 20 V80" />
                  </svg>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-800 tracking-tighter drop-shadow-sm">DESCU</h1>
              </div>
              <p className="text-gray-500 text-xs md:text-base font-medium mt-3 tracking-wide bg-white/40 px-4 py-1 rounded-full backdrop-blur-sm border border-white/40 text-center">{t('hero.subtitle')}</p>
            </div>

            {/* Category Filter - Glass Pills */}
            <div className="flex gap-4 overflow-x-auto pb-6 mb-6 no-scrollbar px-1">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex flex-col items-center flex-shrink-0 gap-2 min-w-[76px] group transition-all duration-300 ${selectedCategory === cat.id ? 'opacity-100 scale-105' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                >
                  <div className={`w-16 h-16 rounded-3xl flex items-center justify-center transition-all duration-300 ${selectedCategory === cat.id
                    ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg shadow-brand-500/40'
                    : 'bg-white/60 backdrop-blur-md text-gray-600 shadow-sm border border-white/60 group-hover:bg-white/80'
                    }`}>
                    <cat.icon size={26} strokeWidth={selectedCategory === cat.id ? 2.5 : 2} />
                  </div>
                  <span className={`text-xs font-bold whitespace-nowrap px-2 py-0.5 rounded-full ${selectedCategory === cat.id
                    ? 'text-brand-700 bg-brand-50/50'
                    : 'text-gray-500 group-hover:text-gray-700'
                    }`}>
                    {t(cat.label)}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between mb-6 px-1">
              <h2 className="text-2xl font-black text-gray-800 tracking-tight flex items-center gap-2">
                {selectedCategory === 'all' ? t('list.header') : t(`cat.${selectedCategory}`)}
                <span className="text-sm font-normal text-gray-400 bg-white/50 px-2 py-0.5 rounded-full backdrop-blur-xs border border-white/40">{sortedProducts.length}</span>
              </h2>

              <div className="flex items-center gap-2 text-xs text-gray-600 bg-white/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/50 shadow-sm transition-all hover:bg-white/80 cursor-pointer">
                {isLoadingLoc ? (
                  <span className="flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin text-brand-500" /> {t('list.loading_loc')}</span>
                ) : permissionDenied ? (
                  <span className="flex items-center gap-1.5 text-orange-500 font-bold"><MapPinOff size={12} /> {t('list.loc_denied')}</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-brand-600 font-bold"><RefreshCw size={12} /> {t('list.loc_success')}</span>
                )}
              </div>
            </div>

            {sortedProducts.length === 0 ? (
              <div className="text-center py-24 glass-panel rounded-[2.5rem] flex flex-col items-center justify-center">
                <div className="bg-gray-50/50 w-28 h-28 rounded-full flex items-center justify-center mb-6 text-gray-300 border-2 border-dashed border-gray-200">
                  {searchQuery ? <SearchX size={48} /> : <Package size={48} />}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {searchQuery ? t('list.no_results') : t('list.empty')}
                </h3>
                <p className="text-gray-400 max-w-xs mx-auto mb-6 leading-relaxed">
                  {searchQuery ? 'Suggestions: check spelling or try broader terms.' : 'Be the first to list an item in this category!'}
                </p>
                {!searchQuery && (
                  <button onClick={handleSellClick} className="px-8 py-3 bg-brand-600 text-white font-bold rounded-full shadow-lg shadow-brand-200 hover:scale-105 active:scale-95 transition-all">
                    {t('nav.sell')}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {sortedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={addToCart}
                    isInCart={cart.some(item => item.id === product.id)}
                    onClick={(p) => setCurrentView({ type: 'product', productId: p.id })}
                  />
                ))}
              </div>
            )}

            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm border border-white/20 text-gray-400 text-xs font-medium">
                <span>DESCU Marketplace © 2024</span>
                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                <span>Premium Resale</span>
              </div>
            </div>
          </main>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50 animate-gradient-xy flex flex-col font-sans text-gray-900 selection:bg-brand-100 selection:text-brand-900">
      <Navbar
        user={user}
        onLogin={handleLogin}
        onSellClick={handleSellClick}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
        onProfileClick={() => setCurrentView({ type: 'profile' })}
        onLogoClick={() => setCurrentView({ type: 'home' })}
        onChatClick={() => setCurrentView({ type: 'chat-list' })}
        unreadCount={unreadCount}
      />

      <div className="flex-1 flex flex-col relative w-full max-w-[100vw] overflow-x-hidden">
        {renderContent()}
      </div>

      {currentView.type !== 'chat-window' && (
        <BottomNav
          currentView={currentView.type === 'product' ? 'home' : currentView.type}
          onChangeView={(view) => setCurrentView({ type: view })}
          onSellClick={handleSellClick}
          onCartClick={() => setIsCartOpen(true)}
          cartCount={cart.length}
          unreadCount={unreadCount}
        />
      )}

      <SellModal
        isOpen={isSellModalOpen}
        onClose={() => setIsSellModalOpen(false)}
        onSubmit={handleProductSubmit}
        user={user!}
        userLocation={location}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onRemoveItem={removeFromCart}
        onCheckout={handleCheckout}
      />
    </div>
  );
};

// --- ROOT APP WRAPPER ---
// This component provides the context to the rest of the app
const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
};

export default App;
