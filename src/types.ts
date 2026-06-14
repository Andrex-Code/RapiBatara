export type Role = "resident" | "owner" | "courier";

export type PaymentMethod = "transfer" | "cash";

export type OrderStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "on_route"
  | "delivered"
  | "rejected";

export type Category = {
  id: string;
  name: string;
  order: number;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  lowStockAt: number;
  image: string;
  featured?: boolean;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
};

export type Order = {
  id: string;
  customerName: string;
  destination: string;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  transferProofName?: string;
  cashReceived?: number;
  changeDue?: number;
  cashMissing?: number;
  notes?: string;
  items: OrderItem[];
  total: number;
};

export type Announcement = {
  title: string;
  body: string;
  active: boolean;
  imageMode: "none" | "text" | "image" | "mixed";
};
