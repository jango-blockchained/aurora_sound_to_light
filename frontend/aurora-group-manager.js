import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraGroupManager extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            narrow: { type: Boolean },
        };
    }

    static get styles() {
        return css`
            :host {
                display: block;
                padding: 16px;
                background: var(--card-background-color);
                border-radius: var(--ha-card-border-radius);
            }
            .placeholder {
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 32px;
                color: var(--primary-text-color);
                text-align: center;
            }
        `;
    }

    render() {
        return html`
            <div class="placeholder">
                <div>
                    <ha-icon icon="mdi:lightbulb-group"></ha-icon>
                    <div>Light Group Manager Coming Soon</div>
                </div>
            </div>
        `;
    }
}

customElements.define("aurora-group-manager", AuroraGroupManager); 