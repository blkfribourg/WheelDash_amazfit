import { stringToBuffer } from "@zos/utils";
const { wdEvent } = getApp()._options.globalData;
import CurrentTime from "./CurrentTime";
export default class EngoComm {
  init() {
    this.engoPage = 1;
    this.lastPageIndex = 3;
    this.fw_version = null;
    this.engoConfigName = null; // name of the config to load
    this.battery = null;
    this.luma = null;
    this.configs = [];
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
    wdEvent.on("variaData", (data) => {
      this.variaTargetNb = data.length;
      this.variaTargetSpd = data[0].speed;
      this.variaTargetDst = data[0].distance;
    });
    wdEvent.on("EUCData", (data) => {
      if (this.engoReady) {
      }
    });
  }
  checkConfigExists(dataBuffer) {
    console.log("checkConfigExists called", dataBuffer);
    let configName = "whldsh_app";
    if (this.useMiles === true) {
      configName = "whldsh_appm";
    }

    const cfgList = [...dataBuffer];

    if (cfgList[1] === 0xd3 && cfgList[cfgList.length - 1] === 0xaa) {
      let tempName = [];

      for (let i = 4; i < cfgList.length; i++) {
        if (cfgList[i] === 0x00) {
          const decodedName = String.fromCharCode(...tempName);

          if (decodedName === configName) {
            console.log("config found!");
            this.engoConfigName = configName;
            return true;
          } else {
            i += 11; // Saut manuel (offset)
          }
          /*
              // Extraction de la version depuis cfgList
              const cfgEngoVer = cfgList.slice(i + 5, i + 9);
    
              // Exemple : récupération de la version attendue depuis JSON
              const jsonCfg = getJson("EngoCfg4");
              const lastRelevant = jsonCfg[jsonCfg.length - 2];
              const cfgVer = arrayToRawCmd(lastRelevant).slice(15, 19);
    
              // Comparaison des versions
              if (arraysEqual(cfgEngoVer, cfgVer)) {
                console.log("version is up to date");
                engoCfgOK = true;
              }
            }*/

          return false;
        }
      }
    }

    // Fonction utilitaire pour comparer deux tableaux
    function arraysEqual(a, b) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => val === b[i]);
    }
  }
  cyclePages() {
    this.engoPage = this.engoPage + 1;
    if (this.engoPage > this.lastPageIndex) this.engoPage = 1;
  }
  getHexText(text, lpadding, rpadding) {
    let hexText = this.utf8Encode(text);
    const textLength = text.length;

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
    const cmd = [0xff, 0x30, 0x00, 6, int];
    cmd.push(0xaa);
    cmd.push(...[0xff, 0x34, 0x00, 13]);
    cmd.push(...encodeint16(x0));
    cmd.push(...encodeint16(y0));
    cmd.push(...encodeint16(x1));
    cmd.push(...encodeint16(y1));
    cmd.push(0xaa);
    return cmd;
  }

  // on received engoRx:
  engoDisplayEUCData(EUCDataResult) {
    if (EUCDataResult) {
      const textArray = [];
      textArray.push(this.getHexText(new CurrentTime().getCurrentTime(), 0, 1));
      switch (this.engoPage) {
        case 1:
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
            this.getHexText(formatNumber(EUCDataResult.battery, 1) + " %", 0, 3)
          );
          const payload = this.pagePayload(textArray);
          return this.getPageCmd(payload, this.engoPage);

        // execute case 3:

        case 2: // ici faire la high speed view (index 3 & 4 de la conf engo), s'assurer qu'on skip le 2eme page pour le moment
          //WIP
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
            this.engoPage = 4;
            HRRPArray.push(this.getHexText(this.engoVariaData(), 3, 1));
          } else {
            if (this.engoVariaAlert == true) {
              clearVariaAlertHR();
              this.engoVariaAlert = false;
            }
            this.engoPage = 3;
          }

          return getPageCmd(pagePayload(HRRPArray), this.engoPage);
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

  engoVariaAlert() {
    const vehData = this.getHexText(this.engoVariaData(), 3, 1);
    const cmd = [0xff, 0x69, 0x00, vehData.length + 6, 0x28];
    cmd.push(...vehData);
    cmd.push(0xaa);
    return cmd;
  }

  clearVariaAlert() {
    return this.getClearRectCmd(12, 85, 61, 157, 0);
  }
  clearVariaAlertHR() {
    return this.getClearRectCmd(12, 154, 61, 226, 0); // tester y0:154 -> y1:226
  }
}
