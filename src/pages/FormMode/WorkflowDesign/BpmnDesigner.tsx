import React, { useEffect, useRef, useState } from 'react';
import BpmnJS from 'bpmn-js/lib/Modeler';
import {
  BpmnPropertiesPanelModule,
  BpmnPropertiesProviderModule,
} from 'bpmn-js-properties-panel';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';
import '@bpmn-io/properties-panel/dist/assets/properties-panel.css';
import { Button, message, Modal, Input, Space } from 'antd';
import { deployDefinition, getBpmn, saveBpmn } from '@/services/workflow';
import { usePageButtons } from '@/hooks/usePageButtons';
import customTranslateModule from './bpmnZh';

/**
 * 流程画布（文档 §7 推荐的设计器画布，基于 bpmn-js）。
 *
 * 能力：调色板拖拽建模、上下文操作、属性面板配置、导入/导出 BPMN 2.0 XML、
 * 保存到后端（解析 userTask 为流程节点）、一键部署到 Flowable 引擎。
 *
 * 约定：BPMN process id 必须等于流程定义 procKey，否则引擎部署会失败——
 * 保存时后端会以画布 process id 校正 def.procKey。
 */
const STARTER_XML = (procKey: string, name: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${procKey}" name="${name}" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
    <bpmn:userTask id="UserTask_1" name="审批节点" />
    <bpmn:endEvent id="EndEvent_1" name="结束" />
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="UserTask_1" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="UserTask_1" targetRef="EndEvent_1" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${procKey}">
      <bpmndi:BPMNShape id="StartEvent_1_di" bpmnElement="StartEvent_1"><dc:Bounds x="160" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="UserTask_1_di" bpmnElement="UserTask_1"><dc:Bounds x="250" y="80" width="100" height="80"/></bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="EndEvent_1_di" bpmnElement="EndEvent_1"><dc:Bounds x="410" y="100" width="36" height="36"/></bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1_di" bpmnElement="Flow_1"><di:waypoint x="196" y="118"/><di:waypoint x="250" y="120"/></bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_2_di" bpmnElement="Flow_2"><di:waypoint x="350" y="120"/><di:waypoint x="410" y="118"/></bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

/**
 * 判断 XML 是否含可展示的 process 或 collaboration。
 * bpmn-js 在两者都不存在时会抛 "no process or collaboration to display"，
 * 这里提前校验，非法/残缺内容一律回退到初始模板，避免画布打不开。
 */
const hasDisplayableContent = (xml: any): boolean =>
  typeof xml === 'string' &&
  xml.trim().length > 0 &&
  (/<(\w+:)?process[\s/>]/.test(xml) || /<(\w+:)?collaboration[\s/>]/.test(xml));

interface BpmnDesignerProps {
  defId?: number;
  procKey?: string;
  name?: string;
  /** 已保存的 BPMN XML（切换定义时传入以重载画布） */
  bpmnXml?: string;
  /** 保存成功后回调（用于刷新节点列表） */
  onSaved?: () => void;
  /** 部署成功后回调（用于刷新定义状态） */
  onDeployed?: () => void;
}

const BpmnDesigner: React.FC<BpmnDesignerProps> = ({
  defId,
  procKey,
  name,
  bpmnXml,
  onSaved,
  onDeployed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportText, setExportText] = useState('');

  // 按钮 code 门禁：画布按钮与设计页同属 workflow_design 菜单，由角色授权
  const { buttons: designButtons } = usePageButtons('workflow_design');
  const hasPerm = (code: string) => designButtons.some((b: any) => b.code === code);

  // 初次挂载：创建 modeler 并载入 XML（已保存 > 模板）
  useEffect(() => {
    if (!containerRef.current || !panelRef.current) return;
    const modeler = new BpmnJS({
      container: containerRef.current,
      propertiesPanel: { parent: panelRef.current },
      additionalModules: [
        BpmnPropertiesPanelModule,
        BpmnPropertiesProviderModule,
        // 放最后：覆盖 bpmn-js 内置的 translate 服务，使画布文案显示中文
        customTranslateModule,
      ],
    });
    modelerRef.current = modeler;
    // 必须是字符串、且含 process/collaboration 才当作已保存的 XML，否则回退到初始模板
    if (bpmnXml && !hasDisplayableContent(bpmnXml)) {
      console.warn('[BpmnDesigner] 已保存的 BPMN 不含 process/collaboration，回退到初始模板：', {
        type: typeof bpmnXml,
        isArray: Array.isArray(bpmnXml),
        value: bpmnXml,
      });
    }
    const xml = hasDisplayableContent(bpmnXml)
      ? (bpmnXml as string)
      : STARTER_XML(procKey || 'Process_1', name || '流程');
    modeler
      .importXML(xml)
      .catch((e: any) => message.error('画布加载失败：' + (e?.message || e)));
    return () => {
      modeler.destroy();
      modelerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换定义：重载画布
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (modelerRef.current && hasDisplayableContent(bpmnXml)) {
      modelerRef.current
        .importXML(bpmnXml as string)
        .catch((e: any) => message.error('画布重载失败：' + (e?.message || e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpmnXml]);

  const handleSave = async () => {
    if (!modelerRef.current || defId == null) {
      message.warning('请先选择流程定义');
      return;
    }
    try {
      const { xml } = await modelerRef.current.saveXML({ format: true });
      const r: any = await saveBpmn(defId, xml);
      if (r?.success) {
        message.success('BPMN 已保存并解析节点');
        onSaved?.();
      } else {
        message.error('保存失败');
      }
    } catch (e: any) {
      message.error('保存失败：' + (e?.message || e));
    }
  };

  const handleExport = async () => {
    if (!modelerRef.current) return;
    const { xml } = await modelerRef.current.saveXML({ format: true });
    setExportText(xml);
    setExportOpen(true);
  };

  const handleImport = async () => {
    if (!modelerRef.current) return;
    try {
      await modelerRef.current.importXML(importText);
      setImportOpen(false);
      message.success('导入成功');
    } catch (e: any) {
      message.error('BPMN 非法：' + (e?.message || e));
    }
  };

  const handleDeploy = () => {
    if (defId == null) return;
    deployDefinition(defId)
      .then((r: any) => {
        if (r?.success) {
          message.success('部署成功');
          onDeployed?.();
        } else {
          message.error('部署失败');
        }
      })
      .catch(() => message.error('部署失败'));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '72vh' }}>
      <Space style={{ marginBottom: 8 }}>
        <Button onClick={() => setImportOpen(true)}>导入XML</Button>
        <Button onClick={handleExport}>导出XML</Button>
        {hasPerm('workflow_design_save_canvas') && (
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        )}
        {hasPerm('workflow_design_deploy') && <Button onClick={handleDeploy}>部署到引擎</Button>}
      </Space>
      <div style={{ display: 'flex', flex: 1, border: '1px solid #d9d9d9', overflow: 'hidden' }}>
        <div ref={containerRef} style={{ flex: 1, height: '100%', background: '#fff' }} />
        <div
          ref={panelRef}
          style={{ width: 320, height: '100%', overflow: 'auto', borderLeft: '1px solid #d9d9d9' }}
        />
      </div>

      <Modal
        title="导入 BPMN"
        open={importOpen}
        onOk={handleImport}
        onCancel={() => setImportOpen(false)}
        width={800}
        destroyOnClose
      >
        <Input.TextArea
          rows={16}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="粘贴 BPMN 2.0 XML"
        />
      </Modal>
      <Modal
        title="导出 BPMN"
        open={exportOpen}
        onCancel={() => setExportOpen(false)}
        footer={null}
        width={800}
      >
        <Input.TextArea readOnly rows={16} value={exportText} />
      </Modal>
    </div>
  );
};

export default BpmnDesigner;
