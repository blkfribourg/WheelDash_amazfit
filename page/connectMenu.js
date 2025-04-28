import { getText } from "@zos/i18n";
import * as Styles from "zosLoader:./index.[pf].layout.js";
import AutoGUI from "@silver-zepp/autogui";
import BLEMaster, {
  PERMISSIONS,
  ab2hex,
  ab2num,
  ab2str,
} from "@silver-zepp/easy-ble";
import * as appService from "@zos/app-service";
import { queryPermission, requestPermission } from "@zos/app";
import ExitConfirmation from "../utils/ExitConfirmation";
import CurrentTime from "../utils/CurrentTime";
import Alarm from "../utils/Alarm";
import { back, exit } from "@zos/router";
import {
  createWidget,
  deleteWidget,
  widget,
  align,
  prop,
  anim_status,
} from "@zos/ui";

const { wdEvent } = getApp()._options.globalData;
let BLEConnections = null;
const ble = new BLEMaster();
const AppContext = {
  MenuUI: null,
  deviceQueue: [],
  //LKDecoder: null,
};
// need to check this is not resetted every time connectMenu is accessed, otherwise need to store status
// Listen for BLEConnections event and update UI accordingly

import { onKey, KEY_UP, KEY_EVENT_CLICK } from "@zos/interaction";

onKey({
  callback: (key, keyEvent) => {
    console.log("KEY EVENT: ", key, keyEvent);
    if (key === 36 && keyEvent === 1) {
      /*
      // HOME BUTTON ACTIVE2
      console.log("Exit app confirmation");
      const exitDialog = new ExitConfirmation(() => {
        console.log("Exit app");
        exitService();
        AppContext.MenuUI = null;
        exit();
      });
      exitDialog.showExitConfirmation();
      */
    }
    if (key === 93 && keyEvent === 1) {
      back(); //go to main
    }
    return true;
  },
});

const fakeRes = { hPWM: 3, speed: 23, temperature: 45, battery: 50 };
Page({
  onInit() {
    console.log("MenuInit----------------------------------------");

    console.log("MenuInit----------------------------------------");
    //request connection status

    this.menuPage = new ConnectionManagerUI();
    this.menuPage.init();
    AppContext.MenuUI = this.menuPage;
    wdEvent.emit("getBLEConnections", true);
    // this.BLE.init(BLEDevicesNb);
    // BLEMaster.SetDebugLevel(3);
  },
  build() {
    if (!BLEConnections || BLEConnections.length == 0) {
      console.log("No BLE connections found.");
      this.BLEScan = new BLEScan();
      return;
    }
    // AppContext.MenuUI.buildConnectMenu(BLEConnections);
  },
  onDestroy() {
    console.log("Menu onDestroy");
    if (this.menuPage && typeof this.menuPage.destroy === "function") {
      this.menuPage.destroy();
    }
  },
});

class BLEScan {
  constructor() {
    //  this.scan_init = scan_init;
    AppContext.deviceQueue = [];

    this.scan();
  }
  scan() {
    console.log("Starting BLE scan...");
    const scan_success = ble.startScan(
      (scan_result) => {
        const device = ble.get.devices();
        const keys = Object.keys(device);

        for (let i = 0; i < keys.length; i++) {
          const device_mac = keys[i];
          const device_name = device[keys[i]].dev_name;
          const isAlreadyInQueue = AppContext.deviceQueue.some(
            (queuedDevice) => queuedDevice.mac === device_mac
          );

          if (isAlreadyInQueue) {
            console.log(
              `Device ${device_name} (${device_mac}) is already in the queue. Skipping.`
            );
            continue;
          }

          const deviceTypes = [
            { prefix: "LK", type: "EUC" },
            { prefix: "ENGO", type: "Engo Smartglasses" },
            { prefix: "RVR", type: "Varia Radar" },
          ];

          let matched = false;
          if (device_name) {
            for (const { prefix, type } of deviceTypes) {
              if (device_name.startsWith(prefix)) {
                console.log(`${type} found, adding to queue:`, device_mac);
                AppContext.deviceQueue.push({
                  mac: device_mac,
                  name: device_name,
                  type: type,
                });
                AppContext.MenuUI.buildConnectMenu(AppContext.deviceQueue);
                matched = true;
                break;
              }
            }
          }
          if (!matched) {
            console.log(`unknown type found, adding to queue:`, device_mac);
            AppContext.deviceQueue.push({
              mac: device_mac,
              name: device_name,
              type: "Unknown",
            });
            AppContext.MenuUI.buildConnectMenu(AppContext.deviceQueue);
          }
        }
      },
      { allow_duplicates: true } // Ensure duplicates are allowed to keep scanning, needed ?
    );

    if (!scan_success) {
      console.log("Failed to start BLE scan.");
    }
  }
}

/*
to use to stop scan once validation is done: 
 if (AppContext.deviceQueue.length >= this.expectedDeviceCount) {
                  console.log("Expected devices found. Stopping scan.");
                  ble.stopScan();
                  wdEvent.emit("deviceQueue", AppContext.deviceQueue);
               
                  return;
                }

*/
class ConnectionManagerUI {
  constructor() {
    this.slideSwitches = [];
    this.connectButton = null;
    this.connectButtonState = null;
    this.deviceSwitchStatus = {};
    this.isActive = false; // Track if this UI is active
    this._bleConnectionsHandler = null;
    this._containerWidgets = []; // Track widgets in viewContainer
  }
  init() {
    this.isActive = true;
    createWidget(widget.BUTTON, {
      x: 0,
      y: 0,
      w: 480,
      h: 80,
      text: "Connect Menu",
      textSize: 30,
    });
    this.connectButton = createWidget(widget.BUTTON, {
      x: 0,
      y: 386,
      w: 480,
      h: 80,
      text: "Connect!",
      text_size: 30,
      normal_color: 0x333333,
      press_color: 0x0986d4,
      click_func: (button_widget) => {
        if (
          button_widget.text === "connecting" ||
          button_widget.text === "connected"
        ) {
          console.log("Already connected or connecting");
          return;
        } else {
          const checkedStatuses = this.getAllSwitchStatuses();
          console.log("Checked Statuses:", checkedStatuses);
          const checkedDevices = AppContext.deviceQueue.filter(
            (device, index) => {
              return checkedStatuses[index];
            }
          );

          console.log("Checked Devices:", JSON.stringify(checkedDevices));
          wdEvent.emit("deviceQueue", checkedDevices);
        }
      },
    });
    this.viewContainer = createWidget(widget.VIEW_CONTAINER, {
      x: 0,
      y: 80,
      w: 480,
      h: 320,
    });
    // Save handler reference for removal
    this._bleConnectionsHandler = (deviceList) => {
      BLEConnections = deviceList;
      if (!this.isActive) return;

      console.log("BLEConnections event received:", JSON.stringify(deviceList));
      const hasConnecting = deviceList.some(
        (device) => device.connected && !device.ready
      );
      const allConnected =
        deviceList.length > 0 &&
        deviceList.every((device) => device.connected && device.ready);

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
      this.buildConnectMenu(deviceList);
    };
    wdEvent.on("BLEConnections", this._bleConnectionsHandler);
  }
  buildConnectMenu(deviceList) {
    // Save current switch statuses before rebuilding
    deviceList.forEach((device, i) => {
      if (this.slideSwitches[i] && device.mac) {
        this.deviceSwitchStatus[device.mac] = this.slideSwitches[i].getProperty(
          prop.CHECKED
        );
      }
    });

    // Delete previous widgets in viewContainer
    if (this._containerWidgets && this._containerWidgets.length > 0) {
      this._containerWidgets.forEach((w) => {
        try {
          deleteWidget(w);
        } catch (e) {
          // Ignore errors if widget already deleted
        }
      });
      this._containerWidgets = [];
    }
    this.slideSwitches = [];

    console.log("Device List:", JSON.stringify(deviceList));
    console.log("Device Number:", deviceList.length);

    const gap = 10;
    deviceList.forEach((device, i) => {
      this.group = this.viewContainer.createWidget(widget.GROUP, {
        x: 70,
        y: gap * i + i * 80,
        w: 330,
        h: 80,
      });
      this._containerWidgets.push(this.group);
      this._containerWidgets.push(
        this.group.createWidget(widget.FILL_RECT, {
          x: 0,
          y: 0,
          w: 330,
          h: 80,
          color: 0x333333,
          radius: 20,
        })
      );
      this._containerWidgets.push(
        this.group.createWidget(widget.TEXT, {
          x: 10,
          y: 10,
          w: 330,
          h: 80,
          text: device.type + "\n" + device.name + ": " + device.mac,
          color: 0xffffff,
          text_size: 18,
        })
      );

      // Determine status based on connected/ready
      let status;
      if (device.connected === true && device.ready === true) {
        status = "connected";
      } else if (device.connected === true && device.ready === false) {
        status = "connecting";
      } else {
        status = "notConnected";
      }
      console.log("Device status:", device.name, ":", status);
      switch (status) {
        case "notConnected":
          // Use stored checked status or default to false
          const checked = this.deviceSwitchStatus[device.mac] || false;
          const slideSwitch = this.group.createWidget(widget.SLIDE_SWITCH, {
            x: 250,
            y: 21,
            w: 59,
            h: 40,
            select_bg: "switch_on.png",
            un_select_bg: "switch_off.png",
            slide_src: "radio_select.png",
            slide_select_x: 28,
            slide_un_select_x: 8,
            checked: checked,
            change_func: (sw) => {
              // Update checked status in the map when toggled
              this.deviceSwitchStatus[device.mac] = sw.getProperty(
                prop.CHECKED
              );
            },
          });
          this.slideSwitches.push(slideSwitch);
          this._containerWidgets.push(slideSwitch);
          break;
        case "connecting":
          const anim = this.group.createWidget(widget.IMG_ANIM, {
            anim_path: "anim",
            anim_prefix: "ani",
            anim_ext: "png",
            anim_fps: 24,
            anim_size: 54,
            repeat_count: 0,
            anim_status: anim_status.START,
            x: 250,
            y: 10,
            anim_complete_call: () => {
              //  this.state.logger.log("animation complete");
            },
          });
          this._containerWidgets.push(anim);
          break;
        case "connected":
          const img = this.group.createWidget(widget.IMG, {
            x: 260,
            y: 21,
            src: "done.png",
          });
          this._containerWidgets.push(img);
          break;
      }
    });
  }
  getAllSwitchStatuses() {
    // Returns an array of booleans, each corresponding to the checked status of the slide switches
    return this.slideSwitches.map((sw) => sw.getProperty(prop.CHECKED));
  }
  destroy() {
    this.isActive = false;
    // Remove event handler to prevent UI update on inactive page
    if (this._bleConnectionsHandler) {
      wdEvent.off("BLEConnections", this._bleConnectionsHandler);
      this._bleConnectionsHandler = null;
    }
  }
}
