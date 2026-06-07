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
import type { DocPopupMenu, IDocPopupMenuItem } from '../services/doc-quick-insert-popup.service';
export declare enum QuickInsertMenuGroup {
    Basic = "quick.insert.group.basic",
    Media = "quick.insert.group.media"
}
export declare const textMenu: IDocPopupMenuItem;
export declare const numberedListMenu: IDocPopupMenuItem;
export declare const bulletedListMenu: IDocPopupMenuItem;
export declare const dividerMenu: IDocPopupMenuItem;
export declare const tableMenu: IDocPopupMenuItem;
export declare const imageMenu: IDocPopupMenuItem;
export declare const builtInMenus: DocPopupMenu[];
export declare const builtInMenuCommandIds: Set<string>;
