const EventEmitter = require('events');
const { io } = require('socket.io-client');

class ConnectionManager extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.serverUrl = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect(serverUrl) {
    if (this.socket) {
      this.disconnect();
    }

    this.serverUrl = serverUrl;
    console.log(`Connecting to: ${serverUrl}`);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      timeout: 10000
    });

    this.socket.on('connect', () => {
      console.log('Connected to VSteps server');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      this.connected = false;
      this.emit('disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.emit('connection-failed', error.message);
      }
    });

    this.socket.on('movement-detected', (data) => {
      console.log('Movement received:', data);
      this.emit('movement', data);
    });

    this.socket.on('jump-detected', () => {
      console.log('Jump received');
      this.emit('jump');
    });

    this.socket.on('step-detected', () => {
      this.emit('movement', { direction: 'forward' });
    });

    this.socket.on('step-count-update', (data) => {
      this.emit('step-count', data);
    });

    this.socket.on('direction-counts-update', (data) => {
      this.emit('direction-counts', data);
    });

    this.socket.on('sensor-data', (data) => {
      this.emit('sensor-data', data);
    });

    this.socket.on('phone-settings', (data) => {
      this.emit('phone-settings', data);
    });
  }

  sendSettings(settings) {
    if (this.socket?.connected) {
      this.socket.emit('desktop-settings', settings);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    this.serverUrl = null;
  }

  isConnected() {
    return this.connected;
  }

  getServerUrl() {
    return this.serverUrl;
  }
}

module.exports = { ConnectionManager };
