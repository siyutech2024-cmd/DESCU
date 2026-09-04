/**
 * Visual gallery of the marketplace UI with mock data — for screenshots while polishing.
 * Not part of the app bundle (own Vite config: vite.gallery.config.ts).
 *   ?view=chat-list | chat-window | cards | product | sheets
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import '../index.css';
import { AppProviders } from '@/app/AppProviders';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { ChatList } from '@/features/chat/components/ChatList';
import { ChatWindow } from '@/features/chat/components/ChatWindow';
import { PriceNegotiationCard } from '@/features/chat/components/PriceNegotiationCard';
import { LocationCard } from '@/features/chat/components/LocationCard';
import { OrderStatusMessage } from '@/features/chat/components/OrderStatusMessage';
import { MeetupTimeMessage } from '@/features/chat/components/MeetupTimeMessage';
import { ImagesMessage } from '@/features/chat/components/ImagesMessage';
import { PriceNegotiationSender } from '@/features/chat/components/PriceNegotiationSender';
import { LocationSender } from '@/features/chat/components/LocationSender';
import { MeetupTimeSender } from '@/features/chat/components/MeetupTimeSender';
import { ImageSender } from '@/features/chat/components/ImageSender';
import { ProductDetails } from '@/features/products/components/ProductDetails';
import { SellModal } from '@/features/products/components/SellModal';
import { CheckoutModal } from '@/features/products/components/CheckoutModal';
import { UserProfile } from '@/features/users/components/UserProfile';
import { OrderStatusCard } from '@/features/orders/components/OrderStatusCard';
import { LoginModal } from '@/features/auth/components/LoginModal';
import { HomePage } from '@/pages/HomePage';
import { HowItWorksPage } from '@/pages/HowItWorksPage';
import { Button } from '@/components/ui/primitives';
import type { Order } from '@/types';
import { Category, DeliveryType, type Conversation, type Product, type User } from '@/types';

const IMG = (seed: string, s = 400) => `https://picsum.photos/seed/${seed}/${s}/${s}`;
const me: User = { id: 'me', name: '马强', email: 'me@x.com', avatar: IMG('me', 96), country: 'MX', city: 'Ciudad de México' };
const ana: User = { id: 'ana', name: 'Ana López', email: 'ana@x.com', avatar: IMG('ana', 96), isVerified: true };
const luis: User = { id: 'luis', name: 'Luis Hernández', email: 'l@x.com', avatar: IMG('luis', 96) };

const conv = (id: string, other: User, product: string, title: string, o: Partial<Conversation> = {}): Conversation => ({
    id, otherUser: other, productId: product, productTitle: title, productImage: IMG(product), buyerId: other.id, sellerId: 'me',
    messages: [], lastMessageTime: Date.now() - 3600_000, unreadCount: 0,
    lastMessage: { id: 'm', text: '¿Sigue disponible? Puedo pasar hoy en la tarde.', senderId: other.id, createdAt: Date.now() - 3600_000, messageType: 'text' } as any,
    ...o,
});
const conversations: Conversation[] = [
    conv('c1', ana, 'p1', 'Pandora Heart Ring', { unreadCount: 2, orderStatus: 'paid', orderId: 'o1' }),
    conv('c2', luis, 'p1', 'Pandora Heart Ring', { lastMessageTime: Date.now() - 86400_000 * 2, lastMessage: { id: 'm2', text: '', senderId: 'me', createdAt: Date.now() - 86400_000 * 2, messageType: 'price_negotiation' } as any }),
    conv('c3', luis, 'p2', 'Night Market Street Lamp', { lastMessageTime: Date.now() - 86400_000 * 9, orderStatus: 'completed' }),
    conv('c4', ana, 'p3', 'Impermeable EVA Nuevo', { lastMessageTime: Date.now() - 86400_000 * 30 }),
];

const product: Product = {
    id: 'p1', seller: ana, title: 'Pandora Heart Ring', description: 'Anillo Pandora de oro rosa con corazón rosa.\nComo nuevo, con caja original.', price: 300, currency: 'MXN',
    images: [IMG('p1', 800), IMG('p1b', 800), IMG('p1c', 800)], category: Category.Clothing, subcategory: 'accessories', deliveryType: DeliveryType.Meetup,
    location: { latitude: 19.54, longitude: -99.19 }, locationName: 'CDMX', country: 'MX', city: 'Tlalnepantla', town: 'Tlalnepantla', location_display_name: 'Tlalnepantla, Estado de México',
    createdAt: Date.now() - 86400_000 * 191, distance: 12.4, status: 'active', condition: 'used',
};

const feed: Product[] = Array.from({ length: 8 }, (_, i) => ({
    ...product, id: `f${i}`, title: ['iPhone 12 128GB', 'Bicicleta de montaña Trek', 'Sofá 3 plazas gris', 'Nintendo Switch OLED', 'Mesa de comedor madera', 'Tenis Nike Air Max 42', 'Libro Cien años de soledad', 'Monitor 27" 4K'][i],
    price: [5000, 3200, 4500, 5200, 2800, 900, 150, 4200][i], images: [IMG(`f${i}`, 600)], distance: [1.2, 3.4, 8, 12, 20, 2.1, 0.8, 45][i], city: ['Coyoacán', 'Polanco', 'Tlalnepantla', 'Roma Norte', 'Naucalpan', 'Condesa', 'Del Valle', 'Satélite'][i],
    isPromoted: i === 1, status: i === 5 ? 'sold' : 'active', deliveryType: i % 3 === 0 ? DeliveryType.Both : DeliveryType.Meetup, seller: i % 2 ? ana : luis,
}));

const orders: Order[] = [
    { id: 'da555c3f-0001', product_id: 'p1', buyer_id: 'me', seller_id: 'ana', order_type: 'meetup', payment_method: 'cash', status: 'paid', product_amount: 300, shipping_fee: 0, platform_fee: 0, total_amount: 300, currency: 'MXN', created_at: new Date().toISOString(), product },
    { id: 'da555c3f-0002', product_id: 'f0', buyer_id: 'me', seller_id: 'luis', order_type: 'shipping', payment_method: 'online', status: 'shipped', product_amount: 5000, shipping_fee: 50, platform_fee: 250, total_amount: 5300, currency: 'MXN', created_at: new Date(Date.now() - 86400_000 * 3).toISOString(), product: feed[0], tracking_number: 'DHL123456789' },
    { id: 'da555c3f-0003', product_id: 'f1', buyer_id: 'me', seller_id: 'luis', order_type: 'meetup', payment_method: 'online', status: 'meetup_arranged', product_amount: 3200, shipping_fee: 0, platform_fee: 160, total_amount: 3360, currency: 'MXN', created_at: new Date(Date.now() - 86400_000 * 5).toISOString(), product: feed[1], meetup_location: 'Starbucks Reforma 222', meetup_time: new Date(Date.now() + 86400_000).toISOString(), seller_confirmed_at: new Date().toISOString() },
    { id: 'da555c3f-0004', product_id: 'f2', buyer_id: 'me', seller_id: 'ana', order_type: 'meetup', payment_method: 'cash', status: 'completed', product_amount: 4500, shipping_fee: 0, platform_fee: 0, total_amount: 4500, currency: 'MXN', created_at: new Date(Date.now() - 86400_000 * 20).toISOString(), product: feed[2] },
];

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-dvh bg-gradient-to-br from-indigo-50/50 via-purple-50/50 to-pink-50/50 flex flex-col font-sans text-gray-900">
        <Navbar user={me} onLogin={() => undefined} onSellClick={() => undefined} searchQuery="" onSearchChange={() => undefined} onProfileClick={() => undefined} onLogoClick={() => undefined} onChatClick={() => undefined} unreadCount={2} locationInfo={{ city: 'Ciudad de México', town: 'Coyoacán', displayName: 'Coyoacán, Ciudad de México' } as any} />
        <div className="flex-1 flex flex-col relative w-full pb-bottom-nav md:pb-0">{children}</div>
        <BottomNav currentView="chat-list" onChangeView={() => undefined} onSellClick={() => undefined} unreadCount={2} orderCount={1} locationInfo={null} user={me} />
    </div>
);

const Cards: React.FC = () => (
    <div className="max-w-md mx-auto p-4 space-y-4 bg-[#f7f7fb] min-h-dvh">
        <PriceNegotiationCard content={{ negotiationId: 'n1', originalPrice: 300, proposedPrice: 240, productTitle: 'Pandora Heart Ring', status: 'pending' }} isSeller />
        <PriceNegotiationCard content={{ negotiationId: 'n2', originalPrice: 300, proposedPrice: 240, counterPrice: 270, productTitle: 'Pandora Heart Ring', status: 'countered' }} isSeller={false} />
        <PriceNegotiationCard content={{ negotiationId: 'n3', originalPrice: 300, proposedPrice: 250, finalPrice: 250, productTitle: 'Pandora Heart Ring', status: 'accepted' }} isSeller={false} />
        <OrderStatusMessage content={{ orderId: 'da555c3f-1', eventType: 'paid', productTitle: 'Pandora Heart Ring', productImage: IMG('p1'), productId: 'p1', amount: 315, currency: 'MXN', buyerId: 'me' }} currentUserId="me" />
        <OrderStatusMessage content={{ orderId: 'da555c3f-2', eventType: 'meetup_arranged', productTitle: 'Pandora Heart Ring', productImage: IMG('p1'), productId: 'p1', amount: 300, currency: 'MXN', buyerId: 'ana', location: 'Starbucks Reforma 222', time: new Date(Date.now() + 86400_000).toISOString() }} currentUserId="me" />
        <LocationCard content={{ name: 'Starbucks Reforma', address: 'Paseo de la Reforma 222, Juárez, Cuauhtémoc, Ciudad de México', lat: 19.4285, lng: -99.1636 }} senderName="Ana López" />
        <MeetupTimeMessage content={{ datetime: new Date(Date.now() + 86400_000).toISOString(), date: '2026-09-05', time: '18:30', location: 'Metro Insurgentes', note: 'Llevo la caja original', proposed_by: 'ana', product_title: 'Pandora Heart Ring', status: 'proposed', timestamp: '' }} conversationId="c1" currentUserId="me" onSuggestNew={() => undefined} />
        <ImagesMessage content={{ images: [IMG('a'), IMG('b'), IMG('c'), IMG('d'), IMG('e')], count: 5 }} />
        <ImagesMessage content={{ images: [IMG('single', 600)], count: 1 }} />
    </div>
);

const Sheets: React.FC = () => {
    const which = new URLSearchParams(location.search).get('sheet') || 'offer';
    return (
        <div className="min-h-dvh bg-[#f7f7fb]">
            <PriceNegotiationSender open={which === 'offer'} currentPrice={300} productId="p1" conversationId="c1" onClose={() => undefined} />
            <LocationSender open={which === 'location'} conversationId="c1" onClose={() => undefined} />
            <MeetupTimeSender open={which === 'meetup'} conversationId="c1" productTitle="Pandora Heart Ring" onClose={() => undefined} />
            <ImageSender open={which === 'images'} conversationId="c1" onClose={() => undefined} />
        </div>
    );
};

const Gallery: React.FC = () => {
    const view = new URLSearchParams(location.search).get('view') || 'chat-list';
    if (view === 'cards') return <Cards />;
    if (view === 'sheets') return <Sheets />;
    if (view === 'chat-list') return <Frame><ChatList conversations={conversations} currentUser={me} onSelectConversation={() => undefined} /></Frame>;
    if (view === 'chat-window') return <Frame><div className="flex-1 md:py-6 md:px-4 flex justify-center"><div className="w-full max-w-4xl md:h-[80vh] bg-white md:rounded-2xl md:border md:border-gray-100 overflow-hidden"><ChatWindow conversation={conversations[0]} currentUser={me} onBack={() => undefined} /></div></div></Frame>;
    if (view === 'home') return <Frame><HomePage sortedProducts={feed} selectedCategory="all" setSelectedCategory={() => undefined} isLoadingLoc={false} isLoadingProducts={false} permissionDenied={false} searchQuery="" onSellClick={() => undefined} hasMore onLoadMore={() => undefined} isLoadingMore={false} favorites={new Set(['f0'])} onToggleFavorite={() => undefined} locationInfo={{ city: 'Ciudad de México', town: 'Coyoacán', displayName: 'Coyoacán, Ciudad de México' } as any} /></Frame>;
    if (view === 'how') return <Frame><HowItWorksPage onSellClick={() => undefined} /></Frame>;
    if (view === 'profile') return <Frame><UserProfile user={me} userProducts={[feed[0], feed[5], { ...feed[2], status: 'pending_review' }, feed[3]]} onUpdateUser={() => undefined} onBack={() => undefined} onProductClick={() => undefined} onBoostProduct={() => undefined} favorites={new Set(['f1'])} allProducts={feed} /></Frame>;
    if (view === 'orders') return <Frame><div className="max-w-3xl mx-auto w-full px-4 pt-4 space-y-3">{orders.map(o => <OrderStatusCard key={o.id} order={o} currentUser={me} actions={o.status === 'shipped' ? [<Button key="d" size="sm" variant="ghost" className="text-red-600">Disputa</Button>, <Button key="c" size="sm">Confirmar recepción</Button>] : o.status === 'paid' ? <Button size="sm" variant="ghost" className="text-gray-500">Cancelar</Button> : undefined} />)}</div></Frame>;
    if (view === 'sell') return <Frame><SellModal isOpen onClose={() => undefined} onSubmit={() => undefined} user={me} userLocation={{ latitude: 19.4, longitude: -99.1 }} /></Frame>;
    if (view === 'checkout') return <Frame><CheckoutModal isOpen onClose={() => undefined} product={product} user={me} /></Frame>;
    if (view === 'login') return <Frame><LoginModal isOpen onClose={() => undefined} onLogin={() => undefined} /></Frame>;
    if (view === 'product') return <Frame><ProductDetails product={product} onBack={() => undefined} onContactSeller={() => undefined} onRequireLogin={() => undefined} user={me} /></Frame>;
    return <p className="p-8">unknown view</p>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
    <MemoryRouter initialEntries={['/chat']}>
        <AppProviders>
            <Routes><Route path="*" element={<Gallery />} /></Routes>
        </AppProviders>
    </MemoryRouter>,
);
