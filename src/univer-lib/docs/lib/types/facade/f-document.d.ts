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
import type { DocumentDataModel, IDocumentData } from '@univerjs/core';
import { ICommandService, Injector, IResourceLoaderService, IUniverInstanceService } from '@univerjs/core';
import { FBaseInitialable } from '@univerjs/core/facade';
export interface IDocumentInsertTextFacadeOptions {
    startOffset?: number;
    endOffset?: number;
    segmentId?: string;
    cursorOffset?: number;
}
/**
 * Facade API object bounded to a document. It provides a set of methods to interact with the document.
 * @hideconstructor
 */
export declare class FDocument extends FBaseInitialable {
    private readonly _documentDataModel;
    protected readonly _injector: Injector;
    protected readonly _univerInstanceService: IUniverInstanceService;
    protected readonly _resourceLoaderService: IResourceLoaderService;
    private readonly _commandService;
    readonly id: string;
    constructor(_documentDataModel: DocumentDataModel, _injector: Injector, _univerInstanceService: IUniverInstanceService, _resourceLoaderService: IResourceLoaderService, _commandService: ICommandService);
    /**
     * Get the document data model of the document.
     * @returns {DocumentDataModel} The document data model.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * const documentDataModel = fDocument.getDocumentDataModel();
     * console.log(documentDataModel);
     * ```
     */
    getDocumentDataModel(): DocumentDataModel;
    dispose(): void;
    /**
     * Get the document id.
     * @returns {string} The document id.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * const unitId = fDocument.getId();
     * console.log(unitId);
     * ```
     */
    getId(): string;
    /**
     * Get the document name.
     * @returns {string} The document name.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * const name = fDocument.getName();
     * console.log(name);
     * ```
     */
    getName(): string;
    /**
     * Save the document snapshot data, including the document content and resource data, etc.
     * @returns {IDocumentData} The document snapshot data.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * const snapshot = fDocument.save();
     * console.log(snapshot);
     * ```
     */
    save(): IDocumentData;
    /**
     * Undo the last operation in the document.
     * @returns {Promise<boolean>} A promise that resolves to true if the undo operation was successful, or false if it failed.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * await fDocument.undo();
     * ```
     */
    undo(): Promise<boolean>;
    /**
     * Redo the last undone operation in the document.
     * @returns {Promise<boolean>} A promise that resolves to true if the redo operation was successful, or false if it failed.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * await fDocument.redo();
     * ```
     */
    redo(): Promise<boolean>;
    /**
     * Adds the specified text to the end of this text region.
     * @param {string} text - The text to be added to the end of this text region.
     * @return {Promise<boolean>} A promise that resolves to true if the text was successfully appended, or false if it failed.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * await fDocument.appendText('Hello, world!');
     * ```
     */
    appendText(text: string): Promise<boolean>;
    /**
     * Inserts text at the provided document range. Defaults to appending before the final section break.
     * @param {string} text - The text to insert.
     * @param {IDocumentInsertTextFacadeOptions} options - Optional target range, segment id, and cursor offset.
     * @returns {Promise<boolean>} A promise that resolves to true if the text was successfully inserted, or false if it failed.
     * @example
     *
     * // Insert text at a specific range in the document body
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * await fDocument.insertText('Hello, world!', {
     *   startOffset: 5,
     *   endOffset: 5,
     *   segmentId: '',
     *   cursorOffset: 13,
     * });
     * ```
     *
     * // Insert text at the beginning of a header or footer segment
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * const snapshot = fDocument.save();
     * const { headers, footers } = snapshot;
     *
     * if (headers) {
     *   for (const headerId in headers) {
     *     if (headerId === 'target-header-id') {
     *       await fDocument.insertText('Hello, header!', {
     *         startOffset: 0,
     *         endOffset: 0,
     *         segmentId: headerId,
     *       });
     *     }
     *   }
     * }
     *
     * if (footers) {
     *   for (const footerId in footers) {
     *     if (footerId === 'target-footer-id') {
     *       await fDocument.insertText('Hello, footer!', {
     *         startOffset: 0,
     *         endOffset: 0,
     *         segmentId: footerId,
     *       });
     *     }
     *   }
     * }
     * ```
     */
    insertText(text: string, options?: IDocumentInsertTextFacadeOptions): Promise<boolean>;
    /**
     * Inserts one or more plain-text paragraphs at the provided document range.
     * @param {string} text - The paragraph text to insert. Newlines are normalized to document paragraph separators.
     * @param {IDocumentInsertTextFacadeOptions} options - Optional target range, segment id, and cursor offset.
     * @returns {Promise<boolean>} A promise that resolves to true if the paragraphs were successfully inserted, or false if it failed.
     * @example
     * ```typescript
     * const fDocument = univerAPI.getActiveDocument();
     * await fDocument.insertParagraph('Hello, world! This is a new paragraph.', {
     *   startOffset: 5,
     *   endOffset: 5,
     * });
     * ```
     */
    insertParagraph(text?: string, options?: IDocumentInsertTextFacadeOptions): Promise<boolean>;
}
