
window.ElmElements = Object.freeze({
    build(App, definition) {
        console.log("ElmElements.define", name, App, definition);
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
            }
            connectedCallback() {
                const flags = {};
                observedAttributes.forEach((attr) => {
                    const [name, transform] = attributes[attr];
                    flags[name] = transform(this.getAttribute(attr));
                });

                this.setAttribute("data-elm-element-id", `elm-element-${++CID}`);
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
                }).filter(Boolean);
                console.log(this.getAttribute("data-elm-element-id"), "app", this._app);
            }

            emit(channel, detail) {
                console.log(this.getAttribute("data-elm-element-id"), "emit", channel, detail);
                this.dispatchEvent(new CustomEvent(channel, { detail }));
            }

            attributeChangedCallback(attr, oldValue, value) {
                if (!this._app) {
                    return;
                }
                console.log(this.getAttribute("data-elm-element-id"), "attributeChanged " + attr + ": " + oldValue + "->" + value);

                if (!attributes[attr]) {
                    return;
                }
                const [name, transform] = attributes[attr];
                const portName = `${name}Changed`;
                if (!this._app.ports.hasOwnProperty(portName)) {
                    return;
                }

                if (oldValue == value) {
                    return;
                }

                this._app.ports[portName].send(transform(value));
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
        }
    },
    define(name, App, definition) {
        return customElements.define(name, ElmElements.build(App, definition));
    },
});

