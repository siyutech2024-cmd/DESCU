
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
}

export enum Category {
  Electronics = 'electronics',
  Furniture = 'furniture',
  Clothing = 'clothing',
  Books = 'books',
  Sports = 'sports',
  Vehicles = 'vehicles',
  RealEstate = 'real_estate',
  Services = 'services',
  Other = 'other',
}

export enum DeliveryType {
  Meetup = 'meetup',
  Shipping = 'shipping',
  Both = 'both',
}

export type Language = 'zh' | 'en' | 'es';

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
  createdAt: number;
  distance?: number;
  isPromoted?: boolean; // New: Boosted status
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
  messages: Message[];
  lastMessageTime: number;
}

export type ViewState = 
  | { type: 'home' } 
  | { type: 'product', productId: string } 
  | { type: 'profile' }
  | { type: 'chat-list' }
  | { type: 'chat-window', conversationId: string };
