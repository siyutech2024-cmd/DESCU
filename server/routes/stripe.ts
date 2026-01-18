import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../src/db/supabase';
import { requireAuth as authenticateToken } from '../src/middleware/userAuth';

const router = express.Router();

// 初始化Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-12-15.clover' as any, // Cast to any to be safe if types are slightly off, but try without first? error said assignable to "2025-12-15.clover", so string literal should work.
});

/**
 * POST /api/stripe/add-bank-account
 * 卖家添加银行账户
 */
router.post('/add-bank-account', authenticateToken, async (req, res) => {
    try {
        const {
            accountHolderName,
            accountNumber,
            routingNumber, // CLABE for Mexico
            accountHolderType = 'individual',
        } = req.body;

        const userId = (req as any).user.id;

        // 1. 检查是否已有Stripe账户
        const { data: existingAccount } = await supabase
            .from('stripe_accounts')
            .select()
            .eq('user_id', userId)
            .single();

        let stripeAccountId: string;

        if (existingAccount?.stripe_account_id) {
            // 使用现有账户
            stripeAccountId = existingAccount.stripe_account_id;
        } else {
            // 2. 创建Stripe Connect账户
            const { data: user } = await supabase
                .from('users')
                .select('email, name')
                .eq('id', userId)
                .single();

            const account = await stripe.accounts.create({
                type: 'custom',
                country: 'MX',
                email: user?.email,
                capabilities: {
                    transfers: { requested: true },
                },
                business_type: 'individual',
                individual: {
                    email: user?.email,
                    first_name: accountHolderName.split(' ')[0],
                    last_name: accountHolderName.split(' ').slice(1).join(' ') || 'N/A',
                },
            });

            stripeAccountId = account.id;
        }

        // 3. 添加银行账户
        const bankAccount = await stripe.accounts.createExternalAccount(
            stripeAccountId,
            {
                external_account: {
                    object: 'bank_account',
                    account_number: accountNumber,
                    routing_number: routingNumber,
                    account_holder_name: accountHolderName,
                    account_holder_type: accountHolderType,
                    currency: 'mxn',
                    country: 'MX',
                },
            }
        );

        // 4. 保存到数据库 (stripe_accounts)
        const { data: savedAccount, error } = await supabase
            .from('stripe_accounts')
            .upsert({
                user_id: userId,
                stripe_account_id: stripeAccountId,
                bank_account_last4: (bankAccount as any).last4,
                bank_name: (bankAccount as any).bank_name || 'Unknown',
                account_verified: false,
            })
            .select()
            .single();

        if (error) {
            console.error('保存账户信息失败:', error);
            return res.status(500).json({ error: '保存失败' });
        }

        // 5. 同步更新 sellers 表 (确保 confirmOrder 也能找到 ID)
        await supabase
            .from('sellers')
            .upsert({
                user_id: userId,
                stripe_connect_id: stripeAccountId,
                onboarding_complete: true // 既然已添加银行卡，视为完成简易流程
            }, { onConflict: 'user_id' }); // 假设 user_id 是 unique key

        res.json({
            success: true,
            account: {
                last4: savedAccount.bank_account_last4,
                bankName: savedAccount.bank_name,
            },
        });
    } catch (error: any) {
        console.error('添加银行账户错误:', error);
        res.status(500).json({
            error: '添加失败',
            message: error.message,
        });
    }
});

/**
 * GET /api/stripe/account-status
 * 获取卖家Stripe账户状态
 */
router.get('/account-status', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;

        const { data: account } = await supabase
            .from('stripe_accounts')
            .select()
            .eq('user_id', userId)
            .single();

        if (!account) {
            return res.json({
                hasAccount: false,
                verified: false,
            });
        }

        // 从Stripe获取最新状态
        const stripeAccount = await stripe.accounts.retrieve(account.stripe_account_id);

        // 检查是否已验证
        const isVerified = stripeAccount.capabilities?.transfers === 'active';

        // 更新数据库
        if (isVerified !== account.account_verified) {
            await supabase
                .from('stripe_accounts')
                .update({ account_verified: isVerified })
                .eq('user_id', userId);
        }

        res.json({
            hasAccount: true,
            verified: isVerified,
            last4: account.bank_account_last4,
            bankName: account.bank_name,
            accountId: account.stripe_account_id,
        });
    } catch (error: any) {
        console.error('获取账户状态错误:', error);
        res.status(500).json({ error: '获取失败' });
    }
});

/**
 * POST /api/stripe/create-payment-intent
 * 创建支付意向（线上支付）
 */
router.post('/create-payment-intent', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.body;
        const userId = (req as any).user.id;

        // 1. 获取订单信息
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        // 2. 验证权限
        if (order.buyer_id !== userId) {
            return res.status(403).json({ error: '无权操作此订单' });
        }

        // 3. 检查订单状态
        if (order.status !== 'pending_payment') {
            return res.status(400).json({ error: '订单状态不正确' });
        }

        // 4. 创建Payment Intent
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(order.total_amount * 100), // 转换为分
            currency: 'mxn',
            payment_method_types: ['card'],
            metadata: {
                order_id: order.id,
                buyer_id: order.buyer_id,
                seller_id: order.seller_id,
            },
            description: `订单 ${order.id} - ${order.order_type}`,
        });

        // 5. 保存Payment Intent ID
        await supabase
            .from('orders')
            .update({
                stripe_payment_intent_id: paymentIntent.id,
            })
            .eq('id', orderId);

        // 6. 记录事件
        await supabase.from('order_timeline').insert({
            order_id: orderId,
            event_type: 'payment_intent_created',
            description: '支付意向已创建',
            created_by: userId,
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    } catch (error: any) {
        console.error('创建支付意向错误:', error);
        res.status(500).json({ error: '创建失败', message: error.message });
    }
});

/**
 * POST /api/stripe/confirm-payment
 * 确认支付成功（更新订单状态）
 * 由前端在支付成功后调用
 */
router.post('/confirm-payment', authenticateToken, async (req, res) => {
    try {
        const { orderId, paymentIntentId } = req.body;
        const userId = (req as any).user.id;

        // 1. 验证Payment Intent
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: '支付未完成' });
        }

        // 2. 更新订单状态
        const { data: order, error } = await supabase
            .from('orders')
            .update({
                status: 'paid',
                payment_captured: true,
            })
            .eq('id', orderId)
            .eq('buyer_id', userId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: '更新订单失败' });
        }

        // 3. 记录事件
        await supabase.from('order_timeline').insert({
            order_id: orderId,
            event_type: 'payment_confirmed',
            description: '支付已确认',
            created_by: userId,
            metadata: { payment_intent_id: paymentIntentId },
        });

        res.json({ success: true, order });
    } catch (error: any) {
        console.error('确认支付错误:', error);
        res.status(500).json({ error: '确认失败', message: error.message });
    }
});

/**
 * POST /api/stripe/transfer-to-seller
 * 释放款项给卖家（订单完成后）
 * 内部调用或由订单完成时自动触发
 */
router.post('/transfer-to-seller', authenticateToken, async (req, res) => {
    try {
        const { orderId } = req.body;

        // 1. 获取订单
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: '订单不存在' });
        }

        // 2. 验证订单状态
        if (order.status !== 'completed') {
            return res.status(400).json({ error: '订单未完成' });
        }

        if (order.transferred_to_seller) {
            return res.json({ message: '款项已转账', alreadyTransferred: true });
        }

        // 3. 仅处理线上支付
        if (order.payment_method !== 'online') {
            return res.status(400).json({ error: '当面付款无需转账' });
        }

        // 4. 获取卖家Stripe账户
        const { data: sellerAccount } = await supabase
            .from('stripe_accounts')
            .select()
            .eq('user_id', order.seller_id)
            .single();

        if (!sellerAccount || !sellerAccount.account_verified) {
            return res.status(400).json({ error: '卖家未设置收款账户或未验证' });
        }

        // 5. 计算转账金额（扣除平台手续费）
        const sellerAmount = order.product_amount - order.platform_fee;

        // 6. 转账到卖家
        const transfer = await stripe.transfers.create({
            amount: Math.round(sellerAmount * 100),
            currency: 'mxn',
            destination: sellerAccount.stripe_account_id,
            description: `订单 ${order.id} 收款`,
            metadata: {
                order_id: order.id,
                seller_id: order.seller_id,
            },
        });

        // 7. 更新订单
        await supabase
            .from('orders')
            .update({
                stripe_transfer_id: transfer.id,
                transferred_to_seller: true,
            })
            .eq('id', orderId);

        // 8. 记录事件
        await supabase.from('order_timeline').insert({
            order_id: orderId,
            event_type: 'funds_transferred',
            description: `款项已转账 $${sellerAmount.toFixed(2)}`,
            metadata: {
                transfer_id: transfer.id,
                amount: sellerAmount,
            },
        });

        res.json({
            success: true,
            transferId: transfer.id,
            amount: sellerAmount,
        });
    } catch (error: any) {
        console.error('转账错误:', error);
        res.status(500).json({ error: '转账失败', message: error.message });
    }
});

/**
 * DELETE /api/stripe/remove-bank-account
 * 移除银行账户
 */
router.delete('/remove-bank-account', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;

        const { data: account } = await supabase
            .from('stripe_accounts')
            .select()
            .eq('user_id', userId)
            .single();

        if (!account) {
            return res.status(404).json({ error: '未找到账户' });
        }

        // 删除数据库记录
        await supabase.from('stripe_accounts').delete().eq('user_id', userId);

        res.json({ success: true });
    } catch (error: any) {
        console.error('删除账户错误:', error);
        res.status(500).json({ error: '删除失败' });
    }
});

export default router;
