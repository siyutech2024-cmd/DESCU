
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  isVerified?: boolean; // New: Verified status
  country?: string;     // New: User country code from IP
  city?: string;        // New: User city from IP
}

export enum Category {
  Electronics = 'Electronics',
  Furniture = 'Furniture',
  Clothing = 'Clothing',
  Books = 'Books',
  Sports = 'Sports',
  Vehicles = 'Vehicles',
  RealEstate = 'RealEstate',
  Services = 'Services',
  Other = 'Other',
}

export enum DeliveryType {
  Meetup = 'meetup',
  Shipping = 'shipping',
  Both = 'both',
}

export type Language = 'zh' | 'en' | 'es';

export type Region = 'MX' | 'US' | 'CN' | 'EU' | 'JP' | 'Global';
export type Currency = 'MXN' | 'USD' | 'CNY' | 'EUR' | 'JPY';

export interface Product {
  id: string;
  seller: User;
  title: string;
  description: string;
  price: number;
  currency: string;
  images: string[];
  category: Category;
  deliveryType: DeliveryType;
  location: Coordinates;
  locationName: string;
  country?: string;  // New: Product country code (e.g., "MX", "US")
  city?: string;     // New: Product city name
  createdAt: number;
  distance?: number;
  isPromoted?: boolean; // New: Boosted status
  status?: 'active' | 'pending_review' | 'rejected' | 'sold' | 'deleted';
}

export interface AISuggestion {
  title: string;
  description: string;
  category: Category;
  suggestedPrice?: number;
  suggestedDeliveryType?: DeliveryType;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
  isRead: boolean;
}

export interface Conversation {
  id: string;
  otherUser: User;
  productId: string;
  productTitle: string;
  productImage: string;
  buyerId?: string;
  sellerId?: string;
  messages: Message[];
  lastMessageTime: number;
}

export type ViewState =
  | { type: 'home' }
  | { type: 'product', productId: string }
  | { type: 'profile' }
  | { type: 'chat-list' }
  | { type: 'chat-window', conversationId: string };

export interface Order {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  order_type: 'meetup' | 'shipping';
  payment_method: 'online' | 'cash';
  status: 'pending_payment' | 'paid' | 'meetup_arranged' | 'shipped' | 'delivered' | 'completed' | 'cancelled' | 'disputed' | 'refunded';
  product_amount: number;
  shipping_fee: number;
  platform_fee: number;
  total_amount: number;
  currency: string;
  meetup_location?: string;
  meetup_time?: string;
  shipping_address?: any;
  tracking_number?: string;
  created_at: string;
  product?: Product;
  buyer?: User;
  seller?: User;
  buyer_confirmed_at?: string;
  seller_confirmed_at?: string;
}
