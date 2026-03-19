// 商品相关类型
export interface Product {
  id: number;
  name: string;
  subtitle?: string;
  description: string;
  detailDescription?: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  categoryId: number;
  categoryName?: string;
  brandId: number;
  brandName?: string;
  stock: number;
  productSn?: string;
  unit?: string;
  weight?: number;
  sort?: number;
  giftPoint?: number;
  giftGrowth?: number;
  usePointLimit?: number;
  status: 'active' | 'inactive';
  isFeatured: boolean;
  isNew: boolean;
  isHot?: boolean;
  rating: number;
  reviews: number;
  sales: number;
  createTime: string;
  updateTime?: string;
  isRecommend?: boolean;
  totalSkuStock?: number;
  attributeValues?: Array<{
    attributeId: number;
    value: string;
  }>;
  paramValues?: Array<{
    paramName: string;
    value: string;
  }>;
  skus?: ProductSku[];
}

export interface ProductFormData {
  name: string;
  subtitle?: string;
  description: string;
  detailDescription?: string;
  price: number;
  originalPrice?: number;
  costPrice?: number;
  image: string;
  images?: string[];
  categoryId: number;
  brandId: number;
  stock?: number;
  stockWarning?: number;
  productSn?: string;
  unit?: string;
  weight?: number;
  sort?: number;
  giftPoint?: number;
  giftGrowth?: number;
  usePointLimit?: number;
  status: 'active' | 'inactive';
  isFeatured: boolean;
  isNew: boolean;
  isHot?: boolean;
  attributeValues?: Array<{
    attributeId: number;
    value: string;
  }>;
  paramValues?: Array<{
    paramName: string;
    value: string;
  }>;
  skus?: any[];
}

export interface ProductSku {
  id: number;
  productId: number;
  skuCode: string;
  skuName: string;
  spec1?: string;
  spec2?: string;
  spec3?: string;
  spec4?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  image?: string;
  status: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductSkuFormData {
  id?: number;
  skuCode?: string;
  skuName: string;
  spec1?: string;
  spec2?: string;
  spec3?: string;
  spec4?: string;
  price: number;
  originalPrice?: number;
  stock: number;
  image?: string;
  status?: number;
}

export interface SkuMatrixGenerateData {
  productId: number;
  attributes: Array<{
    name: string;
    values: Array<{
      value: string;
      image?: string;
    }>;
  }>;
  basePrice: number;
  baseStock: number;
  clearExisting?: boolean;
}

export interface ProductRelation {
  id: number;
  productId: number;
  relatedProductId: number;
  relatedProduct?: Product;
  type: number;
  typeText?: string;
  sortOrder: number;
  createdAt: string;
}

export interface ProductRelationFormData {
  id?: number;
  productId?: number;
  relatedProductId: number;
  type: number;
  sortOrder?: number;
}

export interface SkuStockLog {
  id: number;
  skuId: number;
  productId: number;
  type: number;
  typeText?: string;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  operatorId?: number;
  operatorName?: string;
  remark?: string;
  createdAt: string;
}

// 订单相关类型
export interface Order {
  id: number;
  orderNo: string;
  userId: number;
  username?: string;
  userEmail?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod?: string;
  paymentNo?: string;
  paymentTime?: string;
  shippingMethod?: string;
  trackingNo?: string;
  shippingTime?: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  address?: Address;
  remark?: string;
  createTime: string;
  updateTime?: string;
}

export interface OrderItem {
  id: number;
  productId: number;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
}

export interface Address {
  id: number;
  name: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  postalCode: string;
}

// 会员相关类型
export interface Member {
  userId: number;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  nickname?: string;
  levelId: number;
  levelName?: string;
  levelValue?: number;
  points: number;
  growth: number;
  experience: number;
  totalConsumption: number;
  orderCount: number;
  status: number;
  statusText?: string;
  membershipStart?: string;
  membershipEnd?: string;
  registerTime: string;
  lastLoginTime?: string;
}

export interface MemberLevel {
  id: number;
  name: string;
  levelValue: number;
  minGrowth: number;
  maxGrowth?: number;
  discountRate: number;
  price?: number;
  durationDays?: number;
  icon?: string;
  benefits?: string;
  status: number;
  statusText?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemberBenefit {
  id: number;
  levelId: number;
  levelName?: string;
  name: string;
  type: number;
  typeText?: string;
  value?: string;
  description?: string;
  icon?: string;
  status?: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PointsLog {
  id: number;
  userId: number;
  username?: string;
  pointsValue: number;
  type: number;
  typeText?: string;
  subType?: number;
  subTypeText?: string;
  sourceType?: string;
  sourceId?: number;
  beforePoints: number;
  afterPoints: number;
  description?: string;
  remark?: string;
  createdAt: string;
}

export interface GrowthLog {
  id: number;
  userId: number;
  username?: string;
  growthValue: number;
  type: number;
  typeText?: string;
  sourceType?: string;
  sourceId?: number;
  beforeGrowth: number;
  afterGrowth: number;
  description?: string;
  remark?: string;
  createdAt: string;
}

// 分类相关类型
export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  banner?: string;
  parentId?: number;
  level?: number;
  sort: number;
  status: number;
  createdAt: string;
  updatedAt?: string;
  children?: Category[];
}

// 品牌相关类型
export interface Brand {
  id: number;
  name: string;
  description?: string;
  logo?: string;
  sort: number;
  status: number;
}

// 优惠券相关类型
export interface Coupon {
  id: number;
  name: string;
  description?: string;
  type: number;
  typeText?: string;
  amount: number;
  minPurchase: number;
  startTime: string;
  endTime: string;
  status: number;
  statusText?: string;
  total: number;
  used: number;
  createdAt: string;
}

// 促销相关类型
export interface Promotion {
  id: number;
  name: string;
  description?: string;
  type: number;
  typeText?: string;
  rules: string;
  startTime: string;
  endTime: string;
  status: number;
  statusText?: string;
  sortOrder: number;
  createdAt: string;
}

// 物流相关类型
export interface Logistics {
  id: number;
  orderId: number;
  trackingNo: string;
  logisticsCompany: string;
  status: string;
  latestInfo: string;
  createdAt: string;
  updatedAt: string;
}

// 铺货相关类型
export interface Distribution {
  id: number;
  productId: number;
  productName?: string;
  platform: string;
  platformProductId?: string;
  status: number;
  syncTime?: string;
  createdAt: string;
}

// 通用类型
export interface PageParams {
  current: number;
  pageSize: number;
}

export interface PageResponse<T> {
  list: T[];
  total: number;
  current: number;
  pageSize: number;
}
