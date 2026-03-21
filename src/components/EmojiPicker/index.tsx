import React, { useState, useMemo } from 'react';
import { Popover, Input, Button, Row, Col, Tag, Space } from 'antd';

interface EmojiPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

const emojiCategories = {
  faces: {
    name: '表情',
    emojis: [
      '😊',
      '😃',
      '😄',
      '😁',
      '😆',
      '😅',
      '😂',
      '🤣',
      '😍',
      '😘',
      '🥰',
      '😗',
      '😙',
      '😚',
      '😋',
      '😛',
      '😝',
      '😜',
      '🤪',
      '🤨',
      '🧐',
      '🤓',
      '😎',
      '🤩',
      '🥳',
      '😏',
      '😒',
      '😞',
      '😔',
      '😟',
      '😕',
      '🙁',
      '☹️',
      '😣',
      '😖',
      '😫',
      '😩',
      '🥺',
      '😢',
      '😓',
      '🤗',
      '🤔',
      '🤭',
      '🤫',
      '🤥',
      '😶',
      '😐',
      '😑',
      '😬',
      '🙄',
      '😯',
      '😦',
      '😧',
      '😮',
      '😲',
      '🥱',
      '😴',
      '🤤',
      '😪',
      '😵',
      '🤐',
      '🥴',
      '🤢',
      '🤮',
      '🤧',
      '🥵',
      '🥶',
    ],
  },
  objects: {
    name: '物品',
    emojis: [
      '💻',
      '📱',
      '📞',
      '📟',
      '📠',
      '💽',
      '💾',
      '💿',
      '📀',
      '📼',
      '📷',
      '📸',
      '📹',
      '📺',
      '📻',
      '🔇',
      '🔈',
      '🔉',
      '🔊',
      '🎵',
      '🎶',
      '🎼',
      '🎧',
      '📡',
      '💡',
      '🔦',
      '🏮',
      '🕯️',
      '📔',
      '📕',
      '📖',
      '📗',
      '📘',
      '📙',
      '📚',
      '📓',
      '📃',
      '📜',
      '📄',
      '📰',
    ],
  },
  food: {
    name: '食物',
    emojis: [
      '🍽️',
      '🍇',
      '🍈',
      '🍉',
      '🍊',
      '🍋',
      '🍌',
      '🍍',
      '🍎',
      '🍏',
      '🍐',
      '🍑',
      '🍒',
      '🍓',
      '🥝',
      '🍅',
      '🥥',
      '🥑',
      '🍆',
      '🥔',
      '🥕',
      '🌽',
      '🥒',
      '🥦',
      '🥬',
      '🥜',
      '🌰',
      '🍞',
      '🥐',
      '🥨',
      '🥖',
      '🍕',
      '🌭',
      '🍔',
      '🥙',
      '🧆',
      '🌮',
      '🌯',
      '🥗',
      '🥘',
    ],
  },
  activities: {
    name: '活动',
    emojis: [
      '⚽',
      '🏀',
      '🏈',
      '⚾',
      '🥎',
      '🏐',
      '🏉',
      '🥏',
      '🎾',
      '🥍',
      '🏏',
      '🏑',
      '🥅',
      '🏒',
      '🥊',
      '🥋',
      '⛳',
      '⛸️',
      '🎣',
      '🤿',
      '🎽',
      '🎿',
      '⛷️',
      '🏂',
      '🏋️',
      '🚴',
      '🧗',
      '🤺',
      '🏌️',
      '🏇',
      '🚣',
      '🏊',
      '🤸',
      '🤼',
      '🤹',
      '🎪',
      '🎭',
      '🎨',
      '🎬',
      '🎤',
    ],
  },
  travel: {
    name: '旅行',
    emojis: [
      '🚗',
      '🚕',
      '🚙',
      '🚌',
      '🚎',
      '🏎️',
      '🚓',
      '🚑',
      '🚒',
      '🚐',
      '🚚',
      '🚛',
      '🚜',
      '🏍️',
      '🛵',
      '🚲',
      '🛴',
      '🛹',
      '🚏',
      '🛣️',
      '🛤️',
      '🚧',
      '🚥',
      '🚦',
      '⚓',
      '⛵',
      '🚤',
      '🛳️',
      '🚢',
      '✈️',
      '💺',
      '🛩️',
      '🛫',
      '🛬',
      '🪂',
      '🎡',
      '🎢',
      '🎠',
    ],
  },
  symbols: {
    name: '符号',
    emojis: [
      '❤️',
      '🧡',
      '💛',
      '💚',
      '💙',
      '💜',
      '🖤',
      '💔',
      '❣️',
      '💕',
      '💞',
      '💓',
      '💗',
      '💖',
      '💘',
      '💝',
      '💟',
      '💌',
      '💣',
      '🔪',
      '💊',
      '💉',
      '🔫',
      '🚬',
      '🚭',
      '💢',
      '💥',
      '💫',
      '💦',
      '💨',
      '🕳️',
      '💬',
      '💭',
      '💤',
      '💯',
      '👍',
      '👎',
      '👌',
      '✌️',
      '🤞',
    ],
  },
  baby: {
    name: '母婴玩具',
    emojis: ['👶'],
  },
  books: {
    name: '图书文具',
    emojis: ['📚'],
  },
  sports: {
    name: '运动户外',
    emojis: ['💪'],
  },
  beauty: {
    name: '美妆护肤',
    emojis: ['💎'],
  },
  home: {
    name: '家居生活',
    emojis: ['🏠'],
  },
  fashion: {
    name: '服装鞋包',
    emojis: ['👕'],
  },
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  value,
  onChange,
  placeholder = '选择图标',
}) => {
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('faces');
  const [popoverVisible, setPopoverVisible] = useState(false);

  const filteredEmojis = useMemo(() => {
    if (!searchText) {
      return emojiCategories[selectedCategory as keyof typeof emojiCategories]
        .emojis;
    }
    return Object.values(emojiCategories)
      .flatMap((category) => category.emojis)
      .filter((emoji) => emoji.includes(searchText));
  }, [searchText, selectedCategory]);

  const handleEmojiSelect = (emoji: string) => {
    onChange?.(emoji);
    setPopoverVisible(false);
  };

  const handleClear = () => {
    onChange?.('');
  };

  const content = (
    <div style={{ width: '350px', padding: '16px' }}>
      <Input
        placeholder="搜索emoji..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: '16px' }}
      />

      <Space wrap style={{ marginBottom: '16px' }}>
        {Object.entries(emojiCategories).map(([key, category]) => (
          <Tag
            key={key}
            color={selectedCategory === key ? 'blue' : 'default'}
            onClick={() => setSelectedCategory(key)}
            style={{ cursor: 'pointer' }}
          >
            {category.name}
          </Tag>
        ))}
      </Space>

      <div style={{ maxHeight: '300px', overflowY: 'auto', marginTop: '8px' }}>
        <Row gutter={[8, 8]}>
          {filteredEmojis.map((emoji, index) => (
            <Col key={index} span={4}>
              <Button
                type="text"
                style={{
                  fontSize: '24px',
                  width: '100%',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  borderRadius: '4px',
                  transition: 'background-color 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => handleEmojiSelect(emoji)}
              >
                {emoji}
              </Button>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      title="选择表情图标"
      trigger="click"
      open={popoverVisible}
      onOpenChange={setPopoverVisible}
      placement="bottom"
    >
      <Space style={{ width: '100%' }}>
        <Button
          type="default"
          style={{
            width: '100%',
            textAlign: 'left',
            paddingLeft: '16px',
            paddingRight: '16px',
          }}
        >
          {value ? (
            <Space>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>
                {value}
              </span>
              <span>{value}</span>
            </Space>
          ) : (
            placeholder
          )}
        </Button>
        {value && (
          <Button danger size="small" onClick={handleClear}>
            清除
          </Button>
        )}
      </Space>
    </Popover>
  );
};

export default EmojiPicker;
