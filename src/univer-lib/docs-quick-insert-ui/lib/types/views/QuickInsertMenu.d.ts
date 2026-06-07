/**
 * Copyright 2023-present DreamNum Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type { ComponentManager } from '@univerjs/ui';
import type { MutableRefObject } from 'react';
import type { DocPopupMenu, IDocPopupMenuItem } from '../services/doc-quick-insert-popup.service';
interface IQuickInsertMenuProps {
    menus: DocPopupMenu[];
    focusedMenuIndex: number;
    focusedMenuRef: MutableRefObject<IDocPopupMenuItem | null>;
    menuNodeMapRef: MutableRefObject<Map<string, HTMLElement>>;
    componentManager: ComponentManager;
    onFocusedMenuIndexChange: (index: number) => void;
    onSelect: (menu: IDocPopupMenuItem) => void;
}
export declare function getQuickInsertMenuLeafCount(menus: DocPopupMenu[]): number;
export declare function QuickInsertMenu(props: IQuickInsertMenuProps): import("react/jsx-runtime").JSX.Element;
export {};
