import { SmileOutlined } from '@ant-design/icons';
import { Button, Popover, Tabs, Tooltip } from 'antd';
import { useState } from 'react';

interface Props {
  /** 选中表情后回调（由父组件负责插入到输入框） */
  onSelect: (emoji: string) => void;
}

/** 常用表情（QQ 表情风格） */
const FACES = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '😊', '😇', '🙃', '😉', '😍', '🥰', '😘',
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭',
  '🤫', '🤔', '😐', '😑', '😶', '😏', '😒', '🙄',
  '😬', '😪', '😴', '😷', '🤒', '🤕', '🤢', '🥵',
  '🥶', '😵', '🤠', '🥳', '😎', '🤓', '🧐', '😕',
  '😟', '🙁', '😮', '😲', '🥺', '😢', '😭', '😱',
  '😖', '😞', '😩', '😫', '😤', '😡', '😠', '🤬',
  '😈', '👿', '💀', '💩', '🤡', '👻', '👽', '🤖',
];

/** 手势与符号表情 */
const SYMBOLS = [
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙',
  '👈', '👉', '👆', '👇', '☝️', '✋', '🤚', '🖐️',
  '🖖', '👋', '🤝', '🙏', '💪', '✊', '👊', '🤛',
  '💅', '💃', '🕺', '🏃', '🚶', '🙋', '🙅', '💁',
  '✍️', '🧠', '👀', '👁️', '🦷', '👶', '🧑', '👨',
  '👩', '🎅', '🦸', '🧙', '🧚', '💫', '⭐', '🌟',
  '✨', '⚡', '🔥', '💥', '💦', '💨', '🎉', '🎊',
  '🎁', '🎈', '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🖤', '💔', '💕', '💞', '💓', '💗', '💖', '💯',
];

const CELL_SIZE = 30;

function EmojiGrid({ list, onSelect }: { list: string[]; onSelect: (e: string) => void }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(8, ${CELL_SIZE}px)`,
        gap: 4,
        maxHeight: 220,
        overflow: 'auto',
      }}
    >
      {list.map((emoji) => (
        <Button
          key={emoji}
          type="text"
          onClick={() => onSelect(emoji)}
          style={{
            width: CELL_SIZE,
            height: CELL_SIZE,
            padding: 0,
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          {emoji}
        </Button>
      ))}
    </div>
  );
}

/**
 * 表情选择器：QQ 表情 / 符号表情 两个分组，点选后由父组件插入输入框。
 */
export default function EmojiPicker({ onSelect }: Props) {
  // 受控 open：点选表情后保持面板打开，便于连续插入
  const [open, setOpen] = useState(false);

  const content = (
    <div style={{ width: 8 * CELL_SIZE + 7 * 4 + 8 }}>
      <Tabs
        size="small"
        items={[
          {
            key: 'face',
            label: 'QQ表情',
            children: <EmojiGrid list={FACES} onSelect={onSelect} />,
          },
          {
            key: 'symbol',
            label: '符号表情',
            children: <EmojiGrid list={SYMBOLS} onSelect={onSelect} />,
          },
        ]}
      />
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="topLeft"
      open={open}
      onOpenChange={setOpen}
    >
      <Tooltip title="表情符号">
        <Button type="text" size="small" icon={<SmileOutlined />} />
      </Tooltip>
    </Popover>
  );
}
