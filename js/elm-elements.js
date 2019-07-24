/* global CustomEvent, customElements */
window.ElmElements = (function (CustomEvent, Object, customElements) {

    function create(App, definition) {
        const {
            events = {},
            props = {},
            disconnectPort = "disconnect",
            shadowDOM = { mode: 'closed' },
        } = definition;
        const attributes = {};
        Object.keys(props).forEach((propName) => {
            const prop = props[propName];
            prop.propName = propName;
            prop.fromAttribute = prop.fromAttribute || String;
            prop.portName = prop.portName || `${propName}Changed`;
            prop.reflectToAttribute = typeof prop.reflectToAttribute === 'undefined' ? true : prop.reflectToAttribute;
            prop.toAttribute = prop.toAttribute || String;
            const attr = prop.attributeName || propName;
            prop.attributeName = attr;
            attributes[attr] = prop;
        });
        const observedAttributes = Object.keys(attributes);
        const eventByPortName = {};
        const defaultToEventData = (detail) => ({ detail });
        Object.keys(events).forEach((eventName) => {
            const evt = events[eventName];
            const { port, toEventData } = evt;
            evt.eventName = eventName;
            evt.toEventData = toEventData || defaultToEventData;
            if (!eventByPortName[port]) {
                eventByPortName[port] = [];
            }
            eventByPortName[port].push(evt);
        });

        console.log("ElmElements.create.config", App, { attributes, props, eventByPortName });

        const PREFIX = "__ElmElements$" + Math.floor(Math.random() * 10000000) + "_cid";
        let CID = 0;
        return class extends HTMLElement {
            static get observedAttributes() {
                return observedAttributes;
            }
            constructor() {
                super();
                if (shadowDOM) {
                    this._shadowRoot = this.attachShadow(shadowDOM);
                    const document = this._shadowRoot.ownerDocument;
                    const parent = document.createElement("div");
                    this._root = document.createElement("div");
                    parent.appendChild(this._root);
                    this._shadowRoot.appendChild(parent);
                } else {
                    this._root = this.ownerDocument.createElement("div");
                }
                this._app = null;
                this._subscriptions = null;
                this._reflect = true;

                Object.keys(props).forEach((propName) => {
                    const { attributeName, portName, reflectToAttribute, toAttribute } = props[propName];
                    let value;
                    Object.defineProperty(this, propName, {
                        configurable: false,
                        enumerable: false,
                        get() {
                            return value;
                        },
                        set: (newValue) => {
                            console.log(this.getAttribute("data-elm-element-id"), "set(", propName, newValue, ")");
                            if (value === newValue) {
                                return;
                            }
                            value = newValue;

                            if (!this._app.ports.hasOwnProperty(portName)) {
                                return;
                            }

                            this._app.ports[portName].send(newValue);
                            if (reflectToAttribute && this._reflect) {
                                this._reflect = false;
                                this.setAttribute(attributeName, toAttribute(newValue));
                                this._reflect = true;
                            }
                        },
                    });
                });
            }
            connectedCallback() {
                const flags = {};
                Object.keys(props).forEach((propName) => {
                    const { attributeName, fromAttribute } = props[propName];
                    if (this.hasAttribute(attributeName)) {
                        flags[propName] = fromAttribute(this.getAttribute(attributeName));
                    }
                });

                this.setAttribute("data-elm-element-id", `${PREFIX}${++CID}`);
                console.log(this.getAttribute("data-elm-element-id"), "connectedCallback", flags, this._root);
                if (!shadowDOM) {
                    this.appendChild(this._root);
                }
                this._app = App.init({ flags, node: this._root });

                this._subscriptions = Object.keys(this._app.ports).map((portName) => {
                    const port = this._app.ports[portName];
                    if (typeof port.subscribe === "function" && typeof port.unsubscribe === "function") {
                        console.log(this.getAttribute("data-elm-element-id"), "subscribing to port", portName, port);
                        const handler = (data) => {
                            eventByPortName[portName].forEach((evt) => {
                                const { eventName, toEventData } = evt;
                                this.emit(eventName, toEventData(data, eventName));
                            });
                        };
                        port.subscribe(handler);
                        return () => port.unsubscribe(handler);
                    }
                    return null;
                }).filter(Boolean);

                Object.keys(props).forEach((propName) => this._upgradeProperty(propName));

                console.log(this.getAttribute("data-elm-element-id"), "app", this._app);
            }

            _upgradeProperty(propName) {
                if (this.hasOwnProperty(propName)) {
                    const value = this[propName];
                    // delete this[propName];
                    this[propName] = value;
                }
            }

            emit(channel, data) {
                console.log(this.getAttribute("data-elm-element-id"), "emit", channel, data);
                this.dispatchEvent(new CustomEvent(channel, data));
            }

            attributeChangedCallback(attr, oldValue, newValue) {
                if (!this._app) {
                    return;
                }
                console.log(this.getAttribute("data-elm-element-id"), "attributeChanged " + attr + ": " + oldValue + "->" + newValue);

                if (!attributes[attr]) {
                    return;
                }
                const { fromAttribute, portName, propName } = attributes[attr];
                if (!this._app.ports.hasOwnProperty(portName)) {
                    return;
                }

                if (oldValue === newValue) {
                    return;
                }

                const propValue = fromAttribute(newValue);
                //this._app.ports[portName].send(propValue);

                if (this._reflect) {
                    this._reflect = false;
                    this[propName] = propValue;
                    this._reflect = true;
                }
            }
            disconnectedCallback() {
                console.log(this.getAttribute("data-elm-element-id"), "Shutting down Elm App and cleaning up...");

                if (this._app.ports.hasOwnProperty(disconnectPort)) {
                    this._app.ports[disconnectPort].send(null);
                }

                this._subscriptions.forEach((dispose) => dispose());
                this._subscriptions = null;

                this._app = null;
                this._root = null;
            }
        };
    }

    return Object.freeze({
        define(name, App, definition) {
            const Element = create(App, definition);
            customElements.define(name, Element);
            return Element;
        },
    });

}(CustomEvent, Object, customElements));

