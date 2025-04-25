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
import { createWidget, widget, align, prop, anim_status } from "@zos/ui";

const { wdEvent } = getApp()._options.globalData;
const ble = new BLEMaster();
const AppContext = {
  MenuUI: null,
  deviceQueue: [],
  //LKDecoder: null,
};

import { onKey, KEY_UP, KEY_EVENT_CLICK } from "@zos/interaction";

onKey({
  callback: (key, keyEvent) => {
    console.log("KEY EVENT: ", key, keyEvent);
    if (key === 36 && keyEvent === 1) {
      // HOME BUTTON ACTIVE2
      console.log("Exit app confirmation");
      const exitDialog = new ExitConfirmation(() => {
        console.log("Exit app");
        exitService();
        AppContext.MenuUI = null;
        exit();
      });
      exitDialog.showExitConfirmation();
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

    this.menuPage = new UI();
    this.menuPage.init();
    AppContext.MenuUI = this.menuPage;
    this.BLEScan = new BLEScan();
    // this.BLE.init(BLEDevicesNb);
    // BLEMaster.SetDebugLevel(3);
  },

  onDestroy() {
    console.log("Menu onDestroy");
  },
});

class BLEScan {
  constructor() {
    AppContext.deviceQueue = [];
    AppContext.deviceQueue.push({
      mac: "00:01:02:03:04:05",
      name: "LK000",
      type: "EUC",
      status: "disconnected",
    });
    AppContext.deviceQueue.push({
      mac: "00:01:02:03:04:06",
      name: "ENG000",
      type: "Engo Smartglasses",
      status: "connecting",
    });
    AppContext.deviceQueue.push({
      mac: "00:01:02:03:04:07",
      name: "RVR000",
      type: "Varia Radar",
      status: "connected",
    });
    AppContext.MenuUI.buildConnectMenu(AppContext.deviceQueue);
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
            { prefix: "ENG", type: "Engo Smartglasses" },
            { prefix: "RVR", type: "Varia Radar" },
          ];

          for (const { prefix, type } of deviceTypes) {
            if (device_name && device_name.startsWith(prefix)) {
              console.log(`${type} found, adding to queue:`, device_mac);
              AppContext.deviceQueue.push({
                mac: device_mac,
                name: device_name,
                type: type,
              });
              this.menuPage.buildConnectMenu(AppContext.deviceQueue);
              break;
            } else {
              // note this part is to be removed in the final version
              console.log(`unknow type found, adding to queue:`, device_mac);
              AppContext.deviceQueue.push({
                mac: device_mac,
                name: device_name,
                type: "Unknown",
              });
              this.menuPage.buildConnectMenu(AppContext.deviceQueue);
              break;
            }
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
class UI {
  constructor() {
    this.slideSwitches = [];
  }
  init() {
    createWidget(widget.BUTTON, {
      x: 0,
      y: 0,
      w: 480,
      h: 80,
      text: "Connect Menu",
      textSize: 30,
    });
    createWidget(widget.BUTTON, {
      x: 0,
      y: 386,
      w: 480,
      h: 80,
      text: "Connect!",
      textSize: 30,
      normal_color: 0x333333,
      press_color: 0x0986d4,
      click_func: () => {
        const checkedStatuses = this.getAllSwitchStatuses();
        console.log("Checked Statuses:", checkedStatuses);
        const checkedDevices = AppContext.deviceQueue.filter(
          (device, index) => {
            return checkedStatuses[index];
          }
        );
        console.log("Checked Devices:", JSON.stringify(checkedDevices));
      },
    });
  }
  buildConnectMenu(deviceList) {
    // Reset slideSwitches array each time menu is rebuilt
    this.slideSwitches = [];
    console.log("Device List:", JSON.stringify(deviceList));
    console.log("Device Number:", deviceList.length);
    console.log("Device:", deviceList[0].name);
    const viewContainer = createWidget(widget.VIEW_CONTAINER, {
      x: 0,
      y: 80,
      w: 480,
      h: 320,
    });
    const gap = 10;
    deviceList.forEach((device, i) => {
      const group = viewContainer.createWidget(widget.GROUP, {
        x: 70,
        y: gap * i + i * 80,
        w: 330,
        h: 80,
      });
      group.createWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: 330,
        h: 80,
        color: 0x333333,
        radius: 20,
      });
      group.createWidget(widget.TEXT, {
        x: 10,
        y: 10,
        w: 330,
        h: 80,
        text: device.type + "\n" + device.name + ": " + device.mac,
        color: 0xffffff,
        text_size: 18,
      });
      switch (device.status) {
        case "disconnected":
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
            checked: false,
          });
          this.slideSwitches.push(slideSwitch);
          break;
        case "connecting":
          group.createWidget(widget.IMG_ANIM, {
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
              this.state.logger.log("animation complete");
            },
          });

          // imgAnimation.setProperty(prop.ANIM_STATUS, anim_status.START);
          break;
        case "connected":
          group.createWidget(widget.IMG, {
            x: 260,
            y: 21,
            src: "done.png",
          });
          break;
      }
    });
  }
  getAllSwitchStatuses() {
    // Returns an array of booleans, each corresponding to the checked status of the slide switches
    return this.slideSwitches.map((sw) => sw.getProperty(prop.CHECKED));
  }
}
