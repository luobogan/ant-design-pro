import { Card, message } from 'antd';
import React, { useEffect, useState } from 'react';
import { Editor } from 'react-draft-wysiwyg';
import 'react-draft-wysiwyg/dist/react-draft-wysiwyg.css';
import { ContentState, convertToRaw, EditorState } from 'draft-js';
import draftToHtml from 'draftjs-to-html';
import htmlToDraft from 'html-to-draftjs';

interface RichTextEditorProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  height?: number;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  placeholder = '请输入内容',
  value,
  onChange,
  height = 300,
}) => {
  const [editorState, setEditorState] = useState(() => {
    if (value) {
      const contentBlock = htmlToDraft(value);
      if (contentBlock) {
        const contentState = ContentState.createFromBlockArray(
          contentBlock.contentBlocks,
        );
        return EditorState.createWithContent(contentState);
      }
    }
    return EditorState.createEmpty();
  });

  useEffect(() => {
    if (value) {
      const contentBlock = htmlToDraft(value);
      if (contentBlock) {
        const contentState = ContentState.createFromBlockArray(
          contentBlock.contentBlocks,
        );
        setEditorState(EditorState.createWithContent(contentState));
      }
    } else {
      setEditorState(EditorState.createEmpty());
    }
  }, [value]);

  const handleEditorStateChange = (newEditorState: EditorState) => {
    setEditorState(newEditorState);
    const contentState = newEditorState.getCurrentContent();
    const html = draftToHtml(convertToRaw(contentState));
    onChange(html);
  };

  return (
    <Card bordered={false} style={{ marginBottom: 0 }}>
      <Editor
        editorState={editorState}
        onEditorStateChange={handleEditorStateChange}
        placeholder={placeholder}
        wrapperStyle={{
          height: height,
          border: '1px solid #f0f0f0',
          borderRadius: 4,
        }}
        editorStyle={{
          height: height - 100,
          padding: '0 10px',
          overflow: 'auto',
        }}
        toolbar={{}}
        // 可以根据需要配置工具栏
      />
    </Card>
  );
};

export default RichTextEditor;
