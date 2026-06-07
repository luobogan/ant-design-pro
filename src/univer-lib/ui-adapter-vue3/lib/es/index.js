import { DependentOn, Inject, Injector, Plugin } from "@univerjs/core";
import { ComponentManager, UniverUIPlugin } from "@univerjs/ui";
import { h, render } from "vue";

//#region package.json
var name = "@univerjs/ui-adapter-vue3";
var version = "0.25.0";

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
//#region src/plugin.ts
let UniverVue3AdapterPlugin = class UniverVue3AdapterPlugin extends Plugin {
	constructor(_config = {}, _injector, _componentManager) {
		super();
		this._config = _config;
		this._injector = _injector;
		this._componentManager = _componentManager;
	}
	onStarting() {
		const { createElement, useEffect, useRef } = this._componentManager.reactUtils;
		this._componentManager.setHandler("vue3", (component) => {
			return (props) => createElement(VueComponentWrapper, {
				component,
				props: Object.keys(props).reduce((acc, key) => {
					if (key !== "key") acc[key] = props[key];
					return acc;
				}, {}),
				reactUtils: {
					createElement,
					useEffect,
					useRef
				}
			});
		});
	}
};
_defineProperty(UniverVue3AdapterPlugin, "pluginName", "UNIVER_UI_ADAPTER_VUE3_PLUGIN");
_defineProperty(UniverVue3AdapterPlugin, "packageName", name);
_defineProperty(UniverVue3AdapterPlugin, "version", version);
UniverVue3AdapterPlugin = __decorate([
	DependentOn(UniverUIPlugin),
	__decorateParam(1, Inject(Injector)),
	__decorateParam(2, Inject(ComponentManager))
], UniverVue3AdapterPlugin);
function VueComponentWrapper(options) {
	const { component, props, reactUtils } = options;
	const { createElement, useEffect, useRef } = reactUtils;
	const domRef = useRef(null);
	useEffect(() => {
		if (!domRef.current) return;
		render(h(component, props), domRef.current);
		return () => {
			domRef.current && render(null, domRef.current);
		};
	}, [props]);
	return createElement("div", { ref: domRef });
}

//#endregion
export { UniverVue3AdapterPlugin };