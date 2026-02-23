
import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
// CartDrawer removed - direct purchase model
import { ErrorBoundary } from './components/ErrorBoundary';
import { User, Product, Coordinates, Category, Conversation, DeliveryType } from './types';
import { calculateDistance } from './services/utils';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { RegionProvider, useRegion } from './contexts/RegionContext';
import { supabase } from './services/supabase';
import { API_BASE_URL } from './services/apiConfig';
import { createOrGetConversation, sendMessage as sendMessageApi, getUserConversations, subscribeToConversations } from './services/chatService';
import { GlassToast, ToastType } from './components/GlassToast';
import { reverseGeocode, DetailedLocationInfo, getDetailedLocation } from './services/locationService';
import { generateMockProducts } from './services/mockData';
import { Toaster } from 'react-hot-toast';

// Lazy Load Modals
const SellModal = React.lazy(() => import('./components/SellModal').then(module => ({ default: module.SellModal })));
const OnboardingModal = React.lazy(() => import('./components/OnboardingModal').then(module => ({ default: module.OnboardingModal })));
const LoginModal = React.lazy(() => import('./components/LoginModal').then(module => ({ default: module.LoginModal })));
const CameraSellFlow = React.lazy(() => import('./components/CameraSellFlow').then(module => ({ default: module.CameraSellFlow })));


// Pages
// Pages
// Pages
// Optimized with React.lazy for better performance
const HomePage = React.lazy(() => import('./pages/HomePage').then(module => ({ default: module.HomePage })));
const ProductPage = React.lazy(() => import('./pages/ProductPage').then(module => ({ default: module.ProductPage })));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage').then(module => ({ default: module.ProfilePage })));
const ChatPage = React.lazy(() => import('./pages/ChatPage').then(module => ({ default: module.ChatPage })));
const AdminPage = React.lazy(() => import('./pages/AdminPage').then(module => ({ default: module.AdminPage }))); // [NEW] Admin
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage'));

// Loading Component
const PageLoader = () => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center p-4">
    <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4"></div>
  </div>
);

// --- MOCK DATA ---
// Moved to services/mockData.ts


const AppContent: React.FC = () => {
  const { t, language } = useLanguage();
  const { region, currency: regionCurrency } = useRegion();
  const navigate = useNavigate();
  const locationHook = useLocation();

  // Determine current view from URL for BottomNav
  const currentView = useMemo(() => {
    const path = locationHook.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/chat')) return 'chat-list';
    if (path.startsWith('/profile')) return 'profile';
    if (path.startsWith('/product')) return 'product';
    return 'home';
  }, [locationHook.pathname]);

  // Toast State
  const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({
    show: false,
    message: '',
    type: 'success'
  });

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ show: true, message, type });
  };
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingLoc, setIsLoadingLoc] = useState(true);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [locationInfo, setLocationInfo] = useState<DetailedLocationInfo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Cart state removed - direct purchase model
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); // [NEW]
  const [isCameraFlowOpen, setIsCameraFlowOpen] = useState(false); // [NEW]

  // Chat State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<any[]>([]);
  const [pendingOrderCount, setPendingOrderCount] = useState(0);

  // Pagination State
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    document.title = "DESCU";
  }, [language]);

  // 移除这里的import，将在顶部添加

  // Supabase Auth State Listener
  useEffect(() => {
    const loadUserWithLocation = async (session: any) => {
      if (!session?.user) return null;

      const baseUser = {
        id: session.user.id,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
        email: session.user.email || '',
        avatar: session.user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.id}`,
        isVerified: false,
      };

      // 同步用户信息到 public.users 表（供聊天和订单通知使用）
      try {
        await supabase.from('users').upsert({
          id: baseUser.id,
          name: baseUser.name,
          avatar_url: baseUser.avatar,
          email: baseUser.email,
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' });
      } catch (syncErr) {
        console.warn('[App] Failed to sync user to public.users:', syncErr);
      }

      // Get user location from IP
      try {
        const { getLocationFromIP } = await import('./services/locationService');
        const locationInfo = await getLocationFromIP();
        if (locationInfo) {
          return { ...baseUser, country: locationInfo.country, city: locationInfo.city };
        }
      } catch (error) {
        console.error('Failed to get IP location:', error);
      }

      return baseUser;
    };

    // 抽离Auth处理逻辑
    const handleAuthCallback = async (url: string) => {
      console.log('[App] Handling Auth Callback:', url);
      // 处理Hash中的参数 (access_token, refresh_token)
      // URL可能是 "com.venya.marketplace://google-callback#access_token=..." 
      // 或者 "http://localhost:3000/#access_token=..."

      const hashIndex = url.indexOf('#');
      if (hashIndex === -1) return;

      const hashParams = new URLSearchParams(url.substring(hashIndex + 1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        console.log('[App] Tokens found, setting session...');
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (error) {
            console.error('[App] Set session error:', error);
            showToast(t('toast.login_failed'), 'error');
          } else if (data.session) {
            console.log('[App] Session set successfully');
            const userWithLocation = await loadUserWithLocation(data.session);
            if (userWithLocation) setUser(userWithLocation);
            console.log('[App] User state updated');
          }
        } catch (err) {
          console.error('[App] Unexpected auth error:', err);
        }
      }
    };

    const initAuth = async () => {
      // 1. 检查当前URL (冷启动)
      await handleAuthCallback(window.location.href);

      // 2. 检查现有Session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const userWithLocation = await loadUserWithLocation(session);
        if (userWithLocation) setUser(userWithLocation);
      }
    };

    initAuth();

    // 3. 监听 Deep Link (后台恢复)
    CapacitorApp.addListener('appUrlOpen', async (event) => {
      console.log('[App] Deep link opened:', event.url);
      if (event.url.includes('access_token')) {
        await handleAuthCallback(event.url);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const userWithLocation = await loadUserWithLocation(session);
        if (userWithLocation) {
          setUser(userWithLocation);

          // 🌍 自动更新用户位置到服务器
          const userWithLoc = userWithLocation as any;
          if (userWithLoc.country && userWithLoc.city) {
            updateUserLocationToServer(userWithLoc).catch(err => {
              console.error('[App] Failed to update user location:', err);
            });
          }
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
      CapacitorApp.removeAllListeners();
    };
  }, []);

  // 🔔 全局消息 Realtime 订阅 - 实时更新未读消息计数
  useEffect(() => {
    if (!user) return;

    console.log('[App] Setting up global message subscription for user:', user.id);

    const channel = supabase
      .channel('global-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          const newMsg = payload.new as any;
          console.log('[App] New message received:', newMsg.id);

          // 检查是否需要更新未读计数
          if (newMsg.sender_id !== user.id) {
            // 获取对话信息，确认是否与当前用户相关
            const { data: conv } = await supabase
              .from('conversations')
              .select('user1_id, user2_id')
              .eq('id', newMsg.conversation_id)
              .single();

            if (conv) {
              const isMyConversation = conv.user1_id === user.id || conv.user2_id === user.id;

              if (isMyConversation) {
                console.log('[App] Message is for current user, refreshing conversations...');

                // 刷新对话列表以更新未读消息
                try {
                  const { getUserConversations } = await import('./services/chatService');
                  const updatedConvs = await getUserConversations(user.id);
                  if (updatedConvs && updatedConvs.length > 0) {
                    // 更新对话列表
                    setConversations(updatedConvs.map((c: any) => {
                      const isBuyer = user.id === c.user1_id;
                      const sellerInfo = c.sellerInfo || c.seller_info;
                      let otherUser;

                      if (isBuyer && sellerInfo) {
                        otherUser = {
                          id: sellerInfo.id,
                          name: sellerInfo.name,
                          email: '',
                          avatar: sellerInfo.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerInfo.id}`,
                          isVerified: false
                        };
                      } else if (c.buyerInfo) {
                        otherUser = {
                          id: c.buyerInfo.id,
                          name: c.buyerInfo.name || 'User',
                          email: '',
                          avatar: c.buyerInfo.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.buyerInfo.id}`,
                          isVerified: false
                        };
                      } else {
                        const otherId = isBuyer ? c.user2_id : c.user1_id;
                        otherUser = {
                          id: otherId,
                          name: 'User',
                          email: '',
                          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`,
                          isVerified: false
                        };
                      }

                      return {
                        id: c.id,
                        productId: c.product_id,
                        productTitle: c.productTitle || c.product_title || 'Product',
                        productImage: c.productImage || c.product_image || '',
                        otherUser,
                        messages: [],
                        lastMessageTime: new Date(c.updated_at).getTime(),
                        buyerId: c.buyer_id || c.user1_id,
                        sellerId: c.seller_id || c.user2_id,
                        orderId: c.orderId || null,
                        orderStatus: c.orderStatus || null
                      };
                    }));
                  }
                } catch (error) {
                  console.error('[App] Error refreshing conversations:', error);
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[App] Cleaning up global message subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);


  // 更新用户位置到服务器
  const updateUserLocationToServer = async (user: any) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_BASE_URL}/api/users/update-location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          country: user.country,
          city: user.city,
          countryName: user.country // 可以从IP API获取更详细的信息
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update location');
      }

      console.log('[App] User location updated successfully');
    } catch (error) {
      console.error('[App] Error updating location:', error);
      // 不显示错误给用户，静默失败
    }
  };

  const handleLogin = async () => {
    try {
      // 检测是否在Capacitor环境（移动应用）
      const isCapacitor = window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'ionic:' ||
        (window as any).Capacitor?.isNativePlatform?.();

      // 在移动端使用deep link，web端使用origin
      const redirectUrl = isCapacitor
        ? 'com.venya.marketplace://'
        : window.location.origin;

      if (isCapacitor) {
        // 移动端：手动构建OAuth URL并使用外部浏览器打开
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true, // 阻止自动跳转
          },
        });

        if (error) throw error;
        if (data?.url) {
          // 使用外部浏览器打开OAuth URL
          await Browser.open({ url: data.url });
        }
      } else {
        // Web端：正常OAuth流程
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirectUrl,
          },
        });
        if (error) throw error;
      }

      setIsLoginModalOpen(false);
    } catch (error) {
      console.error('登录失败:', error);
      showToast(t('toast.login_failed'), 'error');
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: updatedUser.name,
          avatar_url: updatedUser.avatar
        }
      });
      if (error) throw error;

      // 同步更新 public.users 表（供聊天和订单通知使用）
      await supabase.from('users').upsert({
        id: updatedUser.id,
        name: updatedUser.name,
        avatar_url: updatedUser.avatar,
        email: updatedUser.email,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

      // 只更新 name/avatar，保留已有的 country/city 等字段
      setUser(prev => prev ? { ...prev, name: updatedUser.name, avatar: updatedUser.avatar } : updatedUser);
      showToast(t('toast.profile_updated'), 'success');
    } catch (error) {
      console.error('更新失败:', error);
      showToast(t('toast.update_failed'), 'error');
    }
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

  const loadProducts = async (coords: Coordinates, pageNum: number = 1) => {
    try {
      if (pageNum === 1) setIsLoadingProducts(true);
      else setIsLoadingMore(true);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const limit = 20;
      const offset = (pageNum - 1) * limit;

      console.log('[App] loadProducts: fetching page', pageNum, 'lang:', language);
      const response = await fetch(`${API_BASE_URL}/api/products?lang=${language}&limit=${limit}&offset=${offset}`, {
        headers
      });

      if (response.ok) {
        const dbProducts = await response.json();
        console.log('[App] loadProducts: received', dbProducts.length, 'products');
        const convertedProducts: Product[] = dbProducts.map((p: any) => ({
          id: p.id,
          seller: {
            id: p.seller_id,
            name: p.seller_name,
            seller_info: p.seller_info,
            email: p.seller_email,
            avatar: p.seller_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.seller_id}`,
            isVerified: p.seller_verified || false,
          },
          title: p.title,
          description: p.description,
          // 多语言翻译字段
          title_zh: p.title_zh,
          title_en: p.title_en,
          title_es: p.title_es,
          description_zh: p.description_zh,
          description_en: p.description_en,
          description_es: p.description_es,
          price: p.price,
          currency: p.currency,
          images: p.images || [],
          category: p.category,
          subcategory: p.subcategory,
          deliveryType: p.delivery_type,
          location: {
            latitude: p.latitude || coords.latitude || 0,
            longitude: p.longitude || coords.longitude || 0,
          },
          locationName: p.location_name || 'Unknown',
          country: p.country,
          city: p.city,
          createdAt: new Date(p.created_at).getTime(),
          isPromoted: p.is_promoted || false,
          status: p.status,
          // Calculate real distance from user location
          distance: calculateDistance(coords, { latitude: p.latitude || coords.latitude || 0, longitude: p.longitude || coords.longitude || 0 }),
        }));

        if (convertedProducts.length < limit) {
          setHasMore(false);
        } else {
          setHasMore(true);
        }

        if (pageNum === 1) {
          setProducts(convertedProducts);
        } else {
          setProducts(prev => [...prev, ...convertedProducts]);
        }

      } else {
        console.error('[App] loadProducts: API returned', response.status);
        if (pageNum === 1) setProducts([]);
      }
    } catch (error: any) {
      // Ignore aborted requests (caused by language switch or component re-mount)
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log('[App] loadProducts: request aborted (expected during language switch)');
        return;
      }
      console.error('加载商品失败:', error);
      showToast(`${t('toast.load_failed')}: ${error.message || '未知错误'}`, 'error');
      if (pageNum === 1) setProducts([]);
    } finally {
      setIsLoadingProducts(false);
      setIsLoadingMore(false);
    }
  };

  const FALLBACK_CDMX = { latitude: 19.4326, longitude: -99.1332 };

  const handleLoadMore = () => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadProducts(location || FALLBACK_CDMX, nextPage);
  };

  // ========== 定位 useEffect（只执行一次，不依赖 language）==========
  useEffect(() => {
    const initLocation = async () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setLocation(coords);
            setIsLoadingLoc(false);

            // 反向地理编码异步执行
            getDetailedLocation(coords.latitude, coords.longitude)
              .then(detail => { if (detail) setLocationInfo(detail); })
              .catch(err => console.warn('[App] getDetailedLocation error:', err));
          },
          (error) => {
            console.error("Loc error", error);
            setPermissionDenied(true);
            setIsLoadingLoc(false);
            setLocation(FALLBACK_CDMX);
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 3600000 }
        );
      } else {
        setPermissionDenied(true);
        setIsLoadingLoc(false);
        setLocation(FALLBACK_CDMX);
      }
    };

    initLocation();
  }, []); // 只执行一次

  // ========== 产品加载 useEffect（依赖 language，不依赖定位）==========
  useEffect(() => {
    // 使用当前定位或 fallback 坐标，确保产品始终能加载
    const coords = location || FALLBACK_CDMX;
    setPage(1);
    setHasMore(true);

    if (process.env.NODE_ENV === 'development' && !location) {
      const items = generateMockProducts(coords, language);
      setProducts(items);
      setIsLoadingProducts(false);
    } else {
      loadProducts(coords, 1);
    }
  }, [language, location]); // language 或 location 变化都重新加载

  // Load conversations
  useEffect(() => {
    if (!user) {
      setConversations([]);
      return;
    }

    const loadConversations = async () => {
      try {
        const data = await getUserConversations(user.id);
        const mappedConversations: Conversation[] = data.map((c: any) => {
          const isBuyer = user.id === c.user1_id;
          const sellerInfo = c.sellerInfo || c.seller_info;
          let otherUser;

          if (isBuyer && sellerInfo) {
            // 买家看到卖家信息（来自产品表）
            otherUser = {
              id: sellerInfo.id,
              name: sellerInfo.name,
              email: '',
              avatar: sellerInfo.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerInfo.id}`,
              isVerified: false
            };
          } else if (c.buyerInfo) {
            // 卖家看到买家信息（来自 users 表）
            otherUser = {
              id: c.buyerInfo.id,
              name: c.buyerInfo.name || 'User',
              email: '',
              avatar: c.buyerInfo.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.buyerInfo.id}`,
              isVerified: false
            };
          } else {
            // 最终 fallback
            const otherId = isBuyer ? c.user2_id : c.user1_id;
            otherUser = {
              id: otherId,
              name: 'User',
              email: '',
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${otherId}`,
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
            messages: [],
            orderId: c.orderId || null,
            orderStatus: c.orderStatus || null
          };
        });

        setConversations(mappedConversations);
      } catch (error: any) {
        console.error('Failed to load conversations', error);
      }
    };

    loadConversations();

    const unsubscribe = subscribeToConversations(user.id, (payload) => {
      console.log('Conversation update:', payload);
      loadConversations();
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // Load user orders
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setPendingOrderCount(0);
      return;
    }

    const loadOrders = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const response = await fetch(`${API_BASE_URL}/api/orders`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('[App] Orders API response:', data);

          // API 返回 { orders: [...] } 格式
          const ordersArray = data.orders || [];
          setOrders(ordersArray);

          // Count pending orders (not completed or cancelled)
          const pending = ordersArray.filter((order: any) =>
            order.status !== 'completed' &&
            order.status !== 'cancelled'
          ).length;
          setPendingOrderCount(pending);
        }
      } catch (error) {
        console.error('Failed to load orders:', error);
      }
    };

    loadOrders();

    // Refresh orders every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Handlers
  const handleSellClick = () => {
    if (!user) {
      setIsLoginModalOpen(true); // Trigger Action-Based Login
    } else {
      // Reverted to Manual Mode per user request (Camera flow poor on desktop)
      // setIsCameraFlowOpen(true);
      setIsSellModalOpen(true);
    }
  };

  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load Favorites
  useEffect(() => {
    if (!user) {
      setFavorites(new Set());
      return;
    }
    // Lazy load service to avoid cyclic deps if any
    import('./services/favoriteService').then(({ getFavorites }) => {
      getFavorites(user.id).then(ids => {
        setFavorites(new Set(ids));
      });
    });
  }, [user]);

  const handleToggleFavorite = async (product: Product) => {
    if (!user) {
      setIsLoginModalOpen(true);
      return;
    }

    const isFav = favorites.has(product.id);
    // Optimistic Update
    setFavorites(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(product.id);
      else next.add(product.id);
      return next;
    });

    try {
      const { toggleFavorite } = await import('./services/favoriteService');
      await toggleFavorite(user.id, product.id);
      showToast(isFav ? t('toast.favorite_removed') : t('toast.favorite_added'), 'success');
    } catch (error) {
      console.error('Favorite toggle failed', error);
      // Revert
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(product.id);
        else next.delete(product.id);
        return next;
      });
      showToast(t('toast.favorite_update_failed'), 'error');
    }
  };

  const handleProductSubmit = async (newProductData: Omit<Product, 'id' | 'createdAt' | 'distance'>) => {
    if (!user) {
      showToast(t('toast.please_login'), 'warning');
      return;
    }

    setIsCreatingProduct(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('请先登录验证身份');

      // Fetch detailed location (town/district level)
      console.log('[DEBUG] 开始获取详细位置信息...');
      console.log('[DEBUG] 坐标:', {
        lat: newProductData.location.latitude,
        lon: newProductData.location.longitude
      });

      let detailedLocation = null;
      try {
        detailedLocation = await getDetailedLocation(
          newProductData.location.latitude,
          newProductData.location.longitude
        );
        console.log('[DEBUG] getDetailedLocation 返回:', detailedLocation);
      } catch (error) {
        console.error('[DEBUG] 获取详细位置失败:', error);
        // Continue without detailed location
      }

      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
          subcategory: newProductData.subcategory || null,
          source_language: language, // 保存发布时的语言
          delivery_type: newProductData.deliveryType,
          latitude: newProductData.location.latitude,
          longitude: newProductData.location.longitude,
          location_name: newProductData.locationName,
          country: detailedLocation?.city ? (user.country || 'MX') : (user.country || 'MX'),
          city: detailedLocation?.city || user.city || 'Unknown',
          town: detailedLocation?.town || null,
          district: detailedLocation?.district || null,
          location_display_name: detailedLocation?.displayName || (user.city ? `${user.city}` : 'Unknown'),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || '商品发布失败');
      }

      const savedProduct = await response.json();
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
        country: savedProduct.country,
        city: savedProduct.city,
        createdAt: new Date(savedProduct.created_at).getTime(),
        isPromoted: savedProduct.is_promoted || false,
        status: savedProduct.status, // Added status mapping
        // Calculate distance for newly created product using current user location
        distance: location ? calculateDistance(location, { latitude: savedProduct.latitude, longitude: savedProduct.longitude }) : undefined,
      };

      setProducts(prev => [productForApp, ...prev]);
      setIsSellModalOpen(false);
      navigate('/');
      showToast(t('toast.product_published'), 'success');
    } catch (error) {
      console.error('商品创建失败:', error);
      showToast(`${t('toast.product_publish_failed')}${error instanceof Error ? ': ' + error.message : ''}`, 'error');
    } finally {
      setIsCreatingProduct(false);
    }
  };

  // Cart functions completely removed - direct purchase model

  const handleContactSeller = async (product: Product) => {
    if (!user) {
      setIsLoginModalOpen(true); // Trigger Action-Based Login
      return;
    }

    let existingConv = conversations.find(
      c => c.otherUser.id === product.seller.id && c.productId === product.id
    );

    if (existingConv) {
      navigate(`/chat/${existingConv.id}`);
      return;
    }

    try {
      const conversation = await createOrGetConversation(
        product.id,
        user.id,
        product.seller.id
      );

      const newConversation: Conversation = {
        id: conversation.id || conversation.conversation?.id,
        otherUser: product.seller,
        productId: product.id,
        productTitle: product.title,
        productImage: product.images[0],
        messages: [],
        lastMessageTime: Date.now(),
      };

      setConversations(prev => [...prev, newConversation]);
      navigate(`/chat/${newConversation.id}`);
    } catch (error) {
      console.error('创建对话失败:', error);
      showToast(t('toast.chat_open_failed'), 'error');
    }
  };

  const handleSendMessage = async (conversationId: string, text: string) => {
    if (!user) return;
    if (!text.trim()) return;

    const timestamp = Date.now();
    const tempMessageId = `msg-temp-${timestamp}`;

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
      const savedMessage = await sendMessageApi(conversationId, user.id, text);
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
      setConversations(prev => prev.map(c => {
        if (c.id === conversationId) {
          return {
            ...c,
            messages: c.messages.filter(m => m.id !== tempMessageId),
          };
        }
        return c;
      }));
      showToast(t('toast.message_send_failed'), 'error');
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
      filtered = products.filter(p =>
        p.title.toLowerCase().includes(lowerQ) ||
        p.description.toLowerCase().includes(lowerQ) ||
        p.category.toLowerCase().includes(lowerQ) ||
        (p.title_zh || '').toLowerCase().includes(lowerQ) ||
        (p.title_en || '').toLowerCase().includes(lowerQ) ||
        (p.title_es || '').toLowerCase().includes(lowerQ) ||
        (p.description_zh || '').toLowerCase().includes(lowerQ) ||
        (p.description_en || '').toLowerCase().includes(lowerQ) ||
        (p.description_es || '').toLowerCase().includes(lowerQ)
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }

    // [New] Region Filter
    if (region !== 'Global') {
      // Filter by currency matching user's region currency
      // This assumes local market logic: Users in Mexico only see MXN items by default
      filtered = filtered.filter(p => (p.currency || 'MXN') === regionCurrency);
    }

    if (!location) return filtered;

    const withDistance = filtered.map(p => ({
      ...p,
      distance: calculateDistance(location, p.location)
    }));

    return withDistance.sort((a, b) => {
      if (a.isPromoted && !b.isPromoted) return -1;
      if (!a.isPromoted && b.isPromoted) return 1;
      const aIsClose = a.distance! <= 5;
      const bIsClose = b.distance! <= 5;
      if (aIsClose && !bIsClose) return -1;
      if (!aIsClose && bIsClose) return 1;
      return a.distance! - b.distance!;
    });
  }, [products, location, debouncedSearchQuery, selectedCategory, region, regionCurrency]);

  const unreadCount = useMemo(() => {
    if (!user) return 0;
    return conversations.reduce((acc, c) => {
      return acc + c.messages.filter(m => !m.isRead && m.senderId !== user.id).length;
    }, 0);
  }, [conversations, user]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50 animate-gradient-xy flex flex-col font-sans text-gray-900 selection:bg-brand-100 selection:text-brand-900">
      <Navbar
        user={user}
        onLogin={handleLogin}
        onSellClick={handleSellClick}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onProfileClick={() => navigate('/profile')}
        onLogoClick={() => navigate('/')}
        onChatClick={() => navigate('/chat')}
        unreadCount={unreadCount}
        locationInfo={locationInfo}
      />

      <div className="flex-1 flex flex-col relative w-full max-w-[100vw] overflow-x-hidden pb-16 md:pb-0">
        <React.Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={
              <HomePage
                sortedProducts={sortedProducts}
                selectedCategory={selectedCategory}
                setSelectedCategory={setSelectedCategory}
                isLoadingLoc={isLoadingLoc}
                isLoadingProducts={isLoadingProducts}
                permissionDenied={permissionDenied}
                searchQuery={searchQuery}
                onSellClick={handleSellClick}
                // onAddToCart removed
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                onLoadMore={handleLoadMore}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                locationInfo={locationInfo}
              />
            } />
            <Route path="/product/:id" element={
              <ProductPage
                products={products}
                onContactSeller={handleContactSeller}
                onRequireLogin={() => setIsLoginModalOpen(true)}
                user={user}
              />
            } />
            <Route path="/profile" element={
              <ProfilePage
                user={user}
                products={products}
                onLogin={handleLogin}
                onUpdateUser={handleUpdateUser}
                onVerifyUser={handleVerifyUser}
                onBoostProduct={handleBoostProduct}
                favorites={favorites}
                allProducts={sortedProducts}
              />
            } />
            <Route path="/chat" element={
              <ChatPage
                conversations={conversations}
                user={user}
                onLogin={handleLogin}
                onSendMessage={handleSendMessage}
              />
            } />
            <Route path="/chat/:id" element={
              <ChatPage
                conversations={conversations}
                user={user}
                onLogin={handleLogin}
                onSendMessage={handleSendMessage}
              />
            } />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/admin/*" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </div>

      <BottomNav
        currentView={currentView}
        onChangeView={(view) => {
          if (view === 'home') navigate('/');
          if (view === 'profile') navigate('/profile');
          if (view === 'chat-list') navigate('/chat');
        }}
        onSellClick={handleSellClick}
        unreadCount={unreadCount}
        orderCount={pendingOrderCount}
        locationInfo={locationInfo}
      />
      <React.Suspense fallback={null}>
        {isSellModalOpen && (
          <SellModal
            isOpen={isSellModalOpen}
            onClose={() => setIsSellModalOpen(false)}
            onSubmit={handleProductSubmit}
            user={user!}
            userLocation={location}
          />
        )}
        {isLoginModalOpen && (
          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            onLogin={handleLogin}
          />
        )}
        {isCameraFlowOpen && (
          <CameraSellFlow
            isOpen={isCameraFlowOpen}
            onClose={() => setIsCameraFlowOpen(false)}
            onPostProduct={(product) => handleProductSubmit(product)}
            userLocation={location}
          />
        )}
        <OnboardingModal />
      </React.Suspense>

      {/* CartDrawer removed - direct purchase model */}

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
      />

      <CameraSellFlow
        isOpen={isCameraFlowOpen}
        onClose={() => setIsCameraFlowOpen(false)}
        onPostProduct={(data) => {
          setIsCameraFlowOpen(false);
          handleProductSubmit(data);
        }}
        userLocation={location}
      />

      <GlassToast
        isVisible={toast.show}
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <RegionProvider>
          <Routes>
            <Route path="/admin/*" element={
              <React.Suspense fallback={<PageLoader />}>
                <AdminPage />
              </React.Suspense>
            } />
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </RegionProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
