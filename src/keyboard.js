const EventEmitter = require('events');

class KeyboardController extends EventEmitter {
  constructor() {
    super();
    this.robot = null;
    this.heldKeys = new Map();
    this.holdDuration = 2000;
    this.sprintHoldDuration = 3000;
    this.isShiftHeld = false;
    this.mouseIntervals = new Map();
    this.mouseSensitivity = 50;
    
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

  handleMovement(direction, isSprint = false, customHoldDuration = null, cameraControl = false, mouseSensitivity = 50, burstMode = false, burstPresses = 8) {
    const key = this.getKeyForDirection(direction);
    if (!key) return;

    const duration = customHoldDuration || (isSprint ? this.sprintHoldDuration : this.holdDuration);
    this.mouseSensitivity = mouseSensitivity;

    if (burstMode) {
      if (this.heldKeys.has(key)) {
        clearTimeout(this.heldKeys.get(key).timer);
        this.releaseKey(key);
        this.heldKeys.delete(key);
      }
      this.handleBurstMovement(key, isSprint, burstPresses, cameraControl, direction, mouseSensitivity, duration);
      return;
    }

    if (this.heldKeys.has(key)) {
      clearTimeout(this.heldKeys.get(key).timer);
    } else {
      if (isSprint && !this.isShiftHeld) {
        this.pressKey('shift');
        this.isShiftHeld = true;
      }
      this.pressKey(key);
    }

    if (this.mouseIntervals.has(key)) {
      clearInterval(this.mouseIntervals.get(key));
      this.mouseIntervals.delete(key);
    }

    if (cameraControl && this.robot) {
      const mouseSpeed = Math.max(1, Math.round(mouseSensitivity / 10));
      let dx = 0;
      
      switch (direction) {
        case 'left':
          dx = -mouseSpeed;
          break;
        case 'right':
          dx = mouseSpeed;
          break;
        case 'forward':
          break;
      }
      
      if (dx !== 0) {
        const robotRef = this.robot;
        const interval = setInterval(() => {
          if (!robotRef) return;
          try {
            const pos = robotRef.getMousePos();
            robotRef.moveMouse(pos.x + dx, pos.y);
          } catch (err) {
            console.error('Mouse move error:', err.message);
          }
        }, 16);
        this.mouseIntervals.set(key, interval);
      }
    }

    const timer = setTimeout(() => {
      this.releaseKey(key);
      this.heldKeys.delete(key);
      
      if (this.mouseIntervals.has(key)) {
        clearInterval(this.mouseIntervals.get(key));
        this.mouseIntervals.delete(key);
      }
      
      if (this.isShiftHeld && this.heldKeys.size === 0) {
        this.releaseKey('shift');
        this.isShiftHeld = false;
      }
    }, duration);

    this.heldKeys.set(key, { timer, pressedAt: Date.now(), isSprint });
    
    const sprintLabel = isSprint ? ' (SPRINT + Shift)' : '';
    const cameraLabel = cameraControl && (direction === 'left' || direction === 'right') ? ' +MOUSE' : '';
    console.log(`Movement: ${direction} -> holding '${key}' for ${duration}ms${sprintLabel}${cameraLabel}`);
  }

  handleBurstMovement(key, isSprint, burstPresses, cameraControl, direction, mouseSensitivity, duration) {
    if (isSprint && !this.isShiftHeld) {
      this.pressKey('shift');
      this.isShiftHeld = true;
    }

    if (cameraControl && this.robot && (direction === 'left' || direction === 'right')) {
      const mouseSpeed = Math.max(1, Math.round(mouseSensitivity / 10));
      const dx = direction === 'left' ? -mouseSpeed : mouseSpeed;
      const robotRef = this.robot;
      const interval = setInterval(() => {
        if (!robotRef) return;
        try {
          const pos = robotRef.getMousePos();
          robotRef.moveMouse(pos.x + dx, pos.y);
        } catch (err) {
          console.error('Mouse move error:', err.message);
        }
      }, 16);
      
      if (this.mouseIntervals.has(key)) {
        clearInterval(this.mouseIntervals.get(key));
      }
      this.mouseIntervals.set(key, interval);
      
      setTimeout(() => {
        if (this.mouseIntervals.has(key)) {
          clearInterval(this.mouseIntervals.get(key));
          this.mouseIntervals.delete(key);
        }
      }, duration);
    }

    const pressDelay = 20;
    for (let i = 0; i < burstPresses; i++) {
      setTimeout(() => {
        this.tapKey(key);
      }, i * pressDelay);
    }

    const totalBurstTime = burstPresses * pressDelay;
    setTimeout(() => {
      if (this.isShiftHeld && isSprint) {
        this.releaseKey('shift');
        this.isShiftHeld = false;
      }
    }, totalBurstTime + 50);

    const sprintLabel = isSprint ? ' (SPRINT)' : '';
    console.log(`Burst: ${direction} -> tapping '${key}' ${burstPresses}x${sprintLabel}`);
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
    
    for (const [key, interval] of this.mouseIntervals) {
      clearInterval(interval);
    }
    this.mouseIntervals.clear();
    
    if (this.isShiftHeld) {
      this.releaseKey('shift');
      this.isShiftHeld = false;
    }
    
    ['w', 'a', 's', 'd', 'space', 'shift'].forEach(key => {
      this.releaseKey(key);
    });
    
    console.log('Released all keys and stopped mouse movement');
  }

  setHoldDuration(ms) {
    this.holdDuration = ms;
  }

  setSprintHoldDuration(ms) {
    this.sprintHoldDuration = ms;
  }
}

module.exports = { KeyboardController };
