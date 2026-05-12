// 商品相关类型
export interface Product {
  id: string;
  name: string;
  subtitle?: string;
  description: string;
  detailDescription?: string;
  price: number;
  originalPrice?: number;
  image: string;
  mainImage?: string;
  mainImageInfo?: {
    id: number;
    filename: string;
    url: string;
    filesize: number;
    filetype: string;
    iszip: number;
    encrypt: boolean;
  };
  images?: string[];
  album?: string[];
  albumImages?: any[];
  categoryId: string;
  categoryName?: string;
  brandId: string;
  brandName?: string;
  stock: number;
  productSn?: string;
  unit?: string;
  weight?: number;
  sort?: number;
  giftPoint?: number;
  giftGrowth?: number;
  usePointLimit?: number;
  status: number;
  isRecommend: number;
  isNew: number;
  isHot?: number;
  rating: number;
  reviews: number;
  sales: number;
  createTime: string;
  updateTime?: string;
  isRecommend?: boolean;
  totalSkuStock?: number;
  attributeValues?: Array<{
    attributeId: string;
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
  mainImage: string;
  images?: string[];
  albumImages?: Array<{
    url: string;
    sort: number;
    isMain: boolean;
    color?: string;
  }>;
  categoryId: string;
  brandId: string;
  tenantId?: string;
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
  isRecommend: number;
  isNew: number;
  isHot?: number;
  isPreview?: number;
  promotionType?: number;
  promotionId?: string;
  serviceIds?: string[];
  detailTitle?: string;
  detailDesc?: string;
  keywords?: string;
  note?: string;
  attributeValues?: Array<{
    attributeId: string;
    value: string;
  }>;
  paramValues?: Array<{
    paramName: string;
    value: string;
  }>;
  skus?: any[];
  relatedProducts?: string[];
  bundleProducts?: string[];
  recommendProducts?: string[];
  specAttributes?: Array<{
    name: string;
    values: Array<{
      value: string;
    }>;
  }>;
}

export interface ProductSku {
  id: string;
  productId: string;
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
  id?: string;
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
  productId: string;
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
  id: string;
  productId: string;
  relatedProductId: string;
  relatedProduct?: Product;
  type: number;
  typeText?: string;
  sortOrder: number;
  createdAt: string;
}

export interface ProductRelationFormData {
  id?: string;
  productId?: string;
  relatedProductId: string;
  type: number;
  sortOrder?: number;
}

export interface SkuStockLog {
  id: string;
  skuId: string;
  productId: string;
  type: number;
  typeText?: string;
  quantity: number;
  beforeStock: number;
  afterStock: number;
  operatorId?: string;
  operatorName?: string;
  remark?: string;
  createdAt: string;
}

// 订单相关类型
export interface Order {
  id: string;
  orderNo: string;
  userId: string;
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
  id: string;
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
  color?: string;
  size?: string;
}

export interface Address {
  id: string;
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
  userId: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  nickname?: string;
  levelId: string;
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
  id: string;
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
  id: string;
  levelId: string;
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
  id: string;
  userId: string;
  username?: string;
  pointsValue: number;
  type: number;
  typeText?: string;
  subType?: number;
  subTypeText?: string;
  sourceType?: string;
  sourceId?: string;
  beforePoints: number;
  afterPoints: number;
  description?: string;
  remark?: string;
  createdAt: string;
}

export interface GrowthLog {
  id: string;
  userId: string;
  username?: string;
  growthValue: number;
  type: number;
  typeText?: string;
  sourceType?: string;
  sourceId?: string;
  beforeGrowth: number;
  afterGrowth: number;
  description?: string;
  remark?: string;
  createdAt: string;
}

// 分类相关类型
export interface Category {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  iconId?: number;
  banner?: string;
  bannerId?: number;
  imageId?: number;
  imageInfo?: ImageFileInfo;
  bannerInfo?: ImageFileInfo;
  parentId?: string;
  level?: number;
  sort: number;
  status: number;
  tenantId?: string;
  tenantGroup?: boolean;
  createdAt: string;
  updatedAt?: string;
  children?: Category[];
}

export interface ImageFileInfo {
  id: number;
  imagefileid: string;
  filename: string;
  url: string;
  filesize: number;
  filetype: string;
  iszip: number;
  isEncrypt: boolean;
}

// 品牌相关类型
export interface Brand {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  sort: number;
  status: number;
}

// 优惠券相关类型
export interface Coupon {
  id: string;
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

export interface CategoryFormData {
  name: string;
  description?: string;
  icon?: string;
  banner?: string;
  parentId?: number;
  sort: number;
  status: number;
  tenantId?: string;
}

export interface CategoryAttribute {
  id: number;
  categoryId: number;
  name: string;
  type: number;
  isRequired: number;
  isSearchable: number;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
  values?: CategoryAttributeValue[];
}

export interface CategoryAttributeFormData {
  id?: number;
  categoryId?: number;
  name: string;
  type: number;
  isRequired?: number;
  isSearchable?: number;
  sortOrder?: number;
}

export interface CategoryAttributeValue {
  id: number;
  attributeId: number;
  value: string;
  sortOrder: number;
  createdAt: string;
}

export interface CategoryAttributeValueFormData {
  attributeId: number;
  value: string;
  sortOrder?: number;
}

export interface CategoryParamTemplate {
  id: number;
  categoryId: number;
  name: string;
  type: number;
  value: string;
  isRequired: number;
  isSearchable: number;
  sortOrder: number;
  createdAt: string;
  updatedAt?: string;
}

export interface CategoryParamTemplateFormData {
  id?: number;
  categoryId?: number;
  name: string;
  type: number;
  value: string;
  isRequired?: number;
  isSearchable?: number;
  sortOrder?: number;
}

export interface BrandFormData {
  name: string;
  description?: string;
  logo?: string;
  sort: number;
  status?: number;
}
