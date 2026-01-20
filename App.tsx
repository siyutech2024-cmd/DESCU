
import React, { useState, useEffect, useMemo } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
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
            showToast('登录验证失败', 'error');
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
                    setConversations(updatedConvs.map((conv: any) => ({
                      id: conv.id,
                      productId: conv.product_id,
                      productTitle: conv.product_title || conv.products?.title || 'Unknown Product',
                      productImage: conv.product_image || conv.products?.images?.[0],
                      otherUser: {
                        id: conv.other_user_id,
                        name: conv.other_user_name,
                        avatar: conv.other_user_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${conv.other_user_id}`
                      },
                      messages: conv.messages || [],
                      lastMessageTime: conv.last_message_time,
                      buyerId: conv.buyer_id,
                      sellerId: conv.seller_id
                    })));
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
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      // 在移动端使用deep link，web端使用origin
      const redirectUrl = isCapacitor
        ? 'com.venya.marketplace://'
        : window.location.origin;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) throw error;
      setIsLoginModalOpen(false);
    } catch (error) {
      console.error('登录失败:', error);
      showToast('登录失败，请重试', 'error');
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
      setUser(updatedUser);
      showToast('个人资料已更新', 'success');
    } catch (error) {
      console.error('更新失败:', error);
      showToast('更新失败', 'error');
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
      if (pageNum === 1) setIsLoadingLoc(true); // Initial load
      else setIsLoadingMore(true);

      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const limit = 20;
      const offset = (pageNum - 1) * limit;

      const response = await fetch(`${API_BASE_URL}/api/products?lang=${language}&limit=${limit}&offset=${offset}`, {
        headers
      });

      if (response.ok) {
        const dbProducts = await response.json();
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
          price: p.price,
          currency: p.currency,
          images: p.images || [],
          category: p.category,
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
        if (pageNum === 1) setProducts([]);
      }
    } catch (error: any) {
      console.error('加载商品失败:', error);
      showToast(`加载失败: ${error.message || '未知错误'}`, 'error'); // [DEBUG] Show error to user
      if (pageNum === 1) setProducts([]);
    } finally {
      setIsLoadingLoc(false);
      setIsLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (!location || isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadProducts(location, nextPage);
  };

  // Geolocation Init
  useEffect(() => {
    const fallbackCDMX = { latitude: 19.4326, longitude: -99.1332 };

    const initLocation = async () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setLocation(coords);
            const detailedLocation = await getDetailedLocation(coords.latitude, coords.longitude);
            if (detailedLocation) setLocationInfo(detailedLocation);

            // Fetch Page 1
            setPage(1);
            loadProducts(coords, 1);
          },
          (error) => {
            console.error("Loc error", error);
            setPermissionDenied(true);
            setLocation(fallbackCDMX);
            setPage(1);
            // Fallback Load local mock data if API fails or for dev
            if (process.env.NODE_ENV === 'development') {
              const items = generateMockProducts(fallbackCDMX, language);
              setProducts(items);
            } else {
              loadProducts(fallbackCDMX, 1);
            }
          },
          { enableHighAccuracy: false, timeout: 5000, maximumAge: 3600000 }
        );
      } else {
        setPermissionDenied(true);
        setLocation(fallbackCDMX);
        setPage(1);
        loadProducts(fallbackCDMX, 1);
      }
    };

    initLocation();
  }, [language]);

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
            otherUser = {
              id: sellerInfo.id,
              name: sellerInfo.name,
              email: '',
              avatar: sellerInfo.avatar || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
              isVerified: false
            };
          } else {
            otherUser = {
              id: isBuyer ? c.user2_id : c.user1_id,
              name: isBuyer ? 'Seller' : 'Buyer',
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
          const ordersData = await response.json();
          setOrders(ordersData);

          // Count pending orders (not completed or cancelled)
          const pending = ordersData.filter((order: any) =>
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
      showToast(isFav ? 'Removed from favorites' : 'Added to favorites', 'success');
    } catch (error) {
      console.error('Favorite toggle failed', error);
      // Revert
      setFavorites(prev => {
        const next = new Set(prev);
        if (isFav) next.add(product.id);
        else next.delete(product.id);
        return next;
      });
      showToast('Failed to update favorite', 'error');
    }
  };

  const handleProductSubmit = async (newProductData: Omit<Product, 'id' | 'createdAt' | 'distance'>) => {
    if (!user) {
      showToast('请先登录', 'warning');
      return;
    }

    setIsCreatingProduct(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('请先登录验证身份');

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
          delivery_type: newProductData.deliveryType,
          latitude: newProductData.location.latitude,
          longitude: newProductData.location.longitude,
          location_name: newProductData.locationName,
          country: user.country || 'Unknown',  // From user's IP location
          city: user.city || 'Unknown',        // From user's IP location
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
        status: savedProduct.status // Added status mapping
      };

      setProducts(prev => [productForApp, ...prev]);
      setIsSellModalOpen(false);
      navigate('/');
      showToast('🎉 商品发布成功！', 'success');
    } catch (error) {
      console.error('商品创建失败:', error);
      showToast(`❌ 商品发布失败: ${error instanceof Error ? error.message : '请稍后重试'}`, 'error');
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
      showToast('❌ 无法打开聊天，请稍后重试', 'error');
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
      showToast('❌ 消息发送失败，请重试', 'error');
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
        p.category.toLowerCase().includes(lowerQ)
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
