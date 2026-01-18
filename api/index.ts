import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

// Imports from Local Lib (Bundled)
import { analyzeImage } from './_lib/controllers/aiController.js';
import { supabase } from './_lib/db/supabase.js';
import { createProduct, getProducts, getProductById, productsHealthCheck } from './_lib/controllers/productController.js';
import { requireAuth } from './_lib/middleware/userAuth.js';
import { requireAdmin } from './_lib/middleware/adminAuth.js';

import {
    createConversation,
    getUserConversations,
    sendMessage,
    getMessages,
    markMessagesAsRead
} from './_lib/controllers/chatController.js';

import {
    getDashboardStats,
    getAdminInfo,
    getAdminLogs,
    getAdminOrders,
    getAdminDisputes,
    resolveDispute,
    markOrderAsPaid,
    getReportsData,
    getSystemSettings,
    updateSystemSettings,
    batchUpdateSettings
} from './_lib/controllers/adminController.js';

import {
    getAdminProducts,
    getAdminProduct,
    updateAdminProduct,
    deleteAdminProduct,
    restoreAdminProduct,
    updateProductStatus,
    updateProductPromotion,
    batchUpdateProducts
} from './_lib/controllers/adminProductController.js';

import {
    getAdminUsers,
    getAdminUser,
    updateUserVerification,
    deleteAdminUser
} from './_lib/controllers/adminUserController.js';

import {
    getAdminConversations,
    getAdminConversation,
    deleteAdminConversation,
    deleteAdminMessage,
    flagAdminMessage
} from './_lib/controllers/adminMessageController.js';

import {
    createPaymentIntent,
    handleStripeWebhook,
    createConnectAccount,
    getLoginLink,
    markOrderAsShipped,
    confirmOrder,
    createDispute,
    verifyPayment,
    updateSellerBankInfo,
    ordersHealthCheck,
    getUserOrders
} from './_lib/controllers/paymentController.js';

import { generateSitemap } from './_lib/controllers/seoController.js';
import { reverseGeocodeProxy } from './_lib/controllers/locationController.js';

const app = express();

// Middleware
app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://descu.ai',
        'https://www.descu.ai',
        /https:\/\/.*\.vercel\.app$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// SPECIAL HANDLING: Stripe Webhook requires RAW body.
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));

// Feature Routes
app.post('/api/analyze', analyzeImage);
app.get('/api/products/health', productsHealthCheck);
app.post('/api/products', requireAuth, createProduct);
app.get('/api/products', getProducts);
app.get('/api/products/:id', getProductById);


// Chat Endpoints
app.post('/api/conversations', createConversation);
app.get('/api/users/:userId/conversations', getUserConversations);
app.post('/api/messages', sendMessage);
app.get('/api/conversations/:conversationId/messages', getMessages); // Old route
app.get('/api/messages/:conversationId', getMessages); // New route - matches frontend
app.put('/api/messages/:conversationId/read', markMessagesAsRead);


// Payment Endpoints
app.post('/api/payment/webhook', handleStripeWebhook);
app.post('/api/payment/create-intent', requireAuth, createPaymentIntent);
app.post('/api/payment/connect', requireAuth, createConnectAccount);
app.post('/api/payment/bank-info', requireAuth, updateSellerBankInfo);
app.get('/api/payment/dashboard/:userId', requireAuth, getLoginLink);
app.post('/api/orders/ship', requireAuth, markOrderAsShipped);
app.post('/api/orders/confirm', requireAuth, confirmOrder);
app.get('/api/orders/health', ordersHealthCheck);
app.post('/api/disputes', requireAuth, createDispute);
app.post('/api/payment/verify', requireAuth, verifyPayment);
app.get('/api/orders', requireAuth, getUserOrders);

app.get('/api/users/:userId/credit', async (req, res) => {
    try {
        const { userId } = req.params;
        const { data, error } = await supabase
            .from('credit_scores')
            .select('score')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            throw error;
        }

        res.json({ score: data?.score || 500 }); // Default start score
    } catch (error: any) {
        console.error('Get credit score error:', error);
        res.status(500).json({ error: 'Failed to get credit score', message: error.message });
    }
});

// Admin Endpoints
app.get('/api/admin/dashboard/stats', requireAdmin, getDashboardStats);
app.get('/api/admin/auth/me', requireAdmin, getAdminInfo);
app.get('/api/admin/logs', requireAdmin, getAdminLogs);
app.get('/api/admin/orders', requireAdmin, getAdminOrders);
app.post('/api/admin/orders/:id/mark-paid', requireAdmin, markOrderAsPaid);
app.get('/api/admin/disputes', requireAdmin, getAdminDisputes);
app.post('/api/admin/disputes/resolve', requireAdmin, resolveDispute);

// Admin Product Management
app.get('/api/admin/products', requireAdmin, getAdminProducts);
app.get('/api/admin/products/:id', requireAdmin, getAdminProduct);
app.put('/api/admin/products/:id', requireAdmin, updateAdminProduct);
app.delete('/api/admin/products/:id', requireAdmin, deleteAdminProduct);
app.post('/api/admin/products/:id/restore', requireAdmin, restoreAdminProduct);
app.patch('/api/admin/products/:id/status', requireAdmin, updateProductStatus);
app.patch('/api/admin/products/:id/promote', requireAdmin, updateProductPromotion);
app.post('/api/admin/products/batch', requireAdmin, batchUpdateProducts);

// Admin User Management
app.get('/api/admin/users', requireAdmin, getAdminUsers);
app.get('/api/admin/users/:id', requireAdmin, getAdminUser);
app.patch('/api/admin/users/:id/verify', requireAdmin, updateUserVerification);
app.delete('/api/admin/users/:id', requireAdmin, deleteAdminUser);

// Admin Message Management
app.get('/api/admin/conversations', requireAdmin, getAdminConversations);
app.get('/api/admin/conversations/:id', requireAdmin, getAdminConversation);
app.delete('/api/admin/conversations/:id', requireAdmin, deleteAdminConversation);
app.delete('/api/admin/messages/:id', requireAdmin, deleteAdminMessage);
app.patch('/api/admin/messages/:id/flag', requireAdmin, flagAdminMessage);

// Admin Reports and Settings
app.get('/api/admin/reports', requireAdmin, getReportsData);
app.get('/api/admin/settings', requireAdmin, getSystemSettings);
app.put('/api/admin/settings', requireAdmin, updateSystemSettings);
app.post('/api/admin/settings/batch', requireAdmin, batchUpdateSettings);

// SEO & Location
app.get('/sitemap.xml', generateSitemap);
app.get('/api/location/reverse', reverseGeocodeProxy);

// New IP Location Proxy
app.get('/api/location/ip', async (req, res) => {
    try {
        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] || req.socket.remoteAddress;

        // If localhost, return dummy data
        if (!ip || ip === '::1' || ip === '127.0.0.1') {
            return res.json({ country: 'MX', city: 'Mexico City', countryName: 'Mexico' });
        }

        const fetchRes = await fetch(`https://ipapi.co/${ip}/json/`);
        if (!fetchRes.ok) throw new Error('IP API failed');

        const data = await fetchRes.json();
        res.json({
            country: data.country_code || 'MX',
            city: data.city || 'Unknown',
            countryName: data.country_name || 'Mexico'
        });
    } catch (e: any) {
        console.error('IP Location Error:', e.message);
        // Fallback to MX default instead of erroring 500
        res.json({ country: 'MX', city: 'Mexico City', countryName: 'Mexico' });
    }
});

// Update user location
app.post('/api/users/update-location', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { country, city, countryName, lat, lng } = req.body;

        console.log('[UpdateLocation] Updating location for user:', userId, { country, city });

        const { error } = await supabase
            .from('users')
            .update({
                location_country: country,
                location_city: city,
                location_lat: lat || null,
                location_lng: lng || null,
                location_updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error('[UpdateLocation] Error:', error);
            throw error;
        }

        res.json({
            success: true,
            location: { country, city, countryName }
        });
    } catch (error: any) {
        console.error('Update location error:', error);
        res.status(500).json({
            error: 'Failed to update location',
            message: error.message
        });
    }
});


// Save seller bank info (simplified - no Stripe Connect)
app.post('/api/users/bank-info', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { bankName, clabe, holderName } = req.body;

        // Validate CLABE (18 digits)
        if (!clabe || clabe.length !== 18 || !/^\d+$/.test(clabe)) {
            return res.status(400).json({ error: 'CLABE must be 18 digits' });
        }

        if (!holderName || !bankName) {
            return res.status(400).json({ error: 'Bank name and holder name are required' });
        }

        console.log('[BankInfo] Saving bank info for user:', userId);

        // Upsert into sellers table
        const { error } = await supabase
            .from('sellers')
            .upsert({
                user_id: userId,
                bank_clabe: clabe,
                bank_name: bankName,
                bank_holder_name: holderName,
                bank_info_updated_at: new Date().toISOString(),
                onboarding_complete: true
            }, { onConflict: 'user_id' });

        if (error) {
            console.error('[BankInfo] Error:', error);
            throw error;
        }

        res.json({
            success: true,
            message: 'Bank info saved successfully'
        });
    } catch (error: any) {
        console.error('Save bank info error:', error);
        res.status(500).json({
            error: 'Failed to save bank info',
            message: error.message
        });
    }
});


// Rating & Reviews
import { submitRating, getUserRatingStats } from './_lib/controllers/ratingController.js';
app.post('/api/ratings', requireAuth, submitRating);
app.get('/api/ratings/:userId/stats', getUserRatingStats);

// ------------------------------------------------------------------
// PRICE NEGOTIATION ENDPOINTS
// ------------------------------------------------------------------

// 发起议价
app.post('/api/negotiations/propose', requireAuth, async (req: any, res) => {
    try {
        const { conversationId, productId, proposedPrice } = req.body;
        const userId = req.user.id;

        // 验证参数
        if (!conversationId || !productId || !proposedPrice) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 获取对话和产品信息
        const { data: conversation, error: convError } = await supabase
            .from('conversations')
            .select('*, product:products(*)')
            .eq('id', conversationId)
            .single();

        if (convError || !conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // 验证用户身份（只有买家可以发起议价）
        if (conversation.buyer_id !== userId) {
            return res.status(403).json({ error: 'Only buyer can propose price' });
        }

        // 创建议价记录
        const { data: negotiation, error: negError } = await supabase
            .from('price_negotiations')
            .insert({
                conversation_id: conversationId,
                product_id: productId,
                original_price: conversation.product.price,
                proposed_price: parseFloat(proposedPrice),
                proposed_by: userId,
                status: 'pending'
            })
            .select()
            .single();

        if (negError) throw negError;

        // 发送议价卡片消息
        await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: userId,
            message_type: 'price_negotiation',
            content: JSON.stringify({
                negotiationId: negotiation.id,
                originalPrice: conversation.product.price,
                proposedPrice: parseFloat(proposedPrice),
                productTitle: conversation.product.title,
                status: 'pending'
            }),
            is_pinned: true,
            pinned_until: new Date(Date.now() + 48 * 60 * 60 * 1000) // 置顶48小时
        });

        res.json({ negotiation });
    } catch (error: any) {
        console.error('Propose negotiation error:', error);
        res.status(500).json({ error: 'Failed to propose price', message: error.message });
    }
});

// 响应议价
app.post('/api/negotiations/:id/respond', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { action, counterPrice } = req.body;
        const userId = req.user.id;

        // 验证action
        if (!['accept', 'reject', 'counter'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }

        // 获取议价记录
        const { data: negotiation, error: negError } = await supabase
            .from('price_negotiations')
            .select('*, conversation:conversations(*), product:products(*)')
            .eq('id', id)
            .single();

        if (negError || !negotiation) {
            return res.status(404).json({ error: 'Negotiation not found' });
        }

        // 验证卖家身份
        if (negotiation.conversation.seller_id !== userId) {
            return res.status(403).json({ error: 'Only seller can respond' });
        }

        // 验证状态
        if (negotiation.status !== 'pending') {
            return res.status(400).json({ error: 'Negotiation already processed' });
        }

        let updateData: any = {
            responded_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        let messageContent: any = {
            negotiationId: id,
            originalPrice: negotiation.original_price,
            proposedPrice: negotiation.proposed_price,
            productTitle: negotiation.product.title
        };

        // 处理不同响应
        switch (action) {
            case 'accept':
                updateData.status = 'accepted';
                messageContent.status = 'accepted';
                messageContent.finalPrice = negotiation.proposed_price;

                // 更新产品价格
                await supabase
                    .from('products')
                    .update({ price: negotiation.proposed_price })
                    .eq('id', negotiation.product_id);

                break;

            case 'reject':
                updateData.status = 'rejected';
                messageContent.status = 'rejected';
                break;

            case 'counter':
                if (!counterPrice) {
                    return res.status(400).json({ error: 'Counter price required' });
                }
                updateData.status = 'countered';
                updateData.counter_price = parseFloat(counterPrice);
                messageContent.status = 'countered';
                messageContent.counterPrice = parseFloat(counterPrice);
                break;
        }

        // 更新议价记录
        await supabase
            .from('price_negotiations')
            .update(updateData)
            .eq('id', id);

        // 发送响应消息
        await supabase.from('messages').insert({
            conversation_id: negotiation.conversation_id,
            sender_id: userId,
            message_type: 'price_negotiation_response',
            content: JSON.stringify(messageContent),
            is_pinned: true,
            pinned_until: new Date(Date.now() + 24 * 60 * 60 * 1000)
        });

        res.json({ success: true, action, negotiation: updateData });
    } catch (error: any) {
        console.error('Respond to negotiation error:', error);
        res.status(500).json({ error: 'Failed to respond', message: error.message });
    }
});

// 获取产品的议价历史
app.get('/api/negotiations/product/:productId', requireAuth, async (req: any, res) => {
    try {
        const { productId } = req.params;
        const userId = req.user.id;

        const { data: negotiations, error } = await supabase
            .from('price_negotiations')
            .select('*, conversation:conversations(*)')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // 只返回用户参与的议价
        const filtered = negotiations?.filter(n =>
            n.conversation.buyer_id === userId || n.conversation.seller_id === userId
        );

        res.json({ negotiations: filtered || [] });
    } catch (error: any) {
        console.error('Get negotiations error:', error);
        res.status(500).json({ error: 'Failed to get negotiations', message: error.message });
    }
});

// ------------------------------------------------------------------
// INLINED ORDER ROUTES (Hotfix for Vercel 404)
// ------------------------------------------------------------------
app.post('/api/orders/create', requireAuth, async (req: any, res) => {
    try {
        const { productId, orderType, paymentMethod, shippingAddress, meetupLocation, meetupTime } = req.body;
        const buyerId = req.user.id;

        console.log(`[CreateOrder] Received request: productId=${productId}, buyerId=${buyerId}, type=${orderType}`);

        const { data: product, error: pInfoError } = await supabase.from('products').select('*, seller:users!seller_id(*)').eq('id', productId).single();

        if (pInfoError || !product) {
            console.error('[CreateOrder] Product lookup failed:', pInfoError);
            return res.status(404).json({ error: 'Product not found', debug_id: productId, db_error: pInfoError });
        }

        console.log(`[CreateOrder] Product found: ${product.id}, Seller: ${product.seller_id}`);

        if (product.seller_id === buyerId) return res.status(400).json({ error: 'Cannot buy your own product' });

        const productAmount = product.price;
        const shippingFee = orderType === 'shipping' ? 50 : 0;
        const platformFee = paymentMethod === 'online' ? (productAmount * 0.03) : 0;
        const totalAmount = productAmount + shippingFee + platformFee;

        const orderData: any = {
            product_id: productId, buyer_id: buyerId, seller_id: product.seller_id,
            order_type: orderType, payment_method: paymentMethod,
            product_amount: productAmount, shipping_fee: shippingFee, platform_fee: platformFee, total_amount: totalAmount,
            currency: 'MXN', status: paymentMethod === 'cash' ? 'paid' : 'pending_payment',
            expires_at: new Date(Date.now() + 86400000)
        };
        if (orderType === 'shipping') orderData.shipping_address = shippingAddress;
        if (orderType === 'meetup' && meetupLocation) {
            orderData.meetup_location = meetupLocation; orderData.meetup_time = meetupTime;
        }

        const { data: order, error: orderError } = await supabase.from('orders').insert(orderData).select().single();
        if (orderError) throw orderError;

        await supabase.from('order_timeline').insert({
            order_id: order.id, event_type: 'created', description: `Order Created (${orderType})`, created_by: buyerId, metadata: { orderType, paymentMethod }
        });

        // Auto-create chat
        const { data: conversation } = await supabase.from('conversations').select().eq('product_id', productId).eq('buyer_id', buyerId).eq('seller_id', product.seller_id).single();
        if (!conversation) {
            await supabase.from('conversations').insert({ product_id: productId, buyer_id: buyerId, seller_id: product.seller_id });
        }

        // 🔔 发送订单创建通知到聊天
        import('../server/src/services/orderNotificationService').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(order.id, 'created').catch((err: any) => {
                console.error('[CreateOrder] Failed to send notification:', err);
            });
        }).catch(console.error);

        res.json({ order, success: true, requiresPayment: paymentMethod === 'online' });
    } catch (error: any) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order', message: error.message });
    }
});

app.get('/api/orders', requireAuth, async (req: any, res) => {
    try {
        const { role, product_id, buyer_id } = req.query;
        const userId = req.user.id;
        let query = supabase.from('orders').select('*, product:products(*), buyer:users!buyer_id(*), seller:users!seller_id(*)').order('created_at', { ascending: false });

        if (product_id) query = query.eq('product_id', product_id);
        if (buyer_id) query = query.eq('buyer_id', buyer_id);
        if (role === 'buyer') query = query.eq('buyer_id', userId);
        else if (role === 'seller') query = query.eq('seller_id', userId);
        else if (!product_id) query = query.or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

        const { data: orders, error } = await query;
        if (error) throw error;
        res.json({ orders });
    } catch (error: any) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to get orders', message: error.message });
    }
});

app.get('/api/orders/:id', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { data: order, error } = await supabase.from('orders')
            .select('*, product:products(*), buyer:users!buyer_id(*), seller:users!seller_id(*), timeline:order_timeline(*)')
            .eq('id', id).single();

        if (error || !order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId && order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        res.json({ order });
    } catch (error: any) {
        console.error('Get order detail error:', error);
        res.status(500).json({ error: 'Failed to get order', message: error.message });
    }
});

app.post('/api/orders/:id/confirm', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const isBuyer = order.buyer_id === userId;
        const isSeller = order.seller_id === userId;
        if (!isBuyer && !isSeller) return res.status(403).json({ error: 'Unauthorized' });

        const updateData: any = {};
        if (isBuyer && !order.buyer_confirmed_at) updateData.buyer_confirmed_at = new Date().toISOString();
        if (isSeller && !order.seller_confirmed_at) updateData.seller_confirmed_at = new Date().toISOString();

        if (Object.keys(updateData).length === 0) return res.json({ message: 'Already confirmed', order });

        const { data: updatedOrder, error } = await supabase.from('orders').update(updateData).eq('id', id).select().single();
        if (error) throw error;

        await supabase.from('order_timeline').insert({
            order_id: id, event_type: isBuyer ? 'buyer_confirmed' : 'seller_confirmed', description: `${isBuyer ? 'Buyer' : 'Seller'} confirmed`, created_by: userId
        });

        // 🔔 发送确认通知
        import('../server/src/services/orderNotificationService').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(id, 'confirmed', { confirmedBy: isBuyer ? 'buyer' : 'seller' }).catch(console.error);
        }).catch(console.error);

        if (updatedOrder.buyer_confirmed_at && updatedOrder.seller_confirmed_at) {
            const { data: completedOrder } = await supabase.from('orders').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', id).select().single();
            await supabase.from('order_timeline').insert({ order_id: id, event_type: 'completed', description: 'Order Completed', created_by: userId });

            // 🔔 发送完成通知
            import('../server/src/services/orderNotificationService').then(({ notifyOrderStatus }) => {
                notifyOrderStatus(id, 'completed').catch(console.error);
            }).catch(console.error);

            return res.json({ message: 'Order Completed', order: completedOrder, completed: true });
        }

        res.json({ message: 'Confirmed, waiting for other party', order: updatedOrder, completed: false });
    } catch (error: any) {
        console.error('Confirm order error:', error);
        res.status(500).json({ error: 'Failed to confirm', message: error.message });
    }
});

app.post('/api/orders/:id/arrange-meetup', requireAuth, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { location, time, lat, lng } = req.body;
        const userId = req.user.id;

        const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId && order.seller_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (order.order_type !== 'meetup') return res.status(400).json({ error: 'Not a meetup order' });

        const { data: updatedOrder, error } = await supabase.from('orders').update({
            meetup_location: location, meetup_time: time, meetup_location_lat: lat, meetup_location_lng: lng, status: 'meetup_arranged',
            meetup_confirmed_by_buyer: false, meetup_confirmed_by_seller: false
        }).eq('id', id).select().single();
        if (error) throw error;
        await supabase.from('order_timeline').insert({
            order_id: id, event_type: 'meetup_arranged', description: `Meetup Arranged: ${location}`, created_by: userId, metadata: { location, time }
        });

        // 🔔 发送见面安排通知
        import('../server/src/services/orderNotificationService').then(({ notifyOrderStatus }) => {
            notifyOrderStatus(id, 'meetup_arranged', { location, time }).catch(console.error);
        }).catch(console.error);
        res.json({ order: updatedOrder });
    } catch (error: any) {
        console.error('Arrange meetup error:', error);
        res.status(500).json({ error: 'Failed to arrange meetup', message: error.message });
    }
});

// ------------------------------------------------------------------
// INLINED USER ADDRESS ROUTES (Hotfix for Vercel 404)
// ------------------------------------------------------------------
app.get('/api/users/addresses', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data, error } = await supabase
            .from('user_addresses')
            .select('*')
            .eq('user_id', userId)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json({ addresses: data || [] });
    } catch (error: any) {
        console.error('Fetch addresses error:', error);
        res.status(500).json({ error: 'Failed to fetch addresses', message: error.message });
    }
});

app.post('/api/users/addresses', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { recipient_name, phone_number, street_address, city, state, zip_code, country, is_default } = req.body;

        if (!recipient_name || !phone_number || !street_address || !city || !state || !zip_code) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        if (is_default) {
            await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        }

        const { data, error } = await supabase
            .from('user_addresses')
            .insert({
                user_id: userId,
                recipient_name,
                phone_number,
                street_address,
                city,
                state,
                zip_code,
                country: country || 'MX',
                is_default: is_default || false
            })
            .select()
            .single();

        if (error) throw error;
        res.json({ address: data });
    } catch (error: any) {
        console.error('Add address error:', error);
        res.status(500).json({ error: 'Failed to add address', message: error.message });
    }
});

app.put('/api/users/addresses/:id', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const updates = req.body;
        delete updates.user_id;
        delete updates.id;
        delete updates.created_at;

        if (updates.is_default) {
            await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userId);
        }

        const { data, error } = await supabase
            .from('user_addresses')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        res.json({ address: data });
    } catch (error: any) {
        console.error('Update address error:', error);
        res.status(500).json({ error: 'Failed to update address', message: error.message });
    }
});

app.delete('/api/users/addresses/:id', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const { error } = await supabase
            .from('user_addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        res.json({ success: true });
    } catch (error: any) {
        console.error('Delete address error:', error);
        res.status(500).json({ error: 'Failed to delete address', message: error.message });
    }
});
// ------------------------------------------------------------------

// ------------------------------------------------------------------
// INLINED STRIPE ROUTES (Hotfix for Vercel 404)
// ------------------------------------------------------------------
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover' as any, // Cast to match local
});

app.post('/api/stripe/add-bank-account', requireAuth, async (req: any, res) => {
    try {
        const { accountHolderName, accountNumber, routingNumber, accountHolderType = 'individual' } = req.body;
        const userId = req.user.id; // requireAuth populates this

        const { data: existingAccount } = await supabase.from('stripe_accounts').select().eq('user_id', userId).single();
        let stripeAccountId: string;

        if (existingAccount?.stripe_account_id) {
            stripeAccountId = existingAccount.stripe_account_id;
        } else {
            const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).single();
            const account = await stripe.accounts.create({
                type: 'custom',
                country: 'MX',
                email: user?.email,
                capabilities: { transfers: { requested: true } },
                business_type: 'individual',
                individual: {
                    email: user?.email,
                    first_name: accountHolderName.split(' ')[0],
                    last_name: accountHolderName.split(' ').slice(1).join(' ') || 'N/A',
                },
            });
            stripeAccountId = account.id;
        }

        const bankAccount = await stripe.accounts.createExternalAccount(stripeAccountId, {
            external_account: {
                object: 'bank_account',
                account_number: accountNumber,
                routing_number: routingNumber,
                account_holder_name: accountHolderName,
                account_holder_type: accountHolderType,
                currency: 'mxn',
                country: 'MX',
            },
        });

        const { data: savedAccount, error } = await supabase.from('stripe_accounts').upsert({
            user_id: userId,
            stripe_account_id: stripeAccountId,
            bank_account_last4: (bankAccount as any).last4,
            bank_name: (bankAccount as any).bank_name || 'Unknown',
            account_verified: false,
        }).select().single();

        if (error) throw error;
        res.json({ success: true, account: { last4: savedAccount.bank_account_last4, bankName: savedAccount.bank_name } });
    } catch (error: any) {
        console.error('Add bank account error:', error);
        res.status(500).json({ error: 'Failed to add bank account', message: error.message });
    }
});

app.get('/api/stripe/account-status', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data: account } = await supabase.from('stripe_accounts').select().eq('user_id', userId).single();

        if (!account) return res.json({ hasAccount: false, verified: false });

        const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);
        const isVerified = stripeAccount.capabilities?.transfers === 'active';

        if (isVerified !== account.account_verified) {
            await supabase.from('stripe_accounts').update({ account_verified: isVerified }).eq('user_id', userId);
        }

        res.json({
            hasAccount: true,
            verified: isVerified,
            last4: account.bank_account_last4,
            bankName: account.bank_name,
            accountId: account.stripe_account_id,
        });
    } catch (error: any) {
        console.error('Get account status error:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

// ==================================================================
// STRIPE EXPRESS CONNECT ENDPOINTS
// ==================================================================

// Create Express Account and return onboarding link
app.post('/api/stripe/create-express-account', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const { data: user } = await supabase.from('users').select('email, name').eq('id', userId).single();

        if (!user?.email) {
            return res.status(400).json({ error: 'User email required' });
        }

        // Check if account already exists
        const { data: existingSeller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete')
            .eq('user_id', userId)
            .single();

        let stripeAccountId: string;

        if (existingSeller?.stripe_connect_id) {
            // Account exists, check if onboarding complete
            stripeAccountId = existingSeller.stripe_connect_id;

            const account = await stripe.accounts.retrieve(stripeAccountId);
            if (account.details_submitted) {
                return res.json({
                    success: true,
                    accountId: stripeAccountId,
                    onboardingComplete: true,
                    message: 'Account already set up'
                });
            }
        } else {
            // Create new Express account
            const account = await stripe.accounts.create({
                type: 'express',
                country: 'MX',
                email: user.email,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: 'individual',
                metadata: {
                    user_id: userId,
                    platform: 'DESCU'
                }
            });

            stripeAccountId = account.id;

            // Save to sellers table
            await supabase.from('sellers').upsert({
                user_id: userId,
                stripe_connect_id: stripeAccountId,
                stripe_account_status: 'pending',
                onboarding_complete: false
            }, { onConflict: 'user_id' });
        }

        // Generate Account Link for onboarding
        const baseUrl = process.env.VITE_API_URL || 'https://www.descu.ai';
        const accountLink = await stripe.accountLinks.create({
            account: stripeAccountId,
            refresh_url: `${baseUrl}/profile?stripe_refresh=true`,
            return_url: `${baseUrl}/profile?stripe_success=true`,
            type: 'account_onboarding',
        });

        console.log('[StripeExpress] Created account link for user:', userId);

        res.json({
            success: true,
            accountId: stripeAccountId,
            onboardingUrl: accountLink.url,
            expiresAt: accountLink.expires_at
        });

    } catch (error: any) {
        console.error('Create Express account error:', error);
        res.status(500).json({ error: 'Failed to create account', message: error.message });
    }
});

// Get Express account status
app.get('/api/stripe/express-status', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete, stripe_account_status')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.json({
                hasAccount: false,
                onboardingComplete: false,
                payoutsEnabled: false
            });
        }

        // Get latest status from Stripe
        const account = await stripe.accounts.retrieve(seller.stripe_connect_id);

        const status = {
            hasAccount: true,
            accountId: seller.stripe_connect_id,
            onboardingComplete: account.details_submitted || false,
            payoutsEnabled: account.payouts_enabled || false,
            chargesEnabled: account.charges_enabled || false,
            requirements: account.requirements?.currently_due || [],
            email: account.email
        };

        // Update local status if changed
        if (account.details_submitted !== seller.onboarding_complete) {
            await supabase.from('sellers').update({
                onboarding_complete: account.details_submitted,
                stripe_account_status: account.payouts_enabled ? 'active' : 'pending'
            }).eq('user_id', userId);
        }

        res.json(status);

    } catch (error: any) {
        console.error('Get Express status error:', error);
        res.status(500).json({ error: 'Failed to get status', message: error.message });
    }
});

// Refresh Account Link (if expired)
app.post('/api/stripe/refresh-account-link', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.status(404).json({ error: 'No Stripe account found' });
        }

        const baseUrl = process.env.VITE_API_URL || 'https://www.descu.ai';
        const accountLink = await stripe.accountLinks.create({
            account: seller.stripe_connect_id,
            refresh_url: `${baseUrl}/profile?stripe_refresh=true`,
            return_url: `${baseUrl}/profile?stripe_success=true`,
            type: 'account_onboarding',
        });

        res.json({
            success: true,
            onboardingUrl: accountLink.url,
            expiresAt: accountLink.expires_at
        });

    } catch (error: any) {
        console.error('Refresh account link error:', error);
        res.status(500).json({ error: 'Failed to refresh link', message: error.message });
    }
});

// Create Stripe Dashboard login link (for sellers to view their dashboard)
app.get('/api/stripe/dashboard-link', requireAuth, async (req: any, res) => {
    try {
        const userId = req.user.id;

        const { data: seller } = await supabase
            .from('sellers')
            .select('stripe_connect_id, onboarding_complete')
            .eq('user_id', userId)
            .single();

        if (!seller?.stripe_connect_id) {
            return res.status(404).json({ error: 'No Stripe account found' });
        }

        if (!seller.onboarding_complete) {
            return res.status(400).json({ error: 'Please complete onboarding first' });
        }

        const loginLink = await stripe.accounts.createLoginLink(seller.stripe_connect_id);

        res.json({
            success: true,
            dashboardUrl: loginLink.url
        });

    } catch (error: any) {
        console.error('Create dashboard link error:', error);
        res.status(500).json({ error: 'Failed to create dashboard link', message: error.message });
    }
});

app.post('/api/stripe/create-payment-intent', requireAuth, async (req: any, res) => {
    try {
        const { orderId } = req.body;
        const userId = req.user.id;

        const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (order.buyer_id !== userId) return res.status(403).json({ error: 'Unauthorized' });
        if (order.status !== 'pending_payment') return res.status(400).json({ error: 'Invalid order status' });

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.total_amount * 100),
            currency: 'mxn',
            payment_method_types: ['card'],
            metadata: { order_id: order.id, buyer_id: order.buyer_id, seller_id: order.seller_id },
            description: `Order ${order.id}`,
        });

        await supabase.from('orders').update({ stripe_payment_intent_id: paymentIntent.id }).eq('id', orderId);
        await supabase.from('order_timeline').insert({
            order_id: orderId, event_type: 'payment_intent_created', description: 'Payment Intent Created', created_by: userId
        });

        res.json({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id });
    } catch (error: any) {
        console.error('Create PI error:', error);
        res.status(500).json({ error: 'Failed to create payment intent', message: error.message });
    }
});

app.post('/api/stripe/confirm-payment', requireAuth, async (req: any, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;
        const userId = req.user.id;
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') return res.status(400).json({ error: 'Payment not succeeded' });

        const { data: order, error } = await supabase.from('orders').update({ status: 'paid', payment_captured: true })
            .eq('id', orderId).eq('buyer_id', userId).select().single();

        if (error) throw error;

        await supabase.from('order_timeline').insert({
            order_id: orderId, event_type: 'payment_confirmed', description: 'Payment Confirmed', created_by: userId, metadata: { payment_intent_id: paymentIntentId }
        });

        res.json({ success: true, order });
    } catch (error: any) {
        console.error('Confirm payment error:', error);
        res.status(500).json({ error: 'Failed to confirm payment', message: error.message });
    }
});

// Test Route
app.get('/api/test_ping', (req, res) => {
    const debug: any = {
        pong: true,
        time: new Date().toISOString(),
        location: 'api/index.ts inlined',
        fs: {}
    };

    try {
        const root = process.cwd();
        debug.fs.cwd = root;

        // Check api folder
        const apiPath = path.join(root, 'api');
        if (fs.existsSync(apiPath)) {
            debug.fs.api = fs.readdirSync(apiPath);

            // Check _lib
            const libPath = path.join(apiPath, '_lib');
            if (fs.existsSync(libPath)) {
                debug.fs.lib = fs.readdirSync(libPath);

                // Check controllers
                const ctrlPath = path.join(libPath, 'controllers');
                if (fs.existsSync(ctrlPath)) {
                    debug.fs.controllers = fs.readdirSync(ctrlPath);
                } else {
                    debug.fs.controllers = 'NOT_FOUND';
                }
            } else {
                debug.fs.lib = 'NOT_FOUND';
            }
        } else {
            debug.fs.api = 'NOT_FOUND';
        }

    } catch (e: any) {
        debug.fs_error = e.message;
    }

    res.json(debug);
});

app.get('/', (req, res) => {
    res.send('DESCU API (Inlined)');
});

export default app;
// Force rebuild Sat Jan 17 21:14:34 CST 2026
