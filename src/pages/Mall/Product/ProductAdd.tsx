import {
  CheckOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
} from '@ant-design/icons';
import {
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  InputNumber,
  Modal,
  message,
  Radio,
  Row,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  Transfer,
  TreeSelect,
  Upload,
} from 'antd';
import React, { useEffect, useRef, useState } from 'react';
import {
  brandApi,
  categoryApi,
  categoryAttributeApi,
  categoryParamApi,
  productApi,
  promotionApi,
} from '@/services/mall';
import type {
  Brand,
  Category,
  CategoryAttribute,
  Product,
  ProductFormData,
  Promotion,
} from '@/services/mall/typings';

const { Step } = Steps;
const { TextArea } = Input;
const { Option } = Select;
const { Group: RadioGroup } = Radio;
const { Group: CheckboxGroup } = Checkbox;

interface ProductFormProps {
  product?: Product;
  onSubmit: (data: ProductFormData) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
  setSubmitting: (submitting: boolean) => void;
}

const ProductForm: React.FC<ProductFormProps> = ({
  product,
  onSubmit,
  onCancel,
  submitting,
  setSubmitting,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  // 使用单一的Form实例管理所有数据
  const [form] = Form.useForm();

  // 使用ref来保存表单值，确保数据不会丢失
  const formValuesRef = useRef<any>({});

  // 步骤3 - SKU相关（使用state因为需要动态更新）
  const [skuList, setSkuList] = useState<any[]>([]);

  // 步骤4 - 商品关联
  const [relatedProducts, setRelatedProducts] = useState<number[]>([]);
  const [bundleProducts, setBundleProducts] = useState<number[]>([]);
  const [recommendProducts, setRecommendProducts] = useState<number[]>([]);

  // 富文本编辑器内容
  const [productDetail, setProductDetail] = useState<string>('');

  // 图片预览状态
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 商品图片状态
  const [mainImageFiles, setMainImageFiles] = useState<any[]>([]);
  const [albumFiles, setAlbumFiles] = useState<any[]>([]);

  // 分类属性相关状态
  const [categoryAttributes, setCategoryAttributes] = useState<
    CategoryAttribute[]
  >([]);
  const [productAttributeValues, setProductAttributeValues] = useState<
    Record<number, string>
  >({});
  const [attrLoading, setAttrLoading] = useState(false);

  // 属性图片状态
  const [attributeImages, setAttributeImages] = useState<
    Record<string, { mainImage: any[]; albumImages: any[] }>
  >({});

  // 分类参数相关状态
  const [categoryParams, setCategoryParams] = useState<any[]>([]);
  const [productParamValues, setProductParamValues] = useState<
    Record<number, string>
  >({});
  const [paramLoading, setParamLoading] = useState(false);

  // 数据状态
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [allProducts, setAllProducts] = useState<any[]>([]);

  // 初始化数据
  useEffect(() => {
    fetchCategories();
    fetchBrands();
    fetchPromotions();
    fetchAllProducts();
  }, []);

  // 如果是编辑模式，加载商品数据
  useEffect(() => {
    if (product) {
      loadProductData(product);
    }
  }, [product]);

  const fetchCategories = async () => {
    try {
      const data = await categoryApi.getTree();
      setCategories(data);
    } catch (error: any) {
      message.error('获取分类失败');
    }
  };

  const fetchBrands = async () => {
    try {
      const result = await brandApi.getList({ current: 1, pageSize: 1000 });
      setBrands(result.list || []);
    } catch (error: any) {
      message.error('获取品牌失败');
    }
  };

  const fetchPromotions = async () => {
    try {
      const result = await promotionApi.getList({ status: 1 });
      setPromotions(result || []);
    } catch (error: any) {
      message.error('获取促销失败');
    }
  };

  const fetchAllProducts = async () => {
    try {
      const result = await productApi.getList({ current: 1, pageSize: 1000 });
      setAllProducts(result.list || []);
    } catch (error: any) {
      message.error('获取商品列表失败');
    }
  };

  // 加载分类属性
  const fetchCategoryAttributes = async (categoryId: number) => {
    if (!categoryId) {
      setCategoryAttributes([]);
      setProductAttributeValues({});
      return { data: [], initialValues: {} };
    }

    setAttrLoading(true);
    try {
      const data = await categoryAttributeApi.getByCategoryId(categoryId);
      setCategoryAttributes(data);

      // 初始化属性值
      const initialValues: Record<number, string> = {};
      data.forEach((attr) => {
        initialValues[attr.id] = '';
      });
      setProductAttributeValues(initialValues);
      return { data, initialValues };
    } catch (error: any) {
      message.error(error.message || '获取分类属性失败');
      setCategoryAttributes([]);
      setProductAttributeValues({});
      return { data: [], initialValues: {} };
    } finally {
      setAttrLoading(false);
    }
  };

  // 加载分类参数
  const fetchCategoryParams = async (categoryId: number) => {
    if (!categoryId) {
      setCategoryParams([]);
      setProductParamValues({});
      return [];
    }

    setParamLoading(true);
    try {
      const data = await categoryParamApi.getParamsByCategoryId(categoryId);
      setCategoryParams(data);

      // 初始化参数值
      const initialValues: Record<number, string> = {};
      data.forEach((param) => {
        initialValues[param.id] = '';
      });
      setProductParamValues(initialValues);
      return data;
    } catch (error: any) {
      message.error(error.message || '获取分类参数失败');
      setCategoryParams([]);
      setProductParamValues({});
      return [];
    } finally {
      setParamLoading(false);
    }
  };

  // 辅助函数：将图片 URL 转换为完整的文件对象
  const convertToFileObject = (url: string, index: number = 0): any => {
    if (!url) return null;
    // 保持相对路径，通过代理加载图片
    const imageUrl = url.startsWith('http') ? url : url;
    return {
      uid: `existing-${index}-${Date.now()}`,
      name: `product-image-${index}.jpg`,
      status: 'done',
      url: imageUrl,
      thumbUrl: imageUrl,
      response: { success: true, data: imageUrl },
    };
  };

  // 加载商品数据
  const loadProductData = async (product: Product) => {
    try {
      console.log('=== 加载商品数据 ===');
      console.log('商品数据:', product);

      // 处理商品主图
      let mainImageFile: any = null;
      if (product.image) {
        mainImageFile = convertToFileObject(product.image, 0);
      }

      // 处理商品相册
      let albumFiles: any[] = [];
      if (product.images && Array.isArray(product.images)) {
        albumFiles = product.images
          .filter((img: string) => img)
          .map((img: string, index: number) =>
            convertToFileObject(img, index + 1),
          )
          .filter((file: any) => file !== null);
      }

      console.log('转换后的商品主图:', mainImageFile);
      console.log('转换后的商品相册:', albumFiles);

      // 设置表单值
      form.setFieldsValue({
        categoryId: product.categoryId,
        brandId: product.brandId,
        name: product.name,
        subtitle: product.subtitle,
        description: product.description,
        productSn: product.productSn,
        price: product.price,
        originalPrice: product.originalPrice,
        stock: product.stock,
        unit: product.unit,
        weight: product.weight,
        sort: product.sort,
        giftPoint: product.giftPoint,
        giftGrowth: product.giftGrowth,
        usePointLimit: product.usePointLimit,
        isPreview: product.isPreview,
        isOnSale: product.status === 'active',
        isNew: product.isNew,
        isRecommend: product.isFeatured,
        isHot: product.isHot,
        serviceIds: product.serviceIds,
        promotionType: product.promotionType,
        promotionId: product.promotionId,
        detailTitle: product.detailTitle,
        detailDesc: product.detailDesc,
        keywords: product.keywords,
        note: product.note,
      });

      // 设置商品图片状态
      setMainImageFiles(mainImageFile ? [mainImageFile] : []);
      setAlbumFiles(albumFiles);

      // 加载分类属性和参数
      let categoryAttributesData: CategoryAttribute[] = [];
      let attributeValuesMap: Record<number, string> = {};

      if (product.categoryId) {
        // 先不使用 fetchCategoryAttributes because it sets productAttributeValues to empty
        // Load category attributes directly without setting productAttributeValues yet
        let attributeInitialValues: Record<number, string> = {};

        try {
          categoryAttributesData = await categoryAttributeApi.getByCategoryId(
            product.categoryId,
          );
          setCategoryAttributes(categoryAttributesData);

          // 初始化属性值
          attributeInitialValues = {};
          categoryAttributesData.forEach((attr) => {
            attributeInitialValues[attr.id] = '';
          });
        } catch (error: any) {
          message.error(error.message || '获取分类属性失败');
        }

        // 然后加载分类参数
        const paramsData = await fetchCategoryParams(product.categoryId);

        // 回显分类属性值
        console.log('=== 开始回显分类属性值 ===');
        console.log('product.attributeValues:', product.attributeValues);
        console.log('attributeInitialValues:', attributeInitialValues);

        attributeValuesMap = { ...attributeInitialValues };
        console.log('初始 attributeValuesMap (空值):', attributeValuesMap);

        if (product.attributeValues && product.attributeValues.length > 0) {
          console.log('开始合并 product.attributeValues...');
          product.attributeValues.forEach((attr: any, index: number) => {
            console.log(`处理第 ${index + 1} 个属性值:`, attr);
            console.log(`  - attributeId: ${attr.attributeId}`);
            console.log(`  - value: "${attr.value}"`);

            if (attr.attributeId && attr.value) {
              attributeValuesMap[attr.attributeId] = attr.value;
              console.log(
                `  ✅ 已设置 attributeValuesMap[${attr.attributeId}] = "${attr.value}"`,
              );
            } else {
              console.log(`  ❌ 跳过 - attributeId 或 value 为空`);
            }
          });
        } else if (
          product.specAttributes &&
          product.specAttributes.length > 0
        ) {
          console.log('开始合并 product.specAttributes...');
          product.specAttributes.forEach((attr: any, index: number) => {
            console.log(`处理第 ${index + 1} 个 specAttributes:`, attr);
            console.log(`  - attributeId: ${attr.attributeId || attr.id}`);
            console.log(`  - value: "${attr.value}"`);

            const attributeId = attr.attributeId || attr.id;
            if (attributeId && attr.value) {
              attributeValuesMap[attributeId] = attr.value;
              console.log(
                `  ✅ 已设置 attributeValuesMap[${attributeId}] = "${attr.value}"`,
              );
            } else {
              console.log(`  ❌ 跳过 - attributeId/id 或 value 为空`);
            }
          });
        } else {
          console.log(
            '⚠️ product.attributeValues 和 product.specAttributes 均为空或不存在',
          );
        }

        console.log('=== 最终的 attributeValuesMap ===', attributeValuesMap);
        setProductAttributeValues(attributeValuesMap);

        // 回显商品参数值
        if (product.paramValues && product.paramValues.length > 0) {
          const paramValuesMap: Record<number, string> = {
            ...productParamValues,
          };
          product.paramValues.forEach((param: any) => {
            // 查找对应的参数模板
            const paramTemplate = paramsData.find(
              (p: any) => p.name === param.paramName,
            );
            if (paramTemplate && param.value) {
              paramValuesMap[paramTemplate.id] = param.value;
            }
          });
          console.log('=== 设置商品参数回显值 ===', paramValuesMap);
          setProductParamValues(paramValuesMap);
        }
        // 兼容旧格式
        else if (product.params && product.params.length > 0) {
          const paramValuesMap: Record<number, string> = {
            ...productParamValues,
          };
          product.params.forEach((param: any) => {
            // 查找对应的参数模板
            const paramTemplate = paramsData.find(
              (p: any) => p.name === param.name,
            );
            if (paramTemplate && param.value) {
              paramValuesMap[paramTemplate.id] = param.value;
            }
          });
          console.log('=== 设置商品参数回显值 (旧格式) ===', paramValuesMap);
          setProductParamValues(paramValuesMap);
        }
      }

      // 设置规格和SKU
      let convertedSpecs: any[] = [];

      // 优先从分类属性中获取规格信息
      if (categoryAttributesData.length > 0) {
        // 从分类属性中提取规格属性（类型为1或2的属性）
        convertedSpecs = categoryAttributesData
          .filter((attr) => attr.type === 1 || attr.type === 2)
          .map((attr, index) => {
            // 从 attributeValuesMap 中获取该属性的值
            const attributeValue = attributeValuesMap[attr.id];
            let values: string[] = [];

            if (attributeValue) {
              if (attr.type === 1) {
                // 单选属性，使用单个值
                values = [attributeValue];
              } else if (attr.type === 2) {
                // 多选属性，分割值
                values = attributeValue
                  .split(',')
                  .map((val: string) => val.trim());
              }
            }

            return {
              id: attr.id || Date.now() + Math.random() + index,
              name: attr.name,
              values,
            };
          })
          .filter((spec) => spec.values.length > 0);
      }

      // 如果分类属性中没有规格信息，尝试从 product.specifications 获取
      else if (product.specifications) {
        // 转换规格数据格式：后端格式 -> 前端格式
        // 后端格式: { id: 1, name: '颜色', value: '红色, 蓝色, 黑色' }
        // 前端格式: { id: uniqueId, name: '颜色', values: ['红色', '蓝色', '黑色'] }
        convertedSpecs = product.specifications.map((spec: any) => ({
          id: spec.id || Date.now() + Math.random(),
          name: spec.specName || spec.name,
          values: spec.specValue
            ? spec.specValue.split(', ').map((val: string) => val.trim())
            : spec.value
              ? spec.value.split(', ').map((val: string) => val.trim())
              : [],
        }));
      }

      console.log('=== 转换后的规格数据 ===', convertedSpecs);

      // 初始化属性图片状态
      const attributeImagesMap: Record<
        string,
        { mainImage: any[]; albumImages: any[] }
      > = {};

      // 从属性值中获取第一个规格的所有选项值
      console.log('=== 从属性值中获取规格选项 ===');
      console.log('attributeValuesMap:', attributeValuesMap);

      // 找到第一个规格属性（通常是颜色）
      const firstSpecAttribute = categoryAttributesData.find(
        (attr) => attr.type === 1 || attr.type === 2,
      );
      console.log('第一个规格属性:', firstSpecAttribute);

      if (firstSpecAttribute) {
        const firstSpecValues = attributeValuesMap[firstSpecAttribute.id];
        console.log('第一个规格的选中值:', firstSpecValues);

        if (firstSpecValues) {
          // 分割选中的属性值
          const specValueList = firstSpecValues
            .split(',')
            .map((val: string) => val.trim());
          console.log('分割后的规格值列表:', specValueList);

          // 为每个规格值创建属性图片条目
          specValueList.forEach((specValue: string) => {
            if (specValue) {
              attributeImagesMap[specValue] = {
                mainImage: [],
                albumImages: [],
              };
              console.log(`为规格值 ${specValue} 创建属性图片条目`);
            }
          });
        }
      }

      if (product.skus) {
        console.log('=== 后端返回的SKU数据 ===', product.skus);
        // 转换SKU数据格式：后端格式 -> 前端格式
        // 后端格式: { id: 1, spec1: '红色', spec2: 'L', price: 100, stock: 10 }
        // 前端格式: { id: 1, specs: { '颜色': '红色', '尺码': 'L' }, price: 100, stock: 10 }
        const convertedSkus = product.skus.map((sku: any) => {
          // 构建specs对象
          const specs: Record<string, string> = {};

          // 尝试从转换后的规格数据中获取规格名称
          if (convertedSpecs && convertedSpecs.length > 0) {
            if (sku.spec1 && convertedSpecs[0]?.name) {
              specs[convertedSpecs[0].name] = sku.spec1;
              // 如果SKU有图片，添加到属性图片状态
              if (sku.image) {
                if (!attributeImagesMap[sku.spec1]) {
                  attributeImagesMap[sku.spec1] = {
                    mainImage: [],
                    albumImages: [],
                  };
                }
                attributeImagesMap[sku.spec1].mainImage = [
                  convertToFileObject(sku.image, 0),
                ];
              }
            }
            if (sku.spec2 && convertedSpecs[1]?.name) {
              specs[convertedSpecs[1].name] = sku.spec2;
            }
            if (sku.spec3 && convertedSpecs[2]?.name) {
              specs[convertedSpecs[2].name] = sku.spec3;
            }
            if (sku.spec4 && convertedSpecs[3]?.name) {
              specs[convertedSpecs[3].name] = sku.spec4;
            }
          } else {
            // 如果没有规格数据，使用默认规格名称
            if (sku.spec1) {
              specs['规格1'] = sku.spec1;
              // 如果SKU有图片，添加到属性图片状态
              if (sku.image) {
                if (!attributeImagesMap[sku.spec1]) {
                  attributeImagesMap[sku.spec1] = {
                    mainImage: [],
                    albumImages: [],
                  };
                }
                attributeImagesMap[sku.spec1].mainImage = [
                  convertToFileObject(sku.image, 0),
                ];
              }
            }
            if (sku.spec2) {
              specs['规格2'] = sku.spec2;
            }
            if (sku.spec3) {
              specs['规格3'] = sku.spec3;
            }
            if (sku.spec4) {
              specs['规格4'] = sku.spec4;
            }
          }

          return {
            ...sku,
            specs,
          };
        });
        console.log('=== 转换后的SKU数据 ===', convertedSkus);
        setSkuList(convertedSkus);

        // 初始化属性图片的相册为空数组
        Object.keys(attributeImagesMap).forEach((key) => {
          if (!attributeImagesMap[key].albumImages) {
            attributeImagesMap[key].albumImages = [];
          }
          if (!attributeImagesMap[key].mainImage) {
            attributeImagesMap[key].mainImage = [];
          }
        });

        // 加载属性图片的相册数据
        if (product.albumImages && Array.isArray(product.albumImages)) {
          console.log('=== 加载属性图片相册数据 ===', product.albumImages);

          // 为每个属性值分配相册图片
          const specValues = Object.keys(attributeImagesMap);
          console.log('当前属性值列表:', specValues);

          if (specValues.length > 0) {
            // 为每个属性值创建独立的相册图片数组
            specValues.forEach((specValue) => {
              if (!attributeImagesMap[specValue]) {
                attributeImagesMap[specValue] = {
                  mainImage: [],
                  albumImages: [],
                };
              }
              // 清空相册图片，确保每个属性值的相册都是独立的
              attributeImagesMap[specValue].albumImages = [];
            });

            // 根据后端返回的相册图片数据，为每个颜色属性分配对应的图片
            product.albumImages.forEach((albumImage: any, index: number) => {
              console.log(`处理相册图片 ${index + 1}:`, albumImage);

              // 根据color字段分配图片到对应的颜色属性
              if (albumImage.color) {
                const specValue = albumImage.color;
                console.log(
                  `为属性值 ${specValue} 添加相册图片:`,
                  albumImage.url,
                );

                // 确保属性图片条目存在
                if (!attributeImagesMap[specValue]) {
                  attributeImagesMap[specValue] = {
                    mainImage: [],
                    albumImages: [],
                  };
                }

                // 将相册图片添加到对应的属性值
                attributeImagesMap[specValue].albumImages.push({
                  uid: `existing-${Date.now()}-${index}-${Math.random()}`,
                  name: `album-image-${Date.now()}.jpg`,
                  status: 'done',
                  url: albumImage.url,
                  thumbUrl: albumImage.url,
                  response: { success: true, data: albumImage.url },
                });
              }
            });

            console.log('为每个属性值分配独立的相册图片');
          }
        } else {
          console.log('=== 没有相册图片数据 ===');
        }

        // 设置属性图片状态
        console.log('=== 初始化属性图片状态 ===', attributeImagesMap);
        setAttributeImages(attributeImagesMap);
      }

      // 设置关联商品
      if (product.relatedProducts) {
        setRelatedProducts(product.relatedProducts);
      }

      if (product.bundleProducts) {
        setBundleProducts(product.bundleProducts);
      }

      if (product.recommendProducts) {
        setRecommendProducts(product.recommendProducts);
      }

      // 设置商品详情
      if (product.detailDescription) {
        setProductDetail(product.detailDescription);
      }

      // 保存到ref
      formValuesRef.current = form.getFieldsValue();
    } catch (error: any) {
      console.error('加载商品数据失败:', error);
      message.error(`加载商品数据失败: ${error.message || '未知错误'}`);
    }
  };

  // 步骤切换
  const nextStep = async () => {
    try {
      // 验证当前步骤的字段
      const fieldsToValidate = getFieldsForStep(currentStep);
      await form.validateFields(fieldsToValidate);

      // 验证分类属性和商品参数（步骤2）
      if (currentStep === 2) {
        // 验证必填的分类属性
        const requiredAttrs = categoryAttributes.filter(
          (attr) => attr.isRequired === 1,
        );
        for (const attr of requiredAttrs) {
          if (
            !productAttributeValues[attr.id] ||
            productAttributeValues[attr.id] === ''
          ) {
            throw new Error(`请选择${attr.name}`);
          }
        }

        // 验证必填的商品参数
        for (const param of categoryParams) {
          if (
            !productParamValues[param.id] ||
            productParamValues[param.id] === ''
          ) {
            throw new Error(`请输入${param.name}`);
          }
        }
      }

      // 保存当前表单值到ref
      formValuesRef.current = {
        ...formValuesRef.current,
        ...form.getFieldsValue(),
      };

      setCurrentStep(currentStep + 1);
    } catch (e: any) {
      message.error(e.message || '请完善当前步骤的信息');
    }
  };

  const prevStep = () => {
    // 保存当前表单值到ref
    formValuesRef.current = {
      ...formValuesRef.current,
      ...form.getFieldsValue(),
    };

    setCurrentStep(currentStep - 1);
  };

  // 获取每个步骤需要验证的字段
  const getFieldsForStep = (step: number): string[] => {
    switch (step) {
      case 0:
        return [
          'categoryId',
          'brandId',
          'name',
          'subtitle',
          'productSn',
          'price',
        ];
      case 1:
        return [];
      case 2:
        return [];
      default:
        return [];
    }
  };

  // 辅助函数：从完整 URL 中提取相对路径
  const getRelativePath = (url: string): string => {
    if (!url) return '';
    // 如果已经是相对路径，直接返回
    if (!url.startsWith('http')) return url;
    // 否则，提取路径部分
    try {
      const urlObj = new URL(url);
      return urlObj.pathname;
    } catch {
      return url;
    }
  };

  // 辅助函数：从文件对象数组中提取 URL
  const extractImageUrls = (files: any[]): string[] => {
    if (!files || !Array.isArray(files)) return [];
    return files
      .map((file: any) => {
        let url: string | null = null;
        if (typeof file === 'string') {
          url = file;
        } else if (file.url) {
          url = file.url;
        } else if (file.response && file.response.data) {
          url = file.response.data;
        }
        if (url) {
          return getRelativePath(url);
        }
        return null;
      })
      .filter((url: string | null) => url !== null) as string[];
  };

  // 辅助函数：从文件对象数组中提取单个 URL
  const extractSingleImageUrl = (files: any[]): string | undefined => {
    const urls = extractImageUrls(files);
    return urls[0];
  };

  // 提交商品
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // 验证表单
      const allValues = await form.validateFields();

      // 验证分类属性和商品参数
      // 验证必填的分类属性
      const requiredAttrs = categoryAttributes.filter(
        (attr) => attr.isRequired === 1,
      );
      for (const attr of requiredAttrs) {
        if (
          !productAttributeValues[attr.id] ||
          productAttributeValues[attr.id] === ''
        ) {
          throw new Error(`请选择${attr.name}`);
        }
      }

      // 验证必填的商品参数
      for (const param of categoryParams) {
        if (
          !productParamValues[param.id] ||
          productParamValues[param.id] === ''
        ) {
          throw new Error(`请输入${param.name}`);
        }
      }

      // 合并所有步骤的表单值
      const combinedValues = { ...formValuesRef.current, ...allValues };

      // 从文件对象中提取 URL
      const mainImage = extractSingleImageUrl(mainImageFiles);
      const albumImages = extractImageUrls(albumFiles);

      // 构建属性图片的相册数据
      const attributeAlbumImages: any[] = [];
      console.log('=== 构建属性图片的相册数据 ===');
      console.log('attributeImages:', attributeImages);

      Object.entries(attributeImages).forEach(([specValue, images]) => {
        console.log(`处理属性值: ${specValue}`);
        console.log('主图:', images.mainImage);
        console.log('相册图片:', images.albumImages);

        // 先添加主图
        if (images.mainImage && images.mainImage.length > 0) {
          const mainImageUrl = extractSingleImageUrl(images.mainImage);
          if (mainImageUrl) {
            console.log(`为属性值 ${specValue} 添加主图: ${mainImageUrl}`);
            attributeAlbumImages.push({
              url: mainImageUrl,
              sort: 0,
              isMain: true,
              color: specValue, // 添加颜色属性标识
            });
          }
        }

        // 再添加相册图片
        if (images.albumImages && images.albumImages.length > 0) {
          const attrAlbumImages = extractImageUrls(images.albumImages);
          console.log('提取的相册图片URL:', attrAlbumImages);

          attrAlbumImages.forEach((url, index) => {
            // 为每个相册图片添加颜色属性标识
            console.log(`为属性值 ${specValue} 添加相册图片: ${url}`);
            attributeAlbumImages.push({
              url,
              sort: index + 1, // 主图排序为0，相册图片从1开始
              isMain: false,
              color: specValue, // 添加颜色属性标识
            });
          });
        }
      });

      console.log(
        '=== 构建完成的attributeAlbumImages ===',
        attributeAlbumImages,
      );

      console.log('=== 表单数据收集调试 ===');
      console.log('productAttributeValues:', productAttributeValues);
      console.log('productParamValues:', productParamValues);
      console.log('表单图片数据:', mainImage, albumImages);

      console.log('提取后的主图:', mainImage);
      console.log('提取后的相册:', albumImages);
      console.log('属性相册图片:', attributeAlbumImages);

      // 构建属性值数组
      const attributeValuesArray = Object.entries(productAttributeValues).map(
        ([attributeId, value]) => ({
          attributeId: parseInt(attributeId),
          value,
        }),
      );
      console.log('=== 构建的属性值数组 ===', attributeValuesArray);

      // 构建参数值数组
      const paramValuesArray = Object.entries(productParamValues).map(
        ([paramId, value]) => {
          const param = categoryParams.find((p) => p.id === parseInt(paramId));
          return {
            paramName: param ? param.name : `参数${paramId}`,
            value,
          };
        },
      );
      console.log('=== 构建的参数值数组 ===', paramValuesArray);

      // 构建规格属性数组
      const specAttributesArray = categoryAttributes
        .filter((attr) => attr.type === 1 || attr.type === 2) // 只包含规格属性（单选和多选）
        .map((attr) => {
          const attributeValue = productAttributeValues[attr.id];
          let values: string[] = [];

          if (attributeValue) {
            if (attr.type === 1) {
              // 单选属性，使用单个值
              values = [attributeValue];
            } else if (attr.type === 2) {
              // 多选属性，分割值
              values = attributeValue
                .split(',')
                .map((val: string) => val.trim());
            }
          }

          return {
            name: attr.name,
            values: values.map((value) => ({ value })),
          };
        })
        .filter((spec) => spec.values.length > 0);
      console.log('=== 构建的规格属性数组 ===', specAttributesArray);

      // 转换 SKU 数据格式为后端期望的格式
      const convertedSkus = skuList.map((sku) => {
        const skuData: any = {
          ...sku,
        };

        // 保留 specs 对象，确保后端能正确处理规格信息
        if (sku.specs) {
          skuData.specs = sku.specs;
        }

        // 将 specs 对象转换为 spec1、spec2、spec3、spec4 字段
        const specValues = Object.values(sku.specs || {});
        if (specValues.length > 0) {
          skuData.spec1 = specValues[0];
          // 为 SKU 添加属性图片
          const firstSpecValue = specValues[0] as string;
          if (
            attributeImages[firstSpecValue] &&
            attributeImages[firstSpecValue].mainImage
          ) {
            // 将属性主图设置为 SKU 的 image 字段
            skuData.image = extractSingleImageUrl(
              attributeImages[firstSpecValue].mainImage,
            );
          }
        }
        if (specValues.length > 1) {
          skuData.spec2 = specValues[1];
        }
        if (specValues.length > 2) {
          skuData.spec3 = specValues[2];
        }
        if (specValues.length > 3) {
          skuData.spec4 = specValues[3];
        }

        return skuData;
      });
      console.log('=== 转换后的 SKU 数据 ===', convertedSkus);
      console.log('=== 属性图片数据 ===', attributeImages);

      const productData: ProductFormData = {
        ...combinedValues,
        // 从文件对象中提取 URL
        image: mainImage,
        images: albumImages,
        albumImages: attributeAlbumImages,
        skus: convertedSkus,
        relatedProducts,
        bundleProducts,
        recommendProducts,
        attributeValues: attributeValuesArray,
        paramValues: paramValuesArray,
        specAttributes: specAttributesArray,
        detailDescription: productDetail,
        // 映射字段名称以匹配 ProductFormData 类型
        status: combinedValues.isOnSale ? 'active' : 'inactive',
        isFeatured: combinedValues.isRecommend,
        isNew: combinedValues.isNew || false,
      };

      console.log('=== 完整的 productData 准备发送到后端 ===');
      console.log('productData:', productData);
      console.log('productData.attributeValues:', productData.attributeValues);
      console.log('productData.paramValues:', productData.paramValues);

      await onSubmit(productData);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  // SKU生成逻辑
  const generateSkuList = () => {
    // 收集所有规格信息（仅分类规格）
    const allSpecs: Array<{ name: string; values: string[] }> = [];

    // 添加分类规格（基于用户选择的值）
    categoryAttributes.forEach((attr) => {
      if (
        (attr.type === 1 || attr.type === 2) &&
        productAttributeValues[attr.id]
      ) {
        const selectedValue = productAttributeValues[attr.id];
        let values: string[] = [];

        if (attr.type === 1) {
          // 单选属性，使用用户选择的单个值
          values = [selectedValue];
        } else if (attr.type === 2) {
          // 多选属性，使用用户选择的多个值
          values = selectedValue.split(',').filter((val) => val.trim() !== '');
        }

        if (values.length > 0) {
          allSpecs.push({
            name: attr.name,
            values,
          });
        }
      }
    });

    if (allSpecs.length === 0) {
      message.warning('请先选择分类规格');
      return;
    }

    const generateCombinations = (
      specs: any[],
      index: number,
      current: any,
    ): any[] => {
      if (index === specs.length) {
        return [current];
      }

      const spec = specs[index];
      const results: any[] = [];

      for (const value of spec.values) {
        const newCurrent = { ...current, [spec.name]: value };
        results.push(...generateCombinations(specs, index + 1, newCurrent));
      }

      return results;
    };

    const combinations = generateCombinations(allSpecs, 0, {});
    const currentPrice = form.getFieldValue('price') || 0;
    const newSkuList = combinations.map((combo, index) => {
      // 生成唯一ID（基于时间戳和索引，确保是纯数字）
      const uniqueId = Date.now() * 1000 + index;
      // 生成SKU编码（基于规格组合）
      const skuCode = `SKU_${Date.now()}_${index + 1}_${Object.values(combo).join('_').replace(/\s+/g, '_')}`;

      // 生成SKU名称（基于规格组合）
      const skuName = Object.entries(combo)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' ');

      return {
        id: uniqueId,
        specs: combo,
        price: currentPrice,
        originalPrice: currentPrice,
        promotionPrice: currentPrice,
        stock: 0,
        skuCode: skuCode,
        skuName: skuName,
        image: '',
        status: 1,
      };
    });

    setSkuList(newSkuList);
  };

  // 图片预览函数
  const handlePreview = (file: any) => {
    console.log('预览文件对象:', file);

    // 确保使用完整的图片 URL
    let imageUrl = file.url || file.thumbUrl;

    // 如果没有 url，尝试从 response 中获取
    if (!imageUrl && file.response) {
      if (typeof file.response === 'string') {
        imageUrl = file.response;
      } else if (file.response.data) {
        imageUrl = file.response.data;
      }
    }

    // 确保 URL 是完整的
    if (imageUrl && !imageUrl.startsWith('http')) {
      // 使用相对路径，通过代理访问
      if (!imageUrl.startsWith('/')) {
        imageUrl = '/' + imageUrl;
      }
    }

    console.log('最终预览图片 URL:', imageUrl);
    console.log('设置 previewVisible 为 true');

    if (imageUrl) {
      setPreviewImage(imageUrl);
      setPreviewScale(1);
      setPreviewPosition({ x: 0, y: 0 });
      setPreviewVisible(true);
    } else {
      message.warning('无法预览此图片');
    }
  };

  // 放大图片
  const handleZoomIn = () => {
    setPreviewScale((prev) => Math.min(prev + 0.2, 3));
  };

  // 缩小图片
  const handleZoomOut = () => {
    setPreviewScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  // 重置缩放和位置
  const handleReset = () => {
    setPreviewScale(1);
    setPreviewPosition({ x: 0, y: 0 });
  };

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  };

  // 鼠标拖动开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (previewScale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - previewPosition.x,
        y: e.clientY - previewPosition.y,
      });
    }
  };

  // 鼠标拖动中
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPreviewPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  // 鼠标拖动结束
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 鼠标离开
  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const updateSku = (index: number, field: string, value: any) => {
    const newSkus = [...skuList];
    newSkus[index] = { ...newSkus[index], [field]: value };
    setSkuList(newSkus);
  };

  // 渲染步骤内容
  // 图片上传限制函数
  const beforeUpload = (file: any) => {
    const isJpgOrPng =
      file.type === 'image/jpeg' ||
      file.type === 'image/png' ||
      file.type === 'image/gif';
    if (!isJpgOrPng) {
      message.error('只能上传 JPG/PNG/GIF 图片!');
      return false;
    }
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('图片大小不能超过 10MB!');
      return false;
    }
    return true;
  };

  const renderStep1 = () => (
    <Form form={form} layout="vertical" initialValues={formValuesRef.current}>
      <Row gutter={24}>
        <Col span={12}>
          <Form.Item
            label="商品分类"
            name="categoryId"
            rules={[{ required: true, message: '请选择商品分类' }]}
          >
            <TreeSelect
              placeholder="请选择商品分类"
              treeData={categories.map((cat) => ({
                title: cat.name,
                value: cat.id,
                disabled: !cat.parentId, // 禁用一级分类
                children: cat.children?.map((child) => ({
                  title: child.name,
                  value: child.id,
                })),
              }))}
              treeDefaultExpandAll
              style={{ width: '100%' }}
              onChange={(value) => {
                console.log('=== 选择分类 ===');
                console.log('分类ID:', value);
                form.setFieldValue('categoryId', value);
                formValuesRef.current.categoryId = value;
                console.log('开始加载分类属性...');
                fetchCategoryAttributes(value as number);
                console.log('开始加载分类参数...');
                fetchCategoryParams(value as number);
              }}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label="商品品牌"
            name="brandId"
            rules={[{ required: true, message: '请选择商品品牌' }]}
          >
            <Select placeholder="请选择商品品牌">
              {brands.map((brand) => (
                <Option key={brand.id} value={brand.id}>
                  {brand.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      <Form.Item
        label="商品名称"
        name="name"
        rules={[{ required: true, message: '请输入商品名称' }]}
      >
        <Input placeholder="请输入商品名称" />
      </Form.Item>

      <Form.Item
        label="副标题"
        name="subtitle"
        rules={[{ required: true, message: '请输入副标题' }]}
      >
        <Input placeholder="请输入副标题" />
      </Form.Item>

      <Form.Item label="商品介绍" name="description">
        <TextArea rows={4} placeholder="请输入商品介绍" />
      </Form.Item>

      <Row gutter={24}>
        <Col span={8}>
          <Form.Item
            label="商品货号"
            name="productSn"
            rules={[{ required: true, message: '请输入商品货号' }]}
          >
            <Input placeholder="请输入商品货号" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="商品售价"
            name="price"
            rules={[{ required: true, message: '请输入商品售价' }]}
          >
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入商品售价"
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="市场价" name="originalPrice">
            <InputNumber
              min={0}
              precision={2}
              style={{ width: '100%' }}
              placeholder="请输入市场价"
            />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={8}>
          <Form.Item label="计量单位" name="unit">
            <Input placeholder="如：件、个、套" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="商品重量 (g)" name="weight">
            <InputNumber
              min={0}
              style={{ width: '100%' }}
              placeholder="请输入商品重量"
            />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="排序" name="sort">
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          placeholder="请输入排序"
        />
      </Form.Item>

      <Form.Item
        label="商品主图"
        name="image"
        rules={[{ required: true, message: '请上传商品主图' }]}
      >
        <Upload
          listType="picture-card"
          maxCount={1}
          beforeUpload={beforeUpload}
          action="/api/admin/upload/file"
          headers={{
            Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
          }}
          fileList={mainImageFiles}
          onPreview={handlePreview}
          onChange={(info) => {
            console.log('Upload onChange:', info);
            if (info.file.status === 'uploading') {
              console.log('上传中...');
            } else if (info.file.status === 'done') {
              console.log('上传成功, 完整文件对象:', info.file);
              console.log('上传成功, response:', info.file.response);
              if (info.file.response && info.file.response.success) {
                const fileUrl = info.file.response.data;
                // 使用相对路径，让请求通过代理转发到后端
                const relativeUrl = fileUrl.startsWith('http')
                  ? fileUrl
                  : fileUrl;
                info.file.url = relativeUrl;
                info.file.thumbUrl = relativeUrl;
                console.log('设置文件URL:', relativeUrl);
                message.success('上传成功');
              }
            } else if (info.file.status === 'error') {
              console.log('上传失败:', info.file.error);
              message.error('上传失败');
            }
            setMainImageFiles(info.fileList);
          }}
        >
          <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>上传</div>
          </div>
        </Upload>
      </Form.Item>

      <Form.Item label="商品相册" name="album">
        <Upload
          listType="picture-card"
          multiple
          beforeUpload={beforeUpload}
          action="/api/admin/upload/file"
          headers={{
            Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
          }}
          fileList={albumFiles}
          onPreview={handlePreview}
          onChange={(info) => {
            console.log('Upload onChange:', info);
            if (info.file.status === 'uploading') {
              console.log('上传中...');
            } else if (info.file.status === 'done') {
              console.log('上传成功, 完整文件对象:', info.file);
              console.log('上传成功, response:', info.file.response);
              if (info.file.response && info.file.response.success) {
                const fileUrl = info.file.response.data;
                // 使用相对路径，让请求通过代理转发到后端
                const relativeUrl = fileUrl.startsWith('http')
                  ? fileUrl
                  : fileUrl;
                info.file.url = relativeUrl;
                info.file.thumbUrl = relativeUrl;
                console.log('设置文件URL:', relativeUrl);
                message.success('上传成功');
              }
            } else if (info.file.status === 'error') {
              console.log('上传失败:', info.file.error);
              message.error('上传失败');
            }
            setAlbumFiles(info.fileList);
          }}
        >
          <div>
            <PlusOutlined />
            <div style={{ marginTop: 8 }}>上传</div>
          </div>
        </Upload>
      </Form.Item>
    </Form>
  );

  const renderStep2 = () => (
    <Form form={form} layout="vertical" initialValues={formValuesRef.current}>
      <Row gutter={24}>
        <Col span={8}>
          <Form.Item label="赠送积分" name="giftPoint">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="赠送成长值" name="giftGrowth">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="积分购买限制" name="usePointLimit">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={8}>
          <Form.Item label="预告商品" name="isPreview" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="商品上架" name="isOnSale" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="新品" name="isNew" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={8}>
          <Form.Item label="推荐" name="isRecommend" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="热销" name="isHot" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      </Row>

      <Form.Item label="服务保证" name="serviceIds">
        <CheckboxGroup
          options={[
            { label: '无忧退货', value: 1 },
            { label: '快速退款', value: 2 },
            { label: '免费包邮', value: 3 },
          ]}
        />
      </Form.Item>

      <Form.Item label="详细页标题" name="detailTitle">
        <Input placeholder="请输入详细页标题" />
      </Form.Item>

      <Form.Item label="详细页描述" name="detailDesc">
        <TextArea rows={3} placeholder="请输入详细页描述" />
      </Form.Item>

      <Form.Item label="商品关键字" name="keywords">
        <Input placeholder="多个关键字用逗号分隔" />
      </Form.Item>

      <Form.Item label="商品备注" name="note">
        <TextArea rows={3} placeholder="请输入商品备注" />
      </Form.Item>

      <Form.Item label="选择优惠方式" name="promotionType">
        <RadioGroup>
          <Radio.Button value={0}>无优惠</Radio.Button>
          <Radio.Button value={1}>特惠促销</Radio.Button>
          <Radio.Button value={2}>会员价格</Radio.Button>
          <Radio.Button value={3}>阶梯价格</Radio.Button>
          <Radio.Button value={4}>满减价格</Radio.Button>
        </RadioGroup>
      </Form.Item>

      <Form.Item label="选择促销活动" name="promotionId">
        <Select placeholder="请选择促销活动" allowClear>
          {promotions.map((promo) => (
            <Option key={promo.id} value={promo.id}>
              {promo.name} ({promo.typeText})
            </Option>
          ))}
        </Select>
      </Form.Item>
    </Form>
  );

  const renderStep3 = () => (
    <div>
      <Card title="商品规格" size="small" style={{ marginBottom: 24 }}>
        {/* 分类属性（商品规格）区域 */}
        {categoryAttributes.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              {categoryAttributes.map((attr) => (
                <Col span={12} key={attr.id}>
                  <Form.Item
                    label={`${attr.name}${attr.isRequired === 1 ? ' *' : ''}`}
                    rules={
                      attr.isRequired === 1
                        ? [{ required: true, message: `请选择${attr.name}` }]
                        : []
                    }
                  >
                    {attr.type === 1 && (
                      <Select
                        placeholder={`请选择${attr.name}`}
                        value={productAttributeValues[attr.id] || undefined}
                        onChange={(value) => {
                          console.log(
                            `=== 单选属性值变更 (ID: ${attr.id}) ===`,
                          );
                          console.log('新值:', value);
                          const newValues = {
                            ...productAttributeValues,
                            [attr.id]: value,
                          };
                          console.log(
                            '更新后的productAttributeValues:',
                            newValues,
                          );
                          setProductAttributeValues(newValues);
                        }}
                      >
                        {attr.values?.map((val) => (
                          <Option key={val.id} value={val.value}>
                            {val.value}
                          </Option>
                        ))}
                      </Select>
                    )}
                    {attr.type === 2 && (
                      <Select
                        placeholder={`请选择${attr.name}`}
                        mode="multiple"
                        value={
                          productAttributeValues[attr.id]
                            ? productAttributeValues[attr.id].split(',')
                            : []
                        }
                        onChange={(value) => {
                          console.log(
                            `=== 多选属性值变更 (ID: ${attr.id}) ===`,
                          );
                          console.log('新值数组:', value);
                          const joinedValue = value.join(',');
                          const newValues = {
                            ...productAttributeValues,
                            [attr.id]: joinedValue,
                          };
                          console.log(
                            '更新后的productAttributeValues:',
                            newValues,
                          );
                          setProductAttributeValues(newValues);
                        }}
                      >
                        {attr.values?.map((val) => (
                          <Option key={val.id} value={val.value}>
                            {val.value}
                          </Option>
                        ))}
                      </Select>
                    )}
                    {attr.type === 3 && (
                      <Input
                        placeholder={`请输入${attr.name}`}
                        value={productAttributeValues[attr.id] || ''}
                        onChange={(e) => {
                          console.log(
                            `=== 文本输入属性值变更 (ID: ${attr.id}) ===`,
                          );
                          console.log('新值:', e.target.value);
                          const newValues = {
                            ...productAttributeValues,
                            [attr.id]: e.target.value,
                          };
                          console.log(
                            '更新后的productAttributeValues:',
                            newValues,
                          );
                          setProductAttributeValues(newValues);
                        }}
                      />
                    )}
                    {attr.type === 4 && (
                      <InputNumber
                        placeholder={`请输入${attr.name}`}
                        style={{ width: '100%' }}
                        min={0}
                        value={
                          productAttributeValues[attr.id]
                            ? Number(productAttributeValues[attr.id])
                            : undefined
                        }
                        onChange={(value) => {
                          console.log(
                            `=== 数字输入属性值变更 (ID: ${attr.id}) ===`,
                          );
                          console.log('新值:', value);
                          const stringValue = String(value || '');
                          const newValues = {
                            ...productAttributeValues,
                            [attr.id]: stringValue,
                          };
                          console.log(
                            '更新后的productAttributeValues:',
                            newValues,
                          );
                          setProductAttributeValues(newValues);
                        }}
                      />
                    )}
                    {attr.type === 5 && (
                      <Input
                        type="date"
                        placeholder={`请选择${attr.name}`}
                        value={productAttributeValues[attr.id] || ''}
                        onChange={(e) => {
                          console.log(
                            `=== 日期输入属性值变更 (ID: ${attr.id}) ===`,
                          );
                          console.log('新值:', e.target.value);
                          const newValues = {
                            ...productAttributeValues,
                            [attr.id]: e.target.value,
                          };
                          console.log(
                            '更新后的productAttributeValues:',
                            newValues,
                          );
                          setProductAttributeValues(newValues);
                        }}
                      />
                    )}
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </div>
        )}

        <Button
          type="primary"
          onClick={generateSkuList}
          style={{ marginTop: 16 }}
        >
          生成SKU列表
        </Button>
      </Card>

      {skuList.length > 0 && (
        <>
          <Card title="SKU列表" size="small">
            <Table
              dataSource={skuList}
              rowKey="id"
              pagination={false}
              columns={[
                {
                  title: '规格组合',
                  render: (_, record) => (
                    <div>
                      {Object.entries(record.specs || {}).map(
                        ([key, value]) => (
                          <div key={key} style={{ marginBottom: '4px' }}>
                            {key}: {value as string}
                          </div>
                        ),
                      )}
                    </div>
                  ),
                },
                {
                  title: '销售价格',
                  render: (_, record, index) => (
                    <InputNumber
                      min={0}
                      precision={2}
                      value={record.price}
                      onChange={(value) => updateSku(index, 'price', value)}
                    />
                  ),
                },
                {
                  title: '促销价格',
                  render: (_, record, index) => (
                    <InputNumber
                      min={0}
                      precision={2}
                      value={record.promotionPrice}
                      onChange={(value) =>
                        updateSku(index, 'promotionPrice', value)
                      }
                    />
                  ),
                },
                {
                  title: '库存',
                  render: (_, record, index) => (
                    <InputNumber
                      min={0}
                      value={record.stock}
                      onChange={(value) => updateSku(index, 'stock', value)}
                    />
                  ),
                },
                {
                  title: 'SKU编号',
                  render: (_, record, index) => (
                    <Input
                      value={record.skuCode}
                      onChange={(e) =>
                        updateSku(index, 'skuCode', e.target.value)
                      }
                      placeholder="SKU编号"
                    />
                  ),
                },
              ]}
            />
          </Card>

          {/* 属性图片上传区域 */}
          {categoryAttributes.length > 0 && (
            <Card title="属性图片" size="small" style={{ marginTop: 24 }}>
              {(() => {
                // 获取第一个规格（通常是颜色）
                const firstSpec = categoryAttributes.find(
                  (attr) => attr.type === 1 || attr.type === 2,
                );
                if (
                  !firstSpec ||
                  !firstSpec.values ||
                  firstSpec.values.length === 0
                ) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      该分类暂无规格属性
                    </div>
                  );
                }

                // 获取用户选择的属性值
                const selectedValues = [];
                if (firstSpec.type === 1) {
                  // 单选属性
                  const selectedValue = productAttributeValues[firstSpec.id];
                  if (selectedValue) {
                    selectedValues.push(selectedValue);
                  }
                } else if (firstSpec.type === 2) {
                  // 多选属性
                  const selectedValue = productAttributeValues[firstSpec.id];
                  if (selectedValue) {
                    selectedValues.push(
                      ...selectedValue
                        .split(',')
                        .filter((val) => val.trim() !== ''),
                    );
                  }
                }

                if (selectedValues.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '40px 0' }}>
                      请先选择规格属性
                    </div>
                  );
                }

                return (
                  <div>
                    {selectedValues.map((value) => (
                      <div key={value} style={{ marginBottom: 24 }}>
                        <h5 style={{ marginBottom: 16 }}>{value}</h5>

                        {/* 主图上传 - 隐藏 */}
                        <div style={{ marginBottom: 16, display: 'none' }}>
                          <p style={{ marginBottom: 8 }}>商品主图</p>
                          <Upload
                            listType="picture-card"
                            maxCount={1}
                            beforeUpload={beforeUpload}
                            action="/api/admin/upload/file"
                            headers={{
                              Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
                            }}
                            fileList={attributeImages[value]?.mainImage || []}
                            onPreview={handlePreview}
                            onChange={(info) => {
                              if (
                                info.file.status === 'done' &&
                                info.file.response &&
                                info.file.response.success
                              ) {
                                const fileUrl = info.file.response.data;
                                const relativeUrl = fileUrl.startsWith('http')
                                  ? fileUrl
                                  : fileUrl;
                                info.file.url = relativeUrl;
                                info.file.thumbUrl = relativeUrl;
                                message.success('上传成功');
                              } else if (info.file.status === 'error') {
                                message.error('上传失败');
                              }
                              setAttributeImages({
                                ...attributeImages,
                                [value]: {
                                  ...attributeImages[value],
                                  mainImage: info.fileList,
                                },
                              });
                            }}
                          >
                            <div>
                              <PlusOutlined />
                              <div style={{ marginTop: 8 }}>点击上传</div>
                            </div>
                          </Upload>
                        </div>

                        {/* 相册上传 */}
                        <div>
                          <p style={{ marginBottom: 8 }}>商品相册</p>
                          <Upload
                            listType="picture-card"
                            multiple
                            beforeUpload={beforeUpload}
                            action="/api/admin/upload/file"
                            headers={{
                              Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}`,
                            }}
                            fileList={attributeImages[value]?.albumImages || []}
                            onPreview={handlePreview}
                            onChange={(info) => {
                              console.log('相册图片上传 onChange:', info);
                              if (info.file.status === 'done') {
                                console.log('上传完成，文件信息:', info.file);
                                console.log(
                                  '上传完成，response:',
                                  info.file.response,
                                );
                                if (
                                  info.file.response &&
                                  info.file.response.success
                                ) {
                                  const fileUrl = info.file.response.data;
                                  console.log('上传成功，fileUrl:', fileUrl);
                                  const relativeUrl = fileUrl.startsWith('http')
                                    ? fileUrl
                                    : fileUrl;
                                  console.log(
                                    '上传成功，relativeUrl:',
                                    relativeUrl,
                                  );
                                  info.file.url = relativeUrl;
                                  info.file.thumbUrl = relativeUrl;
                                  console.log(
                                    '上传成功，更新后的文件对象:',
                                    info.file,
                                  );
                                  message.success('上传成功');
                                } else {
                                  console.log(
                                    '上传失败，response:',
                                    info.file.response,
                                  );
                                  message.error('上传失败');
                                }
                              } else if (info.file.status === 'error') {
                                console.log('上传失败:', info.file.error);
                                message.error('上传失败');
                              }
                              console.log(
                                '更新前的 attributeImages:',
                                attributeImages,
                              );
                              console.log('更新后的 fileList:', info.fileList);
                              setAttributeImages({
                                ...attributeImages,
                                [value]: {
                                  ...attributeImages[value],
                                  albumImages: info.fileList,
                                },
                              });
                              console.log('更新后的 attributeImages:', {
                                ...attributeImages,
                                [value]: {
                                  ...attributeImages[value],
                                  albumImages: info.fileList,
                                },
                              });
                            }}
                          >
                            <div>
                              <PlusOutlined />
                              <div style={{ marginTop: 8 }}>点击上传</div>
                            </div>
                          </Upload>

                          {/* 拖拽排序（至少2张图片时显示） */}
                          {attributeImages[value]?.albumImages &&
                            attributeImages[value].albumImages.length >= 2 && (
                              <div style={{ marginTop: 16 }}>
                                <p style={{ marginBottom: 8 }}>拖拽调整顺序</p>
                                <div
                                  style={{
                                    display: 'flex',
                                    gap: 12,
                                    flexWrap: 'wrap',
                                  }}
                                  onDragOver={(e) => e.preventDefault()}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    const draggedId =
                                      e.dataTransfer.getData('text/plain');
                                    const targetId = (e.target as HTMLElement)
                                      .closest('[data-uid]')
                                      ?.getAttribute('data-uid');

                                    if (
                                      draggedId &&
                                      targetId &&
                                      draggedId !== targetId
                                    ) {
                                      const currentImages = [
                                        ...attributeImages[value].albumImages,
                                      ];
                                      const draggedIndex =
                                        currentImages.findIndex(
                                          (img) => img.uid === draggedId,
                                        );
                                      const targetIndex =
                                        currentImages.findIndex(
                                          (img) => img.uid === targetId,
                                        );

                                      if (
                                        draggedIndex !== -1 &&
                                        targetIndex !== -1
                                      ) {
                                        const [draggedItem] =
                                          currentImages.splice(draggedIndex, 1);
                                        currentImages.splice(
                                          targetIndex,
                                          0,
                                          draggedItem,
                                        );

                                        console.log(
                                          '拖拽排序后的图片列表:',
                                          currentImages,
                                        );
                                        setAttributeImages({
                                          ...attributeImages,
                                          [value]: {
                                            ...attributeImages[value],
                                            albumImages: currentImages,
                                          },
                                        });
                                      }
                                    }
                                  }}
                                >
                                  {attributeImages[value].albumImages.map(
                                    (image) => (
                                      <div
                                        key={image.uid}
                                        data-uid={image.uid}
                                        draggable
                                        onDragStart={(e) => {
                                          e.dataTransfer.setData(
                                            'text/plain',
                                            image.uid,
                                          );
                                          e.currentTarget.style.opacity = '0.5';
                                        }}
                                        onDragEnd={(e) => {
                                          e.currentTarget.style.opacity = '1';
                                        }}
                                        style={{
                                          position: 'relative',
                                          width: 100,
                                          height: 100,
                                          border: '1px solid #d9d9d9',
                                          borderRadius: 4,
                                          overflow: 'hidden',
                                          cursor: 'grab',
                                        }}
                                      >
                                        {image.status === 'uploading' ? (
                                          <div
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              backgroundColor: '#f5f5f5',
                                            }}
                                          >
                                            <span>上传中...</span>
                                          </div>
                                        ) : (
                                          <img
                                            src={image.thumbUrl || image.url}
                                            alt={image.name}
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'cover',
                                            }}
                                          />
                                        )}
                                        <div
                                          style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            width: 20,
                                            height: 20,
                                            backgroundColor:
                                              'rgba(0, 0, 0, 0.5)',
                                            color: 'white',
                                            borderRadius: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          ≡
                                        </div>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Card>
          )}
        </>
      )}

      <Card
        title="商品参数"
        size="small"
        style={{ marginTop: 24 }}
        loading={paramLoading}
      >
        {categoryParams.length > 0 ? (
          <Form
            form={form}
            layout="vertical"
            initialValues={formValuesRef.current}
          >
            <Row gutter={24}>
              {categoryParams.map((param) => (
                <Col span={12} key={param.id}>
                  <Form.Item
                    label={`${param.name} *`}
                    rules={[{ required: true, message: `请输入${param.name}` }]}
                  >
                    <Input
                      placeholder={`请输入${param.name}`}
                      value={productParamValues[param.id] || ''}
                      onChange={(e) => {
                        setProductParamValues({
                          ...productParamValues,
                          [param.id]: e.target.value,
                        });
                      }}
                    />
                  </Form.Item>
                </Col>
              ))}
            </Row>
          </Form>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p>该分类暂无参数模板</p>
          </div>
        )}
      </Card>

      <Card title="商品详情" size="small" style={{ marginTop: 24 }}>
        <TextArea
          placeholder="请输入商品详情"
          value={productDetail}
          onChange={(e) => setProductDetail(e.target.value)}
          rows={20}
          style={{ width: '100%' }}
        />
      </Card>
    </div>
  );

  const renderStep4 = () => (
    <div>
      <Card title="关联专题" size="small" style={{ marginBottom: 24 }}>
        <Transfer
          dataSource={allProducts.map((p) => ({ key: p.id, title: p.name }))}
          titles={['待选择', '已选择']}
          targetKeys={relatedProducts}
          onChange={(targetKeys) => setRelatedProducts(targetKeys.map(Number))}
          render={(item) => item.title}
          listStyle={{ width: 300, height: 300 }}
        />
      </Card>

      <Card title="关联优选" size="small" style={{ marginBottom: 24 }}>
        <Transfer
          dataSource={allProducts.map((p) => ({ key: p.id, title: p.name }))}
          titles={['待选择', '已选择']}
          targetKeys={bundleProducts}
          onChange={(targetKeys) => setBundleProducts(targetKeys.map(Number))}
          render={(item) => item.title}
          listStyle={{ width: 300, height: 300 }}
        />
      </Card>

      <Card title="推荐商品" size="small">
        <Transfer
          dataSource={allProducts.map((p) => ({ key: p.id, title: p.name }))}
          titles={['待选择', '已选择']}
          targetKeys={recommendProducts}
          onChange={(targetKeys) =>
            setRecommendProducts(targetKeys.map(Number))
          }
          render={(item) => item.title}
          listStyle={{ width: 300, height: 300 }}
        />
      </Card>
    </div>
  );

  const steps = [
    { title: '填写商品信息', content: renderStep1() },
    { title: '填写商品促销', content: renderStep2() },
    { title: '填写商品属性', content: renderStep3() },
    { title: '选择商品关联', content: renderStep4() },
  ];

  return (
    <div>
      <Steps current={currentStep} style={{ marginBottom: 40 }}>
        {steps.map((item) => (
          <Step key={item.title} title={item.title} />
        ))}
      </Steps>

      <div style={{ minHeight: 400 }}>{steps[currentStep].content}</div>

      <div style={{ marginTop: 40, textAlign: 'center' }}>
        {currentStep > 0 && (
          <Button
            style={{ marginRight: 8 }}
            onClick={prevStep}
            icon={<LeftOutlined />}
          >
            上一步
          </Button>
        )}
        {currentStep < steps.length - 1 && (
          <Button type="primary" onClick={nextStep} icon={<RightOutlined />}>
            下一步
          </Button>
        )}
        {currentStep === steps.length - 1 && (
          <>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={submitting}
              icon={<CheckOutlined />}
            >
              {product ? '更新商品' : '提交商品'}
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={onCancel}>
              取消
            </Button>
          </>
        )}
      </div>

      {/* 图片预览模态框 */}
      <Modal
        title={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>图片预览</span>
            <Space>
              <Button
                size="small"
                onClick={handleZoomOut}
                disabled={previewScale <= 0.5}
              >
                缩小
              </Button>
              <Button size="small" onClick={handleReset}>
                重置 ({Math.round(previewScale * 100)}%)
              </Button>
              <Button
                size="small"
                onClick={handleZoomIn}
                disabled={previewScale >= 3}
              >
                放大
              </Button>
            </Space>
          </div>
        }
        open={previewVisible}
        onCancel={() => {
          console.log('关闭预览模态框');
          setPreviewVisible(false);
        }}
        footer={null}
        width={800}
        style={{ top: 20 }}
      >
        <div
          style={{
            textAlign: 'center',
            overflow: 'hidden',
            height: '70vh',
            position: 'relative',
            backgroundColor: '#f0f0f0',
            borderRadius: 4,
            cursor:
              previewScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          <img
            src={previewImage}
            alt="预览"
            style={{
              transform: `translate(${previewPosition.x}px, ${previewPosition.y}px) scale(${previewScale})`,
              transformOrigin: 'center center',
              maxWidth: 'none',
              maxHeight: 'none',
              objectFit: 'contain',
              display: 'block',
              margin: '0 auto',
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: -400,
              marginLeft: -400,
              width: 800,
              height: 800,
              pointerEvents: 'none',
            }}
            onLoad={() => console.log('图片加载成功')}
            onError={(e) => {
              console.error('图片加载失败', e);
              console.error('尝试加载的URL:', previewImage);
            }}
          />
        </div>
        <div
          style={{
            marginTop: 16,
            color: '#666',
            textAlign: 'center',
            fontSize: 12,
          }}
        >
          提示：使用鼠标滚轮缩放，放大后可拖动查看细节 | 当前缩放：
          {Math.round(previewScale * 100)}%
        </div>
      </Modal>
    </div>
  );
};

export default ProductForm;
