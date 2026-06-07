Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
let _univerjs_core = require("@univerjs/core");
let _univerjs_docs = require("@univerjs/docs");
let _univerjs_docs_ui = require("@univerjs/docs-ui");
let _univerjs_ui = require("@univerjs/ui");
let _univerjs_engine_render = require("@univerjs/engine-render");
let rxjs = require("rxjs");
let react = require("react");
let react_jsx_runtime = require("react/jsx-runtime");
let _univerjs_design = require("@univerjs/design");
let _univerjs_docs_drawing_ui = require("@univerjs/docs-drawing-ui");
let _univerjs_icons = require("@univerjs/icons");
let _univerjs_docs_drawing = require("@univerjs/docs-drawing");
let _univerjs_drawing = require("@univerjs/drawing");
let _univerjs_drawing_ui = require("@univerjs/drawing-ui");

//#region src/commands/commands/doc-quick-insert.command.ts
const DeleteSearchKeyCommand = {
	id: "doc.command.delete-search-key",
	type: _univerjs_core.CommandType.COMMAND,
	handler: (accessor, params) => {
		const commandService = accessor.get(_univerjs_core.ICommandService);
		const { start, end } = params;
		return commandService.syncExecuteCommand(_univerjs_docs_ui.CutContentCommand.id, {
			segmentId: "",
			textRanges: [{
				startOffset: start,
				endOffset: start,
				collapsed: true
			}],
			selections: [{
				startOffset: start,
				endOffset: end,
				collapsed: false,
				direction: _univerjs_core.RANGE_DIRECTION.FORWARD
			}]
		});
	}
};

//#endregion
//#region src/views/KeywordInputPlaceholder.tsx
const KeywordInputPlaceholderComponentKey = "docs.quick.insert.keyword-input-placeholder";
const DEFAULT_FONT_SIZE = 11;
function measureTextWidth(text, font) {
	if (typeof document === "undefined") return text.length * DEFAULT_FONT_SIZE;
	const context = document.createElement("canvas").getContext("2d");
	if (!context) return text.length * DEFAULT_FONT_SIZE;
	context.font = font;
	return Math.ceil(context.measureText(text).width);
}
const KeywordInputPlaceholder = ({ popup }) => {
	var _popup$extraProps$fon, _popup$extraProps, _popup$extraProps$fon2, _popup$extraProps2, _popup$extraProps$asc, _popup$extraProps3, _popup$extraProps$con, _popup$extraProps4, _popup$extraProps5, _popup$extraProps6, _popup$extraProps7;
	const placeholder = (0, _univerjs_ui.useDependency)(_univerjs_core.LocaleService).t("docs-quick-insert-ui.keywordInputPlaceholder");
	const fontSizePx = (0, _univerjs_engine_render.ptToPixel)((_popup$extraProps$fon = (_popup$extraProps = popup.extraProps) === null || _popup$extraProps === void 0 ? void 0 : _popup$extraProps.fontSize) !== null && _popup$extraProps$fon !== void 0 ? _popup$extraProps$fon : DEFAULT_FONT_SIZE);
	const fontString = (_popup$extraProps$fon2 = (_popup$extraProps2 = popup.extraProps) === null || _popup$extraProps2 === void 0 ? void 0 : _popup$extraProps2.fontString) !== null && _popup$extraProps$fon2 !== void 0 ? _popup$extraProps$fon2 : `${fontSizePx}px sans-serif`;
	const ascent = (_popup$extraProps$asc = (_popup$extraProps3 = popup.extraProps) === null || _popup$extraProps3 === void 0 ? void 0 : _popup$extraProps3.ascent) !== null && _popup$extraProps$asc !== void 0 ? _popup$extraProps$asc : fontSizePx;
	const contentHeight = Math.max((_popup$extraProps$con = (_popup$extraProps4 = popup.extraProps) === null || _popup$extraProps4 === void 0 ? void 0 : _popup$extraProps4.contentHeight) !== null && _popup$extraProps$con !== void 0 ? _popup$extraProps$con : fontSizePx, fontSizePx);
	const textWidth = (0, react.useMemo)(() => measureTextWidth(placeholder, fontString), [fontString, placeholder]);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "univer-select-none univer-font-normal univer-text-gray-500 univer-transition-colors dark:!univer-text-gray-400",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: textWidth,
			height: contentHeight,
			viewBox: `0 0 ${textWidth} ${contentHeight}`,
			style: {
				overflow: "visible",
				display: "block"
			},
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
				x: 0,
				y: ascent,
				fill: "currentColor",
				style: {
					font: fontString,
					fontFamily: (_popup$extraProps5 = popup.extraProps) === null || _popup$extraProps5 === void 0 ? void 0 : _popup$extraProps5.fontFamily,
					fontStyle: (_popup$extraProps6 = popup.extraProps) === null || _popup$extraProps6 === void 0 ? void 0 : _popup$extraProps6.fontStyle,
					fontWeight: (_popup$extraProps7 = popup.extraProps) === null || _popup$extraProps7 === void 0 ? void 0 : _popup$extraProps7.fontWeight
				},
				children: placeholder
			})
		})
	});
};
KeywordInputPlaceholder.componentKey = KeywordInputPlaceholderComponentKey;

//#endregion
//#region src/views/QuickInsertMenu.tsx
function isMenuGroup(menu) {
	return "children" in menu;
}
function flattenMenuItems(menus) {
	return menus.flatMap((menu) => {
		if (isMenuGroup(menu)) return flattenMenuItems(menu.children);
		return menu;
	});
}
function getQuickInsertMenuLeafCount(menus) {
	return flattenMenuItems(menus).length;
}
function QuickInsertMenu(props) {
	const { menus, focusedMenuIndex, focusedMenuRef, menuNodeMapRef, componentManager, onFocusedMenuIndexChange, onSelect } = props;
	const flatMenus = (0, react.useMemo)(() => flattenMenuItems(menus), [menus]);
	(0, react.useEffect)(() => {
		var _flatMenus$focusedMen, _menuNodeMapRef$curre;
		const focusedMenu = Number.isNaN(focusedMenuIndex) ? null : (_flatMenus$focusedMen = flatMenus[focusedMenuIndex]) !== null && _flatMenus$focusedMen !== void 0 ? _flatMenus$focusedMen : null;
		focusedMenuRef.current = focusedMenu;
		if (!focusedMenu) return;
		(_menuNodeMapRef$curre = menuNodeMapRef.current.get(focusedMenu.id)) === null || _menuNodeMapRef$curre === void 0 || _menuNodeMapRef$curre.scrollIntoView({ block: "nearest" });
	}, [
		flatMenus,
		focusedMenuIndex,
		focusedMenuRef,
		menuNodeMapRef
	]);
	const itemIndexRef = (0, react.useRef)(0);
	itemIndexRef.current = 0;
	function renderMenus(currentMenus) {
		return currentMenus.map((menu, index) => {
			const iconKey = menu.icon;
			const Icon = iconKey ? componentManager.get(iconKey) : null;
			if (isMenuGroup(menu)) return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: (0, _univerjs_design.clsx)("univer-grid univer-gap-1 univer-py-1", index !== currentMenus.length - 1 && _univerjs_design.borderBottomClassName),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "univer-box-border univer-inline-flex univer-items-center univer-gap-2 univer-px-2 univer-text-xs univer-font-semibold univer-text-gray-600 dark:!univer-text-gray-300",
					children: [Icon && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "univer-inline-flex univer-text-base",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: menu.title })]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "univer-grid univer-gap-1",
					children: renderMenus(menu.children)
				})]
			}, menu.id);
			const currentMenuIndex = itemIndexRef.current;
			const isFocused = focusedMenuIndex === currentMenuIndex;
			itemIndexRef.current += 1;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: (node) => {
					if (node) {
						menuNodeMapRef.current.set(menu.id, node);
						return;
					}
					menuNodeMapRef.current.delete(menu.id);
				},
				role: "button",
				tabIndex: -1,
				className: (0, _univerjs_design.clsx)("univer-relative univer-box-border univer-flex univer-min-h-8 univer-w-full univer-cursor-pointer univer-items-center univer-justify-between univer-gap-3 univer-rounded-md univer-border-none univer-bg-transparent univer-px-2 univer-text-left univer-text-sm univer-text-gray-900 univer-outline-none hover:univer-bg-gray-50 dark:!univer-text-white dark:hover:!univer-bg-gray-600", {
					"hover:univer-bg-transparent": !isFocused,
					"univer-bg-gray-50 dark:!univer-bg-gray-600": isFocused
				}),
				onMouseEnter: () => onFocusedMenuIndexChange(currentMenuIndex),
				onMouseLeave: () => onFocusedMenuIndexChange(NaN),
				onClick: () => onSelect(menu),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "univer-inline-flex univer-w-full univer-items-center univer-gap-2",
					children: [Icon && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "univer-inline-flex univer-text-base",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {})
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_univerjs_design.Tooltip, {
						showIfEllipsis: true,
						title: menu.title,
						placement: "right",
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "univer-truncate",
							children: menu.title
						})
					})]
				})
			}, menu.id);
		});
	}
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: (0, _univerjs_design.clsx)("univer-box-border univer-grid univer-max-h-[360px] univer-gap-1 univer-overflow-y-auto univer-overflow-x-hidden univer-overscroll-contain univer-rounded-md univer-bg-white univer-px-2 univer-py-1 univer-text-sm univer-text-gray-900 univer-shadow-md dark:!univer-bg-gray-700 dark:!univer-text-white", _univerjs_design.borderClassName, _univerjs_design.scrollbarClassName),
		onWheel: (event) => event.stopPropagation(),
		children: renderMenus(menus)
	});
}

//#endregion
//#region src/views/QuickInsertPlaceholder.tsx
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
const QuickInsertPlaceholderComponentKey = "docs.quick.insert.placeholder";
const QuickInsertPlaceholder = () => {
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "univer-flex univer-h-full univer-items-center univer-justify-center univer-rounded-lg univer-bg-white univer-px-12 univer-py-6 univer-text-gray-400 univer-shadow-lg",
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: (0, _univerjs_ui.useDependency)(_univerjs_core.LocaleService).t("docs-quick-insert-ui.placeholder") })
	});
};
QuickInsertPlaceholder.componentKey = QuickInsertPlaceholderComponentKey;

//#endregion
//#region src/views/QuickInsertPopup.tsx
function filterMenusByKeyword(menus, keyword) {
	return menus.map((menu) => ({ ...menu })).filter((menu) => {
		if ("children" in menu) {
			menu.children = filterMenusByKeyword(menu.children, keyword);
			return menu.children.length > 0;
		}
		const keywords = menu.keywords;
		if (keywords) return keywords.some((word) => word.includes(keyword));
		return menu.title.toLowerCase().includes(keyword);
	});
}
function translateMenus(menus, localeService) {
	return menus.map((_menu) => {
		const menu = { ..._menu };
		if ("children" in menu) menu.children = translateMenus(menu.children, localeService);
		menu.title = localeService.t(menu.title);
		if ("keywords" in menu) menu.keywords = menu.keywords.concat(menu.title).map((word) => word.toLowerCase());
		return menu;
	});
}
const interceptKeys = [
	_univerjs_ui.KeyCode.ARROW_UP,
	_univerjs_ui.KeyCode.ARROW_DOWN,
	_univerjs_ui.KeyCode.ENTER
];
const QuickInsertPopup = () => {
	const localeService = (0, _univerjs_ui.useDependency)(_univerjs_core.LocaleService);
	const docQuickInsertPopupService = (0, _univerjs_ui.useDependency)(DocQuickInsertPopupService);
	const componentManager = (0, _univerjs_ui.useDependency)(_univerjs_ui.ComponentManager);
	const shortcutService = (0, _univerjs_ui.useDependency)(_univerjs_ui.IShortcutService);
	const commandService = (0, _univerjs_ui.useDependency)(_univerjs_core.ICommandService);
	const id = (0, react.useMemo)(() => (0, _univerjs_core.generateRandomId)(), []);
	const [focusedMenuIndex, setFocusedMenuIndex] = (0, react.useState)(0);
	const focusedMenuRef = (0, react.useRef)(null);
	const filterKeyword = (0, _univerjs_ui.useObservable)(docQuickInsertPopupService.filterKeyword$, "");
	const currentPopup = (0, _univerjs_ui.useObservable)(docQuickInsertPopupService.editPopup$);
	const menus = (0, _univerjs_ui.useObservable)(currentPopup === null || currentPopup === void 0 ? void 0 : currentPopup.popup.menus$, []);
	const translatedMenus = (0, react.useMemo)(() => {
		return translateMenus(menus, localeService);
	}, [menus]);
	const [filteredMenus, setFilteredMenus] = (0, react.useState)(() => {
		return filterMenusByKeyword(translatedMenus, filterKeyword.toLowerCase());
	});
	const filteredMenuCount = (0, react.useMemo)(() => getQuickInsertMenuLeafCount(filteredMenus), [filteredMenus]);
	const filteredMenuCountRef = (0, react.useRef)(filteredMenuCount);
	(0, react.useEffect)(() => {
		filteredMenuCountRef.current = filteredMenuCount;
	}, [filteredMenuCount]);
	(0, react.useEffect)(() => {
		const id = requestIdleCallback(() => {
			setFilteredMenus(filterMenusByKeyword(translatedMenus, filterKeyword.toLowerCase()));
		});
		return () => {
			cancelIdleCallback(id);
		};
	}, [translatedMenus, filterKeyword]);
	const handleMenuSelect = (menu) => {
		docQuickInsertPopupService.emitMenuSelected(menu);
		commandService.executeCommand(CloseQuickInsertPopupOperation.id);
	};
	(0, react.useEffect)(() => {
		/** Use up or down to navigate the focused menu instead of moving the cursor in documents. */
		const disposableCollection = new _univerjs_core.DisposableCollection();
		shortcutService.getAllShortcuts().filter((item) => item.binding && interceptKeys.includes(item.binding)).forEach((item) => {
			const rawPreconditions = item.preconditions;
			item.preconditions = () => false;
			disposableCollection.add((0, _univerjs_core.toDisposable)(() => {
				item.preconditions = rawPreconditions;
			}));
		});
		const enterCommand = {
			id: `quick.insert.popup.enter.${id}`,
			type: _univerjs_core.CommandType.OPERATION,
			handler: () => {
				const menu = focusedMenuRef.current;
				if (menu) handleMenuSelect(menu);
			}
		};
		const moveCursorUpCommand = {
			id: `quick.insert.popup.move.cursor.up.${id}`,
			type: _univerjs_core.CommandType.OPERATION,
			handler: () => {
				setFocusedMenuIndex((index) => {
					if (filteredMenuCountRef.current <= 0) return 0;
					const nextIndex = index - 1;
					return nextIndex >= 0 ? nextIndex : filteredMenuCountRef.current - 1;
				});
			}
		};
		const moveCursorDownCommand = {
			id: `quick.insert.popup.move.cursor.down.${id}`,
			type: _univerjs_core.CommandType.OPERATION,
			handler: () => {
				setFocusedMenuIndex((index) => {
					if (filteredMenuCountRef.current <= 0) return 0;
					const nextIndex = index + 1;
					return nextIndex <= filteredMenuCountRef.current - 1 ? nextIndex : 0;
				});
			}
		};
		disposableCollection.add(commandService.registerCommand(moveCursorUpCommand));
		disposableCollection.add(commandService.registerCommand(moveCursorDownCommand));
		disposableCollection.add(commandService.registerCommand(enterCommand));
		disposableCollection.add(shortcutService.registerShortcut({
			priority: 1e3,
			id: moveCursorUpCommand.id,
			binding: _univerjs_ui.KeyCode.ARROW_UP,
			preconditions: () => true,
			staticParameters: { direction: _univerjs_core.Direction.UP }
		}));
		disposableCollection.add(shortcutService.registerShortcut({
			priority: 1e3,
			id: moveCursorDownCommand.id,
			binding: _univerjs_ui.KeyCode.ARROW_DOWN,
			preconditions: () => true,
			staticParameters: { direction: _univerjs_core.Direction.DOWN }
		}));
		disposableCollection.add(shortcutService.registerShortcut({
			priority: 1e3,
			id: enterCommand.id,
			binding: _univerjs_ui.KeyCode.ENTER,
			preconditions: () => true
		}));
		return () => {
			disposableCollection.dispose();
		};
	}, [
		commandService,
		id,
		shortcutService
	]);
	(0, react.useEffect)(() => {
		setFocusedMenuIndex(0);
	}, [filteredMenus]);
	const menuNodeMapRef = (0, react.useRef)(/* @__PURE__ */ new Map());
	(0, react.useEffect)(() => {
		return () => {
			menuNodeMapRef.current.clear();
		};
	}, []);
	const hasMenus = filteredMenus.length > 0;
	const Placeholder = (currentPopup === null || currentPopup === void 0 ? void 0 : currentPopup.popup.Placeholder) || componentManager.get(QuickInsertPlaceholder.componentKey);
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: "univer-mt-2",
		children: hasMenus ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuickInsertMenu, {
			menus: filteredMenus,
			focusedMenuIndex,
			focusedMenuRef,
			menuNodeMapRef,
			componentManager,
			onFocusedMenuIndexChange: setFocusedMenuIndex,
			onSelect: handleMenuSelect
		}) : Placeholder && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Placeholder, {})
	});
};
QuickInsertPopup.componentKey = "docs.quick.insert.popup";

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/typeof.js
function _typeof(o) {
	"@babel/helpers - typeof";
	return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(o) {
		return typeof o;
	} : function(o) {
		return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
	}, _typeof(o);
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/toPrimitive.js
function toPrimitive(t, r) {
	if ("object" != _typeof(t) || !t) return t;
	var e = t[Symbol.toPrimitive];
	if (void 0 !== e) {
		var i = e.call(t, r || "default");
		if ("object" != _typeof(i)) return i;
		throw new TypeError("@@toPrimitive must return a primitive value.");
	}
	return ("string" === r ? String : Number)(t);
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/toPropertyKey.js
function toPropertyKey(t) {
	var i = toPrimitive(t, "string");
	return "symbol" == _typeof(i) ? i : i + "";
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/defineProperty.js
function _defineProperty(e, r, t) {
	return (r = toPropertyKey(r)) in e ? Object.defineProperty(e, r, {
		value: t,
		enumerable: !0,
		configurable: !0,
		writable: !0
	}) : e[r] = t, e;
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/decorateParam.js
function __decorateParam(paramIndex, decorator) {
	return function(target, key) {
		decorator(target, key, paramIndex);
	};
}

//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/decorate.js
function __decorate(decorators, target, key, desc) {
	var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
	if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
	else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
	return c > 3 && r && Object.defineProperty(target, key, r), r;
}

//#endregion
//#region src/services/doc-quick-insert-popup.service.ts
const noopDisposable = { dispose: () => {} };
let DocQuickInsertPopupService = class DocQuickInsertPopupService extends _univerjs_core.Disposable {
	get popups() {
		return Array.from(this._popups);
	}
	get editPopup() {
		return this._editPopup$.value;
	}
	get isComposing() {
		return this._isComposing$.value;
	}
	setIsComposing(isComposing) {
		this._isComposing$.next(isComposing);
	}
	get inputOffset() {
		return this._inputOffset$.value;
	}
	setInputOffset(offset) {
		this._inputOffset$.next(offset);
	}
	getDocEventManagerService(unitId) {
		var _this$_renderManagerS;
		return (_this$_renderManagerS = this._renderManagerService.getRenderById(unitId)) === null || _this$_renderManagerS === void 0 ? void 0 : _this$_renderManagerS.with(_univerjs_docs_ui.DocEventManagerService);
	}
	constructor(_docCanvasPopupManagerService, _univerInstanceService, _commandService, _renderManagerService, _docSelectionManagerService) {
		super();
		this._docCanvasPopupManagerService = _docCanvasPopupManagerService;
		this._univerInstanceService = _univerInstanceService;
		this._commandService = _commandService;
		this._renderManagerService = _renderManagerService;
		this._docSelectionManagerService = _docSelectionManagerService;
		_defineProperty(this, "_popups", /* @__PURE__ */ new Set());
		_defineProperty(this, "_editPopup$", new rxjs.BehaviorSubject(void 0));
		_defineProperty(this, "editPopup$", this._editPopup$.asObservable());
		_defineProperty(this, "_isComposing$", new rxjs.BehaviorSubject(false));
		_defineProperty(this, "isComposing$", this._isComposing$.asObservable());
		_defineProperty(this, "_inputOffset$", new rxjs.BehaviorSubject({
			start: 0,
			end: 0
		}));
		_defineProperty(this, "inputOffset$", this._inputOffset$.asObservable());
		_defineProperty(this, "filterKeyword$", void 0);
		_defineProperty(this, "_menuSelectedCallbacks", /* @__PURE__ */ new Set());
		_defineProperty(this, "_inputPlaceholderRenderRoot", null);
		this.disposeWithMe(this._editPopup$);
		const getBodySlice = (start, end) => {
			var _this$_univerInstance;
			return (_this$_univerInstance = this._univerInstanceService.getCurrentUnitOfType(_univerjs_core.UniverInstanceType.UNIVER_DOC)) === null || _this$_univerInstance === void 0 || (_this$_univerInstance = _this$_univerInstance.getBody()) === null || _this$_univerInstance === void 0 ? void 0 : _this$_univerInstance.dataStream.slice(start, end);
		};
		let lastFilterKeyword = "";
		this.filterKeyword$ = this._inputOffset$.pipe((0, rxjs.map)((offset) => {
			var _slice$slice;
			const slice = getBodySlice(offset.start, offset.end);
			return (_slice$slice = slice === null || slice === void 0 ? void 0 : slice.slice(1)) !== null && _slice$slice !== void 0 ? _slice$slice : "";
		}), (0, rxjs.distinctUntilChanged)(), (0, rxjs.tap)((filterKeyword) => {
			lastFilterKeyword = filterKeyword;
		}));
		this.disposeWithMe((0, rxjs.combineLatest)([
			this.filterKeyword$.pipe((0, rxjs.tap)((filterKeyword) => {
				if (filterKeyword.length > 0) {
					var _this$_inputPlacehold;
					(_this$_inputPlacehold = this._inputPlaceholderRenderRoot) === null || _this$_inputPlacehold === void 0 || (_this$_inputPlacehold = _this$_inputPlacehold.unmount) === null || _this$_inputPlacehold === void 0 || _this$_inputPlacehold.dispose();
				} else {
					var _this$_inputPlacehold2;
					(_this$_inputPlacehold2 = this._inputPlaceholderRenderRoot) === null || _this$_inputPlacehold2 === void 0 || _this$_inputPlacehold2.mount();
				}
			})),
			this.isComposing$.pipe((0, rxjs.tap)((isComposing) => {
				if (isComposing) {
					var _this$_inputPlacehold3;
					(_this$_inputPlacehold3 = this._inputPlaceholderRenderRoot) === null || _this$_inputPlacehold3 === void 0 || (_this$_inputPlacehold3 = _this$_inputPlacehold3.unmount) === null || _this$_inputPlacehold3 === void 0 || _this$_inputPlacehold3.dispose();
				} else {
					var _this$_inputPlacehold4;
					lastFilterKeyword.length <= 0 && ((_this$_inputPlacehold4 = this._inputPlaceholderRenderRoot) === null || _this$_inputPlacehold4 === void 0 || _this$_inputPlacehold4.mount());
				}
			})),
			this.editPopup$.pipe((0, rxjs.tap)((popup) => {
				if (!popup) {
					var _this$_inputPlacehold5;
					(_this$_inputPlacehold5 = this._inputPlaceholderRenderRoot) === null || _this$_inputPlacehold5 === void 0 || (_this$_inputPlacehold5 = _this$_inputPlacehold5.unmount) === null || _this$_inputPlacehold5 === void 0 || _this$_inputPlacehold5.dispose();
					this._inputPlaceholderRenderRoot = null;
				}
			}))
		]).subscribe());
	}
	resolvePopup(keyword) {
		return Array.from(this._popups).find((popup) => popup.keyword === keyword);
	}
	registerPopup(popup) {
		this._popups.add(popup);
		return () => {
			this._popups.delete(popup);
		};
	}
	_createInputPlaceholderRenderRoot(mount) {
		return {
			isMounted: false,
			mount() {
				if (this.isMounted) return;
				this.isMounted = true;
				const unmount = mount();
				this.unmount = { dispose: () => {
					unmount.dispose();
					this.isMounted = false;
				} };
			}
		};
	}
	_getParagraphBound(unitId, index) {
		var _currentDoc$getBody, _docEventManagerServi;
		const currentDoc = this._univerInstanceService.getUnit(unitId);
		const paragraph = currentDoc === null || currentDoc === void 0 || (_currentDoc$getBody = currentDoc.getBody()) === null || _currentDoc$getBody === void 0 || (_currentDoc$getBody = _currentDoc$getBody.paragraphs) === null || _currentDoc$getBody === void 0 ? void 0 : _currentDoc$getBody.find((p) => p.startIndex > index);
		if (!paragraph) return null;
		const docEventManagerService = this.getDocEventManagerService(unitId);
		return (_docEventManagerServi = docEventManagerService === null || docEventManagerService === void 0 ? void 0 : docEventManagerService.findParagraphBoundByIndex(paragraph.startIndex)) !== null && _docEventManagerServi !== void 0 ? _docEventManagerServi : null;
	}
	_getKeywordPlaceholderAnchorRect(document, skeleton, activeRange, fallbackRect) {
		const startPosition = skeleton.findNodePositionByCharIndex(activeRange.startOffset, true, activeRange.segmentId, activeRange.segmentPage);
		if (!startPosition) return fallbackRect;
		const documentOffsetConfig = document.getOffsetConfig();
		const { contentBoxPointGroup } = new _univerjs_docs_ui.NodePositionConvertToCursor(documentOffsetConfig, skeleton).getRangePointData(startPosition, startPosition);
		if (contentBoxPointGroup.length === 0) return fallbackRect;
		const anchor = (0, _univerjs_docs_ui.getAnchorBounding)(contentBoxPointGroup);
		const left = anchor.left + documentOffsetConfig.docsLeft;
		const top = anchor.top + documentOffsetConfig.docsTop;
		return {
			left,
			right: left,
			top,
			bottom: top + anchor.height
		};
	}
	_getKeywordPlaceholderExtraProps(curGlyph) {
		var _curGlyph$ts, _curGlyph$fontStyle, _ref, _curGlyph$fontStyle$f, _curGlyph$fontStyle2, _curGlyph$ts2, _curGlyph$ts3, _curGlyph$ts4, _curGlyph$bBox, _curGlyph$bBox$ba, _curGlyph$bBox2, _curGlyph$bBox$bd, _curGlyph$bBox3;
		return {
			fontSize: (_curGlyph$ts = curGlyph.ts) === null || _curGlyph$ts === void 0 ? void 0 : _curGlyph$ts.fs,
			fontString: (_curGlyph$fontStyle = curGlyph.fontStyle) === null || _curGlyph$fontStyle === void 0 ? void 0 : _curGlyph$fontStyle.fontString,
			fontFamily: (_ref = (_curGlyph$fontStyle$f = (_curGlyph$fontStyle2 = curGlyph.fontStyle) === null || _curGlyph$fontStyle2 === void 0 ? void 0 : _curGlyph$fontStyle2.fontFamily) !== null && _curGlyph$fontStyle$f !== void 0 ? _curGlyph$fontStyle$f : (_curGlyph$ts2 = curGlyph.ts) === null || _curGlyph$ts2 === void 0 ? void 0 : _curGlyph$ts2.ff) !== null && _ref !== void 0 ? _ref : void 0,
			fontStyle: ((_curGlyph$ts3 = curGlyph.ts) === null || _curGlyph$ts3 === void 0 ? void 0 : _curGlyph$ts3.it) ? "italic" : "normal",
			fontWeight: ((_curGlyph$ts4 = curGlyph.ts) === null || _curGlyph$ts4 === void 0 ? void 0 : _curGlyph$ts4.bl) ? "bold" : "normal",
			ascent: (_curGlyph$bBox = curGlyph.bBox) === null || _curGlyph$bBox === void 0 ? void 0 : _curGlyph$bBox.ba,
			contentHeight: ((_curGlyph$bBox$ba = (_curGlyph$bBox2 = curGlyph.bBox) === null || _curGlyph$bBox2 === void 0 ? void 0 : _curGlyph$bBox2.ba) !== null && _curGlyph$bBox$ba !== void 0 ? _curGlyph$bBox$ba : 0) + ((_curGlyph$bBox$bd = (_curGlyph$bBox3 = curGlyph.bBox) === null || _curGlyph$bBox3 === void 0 ? void 0 : _curGlyph$bBox3.bd) !== null && _curGlyph$bBox$bd !== void 0 ? _curGlyph$bBox$bd : 0) || void 0
		};
	}
	_mountInputPlaceholder(unitId, fallbackRect) {
		const currentRender = this._renderManagerService.getRenderById(unitId);
		const docSkeletonManagerService = currentRender === null || currentRender === void 0 ? void 0 : currentRender.with(_univerjs_docs.DocSkeletonManagerService);
		const activeRange = this._docSelectionManagerService.getActiveTextRange();
		if (!currentRender || !docSkeletonManagerService || !activeRange) return noopDisposable;
		const skeleton = docSkeletonManagerService.getSkeleton();
		const curGlyph = skeleton.findNodeByCharIndex(activeRange.startOffset, activeRange.segmentId, activeRange.segmentPage);
		if (!((curGlyph === null || curGlyph === void 0 ? void 0 : curGlyph.content) === "\r") || !curGlyph) return noopDisposable;
		const document = currentRender.mainComponent;
		const placeholderAnchorRect = this._getKeywordPlaceholderAnchorRect(document, skeleton, activeRange, fallbackRect);
		const extraProps = this._getKeywordPlaceholderExtraProps(curGlyph);
		const disposable = this._docCanvasPopupManagerService.attachPopupToRect(placeholderAnchorRect, {
			componentKey: KeywordInputPlaceholder.componentKey,
			extraProps,
			onClickOutside: () => {
				disposable.dispose();
			},
			direction: "horizontal"
		}, unitId);
		return disposable;
	}
	showPopup(options) {
		const { popup, index, unitId } = options;
		this.closePopup();
		const paragraphBound = this._getParagraphBound(unitId, index);
		if (!paragraphBound) return;
		this._inputPlaceholderRenderRoot = this._createInputPlaceholderRenderRoot(() => this._mountInputPlaceholder(unitId, paragraphBound.firstLine));
		this._inputPlaceholderRenderRoot.mount();
		const disposable = this._docCanvasPopupManagerService.attachPopupToRect(paragraphBound.firstLine, {
			componentKey: QuickInsertPopup.componentKey,
			onClickOutside: () => {
				this.closePopup();
			},
			direction: "bottom"
		}, unitId);
		this._editPopup$.next({
			disposable,
			popup,
			anchor: index,
			unitId
		});
	}
	closePopup() {
		if (this.editPopup) {
			this.editPopup.disposable.dispose();
			this._editPopup$.next(null);
		}
	}
	onMenuSelected(callback) {
		this._menuSelectedCallbacks.add(callback);
		return () => {
			this._menuSelectedCallbacks.delete(callback);
		};
	}
	emitMenuSelected(menu) {
		const { start, end } = this.inputOffset;
		this._commandService.syncExecuteCommand(DeleteSearchKeyCommand.id, {
			start,
			end
		});
		setTimeout(() => {
			this._menuSelectedCallbacks.forEach((callback) => callback(menu));
		}, 0);
	}
};
DocQuickInsertPopupService = __decorate([
	__decorateParam(0, (0, _univerjs_core.Inject)(_univerjs_docs_ui.DocCanvasPopManagerService)),
	__decorateParam(1, (0, _univerjs_core.Inject)(_univerjs_core.IUniverInstanceService)),
	__decorateParam(2, (0, _univerjs_core.Inject)(_univerjs_core.ICommandService)),
	__decorateParam(3, (0, _univerjs_core.Inject)(_univerjs_engine_render.IRenderManagerService)),
	__decorateParam(4, (0, _univerjs_core.Inject)(_univerjs_docs.DocSelectionManagerService))
], DocQuickInsertPopupService);

//#endregion
//#region src/commands/operations/quick-insert-popup.operation.ts
const ShowQuickInsertPopupOperation = {
	type: _univerjs_core.CommandType.OPERATION,
	id: "doc.operation.show-quick-insert-popup",
	handler(accessor, params) {
		const docQuickInsertPopupService = accessor.get(DocQuickInsertPopupService);
		if (!params) return false;
		docQuickInsertPopupService.showPopup(params);
		return true;
	}
};
const CloseQuickInsertPopupOperation = {
	type: _univerjs_core.CommandType.OPERATION,
	id: "doc.operation.close-quick-insert-popup",
	handler(accessor) {
		accessor.get(DocQuickInsertPopupService).closePopup();
		return true;
	}
};

//#endregion
//#region src/menu/menu.ts
const textMenu = {
	id: "quick-insert.text.menu",
	title: "docs-quick-insert-ui.menu.text",
	icon: "TextIcon",
	keywords: ["text"]
};
const numberedListMenu = {
	id: _univerjs_docs_ui.OrderListCommand.id,
	title: "docs-quick-insert-ui.menu.numberedList",
	icon: "OrderIcon",
	keywords: [
		"numbered",
		"list",
		"ordered"
	]
};
const bulletedListMenu = {
	id: _univerjs_docs_ui.BulletListCommand.id,
	title: "docs-quick-insert-ui.menu.bulletedList",
	icon: "UnorderIcon",
	keywords: [
		"bulleted",
		"list",
		"unordered"
	]
};
const dividerMenu = {
	id: _univerjs_docs_ui.HorizontalLineCommand.id,
	title: "docs-quick-insert-ui.menu.divider",
	icon: "DividerIcon",
	keywords: [
		"divider",
		"line",
		"separate"
	]
};
const tableMenu = {
	id: _univerjs_docs_ui.DocCreateTableOperation.id,
	title: "docs-quick-insert-ui.menu.table",
	icon: "GridIcon",
	keywords: [
		"table",
		"grid",
		"spreadsheet"
	]
};
const imageMenu = {
	id: _univerjs_docs_drawing_ui.InsertDocImageCommand.id,
	title: "docs-quick-insert-ui.menu.image",
	icon: "AdditionAndSubtractionIcon",
	keywords: [
		"image",
		"picture",
		"photo"
	]
};
const builtInMenus = [{
	title: "docs-quick-insert-ui.group.basics",
	id: "quick.insert.group.basic",
	children: [
		textMenu,
		numberedListMenu,
		bulletedListMenu,
		dividerMenu,
		tableMenu,
		imageMenu
	]
}];
const builtInMenuCommandIds = new Set([
	numberedListMenu.id,
	bulletedListMenu.id,
	dividerMenu.id,
	tableMenu.id,
	imageMenu.id
]);

//#endregion
//#region src/controllers/doc-quick-insert-trigger.controller.ts
let DocQuickInsertTriggerController = class DocQuickInsertTriggerController extends _univerjs_core.Disposable {
	constructor(_commandService, _textSelectionManagerService, _docQuickInsertPopupService, _shortcutService, _univerInstanceService) {
		super();
		this._commandService = _commandService;
		this._textSelectionManagerService = _textSelectionManagerService;
		this._docQuickInsertPopupService = _docQuickInsertPopupService;
		this._shortcutService = _shortcutService;
		this._univerInstanceService = _univerInstanceService;
		this.disposeWithMe(this._shortcutService.registerShortcut({
			id: CloseQuickInsertPopupOperation.id,
			binding: _univerjs_ui.KeyCode.ESC,
			preconditions: () => Boolean(this._docQuickInsertPopupService.editPopup),
			priority: 1e3
		}));
		this._initTrigger();
		this._initMenuHandler();
	}
	_initTrigger() {
		this.disposeWithMe(this._commandService.onCommandExecuted((commandInfo) => {
			const { _docQuickInsertPopupService, _textSelectionManagerService, _commandService } = this;
			const documentDataModel = this._univerInstanceService.getCurrentUnitOfType(_univerjs_core.UniverInstanceType.UNIVER_DOC);
			if (documentDataModel === null || documentDataModel === void 0 ? void 0 : documentDataModel.getDisabled()) return;
			if (commandInfo.id === _univerjs_docs.InsertTextCommand.id) {
				const params = commandInfo.params;
				if (_docQuickInsertPopupService.editPopup) {
					_docQuickInsertPopupService.setInputOffset({
						start: _docQuickInsertPopupService.inputOffset.start,
						end: params.range.endOffset + 1
					});
					return;
				}
				const activeRange = _textSelectionManagerService.getActiveTextRange();
				if (!activeRange) return;
				const popup = _docQuickInsertPopupService.resolvePopup(params.body.dataStream);
				if (!popup) return;
				if (!(popup.preconditions ? popup.preconditions(params) : true)) return;
				_docQuickInsertPopupService.setInputOffset({
					start: activeRange.startOffset - 1,
					end: activeRange.startOffset
				});
				setTimeout(() => {
					_commandService.executeCommand(ShowQuickInsertPopupOperation.id, {
						index: activeRange.startOffset - 1,
						unitId: params.unitId,
						popup
					});
				}, 100);
			}
			if (commandInfo.id === _univerjs_docs_ui.IMEInputCommand.id) {
				const params = commandInfo.params;
				if (!_docQuickInsertPopupService.isComposing && params.isCompositionStart) _docQuickInsertPopupService.setIsComposing(true);
				if (_docQuickInsertPopupService.isComposing && params.isCompositionEnd) _docQuickInsertPopupService.setIsComposing(false);
			}
			if (commandInfo.id === _univerjs_docs.RichTextEditingMutation.id) {
				const params = commandInfo.params;
				if (params.isCompositionEnd) {
					var _params$textRanges;
					const endOffset = (_params$textRanges = params.textRanges) === null || _params$textRanges === void 0 || (_params$textRanges = _params$textRanges[0]) === null || _params$textRanges === void 0 ? void 0 : _params$textRanges.endOffset;
					if (endOffset) _docQuickInsertPopupService.setInputOffset({
						start: _docQuickInsertPopupService.inputOffset.start,
						end: endOffset
					});
				}
			}
			if (commandInfo.id === _univerjs_docs.DeleteTextCommand.id) {
				const params = commandInfo.params;
				if (_docQuickInsertPopupService.editPopup && params.direction === _univerjs_core.DeleteDirection.LEFT) {
					var _params$len;
					const len = (_params$len = params.len) !== null && _params$len !== void 0 ? _params$len : 0;
					_docQuickInsertPopupService.setInputOffset({
						start: _docQuickInsertPopupService.inputOffset.start,
						end: params.range.endOffset - len
					});
				}
			}
			if (commandInfo.id === _univerjs_docs_ui.MoveCursorOperation.id) {
				const params = commandInfo.params;
				if (params.direction === _univerjs_core.Direction.LEFT || params.direction === _univerjs_core.Direction.RIGHT) _docQuickInsertPopupService.editPopup && _commandService.executeCommand(CloseQuickInsertPopupOperation.id);
			}
			if (commandInfo.id === _univerjs_docs_ui.DeleteLeftCommand.id) {
				const activeRange = _textSelectionManagerService.getActiveTextRange();
				if (!_docQuickInsertPopupService.editPopup || !activeRange) return;
				if (activeRange.endOffset <= _docQuickInsertPopupService.editPopup.anchor) _commandService.executeCommand(CloseQuickInsertPopupOperation.id);
			}
		}));
	}
	_initMenuHandler() {
		this.disposeWithMe(this._docQuickInsertPopupService.onMenuSelected((menu) => {
			if (menu.id === textMenu.id) return;
			if (builtInMenuCommandIds.has(menu.id)) this._commandService.executeCommand(menu.id);
		}));
	}
};
DocQuickInsertTriggerController = __decorate([
	__decorateParam(0, _univerjs_core.ICommandService),
	__decorateParam(1, (0, _univerjs_core.Inject)(_univerjs_docs.DocSelectionManagerService)),
	__decorateParam(2, (0, _univerjs_core.Inject)(DocQuickInsertPopupService)),
	__decorateParam(3, (0, _univerjs_core.Inject)(_univerjs_ui.IShortcutService)),
	__decorateParam(4, (0, _univerjs_core.Inject)(_univerjs_core.IUniverInstanceService))
], DocQuickInsertTriggerController);

//#endregion
//#region src/menu/doc-quick-insert-menu.controller.ts
let DocQuickInsertMenuController = class DocQuickInsertMenuController extends _univerjs_core.Disposable {
	get popup() {
		return this._popup$.value;
	}
	constructor(_context, _docEventManagerService, _docQuickInsertPopupService, _docCanvasPopManagerService) {
		super();
		this._context = _context;
		this._docEventManagerService = _docEventManagerService;
		this._docQuickInsertPopupService = _docQuickInsertPopupService;
		this._docCanvasPopManagerService = _docCanvasPopManagerService;
		_defineProperty(this, "_popup$", new rxjs.BehaviorSubject(null));
		_defineProperty(this, "popup$", this._popup$.asObservable());
		this._init();
	}
	_init() {
		this.disposeWithMe((0, rxjs.combineLatest)([this._docEventManagerService.hoverParagraphLeftRealTime$, this._docEventManagerService.hoverParagraphRealTime$]).subscribe(([left, paragraph]) => {
			const p = left !== null && left !== void 0 ? left : paragraph;
			const isDisabled = this._context.unit.getDisabled();
			if (!p || isDisabled) {
				this._hideMenu(true);
				return;
			}
			if (p.paragraphStart === p.paragraphEnd) {
				var _this$popup;
				if (this._docQuickInsertPopupService.editPopup || p.startIndex === ((_this$popup = this.popup) === null || _this$popup === void 0 ? void 0 : _this$popup.startIndex)) return;
				this._hideMenu(true);
				const disposable = this._docCanvasPopManagerService.attachPopupToRect(p.firstLine, {
					componentKey: QuickInsertButtonComponentKey,
					direction: "left-center"
				}, this._context.unit.getUnitId());
				this._popup$.next({
					startIndex: p.startIndex,
					disposable
				});
			} else this._hideMenu(true);
		}));
	}
	_hideMenu(force) {
		if (this._docQuickInsertPopupService.editPopup) return;
		if (this.popup && (force || this.popup.disposable.canDispose())) {
			this.popup.disposable.dispose();
			this._popup$.next(null);
		}
	}
};
DocQuickInsertMenuController = __decorate([
	__decorateParam(1, (0, _univerjs_core.Inject)(_univerjs_docs_ui.DocEventManagerService)),
	__decorateParam(2, (0, _univerjs_core.Inject)(DocQuickInsertPopupService)),
	__decorateParam(3, (0, _univerjs_core.Inject)(_univerjs_docs_ui.DocCanvasPopManagerService))
], DocQuickInsertMenuController);

//#endregion
//#region src/views/QuickInsertButton.tsx
const QuickInsertButtonComponentKey = "doc.quick-insert.button";
const QuickInsertButton = ({ className = "" }) => {
	const docQuickInsertPopupService = (0, _univerjs_ui.useDependency)(DocQuickInsertPopupService);
	const univerInstanceService = (0, _univerjs_ui.useDependency)(_univerjs_core.IUniverInstanceService);
	const renderManagerService = (0, _univerjs_ui.useDependency)(_univerjs_engine_render.IRenderManagerService);
	const currentDoc = (0, _univerjs_ui.useObservable)((0, react.useMemo)(() => univerInstanceService.getCurrentTypeOfUnit$(_univerjs_core.UniverInstanceType.UNIVER_DOC), [univerInstanceService]));
	const currentUnit = currentDoc && renderManagerService.getRenderById(currentDoc.getUnitId());
	const docQuickInsertMenuController = currentUnit === null || currentUnit === void 0 ? void 0 : currentUnit.with(DocQuickInsertMenuController);
	const layoutService = (0, _univerjs_ui.useDependency)(_univerjs_ui.ILayoutService);
	const docSelectionManagerService = (0, _univerjs_ui.useDependency)(_univerjs_docs.DocSelectionManagerService);
	const editPopup = (0, _univerjs_ui.useObservable)(docQuickInsertPopupService.editPopup$);
	const onClick = (0, _univerjs_ui.useEvent)(() => {
		var _currentDoc$getUnitId;
		const p = docQuickInsertMenuController === null || docQuickInsertMenuController === void 0 ? void 0 : docQuickInsertMenuController.popup;
		if (!p) return;
		const allPopups = docQuickInsertPopupService.popups;
		const popup = {
			keyword: "",
			menus$: (0, rxjs.combineLatest)(allPopups.map((p) => p.menus$)).pipe((0, rxjs.map)((menusCollection) => menusCollection.flat()))
		};
		docSelectionManagerService.replaceDocRanges([{
			startOffset: p.startIndex,
			endOffset: p.startIndex
		}]);
		docQuickInsertPopupService.setInputOffset({
			start: p.startIndex - 1,
			end: p.startIndex - 1
		});
		docQuickInsertPopupService.showPopup({
			popup,
			index: p.startIndex - 1,
			unitId: (_currentDoc$getUnitId = currentDoc === null || currentDoc === void 0 ? void 0 : currentDoc.getUnitId()) !== null && _currentDoc$getUnitId !== void 0 ? _currentDoc$getUnitId : ""
		});
		setTimeout(() => {
			layoutService.focus();
		});
	});
	return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
		className: (0, _univerjs_design.clsx)("univer-mr-1 univer-flex univer-cursor-pointer univer-items-center univer-gap-2.5 univer-rounded-full univer-p-1.5 univer-shadow-sm hover:univer-bg-gray-100 dark:!univer-text-gray-200 dark:hover:!univer-bg-gray-700", _univerjs_design.borderClassName, {
			"univer-bg-gray-100 dark:!univer-bg-gray-700": editPopup,
			"univer-bg-white dark:!univer-bg-gray-900": !editPopup
		}, className),
		role: "button",
		tabIndex: 0,
		onClick,
		children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_univerjs_icons.IncreaseIcon, { className: "univer-text-gray-800 dark:!univer-text-gray-200" })
	});
};
QuickInsertButton.componentKey = QuickInsertButtonComponentKey;

//#endregion
//#region src/controllers/doc-quick-insert-ui.controller.ts
let DocQuickInsertUIController = class DocQuickInsertUIController extends _univerjs_core.Disposable {
	constructor(_commandService, _docQuickInsertPopupService, _componentManager) {
		super();
		this._commandService = _commandService;
		this._docQuickInsertPopupService = _docQuickInsertPopupService;
		this._componentManager = _componentManager;
		this._initCommands();
		this._initComponents();
		this._initMenus();
	}
	_initCommands() {
		[
			DeleteSearchKeyCommand,
			ShowQuickInsertPopupOperation,
			CloseQuickInsertPopupOperation
		].forEach((operation) => {
			this.disposeWithMe(this._commandService.registerCommand(operation));
		});
	}
	_initComponents() {
		[
			[QuickInsertPopup.componentKey, QuickInsertPopup],
			[KeywordInputPlaceholder.componentKey, KeywordInputPlaceholder],
			[QuickInsertPlaceholder.componentKey, QuickInsertPlaceholder],
			[_univerjs_icons.DividerIcon.displayName, _univerjs_icons.DividerIcon],
			[_univerjs_icons.TextIcon.displayName, _univerjs_icons.TextIcon],
			[QuickInsertButton.componentKey, QuickInsertButton]
		].forEach(([key, comp]) => {
			if (key) this.disposeWithMe(this._componentManager.register(key, comp));
		});
		[{
			keyword: "/",
			menus$: (0, rxjs.of)(builtInMenus),
			preconditions: (params) => {
				var _startNodePosition;
				return ((_startNodePosition = params.range.startNodePosition) === null || _startNodePosition === void 0 ? void 0 : _startNodePosition.glyph) === 0;
			}
		}].forEach((popup) => {
			this.disposeWithMe(this._docQuickInsertPopupService.registerPopup(popup));
		});
	}
	_initMenus() {}
};
DocQuickInsertUIController = __decorate([
	__decorateParam(0, _univerjs_core.ICommandService),
	__decorateParam(1, (0, _univerjs_core.Inject)(DocQuickInsertPopupService)),
	__decorateParam(2, (0, _univerjs_core.Inject)(_univerjs_ui.ComponentManager))
], DocQuickInsertUIController);

//#endregion
//#region package.json
var name = "@univerjs/docs-quick-insert-ui";
var version = "0.25.0";

//#endregion
//#region src/config/config.ts
const DOCS_QUICK_INSERT_UI_PLUGIN_CONFIG_KEY = "docs-quick-insert-ui.config";
const configSymbol = Symbol(DOCS_QUICK_INSERT_UI_PLUGIN_CONFIG_KEY);
const defaultPluginConfig = {};

//#endregion
//#region src/plugin.ts
let UniverDocsQuickInsertUIPlugin = class UniverDocsQuickInsertUIPlugin extends _univerjs_core.Plugin {
	constructor(_config = defaultPluginConfig, _injector, _renderManagerSrv, _configService) {
		super();
		this._config = _config;
		this._injector = _injector;
		this._renderManagerSrv = _renderManagerSrv;
		this._configService = _configService;
		const { menu, ...rest } = (0, _univerjs_core.merge)({}, defaultPluginConfig, this._config);
		if (menu) this._configService.setConfig("menu", menu, { merge: true });
		this._configService.setConfig(DOCS_QUICK_INSERT_UI_PLUGIN_CONFIG_KEY, rest);
	}
	onStarting() {
		[
			[DocQuickInsertUIController],
			[DocQuickInsertTriggerController],
			[DocQuickInsertPopupService]
		].forEach((dependency) => this._injector.add(dependency));
		this._injector.get(DocQuickInsertUIController);
	}
	onRendered() {
		this._injector.get(DocQuickInsertTriggerController);
		this._injector.get(DocQuickInsertPopupService);
		[[DocQuickInsertMenuController]].forEach((m) => {
			this._renderManagerSrv.registerRenderModule(_univerjs_core.UniverInstanceType.UNIVER_DOC, m);
		});
	}
};
_defineProperty(UniverDocsQuickInsertUIPlugin, "type", _univerjs_core.UniverInstanceType.UNIVER_DOC);
_defineProperty(UniverDocsQuickInsertUIPlugin, "pluginName", "DOC_QUICK_INSERT_UI_PLUGIN");
_defineProperty(UniverDocsQuickInsertUIPlugin, "packageName", name);
_defineProperty(UniverDocsQuickInsertUIPlugin, "version", version);
UniverDocsQuickInsertUIPlugin = __decorate([
	(0, _univerjs_core.DependentOn)(_univerjs_drawing_ui.UniverDrawingUIPlugin, _univerjs_drawing.UniverDrawingPlugin, _univerjs_docs_drawing_ui.UniverDocsDrawingUIPlugin, _univerjs_docs_drawing.UniverDocsDrawingPlugin, _univerjs_ui.UniverUIPlugin),
	__decorateParam(1, (0, _univerjs_core.Inject)(_univerjs_core.Injector)),
	__decorateParam(2, (0, _univerjs_core.Inject)(_univerjs_engine_render.IRenderManagerService)),
	__decorateParam(3, _univerjs_core.IConfigService)
], UniverDocsQuickInsertUIPlugin);

//#endregion
Object.defineProperty(exports, 'DocQuickInsertPopupService', {
  enumerable: true,
  get: function () {
    return DocQuickInsertPopupService;
  }
});
Object.defineProperty(exports, 'DocQuickInsertTriggerController', {
  enumerable: true,
  get: function () {
    return DocQuickInsertTriggerController;
  }
});
Object.defineProperty(exports, 'DocQuickInsertUIController', {
  enumerable: true,
  get: function () {
    return DocQuickInsertUIController;
  }
});
exports.KeywordInputPlaceholderComponentKey = KeywordInputPlaceholderComponentKey;
exports.QuickInsertPlaceholderComponentKey = QuickInsertPlaceholderComponentKey;
Object.defineProperty(exports, 'UniverDocsQuickInsertUIPlugin', {
  enumerable: true,
  get: function () {
    return UniverDocsQuickInsertUIPlugin;
  }
});