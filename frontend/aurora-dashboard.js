import {
    LitElement,
    html,
    css,
} from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class AuroraDashboard extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });

        // Enhanced state management with persistence
        this._state = this._loadPersistedState() || {
            connected: false,
            authenticated: false,
            error: null,
            activeEffects: [],
            audioState: {
                inputSource: null,
                volume: 1.0,
                isPlaying: false
            },
            selectedGroups: [],
            performanceMetrics: {
                latency: 0,
                cpuUsage: 0,
                memoryUsage: 0
            },
            layout: {
                mode: window.innerWidth < 768 ? 'mobile' : 'desktop',
                componentOrder: this._getDefaultComponentOrder()
            }
        };

        // Component registry
        this._components = new Map();
        this._componentStates = new Map();
        this._errorBoundaries = new Map();

        this._config = {};
        this._connection = null;
        this._eventBus = {
            listeners: new Map(),
            componentEvents: new Map(),
            history: [],
            maxHistoryLength: 50
        };
        this._authToken = null;
        this._messageQueue = [];
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
        this._reconnectDelay = 1000;
        this._pingInterval = null;
        this._lastPingTime = null;

        // Service layer
        this._services = {
            initialized: false,
            available: new Set(),
            callHistory: []
        };

        // Bind methods
        this._handleResize = this._handleResize.bind(this);
        this._handleError = this._handleError.bind(this);
        this._handleWebSocketMessage = this._handleWebSocketMessage.bind(this);
        this._handleWebSocketClose = this._handleWebSocketClose.bind(this);
        this._handleWebSocketError = this._handleWebSocketError.bind(this);
        this._dispatchToBus = this._dispatchToBus.bind(this);
        this._handleComponentEvent = this._handleComponentEvent.bind(this);
        this._handleServiceCall = this._handleServiceCall.bind(this);
        this._handleServiceResponse = this._handleServiceResponse.bind(this);
    }

    static get observedAttributes() {
        return ['hass-url', 'auth-token', 'theme-mode'];
    }

    // Enhanced lifecycle callbacks
    connectedCallback() {
        this._render();
        this._initializeWebSocket();
        this._setupEventListeners();
        this._initializeComponents();
        this._setupErrorBoundaries();
        this._setupResizeObserver();

        // Register child components
        this._registerChildComponents();

        // Setup periodic state persistence
        this._persistenceInterval = setInterval(() => this._persistState(), 30000);

        // Initialize services
        this._initializeServices();
    }

    disconnectedCallback() {
        this._cleanup();
        this._cleanupWebSocket();
        clearInterval(this._persistenceInterval);
        window.removeEventListener('resize', this._handleResize);
        this._resizeObserver?.disconnect();

        // Clean up services
        this._services = {
            initialized: false,
            available: new Set(),
            callHistory: []
        };
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (oldValue === newValue) return;

        switch (name) {
            case 'hass-url':
                this._config.hassUrl = newValue;
                this._reconnectWebSocket();
                break;
            case 'auth-token':
                this._authToken = newValue;
                this._reconnectWebSocket();
                break;
            case 'theme-mode':
                this._updateTheme(newValue);
                break;
        }
    }

    // Component Registration and Management
    _registerChildComponents() {
        const components = {
            'aurora-media-controls': () => import('./aurora-media-controls.js'),
            'aurora-visualizer': () => import('./aurora-visualizer.js'),
            'aurora-effect-selector': () => import('./aurora-effect-selector.js'),
            'aurora-group-manager': () => import('./aurora-group-manager.js'),
            'aurora-performance-monitor': () => import('./aurora-performance-monitor.js')
        };

        Object.entries(components).forEach(([name, importFn]) => {
            this._registerComponent(name, importFn);
        });
    }

    async _registerComponent(name, importFn) {
        try {
            await importFn();
            this._components.set(name, {
                loaded: true,
                error: null
            });

            // Initialize component state and events
            this._initializeComponentState(name);
            this._initializeComponentEvents(name);

            // Update UI
            this._render();
        } catch (error) {
            this._handleComponentError(name, error);
        }
    }

    _initializeComponentState(name) {
        const component = this.shadowRoot.querySelector(name);
        if (component) {
            component.addEventListener('state-change', (e) =>
                this._handleComponentStateChange(name, e.detail));
            component.addEventListener('error', (e) =>
                this._handleComponentError(name, e.detail));
        }
    }

    _initializeComponentEvents(name) {
        const component = this.shadowRoot.querySelector(name);
        if (!component) return;

        // Register standard events
        const standardEvents = [
            'state-change',
            'error',
            'ready',
            'update'
        ];

        // Get component-specific events
        const componentEvents = this._getComponentSpecificEvents(name);
        const allEvents = [...standardEvents, ...componentEvents];

        // Register events with the event bus
        this._registerComponentEvents(name, allEvents);

        // Add event listeners
        allEvents.forEach(eventType => {
            component.addEventListener(eventType, (event) => {
                this._handleComponentEvent(name, {
                    type: eventType,
                    detail: event.detail
                });
            });
        });
    }

    _getComponentSpecificEvents(name) {
        // Define component-specific events
        const eventMap = {
            'aurora-media-controls': [
                'media-play',
                'media-pause',
                'volume-change',
                'source-change',
                'track-change'
            ],
            'aurora-visualizer': [
                'beat-detected',
                'frequency-update',
                'mode-change'
            ],
            'aurora-effect-selector': [
                'effect-selected',
                'effect-updated',
                'preset-saved',
                'preset-loaded'
            ],
            'aurora-group-manager': [
                'group-created',
                'group-updated',
                'group-deleted',
                'zone-changed'
            ],
            'aurora-performance-monitor': [
                'performance-alert',
                'metric-update',
                'threshold-exceeded'
            ]
        };

        return eventMap[name] || [];
    }

    _registerComponentEvents(componentName, events) {
        this._eventBus.componentEvents.set(componentName, events);
    }

    _handleComponentEvent(componentName, event) {
        const registeredEvents = this._eventBus.componentEvents.get(componentName);

        if (registeredEvents?.includes(event.type)) {
            this._dispatchToBus(event.type, event.detail, componentName);
        }
    }

    // Error Boundary Implementation
    _setupErrorBoundaries() {
        window.addEventListener('error', this._handleError);
        window.addEventListener('unhandledrejection', this._handleError);
    }

    _handleError(error) {
        const errorInfo = {
            message: error.message || 'Unknown error',
            stack: error.stack,
            timestamp: new Date().toISOString()
        };

        // Update state
        this.setState({
            error: {
                type: 'system',
                ...errorInfo
            }
        });

        // Dispatch to event bus
        this._dispatchToBus('error', errorInfo);

        // Render error UI
        this._renderError(errorInfo);
    }

    _handleComponentError(componentName, error) {
        this._errorBoundaries.set(componentName, {
            error,
            timestamp: new Date().toISOString()
        });
        this._render();
    }

    // Enhanced State Management
    _loadPersistedState() {
        try {
            const saved = localStorage.getItem('aurora-dashboard-state');
            return saved ? JSON.parse(saved) : null;
        } catch (error) {
            console.error('Failed to load persisted state:', error);
            return null;
        }
    }

    _persistState() {
        try {
            const stateToSave = {
                ...this._state,
                connected: false, // Don't persist connection state
                authenticated: false
            };
            localStorage.setItem('aurora-dashboard-state',
                JSON.stringify(stateToSave));
        } catch (error) {
            console.error('Failed to persist state:', error);
        }
    }

    // Layout Management
    _setupResizeObserver() {
        this._resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                this._updateLayout(width);
            }
        });
        this._resizeObserver.observe(this.shadowRoot.querySelector('.dashboard'));
    }

    _handleResize() {
        const width = this.shadowRoot.querySelector('.dashboard').offsetWidth;
        this._updateLayout(width);
    }

    _updateLayout(width) {
        const newMode = width < 768 ? 'mobile' : 'desktop';
        if (this._state.layout.mode !== newMode) {
            this.setState({
                layout: {
                    ...this._state.layout,
                    mode: newMode
                }
            });
        }
    }

    _getDefaultComponentOrder() {
        return [
            'aurora-media-controls',
            'aurora-visualizer',
            'aurora-effect-selector',
            'aurora-group-manager',
            'aurora-performance-monitor'
        ];
    }

    // Enhanced UI rendering
    _render() {
        const style = `
            <style>
                :host {
                    display: block;
                    width: 100%;
                    height: 100%;
                    --primary-color: var(--aurora-primary-color, #7289da);
                    --error-color: var(--aurora-error-color, #f44336);
                    --success-color: var(--aurora-success-color, #4caf50);
                    --warning-color: var(--aurora-warning-color, #ff9800);
                    --text-primary: var(--aurora-text-primary, rgba(0, 0, 0, 0.87));
                    --text-secondary: var(--aurora-text-secondary, rgba(0, 0, 0, 0.54));
                    --transition-duration: 0.3s;
                    --transition-timing: cubic-bezier(0.4, 0, 0.2, 1);
                }

                .dashboard {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: var(--spacing-md, 16px);
                    padding: var(--spacing-md, 16px);
                    height: 100%;
                    transition: all var(--transition-duration) var(--transition-timing);
                    animation: fadeIn 0.5s var(--transition-timing);
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .dashboard.mobile {
                    grid-template-columns: 1fr;
                }

                .component-container {
                    background: var(--component-bg, #ffffff);
                    border-radius: var(--border-radius, 8px);
                    box-shadow: var(--shadow, 0 2px 4px rgba(0,0,0,0.1));
                    overflow: hidden;
                    transition: all var(--transition-duration) var(--transition-timing);
                    transform-origin: center;
                    animation: scaleIn 0.3s var(--transition-timing);
                }

                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }

                .component-container:hover {
                    transform: translateY(-2px);
                    box-shadow: var(--shadow-hover, 0 4px 8px rgba(0,0,0,0.15));
                }

                .component-error {
                    padding: 16px;
                    background: var(--error-color);
                    color: white;
                    margin: 8px;
                    border-radius: 4px;
                    animation: slideIn 0.3s var(--transition-timing);
                }

                @keyframes slideIn {
                    from { transform: translateX(-100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                .status-bar {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 16px;
                    background: var(--primary-color);
                    color: white;
                    z-index: 1000;
                    transition: transform var(--transition-duration) var(--transition-timing);
                    backdrop-filter: blur(10px);
                    animation: slideUp 0.3s var(--transition-timing);
                }

                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }

                .status-bar.hidden {
                    transform: translateY(100%);
                }

                .notification {
                    position: fixed;
                    top: 16px;
                    right: 16px;
                    padding: 12px 24px;
                    border-radius: 4px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    z-index: 1000;
                    animation: slideInRight 0.3s var(--transition-timing);
                    backdrop-filter: blur(5px);
                }

                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }

                .notification.error {
                    background: var(--error-color);
                    color: white;
                }

                .notification.success {
                    background: var(--success-color);
                    color: white;
                }

                .loading-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 2000;
                    animation: fadeIn 0.3s var(--transition-timing);
                    backdrop-filter: blur(5px);
                }

                .loading-spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid var(--primary-color);
                    border-radius: 50%;
                    border-top-color: transparent;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .component-transition-enter {
                    opacity: 0;
                    transform: scale(0.95);
                }

                .component-transition-enter-active {
                    opacity: 1;
                    transform: scale(1);
                    transition: opacity var(--transition-duration) var(--transition-timing),
                                transform var(--transition-duration) var(--transition-timing);
                }

                .component-transition-exit {
                    opacity: 1;
                    transform: scale(1);
                }

                .component-transition-exit-active {
                    opacity: 0;
                    transform: scale(0.95);
                    transition: opacity var(--transition-duration) var(--transition-timing),
                                transform var(--transition-duration) var(--transition-timing);
                }

                .pulse {
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                    100% { transform: scale(1); }
                }

                .shake {
                    animation: shake 0.82s cubic-bezier(.36,.07,.19,.97) both;
                }

                @keyframes shake {
                    10%, 90% { transform: translate3d(-1px, 0, 0); }
                    20%, 80% { transform: translate3d(2px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-4px, 0, 0); }
                    40%, 60% { transform: translate3d(4px, 0, 0); }
                }

                @media (max-width: 768px) {
                    .dashboard {
                        padding: 8px;
                        gap: 8px;
                    }

                    .status-bar {
                        padding: 4px 8px;
                    }

                    .notification {
                        width: 90%;
                        left: 5%;
                        right: 5%;
                    }
                }

                @media (prefers-reduced-motion: reduce) {
                    *, ::before, ::after {
                        animation-duration: 0.01ms !important;
                        animation-iteration-count: 1 !important;
                        transition-duration: 0.01ms !important;
                        scroll-behavior: auto !important;
                    }
                }
            </style>
        `;

        const dashboard = `
            <div class="dashboard ${this._state.layout.mode}">
                ${this._renderLoadingOverlay()}
                ${this._renderComponents()}
            </div>
            ${this._renderStatusBar()}
            ${this._renderNotifications()}
        `;

        this.shadowRoot.innerHTML = style + dashboard;
    }

    _renderLoadingOverlay() {
        if (!this._state.loading) return '';
        return `
            <div class="loading-overlay">
                <div class="loading-spinner"></div>
            </div>
        `;
    }

    _renderComponents() {
        return this._state.layout.componentOrder
            .map((name, index) => {
                const error = this._errorBoundaries.get(name);
                const componentState = this._componentStates.get(name);
                const delay = index * 100; // Stagger animation

                return `
                    <div class="component-container" style="animation-delay: ${delay}ms">
                        ${error ? this._renderComponentError(name, error) : ''}
                        <${name} 
                            .state="${componentState}"
                            .mode="${this._state.layout.mode}"
                            @state-change="${e => this._handleComponentStateChange(name, e.detail)}"
                            @error="${e => this._handleComponentError(name, e.detail)}"
                        ></${name}>
                    </div>
                `;
            })
            .join('');
    }

    _renderComponentError(name, error) {
        return `
            <div class="component-error shake">
                <h3>Error in ${name}</h3>
                <p>${error.message}</p>
                <button @click="${() => this._retryComponent(name)}">
                    Retry
                </button>
            </div>
        `;
    }

    _renderStatusBar() {
        const { connected, authenticated } = this._state;
        const statusBarClass = connected && authenticated ? '' : 'hidden';
        return `
            <div class="status-bar ${statusBarClass}">
                <div class="status-info">
                    ${this._renderConnectionStatus()}
                </div>
                <div class="performance-info">
                    ${this._renderPerformanceInfo()}
                </div>
            </div>
        `;
    }

    _renderConnectionStatus() {
        const { connected, authenticated } = this._state;
        return `
            <span class="status-indicator ${connected ? 'connected' : ''}">
                ${connected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
            ${authenticated ? '✓ Authenticated' : ''}
        `;
    }

    _renderPerformanceInfo() {
        const { latency, cpuUsage } = this._state.performanceMetrics;
        return `
            <span>Latency: ${latency}ms</span>
            <span>CPU: ${cpuUsage}%</span>
        `;
    }

    _renderNotifications() {
        if (!this._state.error) return '';

        return `
            <div class="notification error">
                <p>${this._state.error.message}</p>
                <button @click="${() => this.setState({ error: null })}">
                    Dismiss
                </button>
            </div>
        `;
    }

    // Utility methods
    _retryComponent(name) {
        this._errorBoundaries.delete(name);
        const importFn = this._components.get(name);
        if (importFn) {
            this._registerComponent(name, importFn);
        }
    }

    _updateTheme(mode) {
        const root = this.shadowRoot.host;
        root.style.setProperty('--component-bg',
            mode === 'dark' ? '#2d2d2d' : '#ffffff');
        // Add more theme-specific styles as needed
    }

    // WebSocket Connection Management
    async _initializeWebSocket() {
        if (this._connection) {
            this._cleanupWebSocket();
        }

        try {
            const auth = await this._getAuthToken();
            if (!auth) {
                throw new Error('Authentication failed');
            }

            const wsUrl = this._getWebSocketUrl();
            this._connection = new WebSocket(wsUrl);
            this._connection.onopen = () => this._handleWebSocketOpen();
            this._connection.onclose = this._handleWebSocketClose;
            this._connection.onerror = this._handleWebSocketError;
            this._connection.onmessage = this._handleWebSocketMessage;

            // Set up ping interval
            this._setupPingInterval();
        } catch (error) {
            this._handleError({
                type: 'websocket',
                message: 'Failed to initialize WebSocket connection',
                error
            });
            this._attemptReconnect();
        }
    }

    _getWebSocketUrl() {
        const hassUrl = this._config.hassUrl || window.location.origin;
        const wsProtocol = hassUrl.startsWith('https') ? 'wss' : 'ws';
        const baseUrl = hassUrl.replace(/^https?:\/\//, '');
        return `${wsProtocol}://${baseUrl}/api/websocket`;
    }

    async _getAuthToken() {
        if (this._authToken) {
            return this._authToken;
        }

        try {
            // Try to get token from localStorage first
            const savedToken = localStorage.getItem('aurora_auth_token');
            if (savedToken) {
                const token = JSON.parse(savedToken);
                if (this._isTokenValid(token)) {
                    this._authToken = token;
                    return token;
                }
            }

            // Request new token if needed
            const token = await this._requestNewAuthToken();
            if (token) {
                this._authToken = token;
                localStorage.setItem('aurora_auth_token', JSON.stringify(token));
                return token;
            }

            throw new Error('Failed to obtain authentication token');
        } catch (error) {
            this._handleError({
                type: 'auth',
                message: 'Authentication failed',
                error
            });
            return null;
        }
    }

    async _requestNewAuthToken() {
        try {
            const response = await fetch('/auth/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    client_id: 'aurora-sound-to-light',
                    grant_type: 'authorization_code',
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return {
                access_token: data.access_token,
                expires_at: Date.now() + (data.expires_in * 1000),
            };
        } catch (error) {
            this._handleError({
                type: 'auth',
                message: 'Failed to request new auth token',
                error
            });
            return null;
        }
    }

    _isTokenValid(token) {
        return token && token.access_token && token.expires_at && token.expires_at > Date.now();
    }

    _setupPingInterval() {
        this._pingInterval = setInterval(() => {
            if (this._connection && this._connection.readyState === WebSocket.OPEN) {
                this._sendPing();
            }
        }, 30000);
    }

    _sendPing() {
        try {
            this._lastPingTime = Date.now();
            this._sendMessage({
                type: 'ping'
            });
        } catch (error) {
            this._handleError({
                type: 'websocket',
                message: 'Failed to send ping',
                error
            });
        }
    }

    _handleWebSocketOpen() {
        this._reconnectAttempts = 0;
        this.setState({ connected: true });
        this._authenticate();
        this._processMessageQueue();
    }

    async _authenticate() {
        try {
            const auth = await this._getAuthToken();
            if (!auth) {
                throw new Error('No authentication token available');
            }

            this._sendMessage({
                type: 'auth',
                access_token: auth.access_token
            });

            // Subscribe to events after authentication
            this._subscribeToEvents();
        } catch (error) {
            this._handleError({
                type: 'auth',
                message: 'Authentication failed',
                error
            });
        }
    }

    _subscribeToEvents() {
        const subscriptions = [
            'aurora_sound_to_light_state_changed',
            'aurora_sound_to_light_effect_changed',
            'aurora_sound_to_light_performance_update'
        ];

        subscriptions.forEach(event => {
            this._sendMessage({
                type: 'subscribe_events',
                event_type: event
            });
        });
    }

    _handleWebSocketMessage(event) {
        try {
            const message = JSON.parse(event.data);

            // Dispatch WebSocket messages to event bus
            this._dispatchToBus('websocket-message', message, 'websocket');

            switch (message.type) {
                case 'auth_ok':
                    this.setState({ authenticated: true });
                    this._dispatchEvent('authenticated', { success: true });
                    break;

                case 'auth_invalid':
                    this.setState({ authenticated: false });
                    this._authToken = null;
                    localStorage.removeItem('aurora_auth_token');
                    this._dispatchEvent('authenticated', { success: false });
                    break;

                case 'pong':
                    if (this._lastPingTime) {
                        const latency = Date.now() - this._lastPingTime;
                        this.setState({
                            performanceMetrics: {
                                ...this._state.performanceMetrics,
                                latency
                            }
                        });
                    }
                    break;

                case 'event':
                    this._handleEventMessage(message);
                    break;

                default:
                    this._dispatchEvent('message', { message });
            }
        } catch (error) {
            this._handleError({
                type: 'websocket',
                message: 'Failed to process WebSocket message',
                error
            });
        }
    }

    _handleEventMessage(message) {
        const { event_type, data } = message;

        switch (event_type) {
            case 'aurora_sound_to_light_state_changed':
                this._updateAudioState(data);
                break;

            case 'aurora_sound_to_light_effect_changed':
                this._updateEffects(data);
                break;

            case 'aurora_sound_to_light_performance_update':
                this._updatePerformanceMetrics(data);
                break;
        }

        this._dispatchEvent(event_type, data);
    }

    _handleWebSocketClose(event) {
        this.setState({
            connected: false,
            authenticated: false
        });

        if (!event.wasClean) {
            this._handleError({
                type: 'websocket',
                message: 'WebSocket connection closed unexpectedly',
                code: event.code
            });
        }

        this._attemptReconnect();
    }

    _handleWebSocketError(error) {
        this._handleError({
            type: 'websocket',
            message: 'WebSocket error occurred',
            error
        });
    }

    _attemptReconnect() {
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            this._handleError({
                type: 'websocket',
                message: 'Maximum reconnection attempts reached'
            });
            return;
        }

        this._reconnectAttempts++;
        const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);

        setTimeout(() => {
            this._initializeWebSocket();
        }, delay);
    }

    _sendMessage(message) {
        if (!this._connection || this._connection.readyState !== WebSocket.OPEN) {
            this._messageQueue.push(message);
            return;
        }

        try {
            this._connection.send(JSON.stringify(message));
        } catch (error) {
            this._handleError({
                type: 'websocket',
                message: 'Failed to send message',
                error
            });
            this._messageQueue.push(message);
        }
    }

    _processMessageQueue() {
        while (this._messageQueue.length > 0) {
            const message = this._messageQueue.shift();
            this._sendMessage(message);
        }
    }

    _cleanupWebSocket() {
        if (this._connection) {
            this._connection.onclose = null;
            this._connection.onerror = null;
            this._connection.onmessage = null;
            this._connection.close();
            this._connection = null;
        }

        if (this._pingInterval) {
            clearInterval(this._pingInterval);
            this._pingInterval = null;
        }
    }

    // Event Bus System
    _dispatchToBus(event, detail, source = null) {
        const eventData = {
            type: event,
            detail,
            source,
            timestamp: Date.now()
        };

        // Store in history
        this._eventBus.history.unshift(eventData);
        if (this._eventBus.history.length > this._eventBus.maxHistoryLength) {
            this._eventBus.history.pop();
        }

        // Notify listeners
        if (this._eventBus.listeners.has(event)) {
            this._eventBus.listeners.get(event).forEach(listener => {
                try {
                    if (listener.source !== source) { // Prevent echo
                        listener.callback(eventData);
                    }
                } catch (error) {
                    this._handleError({
                        type: 'event',
                        message: `Event listener error for ${event}`,
                        error
                    });
                }
            });
        }

        // Log event for debugging if needed
        if (this._config.debug) {
            console.debug('Event Bus:', eventData);
        }
    }

    _subscribeToEventBus(event, callback, source = null) {
        if (!this._eventBus.listeners.has(event)) {
            this._eventBus.listeners.set(event, []);
        }

        const listener = { callback, source };
        this._eventBus.listeners.get(event).push(listener);

        // Return unsubscribe function
        return () => {
            const listeners = this._eventBus.listeners.get(event);
            const index = listeners.findIndex(l => l === listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
        };
    }

    // Event utility methods
    _dispatchEvent(type, detail) {
        const event = new CustomEvent(type, {
            detail,
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
        this._dispatchToBus(type, detail);
    }

    _getEventHistory(eventType = null, limit = 10) {
        let history = this._eventBus.history;
        if (eventType) {
            history = history.filter(event => event.type === eventType);
        }
        return history.slice(0, limit);
    }

    // Example of component communication
    _handleComponentStateChange(name, detail) {
        // Update component state
        this._componentStates.set(name, detail);

        // Dispatch to event bus
        this._dispatchToBus('component-state-changed', {
            component: name,
            state: detail
        }, name);

        // Update related components if needed
        this._updateRelatedComponents(name, detail);
    }

    _updateRelatedComponents(sourceName, detail) {
        // Define component relationships and update logic
        const relationships = {
            'aurora-media-controls': ['aurora-visualizer'],
            'aurora-visualizer': ['aurora-effect-selector'],
            'aurora-effect-selector': ['aurora-group-manager'],
            'aurora-performance-monitor': ['aurora-media-controls', 'aurora-visualizer']
        };

        if (relationships[sourceName]) {
            relationships[sourceName].forEach(targetName => {
                const targetComponent = this.shadowRoot.querySelector(targetName);
                if (targetComponent) {
                    targetComponent.updateFromEvent(sourceName, detail);
                }
            });
        }
    }

    // Service Layer Implementation
    async _initializeServices() {
        if (this._services.initialized) return;

        try {
            // Get available services
            const services = await this._fetchAvailableServices();
            services.forEach(service => this._services.available.add(service));

            // Register service handlers
            this._registerServiceHandlers();

            this._services.initialized = true;
            this._dispatchEvent('services-initialized', { success: true });
        } catch (error) {
            this._handleError({
                type: 'service',
                message: 'Failed to initialize services',
                error
            });
        }
    }

    async _fetchAvailableServices() {
        const response = await this.hass.callWS({
            type: 'aurora_sound_to_light/get_services'
        });
        return response.services || [];
    }

    _registerServiceHandlers() {
        // Audio Control Services
        this._registerServiceHandler('audio', {
            play: this._handleAudioPlay.bind(this),
            pause: this._handleAudioPause.bind(this),
            set_volume: this._handleSetVolume.bind(this),
            set_input: this._handleSetInput.bind(this)
        });

        // Effect Services
        this._registerServiceHandler('effect', {
            apply: this._handleApplyEffect.bind(this),
            remove: this._handleRemoveEffect.bind(this),
            update: this._handleUpdateEffect.bind(this),
            save_preset: this._handleSavePreset.bind(this),
            load_preset: this._handleLoadPreset.bind(this)
        });

        // Group Services
        this._registerServiceHandler('group', {
            create: this._handleCreateGroup.bind(this),
            update: this._handleUpdateGroup.bind(this),
            delete: this._handleDeleteGroup.bind(this),
            assign_zone: this._handleAssignZone.bind(this)
        });

        // System Services
        this._registerServiceHandler('system', {
            update_config: this._handleUpdateConfig.bind(this),
            restart: this._handleSystemRestart.bind(this),
            sync: this._handleSystemSync.bind(this)
        });
    }

    _registerServiceHandler(domain, handlers) {
        for (const [service, handler] of Object.entries(handlers)) {
            const serviceId = `${domain}.${service}`;
            this._services[serviceId] = handler;
        }
    }

    async _callService(domain, service, data = {}) {
        const serviceId = `${domain}.${service}`;

        if (!this._services.available.has(serviceId)) {
            throw new Error(`Service ${serviceId} is not available`);
        }

        try {
            // Log service call
            const callInfo = {
                domain,
                service,
                data,
                timestamp: Date.now()
            };
            this._services.callHistory.push(callInfo);

            // Dispatch event before service call
            this._dispatchToBus('service-call-start', callInfo);

            // Call Home Assistant service
            const response = await this.hass.callService(
                'aurora_sound_to_light',
                service,
                data
            );

            // Handle response
            this._handleServiceResponse(serviceId, response);

            // Dispatch success event
            this._dispatchToBus('service-call-success', {
                ...callInfo,
                response
            });

            return response;
        } catch (error) {
            // Handle error
            this._handleError({
                type: 'service',
                message: `Service call ${serviceId} failed`,
                error
            });

            // Dispatch error event
            this._dispatchToBus('service-call-error', {
                domain,
                service,
                data,
                error
            });

            throw error;
        }
    }

    // Service Handlers
    async _handleAudioPlay(data) {
        await this._callService('audio', 'play', data);
        this.setState({
            audioState: {
                ...this._state.audioState,
                isPlaying: true
            }
        });
    }

    async _handleAudioPause(data) {
        await this._callService('audio', 'pause', data);
        this.setState({
            audioState: {
                ...this._state.audioState,
                isPlaying: false
            }
        });
    }

    async _handleSetVolume(data) {
        await this._callService('audio', 'set_volume', data);
        this.setState({
            audioState: {
                ...this._state.audioState,
                volume: data.volume
            }
        });
    }

    async _handleSetInput(data) {
        await this._callService('audio', 'set_input', data);
        this.setState({
            audioState: {
                ...this._state.audioState,
                inputSource: data.source
            }
        });
    }

    async _handleApplyEffect(data) {
        const response = await this._callService('effect', 'apply', data);
        this.setState({
            activeEffects: [
                ...this._state.activeEffects,
                { id: response.effect_id, ...data }
            ]
        });
    }

    async _handleRemoveEffect(data) {
        await this._callService('effect', 'remove', data);
        this.setState({
            activeEffects: this._state.activeEffects.filter(
                effect => effect.id !== data.effect_id
            )
        });
    }

    async _handleUpdateEffect(data) {
        await this._callService('effect', 'update', data);
        this.setState({
            activeEffects: this._state.activeEffects.map(effect =>
                effect.id === data.effect_id ? { ...effect, ...data } : effect
            )
        });
    }

    async _handleSavePreset(data) {
        const response = await this._callService('effect', 'save_preset', data);
        this._dispatchToBus('preset-saved', {
            preset_id: response.preset_id,
            ...data
        });
    }

    async _handleLoadPreset(data) {
        const response = await this._callService('effect', 'load_preset', data);
        this.setState({
            activeEffects: response.effects
        });
    }

    async _handleCreateGroup(data) {
        const response = await this._callService('group', 'create', data);
        this._dispatchToBus('group-created', {
            group_id: response.group_id,
            ...data
        });
    }

    async _handleUpdateGroup(data) {
        await this._callService('group', 'update', data);
        this._dispatchToBus('group-updated', data);
    }

    async _handleDeleteGroup(data) {
        await this._callService('group', 'delete', data);
        this._dispatchToBus('group-deleted', data);
    }

    async _handleAssignZone(data) {
        await this._callService('group', 'assign_zone', data);
        this._dispatchToBus('zone-assigned', data);
    }

    async _handleUpdateConfig(data) {
        await this._callService('system', 'update_config', data);
        this._config = { ...this._config, ...data };
        this._dispatchToBus('config-updated', this._config);
    }

    async _handleSystemRestart(data) {
        await this._callService('system', 'restart', data);
        this._dispatchToBus('system-restarting', data);
    }

    async _handleSystemSync(data) {
        const response = await this._callService('system', 'sync', data);
        this.setState({
            activeEffects: response.effects,
            audioState: response.audio_state,
            performanceMetrics: response.metrics
        });
    }

    _handleServiceResponse(serviceId, response) {
        // Update component states based on service response
        if (response.state_update) {
            this.setState(response.state_update);
        }

        // Notify relevant components
        this._dispatchToBus('service-response', {
            serviceId,
            response
        });
    }
}

customElements.define('aurora-dashboard', AuroraDashboard); 