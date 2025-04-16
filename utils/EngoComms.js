import { stringToBuffer } from "@zos/utils";
export default class EngoComms {
  init() {}
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
}
