/* global CustomEvent, customElements */
window.ElmElements = (function (CustomEvent, Object, customElements) {

    function create(App, definition) {
        console.log("ElmElements.create", App, definition);
        const {
            attributes = {},
            events = {},
            shutdownSignal = "shutdownRequested",
            shadowDOM = { mode: 'closed' },
        } = definition;
        const observedAttributes = Object.keys(attributes);
        const eventByPortName = new Map();
        Object.keys(events).forEach((eventName) => {
            const [portName, transform] = events[eventName];
            eventByPortName.set(portName, [eventName, transform]);
        });

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

                observedAttributes.forEach((attr) => {
                    const [name, transform] = attributes[attr];
                    let value;
                    Object.defineProperty(this, name, {
                        configurable: false,
                        enumerable: false,
                        get() {
                            return value;
                        },
                        set: (newValue) => {
                            if (value === newValue) {
                                return;
                            }
                            value = newValue;
                            if (this._reflect) {
                                this.setAttribute(attr, newValue);
                            }
                        },
                    });
                });
            }
            connectedCallback() {
                const flags = {};
                observedAttributes.forEach((attr) => {
                    const [name, transform] = attributes[attr];
                    flags[name] = transform(this.getAttribute(attr));
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
                            const [channel, transform] = eventByPortName.get(portName);
                            this.emit(channel, transform(data, channel));
                        };
                        port.subscribe(handler);
                        return () => port.unsubscribe(handler);
                    }
                    return null;
                }).filter(Boolean);

                observedAttributes.forEach((attr) => this._upgradeProperty(attr));

                console.log(this.getAttribute("data-elm-element-id"), "app", this._app);
            }

            _upgradeProperty(prop) {
                if (this.hasOwnProperty(prop)) {
                    const value = this[prop];
                    // delete this[prop];
                    this[prop] = value;
                }
            }

            emit(channel, detail) {
                console.log(this.getAttribute("data-elm-element-id"), "emit", channel, detail);
                this.dispatchEvent(new CustomEvent(channel, {
                    bubbles: true,
                    cancelable: false,
                    composed: true,
                    detail,
                }));
            }

            attributeChangedCallback(attr, oldValue, newValue) {
                if (!this._app) {
                    return;
                }
                console.log(this.getAttribute("data-elm-element-id"), "attributeChanged " + attr + ": " + oldValue + "->" + newValue);

                if (!attributes[attr]) {
                    return;
                }
                const [name, transform] = attributes[attr];
                const portName = `${name}Changed`;
                if (!this._app.ports.hasOwnProperty(portName)) {
                    return;
                }

                if (oldValue == newValue) {
                    return;
                }

                this._app.ports[portName].send(transform(newValue));
                this._reflect = false;
                this[attr] = newValue;
                this._reflect = true;
            }
            disconnectedCallback() {
                console.log(this.getAttribute("data-elm-element-id"), "Shutting down Elm App and cleaning up...");

                if (this._app.ports.hasOwnProperty(shutdownSignal)) {
                    this._app.ports[shutdownSignal].send(null);
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

