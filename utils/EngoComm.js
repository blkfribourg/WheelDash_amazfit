import { stringToBuffer } from "@zos/utils";
const { wdEvent } = getApp()._options.globalData;
import CurrentTime from "./CurrentTime";
import { formatNumber } from "./MathUtils";

export default class EngoComm {
  constructor() {
    this.engoPage = 1;
    this.engoPage_current = -1;
    this.engoVariaAlert = false;
    this.lastPageIndex = 2;
    this.refreshEvery = 1000;
    this.batRefreshEvery = 60000;
    this.fw_version = null;
    this.engoConfigName = null; // name of the config to load
    this.battery = null;
    this.lastBatReqTS = -1;
    this.lastReqTS = -1;
    this.luma = null;
    this.cfgList = [];
    this.speedUnit = "km/h";
    this.temperatureUnit = "C";
    this.variaTargetSpd = 0;
    this.variaTargetNb = 0;
    this.variaTargetDst = 0;
    this.variaAlertType = 1; // 0 : Vehicles number, 1: closest vehicule distance,2 : closest vehicule speed
    this.engoReady = false;
    /*
    wdEvent.on("engoRx", (data) => {
      
      const dataBuffer = new Uint8Array(data);
      const cmdType = dataBuffer[1];
      switch (cmdType) {
        case 0x06: // firmware
          this.fw_version = dataBuffer.slice(4, 8);
          break;
        case 0x05: // battery
          this.battery = dataBuffer[4];
          break;
        case 0xd3: // config list
          this.checkConfigExists(dataBuffer);
          break;
        case 0x0a: // luma value (brightness)
          this.luma = dataBuffer[6];
          break;
      }
    });
    */
    wdEvent.on("engoGst", (data) => {
      console.log("engo gesture detected!");
      //cycle engo pages
      this.cyclePages();
    });
    wdEvent.on("engoBtn", (data) => {
      console.log("Button touch detected!");
      this.cyclePages();
      //cycle engo pages
    });
    wdEvent.on("variaTarget", (data) => {
      if (data.length > 0) {
        this.variaTargetNb = data.length;
        this.variaTargetSpd = data[0].speed;
        this.variaTargetDst = data[0].distance;
      } else {
        this.variaTargetNb = 0;
        this.variaTargetSpd = 0;
        this.variaTargetDst = 0;
      }
    });
  }
  checkConfigExists(dataBuffer) {
    let configName = "whldsh_app";
    if (this.useMiles === true) {
      configName = "whldsh_appm";
    }
    const configName_hex = this.getHexText(configName, 0, 0);
    this.cfgList.push(...dataBuffer);

    if (
      this.cfgList[1] === 0xd3 &&
      this.cfgList[this.cfgList.length - 1] === 0xaa
    ) {
      let tempName = [];
      let names = [];
      for (let i = 4; i < this.cfgList.length; i++) {
        if (this.cfgList[i] === 0x00) {
          // Use Array.prototype.every for value equality
          if (
            tempName.length === configName_hex.length &&
            tempName.every((v, idx) => v === configName_hex[idx])
          ) {
            this.engoConfigName = configName;
            console.log("Config name found: " + configName);
            return true;
          } else {
            names.push(...tempName);
            tempName = [];
            i += 11; // Manual offset
          }
        } else {
          tempName.push(this.cfgList[i]);
        }
      }
    }
    return false;
  }
  cyclePages() {
    this.engoPage = this.engoPage + 1;
    if (this.engoPage > this.lastPageIndex) this.engoPage = 1;
  }
  getHexText(text, lpadding, rpadding) {
    const text_str = String(text);
    let hexText = this.utf8Encode(text_str);
    const textLength = text_str.length;

    if (lpadding > 0) {
      const leftPadding = new Array(lpadding - textLength).fill(0x24);
      hexText = [...leftPadding, ...hexText];
    }

    if (rpadding > 0) {
      const rightPadding = new Array(rpadding).fill(0x24);
      hexText = [...hexText, ...rightPadding];
    }

    return hexText;
  }
  utf8Encode(text) {
    const utf8 = [];
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i);
      if (charCode < 0x80) {
        utf8.push(charCode);
      } else if (charCode < 0x800) {
        utf8.push(0xc0 | (charCode >> 6));
        utf8.push(0x80 | (charCode & 0x3f));
      } else {
        utf8.push(0xe0 | (charCode >> 12));
        utf8.push(0x80 | ((charCode >> 6) & 0x3f));
        utf8.push(0x80 | (charCode & 0x3f));
      }
    }
    return utf8;
  }
  encodeInt16(val) {
    return [(val >> 8) & 0xff, val & 0xff];
  }

  getWriteCmd(text, x, y, r, f, c) {
    const hexText = this.getHexText(text, 0, 0);
    const cmd = [0xff, 0x37, 0x00, 0x0d + hexText.length];

    cmd.push(...this.encodeInt16(x));
    cmd.push(...this.encodeInt16(y));
    cmd.push(r);
    cmd.push(f);
    cmd.push(c);
    cmd.push(...hexText);
    cmd.push(0x00);
    cmd.push(0xaa);

    return cmd;
  }
  getClearScreenCmd() {
    return [0xff, 0x01, 0x00, 0x05, 0xaa];
  }

  writeTextDefault(text, x, y) {
    const r = 4; // default rotation
    const c = 15;
    const f = 2; // default font

    const cmd = this.getWriteCmd(text, x, y, r, f, c);

    return cmd;
  }

  setConfigCmd() {
    const configName_hex = this.getHexText(this.engoConfigName, 0, 0);
    const cmd = [0xff, 0xd2, 0x00, 0x05 + configName_hex.length + 1];
    cmd.push(...configName_hex);
    cmd.push(0x00);
    cmd.push(0xaa);
    return cmd;
  }

  getConfigsCmd() {
    return [0xff, 0xd3, 0x00, 0x05, 0xaa];
  }
  getFwCmd() {
    return [0xff, 0x06, 0x00, 0x05, 0xaa];
  }
  getBatteryCmd() {
    return [0xff, 0x05, 0x00, 0x05, 0xaa];
  }

  getEnableGestureCmd() {
    return [0xff, 0x21, 0x00, 0x06, 0x01, 0xaa];
  }

  getPageCmd(payload, pageId) {
    const cmd = [0xff, 0x83, 0x00, payload.length + 6, pageId];
    cmd.push(...payload);
    cmd.push(0xaa);
    return cmd;
  }

  pagePayload(textArray) {
    return [].concat(
      ...textArray.map((item) =>
        Array.isArray(item) ? [...item, 0x00] : [item, 0x00]
      )
    );
  }

  getClearRectCmd(x0, y0, x1, y1, int) {
    const cmd = [0xff, 0x30, 0x00, 0x06, int];
    cmd.push(0xaa);
    cmd.push(...[0xff, 0x34, 0x00, 13]);
    cmd.push(...this.encodeInt16(x0));
    cmd.push(...this.encodeInt16(y0));
    cmd.push(...this.encodeInt16(x1));
    cmd.push(...this.encodeInt16(y1));
    cmd.push(0xaa);
    return cmd;
  }

  // on received engoRx:
  engoDisplayEUCData(EUCDataResult) {
    if (EUCDataResult) {
      let prefixCmd = []; // to send clear screen command before the getPageCmd
      const textArray = [];
      const time = new CurrentTime();
      const currentUTC = time.getUTCTimeStamp();

      if (this.battery > 0) {
        textArray.push(this.getHexText(this.battery + "%", 0, 1));
      } else {
        textArray.push(this.getHexText("", 0, 1));
      }

      textArray.push(this.getHexText(time.getCurrentTime(), 0, 1));

      switch (this.engoPage) {
        case 1:
          if (
            this.lastReqTS < 0 ||
            currentUTC - this.lastReqTS > this.refreshEvery
          ) {
            this.lastReqTS = currentUTC;
            if (this.engoPage_current !== this.engoPage) {
              prefixCmd = this.getClearScreenCmd();
              this.engoPage_current = this.engoPage;
            }
            if (
              this.lastBatReqTS < 0 ||
              currentUTC - this.lastBatReqTS > this.batRefreshEvery
            ) {
              // send battery command every minute
              prefixCmd.push(...this.getBatteryCmd());
              this.lastBatReqTS = currentUTC;
            }
            textArray.push(
              this.getHexText(
                formatNumber(Math.abs(EUCDataResult.hPWM), 1) + " %",
                0,
                3
              )
            );
            textArray.push(
              this.getHexText(
                formatNumber(EUCDataResult.speed, 1) + " " + this.speedUnit,
                0,
                3
              )
            );
            textArray.push(
              this.getHexText(
                formatNumber(EUCDataResult.temperature, 1) +
                  " *" +
                  this.temperatureUnit,
                0,
                3
              )
            );
            textArray.push(
              this.getHexText(
                formatNumber(EUCDataResult.battery, 1) + " %",
                0,
                3
              )
            );
            const payload = this.pagePayload(textArray);
            prefixCmd.push(...this.checkVaria());
            return [...prefixCmd, ...this.getPageCmd(payload, this.engoPage)];
          } else {
            prefixCmd.push(...this.checkVaria());
            return [...prefixCmd];
          }

        // execute case 3:

        case 2: // ici faire la high speed view (index 3 & 4 de la conf engo), s'assurer qu'on skip le 2eme page pour le moment
          if (this.engoPage_current !== this.engoPage) {
            prefixCmd = this.getClearScreenCmd();
            // prefixCmd = [0xff, 0x30, 0x00, 0x06, 0x0f, 0xaa];
            this.engoPage_current = this.engoPage;
          }
          let engoPage_local = 3;
          const PWM_rd =
            EUCDataResult.hPWM == null || EUCDataResult.hPWM === undefined
              ? 0
              : formatNumber(Math.abs(EUCDataResult.hPWM), 0);
          const speed_rd =
            EUCDataResult.speed == null || EUCDataResult.speed === undefined
              ? 0
              : formatNumber(EUCDataResult.speed, 0);
          const HRRPArray = []; // High Refresh Rate Page

          HRRPArray.push(this.getHexText(PWM_rd, 2, 0));
          HRRPArray.push(this.getHexText(speed_rd, 3, 1));

          if (this.variaTargetNb != 0) {
            this.engoVariaAlert = true;
            engoPage_local = 4;
            HRRPArray.push(this.getHexText(this.engoVariaData(), 3, 1));
          } else {
            if (this.engoVariaAlert) {
              prefixCmd.push(...this.clearVariaAlertHR());

              this.engoVariaAlert = false;
            }
            engoPage_local = 3;
          }
          this.engoPage_current = 2;

          return [
            ...prefixCmd,
            ...this.getPageCmd(this.pagePayload(HRRPArray), engoPage_local),
          ];
      }
    }
  }

  engoVariaData() {
    //TODO
    switch (this.variaAlertType) {
      case 0:
        return this.variaTargetNb;
      case 1:
        return this.variaTargetDst;
      case 2:
        return this.variaTargetSpd;
    }
  }

  engoVariaAlertCmd() {
    const vehData = this.getHexText(this.engoVariaData(), 3, 1);
    const cmd = [0xff, 0x69, 0x00, vehData.length + 6, 0x28];
    cmd.push(...vehData);
    cmd.push(0xaa);
    return cmd;
  }
  checkVaria() {
    const prefixCmd = [];
    if (this.variaTargetNb != 0) {
      this.engoVariaAlert = true;
      prefixCmd.push(...this.engoVariaAlertCmd());
    } else {
      if (this.engoVariaAlert) {
        prefixCmd.push(...this.clearVariaAlert());
        this.engoVariaAlert = false;
      }
    }
    return prefixCmd;
  }

  clearVariaAlert() {
    return this.getClearRectCmd(12, 85, 61, 157, 0);
  }
  clearVariaAlertHR() {
    return this.getClearRectCmd(12, 154, 61, 226, 0); // tester y0:154 -> y1:226
  }
}
