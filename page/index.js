import * as appService from "@zos/app-service";
import { queryPermission, requestPermission } from "@zos/app";
import ExitConfirmation from "../utils/ExitConfirmation";
import CurrentTime from "../utils/CurrentTime";
import Alarm from "../utils/Alarm";
import { exit, push } from "@zos/router";
import { setWakeUpRelaunch } from "@zos/display";
import {
  createWidget,
  deleteWidget,
  widget,
  prop,
  anim_status,
  align,
} from "@zos/ui";

import {
  onKey,
  onGesture,
  GESTURE_UP,
  onWristMotion,
  WRIST_MOTION_LIFT,
  WRIST_MOTION_LOWER,
  WRIST_MOTION_FLIP,
  setBrightness,
  getBrightness,
} from "@zos/interaction";

import { setPageBrightTime, setScreenOff } from "@zos/display";
//Reimplement screen wake up, trying to avoid app exiting on screen off:
/*
onWristMotion({
  callback: (result) => {
    const { type, motion } = result;

    if (type === 3) {
      switch (motion) {
        case WRIST_MOTION_LIFT:
          console.log("wrist motion lift");
          setPageBrightTime({
            brightTime: 10000,
          });
          break;
        case WRIST_MOTION_LOWER:
          console.log("wrist motion lower");
          setScreenOff();
          break;
        case WRIST_MOTION_FLIP:
          console.log("wrist motion flip");
          setPageBrightTime({
            brightTime: 10000,
          });
          break;
      }
    }
  },
});
*/
//to block the gesture event

onGesture({
  callback: (event) => {
    return true;
  },
});
const { wdEvent } = getApp()._options.globalData;

const AppContext = { MainUI: null, DeviceMenuUI: null };
let globalDeviceList = [];
let currentView = "main"; // "main" or "connectMenu"
let mainWidgets = [];
let connectMenuWidgets = [];
let EUCConnected = false;
onKey({
  callback: (key, keyEvent) => {
    if (key === 36 && keyEvent === 1) {
      const exitDialog = new ExitConfirmation(() => {
        exitService();
        AppContext.MainUI = null;
        exit();
      });
      exitDialog.showExitConfirmation();
    }
    if (key === 93 && keyEvent === 1) {
      if (currentView === "main") {
        showConnectMenuUI();
      } else {
        showMainUI();
      }
    }
    return true;
  },
});

const serviceFile = "app-service/wd_ble";
const permissions = ["device:os.bg_service"];

function permissionRequest(vm) {
  const [result2] = queryPermission({ permissions });
  if (result2 === 0) {
    requestPermission({
      permissions,
      callback([result2]) {
        if (result2 === 2) startService(vm);
      },
    });
  } else if (result2 === 2) {
    startService();
  }
}
function startService() {
  appService.start({
    url: serviceFile,
    param: `service=${serviceFile}&action=start`,
    complete_func: (info) => {
      console.log(`startService result: ` + JSON.stringify(info));
    },
  });
}
function stopService() {
  appService.stop({
    url: serviceFile,
    param: `service=${serviceFile}&action=stop`,
    complete_func: (info) => {
      console.log(`stopService result: ` + JSON.stringify(info));
    },
  });
}
function exitService() {
  stopService();
  appService.exit();
}

// --- Event Handlers (top-level) ---
wdEvent.on("bleLog", (msg) => {
  console.log("[BLE SERVICE]", msg);
});
wdEvent.on("BLEConnections", (deviceList) => {
  console.log("BLEConnections event received");
  globalDeviceList = deviceList;

  EUCConnected = deviceList.some(
    (device) => device.type === "EUC" && device.connected && device.ready
  );
  if (AppContext.MainUI) {
    console.log("updating colors event handler", EUCConnected);
    AppContext.MainUI.isEUCConnected(EUCConnected);
  }

  if (AppContext.DeviceMenuUI && AppContext.DeviceMenuUI.isActive) {
    AppContext.DeviceMenuUI.updateConnectButton(deviceList);
    AppContext.DeviceMenuUI.buildConnectMenu(deviceList);
  }
});
wdEvent.on("EUCData", (result) => {
  if (AppContext.MainUI && AppContext.MainUI.updateUI) {
    const { hPWM, speed, temperature, battery } = result;
    AppContext.MainUI.updateUI(hPWM, speed, temperature, battery);
  }
});
wdEvent.on("scanResult", (deviceQueue) => {
  AppContext.deviceQueue = deviceQueue;
  if (AppContext.DeviceMenuUI && AppContext.DeviceMenuUI.isActive) {
    AppContext.DeviceMenuUI.buildConnectMenu(deviceQueue);
  }
});

Page({
  onInit() {
    /* workaround for notif issue, doesnt' work
    setTimeout(() => {
      setWakeUpRelaunch({ relaunch: true });
    }, 10000);
    
    setPageBrightTime({
      brightTime: 600000,
    });
    */
    new Alarm();
    showMainUI();
    wdEvent.emit("getBLEConnections", true);
  },
  build() {
    let services = appService.getAllAppServices();
    this.state = this.state || {};
    this.state.running = services.includes(serviceFile);
    if (!this.state.running) permissionRequest(this);
  },
  onDestroy() {
    clearMainUI();
    clearConnectMenuUI();
  },
});

// --- Main UI ---
function showMainUI() {
  clearConnectMenuUI();
  currentView = "main";
  const ui = new UI();
  ui.init();
  console.log("updating colors init", EUCConnected);
  ui.isEUCConnected(EUCConnected);
  AppContext.MainUI = ui;
}
function clearMainUI() {
  mainWidgets.forEach((w) => {
    try {
      deleteWidget(w);
    } catch {
      console.log("Error deleting widget:", w);
    }
  });
  mainWidgets = [];
  AppContext.MainUI = null;
}

// --- Connect Menu UI ---
function showConnectMenuUI() {
  clearMainUI();
  currentView = "connectMenu";
  const menuUI = new ConnectionManagerUI();
  menuUI.init();
  AppContext.DeviceMenuUI = menuUI;
  wdEvent.emit("getBLEConnections", true);
  if (!globalDeviceList || globalDeviceList.length === 0) {
    wdEvent.emit("startScan");
  }
}
function clearConnectMenuUI() {
  if (AppContext.DeviceMenuUI) {
    AppContext.DeviceMenuUI.destroy();
    AppContext.DeviceMenuUI = null;
  }
  connectMenuWidgets = [];
}

// --- Main UI Class ---
class UI {
  init() {
    this.isActive = false;
    this.txtColor = 0x999999;
    this.PWMColor = 0x999999;
    this.tempColor = 0x999999;
    this.batColor = 0x999999;

    mainWidgets.push(
      createWidget(widget.TEXT, {
        x: 180,
        y: 80,
        w: 100,
        h: 50,
        text: new CurrentTime().getCurrentTime(),
        color: 0xffffff,
        text_size: 30,
        align_h: align.CENTER_H,
      })
    );
    setInterval(() => {
      if (mainWidgets[0])
        mainWidgets[0].text = new CurrentTime().getCurrentTime();
    }, 1000);
    mainWidgets.push(
      (this.spd = createWidget(widget.TEXT, {
        x: 155,
        y: 140,
        w: 150,
        h: 150,
        text: "--",
        color: this.txtColor,
        text_size: 130,
        align_h: align.CENTER_H,
      }))
    );
    mainWidgets.push(
      (this.batVal = createWidget(widget.TEXT, {
        x: 80,
        y: 310,
        w: 80,
        h: 50,
        text: "--%",
        color: this.txtColor,
        text_size: 30,
        align_h: align.LEFT,
      }))
    );
    mainWidgets.push(
      (this.tempVal = createWidget(widget.TEXT, {
        x: 305,
        y: 310,
        w: 80,
        h: 50,
        text: "--°C",
        color: this.txtColor,
        text_size: 30,
        align_h: align.RIGHT,
      }))
    );
    mainWidgets.push(
      (this.PWMArc_bg = createWidget(widget.ARC, {
        x: 27.5,
        y: 27.5,
        w: 410,
        h: 410,
        radius: 0,
        color: 0x333333,
        start_angle: 150,
        end_angle: 390,
        line_width: 25,
      }))
    );
    mainWidgets.push(
      (this.PWMArc = createWidget(widget.ARC, {
        x: 27.5,
        y: 27.5,
        w: 410,
        h: 410,
        radius: 0,
        color: this.PWMColor,
        start_angle: 150,
        end_angle: 150,
        line_width: 25,
      }))
    );
    mainWidgets.push(
      (this.batArc_bg = createWidget(widget.ARC, {
        x: 62.5,
        y: 62.5,
        w: 340,
        h: 340,
        radius: 0,
        color: 0x333333,
        start_angle: 150,
        end_angle: 220,
        line_width: 25,
      }))
    );
    mainWidgets.push(
      (this.batArc = createWidget(widget.ARC, {
        x: 62.5,
        y: 62.5,
        w: 340,
        h: 340,
        radius: 0,
        color: this.batColor,
        start_angle: 150,
        end_angle: 150,
        line_width: 25,
      }))
    );
    mainWidgets.push(
      (this.tempArc_bg = createWidget(widget.ARC, {
        x: 62.5,
        y: 62.5,
        w: 340,
        h: 340,
        radius: 0,
        color: 0x333333,
        start_angle: 390,
        end_angle: 320,
        line_width: 25,
      }))
    );
    mainWidgets.push(
      (this.tempArc = createWidget(widget.ARC, {
        x: 62.5,
        y: 62.5,
        w: 340,
        h: 340,
        radius: 0,
        color: this.tempColor,
        start_angle: 390,
        end_angle: 390,
        line_width: 25,
      }))
    );
  }
  computeArcAngle(value, max, arc, reverse) {
    const range = arc.end_angle - arc.start_angle;
    let ratio = value / max;
    if (reverse) ratio = -ratio;
    return arc.start_angle + range * ratio;
  }
  isEUCConnected(isPaired) {
    this.spd.color = isPaired ? 0xffffff : 0x999999;
    this.tempVal.color = isPaired ? 0xffffff : 0x999999;
    this.batVal.color = isPaired ? 0xffffff : 0x999999;
    this.PWMArc.color = isPaired ? 0x58ba1a : 0x999999;
    this.tempArc.color = isPaired ? 0x58ba1a : 0x999999;
    this.batArc.color = isPaired ? 0x58ba1a : 0x999999;
  }

  updateUI(hPWM, speed, temperature, battery) {
    try {
      this.spd.text = speed != null ? Math.round(speed).toString() : "--";
      this.batVal.text = battery != null ? Math.round(battery) + " %" : "--%";
      this.tempVal.text =
        temperature != null ? Math.round(temperature) + " °C" : "--°C";
      this.PWMArc.end_angle = this.computeArcAngle(
        hPWM,
        100,
        this.PWMArc_bg,
        false
      );
      this.tempArc.end_angle = this.computeArcAngle(
        temperature,
        100,
        this.tempArc_bg,
        false
      );
      this.batArc.end_angle = this.computeArcAngle(
        battery,
        100,
        this.batArc_bg,
        false
      );
    } catch (error) {
      console.log("Error updating UI:", error);
    }
  }
}

// --- Connect Menu UI Class ---
class ConnectionManagerUI {
  constructor() {
    this.slideSwitches = [];
    this.connectButton = null;
    this.deviceSwitchStatus = {};
    this.isActive = false;
    this._containerWidgets = [];
  }
  init() {
    this.isActive = true;
    connectMenuWidgets.push(
      createWidget(widget.BUTTON, {
        x: 0,
        y: 0,
        w: 480,
        h: 80,
        text: "Connect Menu",
        textSize: 30,
      })
    );
    this.connectButton = createWidget(widget.BUTTON, {
      x: 0,
      y: 386,
      w: 480,
      h: 80,
      text: "Connect!",
      text_size: 30,
      normal_color: 0x333333,
      press_color: 0x0986d4,
      click_func: () => this.handleConnectClick(),
    });
    connectMenuWidgets.push(this.connectButton);
    this.viewContainer = createWidget(widget.VIEW_CONTAINER, {
      x: 0,
      y: 80,
      w: 480,
      h: 320,
    });
    connectMenuWidgets.push(this.viewContainer);
  }
  updateConnectButton(deviceList) {
    if (!this.connectButton) return;
    const hasConnecting = deviceList.some((d) => d.connected && !d.ready);
    const allConnected =
      deviceList.length > 0 && deviceList.every((d) => d.connected && d.ready);
    if (hasConnecting) {
      this.connectButton.text = "Connecting...";
      this.connectButton.normal_color = 0x333333;
      this.connectButton.press_color = 0x333333;
    } else if (allConnected) {
      this.connectButton.text = "Connected!";
      this.connectButton.normal_color = 0x333333;
      this.connectButton.press_color = 0x333333;
    } else {
      this.connectButton.text = "Connect!";
      this.connectButton.normal_color = 0x333333;
      this.connectButton.press_color = 0x0986d4;
    }
  }
  handleConnectClick() {
    if (
      this.connectButton.text === "connecting" ||
      this.connectButton.text === "connected"
    )
      return;
    const checkedStatuses = this.getAllSwitchStatuses();
    const checkedDevices = AppContext.deviceQueue.filter(
      (_, i) => checkedStatuses[i]
    );
    wdEvent.emit("deviceQueue", checkedDevices);
  }
  buildConnectMenu(deviceList) {
    deviceList.forEach((device, i) => {
      if (this.slideSwitches[i] && device.mac) {
        this.deviceSwitchStatus[device.mac] = this.slideSwitches[i].getProperty(
          prop.CHECKED
        );
      }
    });
    this._containerWidgets.forEach((w) => {
      try {
        deleteWidget(w);
      } catch {
        console.log("Error deleting widget:", w);
      }
    });
    this._containerWidgets = [];
    this.slideSwitches = [];
    const gap = 10;
    deviceList.forEach((device, i) => {
      const group = this.viewContainer.createWidget(widget.GROUP, {
        x: 70,
        y: gap * i + i * 80,
        w: 330,
        h: 80,
      });
      this._containerWidgets.push(group);
      this._containerWidgets.push(
        group.createWidget(widget.FILL_RECT, {
          x: 0,
          y: 0,
          w: 330,
          h: 80,
          color: 0x333333,
          radius: 20,
        })
      );
      this._containerWidgets.push(
        group.createWidget(widget.TEXT, {
          x: 10,
          y: 10,
          w: 330,
          h: 80,
          text: `${device.type}\n${device.name}: ${device.mac}`,
          color: 0xffffff,
          text_size: 18,
        })
      );
      let status = "notConnected";
      if (device.connected && device.ready) status = "connected";
      else if (device.connected && !device.ready) status = "connecting";
      switch (status) {
        case "notConnected": {
          const checked = this.deviceSwitchStatus[device.mac] || false;
          const slideSwitch = group.createWidget(widget.SLIDE_SWITCH, {
            x: 250,
            y: 21,
            w: 59,
            h: 40,
            select_bg: "switch_on.png",
            un_select_bg: "switch_off.png",
            slide_src: "radio_select.png",
            slide_select_x: 28,
            slide_un_select_x: 8,
            checked,
            change_func: (sw) => {
              this.deviceSwitchStatus[device.mac] = sw.getProperty(
                prop.CHECKED
              );
            },
          });
          this.slideSwitches.push(slideSwitch);
          this._containerWidgets.push(slideSwitch);
          break;
        }
        case "connecting": {
          const anim = group.createWidget(widget.IMG_ANIM, {
            anim_path: "anim",
            anim_prefix: "ani",
            anim_ext: "png",
            anim_fps: 24,
            anim_size: 54,
            repeat_count: 0,
            anim_status: anim_status.START,
            x: 250,
            y: 10,
          });
          this._containerWidgets.push(anim);
          break;
        }
        case "connected": {
          const img = group.createWidget(widget.IMG, {
            x: 260,
            y: 21,
            src: "done.png",
          });
          this._containerWidgets.push(img);
          break;
        }
      }
    });
  }
  getAllSwitchStatuses() {
    return this.slideSwitches.map((sw) => sw.getProperty(prop.CHECKED));
  }
  destroy() {
    this.isActive = false;
    this._containerWidgets.forEach((w) => {
      try {
        deleteWidget(w);
      } catch {}
    });
    this._containerWidgets = [];
    this.slideSwitches = [];
    connectMenuWidgets.forEach((w) => {
      try {
        deleteWidget(w);
      } catch {}
    });
    connectMenuWidgets = [];
  }
}
