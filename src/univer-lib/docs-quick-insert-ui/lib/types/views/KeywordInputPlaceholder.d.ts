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
import type { IPopup } from '@univerjs/ui';
export declare const KeywordInputPlaceholderComponentKey = "docs.quick.insert.keyword-input-placeholder";
interface IKeywordInputPlaceholderExtraProps {
    fontSize?: number;
    fontString?: string;
    fontFamily?: string;
    fontStyle?: 'normal' | 'italic';
    fontWeight?: 'normal' | 'bold';
    ascent?: number;
    contentHeight?: number;
}
export declare const KeywordInputPlaceholder: {
    ({ popup }: {
        popup: IPopup<IKeywordInputPlaceholderExtraProps>;
    }): import("react/jsx-runtime").JSX.Element;
    componentKey: string;
};
export {};
