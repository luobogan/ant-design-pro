import React, { useState, useEffect } from 'react';
import {
  Modal,
  Image,
  Spin,
  Button,
  Space,
  message,
  Tag,
  Typography,
  Card,
  Row,
  Col,
  Empty,
  Tooltip,
} from 'antd';
import {
  DownloadOutlined,
  EyeOutlined,
  FileImageOutlined,
  LoadingOutlined,
  ZoomInOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import JSZip from 'jszip';

const { Text, Title } = Typography;

export interface ZipImageInfo {
  id: number;
  filename: string;
  url: string;
  filesize: number;
  filetype: string;
  iszip: number;
  encrypt: boolean;
}

interface ZipImagePreviewProps {
  visible: boolean;
  imageInfo: ZipImageInfo | null;
  onClose: () => void;
}

interface ExtractedImage {
  name: string;
  dataUrl: string;
  size: number;
  type: string;
}

const ZipImagePreview: React.FC<ZipImagePreviewProps> = ({
  visible,
  imageInfo,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && imageInfo) {
      loadAndExtractImages();
    } else {
      setImages([]);
      setError(null);
      setLoading(false);
    }
  }, [visible, imageInfo]);

  const loadAndExtractImages = async () => {
    if (!imageInfo) return;

    setLoading(true);
    setError(null);
    setImages([]);

    try {
      const token = localStorage.getItem('sword-token') || '';
      const response = await fetch(imageInfo.url, {
        method: 'GET',
        headers: {
          Authorization: `Basic c2FiZXI6c2FiZXJfc2VjcmV0`,
          'Blade-Auth': `bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();

      if (imageInfo.iszip === 1 || imageInfo.url.endsWith('.zip')) {
        await extractZipImages(blob);
      } else {
        await displaySingleImage(blob);
      }
    } catch (err: any) {
      console.error('加载图片失败:', err);
      setError(err.message || '加载图片失败，请重试');
      message.error('加载图片失败');
    } finally {
      setLoading(false);
    }
  };

  const extractZipImages = async (blob: Blob) => {
    try {
      const zip = await JSZip.loadAsync(blob);
      const extractedImages: ExtractedImage[] = [];

      const filePromises = Object.keys(zip.files).map(async (filename) => {
        const file = zip.files[filename];
        
        if (!file.dir && isImageFile(filename)) {
          try {
            const imageData = await file.async('base64');
            const mimeType = getMimeType(filename);
            const dataUrl = `data:${mimeType};base64,${imageData}`;
            
            extractedImages.push({
              name: filename.split('/').pop() || filename,
              dataUrl,
              size: imageData.length,
              type: mimeType,
            });
          } catch (err) {
            console.warn(`解压文件 ${filename} 失败:`, err);
          }
        }
      });

      await Promise.all(filePromises);

      if (extractedImages.length === 0) {
        setError('ZIP 文件中没有找到图片');
      } else {
        setImages(extractedImages);
      }
    } catch (err: any) {
      console.error('解压ZIP文件失败:', err);
      setError('解压ZIP文件失败：' + (err.message || '未知错误'));
    }
  };

  const displaySingleImage = async (blob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const filename = imageInfo?.filename || 'image.jpg';
      
      setImages([{
        name: filename,
        dataUrl,
        size: blob.size,
        type: blob.type || 'image/jpeg',
      }]);
    };
    reader.onerror = () => {
      setError('读取图片失败');
    };
    reader.readAsDataURL(blob);
  };

  const isImageFile = (filename: string): boolean => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  };

  const getMimeType = (filename: string): string => {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return mimeTypes[ext] || 'image/jpeg';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const handleDownload = (image: ExtractedImage, index: number) => {
    const link = document.createElement('a');
    link.href = image.dataUrl;
    link.download = image.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success(`已下载: ${image.name}`);
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < images.length; i++) {
      handleDownload(images[i], i);
      if (i < images.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    message.success(`共下载 ${images.length} 张图片`);
  };

  const handlePreview = (index: number) => {
    setCurrentImageIndex(index);
    setPreviewVisible(true);
  };

  return (
    <>
      <Modal
        title={
          <Space>
            <FileImageOutlined />
            <span>图片预览 - {imageInfo?.filename || '未知文件'}</span>
            {imageInfo?.iszip === 1 && (
              <Tag color="blue">ZIP压缩</Tag>
            )}
          </Space>
        }
        open={visible}
        onCancel={onClose}
        width={900}
        footer={[
          <Button key="close" onClick={onClose}>
            关闭
          </Button>,
          images.length > 1 && (
            <Button
              key="download-all"
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadAll}
            >
              全部下载 ({images.length}张)
            </Button>
          ),
        ]}
      >
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
            flexDirection: 'column',
            gap: 16,
          }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <Text type="secondary">
              {imageInfo?.iszip === 1 ? '正在解压 ZIP 文件...' : '正在加载图片...'}
            </Text>
          </div>
        ) : error ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 400,
            flexDirection: 'column',
            gap: 16,
          }}>
            <Empty
              description={
                <Space direction="vertical" align="center">
                  <Text type="danger">{error}</Text>
                  <Button type="link" onClick={loadAndExtractImages}>
                    重试
                  </Button>
                </Space>
              }
            />
          </div>
        ) : images.length === 0 ? (
          <Empty description="暂无图片" />
        ) : (
          <div>
            {imageInfo && (
              <Card
                size="small"
                style={{ marginBottom: 16 }}
                title={
                  <Space>
                    <InfoCircleOutlined />
                    <span>文件信息</span>
                  </Space>
                }
              >
                <Row gutter={[16, 8]}>
                  <Col span={8}>
                    <Text type="secondary">文件名：</Text>
                    <Text strong>{imageInfo.filename}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">大小：</Text>
                    <Text strong>{formatFileSize(imageInfo.filesize)}</Text>
                  </Col>
                  <Col span={8}>
                    <Text type="secondary">类型：</Text>
                    <Text strong>{imageInfo.filetype}</Text>
                  </Col>
                  {imageInfo.iszip === 1 && (
                    <Col span={8}>
                      <Text type="secondary">包含图片：</Text>
                      <Text strong>{images.length} 张</Text>
                    </Col>
                  )}
                  {imageInfo.encrypt && (
                    <Col span={8}>
                      <Tag color="orange">已加密</Tag>
                    </Col>
                  )}
                </Row>
              </Card>
            )}

            <Row gutter={[16, 16]}>
              {images.map((image, index) => (
                <Col key={index} xs={24} sm={12} md={8} lg={6}>
                  <Card
                    hoverable
                    cover={
                      <div
                        style={{
                          height: 200,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                        }}
                        onClick={() => handlePreview(index)}
                      >
                        <img
                          src={image.dataUrl}
                          alt={image.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            transition: 'transform 0.3s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            background: 'rgba(0, 0, 0, 0.6)',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <ZoomInOutlined />
                          预览
                        </div>
                      </div>
                    }
                    actions={[
                      <Tooltip title="预览" key="preview">
                        <EyeOutlined onClick={() => handlePreview(index)} />
                      </Tooltip>,
                      <Tooltip title="下载" key="download">
                        <DownloadOutlined
                          onClick={() => handleDownload(image, index)}
                        />
                      </Tooltip>,
                    ]}
                  >
                    <Card.Meta
                      title={
                        <Tooltip title={image.name}>
                          <Text
                            ellipsis={{ tooltip: true }}
                            style={{ maxWidth: '100%' }}
                          >
                            {image.name}
                          </Text>
                        </Tooltip>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {formatFileSize(image.size)}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {image.type.split('/')[1]?.toUpperCase()}
                          </Text>
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}
      </Modal>

      <Image.PreviewGroup
        preview={{
          visible: previewVisible,
          onVisibleChange: (vis) => setPreviewVisible(vis),
          current: currentImageIndex,
        }}
      >
        {images.map((image, index) => (
          <div key={index} style={{ display: 'none' }}>
            <Image src={image.dataUrl} alt={image.name} />
          </div>
        ))}
      </Image.PreviewGroup>
    </>
  );
};

export default ZipImagePreview;
