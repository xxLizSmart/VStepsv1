const EventEmitter = require('events');

class KeyboardController extends EventEmitter {
  constructor() {
    super();
    this.robot = null;
    this.heldKeys = new Map();
    this.holdDuration = 3000;
    
    try {
      this.robot = require('robotjs');
      this.robot.setKeyboardDelay(0);
      console.log('RobotJS loaded successfully');
    } catch (err) {
      console.error('Failed to load robotjs:', err.message);
      console.log('Keyboard simulation will be disabled');
    }
  }

  getKeyForDirection(direction) {
    const keyMap = {
      'forward': 'w',
      'left': 'a',
      'right': 'd',
      'backward': 's'
    };
    return keyMap[direction] || null;
  }

  handleMovement(direction) {
    const key = this.getKeyForDirection(direction);
    if (!key) return;

    if (this.heldKeys.has(key)) {
      clearTimeout(this.heldKeys.get(key).timer);
    } else {
      this.pressKey(key);
    }

    const timer = setTimeout(() => {
      this.releaseKey(key);
      this.heldKeys.delete(key);
    }, this.holdDuration);

    this.heldKeys.set(key, { timer, pressedAt: Date.now() });
    
    console.log(`Movement: ${direction} -> holding '${key}' for ${this.holdDuration}ms`);
  }

  handleJump() {
    this.tapKey('space');
    console.log('Jump: pressed space');
  }

  pressKey(key) {
    if (!this.robot) return;
    try {
      this.robot.keyToggle(key, 'down');
    } catch (err) {
      console.error(`Failed to press key ${key}:`, err.message);
    }
  }

  releaseKey(key) {
    if (!this.robot) return;
    try {
      this.robot.keyToggle(key, 'up');
    } catch (err) {
      console.error(`Failed to release key ${key}:`, err.message);
    }
  }

  tapKey(key) {
    if (!this.robot) return;
    try {
      this.robot.keyTap(key);
    } catch (err) {
      console.error(`Failed to tap key ${key}:`, err.message);
    }
  }

  releaseAllKeys() {
    for (const [key, data] of this.heldKeys) {
      clearTimeout(data.timer);
      this.releaseKey(key);
    }
    this.heldKeys.clear();
    
    ['w', 'a', 's', 'd', 'space'].forEach(key => {
      this.releaseKey(key);
    });
    
    console.log('Released all keys');
  }

  setHoldDuration(ms) {
    this.holdDuration = ms;
  }
}

module.exports = { KeyboardController };
